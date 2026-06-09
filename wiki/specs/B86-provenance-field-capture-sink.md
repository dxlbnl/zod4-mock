# B86: Provenance field-capture sink — per-field resolution + sibling reads

## Context

`zod4-mock` grows a whole deterministic universe from one seed, and
`world.trace(): WorldTrace` ([B85](B85-world-trace-api-and-types.md)) makes it walkable
as a JSON-serializable provenance structure. B85 shipped the public surface — the method,
the five `WorldTrace` / `TraceNode` / `TraceField` / `TraceEdge` / `TraceResolution` types
([`src/trace.ts`](../../src/trace.ts)) — but as an intentional **stub**: every node emits
`fields: []`. [B88](B88-stable-record-ids.md) then made each `TraceNode.id` the friendly
`<typeName>#<index>` form (`person#1`).

This card — the second library card of B84's Phase 4a — fills in the **field substance**:
it threads a gated provenance-capture sink through the per-field pipeline so each
`TraceField` records _how_ its value was decided (which pipeline rung resolved it, the
generator/reason vocabulary, the PRNG fork key, override status, and the sibling fields it
read). Edge capture (`TraceEdge` at `ctx.related` pick sites) is the sibling card
[B87](B87-provenance-relation-edge-sink.md) and is **out of scope** here.

Item card: [B86](../backlog/doing/B86-provenance-field-capture-sink.md). Predecessors:
[B85](B85-world-trace-api-and-types.md) (types), [B88](B88-stable-record-ids.md) (friendly
ids).

### Binding approach — the B113 spike

The approach is fixed by the [B113 trace-capture-architecture spike](../research/engine/trace-capture-architecture.md):
**gated capture-DURING generation, NOT re-derive.** The spike measured the off-path
(`trace:false`) as throughput- and allocation-neutral (a single predicted boolean branch
per field) and proved re-derivation cannot reproduce path-dependent state faithfully.
Concretely for B86:

- Thread the gated sink through `generateObjectFields` ([`src/world/engine.ts`](../../src/world/engine.ts))
  and `walkPipeline` ([`src/pipeline.ts`](../../src/pipeline.ts)) via `PipelineStepContext`.
  The canonical `PIPELINE` (D11) stays the single source of truth — the sink lives in the
  step context, **not** a parallel ladder.
- Map the internal `FieldResolution["kind"]` → public `TraceResolution`
  ([B85-R11](B85-world-trace-api-and-types.md)) as a **total** mapping at the capture
  boundary, so a future internal pipeline rename forces a deliberate update rather than
  silently breaking the public contract.
- Reuse the `explain()` `generator` / `reason` vocabulary
  ([B85-R12](B85-world-trace-api-and-types.md), [`src/explain.ts`](../../src/explain.ts)),
  produced today by the `explainMeta` `{ identifier, reason }` writes in the pipeline step
  bodies. `world.trace()` and `world.explain()` MUST speak one provenance language.
- Extract the capture into a helper so `generateObjectFields` stays under the B23-R9 body
  length guard (< 50 LOC).

### Grounding in the current `src/`

- `generateObjectFields` ([`engine.ts`](../../src/world/engine.ts), ~L1269) walks
  `PIPELINE` per field, forking `recordPrng.fork(key)` per field and assigning
  `result[key] = walkPipeline(PIPELINE, {...}).value`. It is ~57 LOC today and already
  near the B23-R9 < 50 LOC ceiling — capture **must** be extracted, not inlined.
- The per-field `PipelineStepContext` carries `fieldOverride` and a per-rung
  `FieldResolution` is returned by `walkPipeline`. The internal `kind` set is
  `"override" | "matcher" | "keymap" | "absent" | "default" | "custom-gen" | "key-based" | "schema-based"`.
- The `explainMeta` slot on `PipelineStepContext` is `null` on the live generate path
  (B97 hot-path allocation saving) and `{}` only on the `explain()` `dryRun: true` path;
  the step bodies that write `identifier` / `reason` null-check first. To reuse the
  explain vocabulary during live capture, the implementer enables that capture under the
  trace gate (a non-`null` `explainMeta` on the trace path).
- `ctx.current` ([`types.ts`](../../src/types.ts), L93) is the in-progress `result`
  object passed **by reference** into `makeFieldCtx` (`engine.ts` L1156:
  `current: (current ?? {}) as Partial<unknown>`). Matchers read
  `ctx.current.<sibling>`. There is **no existing mechanism that tracks which sibling
  keys a matcher reads** — populating `dependsOn` requires a new capture mechanism. The
  maintainer chose (B86 review checkpoint, 2026-06-09) **a read-tracking `Proxy` over
  `ctx.current`, installed only under the `trace: true` gate**: a `get`-trap records each
  sibling key a field's matcher reads, so `TraceField.dependsOn` is populated from observed
  reads (R8). The off-path (`trace: false`) installs **no** Proxy and stays
  allocation-neutral (R10/R11) — the bare `result` object is passed unchanged. The
  proxy-under-gate pattern is a new **local constraint** (see Standing constraint).
- The friendly `forkKey` form: the per-field fork key in `recordPrng.fork(key)` is the
  bare field name (`key`), while the public-friendly form the card describes
  (`<typeName>#<index> ▸ <field>`) combines the B88 friendly node id with the field name.
  B86 records the **friendly composite** `` `${node.id} ▸ ${path}` `` (e.g.
  `"person#1 ▸ firstName"`) on `TraceField.forkKey` — the maintainer confirmed this
  composite at the B86 review checkpoint (2026-06-09) over the bare internal fork key. It is
  a display projection, mirroring B88's id projection — the internal `recordPrng.fork(key)`
  seed key stays byte-identical. The composite shape is pinned in R6.
- `world.trace()` ([`engine.ts`](../../src/world/engine.ts) L803) is a **pure projection
  of the registry** built after generation. B86's captured `TraceField`s must be attached
  to the correct node by `(node id, field path)`; the implementer stores captured fields
  keyed by record id and the projection assembles them onto each node's `fields` array.

### Standing constraint

The opt-in `createWorld({ trace: true })` gate and the capture-during (never re-derive)
mechanism are **already standing constraints** under **D26**
([`decisions.md`](../decisions.md)), which states trace provenance MUST be captured during
generation under the opt-in gate. B86 implements within D26; no new Rule promotion is
required for the gate or capture mechanism.

The maintainer's chosen `dependsOn` mechanism — a **read-tracking `Proxy` over
`ctx.current`, installed only under the `trace: true` gate** (R8) — is a new **local
constraint** that future trace/sibling-read work must follow: sibling-read provenance is
captured by trapping reads on a gated `Proxy`, never by mutating `ctx.current`'s shape or
by re-deriving reads after the fact, and the off-path installs no Proxy (allocation-neutral
per R10/R11). The implementer **MUST** record the rationale for the proxy-under-gate pattern
in [`decisions.md`](../decisions.md) (ADR-style, pairing with D26) and flag the constraint;
the manager decides whether to promote it to a one-line Rule at close.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B86-R1: each field yields a `TraceField` on its node (trace enabled)

When the world is built with `createWorld({ trace: true })`, `world.trace()` MUST emit one
`TraceField` on a record's node for **each field of the registered object schema**, each
carrying `path`, `value`, `resolution`, `generator`, `reason`, `forkKey`, `overridden`,
and `dependsOn`.

- Scenario: one TraceField per object field
  GIVEN a world `createWorld({ seed: 1, trace: true })` with an object schema `S` carrying
  exactly three scalar fields `a`, `b`, `c` (none optional), registered and
  `world.generate(S)` run
  WHEN the caller reads `world.trace().nodes[0].fields`
  THEN it has length 3, its entries' `path` values are exactly `["a", "b", "c"]` (the
  shape's field order), and each entry has all of `path`, `value`, `resolution`,
  `generator`, `reason`, `forkKey`, `overridden`, and `dependsOn` present.

### B86-R2: `TraceField.value` equals the field's generated value

Each `TraceField.value` MUST deep-equal the value the corresponding field holds in the
record stored on its node (`node.value[path]`).

- Scenario: captured value matches the record
  GIVEN a world `createWorld({ seed: 1, trace: true })` with an object schema `S` (a
  string field `name` and a number field `age`), `world.generate(S)` run
  WHEN the caller compares each `world.trace().nodes[0].fields[i].value` against the value
  at the same `path` in `world.trace().nodes[0].value`
  THEN every captured `value` deep-equals the value at that `path` in the node's record.

### B86-R3: `resolution` is the public `TraceResolution` mapped from the internal rung

Each `TraceField.resolution` MUST be the public `TraceResolution` member obtained by a
**total** mapping of the internal `FieldResolution["kind"]` that resolved the field, and a
`TraceField` MUST be produced for **each of the seven resolution rungs** — `override`,
`matcher`, `keymap`, `custom-gen`, `key-based`, `schema-based`, and `default` — that a
field can resolve through.

- Scenario: each rung maps to the right TraceResolution
  GIVEN a world `createWorld({ seed: 1, trace: true })` registering an object schema `S`
  arranged so that — across one or more records — one field resolves by each rung:
  an `options.overrides` primitive entry (→ `override`), a `withSchema({ matchers })`
  field (→ `matcher`), a `withKeyMap` field (→ `keymap`), a `withGenerators` field (→
  `custom-gen`), a heuristic key such as `email` (→ `key-based`), a plain constrained
  field with no key/heuristic match (→ `schema-based`), and a `z.string().default("x")`
  field whose default is taken (→ `default`)
  WHEN the caller reads each field's `world.trace()` `TraceField.resolution`
  THEN the override field is `"override"`, the matcher field `"matcher"`, the key-map
  field `"keymap"`, the custom-gen field `"custom-gen"`, the heuristic field
  `"key-based"`, the plain field `"schema-based"`, and the default-taken field `"default"`
  — each a member of the public `TraceResolution` union.

### B86-R4: absent optionals are recorded with `resolution: "absent"` / `value: undefined`

When the optional / nullable / default unwrap roll lands on **absent** (the wrapper
coin-flipped the field away), the field MUST still be recorded as a `TraceField` with
`resolution: "absent"` and `value: undefined`, so the Explorer can grey absent optionals.

- Scenario: absent optional still produces a TraceField
  GIVEN a world `createWorld({ seed: S, trace: true })` and an object schema with an
  `z.string().optional()` field `nickname`, with a `seed` chosen (or
  `optionalProbability` set so) that the roll for `nickname` lands absent on the first
  record
  WHEN the caller finds the `nickname` `TraceField` in `world.trace().nodes[0].fields`
  THEN it is present with `resolution === "absent"` and `value === undefined`, and the
  field's key is absent from `world.trace().nodes[0].value` (the record itself omits it).

### B86-R5: `generator` / `reason` reuse the `explain()` vocabulary

Each `TraceField.generator` and `TraceField.reason` MUST be the same generator-id /
human-reason strings `world.explain(S)` produces for that field (the `FieldExplanation`
vocabulary, B85-R12), so `world.trace()` and `world.explain()` speak one provenance
language.

- Scenario: trace generator/reason agree with explain
  GIVEN a world `createWorld({ seed: 1, trace: true })` registering an object schema `S`
  with a heuristic field (`email`) and a matcher field (`status`), after
  `world.generate(S)`
  WHEN the caller compares, per field, `world.trace().nodes[0].fields[i].generator` /
  `.reason` against `world.explain(S).fields[<path>].generator` / `.reason`
  THEN for the `email` and `status` fields the `generator` and `reason` strings are
  equal between `trace()` and `explain()` (e.g. `email` → `generator: "internet.email"`,
  `status` → `generator: "matcher:status"`).

### B86-R6: `forkKey` is the friendly `<node id> ▸ <path>` composite

Each `TraceField.forkKey` MUST be the friendly composite `` `${node.id} ▸ ${path}` ``,
combining the node's B88 friendly id (`<typeName>#<index>`) with the field path — a display
projection only; the internal `recordPrng.fork(<field>)` seed key MUST stay byte-identical
(no PRNG draw is added and no generated value changes).

- Scenario: forkKey composite and determinism
  GIVEN a world `createWorld({ seed: 1, trace: true })` with `Person =
z.object({ firstName: z.string() }).describe("person")` registered and
  `world.populate(Person, 1)`
  WHEN the caller reads the `firstName` `TraceField.forkKey` on `nodes[0]`
  THEN it equals `"person#1 ▸ firstName"`, and the record values in
  `world.registry.all(Person)` deep-equal the values a `trace: false` world with the same
  seed + chain produces (capture added no PRNG draw and changed no value).

### B86-R7: `overridden` is true exactly when an override merged onto the field

Each `TraceField.overridden` MUST be `true` when an `options.overrides` entry was applied
to that field (eager primitive/array override or deep-merged object override) and `false`
otherwise.

- Scenario: overridden reflects the override application
  GIVEN a world `createWorld({ seed: 1, trace: true })` and an object schema `S` with
  fields `title` and `body`, generated via
  `world.generate(S, { overrides: { title: "Fixed" } })`
  WHEN the caller reads the `title` and `body` `TraceField`s on `nodes[0]`
  THEN the `title` field has `overridden === true` and `value === "Fixed"`, while the
  `body` field has `overridden === false`.

### B86-R8: `dependsOn` lists sibling field paths a matcher read via `ctx.current`

Each `TraceField.dependsOn` MUST list the sibling field keys that the field's matcher read
from `ctx.current` during its resolution (empty `[]` when the field read no sibling), so
the Explorer can draw intra-record field dependencies.

- Scenario: matcher reading a sibling records the dependency
  GIVEN a world `createWorld({ seed: 1, trace: true })` registering an object schema `S`
  with a `firstName` field and a `withSchema({ matchers })` matcher for `displayName` whose
  body reads `ctx.current.firstName`, after `world.generate(S)`
  THEN the `displayName` `TraceField.dependsOn` contains `"firstName"`, while the
  `firstName` `TraceField.dependsOn` is `[]` (it read no sibling).

### B86-R9: capture is gated; `trace: false` is the empty-fields default

When the world is built without `trace: true` (default, or `trace: false`),
`world.trace()` MUST emit `fields: []` on every node (the B85 stub shape) — no field
provenance is captured.

- Scenario: default world captures no fields
  GIVEN two worlds with the same seed + chain, one `createWorld({ seed: 1 })` (no flag)
  and one `createWorld({ seed: 1, trace: true })`, each running `world.generate(S)` for a
  multi-field object schema `S`
  WHEN each world's `world.trace()` is taken
  THEN the default world's `nodes[0].fields` is `[]`, while the `trace: true` world's
  `nodes[0].fields` is non-empty, and the two worlds' `nodes[i].value` records deep-equal
  each other (the gate changes only what is captured, never what is generated).

### B86-R10: the off-path is a no-op with zero hot-path allocation

With `trace: false` (the default), the capture sink MUST be a no-op that adds **no
measurable throughput regression and zero additional allocation** on the generation hot
path versus the pre-B86 baseline.

- Scenario: off-path allocation budget holds
  GIVEN the existing allocation-budget regression test (the B97/B98 perf+memory suite —
  1000 `generate` calls under the per-tier memory budget) run with `trace` unset
  WHEN `pnpm test` (the perf+memory suite) is run after B86
  THEN the off-path allocation budget assertion passes (the `trace:false` path allocates
  no `TraceField`s and adds no per-field heap), confirming the B113 spike's off-path
  finding.

- Scenario (bench): hot-path bench shows no off-path regression
  GIVEN the canonical site bench set
  WHEN `pnpm site:bench` is run with `trace:false` (the default) after B86 and compared to
  the pre-B86 baseline (`site/bench/results/`)
  THEN the per-tier throughput delta stays within the suite's WARN threshold (no FAIL
  regression), and the bench output documents the `trace:true` overhead separately.

### B86-R11: capture is observation — PRNG/counter-neutral (D4/D10)

Enabling capture MUST NOT consume PRNG state or advance any counter the generation
pipeline reads from: a `trace: true` world MUST produce byte-identical records to a
`trace: false` world built with the same seed and chain.

- Scenario: trace-enabled records are byte-identical to default
  GIVEN two worlds with the same seed + `withSchema` chain, one `createWorld({ seed: 1 })`
  and one `createWorld({ seed: 1, trace: true })`, each running `world.populate(S, 5)` for
  an object schema `S` with at least a heuristic key, a matcher, and an optional field
  WHEN the caller compares `world.registry.all(S)` between the two worlds
  THEN every record deep-equals its counterpart (capture observed without consuming a PRNG
  draw or advancing a counter — D4/D10 preserved).

### B86-R12: cache short-circuits fabricate no provenance (D9)

When a generation path is short-circuited by a cache hit (e.g. a B8 per-pair upsert that
returns a previously generated derived record without re-walking the pipeline), the field
sink MUST receive nothing for that path — no `TraceField`s are fabricated for a record the
pipeline did not produce.

- Scenario: B8 upsert cache hit adds no fabricated fields
  GIVEN a world `createWorld({ seed: 1, trace: true })` with a primary `P` and a derived
  `D` (`withSchema(D, { from: P })`), after `world.populate(P, 1)` then two
  `world.generate(D, { source: <the P record> })` calls (the second a B8 per-pair upsert
  cache hit returning the same `D` record)
  WHEN the caller reads `world.trace()`
  THEN there is exactly **one** `D` node (the cache hit produced no second record) and its
  `fields` were captured once from the single pipeline walk — the cache hit added no node
  and no extra `TraceField`s.

### B86-R13: `generateObjectFields` stays under the B23-R9 body-length guard

The field-capture logic MUST be extracted into a helper (or step-context-threaded sink) so
that `WorldImpl.generateObjectFields`'s method body stays **under 50 LOC** (the B23-R9
guard), with no per-rung capture conditionals open-coded in its body.

- Scenario: generateObjectFields body remains < 50 LOC
  GIVEN B86 implemented
  WHEN `awk '/private generateObjectFields/,/^  }/' src/world/engine.ts | wc -l` is run
  (the method body inclusive of signature and closing brace)
  THEN the count is < 50, and the capture is performed by a named helper invoked from the
  per-field loop rather than inline per-rung branches.

## Out of scope

- **No relation-edge capture** — `TraceEdge` population at `ctx.related` /
  `resolveRelationPool` pick sites is the sibling card [B87](B87-provenance-relation-edge-sink.md).
  `world.trace().edges` stays `[]` after B86.
- **No re-derive / replay engine** — the B113 spike rejected re-derivation; B86 captures
  during generation under the gate and builds no replay path. Introspecting records
  generated _before_ `trace: true` was requested is not supported.
- **No always-on capture** — flipping capture to default-on (and the v2 ADR that would
  gate it) is later Phase-4 v2 work (B84 §10 Q4). B86 keeps the opt-in gate.
- **No new `TraceField` shape** — B86 populates the existing B85 `TraceField` type
  (`path` / `value` / `resolution` / `generator` / `reason` / `forkKey` / `overridden` /
  `dependsOn`); it does not add or rename fields on the public contract.
- **No node-id / friendly-name changes** — B88 owns `TraceNode.id` / `type`; B86 reuses
  the friendly node id for the `forkKey` composite and the `dependsOn` paths only.
- **Ghost / `store: false` ephemerals** — unchanged from B85/B88: only stored records
  become nodes, so a `store: false` ephemeral captures no node and no fields here.

## Open questions

> The two formerly-blocking questions (the `dependsOn` sibling-read mechanism and the
> `forkKey` exact composite) were **resolved at the B86 review checkpoint (2026-06-09)** and
> folded into Context / Standing constraint and R6 / R8 above: the maintainer chose the
> read-tracking `Proxy`-over-`ctx.current`-under-gate for `dependsOn` and the friendly
> composite `` `${node.id} ▸ ${path}` `` for `forkKey`. No blocking question remains.

- **(non-blocking) Enabling the `explainMeta` capture on the live trace path.** Reusing
  the `explain()` `generator`/`reason` vocabulary (B86-R5) requires the pipeline's
  `explainMeta` `{ identifier, reason }` writes to fire on the live generate path, which
  today they do only under `dryRun: true` (the hot-path ctx sets `explainMeta: null` to
  save an allocation — B97). The implementer enables a non-`null` `explainMeta` **only
  under the trace gate** so the off-path B97 allocation saving is preserved. This is an
  implementation detail with a clear, observable target (B86-R5) — recorded, proceeds.

- **(non-blocking) `default` vs `absent` rung naming in the seven-rung coverage.** The
  card's acceptance lists "`default`/`absent`" as one of seven rungs, but the internal
  `FieldResolution` has **both** a `default` and an `absent` kind (eight kinds total). B86
  covers both as distinct `TraceResolution` members (B86-R3 covers `default`; B86-R4
  covers `absent`), so all eight internal kinds map. Recorded so the card's "7 rungs"
  acceptance is read as "every resolution rung, including both `default` and `absent`."
  Proceeds.
