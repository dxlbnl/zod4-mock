# B52: BUG — `generateArray` + `populate` dispatch paths diverge across modes (bounds, overrides, transform)

## Context

User-reported, conversationally:

> `schema.array().min(6).max(6)` does not always return 6 items, when `store: false` it
> doesn't check. Why do these things not follow a common path. Go deeper, and find other
> inconsistencies across the different codepaths. I thought we have unified it by now.

**B25** ([wiki/research/engine/populate-dispatch-divergence.md] and the `resolveMode`
extraction in [src/world/registration.ts:117-122](../../src/world/registration.ts#L117))
unified the _classifier_ — every dispatch site now classifies a registered schema as
`derived` / `primary` / `ad-hoc` via the shared `resolveMode` helper. But each branch of
`generateArray` ([src/world/engine.ts:1266-1417](../../src/world/engine.ts#L1266)) and
`populate` ([src/world/engine.ts:595-649](../../src/world/engine.ts#L595)) still
hand-rolls its own bound logic, override application, and transform handling — the
classification is unified, the _dispatch arms_ are not. Three sibling bug fixes landed
on this surface in close succession (B38 — primary-array overrides throw; B43 —
primary-array caller-max slice; B44 — primary-array `store: false` early-return), each
correct in isolation, none re-unified into the other arms. B52 finishes the unification
job B25 started.

The bug the user hit: `generateArray`'s primary arm under `{ store: false }` returns
`target` items via the B44 early-return path at
[src/world/engine.ts:1350-1354](../../src/world/engine.ts#L1350), **bypassing** the
B43 `callerMax` slice the store-on path applies at
[src/world/engine.ts:1371-1372](../../src/world/engine.ts#L1371). When
`existingCount > callerMax` (e.g. `world.populate(Person, 10)` followed by
`world.generate(Person.array().min(6).max(6), { store: false })`), `target =
max(10, prng.int(6,6)) = 10`, the B44 branch returns 10 records, and `.max(6)` is
silently ignored. Eight related inconsistencies follow once you look (see Inconsistency
inventory on the item card). The manager has pre-listed all eight as R-IDs; this spec
formalises each into an RFC-2119 requirement with an observable `GIVEN/WHEN/THEN`.

Anchor reading:

- Bound helpers — `resolveMinRequired` / `resolveMaxAllowed` / `readCallerMaxBound`
  ([src/world/engine.ts:142-192](../../src/world/engine.ts#L142)).
- `generateArray` — the three mode arms and the ad-hoc fallthrough
  ([src/world/engine.ts:1266-1417](../../src/world/engine.ts#L1266)).
- `populate` — primary-first explicit check + `resolveMode` switch
  ([src/world/engine.ts:595-649](../../src/world/engine.ts#L595)).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

### Composition with shipped Rules

The fix is bounded by the binding **Rules** in `architecture.md`:

- **D1** — no `any`; existing types in `generateArray` and `populate` are sufficient.
- **D4 / D10** — per-(seed + schema identity + per-schema call index) determinism. The
  fix is a control-flow rebranch + slice + per-record `deepMerge` / `transform` pass;
  it adds **no** new PRNG draws beyond the existing per-record forks on each arm.
  `genPrng.fork('[i]')` for ad-hoc and the existing `recordPrng` derivation inside
  `generateAndStorePrimary` / `generateDerivedRecord` are untouched.
- **D5** — the `.generate` array-return bullet in `docs/api-reference.md`
  ([line 316](../../docs/api-reference.md#L316)) and the `GenerateOptions.overrides`
  paragraph ([line 341](../../docs/api-reference.md#L341)) may carry phrasing that
  documents the buggy derived-mode behaviour ("returns one element per source pair").
  Audit and correct per B52-R10.
- **D6** — the user's repro is the regression: `schema.array().min(6).max(6)` +
  `store: false` + `populate(schema, 10)` → returned length MUST be 6. Pinned by
  B52-R2's test.
- **D8** — stored equals returned for `withSchema`-registered schemas. The fix preserves
  D8: on the primary store-on path the `callerMax` slice is the existing B43 read-only
  narrowing (B43-R-equivalent), and the new derived-mode `callerMax` cap (R1) lands
  **after** the per-source `generateDerivedRecord` calls have already stored to the
  registry — slicing the returned array does not retroactively unstore derived records.
  See Open question Q3.
- **D9** — no cache short-circuit introduced.
- **D11** — `PIPELINE` is upstream of `generateArray`; untouched.
- **D12** — `withSchema` throws on dual primary/derived registration. The R6 check
  exercises this: `populate`'s primary-first pre-check at
  [src/world/engine.ts:614-621](../../src/world/engine.ts#L614) becomes dead code once
  the configuration it guards (a schema registered as both primary and derived) cannot
  exist. R6 confirms.
- **D13** — no `node:*` introduced; this is pure logic in already-shipped paths.

### Composition with sibling specs

- **B25** — the classifier extraction. B52 reuses `resolveMode` everywhere; no change
  to the classifier itself.
- **B38** ([B38-primary-array-overrides-dropped.md](B38-primary-array-overrides-dropped.md))
  — the primary-array overrides throw. B52 MUST preserve B38-R1: a non-empty
  `options.overrides` against a primary-registered inner array schema MUST still throw.
  R3 (transform on primary) lands **after** the B38 throw, so the throw fires first.
- **B43** — the primary-array `callerMax` slice. B52 generalises the slice to apply on
  all primary paths (store-on AND store-off — R2) and the derived path (R1, R8), not
  just primary store-on.
- **B44** ([B44-primary-array-store-false-hangs.md](B44-primary-array-store-false-hangs.md))
  — the primary-array `store: false` early-return. B52 MUST preserve B44-R1 (no
  infinite loop) — the slice and trailing pass MUST apply to the early-return path's
  return value before it is handed back, and the new arrangement MUST NOT re-introduce
  a `while (registry.count < target)` loop on the store-off side.
- **B47 / D12** ([B47-forbid-dual-primary-derived-registration.md](B47-forbid-dual-primary-derived-registration.md))
  — the dual-registration throw. R6 confirms `populate`'s primary-first check (which
  predates D12) is now dead code and removes it.
- **B10** — `effectiveStore` transitive suppression. The contract is preserved: B52
  changes none of the `effectiveStore` push/pop or `registry.store` gates inside
  `generateAndStorePrimary` / `generateDerivedRecord`.
- **B12 / B18** — `deepMerge` semantics on plain-object overrides. R4 reuses the
  existing `result.map((item, i) => deepMerge(item, overrides[i]))` pattern from the
  ad-hoc branch
  ([src/world/engine.ts:1404-1410](../../src/world/engine.ts#L1404)) on the derived
  path; semantics unchanged.

Item card:
[wiki/backlog/doing/B52-generate-array-dispatch-inconsistencies.md](../backlog/doing/B52-generate-array-dispatch-inconsistencies.md).
GitHub issue: none — user reported conversationally.

## Requirements

### B52-R1: derived-mode `generateArray` MUST honour `.max()` / `.length()` and the `defMax` fallback

`WorldImpl.generateArray`'s derived-mode arm
([src/world/engine.ts:1290-1317](../../src/world/engine.ts#L1290)) MUST cap the
returned array's length at the caller-side upper bound when set (`readCallerMaxBound`),
or at the library-side `defaultArrayLength[1]` fallback (`defMax`) when no caller
bound is present. The cap MUST be applied as a slice of the produced
(source × derivation) pairs — pairs beyond the cap MUST NOT be derived (no wasted
`generateDerivedRecord` calls), and the registry MUST NOT receive derived records past
the cap. The auto-provision floor MUST still apply: when `pairs.length < minRequired`,
sources are auto-provisioned up to `minRequired` (existing behaviour at
[src/world/engine.ts:1303-1312](../../src/world/engine.ts#L1303)).

When the auto-provisioned floor (`minRequired`) exceeds the upper cap
(`callerMax ?? defMax`) — an impossible-but-stated configuration like `.min(6).max(3)`
— the implementer MUST follow the existing pattern from the primary arm
([src/world/engine.ts:1342](../../src/world/engine.ts#L1342)):
`genPrng.int(Math.min(minRequired, maxAllowed), Math.max(minRequired, maxAllowed))`
collapses to a defined value rather than throwing. **Verification: TEST.**

- Scenario: derived `.max(6)` with 50 sources caps at 6
  GIVEN `Source = z.object({ id: z.uuid() })` and
  `Derived = z.object({ sourceId: z.uuid() })` registered with `from: Source` on
  `createWorld({ seed: 1 })`, and `world.populate(Source, 50)` having seeded 50
  source records
  WHEN the consumer calls `const result = world.generate(Derived.array().max(6));`
  THEN `result.length === 6` AND `world.registry.count(Derived) === 6` (the cap is
  honoured at production time, not as a post-slice; D8 holds because every returned
  record was stored before it was returned).

- Scenario: derived no-caller-bound caps at `defaultArrayLength[1]`
  GIVEN the same registered `Source` / `Derived` on
  `createWorld({ seed: 1, defaultArrayLength: [1, 4] })`, and `populate(Source, 50)`
  having seeded 50 sources
  WHEN the consumer calls `const result = world.generate(Derived.array());`
  THEN `result.length === 4` (capped at `defMax = 4`, not 50).

### B52-R2: primary-mode `generateArray` under `{ store: false }` MUST honour `.max()` / `.length()`

`WorldImpl.generateArray`'s primary-mode arm under `!this.effectiveStore`
([src/world/engine.ts:1350-1354](../../src/world/engine.ts#L1350)) MUST apply the B43
`readCallerMaxBound` slice to the array it returns. When `target > callerMax` (e.g.
`existingCount = 10` and `callerMax = 6` from `.max(6)`), the returned array MUST have
length `callerMax`, not `target`. The B44 no-infinite-loop property MUST be preserved:
the new branch MUST NOT re-introduce a `while (registry.count(innerSchema) < target)`
loop. **Verification: TEST.** This is the user's reported regression.

- Scenario: user's repro — primary `.min(6).max(6) + store: false + populate(10)` returns 6
  GIVEN
  ```ts
  const Person = z.object({ id: z.string(), name: z.string() });
  const world = createWorld({ seed: 1 }).withSchema(Person);
  world.populate(Person, 10);
  ```
  WHEN the consumer calls
  `const result = world.generate(Person.array().min(6).max(6), { store: false });`
  THEN `result.length === 6` AND the call returns within vitest's default 5-second
  per-test timeout (no infinite loop — B44 preserved) AND
  `world.registry.count(Person) === 10` (B10-R4 — `store: false` is transitive, no new
  records written, no records removed).

### B52-R3: primary-mode `generateArray` MUST apply `options.transform`

`WorldImpl.generateArray`'s primary-mode arm MUST apply `options.transform` (the
trailing per-element pass at
[src/world/engine.ts:1412-1414](../../src/world/engine.ts#L1412)) to the array it
returns, on both the store-on path (after `registry.all` + the B43 slice) and the
store-off path (after the B44 early-return + the new B52-R2 slice). The transform MUST
run on both paths in the same observable position as the ad-hoc branch — i.e. _after_
overrides would have been applied if they had been present (per B38-R1, primary +
non-empty overrides throws; per B38-R2, no/empty overrides is the only call shape that
reaches the transform). **Verification: TEST.**

- Scenario: primary store-on + transform applies transform to every element
  GIVEN `Person = z.object({ id: z.string(), name: z.string() })` registered on
  `createWorld({ seed: 1 })`
  WHEN the consumer calls
  `const result = world.generate(Person.array().min(3).max(3), { transform: (p) => ({ ...p, hidden: true }) });`
  THEN `result.length === 3` AND `result.every((r) => r.hidden === true)` is `true`.

- Scenario: primary store-off + transform applies transform to every element
  GIVEN the same registered `Person` on a fresh `createWorld({ seed: 1 })` with
  `world.populate(Person, 3)` having seeded three records
  WHEN the consumer calls
  ```ts
  const result = world.generate(Person.array().min(3).max(3), {
    store: false,
    transform: (p) => ({ ...p, hidden: true }),
  });
  ```
  THEN `result.length === 3` AND `result.every((r) => r.hidden === true)` is `true`
  AND `world.registry.count(Person) === 3` (no growth — `store: false`).

### B52-R4: derived-mode `generateArray` MUST apply `options.overrides` and `options.transform`

`WorldImpl.generateArray`'s derived-mode arm
([src/world/engine.ts:1314-1316](../../src/world/engine.ts#L1314)) currently calls
`generateDerivedRecord(innerSchema, reg, source, sourceIndex)` with no `options`
argument — silently dropping per-record overrides AND the trailing `transform`. The
arm MUST apply `options.overrides[i]` per-index via the same `deepMerge` pattern the
ad-hoc branch uses (lines 1404-1410), and MUST apply `options.transform` per-element
after overrides. Per-index `overrides[i]` on derived is well-defined: derived records
have stable per-source identity, so position `i` in the returned array is the i-th
source pair (consistent with the existing one-output-per-source contract documented at
[docs/api-reference.md:316](../../docs/api-reference.md#L316)). **Verification: TEST.**

When `options.overrides.length > result.length` (more overrides than produced records),
the extras MUST be silently ignored — matching the ad-hoc branch's existing behaviour
where `overrides[i]` simply does nothing when `i >= result.length`. When
`options.overrides.length < result.length`, only positions `< overrides.length` are
merged.

- Scenario: derived + per-index overrides applies deepMerge per record
  GIVEN `Source = z.object({ id: z.uuid() })` and
  `Derived = z.object({ sourceId: z.uuid(), label: z.string() })` registered with
  `from: Source` on `createWorld({ seed: 1 })`, with `world.populate(Source, 3)`
  seeded
  WHEN the consumer calls

  ```ts
  const result = world.generate(Derived.array(), {
    overrides: [{ label: "first" }, { label: "second" }, { label: "third" }],
  });
  ```

  THEN `result.length === 3` AND
  `result.map((r) => r.label)` deep-equals `["first", "second", "third"]` AND each
  record's `sourceId` matches the corresponding `Source` record's `id` (the override
  merges with the derived record, sibling fields preserved).

- Scenario: derived + transform applies transform to every element
  GIVEN the same registered derived schema with three sources
  WHEN the consumer calls
  `const result = world.generate(Derived.array(), { transform: (d) => ({ ...d, marked: true }) });`
  THEN `result.length === 3` AND `result.every((r) => r.marked === true)` is `true`.

### B52-R5: `populate` derived branch MUST auto-provision sources to reach `count`

`WorldImpl.populate`'s derived branch
([src/world/engine.ts:625-636](../../src/world/engine.ts#L625)) currently caps the
loop at `N = Math.min(count, sources.length)` — silently returning fewer derived
records than the caller asked for when sources are short. `populate(DerivedSchema, 10)`
with 5 sources writes 5 derived records, not 10. The branch MUST auto-provision
additional sources up to `count`, matching the auto-provision behaviour of
`generateArray`'s derived arm (lines 1304-1312). After the call,
`world.registry.count(DerivedSchema)` MUST equal at least `count` (or exactly `count`
on a fresh world; idempotence via B8 upsert still applies on repeat calls with the
same identities). **Verification: TEST.**

The auto-provisioned sources MUST also land in the source registry (sources are
generated via `generateAndStorePrimary`, which writes to the registry under
`store: true` — `populate`'s contract is to write, B10-R6).

- Scenario: populate derived with count > sources auto-provisions sources
  GIVEN `Source = z.object({ id: z.uuid() })` and
  `Derived = z.object({ sourceId: z.uuid() })` registered with `from: Source` on
  `createWorld({ seed: 1 })`, with `world.populate(Source, 5)` having seeded five
  source records
  WHEN the consumer calls `world.populate(Derived, 10);`
  THEN `world.registry.count(Derived) === 10` AND
  `world.registry.count(Source) === 10` (5 pre-existing + 5 auto-provisioned).

### B52-R6: `populate`'s primary-first explicit pre-check MUST be removed as dead code

`WorldImpl.populate`'s primary-first explicit check at
[src/world/engine.ts:614-621](../../src/world/engine.ts#L614) inverts the dispatch
precedence relative to `resolveMode` (derived-first). Post-D12
([B47](B47-forbid-dual-primary-derived-registration.md)), the configuration the
inversion was observable on — a schema registered as both primary and derived on the
same world — throws at `withSchema` time and can no longer exist. The pre-check is
therefore unreachable in any sense that diverges from the `resolveMode` default
(`case "primary"` at line 637 already handles the primary case; the comment at line
638 acknowledges the case is "unreachable" today because the early return short-
circuits it). The pre-check and the `case "primary"` stub MUST both be removed; the
`switch` MUST dispatch directly via `resolveMode` for all three kinds (derived /
primary / ad-hoc), matching how `generate`, `generateArray`, and `get` dispatch.

The remaining `populate` body MUST call `generateAndStorePrimary(schema, mode.reg, opts)`
in the new `case "primary"` arm, identical in behaviour to the removed pre-check.
**Verification: TEST + reviewer-only.** A test exercises a primary-registered schema
through `populate` and asserts records land in the registry (behavioural confirmation
the rewritten primary arm works); the reviewer confirms via Read that the explicit
pre-check at lines 614-621 has been deleted and `case "primary"` no longer carries
the "unreachable" comment.

- Scenario: populate against primary-registered schema still writes records
  GIVEN `Person = z.object({ id: z.string(), name: z.string() })` registered on
  `createWorld({ seed: 1 })`
  WHEN the consumer calls `world.populate(Person, 5);`
  THEN `world.registry.count(Person) === 5` AND
  `world.registry.all(Person)` is an array of 5 records each matching the Person
  schema (the rewritten primary arm produces the same observable result as the
  removed pre-check).

- Scenario: populate against derived-registered schema still auto-provisions (R5 holds)
  See R5's scenario — composing R5 + R6 confirms the derived arm continues to work
  after the pre-check removal.

### B52-R7: `generateArray` ad-hoc branch MUST share the `resolveMinRequired` / `resolveMaxAllowed` helpers

`WorldImpl.generateArray`'s ad-hoc fallthrough at
[src/world/engine.ts:1382-1393](../../src/world/engine.ts#L1382) duplicates the
bound-resolution logic the dedicated helpers `resolveMinRequired` and
`resolveMaxAllowed` already encapsulate (lines 146-166). The inline loop MUST be
replaced with calls to the helpers:

```ts
const N = resolveMinRequired(arraySchema, defMin);
const maxN = resolveMaxAllowed(arraySchema, defMax);
const length = genPrng.int(Math.min(N, maxN), Math.max(N, maxN));
```

The observable output (returned array length distribution for a given seed and
schema) MUST be byte-identical to the pre-change implementation for the same inputs —
the helpers compute the same `[min, max]` pair the inline loop computed, modulo the
existing `length_equals`-takes-precedence semantics, and the `genPrng.int` draw is at
the same position in the PRNG stream. **Verification: TEST + reviewer-only.** A test
confirms ad-hoc array length under `.min`/`.max`/`.length` matches the helper-derived
bounds (positive guard); the reviewer confirms via Read that the inline duplicated
loop at lines 1382-1393 has been replaced with helper calls.

- Scenario: ad-hoc array honours `.min(3).max(7)` via helpers
  GIVEN an unregistered schema `Item = z.object({ id: z.string() })` and
  `const world = createWorld({ seed: 1 })` (no `withSchema(Item)`)
  WHEN the consumer calls `const result = world.generate(Item.array().min(3).max(7));`
  THEN `result.length >= 3 && result.length <= 7`.

- Scenario: ad-hoc array honours `.length(4)` via helpers
  GIVEN the same unregistered schema and world
  WHEN the consumer calls `const result = world.generate(Item.array().length(4));`
  THEN `result.length === 4`.

### B52-R8: derived-mode `generateArray` MUST consult `defMax` when no caller bound is set

`WorldImpl.generateArray`'s derived-mode arm MUST consult the library-side
`defaultArrayLength[1]` (`defMax`) as the upper bound when no caller-side `.max()` /
`.length()` is set on the array schema. Today the arm ignores `defMax` entirely,
returning one element per source pair regardless of bounds (a 50-source registry
produces a 50-element array even on a default `defaultArrayLength: [1, 5]`). The new
upper bound is `callerMax ?? defMax`. This requirement composes with R1 — R1
formalises the cap is applied at production time; R8 specifically names `defMax` as
the fallback contract for the no-caller-bound case, matching the documented
`defaultArrayLength` semantics in `docs/api-reference.md`. **Verification: TEST.**

The auto-provisioned floor (`minRequired = resolveMinRequired(arraySchema, defMin)`)
still applies — when `pairs.length < minRequired`, sources are auto-provisioned even
if that pushes the count above `defMax` (the floor wins over the ceiling, matching
the primary arm's `Math.max(minRequired, …)` framing).

- Scenario: derived no-caller-bound + many sources caps at `defaultArrayLength[1]`
  GIVEN `Source` / `Derived` registered as in R1, on
  `createWorld({ seed: 1, defaultArrayLength: [1, 5] })`, with
  `world.populate(Source, 50)` seeded
  WHEN the consumer calls `const result = world.generate(Derived.array());`
  THEN `result.length === 5` (capped at `defMax = 5`, not 50).

- Scenario: derived no-caller-bound + zero sources auto-provisions to `defMin`
  GIVEN the same registered schemas on
  `createWorld({ seed: 1, defaultArrayLength: [2, 4] })`, with the `Source` registry
  empty
  WHEN the consumer calls `const result = world.generate(Derived.array());`
  THEN `result.length >= 2 && result.length <= 4` (auto-provisioned to at least
  `defMin = 2`, capped at `defMax = 4`) AND `world.registry.count(Source) >= 2` (the
  auto-provisioned sources landed in the source registry).

### B52-R9: changeset entry — patch bump

A changeset file at `.changeset/b52-generate-array-dispatch-inconsistencies.md` MUST
be added in the same step. The frontmatter MUST declare a **patch** bump for
`zod4-mock`. Rationale: every R1..R8 is a correctness fix against a documented or
clearly-implied contract (bounds are documented as honoured; transform and overrides
are documented for `world.generate`; `populate(N)` is documented to write `N` records).
No public API surface changes — no new method, no new option, no signature change.
The behavioural differences are exactly the kind of "the buggy path returns the wrong
answer; the fix returns the right answer" pattern a patch bump exists for.

The changeset body MUST summarise the eight inconsistencies (one line each is
sufficient) and end with no `(closes #N)` line (no GitHub issue — user reported
conversationally). **Verification: reviewer-only.**

- Scenario: changeset exists with the right bump
  GIVEN B52 applied
  WHEN `.changeset/b52-generate-array-dispatch-inconsistencies.md` is read
  THEN its frontmatter contains `"zod4-mock": patch` AND its body names the eight
  bug classes (derived bounds, primary store-false slice, primary transform, derived
  overrides+transform, populate derived auto-provision, populate dead-code removal,
  ad-hoc helper share, derived defMax).

### B52-R10: `docs/api-reference.md` audited for stale wording

Per D5, when behaviour changes, `docs/api-reference.md` MUST be re-checked and any
phrasing that documents the buggy behaviour updated in the same step. Concretely the
auditor (implementer or spec-writer at re-dispatch) MUST verify two sections:

1. The `.generate` array-return bullet at
   [docs/api-reference.md:316](../../docs/api-reference.md#L316). Today's wording
   reads "Length derived from Zod constraints, falling back to `defaultArrayLength`."
   After B52 this is _truer_ than before (R1 + R8 make it actually honoured on
   derived; R2 makes it honoured on primary store-false). No edit needed unless the
   bullet introduces phrasing inconsistent with R1/R2/R3/R4/R8.
2. The `.populate` subsection at
   [docs/api-reference.md:362](../../docs/api-reference.md#L362). The doc currently
   states `populate(schema, count, factory?)` "Pre-generates `count` instances". After
   R5, that statement becomes literally true for derived schemas too (today it
   silently caps at `sources.length`). No edit needed unless the subsection explicitly
   documents the silent-truncation buggy behaviour.

The auditor MUST report findings: either "no doc edit required, R10 satisfied by the
existing wording" OR "wording at line X documents the bug, edited to Y". **Verification:
reviewer-only.**

- Scenario: docs audit recorded
  GIVEN B52 applied
  WHEN `docs/api-reference.md` is read and the two sections above are compared to the
  new behaviour
  THEN either no edit is required (existing wording is correct under the new
  behaviour) OR the offending phrasing has been updated to reflect the new behaviour;
  the implementer's changeset / commit message names which case applies.

## Permutation matrix

Per the [[feedback-minimal-tests]] directive: **one test per R-ID + the user's repro**.
Eight R-IDs with behavioural verification (R1..R8) → eight tests; R9 / R10 are
reviewer-only. R2's scenario IS the user's repro, so the eight tests cover both. Total
test count: **8** tests in `tests/unit/world/`.

| Test | Covers | Mode / shape                                                                 | Schema bounds                   | Existing data                   | Options                    | Asserts                                                                            |
| ---- | ------ | ---------------------------------------------------------------------------- | ------------------------------- | ------------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| 1    | R1     | derived + caller `.max(6)`, store on                                         | `.max(6)`                       | 50 sources                      | none                       | `result.length === 6`; registry.count(Derived) === 6                               |
| 2    | R2     | **user's repro** — primary + `store: false` + `.min(6).max(6)`               | `.min(6).max(6)`                | 10 records                      | `{ store: false }`         | `result.length === 6`; returns within timeout                                      |
| 3    | R3     | primary + transform (store-on AND store-off — two `expect` in one test)      | `.min(3).max(3)`                | none (store-on) / 3 (store-off) | `{ transform }`            | `result.every((r) => r.hidden === true)`                                           |
| 4    | R4     | derived + per-index overrides + transform (two `expect` in one test)         | none                            | 3 sources                       | `{ overrides, transform }` | `result.map(r => r.label) === [...]`; marked                                       |
| 5    | R5     | `populate(Derived, 10)` with 5 sources → 10 derived + 10 sources             | n/a (populate)                  | 5 sources                       | n/a                        | `registry.count(Derived) === 10`; `count(Source) === 10`                           |
| 6    | R6     | `populate(Person, 5)` against primary — sanity that the rewrite still writes | n/a                             | none                            | n/a                        | `registry.count(Person) === 5` (reviewer also verifies dead-code removal via Read) |
| 7    | R7     | ad-hoc array + `.min(3).max(7)` AND `.length(4)` (two `expect` in one test)  | `.min(3).max(7)` / `.length(4)` | none                            | none                       | length-in-range; length-equals (reviewer verifies helper share via Read)           |
| 8    | R8     | derived + no caller bound + `defaultArrayLength: [1, 5]` + 50 sources        | none                            | 50 sources                      | none                       | `result.length === 5` (capped at defMax)                                           |

Test-writer MUST NOT enumerate every (mode × store × bound × options) cell. The
matrix above is the full set — eight tests pin every behavioural R-ID + the user's
repro.

## Out of scope

- **The dispatch precedence asymmetry between `populate` and the other three dispatch
  sites (B41 / B47 / D12).** Already settled by D12 — once primary+derived dual
  registration throws at `withSchema` time, the asymmetry is unobservable. B52 only
  confirms R6's dead-code status and deletes the residual `populate` pre-check; it
  does NOT re-litigate B41's precedence question or D12's resolution.

- **Any change to `LocaleData` or `PIPELINE`.** D11's canonical pipeline is upstream
  of `generateArray`'s array-level dispatch; B52 is array-level only, not field-level.
  No `src/pipeline.ts` edit.

- **The `effectiveStore` contract (B10).** B52 preserves B10-R2 / B10-R4 / B10-R6
  verbatim — the `store: false` transitive suppression, the `populate` always-write
  semantics, the `effectiveStore` push/pop in `generate`'s try/finally — all
  untouched. R2 builds _on_ B10's contract (the B44 early-return path under
  `!effectiveStore`); R5 inherits B10-R6 (populate always writes).

- **The `populateFrom` path** at
  [src/world/engine.ts:655-686](../../src/world/engine.ts#L655). Already correct —
  delegates to `world.generate(DerivedSchema, { source })` per record, hitting B8's
  per-pair upsert. B52 does not change `populateFrom`'s loop, its snapshot semantics,
  its `store: false` stripping, or its idempotence.

- **B38's primary-array overrides throw** ([B38-R1](B38-primary-array-overrides-dropped.md)).
  Preserved unchanged. R3 (primary transform) lands AFTER the B38 throw, so the throw
  fires first on any call shape that combines primary + non-empty overrides. The B38
  scenario's empty-overrides byte-equivalence (B38-R2) is also preserved — R3's
  transform pass only runs when the B38 throw did not fire.

- **B44's no-infinite-loop fix** ([B44-R1](B44-primary-array-store-false-hangs.md)).
  Preserved by construction — R2's slice is applied to the array B44's early-return
  produces, not as a new loop on `registry.count`.

- **A new shared `resolveTargetCount(mode, schema, ...)` helper.** Mentioned on the
  item card as a refactor direction. Whether to introduce one or to inline the
  unification per branch is the implementer's call (see Open question Q1).

- **Schema-coverage edge cases unrelated to the eight inconsistencies.** E.g. nested
  array schemas (`z.array(z.array(...))`) recurse through `generateArray` per layer;
  the outer/inner relationship is unchanged. No new behaviour for these shapes is
  promised by B52.

## Open questions

- **Q1: Should the refactor introduce a shared `resolveTargetCount(mode, arraySchema, defMin, defMax, existingCount?)` helper, or inline the unification per branch? — Non-blocking.**
  The item card's hint sketches a single function that knows the three modes'
  arithmetic in one place. Whether to extract it as a helper or to inline the cap
  and slice logic per branch is a code-shape choice with the same observable result.
  The R-IDs are written behaviourally (cap at `callerMax ?? defMax`; apply slice;
  apply overrides; apply transform) — both shapes satisfy them. Recorded; the
  implementer decides. Not blocking.

- **Q2: Should bugs 5 & 6 (populate-side) ship in the same commit as bugs 1-4, 7, 8 (`generateArray`-side), or be split into a follow-up? — Non-blocking.**
  Both classes are correctness fixes on the same surface (the dispatch arms across
  `generateArray` + `populate`) and share the `resolveMode` classifier. Splitting
  would mean two changesets, two reviewer rounds, more bookkeeping for the same
  total work. Combining keeps the unification atomic. Recorded; the manager decides
  at commit time. Not blocking.

- **Q3: Does R1's `defMax`/`callerMax` cap on derived mode interact correctly with D8 (stored = returned)? — Non-blocking, with a definite answer.**
  D8 says for `withSchema`-registered schemas, the value stored in the registry equals
  the value returned by `world.generate`. R1 applies the cap _at production time_ (do
  not call `generateDerivedRecord` for pairs beyond the cap) — so the cap pairs are
  never derived, never stored, and never returned. The store ⊆ return relationship
  is exact: every returned record was stored, and no record was stored without being
  returned. D8 holds. (Alternative: apply the cap as a post-slice on already-derived
  records would store records past the cap and slice them off the return — that
  would violate D8. R1 explicitly does not do this; the scenario asserts both
  `result.length === 6` AND `registry.count(Derived) === 6`.) Recorded as explicitly
  resolved; not blocking.

- **Q4: What is the contract on derived per-index overrides when `overrides.length !== result.length`? — Non-blocking, with a definite answer in R4.**
  R4 pins the ad-hoc-branch-equivalent behaviour: `overrides[i]` applies for positions
  `< overrides.length AND < result.length`, ignored for higher `i`. Symmetric with
  how the existing ad-hoc branch behaves (lines 1404-1410 — `overrides[i]` is
  `undefined` past the end and the conditional `ov !== undefined` skips). Not
  blocking.

No blocking open questions remain; the spec can advance to `test-writer`.

## Standing constraint candidate

**Proposed rule (informal):** "All `generateArray` mode arms MUST apply the same
trailing pass: cap to `callerMax ?? defMax`, apply per-index `overrides`
(or throw per B38 on primary), apply `transform`."

Rationale: this constraint is what's actually needed to prevent the regression class
B52 cleans up. Without it, the next sibling fix to one arm (a hypothetical B53 on a
fourth concern, say per-record locale resolution) will land on one arm and silently
diverge again from the other two — the exact regression pattern B25 left unfinished
and B52 closes. Whether the constraint is named explicitly in `architecture.md`'s
Rules or absorbed under D8 ("stored equals returned for registered schemas" already
implies returned semantics are coherent across modes) is the **manager's** promotion
decision. Spec-writer flags the candidate; manager confirms or absorbs on close.

The constraint also dovetails with D11 ("PIPELINE is canonical for per-field
generation"): the array-level dispatch has its own three-arm shape that benefits from
the same "single source of truth" principle. A future re-promotion could name the
constraint formally as D14 if a fourth sibling regression on this surface lands.

## Notes

- **Anchor reading** — `src/world/engine.ts` lines 140-192 (bound helpers), 595-649
  (populate), 1266-1417 (generateArray); `src/world/registration.ts:117-122`
  (`resolveMode`).
- **Bump shape** — `patch` (R9). No API change, only correctness fixes against
  documented or clearly-implied contracts.
- **Changeset wording sketch** — "Fix eight inconsistencies across `generate(arr)` /
  `populate`: derived `.max`/`defMax` now honoured (R1/R8); primary `store:false` now
  honours `.max` (R2 — user's repro); primary + transform now applies (R3); derived
  - overrides + transform now apply (R4); `populate(Derived, N)` now auto-provisions
    sources (R5); `populate`'s dead primary-first pre-check removed (R6); ad-hoc
    shares the helpers (R7)." Patch bump.
- **Predecessors** — B25 (resolve-mode extraction), B38 (primary-array overrides
  throw), B43 (primary-array caller-max slice), B44 (primary-array store-false
  early-return), B47 → D12 (forbid dual registration).
- **Composes with** — D8 (stored = returned), D11 (PIPELINE — untouched, this is
  array-level), B10 (effectiveStore transitive suppression), B12/B18 (deepMerge
  semantics).
- **GitHub issue** — none yet; user reported conversationally. No `(closes #N)` line
  in the commit / changeset.
- **`flags: [review]`** — the item card carries this; the manager pauses for spec
  sign-off before advancing to test-writer.
- **No `node:*` introduced** — D13 satisfied trivially (pure logic in already-shipped
  paths).
- **One test per R-ID** — eight tests, not the (3 × 2 × 5 × 4) = 120-cell Cartesian
  grid implied by the dimensions on the item card. The permutation matrix above pins
  exactly the cells that prove each R-ID; test-writer MUST NOT enumerate beyond it.
