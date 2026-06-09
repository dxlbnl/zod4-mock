# B88: Stable record IDs exposed as friendly `TraceNode.id` (`person#1`)

## Context

`zod4-mock` grows a deterministic universe from one seed, and `world.trace(): WorldTrace`
([B85](B85-world-trace-api-and-types.md)) makes it walkable as a JSON-serializable
provenance structure. Today each `TraceNode.id` reads as a raw registration-order string
(`node0#0`, `derived1#2`) — readable to the engine but opaque to a human who copies an id
into a bug report or shares a trace. This card surfaces the same records under the
**friendly id form `<typeName>#<index>`** (e.g. `person#1`, `order#5`), per the
maintainer's B84 §10 Q3 decision, without touching generation or determinism.

Item card: [B88](../backlog/doing/B88-stable-record-ids.md). Predecessor:
[B85](B85-world-trace-api-and-types.md). The capture cards [B86] (fields) / [B87]
(edges) are orthogonal — B88 changes only the `id` / `type` **display strings** on the
nodes `trace()` already emits.

### Grounding in the current `src/`

- `world.trace()` (`src/world/engine.ts`, the `trace()` method) is a **pure projection
  of the registry** built after generation. It computes the display string locally:
  `type = ` `node${regId}` `/` `derived${regId}` `and`id = ` `${type}#${index}` `
  (B85 stub). `index` is the **0-based** position of the record in
  `world.registry.all(reg.schema)`.
- The internal record IDs that seed the PRNG are computed **elsewhere and never in
  `trace()`**: `reg${regId}#${recordIndex}` in `generateAndStorePrimary`
  (`src/world/engine.ts`) and `dreg${getSchemaId(schema)}#${sourceIndex}` in
  `generateDerivedRecord` (`src/world/engine.ts`). These feed `createPrng(fieldSeed(...))`.
  They are an **internal generation-layer concern** and are not the `TraceNode.id`.
  B88 is therefore a **display/projection-layer change in `trace()` only**; the internal
  `reg…`/`dreg…` keys that drive `Prng.fork()` MUST stay byte-identical (R4 below) — this
  is **not** a generation-layer change, so determinism/PRNG is untouched by construction.
- Registrations carry their schema reference and polarity on the `SchemaReg`
  (`src/world/registration.ts`: `schema`, `from`, `regId`). There is **no
  `defineSubjectType` API** (per `CLAUDE.md` / the B85 type-name note) — the card text
  mentioning it is stale; this spec targets the **real API only** (the Zod schema's
  `.description` plus the `getSchemaId` fallback) and introduces no new naming API
  (recorded under Out of scope / Open questions, not a live question). The real,
  current display-name source is the **Zod schema's `.description`** (Zod v4 classic
  exposes `schema.description: string | undefined`, set via `schema.describe("…")` /
  `z.globalRegistry`), with a stable schema-identity fallback when absent.
- Schema **reference identity** is already assigned a process-stable integer by
  `getSchemaId(schema)` (`src/world/engine.ts`, module-global `WeakMap`, accessor named
  `getSchemaId`). It is the basis for the fallback name when a schema has no
  description, and — because it is unique per schema reference — fallback names can never
  collide with one another (only described names can; see R2 / R7).

### Standing constraint (ADR + Rule at Done)

Once shipped, the public id shape `<typeName>#<index>` is a **binding public contract**:
users copy ids out of a trace (and the future `world.html`) into bug reports and shared
traces, so the shape and its stability are part of the SemVer surface. The implementer
MUST author a `wiki/decisions.md` ADR recording this constraint; the reviewer confirms it;
the manager promotes the one-line Rule into `architecture.md`'s Rules at Done. This sits
under the existing D26 (`WorldTrace` is a binding public contract).

### Doc rule (D5/D27, current)

The friendly id format is a public contract, so it MUST be documented: the relevant
exported symbols' TSDoc in `src/` (the `World.trace` / `TraceNode.id` doc comments) note
the `<typeName>#<index>` shape, and `docs/api-reference.md` notes it. The in-site
`/docs/api` reference is generated from TSDoc by TypeDoc — do not hand-edit the generated
model.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B88-R1: friendly `<typeName>#<index>` id on every `TraceNode`

Each `TraceNode.id` MUST be the string `` `${typeName}#${index}` ``, where `typeName` is
the registration's resolved display name (R2) and `index` is the node's per-registration
record index (R3), so the raw `node<regId>` / `derived<regId>` prefix from the B85 stub is
no longer surfaced.

- Scenario: friendly id replaces the raw stub id
  GIVEN a world `createWorld({ seed: 1 })` with a single object schema `Person`
  registered first whose schema carries `.describe("person")`, after
  `world.populate(Person, 1)`
  WHEN the caller reads `world.trace().nodes[0].id`
  THEN it equals `"person#1"` (a friendly `<typeName>#<index>` string), and it is **not**
  `"reg0#0"` nor `"node0#0"`.

### B88-R2: `typeName` derives from the registration's display name (description, else `schema<id>` fallback)

The `typeName` component MUST come from the registration's resolved display name: the
registered schema's `.description` when it is a non-empty string, otherwise the stable
fallback `` `schema${getSchemaId(schema)}` `` — the module-global schema-identity id used
for fork keys — which is identical for the same schema reference across runs and machines.
(The R7 collision suffix, if any, is applied **after** this resolution — including a
fallback name — but fallback names never collide because `getSchemaId` is unique per
schema reference; only described names can collide.)

- Scenario: description supplies the name
  GIVEN a world with a primary schema `Order = z.object({...}).describe("order")`
  registered and `world.populate(Order, 6)`
  WHEN the caller reads `world.trace().nodes[5].id`
  THEN it equals `"order#6"` (the `.describe("order")` value is the `typeName`).

- Scenario: missing description falls back to `schema<id>`
  GIVEN two independently built worlds, each `createWorld({ seed: 1 })`, registering the
  **same module-scope** object schema reference `S` (constructed once, with **no**
  `.describe(...)`) and running `world.populate(S, 1)`
  WHEN each world's `world.trace().nodes[0].id` is read
  THEN both ids are equal to each other and each equals `` `schema${getSchemaId(S)}#1` ``
  (e.g. `"schema7#1"`) — a stable fallback token of the form `schema<id>` containing no
  `#` before the index separator, identical across the two worlds and never the empty
  string.

### B88-R3: `<index>` is the 1-based per-registration record index

The `<index>` component of `TraceNode.id` MUST be the record's position within its own
registration's records, offset to **1-based** (the first record of a registration is
`#1`), while `TraceNode.index` (the numeric field) MUST remain the **0-based** value B85-R3
pins.

- Scenario: 1-based id index, 0-based numeric field
  GIVEN a world `createWorld({ seed: 1 })` with `Person` (`.describe("person")`)
  registered and `world.populate(Person, 3)`
  WHEN the caller reads `world.trace().nodes`
  THEN `nodes[0].id === "person#1"`, `nodes[1].id === "person#2"`,
  `nodes[2].id === "person#3"`, while `nodes[0].index === 0`, `nodes[1].index === 1`,
  and `nodes[2].index === 2` (the id is 1-based, the numeric `index` field stays 0-based).

### B88-R4: PRNG / determinism untouched (display-layer-only change)

Surfacing friendly ids MUST NOT change any generated value: the internal
`reg${regId}#${index}` / `dreg${getSchemaId}#${sourceIndex}` keys that seed `Prng.fork()`
stay byte-identical, so a world's generated records are unchanged by this card.

- Scenario: record values unchanged vs the pre-B88 baseline
  GIVEN a world `createWorld({ seed: 1 })` with `Person` (`.describe("person")`)
  registered and `world.populate(Person, 3)`
  WHEN the caller reads `world.registry.all(Person)`
  THEN every record deep-equals the record produced for the same seed + schema before
  B88 (the friendly-id projection added no PRNG draw and changed no field value), i.e.
  `world.trace().nodes[i].value` deep-equals `world.registry.all(Person)[i]` for each `i`.

### B88-R5: derived nodes use the _derived_ schema's name; `derivedFrom` resolves to the source node id

A `TraceNode` for a derived registration (`withSchema(S, { from: T })`) MUST take its
`typeName` from the **derived** schema `S` (not the source `T`), and its `derivedFrom`
MUST be the **friendly id** of the source node it was produced from.

- Scenario: derived id uses the derived name, derivedFrom uses the friendly source id
  GIVEN a world `createWorld({ seed: 1 })` with a primary `Person`
  (`.describe("person")`) registered first and a derived `Account = z.object({...})
.describe("account")` registered via `world.withSchema(Account, { from: Person })`,
  after `world.populate(Person, 1)` then `world.populateFrom(Account, Person)`
  WHEN the caller invokes `world.trace()`
  THEN the `Account` node's `id` matches `account#<n>` (the **derived** schema's name,
  not `person…`), and its `derivedFrom` equals the `Person` node's friendly id
  (`"person#1"`), while the `Person` node has no `derivedFrom` (`"derivedFrom" in node ===
false`).

### B88-R6: ids are stable across worlds/runs/machines for the same chain + seed

For two worlds built from the **same** `withSchema` chain and the **same** seed, the
ordered list of `TraceNode.id` values produced by `world.trace()` MUST be identical (a
D4/D10 observable), provided the schemas are module-scope references reused across both
worlds.

- Scenario: identical id lists across two equivalent worlds
  GIVEN two independently constructed worlds, each `createWorld({ seed: 1 })`, each
  registering the same module-scope `Person` (`.describe("person")`) and `Order`
  (`.describe("order")`) references in the same order, each running
  `world.populate(Person, 2)` then `world.populate(Order, 3)`
  WHEN each world's `world.trace().nodes.map(n => n.id)` is computed
  THEN the two id lists are deeply equal — `["person#1","person#2","order#1","order#2",
"order#3"]` in both — across runs.

### B88-R7: display-name collision auto-disambiguates with a deterministic registration-order suffix (no throw)

When two distinct registrations of the **same polarity** on one world resolve to the same
display name, `trace()` MUST auto-disambiguate the `typeName` by **registration order**
rather than throw: the **first** registration (lowest `regId`) keeps the bare resolved
name, and the **Nth** colliding registration (N ≥ 2, counting colliding same-name
same-polarity registrations in `regId` order) takes the type name `` `${name}-${N}` ``
(second → `<name>-2`, third → `<name>-3`, …). The per-record 1-based index (R3) is then
appended to the disambiguated type name. Re-registration of the **same** schema reference
is not a collision and adds no registration (so it never advances N). The suffix is
deterministic and stable for the same `withSchema` chain because collision order equals
registration order, which is itself deterministic per the engine.

- Scenario: two same-named, same-polarity schemas auto-disambiguate, no error
  GIVEN a world `createWorld({ seed: 1 })` with a primary schema `A` registered first via
  `world.withSchema(A)` where `A` carries `.describe("user")`, then a **second, distinct**
  primary schema reference `B` that also carries `.describe("user")` registered via
  `world.withSchema(B)`, after `world.populate(A, 1)` then `world.populate(B, 1)`
  WHEN the caller invokes `world.trace()` (no error is thrown by `withSchema` or `trace`)
  THEN `A`'s record reads `id === "user#1"` (the first registration keeps the bare name)
  and `B`'s record reads `id === "user-2#1"` (the second colliding registration gets the
  `-2` suffix), and `world.trace()` returns normally without throwing.

- Scenario: a third same-named collision gets `-3`
  GIVEN a world `createWorld({ seed: 1 })` with three distinct primary schema references
  `A`, `B`, `C` each carrying `.describe("user")`, registered in that order, after
  `world.populate(A, 1)`, `world.populate(B, 1)`, `world.populate(C, 1)`
  WHEN the caller reads the three records' ids from `world.trace()`
  THEN they are `"user#1"`, `"user-2#1"`, and `"user-3#1"` respectively (suffix = N, the
  1-based registration-order position among colliding same-name same-polarity registrations).

- Scenario: re-registering the same schema reference does not advance the suffix
  GIVEN a world `createWorld({ seed: 1 })` with primary `Person` (`.describe("person")`)
  registered via `world.withSchema(Person)`
  WHEN the caller invokes `world.withSchema(Person)` again (the same reference, e.g. to add
  matchers) and then `world.populate(Person, 1)`
  THEN no error is thrown and the record's `id === "person#1"` (the bare name, no `-2`
  suffix — a schema reference does not collide with itself).

### B88-R8: friendly id format is documented (D5/D27)

The public `<typeName>#<index>` id format MUST be documented on the relevant exported
symbol's TSDoc in `src/` (the `World.trace` and/or `TraceNode.id` doc comment) and noted
in `docs/api-reference.md`, so the in-site `/docs/api` reference (generated from TSDoc by
TypeDoc) carries the contract.

- Scenario: id shape appears in the doc surfaces
  GIVEN the updated TSDoc on the trace surface in `src/` and the note added to
  `docs/api-reference.md`
  WHEN `docs/api-reference.md` is read and the site build's `pnpm validate` (incl.
  TypeDoc build + `site:check`) is run
  THEN `docs/api-reference.md` contains the literal `<typeName>#<index>` id-format
  description, and the build passes (the generated `/docs/api` model is regenerated, not
  hand-edited).

## Out of scope

- **No field/edge capture changes** — `fields` and `edges` population are B86/B87; B88 only
  renames the node `id` / `type` display strings.
- **No new generation behaviour / no PRNG change** — internal seeding keys are unchanged
  (R4). This is explicitly a display projection inside `trace()`.
- **No `defineSubjectType` API** — the card's reference to `defineSubjectType(name, S)` is
  stale (the API does not exist, per `CLAUDE.md`); the type-name source is the schema
  `.description` + the `schema<id>` fallback (R2). B88 introduces **no** new registration
  API for naming.
- **No collision throw** — per the maintainer's decision, a same-name same-polarity
  display-name collision auto-disambiguates with a deterministic registration-order suffix
  (R7) and never throws. The earlier reject-at-`withSchema` proposal (mirroring D12) was
  considered and rejected.
- **No site `/explorer` rendering** — there is no live consumer of `TraceNode.id` in
  `site/` today; surfacing friendly ids in the Explorer UI is later Phase-4 work.
- **Ghost / `store:false` ephemerals** — unchanged from B85: only stored records become
  nodes.

## Open questions

_No blocking questions._ The maintainer's review-checkpoint answers are folded in: collision
handling is **auto-disambiguation with a deterministic `-N` registration-order suffix, no
throw** (R7); the un-described fallback name is **`` `schema${getSchemaId(schema)}` ``** (R2);
the friendly `<index>` is **1-based** while the numeric `TraceNode.index` stays 0-based (R3).

- **(non-blocking) Inline-constructed-schema fallback caveat.** The R2 fallback
  `` `schema${getSchemaId(schema)}` `` is stable only for **module-scope** schema references
  (D4/D10 already requires this for determinism generally); a schema constructed _inline_ per
  world gets a fresh `getSchemaId`, so its fallback id may differ between two worlds that each
  construct it inline. This is the **same** determinism caveat the whole library already
  carries — recorded here, not new, and does not block.

- **(non-blocking, corrected) `defineSubjectType` in the card is stale.** The card's
  Scope/Acceptance text references a `defineSubjectType(name, S)` API that does not exist (per
  `CLAUDE.md`). Deferred/corrected — this spec deliberately targets the real API only
  (`.description` + the `schema<id>` fallback); recorded so the card text can be corrected. Not
  an open decision.
