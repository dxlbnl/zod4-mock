# B85: world.trace() API + WorldTrace types (public contract)

## Context

`zod4-mock` grows a whole deterministic universe from one seed, but today that universe
is invisible: `.generate()` returns a JSON blob with no record IDs, no per-field
provenance, and no relation edges. The **World Explorer** ([brainstorm](../research/world-explorer.md),
[B84 site-architecture report §6](../research/reports/site-architecture-rebuild.md))
makes the universe walkable, and the foundational enabler is a library-native
`world.trace(): WorldTrace` data API — a plain, serializable provenance structure that
every Explorer view (and the future standalone HTML artifact) reads.

This card — the first library card of B84 Phase 4a — establishes only the **public
surface**: the `world.trace()` method and the five `WorldTrace` / `TraceNode` /
`TraceField` / `TraceEdge` / `TraceResolution` types. It is an intentional **stub**. Field-level provenance
capture (B86), relation-edge capture (B87), and friendly type-name IDs (B88) fill in the
substance in their own cards. Item card: [B85](../backlog/doing/B85-world-trace-api-and-types.md).

Grounding in the current `src/`:

- The registry (`src/registry.ts`) is keyed by `ZodTypeAny` **reference** and stores
  records in insertion order. It is the projection `trace()` reads to build `nodes`.
- Internal per-record IDs are computed for PRNG seeding in `src/world/engine.ts`
  (`reg${regId}#${index}` for primary records, `dreg${regId}#${index}` for derived) but
  never exposed. `regId` is the registration-order index assigned in `withSchema`.
- The `FieldResolution` tagged union lives in `src/pipeline.ts`. Its `kind` members today are
  `"override" | "matcher" | "keymap" | "absent" | "default" | "custom-gen" | "key-based" | "schema-based"`.
  This is an **internal** pipeline type — its member names are the pipeline rung names, and
  re-publishing them verbatim as public API would couple the public contract to an internal
  enum (a future pipeline rename would silently break consumers). B85 therefore does **not**
  type `TraceField.resolution` as `FieldResolution["kind"]`; see the *Resolution-type
  decoupling* note below.
- `world.explain(schema)` (B16) already speaks a per-field provenance vocabulary via
  `FieldExplanation { generator: string; reason: string }` in `src/types.ts`: `generator` is a
  stable generator-id string (e.g. `'person.firstName'`, `'matcher:<key>'`, `'schema-based'`),
  `reason` is a short human-readable explanation of which pipeline step picked the field.
  `world.trace()` and `world.explain()` MUST speak **one** provenance language, so
  `TraceField` reuses that `generator`/`reason` contract; see the *Explain alignment* note below.

**Resolution-type decoupling decision (B85 scope, settled at review).** `TraceField.resolution`
is typed as a **new public-stable union `TraceResolution`** declared in `src/trace.ts`, *not* the
internal `FieldResolution["kind"]`. `TraceResolution`'s members start **identical** to the
current `FieldResolution["kind"]` set
(`"override" | "matcher" | "keymap" | "absent" | "default" | "custom-gen" | "key-based" | "schema-based"`)
but it is its own public declaration. When field capture lands (B86) the implementer MUST map
the internal `FieldResolution["kind"]` → `TraceResolution` at the capture boundary as a **total**
mapping, so a future internal pipeline rename forces a deliberate update to that mapping rather
than silently breaking the public contract. `TraceResolution` is the **fifth** public type
exported from `src/index.ts` (alongside `WorldTrace` / `TraceNode` / `TraceField` / `TraceEdge`).

**Explain alignment decision (B85 scope, settled at review).** `TraceField` reuses the
`FieldExplanation` (`world.explain()`) provenance vocabulary: `TraceField extends FieldExplanation`,
inheriting `generator` (the stable generator-id string form — `'person.firstName'`,
`'matcher:<key>'`, `'schema-based'`) and `reason` (the short human-readable explanation), and
adding `path` / `value` / `resolution` / `forkKey` / `overridden` / `dependsOn`. `world.explain()`
and `world.trace()` thus stay one provenance language by construction. Because B85's stub emits
`fields: []`, this is a **type-shape / contract** requirement only at B85 — the implementer does
**not** populate `generator` / `reason` strings now; B86 wires the actual values through the
field-capture sink.

**Type-name source decision (B85 scope).** CLAUDE.md is explicit that there is **no
`defineSubjectType` API** — a `ZodTypeAny` reference *is* the identity. The B84 §10 Q3
answer ("friendly `person#1` from `defineSubjectType(name, …)`") assumed an API that does
not exist; resolving the friendly type-name source is **B88's** job, not this stub's. B85
therefore ships a concrete registration-order id scheme now (`node<regId>#<index>` for
primary records, `derived<regId>#<index>` for derived), with `TraceNode.type` set to the
same `node<regId>` / `derived<regId>` string. B88 later refines `type` (and, transitively,
the `id` prefix) to a friendly name without changing the *shape* of the contract. The id
scheme is a local, one-off scoping choice for the stub — recorded here, not in
`decisions.md`.

**Doc rule (current D5 / D24, post-B102).** D5 is no longer "hand-edit
`docs/api-reference.md`". The new public exports MUST carry TSDoc on the real `src/`
symbols, be curated into `scripts/docs/curation.ts`, and the generated artifacts
(`docs/api-reference.md` + `site/src/lib/docs/api/manifest.generated.ts`) MUST be
regenerated via `pnpm docs:generate`, with parity enforced by `pnpm docs:check` (part of
`pnpm validate`). The generated files are never hand-edited.

**Standing constraint (ADR + Rule at Done).** Once shipped, `WorldTrace` /
`TraceNode` / `TraceField` / `TraceEdge` / `TraceResolution` are a binding public contract
that B86/B87/B88 fill in and the site `/explorer` route (B90) plus the future `writeExplorer`
artifact consume. The implementer MUST author a `wiki/decisions.md` ADR recording this constraint;
the reviewer confirms the ADR exists; the manager promotes the one-line Rule at Done. See
the **Standing constraint** note in Out of scope.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B85-R1: `world.trace()` method on `World`

The `World` interface MUST expose a `trace(): WorldTrace` method that returns the
provenance structure for everything generated so far in the world's lifetime.

- Scenario: method exists and returns a WorldTrace
  GIVEN a world built with `createWorld({ seed: 1 })` and a registered object schema `S`
  WHEN the caller invokes `world.generate(S)` and then `world.trace()`
  THEN the return value is an object with exactly the keys `seed`, `nodes`, and `edges`
  (`seed` a number, `nodes` an array, `edges` an array).

### B85-R2: trace seed reflects the world seed

`WorldTrace.seed` MUST equal the world's root seed.

- Scenario: seed echoed
  GIVEN a world built with `createWorld({ seed: 7 })`
  WHEN the caller invokes `world.trace()`
  THEN `trace.seed === 7`.

### B85-R3: one node per stored registry record

`world.trace()` MUST emit exactly one `TraceNode` per record stored in the registry, in
registry insertion order, each node carrying `id`, `type`, `index`, `value`, `store`, and
`fields`.

- Scenario: node per record
  GIVEN a world with `createWorld({ seed: 1 })` and `world.populate(S, 3)` for a
  registered primary schema `S`
  WHEN the caller invokes `world.trace()`
  THEN `trace.nodes` has length 3, and for each node `i` (0-based) `node.index === i`,
  `node.value` deep-equals the corresponding `world.registry.all(S)[i]`, `node.store === true`,
  and `node.fields` is an empty array `[]`.

- Scenario: empty world
  GIVEN a freshly built world with `createWorld({ seed: 1 })` and no generation performed
  WHEN the caller invokes `world.trace()`
  THEN `trace.nodes` is `[]` and `trace.edges` is `[]`.

### B85-R4: stable registration-order node id scheme

Each `TraceNode.id` MUST be the string `` `${node.type}#${node.index}` ``, where `type`
is `` `node${regId}` `` for a primary record and `` `derived${regId}` `` for a derived
record (`regId` = the schema's registration order), and the same generation on the same
seed MUST produce byte-identical ids.

- Scenario: id shape and stability
  GIVEN two independently built worlds, each `createWorld({ seed: 1 })` with the same
  schema `S` registered first (so `regId === 0`) and `world.populate(S, 2)`
  WHEN each world's `world.trace()` is taken
  THEN both traces' `nodes[0].id === "node0#0"`, `nodes[1].id === "node0#1"`,
  `nodes[0].type === "node0"`, and the two traces' node id lists are identical.

### B85-R5: derived nodes carry derivedFrom

A `TraceNode` for a record produced from a derived schema (registered with `from:`) MUST
set `derivedFrom` to the id of its source node; a primary record's node MUST omit
`derivedFrom`.

- Scenario: derived lineage and primary omission
  GIVEN a world with a primary schema `P` registered first and a derived schema `D`
  (`world.withSchema(D, { from: P })`) registered second, after `world.populate(P, 1)`
  then `world.populateFrom(D, P)`
  WHEN the caller invokes `world.trace()`
  THEN the `P` node has no own `derivedFrom` property (`"derivedFrom" in node === false`),
  and the `D` node's `derivedFrom` equals the `P` node's `id`.

### B85-R6: empty fields and edges at the stub (capture pending B86/B87)

At this card `world.trace()` MUST emit `fields: []` on every node and `edges: []` on the
trace, regardless of whether the world was built with `trace: true`, because field capture
(B86) and edge capture (B87) are not yet implemented.

- Scenario: stub emits empty provenance even with trace enabled
  GIVEN a world built with `createWorld({ seed: 1, trace: true })` and a registered schema
  `S` with at least one relation and several fields, after `world.generate(S)`
  WHEN the caller invokes `world.trace()`
  THEN `trace.edges` is `[]` and every node's `fields` is `[]`.

### B85-R7: `trace` opt-in flag on `createWorld`

`WorldOptions` MUST accept an optional `trace?: boolean` flag; omitting it (or passing
`false`) MUST be accepted and MUST NOT change the stub's output relative to `trace: true`
at this card (both return the registry projection with empty `fields`/`edges`).

- Scenario: flag accepted, default and enabled agree at the stub
  GIVEN two worlds, one `createWorld({ seed: 1 })` (no flag) and one
  `createWorld({ seed: 1, trace: true })`, each with the same schema `S` registered and
  `world.generate(S)` run
  WHEN each world's `world.trace()` is taken
  THEN both calls succeed and the two traces deep-equal each other.

### B85-R8: WorldTrace is JSON-serializable end-to-end

The value returned by `world.trace()` MUST be fully JSON-serializable — no class
instances, functions, or symbols — so that round-tripping it through JSON yields a
deep-equal structure.

- Scenario: JSON round-trip is lossless
  GIVEN a world built with `createWorld({ seed: 1, trace: true })`, a registered schema
  `S`, and `world.populate(S, 2)` (with `S` containing at least a string, a number, and a
  nested object field)
  WHEN the caller computes `JSON.parse(JSON.stringify(world.trace()))`
  THEN the parsed value deep-equals `world.trace()`.

### B85-R9: five public types exported from the entry point

`src/index.ts` MUST re-export the five types `WorldTrace`, `TraceNode`, `TraceField`,
`TraceEdge`, and `TraceResolution`, defined in `src/trace.ts` with the field shapes this
spec lists.

- Scenario: type-only consumer compiles
  GIVEN a `.ts` file that imports
  `import type { WorldTrace, TraceNode, TraceField, TraceEdge, TraceResolution } from "zod4-mock"`
  and annotates values against each (a `WorldTrace` with `seed`/`nodes`/`edges`, a `TraceNode`
  with `id`/`type`/`index`/`value`/`derivedFrom`/`store`/`fields`, a `TraceField` with
  `path`/`value`/`resolution`/`generator`/`reason`/`forkKey`/`overridden`/`dependsOn`, a
  `TraceEdge` with `from`/`fromField`/`to`/`relation`/`kind`/`poolSize`/`pickedIndex`, and a
  `TraceResolution` annotated with the member `"schema-based"`)
  WHEN the project is type-checked via `pnpm typecheck`
  THEN type-checking passes with no error (all five types are public and shaped as specified).

### B85-R10: TSDoc + curation + regenerated docs (D5 / D24)

The new public exports (`trace()` on `World` and the five types) MUST carry authored TSDoc
in `src/`, be added to `scripts/docs/curation.ts`, and the generated docs artifacts MUST
be regenerated so `pnpm docs:check` passes.

- Scenario: docs parity holds
  GIVEN the new exports' TSDoc authored in `src/` and curation entries added in
  `scripts/docs/curation.ts`, with `pnpm docs:generate` run
  WHEN `pnpm docs:check` is run (the parity check inside `pnpm validate`)
  THEN it exits zero (the generated `docs/api-reference.md` and
  `site/src/lib/docs/api/manifest.generated.ts` are in sync with the curated TSDoc), and
  the five new types plus `trace` appear in `docs/api-reference.md`.

### B85-R11: `TraceField.resolution` is the public `TraceResolution` union, decoupled from the internal pipeline enum

`TraceField.resolution` MUST be typed as the public `TraceResolution` union declared in
`src/trace.ts` — not the internal `FieldResolution["kind"]` from `src/pipeline.ts` — whose
members are exactly
`"override" | "matcher" | "keymap" | "absent" | "default" | "custom-gen" | "key-based" | "schema-based"`.

- Scenario: resolution accepts a TraceResolution member and rejects arbitrary strings
  GIVEN a `.ts` file importing `TraceField` and `TraceResolution` from `"zod4-mock"`, with one
  `TraceField` whose `resolution` is `"schema-based"` and a second `TraceField` whose
  `resolution` is the arbitrary string `"not-a-rung"`
  WHEN the project is type-checked via `pnpm typecheck`
  THEN the first compiles and the second is a type error (the `"not-a-rung"` case is annotated
  `// @ts-expect-error` so the suite passes only while `resolution` is the closed `TraceResolution`
  union and not `string`).

- Scenario: TraceResolution is a standalone public declaration, not an alias of the internal enum
  GIVEN `src/trace.ts`
  WHEN the file is read
  THEN `TraceResolution` is declared in `src/trace.ts` as its own union literal type (it does
  **not** reference, import, or alias `FieldResolution` / `FieldResolution["kind"]` from
  `src/pipeline.ts`), and `TraceField.resolution` is typed `TraceResolution`.

### B85-R12: `TraceField` shares `explain()`'s `generator`/`reason` provenance contract

`TraceField` MUST reuse the `FieldExplanation` (`world.explain()`) provenance vocabulary —
`TraceField extends FieldExplanation` so it inherits the identical `generator: string` and
`reason: string` contract and adds `path` / `value` / `resolution` / `forkKey` / `overridden` /
`dependsOn` — so `world.trace()` and `world.explain()` speak one provenance language. (No
node emits a populated `TraceField` at this stub; this pins the *type shape* only — generator-id
strings are wired in B86.)

- Scenario: TraceField is assignable to FieldExplanation's generator/reason shape
  GIVEN a `.ts` file importing `TraceField` and `FieldExplanation` from `"zod4-mock"` with a
  value `tf: TraceField` carrying every field
  (`path`/`value`/`resolution`/`generator`/`reason`/`forkKey`/`overridden`/`dependsOn`)
  WHEN the file assigns `const fe: FieldExplanation = tf` and type-checks via `pnpm typecheck`
  THEN type-checking passes (`tf.generator` and `tf.reason` satisfy `FieldExplanation`'s
  `generator: string` / `reason: string` contract — the two types share one generator/reason shape).

## Out of scope

- **No field-level provenance capture** — `TraceField` is the public *type*, but no node
  emits a non-empty `fields` array at this card. The capture sink threaded through
  `generateObjectFields` / `walkPipeline` is **B86**.
- **No relation-edge capture** — `TraceEdge` is the public *type*, but `edges` is always
  `[]` here. Recording `ctx.related` picks is **B87**.
- **No friendly type names** — `TraceNode.type` is the registration-order `node<regId>` /
  `derived<regId>` string at this card. Mapping a `ZodTypeAny` registration to a friendly
  `person`-style display name (and the per-registration name source it needs) is **B88**.
- **No always-on capture** — flipping `trace` capture to always-on (and any hot-path
  benchmark gating that) is a later v2 ADR (B84 §10 Q4); this card only adds the opt-in
  flag plumbing.
- **No `world.writeExplorer(path)`** — the standalone HTML artifact writer is deferred to
  Phase 4 v2 (B84 §10 Q5).
- **Ghost / `store: false` ephemerals** — `store:false` records are not written to the
  registry, so they do not appear as nodes here; surfacing discarded ephemerals as ghost
  nodes is future Explorer work, not this stub.

**Standing constraint (for the manager / reviewer):** this spec establishes the
`WorldTrace` public contract. The implementer MUST add a `wiki/decisions.md` ADR for it
(rationale: the trace shape is consumed by the standalone artifact and the site, so a
breaking change is a SemVer bump); the reviewer confirms the ADR; the manager promotes the
one-line Rule into `architecture.md`'s Rules at Done. Comply with **D1** (no `any` —
`value: unknown` on `TraceNode`/`TraceField` is intentional, *not* `any`) and **D13** (no
`node:*` imports; `src/trace.ts` is pure types and `world.trace()` builds plain objects).

## Open questions

- **(non-blocking)** Friendly type-name source for `TraceNode.type` / the `id` prefix.
  Settled for *this* card: B85 ships the registration-order `node<regId>` / `derived<regId>`
  scheme (decisive — derivable from the repo today, no maintainer decision needed). The
  friendly `person`-style source is explicitly **B88's** problem; B85 does not block on it.
  Non-blocking: the stub's id scheme is concrete and testable now.

- **(non-blocking)** Node ordering when primary and derived records interleave across
  multiple registry buckets. B85-R3 pins ordering to **registry insertion order** within
  the trace; the precise cross-bucket ordering rule (single global insertion order vs.
  per-bucket concatenation) does not affect the stub's correctness against the scenarios
  here and can be refined when B86/B87 add field/edge cross-references. Recorded, proceeds.
