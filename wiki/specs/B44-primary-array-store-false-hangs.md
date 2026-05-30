# B44: BUG — `world.generate(primaryArraySchema, { store: false })` hangs forever (infinite loop)

## Context

GitHub issue [#26](https://github.com/dxlbnl/zod4-mock/issues/26). User-classified
**High** severity: a hang is worse than a wrong value. The test process / CI worker
freezes with no stack, no failing assertion, and no hint at the offending call. The
type signature looks correct (`T[]` in, `T[]` out); diagnosis requires bisecting
collection-time `generate` calls by hand.

The bug lives in `WorldImpl.generateArray`'s **primary-mode** arm
([src/world.ts:1300-1328](../../src/world.ts#L1300) — the same branch B38 and B43 just
guarded). After both siblings landed, the relevant tail of the branch reads:

```ts
case "primary": {
  // (B38 guard for non-empty overrides — throws)
  // (B43 guard for .min/.max/.length — throws)

  const existingCount = this.registry.count(innerSchema);
  const minRequired = resolveMinRequired(arraySchema, defMin);
  const maxAllowed  = resolveMaxAllowed(arraySchema, defMax);
  const target = Math.max(
    existingCount,
    genPrng.int(Math.min(minRequired, maxAllowed), Math.max(minRequired, maxAllowed)),
  );

  while (this.registry.count(innerSchema) < target) {
    this.generateAndStorePrimary(innerSchema, mode.reg);   // ← does NOT store under store:false
  }

  return this.registry.all(innerSchema);                   // ← reads back what was never written
}
```

`generateAndStorePrimary` gates its `registry.store` call on `this.effectiveStore`
([src/world.ts:1153](../../src/world.ts#L1153)) — set in `WorldImpl.generate`'s
try/finally for B10-R4's transitive suppression. Under `world.generate(schema.array(), { store: false })`,
`effectiveStore === false`: the loop body generates a record and returns it, but
**does not** call `registry.store`. `this.registry.count(innerSchema)` therefore stays
at `existingCount` for every iteration. Whenever the rolled `target` exceeds
`existingCount`, `while (count < target)` is an infinite loop.

The loop conflates two responsibilities:
1. "how many records have I produced for this response" (the value-output dimension), and
2. "how many records are in the registry" (the side-effect dimension).

These two dimensions only stay in lockstep while storing is enabled — which is
exactly the invariant B10's opt-out was designed to break.

### Repro (from #26)

```ts
const schema = z.object({ id: z.string(), name: z.string() });
const world = createWorld({ seed: 1 });
world.withSchema(schema, { matchers: { name: () => "x" } });

world.generate(schema, { store: false });                  // returns
world.generate(schema.array());                            // returns
world.generate(schema.array(), { store: false });          // HANGS
```

All three conditions must hold simultaneously (per #26's matrix):

| registration                         | call                                            | result    |
|--------------------------------------|-------------------------------------------------|-----------|
| unregistered (ad-hoc)                | `generate(schema.array(), { store:false })`     | returns (ad-hoc branch) |
| `withSchema(schema, {})` no matcher  | `generate(schema.array(), { store:false })`     | returns (still primary, but rolled target may meet existingCount on lucky seeds) |
| `withSchema(schema, { matchers })`   | `generate(schema, { store:false })` (single)    | returns (single-item path, not array) |
| `withSchema(schema, { matchers })`   | `generate(schema.array())` (store:true)         | returns (registry advances) |
| `withSchema(schema, { matchers })`   | `generate(schema.array(), { store:false })`     | **hangs** |

### Decision — fix the loop by decoupling progress from the registry under `store: false`

The fix proposed by #26 (and adopted verbatim here): in the primary-mode arm, when
`!this.effectiveStore`, generate the rolled `target` records directly via
`Array.from({ length: target }, ...)` and return that array. Do not loop on
`registry.count(innerSchema)` — that count never advances under `store: false`. The
store-on path stays byte-for-byte identical.

```ts
case "primary": {
  // (B38 + B43 guards)

  const existingCount = this.registry.count(innerSchema);
  const minRequired = resolveMinRequired(arraySchema, defMin);
  const maxAllowed  = resolveMaxAllowed(arraySchema, defMax);
  const target = Math.max(
    existingCount,
    genPrng.int(Math.min(minRequired, maxAllowed), Math.max(minRequired, maxAllowed)),
  );

  if (!this.effectiveStore) {
    // store opted out: generate the rolled count directly and return.
    // Do NOT gate on registry.count — it can never advance without a write.
    return Array.from({ length: target }, () =>
      this.generateAndStorePrimary(innerSchema, mode.reg),
    );
  }

  while (this.registry.count(innerSchema) < target) {
    this.generateAndStorePrimary(innerSchema, mode.reg);
  }
  return this.registry.all(innerSchema);
}
```

Argued, tied to the binding rules and adjacent specs:

1. **Hang severity drives the fix shape.** A hang reads as a frozen CI/test runner
   with no stack trace. The right fix is to *make the call return correct ephemeral
   records*, not to throw. B10's existence (B10-R5 in particular) shows that
   `store: false` is a supported first-class opt-out for matchers and
   auto-provisioning paths — the hang is a missed branch in the array dispatcher,
   not a contract refusal.

2. **B10-R2 / B10-R4 dictate "fresh records, registry untouched."** B10-R2 says
   `store: false` suppresses the registry write at the top-level call; B10-R4 says
   the suppression is transitive — nested generation beneath a `store: false` outer
   call also does not write. The current loop violates that goal indirectly by
   *trying* to persist (so it can read back via `registry.all`) and then failing to
   persist (B10-R4 transitive suppression kicks in inside `generateAndStorePrimary`).
   The fix flips the data flow: produce `target` values directly via the array
   constructor's return, never consult `registry.count`, never depend on
   `registry.store`. `generateAndStorePrimary` continues to gate on `effectiveStore`,
   so B10-R4 transitive suppression holds end-to-end (no record written at any
   recursion depth).

3. **B20's "Fix B" precedent.** B20 fixed the derived-source counterpart of the same
   surface by capturing the auto-provisioned source locally rather than reading the
   registry back ([wiki/specs/B20-store-false-empty-from-crash.md](B20-store-false-empty-from-crash.md)).
   B44 is the primary-array analogue of the exact same principle: local capture
   (here, `Array.from`'s return array) replaces `registry.all` when storing is off.
   After B20 + B44, the same pattern is consistent across both modes of the same
   `store: false` surface — derived-empty-from and primary-array.

4. **D8 (stored = returned) is preserved by construction.** D8 (`architecture.md`
   Rules, line 67) says for `withSchema`-registered schemas the value stored equals
   the value returned. Under `store: false` nothing is stored, so D8's equality is
   **vacuous** — there is no "stored" to compare against. The store-on path is
   unchanged byte-for-byte (B44-R5), so D8 holds there as before. B10's Context
   already documents this vacuity for the single-item case; B44 extends the same
   reasoning to the array case.

5. **Why not throw (à la B38 / B43)?** Because B10 explicitly supports `store: false`
   as a first-class opt-out for matchers + locale + overrides + transform users.
   Throwing would contradict B10's contract and the very use case it exists to serve
   (search-bucket envelopes, ephemeral fixtures, paginated previews). B38 and B43
   throw on call shapes that *would silently corrupt the registry-as-source-of-truth
   response contract* (per-index overrides dropped; bounds dropped); B44's shape
   doesn't corrupt — it just hangs because the loop's progress counter was tied to
   the side effect. Different bug, different fix shape.

### Composition with B38 / B43 / B10 / B20

- **B38** ([wiki/specs/B38-primary-array-overrides-dropped.md](B38-primary-array-overrides-dropped.md)):
  unaffected. B38 throws on `{ overrides: [...] }` for primary-registered inner
  schemas before the rolled-target arithmetic runs. The B38 throw fires regardless of
  `store: false`; B44's new branch is never reached on a B38-throwing call.
- **B43** ([wiki/specs/B43-primary-array-min-max-ignored.md](B43-primary-array-min-max-ignored.md)):
  unaffected. B43 throws on `.min/.max/.length` for primary-registered inner schemas
  before the rolled-target arithmetic runs. The B43 throw fires regardless of
  `store: false`; B44's new branch is never reached on a B43-throwing call (see
  B44-R8).
- **B10** ([wiki/specs/B10-generate-store-opt-out.md](B10-generate-store-opt-out.md)):
  B44 *restores* B10-R2 and B10-R4 for the primary-array dispatcher arm — the contract
  these requirements pin is currently broken (hang) on this code path. The fix is the
  smallest change that makes the dispatcher honour the opt-out without changing
  observable behaviour anywhere else.
- **B20** ([wiki/specs/B20-store-false-empty-from-crash.md](B20-store-false-empty-from-crash.md)):
  sibling fix on the same `store: false` surface (different mode). B20 used local
  capture in the no-source derived branch; B44 uses local capture (the `Array.from`
  return) in the primary-array branch. Together they harden the `store: false`
  surface across both array-pair modes.

### Architecture's binding Rules — applied

- **D1**: no `any`; existing types in `generateArray` (`innerSchema: ZodTypeAny`,
  `mode.reg: SchemaReg | null`, `target: number`) are sufficient — no new imports,
  no casts.
- **D3**: Zod v4 internals unchanged — the fix consults `this.effectiveStore`, not
  `_zod.def`.
- **D4 / D10**: per-schema fork-key stability preserved. The `nextSchemaSlot(arraySchema)`
  call at [src/world.ts:1258](../../src/world.ts#L1258) advances exactly once per
  `generateArray` call regardless of branch (unchanged from B38/B43). The PRNG draws
  inside the new branch are identical to the draws today: `genPrng.int(...)` is
  consumed *once* by the rolled-`target` arithmetic on line 1320; under
  `store: false`, the new branch reuses the already-rolled `target` value. Per-field
  draws inside each `generateAndStorePrimary(innerSchema, mode.reg)` call are
  unchanged (same `recordPrng` fork inside `generateAndStorePrimary`).
- **D5**: `docs/api-reference.md` is updated in the same step (see B44-R6).
- **D6**: a regression test pinning the #26 hang repro is added under `tests/unit/`
  (see B44-R1 — the test design is delicate; see "Test design note" below).
- **D8**: vacuously preserved under `store: false` (nothing stored); byte-identical
  on the store-on path (B44-R5).
- **D9**: no cache short-circuit is introduced — the fix is a pure control-flow
  rebranch.
- **D11**: the canonical `PIPELINE` in `src/pipeline.ts` is upstream of
  `generateArray` and is untouched.

### Test design note (informs B44-R1)

Asserting "the call returns" is a *negative* assertion against an infinite loop. A
naive `expect(() => world.generate(...)).not.toThrow()` would also pass on the buggy
implementation only if vitest's per-test timeout fires — at which point the suite is
*red* (timeout), not *green*. So the regression test design relies on vitest's default
5-second per-test timeout as the implicit bound: on the pre-B44 implementation, the
test fails by **timeout**; on the post-B44 implementation, the call returns
near-instantly and the body's `expect(result.length).toBeLessThanOrEqual(5)` /
`toBeGreaterThanOrEqual(1)` assertion succeeds well within the timeout. The test
explicitly does NOT use `vi.useFakeTimers()` (which would not help here — there is no
timer call; the loop spins on synchronous code) and does NOT add a longer custom
timeout (which would mask the hang). 5-second default + a strict length assertion is
the correct combination. The test docstring MUST call this out so a future maintainer
who shortens the default timeout understands the contract.

Item card:
[wiki/backlog/doing/B44-primary-array-store-false-hangs.md](../backlog/doing/B44-primary-array-store-false-hangs.md).
Closes GitHub issue #26.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B44-R1: `world.generate(primaryArraySchema, { store: false })` MUST return promptly with the rolled length

`WorldImpl.generateArray`'s primary-mode arm MUST, when invoked with
`this.effectiveStore === false` (set by an outer `world.generate(schema.array(), { store: false })`
call against a `withSchema`-registered inner schema), return an array of length equal
to the rolled `target` computed by the existing arithmetic
`Math.max(existingCount, genPrng.int(Math.min(minRequired, maxAllowed), Math.max(minRequired, maxAllowed)))`,
within the test suite's per-test timeout. The call MUST NOT enter an unbounded loop.

For the #26 repro schema (a plain `z.object({ id, name })` registered with
`{ matchers: { name: () => "x" } }` on a fresh `createWorld({ seed: 1 })` with
default `defaultArrayLength` `[1, 5]`), the returned array's `length` MUST satisfy
`1 <= length <= 5` (the default auto-roll range — `minRequired = 1`, `maxAllowed = 5`,
`existingCount = 0`).

The regression test for this requirement MUST:
- pin the exact #26 repro (schema, world, matcher, call shape);
- assert `result.length >= 1 && result.length <= 5` (strict length-range check);
- rely on vitest's default 5-second per-test timeout to bound the assertion (the
  pre-fix implementation hangs and the test fails by timeout; the post-fix
  implementation returns near-instantly);
- explicitly NOT call `vi.useFakeTimers()` and NOT raise the per-test timeout (see
  "Test design note" in Context — these would mask the regression).

- Scenario: exact #26 repro returns within the per-test timeout
  GIVEN
  ```ts
  const schema = z.object({ id: z.string(), name: z.string() });
  const world = createWorld({ seed: 1 });
  world.withSchema(schema, { matchers: { name: () => "x" } });
  ```
  on a fresh world with default `defaultArrayLength: [1, 5]` (omitted; default
  applies) and registry empty for `schema`
  WHEN the consumer calls `const result = world.generate(schema.array(), { store: false });`
  THEN the call returns within vitest's default 5-second per-test timeout (i.e. the
  test does NOT fail by `Test timed out in 5000ms`), AND `result.length >= 1` AND
  `result.length <= 5`.

- Scenario: post-`populate(N)` + `store: false` array call returns with `target >= N`
  GIVEN the same registered `schema` as above, with `world.populate(schema, 3)`
  having previously seeded three records (so `existingCount === 3` and the rolled
  `target = Math.max(3, genPrng.int(1, 5)) >= 3`)
  WHEN the consumer calls `const result = world.generate(schema.array(), { store: false });`
  THEN the call returns within the per-test timeout AND `result.length >= 3` (the
  rolled `target` is bounded below by `existingCount`).

### B44-R2: returned records MUST be produced by the same generation path as `store: true`

The records returned by `world.generate(primaryArraySchema, { store: false })` MUST
be produced by exactly the same code path the store-on call uses
(`generateAndStorePrimary(innerSchema, mode.reg)`), so all of the following are
applied: registered matchers, key-based heuristics, schema-based fallback, locale,
and the `from:`-source resolution for relations. The **only** observable difference
from the store-on call MUST be that no record is written to the registry (B44-R3).

In particular, for the #26 repro (matcher `name: () => "x"`), every returned
record's `name` MUST equal `"x"`. This is the practical, observable proof that the
matcher pipeline ran on every returned record.

- Scenario: matcher runs on every record under `store: false`
  GIVEN the #26 repro from B44-R1 (schema with `name: () => "x"` matcher, fresh
  world, registry empty)
  WHEN the consumer calls `const result = world.generate(schema.array(), { store: false });`
  THEN the call returns AND `result.every(r => r.name === "x")` is `true` (the
  matcher applied to every record), AND every `result[i].id` is a non-empty string
  (the schema-based string fallback ran for `id`).

- Scenario: returned records satisfy the inner schema
  GIVEN the #26 repro setup
  WHEN the consumer calls `const result = world.generate(schema.array(), { store: false });`
  THEN `result.every(r => schema.safeParse(r).success === true)` is `true`.

### B44-R3: registry MUST NOT be mutated by a `store: false` primary-array call

When `world.generate(primaryArraySchema, { store: false })` is called against a
primary-registered inner schema, the registry MUST NOT be written to — neither for
the inner schema nor (transitively) for any auto-provisioned relation or source the
inner schema's matchers depend on. Specifically, `world.registry.count(innerSchema)`
immediately after the call MUST equal `world.registry.count(innerSchema)` immediately
before the call. This is the direct extension of B10-R2 and B10-R4 to the
primary-array dispatcher arm.

Two registry-state cases MUST hold:

1. **Fresh-world case** — when `existingCount === 0` before the call, the count MUST
   still be `0` after the call. The freshly-generated `result` records MUST exist
   only as the returned array, not in the registry.
2. **Post-populate case** — when `world.populate(innerSchema, N)` has previously
   seeded `N` records, the count MUST still be `N` after a subsequent
   `world.generate(primaryArraySchema, { store: false })` call. The returned array
   is ephemeral and MUST NOT grow the registry past `N`.

- Scenario: fresh-world `store: false` array call leaves the registry empty
  GIVEN the #26 repro setup (registry empty for `schema`,
  `world.registry.count(schema) === 0` before the call)
  WHEN the consumer calls `world.generate(schema.array(), { store: false });`
  THEN `world.registry.count(schema) === 0` immediately after the call.

- Scenario: post-`populate(3)` `store: false` array call does not grow the registry
  GIVEN the same registered `schema`, with `world.populate(schema, 3)` having
  previously seeded three records (so `world.registry.count(schema) === 3` before
  the call)
  WHEN the consumer calls `world.generate(schema.array(), { store: false });`
  THEN `world.registry.count(schema) === 3` immediately after the call — the call
  returned an ephemeral array of length `>= 3` (B44-R1) but did NOT grow the
  registry.

### B44-R4: rolled `target` length matches existing arithmetic; caller-side `.min/.max/.length` is out of scope (B43 handles it)

The rolled `target` value the `store: false` branch produces MUST be computed by the
**same** expression the store-on path uses today:
`Math.max(existingCount, genPrng.int(Math.min(minRequired, maxAllowed), Math.max(minRequired, maxAllowed)))`
on lines [1318-1321](../../src/world.ts#L1318). The new branch MUST reuse this
already-computed `target` variable (not recompute it, not redraw from `genPrng`); this
preserves D4/D10 per-schema PRNG determinism (the `genPrng.int` draw happens once,
in the same position in the PRNG stream, regardless of whether the branch is
store-on or store-off).

This requirement explicitly bounds B44's scope: it covers **only** the default
auto-roll range (driven by `defaultArrayLength` falling back to `[1, 5]` per
`resolveMinRequired` / `resolveMaxAllowed`). Caller-side `.min(N)` / `.max(M)` /
`.length(N)` modifiers on a primary-registered inner schema are handled by B43's
throw ([B43-R1](B43-primary-array-min-max-ignored.md#b43-r1-throw-when-min-max-length-target-a-primary-registered-array)),
which fires **before** B44's new branch is reached. See B44-R8 for the explicit
composition guarantee.

- Scenario: default-`defaultArrayLength` rolled target matches the store-on roll
  GIVEN two worlds with `seed: 1`, the same #26 schema and matcher registered, and
  registry empty on both. `worldA` calls `world.generate(schema.array())` (store on);
  `worldB` calls `world.generate(schema.array(), { store: false })` (store off)
  WHEN both calls return
  THEN `worldA_result.length === worldB_result.length` (same rolled `target` because
  the `genPrng.int` draw happens once on each side, at the same position in the PRNG
  stream — the only difference is whether the records flow into the registry or
  straight into the returned array).

- Scenario: configured `defaultArrayLength: [2, 4]` is honoured under `store: false`
  GIVEN a world `createWorld({ seed: 1, defaultArrayLength: [2, 4] })` with the #26
  schema and matcher registered, registry empty
  WHEN the consumer calls `const result = world.generate(schema.array(), { store: false });`
  THEN `result.length >= 2` AND `result.length <= 4` (the rolled target respects
  the world-level `defaultArrayLength` configuration; `resolveMinRequired` /
  `resolveMaxAllowed` are not bypassed by the fix).

### B44-R5: store-on path MUST be byte-identical to today

When `world.generate(primaryArraySchema)` is called with `options.store` absent OR
explicitly `true` (i.e. `this.effectiveStore === true`), the primary-mode arm MUST
behave **byte-equivalent** to the pre-B44 implementation: same return value
(`registry.all(innerSchema)` after the loop tops the registry up to `target`), same
records written to the registry, same field values, same ordering, for the same
seed. The new `store: false` branch MUST be guarded by `if (!this.effectiveStore)`
and MUST NOT execute on the store-on path.

This is the regression guard against any accidental cross-path change. The fix
changes only the store-off path; the store-on path's loop body, return value, and
registry side effects are preserved verbatim.

- Scenario: store-on primary-array call returns the registry and stores all rolled records
  GIVEN the #26 schema and matcher registered on a fresh `createWorld({ seed: 1 })`,
  registry empty
  WHEN the consumer calls `const result = world.generate(schema.array());` (no
  options — default `store: true`)
  THEN the call returns; `result.length === world.registry.count(schema)` (D8 —
  stored equals returned); `result` deep-equals `world.registry.all(schema)`; each
  record's `name === "x"` (matcher applied); the exact `result` value MUST be
  byte-identical to a pre-B44 run with the same seed and registration.

- Scenario: store-on primary-array call after `populate(3)` returns registry of size `>= 3`
  GIVEN the same registered schema, with `world.populate(schema, 3)` having
  previously seeded three records (so `world.registry.count(schema) === 3` before)
  WHEN the consumer calls `const result = world.generate(schema.array());`
  THEN `world.registry.count(schema) === Math.max(3, rolled_target)`, AND `result`
  deep-equals `world.registry.all(schema)` (D8), AND the post-call registry count and
  contents are byte-identical to the pre-B44 implementation for the same seed.

### B44-R6: ad-hoc inner schemas under `store: false` MUST be unaffected

When the inner schema is **NOT** primary-registered
(`this.findPrimaryRegs(innerSchema).length === 0`) AND NOT derived
(`this.findDerivedRegs(innerSchema).length === 0`) — the `case "ad-hoc"` branch at
[src/world.ts:1333-1364](../../src/world.ts#L1333) — the call MUST continue to honour
`store: false` exactly as today (it already does: the ad-hoc branch builds via
`Array.from({ length: N })` and does not consult the registry). B44 MUST NOT touch
this branch. A passing baseline test pins this so a future refactor that consolidates
the branches does not regress the ad-hoc path's already-correct behaviour.

- Scenario: ad-hoc array under `store: false` returns the rolled length
  GIVEN an unregistered schema `Item = z.object({ id: z.string(), label: z.string() })`
  on a world `createWorld({ seed: 1 })` with NO `withSchema(Item)` call (so the
  array call hits the ad-hoc branch)
  WHEN the consumer calls
  `const result = world.generate(Item.array().length(3), { store: false });`
  THEN the call returns; `result.length === 3` (the ad-hoc branch's `length_equals`
  honoured); `world.registry.count(Item) === 0` (no registry, no write — ad-hoc
  schemas don't register anyway).

### B44-R7: derived inner schemas under `store: false` MUST be unaffected

When the inner schema is derived (the `case "derived"` branch at
[src/world.ts:1268-1295](../../src/world.ts#L1268)), the call MUST continue to honour
the derived contract under `store: false` exactly as today. B44 MUST NOT touch this
branch. B20's local-capture fix
([wiki/specs/B20-store-false-empty-from-crash.md](B20-store-false-empty-from-crash.md))
covers the related `store: false` failure mode on a different code path
(no-source derived single-item); the derived-array branch is independent of both
B20 and B44. A passing baseline test pins this.

- Scenario: derived array under `store: false` produces one output per source record
  GIVEN `Source = z.object({ id: z.uuid() })` and
  `Derived = z.object({ sourceId: z.uuid() })` with `from: Source`, both registered
  on `createWorld({ seed: 1 })`, and `world.populate(Source, 2)` having seeded two
  sources (so the derived array's auto-provision floor is `<= 2`)
  WHEN the consumer calls
  `const result = world.generate(Derived.array(), { store: false });`
  THEN the call returns; `result.length === 2` (one output per source record);
  `world.registry.count(Derived) === 0` (no derived write — B10-R2);
  `world.registry.count(Source) === 2` (sources unchanged, no new auto-provision
  beyond the pre-populated two).

### B44-R8: composition with B43 — B43's throw still wins when `.min/.max/.length` is present

When a call combines `world.generate(primaryArraySchema, { store: false })` with
`.min(N)` / `.max(M)` / `.length(N)` on the outer array schema against a
primary-registered inner schema, **B43's throw MUST fire** ([B43-R1](B43-primary-array-min-max-ignored.md#b43-r1-throw-when-min-max-length-target-a-primary-registered-array)) — B44's new branch MUST NOT short-circuit B43's guard.

B44's new `if (!this.effectiveStore)` branch sits **after** B38's and B43's throws
in the primary-mode arm (the throws are at the top of the branch; the rolled-`target`
arithmetic and the new `if (!this.effectiveStore)` follow). So B43 reaches its guard
first on a composed call and throws as today, with no change in error message or
registry side effects.

- Scenario: `store: false` + `.min/.max` against primary-registered inner throws B43
  GIVEN the #26 schema and matcher registered on `createWorld({ seed: 1 })`
  WHEN the consumer calls
  `world.generate(schema.array().min(2).max(2), { store: false })`
  THEN the call throws an `Error` whose message contains
  `world.populate(schema, N)` AND `world.generate(schema.array()).slice(0, N)`
  (B43's message); `world.registry.count(schema) === 0` (no record was written —
  B43-R5 + B10-R4 both pin this).

- Scenario: `store: false` + `{ overrides: [...] }` against primary-registered inner throws B38
  GIVEN the same registered schema on a fresh `createWorld({ seed: 1 })`
  WHEN the consumer calls
  `world.generate(schema.array(), { store: false, overrides: [{ name: "y" }] })`
  THEN the call throws an `Error` whose message contains
  `world.populate(schema, count, factory)` (B38's message); `world.registry.count(schema) === 0`.

### B44-R9: changeset entry — patch bump and `(closes #26)`

A changeset file at `.changeset/b44-primary-array-store-false-hangs.md` MUST be added
in the same step. The frontmatter MUST declare a **patch** bump for `zod4-mock`.

Rationale for `patch` (not `minor`): unlike B38 and B43 (both `minor` because they
promote silent no-ops to throws — observable behaviour change for callers who relied
on the silent return), B44 fixes a hang. The pre-fix observable behaviour for any
non-hanging caller is **unchanged** (the store-on path is byte-identical — B44-R5).
Callers who hit the hang never had a working call shape to begin with; turning the
hang into a correct return is a pure bug fix with no contract change. `patch` is the
correct semantic-versioning shape for this kind of fix.

The changeset body MUST:
- summarise the bug (`world.generate(primaryArraySchema, { store: false })` hangs
  forever when the rolled `target` exceeds `existingCount`);
- describe the fix shape (decouple the loop's progress counter from
  `registry.count` under `!effectiveStore`; generate `target` records directly via
  `Array.from` and return them);
- show a short before/after example consistent with the item card's repro from #26;
- end with the literal final non-empty line `(closes #26)` per the codebase's
  commit-message-issue-references convention.

The item commit subject (when the manager commits the completed item) MUST include
`(closes #26)` per the same convention.

- Scenario: changeset exists with the right bump and closes-line
  GIVEN the B44 change applied
  WHEN `.changeset/b44-primary-array-store-false-hangs.md` is read
  THEN its frontmatter contains `"zod4-mock": patch`, its body summarises the hang
  and the fix shape with a before/after example, and its final non-empty line is
  `(closes #26)`.

### B44-R10: `docs/api-reference.md` updated in the same step

Per D5 (`architecture.md` Rules), `docs/api-reference.md` MUST be updated in the same
step. The `.generate` subsection's array-return bullet (currently line 320 —
`"If \`schema\` is an array: returns an array. ..."`) already mentions B38's throw on
per-index overrides and B43's throw on `.min/.max/.length` for primary-registered
inner schemas. B44 MUST add a short line noting that
`world.generate(primaryArraySchema, { store: false })` returns ephemeral records (of
the auto-rolled length, no registry write), so the reader sees the full
primary-registered-array surface in one place:

- per-index `overrides` → throw, see `.populate` (B38);
- `.min/.max/.length` → throw, see `.populate` / `.slice` (B43);
- `{ store: false }` → returns ephemeral records, no registry write (B44 — this
  item).

The note MUST be tight (one short line or parenthetical, matching the existing B38 /
B43 cross-link style); a full sub-bullet is not required. The `GenerateOptions.store`
documentation in the `GenerateOptions` section (added in B10-R8) already covers the
general `store: false` contract — B44's addition is the specific cross-link from the
`.generate` array-return bullet so a reader looking at array behaviour finds the
ephemeral-array note inline.

- Scenario: docs reflect the ephemeral-array note on the `.generate` bullet
  GIVEN the B44 change applied
  WHEN `docs/api-reference.md` is read
  THEN the `.generate` subsection's array-return bullet mentions
  `{ store: false }` against a primary-registered inner schema and notes that it
  returns ephemeral records (no registry write); the note is short and consistent in
  style with the existing B38 / B43 cross-links on the same bullet.

## Out of scope

- **Caller-side `.min(N)` / `.max(M)` / `.length(N)` modifiers on the outer array
  schema against a primary-registered inner.** Covered by B43's throw — B43-R1 fires
  before B44's new branch is reached (B44-R8). B44 does not relitigate B43's
  decision; the throw is the contract for that call shape regardless of `store`.
- **Per-index `overrides` on the outer array call against a primary-registered
  inner.** Covered by B38's throw — B38-R1 fires before B44's new branch is reached.
  Same composition framing as B43.
- **Changing the `existingCount` floor** (`target = Math.max(existingCount, …)`).
  The floor is intentional for the no-bounds case (B43-R2 documents it). Under
  `store: false`, the floor still applies: the rolled `target` is bounded below by
  `existingCount`, even though the records returned are freshly generated rather than
  read from the registry. (Rationale: this preserves the "give me at least
  `existingCount` records, the same number as the store-on path would have returned"
  intent. If the caller wants exactly the rolled-min-only count under `store: false`,
  they can use B43's redirect targets — `world.generate(schema.array()).slice(0, N)`
  for reading or a separate world for writing.)
- **Suppressing relation auto-provisioning beneath a `store: false` primary-array
  call.** Already covered by B10-R4 transitive suppression: `generateAndStorePrimary`
  inside the new branch gates its own `registry.store` on `effectiveStore`, and any
  relation auto-provisioning inside `generateObjectFields` likewise honours
  `effectiveStore` (B10-R4's "relation auto-provisioning beneath `store: false` does
  not write" scenario). B44 does not re-litigate B10-R4; the existing mechanism
  composes correctly.
- **A `World.preview`-style method.** Rejected in B10's spec (B10-R1) — the option
  is on `GenerateOptions`, not a new method. B44 inherits that decision.
- **Caching the freshly-generated array for re-use across multiple `store: false`
  calls in the same world.** Each `store: false` array call generates afresh — no
  hidden world-scoped cache is introduced. (Consistent with B8-R7 / B20's "every
  `store: false` call is fresh" principle for derived schemas; B44 extends the same
  intent to primary arrays.)
- **A "make `store: false` skip the rolled-`target` Math.max(existingCount, …) and
  always use the genPrng.int(min, max) draw" feature.** Considered and rejected: it
  would change the rolled length under `store: false` vs. `store: true` for the same
  seed, breaking the "only the side effect differs" framing (B10-R7) and surprising
  callers who toggle the flag mid-test.
- **Decomposing `generateArray`** (B22/B25/B28 complexity-research refactor). B44
  lands the fix on the current `generateArray` shape; future decomposition is
  responsible for preserving B44-R1..R7 invariants.

## Open questions

- **Should the `Array.from({ length: target }, ...)` callback construct a fresh
  per-record PRNG fork (matching the ad-hoc branch's per-element `genPrng.fork('[i]')`
  pattern at [src/world.ts:1351](../../src/world.ts#L1351))? — Non-blocking.** The
  store-on path's `while` loop today calls `generateAndStorePrimary(innerSchema, mode.reg)`
  with no `options.prng` argument; the callee builds its own `recordPrng` from
  `rootSeed + recordId` at [src/world.ts:1137](../../src/world.ts#L1137), where
  `recordId` is `reg${effectiveRegId}#${recordIndex}` and `recordIndex` is computed
  from `registry.count(schema) + pendingCounts`. The new branch reuses the exact
  same `generateAndStorePrimary(innerSchema, mode.reg)` call, inheriting that
  PRNG-derivation scheme. Under `store: false`, `registry.count` never advances
  inside the loop, so `recordIndex` is driven by `pendingCounts` (which DOES
  advance: `generateAndStorePrimary` increments `pendingCounts` in its try block
  and decrements in `finally`, so each call sees a different `recordIndex`).
  Per-record determinism is therefore preserved by the existing mechanism — no new
  fork-key plumbing needed. Recorded; not blocking.

- **Should the `defaultArrayLength` propagation through nested calls be re-verified
  under `store: false`? — Non-blocking.** `resolveMinRequired` / `resolveMaxAllowed`
  consult `this.options.defaultArrayLength` once at the top of `generateArray` (lines
  1316–1317), regardless of branch. The fix does not touch the resolution. B44-R4's
  second scenario pins that the configured `defaultArrayLength` is honoured under
  `store: false` for the regression-test surface. Recorded; not blocking.

- **The per-schema slot counter `nextSchemaSlot(arraySchema)` at line 1258 advances
  on every `generateArray` call regardless of branch outcome. — Non-blocking.** This
  is the same behaviour B38's throw and B43's throw inherit (see B43's Open
  questions, "Slot-counter advance on a doomed call"). Under `store: false`, the
  call DOES return (not throw), so the slot advance is "this call happened" in the
  most natural sense — there is no doomed-call framing to worry about. Recorded
  for completeness; not blocking.

- **Should the `Array.from` callback pass `options` (overrides / transform) through
  to `generateAndStorePrimary`? — Non-blocking, but the answer is NO.** The B38
  throw at [src/world.ts:1307](../../src/world.ts#L1307) refuses any non-empty
  `options.overrides` before B44's branch is reached, so on the only call shape
  that reaches B44 (no overrides, no `.min/.max/.length`), `options.overrides` is
  empty / absent. Forwarding `options` would be a no-op for `overrides`; forwarding
  `options.transform` is plausible but matches the store-on `while` loop's behaviour
  of NOT forwarding `options` to `generateAndStorePrimary` either (the store-on
  loop calls `this.generateAndStorePrimary(innerSchema, mode.reg)` with no third
  argument at line 1324). For symmetry with the store-on path (B44-R5: byte-identical
  store-on behaviour, including how `options` is or is not threaded), the new branch
  MUST also pass no third argument to `generateAndStorePrimary`. Recorded as
  explicitly resolved; not blocking.

No blocking open questions remain; the spec can advance to `test-writer`.
