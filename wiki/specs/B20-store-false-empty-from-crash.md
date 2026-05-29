# B20: BUG — `world.generate(derivedSchema, { store: false })` crashes when the `from:` registry is empty

## Context

In 0.7.1, the no-source derived branch of `WorldImpl.generateSingleItem`
(`src/world.ts`, lines ~1122–1144 — the `else if (derivedRegs.length > 0)` block reached
when `world.generate(DerivedSchema)` is called **without** `{ source }` and the schema is
registered with `from: SourceSchema`) auto-provisions one source record per `derivedReg`
when the `from:` registry is empty, then collects all `(source, reg, index)` pairs from
the registry and picks one by `generationCounter`.

The auto-provisioning call is `this.generateAndStorePrimary(reg.from, fromReg)`. Under
default `store: true`, that call writes the freshly generated source into the registry,
so the subsequent `this.registry.all(reg.from)` returns a one-element array, `pairs`
contains a single pair, the modulo picks index 0, and everything works.

Under `world.generate(DerivedSchema, { store: false })` — B10's opt-out — B10-R4 makes
the suppression **transitive**: nested calls beneath the outer `{ store: false }` see
`effectiveStore === false` and **do not** write. So `generateAndStorePrimary` generates
the source but does not store it; `this.registry.all(reg.from)` still returns `[]`;
`pairs` stays empty; `(this.generationCounter - 1) % 0` is `NaN`; and the destructuring
`const { source, reg, sourceIndex } = pairs[NaN]!` throws
`TypeError: Cannot destructure property 'source' of 'pairs[idx]' as it is undefined`.

The crash is fully reproducible by the snippet in GitHub issue
[#21](https://github.com/dxlbnl/zod4-mock/issues/21) (also pinned in
[wiki/backlog/doing/B20-store-false-empty-from-crash.md](../backlog/doing/B20-store-false-empty-from-crash.md)),
and surfaces immediately on the natural "give me one ephemeral derived fixture before any
setup helper has run" pattern.

This spec composes with two recently-landed siblings whose contracts it must preserve:

- **B10 — `{ store: false }` opt-out**
  ([wiki/specs/B10-generate-store-opt-out.md](B10-generate-store-opt-out.md)) — B10-R4
  pins the transitive propagation rule: relations auto-provisioned beneath a
  `{ store: false }` outer call also do **not** write. The fix MUST honour that rule:
  the auto-provisioned source that the no-source derived branch needs in order to pick a
  pair MUST NOT land in the registry when the outer call set `store: false`. B10's
  Context already names the "search-bucket" / "ephemeral fixture" use case as the
  motivation; a side-effect source that lands silently because the user asked for an
  ephemeral derived violates the principle of least surprise and B10-R4 directly. This
  forces **Fix B** over Fix A (see `## Decision` below).
- **B8 — derived-schemas identity** ([wiki/specs/B8-derived-schemas-identity.md](B8-derived-schemas-identity.md))
  — B8 covers the **`{ source }`-provided** path (`sourceOverride !== undefined`). B20
  is entirely in the **no-source** branch (`sourceOverride === undefined`), which falls
  through to the "pick a source from the registry, auto-provision if empty" logic. B8's
  upsert map MUST NOT be touched by the fix — B20's pairs come from the no-source pair
  loop, not the upsert path.

**Architecture's binding Rules apply unchanged.** Per `wiki/architecture.md`'s Rules:

- D1 — no `any`; `.js` import extensions on any new imports. The auto-provisioned local
  capture introduced by Fix B is a `Map<SchemaReg, unknown>` (the reg is the registration
  object; the value is the generated source record). No `any` is required.
- D3 — Zod v4 internals are not touched; no `_zod.def` access changes.
- D4 — per-field PRNG determinism is preserved. The fix changes **where** the
  auto-provisioned source value is read from (a local Map vs. `this.registry.all(...)`),
  not how it is generated; the same `generateAndStorePrimary` call runs with the same
  seed, the same `recordPrng`, and the same per-field forks. The PRNG sequence consumed
  by a `{ store: false }` no-source derived call MUST be byte-identical to the sequence
  that would have been consumed today **were the registry to have one source already
  populated** (i.e. the non-empty path is unchanged; the empty path now produces the
  same value via a local capture instead of via a registry read).
- D5 — no public API changes; `docs/api-reference.md` does not need a new entry. B10's
  documentation already states `store: false` "suppresses the registry write" — that
  statement is preserved by Fix B (and would be **silently violated** by Fix A).
- D6 — a regression test MUST be added (B20-R1's exact-repro scenario).
- D8 — for `withSchema`-registered schemas, the value stored in the registry equals the
  value returned by `world.generate`. Under `store: false` the equality is vacuous (B10
  already documents this). Fix B preserves that vacuity for both the derived record
  **and** the auto-provisioned source — neither lands in the registry, neither is
  returned to the caller, so there is no stored-vs-returned divergence to worry about.

Item card: [wiki/backlog/doing/B20-store-false-empty-from-crash.md](../backlog/doing/B20-store-false-empty-from-crash.md).
Closes GitHub issue [#21](https://github.com/dxlbnl/zod4-mock/issues/21).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Decision

**Fix B (capture the auto-provisioned source locally) is adopted.** Fix A (temporarily
force `effectiveStore = true` around the auto-provision loop) is rejected.

Rationale:

- B10-R4 makes `store: false` **transitively** suppress registry writes — its own
  scenarios explicitly assert that auto-provisioned relation owners beneath a
  `{ store: false }` outer call also do not write
  (B10-R4's "relation auto-provisioning beneath `store: false` does not write" scenario:
  `world.registry.count(OwnerSchema) === 0`). B10's Context names the motivating user
  intent: "do not pollute the registry". A `from:` source auto-provisioned for picking
  purposes is structurally identical to a relation owner auto-provisioned for matcher
  purposes — both are nested side effects of the outer ephemeral call. Fix A would
  introduce an exception specifically for the no-source derived branch ("we promise to
  honour `store: false` everywhere except here, where you'll silently get a Source
  record added to the registry as a by-product of asking for an ephemeral Derived").
  That is exactly the surprise B10-R4 was written to prevent.
- Fix B is a minimal, local change: a `Map<SchemaReg, unknown>` (or
  `Map<ZodTypeAny, unknown>` keyed by `reg.from`) populated by the existing
  `generateAndStorePrimary` return value (already returned regardless of whether storage
  happened — see `src/world.ts` lines ~691–727), then read by the pair-collection loop
  for any `reg` whose `from:` registry is still empty.
- Fix B keeps determinism intact (D4): `generateAndStorePrimary` runs exactly as today
  and returns the same value; only the **path the value travels** to reach the pair loop
  changes (local Map vs. registry write + registry read), and a registry write + read
  is reference-preserving so the resulting `source` reference is the same in both fixes.
- Fix A would also need to be careful to roll back `effectiveStore` in a `try`/`finally`
  to survive thrown errors mid-generation — Fix B has no such concern, since it doesn't
  mutate world state at all.

The non-empty path (at least one `reg.from` source already in the registry) MUST be
unchanged: the pair loop reads from the registry as today; the local-capture Map is only
consulted for `reg`s whose `from:` registry is still empty *after* the auto-provision
loop has run (i.e. only the regs the auto-provision loop just generated for, when the
outer call was `store: false`).

## Requirements

### B20-R1: `world.generate(DerivedSchema, { store: false })` with an empty `from:` registry MUST NOT crash

When `world.generate(DerivedSchema, { store: false })` is called with no `source`
argument, `DerivedSchema` is registered with `from: SourceSchema`, and the registry
for `SourceSchema` is empty, the call MUST complete successfully and return a record
that satisfies `DerivedSchema.safeParse(result).success === true`. It MUST NOT throw a
`TypeError` (or any other error) from the no-source derived branch of
`generateSingleItem`. The returned record's matcher-derived fields (those whose matchers
read `ctx.source.<field>`) MUST equal the corresponding fields on the auto-provisioned
source that the call generated internally.

This requirement pins the exact repro from GitHub issue #21 as the regression test.

- Scenario: exact #21 repro — empty from-registry with `store: false` returns a valid record
  GIVEN
  ```ts
  const Source = z.object({ id: z.uuid(), name: z.string() });
  const Derived = z.object({ sourceId: z.uuid(), label: z.string() });
  const world = createWorld({ seed: 1 });
  world.withSchema(Source);
  world.withSchema(Derived, {
    from: Source,
    matchers: { sourceId: (ctx) => ctx.source.id },
  });
  ```
  and `world.registry.count(Source) === 0` (registry empty for both schemas)
  WHEN the consumer calls `const r = world.generate(Derived, { store: false });`
  THEN the call returns without throwing; `Derived.safeParse(r).success === true`;
  `typeof r.sourceId === "string"` (a UUID string); `typeof r.label === "string"`.

### B20-R2: the auto-provisioned source MUST NOT be stored when `store: false`

When the no-source derived branch in `generateSingleItem` auto-provisions a source
record (because the `from:` registry was empty) for an outer call that set
`store: false`, the auto-provisioned source MUST NOT be written to the registry. This
preserves B10-R4's transitive-suppression rule: under `store: false`, **no** side-effect
write happens — including the source record that the derived pick-loop internally needs.

- Scenario: source auto-provisioned under `store: false` does not land in the source registry
  GIVEN the B20-R1 setup (registry empty for both `Source` and `Derived`)
  WHEN the consumer calls `world.generate(Derived, { store: false });`
  THEN `world.registry.count(Source) === 0` (the auto-provisioned source did not land
  in the registry) AND `world.registry.count(Derived) === 0` (B10-R2 — the derived
  record also did not land in the registry).

- Scenario: a follow-up default-mode `generate` runs from a still-empty registry
  GIVEN the B20-R1 setup, after one prior `world.generate(Derived, { store: false });` call
  WHEN the consumer next calls `const r2 = world.generate(Derived);` (no options — default
  `store: true`)
  THEN the call returns without throwing; the auto-provision in this default-mode call
  writes one source (`world.registry.count(Source) === 1` afterwards); the derived
  record is NOT written by the no-source branch (`world.registry.count(Derived) === 0`
  afterwards — see B20-R5's note and `## Out of scope` on the no-source-branch
  asymmetry); `Derived.safeParse(r2).success === true`.

### B20-R3: matchers reading `ctx.source` MUST see the auto-provisioned source under `store: false`

Even though the auto-provisioned source is not written to the registry (B20-R2), the
derived record's matchers MUST still see that source via `ctx.source` — i.e. matcher
references like `(ctx) => ctx.source.id` MUST resolve to the auto-provisioned source's
`.id` value, not `undefined` and not a throw. The fix MUST route the locally-captured
source into `generateDerivedRecord` exactly as the registry-resident path does today.

- Scenario: matcher sees the auto-provisioned source's id under `store: false`
  GIVEN the B20-R1 setup (registry empty)
  WHEN the consumer calls `const r = world.generate(Derived, { store: false });`
  THEN `typeof r.sourceId === "string"` AND `r.sourceId.length > 0` (the matcher
  resolved a non-empty id from the auto-provisioned source — not `undefined` and no throw
  from the matcher).

### B20-R4: the non-empty-registry path MUST be unchanged

When `world.generate(DerivedSchema, { store: false })` is called with no `source` and
the `from:` registry **already** contains at least one source record (e.g. a prior
`world.populate(SourceSchema, N)` call ran), the call MUST behave as today: the pair
loop reads sources from the registry as before, picks one by
`generationCounter % pairs.length`, generates the derived record from it, and returns
the derived record without storing it (B10-R2). The fix MUST NOT introduce a regression
on this path — the local-capture mechanism applies only to the empty-registry,
auto-provision-needed sub-path.

- Scenario: pre-populated source registry — `store: false` reads from registry as today
  GIVEN the B20-R1 schemas, a world set up as in B20-R1, and one source pre-populated:
  `world.populate(Source, 1); const before = world.registry.count(Source);` (so
  `before === 1`)
  WHEN the consumer calls `const r = world.generate(Derived, { store: false });`
  THEN the call returns without throwing; `Derived.safeParse(r).success === true`;
  `r.sourceId === world.registry.all(Source)[0]!.id` (the matcher picked the
  pre-populated source); `world.registry.count(Source) === before` (no new source
  write); `world.registry.count(Derived) === 0` (no derived write — B10-R2).

### B20-R5: default-mode (`store: true`) behaviour MUST be byte-identical to today

For a no-source `world.generate(DerivedSchema)` call with the default `store: true` (or
omitted), the fix MUST NOT change observable behaviour: the auto-provisioned source
MUST be written to the registry (today's behaviour, since `generateAndStorePrimary` runs
under `effectiveStore === true`); the derived record is NOT written by the no-source
branch (today's behaviour at `src/world.ts:1122–1144` — the `else if (derivedRegs.length > 0)`
no-source branch returns the result without calling `this.registry.store(schema, result)`;
the derived-store call exists only in the with-source branch at `src/world.ts:1110`); the
returned record's value MUST be byte-identical to a pre-B20 run with the same seed and
schemas, and `world.registry.count(SourceSchema)` MUST equal `1` afterwards
(one auto-provisioned source). Determinism (D4) is preserved.

(B20 deliberately preserves this asymmetry — the no-source branch's missing derived
store is documented in `## Out of scope`; a separate backlog item should re-examine it.
B20's job is to fix the `store: false` empty-from crash, not to widen the no-source
branch's storage semantics.)

- Scenario: default-mode no-source derived generate — registry writes match today
  GIVEN the B20-R1 schemas, a world set up as in B20-R1, registry empty for both
  WHEN the consumer calls `const r = world.generate(Derived);` (no options)
  THEN the call returns without throwing; `Derived.safeParse(r).success === true`;
  `world.registry.count(Source) === 1` (one auto-provisioned source was stored);
  `world.registry.count(Derived) === 0` (today's no-source branch does NOT write the
  derived record — see the requirement text above and `## Out of scope`); and the value
  of `r` (and the stored source) are byte-identical to the same call against
  zod4-mock 0.7.1 with the same seed.

### B20-R6: determinism preserved — PRNG consumption MUST NOT shift between fix and pre-fix non-empty path

Two worlds set up identically (`createWorld({ seed: S }).withSchema(Source).withSchema(Derived, { from: Source, matchers })`)
MUST consume the PRNG identically when one calls
`world.generate(Derived, { store: false })` on an empty source registry (now handled
via the local-capture path) and the other calls the same on a registry pre-populated
with exactly one source by `world.populate(Source, 1)` followed by
`world.generate(Derived, { store: false })`. Specifically: a subsequent
`world.generate(Source)` on each world MUST produce a value at the same PRNG position
as in pre-B20 behaviour — i.e. the auto-provision path consumes the same PRNG state as
it does today, and only the registry side effect is suppressed.

(Rationale: this protects the D4 invariant against a refactor that accidentally moves
the `generateAndStorePrimary` call, changes the `recordIndex` it uses, or otherwise
shifts the per-field forks.)

- Scenario: subsequent `Source` generation lands on the same PRNG-derived value
  GIVEN two worlds, each `createWorld({ seed: 7 }).withSchema(Source).withSchema(Derived, { from: Source, matchers: { sourceId: (ctx) => ctx.source.id } })`
  with the schemas from B20-R1
  WHEN `worldA` calls `worldA.generate(Derived, { store: false });` (empty registry —
  auto-provisions via local capture) then `const a = worldA.generate(Source);`, and
  `worldB` calls `worldB.populate(Source, 1);` then
  `worldB.generate(Derived, { store: false });` (registry already has 1 source) then
  `const b = worldB.generate(Source);`
  THEN both calls return without throwing AND `Source.safeParse(a).success === true`
  AND `Source.safeParse(b).success === true` (sanity), AND for the *same seed*,
  `JSON.stringify(a) !== "undefined"` (sanity), AND the value of `a` is byte-identical
  to the value `worldB` would have produced on its very first `generate(Source)` call
  with no prior `populate` — i.e. the auto-provision PRNG fork sequence in `worldA`
  matches the pre-population PRNG fork sequence in `worldB`. (The test-writer MAY phrase
  this as: build a third world `worldC` with the same seed, call
  `worldC.populate(Source, 1)` then `const c = worldC.registry.all(Source)[0]`, and
  assert `JSON.stringify(a) === JSON.stringify(c)`.)

### B20-R7: a regression test MUST be added (D6)

Per the binding rule D6 ("when fixing a bug, a regression test MUST be added"), the B20
fix MUST land with a unit test that runs the **exact** repro from GitHub issue #21
(B20-R1's scenario) and asserts the call does not throw. The test MUST live under
`tests/unit/` (per `wiki/architecture.md`'s test-file-location convention) and MUST be
named for the bug (e.g. `tests/unit/store-false-empty-from.test.ts`). The test MUST
fail on the pre-B20 (0.7.1) implementation and pass on the post-B20 implementation.

- Scenario: regression test exists and pins the #21 repro
  GIVEN the B20 change applied
  WHEN `pnpm test` is run
  THEN a test file under `tests/unit/` contains the exact #21 repro from B20-R1's
  scenario; the test asserts the call returns without throwing and that
  `Derived.safeParse(r).success === true`; the test passes.

### B20-R8: changeset entry created in the same step

A changeset MUST be created at `.changeset/b20-store-false-empty-from-crash.md`
recording B20 as a `"zod4-mock": patch` bump (bug fix, behaviour-restoring under
`store: false`). The changeset body MUST summarise: (a) the crash being fixed
(`TypeError: Cannot destructure property 'source' of 'pairs[idx]' as it is undefined`),
(b) the trigger (`world.generate(DerivedSchema, { store: false })` with no `source`
and an empty `from:` registry), and (c) the fix shape (the auto-provisioned source is
captured locally and not written to the registry, honouring B10-R4's transitive
suppression). The final non-empty line MUST be `(closes #21)` to match the convention
of sibling changesets (`.changeset/b17-*.md`, `.changeset/b18-*.md`,
`.changeset/b19-*.md`).

- Scenario: changeset file exists and has the required shape
  GIVEN the B20 change applied
  WHEN `.changeset/b20-store-false-empty-from-crash.md` is read
  THEN its frontmatter has `"zod4-mock": patch`; the body mentions the crash, the
  trigger, and the fix shape; the final non-empty line is `(closes #21)`.

## Out of scope

- **The no-source derived branch's missing derived-record store.** Observation flagged by
  the test-writer while elaborating B20: the no-source derived branch at
  `src/world.ts:1122–1144` (the `else if (derivedRegs.length > 0)` block) calls
  `this.generateDerivedRecord(...)` and returns the result **without** invoking
  `this.registry.store(schema, result)` for the derived record. The derived-store call
  exists **only** in the with-source branch at `src/world.ts:1110` (inside the
  `if (this.effectiveStore)` block, added in B8). Consequence today: under default
  `store: true`, `world.generate(Derived)` with no source and an empty registry results
  in `count(Source) === 1` and `count(Derived) === 0` — asymmetric with the with-source
  branch. **B20 deliberately does NOT change this** — it stays out of scope. A separate
  backlog item should re-examine the asymmetry (decide whether the no-source branch
  should also store the derived record, or whether the with-source store is the outlier).
  B20 is the narrow `store: false` empty-from crash fix; widening the no-source storage
  semantics is a distinct decision.
- **Fix A (temporarily forcing `effectiveStore = true` around the auto-provision loop).**
  Rejected — see `## Decision` above. The card describes Fix A and Fix B as equivalent
  in correctness but different in `store: false` purity; B10-R4 forces the purer choice.
  This spec does not implement Fix A even as a fallback.
- **Changing the source-pick algorithm** (the
  `(this.generationCounter - 1) % pairs.length` index calculation). The fix is narrow:
  ensure `pairs.length > 0` after auto-provision under `store: false`. The pick math is
  unchanged.
- **Auto-provisioning multiple sources** beyond the one-per-empty-`derivedReg` the
  current code already provisions. The fix changes **where** the one source is read
  from, not how many are provisioned.
- **Caching the auto-provisioned source across multiple `store: false` calls** in the
  same world. Each `store: false` no-source derived call auto-provisions afresh — no
  hidden world-scoped cache is introduced. (This is consistent with B8-R7's "every
  `store: false` derived call is fresh" rule; the no-source branch is not a
  derived-schema upsert path, but the same "fresh per call" intent applies for
  symmetry.)
- **The `{ source }`-provided path** (`sourceOverride !== undefined` in
  `generateSingleItem`). That branch is fully covered by B8 (per-`(schema, source)`
  upsert) and B10-R2 (`store: false` suppresses upsert lookup and write). B20 does not
  touch it.
- **The ad-hoc (unregistered) and primary (non-derived) branches** of
  `generateSingleItem`. Neither hits the empty-`from:` auto-provision path; B20 leaves
  them unchanged.
- **A public API change.** The fix is internal to `WorldImpl.generateSingleItem`. No
  new `GenerateOptions` field, no new method, no signature change. `docs/api-reference.md`
  does not need an update beyond the implicit re-statement of B10's "`store: false`
  suppresses the registry write" — already documented.
- **Relation auto-provisioning beneath `store: false`.** Already covered by B10-R4; this
  spec does not re-cover it. B20 is the analogous fix for the **`from:` source**
  auto-provision path, which B10-R4 did not anticipate would crash on a `pairs.length === 0`
  modulo when the source registry stays empty.

## Open questions

- **Should the auto-provisioned source be reused across the multiple `derivedReg`s in a
  single call when more than one derivedReg shares the same `reg.from`? — Non-blocking.**
  The current code's auto-provision loop calls `generateAndStorePrimary(reg.from, fromReg)`
  per derivedReg. If two derivedRegs share the same `reg.from` (two derived schemas off
  the same source), the registry-backed path writes the same `reg.from` twice (the
  second call sees `registry.count(reg.from) === 1` after the first call and skips the
  auto-provision). Under Fix B, the local capture is keyed by `reg.from` (or `SchemaReg`),
  and the same "skip if already captured" check applies. This matches existing behaviour:
  one auto-provision per distinct `reg.from`, not per derivedReg. Recorded; not blocking
  (the existing tests already exercise the single-derivedReg shape, and the
  multi-derivedReg-same-from shape is not part of the #21 repro).

- **Should B20 also add a defensive guard against `pairs.length === 0` (e.g. a thrown
  error with a clearer message) as a belt-and-braces measure? — Non-blocking.** The fix
  ensures `pairs.length > 0` in every reachable case (under `store: true`, the registry
  read finds the freshly-stored source; under `store: false`, the local capture supplies
  it). A defensive `if (pairs.length === 0) throw new Error('…')` would catch only a
  future code path that re-introduces the bug, and would mask the real issue (Fix B
  missing for some new branch). Recorded as a non-blocking choice; the test-writer and
  reviewer MAY add a defensive throw if they judge it warrants, but the spec does not
  require it.

No blocking open questions remain; the spec can advance to `test-writer`.
