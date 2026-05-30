# B39: Replace `generationCounter`-derived PRNG fork keys with stable per-schema identity-based ones (D4 strengthening)

## Context

This is a **bug** item that captures a shipped, soft-correctness regression: the PRNG
sequence consumed by ad-hoc generation, every array, and the outer-wrapper
optional/nullable roll depends on **the order of prior `world.generate(...)` calls** on
the same world, not on the world's seed alone. Two identically-seeded worlds where one
calls `generate(X)` directly and the other calls `generate(Y); generate(X)` produce
**different** values for the second `generate(X)`.

**Root cause** (per the B27 audit
[wiki/research/engine/generation-counter-d4-audit.md](../research/engine/generation-counter-d4-audit.md)
§"The three call sites"): three PRNG fork keys in `WorldImpl` are derived from the
per-world `generationCounter` field rather than from the schema's identity:

1. **`generateSingleItem` ad-hoc branch** — `recordId = \`adhoc-${this.generationCounter}\``
   then `this.prng.fork(recordId)`
   ([src/world.ts:1180](../../src/world.ts#L1180)).
2. **`generateArray` (every mode — primary, derived, ad-hoc)** —
   `this.generationCounter++; const genPrng = this.prng.fork(\`gen-${this.generationCounter}\`)`
   ([src/world.ts:926-927](../../src/world.ts#L926)). `genPrng` picks the array length
   and forks every per-element PRNG via `genPrng.fork(\`[${i}]\`)`.
3. **`WorldImpl.generate`'s outer-wrapper optional/nullable roll** —
   `this.prng.fork(\`gen-wrap-${this.generationCounter + 1}\`)`
   ([src/world.ts:362](../../src/world.ts#L362)).

Two paths are **already** stable identity-based and must not regress:

- Registered primary records — `recordId = \`reg${effectiveRegId}#${recordIndex}\``
  ([src/world.ts:702](../../src/world.ts#L702)), where `recordIndex = registry.count(schema) + pending`.
- Registered derived records — `recordId = \`dreg${reg.regId}#${sourceIndex}\``
  ([src/world.ts:740](../../src/world.ts#L740)).

### Decision (Option B), pre-approved at the B27 review

The user chose **Option B** (replace counter with stable identity-based fork keys) over
Option A (rename + document the call-order semantics). The decision pre-dates this spec
and is **not re-litigated here**. This spec elaborates the Option B sketch from the B27
audit
([wiki/research/engine/generation-counter-d4-audit.md](../research/engine/generation-counter-d4-audit.md)
§"Option (b) — replace counter with stable identity-based fork keys") into testable
requirements and enumerates the test churn cost.

### How B39 composes with adjacent specs

- **B8 — derived-schemas identity**
  ([wiki/specs/B8-derived-schemas-identity.md](B8-derived-schemas-identity.md)).
  B8's upsert map keys on `(DerivedSchema, source-identity)` pairs — already pure
  identity, no counter. The B8-R9 short-circuit decrements `generationCounter` to
  preserve D9 (cache neutrality); under B39 that decrement becomes a per-schema
  counter rollback (still observable as "the hit consumes no per-schema slot"). The
  B8-R9 test
  ([tests/unit/core/derived-identity.test.ts:496-538](../../tests/unit/core/derived-identity.test.ts#L496))
  intentionally uses an unregistered ad-hoc schema to expose the counter dependence;
  it remains valid under B39 because the *intent* (the upsert hit must consume no
  per-world PRNG state) is preserved — only the bookkeeping shifts from a single
  global counter to a per-schema slot.
- **B10 — `{ store: false }` opt-out**
  ([wiki/specs/B10-generate-store-opt-out.md](B10-generate-store-opt-out.md)). B10-R7
  pins that `store: false` consumes no extra PRNG. The test pattern
  ([tests/unit/core/generate-store-opt-out.test.ts:382-406](../../tests/unit/core/generate-store-opt-out.test.ts#L382))
  uses an *ad-hoc* `AdHocSchema = z.object({ x: z.number().int() })` to compare
  worlds — exactly the path B39 changes. Under B39 the test still passes because
  both worlds make the same number of `generate(AdHocSchema)` calls in the same
  order: the per-schema slot indices match.
- **B14 — `populate` factory**
  ([wiki/specs/B14-world-populate-factory.md](B14-world-populate-factory.md)). B14's
  loops dispatch to `generateAndStorePrimary` / `generateDerivedRecord`, both
  already on the stable `reg{id}#{index}` / `dreg{id}#{sourceIndex}` paths. B39
  leaves `populate` untouched.

### Architecture's binding Rules apply unchanged

Per `wiki/architecture.md`'s Rules:

- D1 — no `any` in the new `WeakMap`/counter typing.
- D3 — Zod v4 internals stay accessed via `_zod.def`; B39 reads no schema internals.
- D4 — per-field PRNG determinism is preserved end-to-end; B39 **strengthens** D4's
  observable contract (B39-R7 promotes the rule). Adding/removing a field still does
  not disturb other fields — the existing scenario in
  [tests/unit/core/world.test.ts:633-642](../../tests/unit/core/world.test.ts#L633)
  ("adding a field does not change values of existing fields") MUST stay green.
- D5 — public-contract change in `docs/api-reference.md` lines 90 and 485 is mandatory
  (B39-R9).
- D6 — bug-fix regression test required; B39-R6 satisfies it.
- D8 — registered-storage equals returned. B39 does not change the
  storing helpers; D8 holds unchanged.
- D9 — cache short-circuits must be PRNG- and counter-neutral. The B8 upsert
  short-circuit currently decrements `generationCounter`; under B39 it MUST roll back
  the **per-schema** counter for the schema whose call would have advanced (B39-R4
  spells this out). D9 holds under the new model.

Item card:
[wiki/backlog/doing/B39-stable-identity-based-fork-keys.md](../backlog/doing/B39-stable-identity-based-fork-keys.md).
Predecessor: [B27](../backlog/done/B27-audit-generation-counter.md) (the audit). No
GitHub issue is attached to B39.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B39-R1: `world.generate(X)` is call-order-independent across distinct schemas

For two identically-seeded worlds with the same `withSchema` registrations, the Nth
`world.generate(X)` call on each world MUST produce **byte-identical** output
regardless of which other `world.generate(Y_i)` (or `world.populate(...)`) calls the
world made before that Nth call to `X`, for any `Y_i` whose identity differs from
`X`'s. "Byte-identical" is asserted via `JSON.stringify` deep equality on the returned
value. This MUST hold for:

- A single direct `world.generate(X)` on an unregistered (ad-hoc) `X`.
- `world.generate(X.array(...))` on an unregistered or registered `X` (array length
  and every per-element value are call-order-independent across distinct schemas).
- `world.generate(X.optional())` and `world.generate(X.nullable())` (the
  outer-wrapper roll deciding whether to emit `undefined`/`null` vs descend).

Registered primary records (B8-R9 / D4 today) remain stable as today. Two calls to
the **same** schema X on the same world MUST still produce different values per
call (the per-schema slot index increments per call), as today.

- Scenario: ad-hoc generate is call-order-independent
  GIVEN `AdHocSchema = z.object({ x: z.number().int(), y: z.string() })`, `OtherSchema = z.object({ z: z.number().int() })`, and two worlds `worldA = createWorld({ seed: 42 })` and `worldB = createWorld({ seed: 42 })`
  WHEN `worldA` calls `const a = worldA.generate(AdHocSchema)`, and `worldB` calls `worldB.generate(OtherSchema)` then `const b = worldB.generate(AdHocSchema)`
  THEN `JSON.stringify(a) === JSON.stringify(b)` — the intervening `generate(OtherSchema)` on `worldB` did not shift the value of `generate(AdHocSchema)`.

- Scenario: array generate is call-order-independent across distinct schemas
  GIVEN `ItemSchema = z.object({ id: z.uuid(), label: z.string() })`, `OtherSchema = z.object({ z: z.number().int() })`, and two worlds `worldA = createWorld({ seed: 42 })` and `worldB = createWorld({ seed: 42 })` (neither schema registered)
  WHEN `worldA` calls `const a = worldA.generate(z.array(ItemSchema).min(1).max(5))`, and `worldB` calls `worldB.generate(OtherSchema)` then `const b = worldB.generate(z.array(ItemSchema).min(1).max(5))`
  THEN `JSON.stringify(a) === JSON.stringify(b)` — both the array length and every element are byte-identical.

- Scenario: outer optional/nullable roll is call-order-independent
  GIVEN `MaybeSchema = z.object({ x: z.number().int() }).optional()`, `OtherSchema = z.object({ z: z.number().int() })`, and two worlds `worldA = createWorld({ seed: 42 })` and `worldB = createWorld({ seed: 42 })`
  WHEN `worldA` calls `const a = worldA.generate(MaybeSchema)`, and `worldB` calls `worldB.generate(OtherSchema)` then `const b = worldB.generate(MaybeSchema)`
  THEN `JSON.stringify(a) === JSON.stringify(b)` (both `undefined`, or both the same object). The outer-wrapper roll's outcome (skip-to-`undefined` vs descend-into-array/object) is byte-identical, **and** when both descend, the inner value is byte-identical too.

- Scenario: two calls to the same schema on one world still differ per call
  GIVEN `AdHocSchema = z.object({ x: z.number().int() })` and `const world = createWorld({ seed: 42 })`
  WHEN the consumer calls `const a = world.generate(AdHocSchema)` then `const b = world.generate(AdHocSchema)`
  THEN `JSON.stringify(a) !== JSON.stringify(b)` — the per-schema slot index advanced between the two calls, so the PRNG fork keys differ.

### B39-R2: registered primary and derived paths byte-identical to today

Calls that today hit `generateAndStorePrimary` (registered-primary path) or
`generateDerivedRecord` via the registered-derived path MUST produce
byte-identical output to today. Specifically: the `recordId` constructed at
[src/world.ts:702](../../src/world.ts#L702) (`reg{id}#{index}`) and
[src/world.ts:740](../../src/world.ts#L740) (`dreg{id}#{sourceIndex}`) MUST NOT
change shape, and `populate`'s loop output MUST stay byte-equivalent across runs of
the same seed and same registration order. This is the B27-audit guarantee that B39
MUST NOT regress.

- Scenario: registered-primary `populate` output is byte-equivalent across B39
  GIVEN a baseline registry snapshot captured pre-B39 — `BASELINE = JSON.stringify(createWorld({ seed: 42 }).withSchema(PersonSchema).populate(PersonSchema, 5).registry.all(PersonSchema))`
  WHEN the same call is run after B39 — `AFTER = JSON.stringify(createWorld({ seed: 42 }).withSchema(PersonSchema).populate(PersonSchema, 5).registry.all(PersonSchema))`
  THEN `AFTER === BASELINE` — `populate(PersonSchema, 5)` produces byte-identical records before and after B39. The existing test [tests/unit/core/populate-factory.test.ts:161-179](../../tests/unit/core/populate-factory.test.ts#L161) ("B14-R4 / no-factory call is byte-equivalent across two same-seed worlds") MUST stay green.

- Scenario: registered-derived `populateFrom` output is byte-equivalent across B39
  GIVEN a baseline derived-bucket snapshot captured pre-B39 from a `world.populateFrom(SummarySchema, OrderSchema, ...)` setup
  WHEN the same call is run after B39
  THEN the registry contents (`registry.all(SummarySchema)`) are `JSON.stringify` byte-identical. The existing test [tests/unit/core/world-populate-from.test.ts:444-463](../../tests/unit/core/world-populate-from.test.ts#L444) (B13-R7) MUST stay green.

### B39-R3: the new fork-key shape — `WeakMap<ZodTypeAny, number>` schema ID + per-schema call counter

The implementation MUST introduce two new private fields on `WorldImpl`:

```ts
/**
 * B39 — stable per-schema integer ID assigned the first time we see each
 * `ZodTypeAny` reference. Held in a `WeakMap` so schemas are not retained
 * past their natural lifetime.
 */
private readonly schemaIds: WeakMap<ZodTypeAny, number> = new WeakMap();
private nextSchemaId = 0;

/**
 * B39 — per-schema call index, advanced exactly once at each top-level
 * `generateSingleItem` / `generateArray` / outer-wrapper roll site. Keyed
 * by the same `ZodTypeAny` reference the call was made with.
 */
private readonly schemaCallCounts: WeakMap<ZodTypeAny, number> = new WeakMap();
```

And a private helper:

```ts
private nextSchemaSlot(schema: ZodTypeAny): { id: number; slot: number } {
  let id = this.schemaIds.get(schema);
  if (id === undefined) {
    id = this.nextSchemaId++;
    this.schemaIds.set(schema, id);
  }
  const slot = (this.schemaCallCounts.get(schema) ?? 0) + 1;
  this.schemaCallCounts.set(schema, slot);
  return { id, slot };
}
```

Shape (i) — `WeakMap<ZodTypeAny, number>` — is the chosen identity model.

**Why not shape (ii) — strong `Map<ZodTypeAny, number>`:** semantically equivalent
but holds strong references to every schema the world ever saw, which leaks for
worlds long-lived in a dev server. `WeakMap` releases the entries naturally when
the schema goes out of scope. The cost of (ii) is unbounded memory growth for no
behavioural benefit.

**Why not shape (iii) — `schema._zod.def` identity (per D3):** `_zod.def` is a fresh
object created per schema instance (verified by reading `src/world.ts`'s existing
`def(...)` accessor and `src/prng.ts` neighbours), so two `z.object({...})` calls
with the same shape produce two `_zod.def` objects with no shared identity. Worse,
schemas built via `z.lazy(...)` resolve to a fresh inner def per resolution unless
cached (the existing `lazyCache` in `src/world.ts:351` handles this for `lazy`
specifically, but B39 cannot assume every entry point goes through that cache).
Reference identity on the outer `ZodTypeAny` is the only safe stable handle.

The `schemaIds` / `schemaCallCounts` maps MUST be scoped to a single world instance
(constructed inside `WorldImpl`'s constructor). A new `createWorld({ seed })` MUST
start with empty maps (no cross-world leakage, mirroring B8's `derivedUpsert` and
the existing `relationPools` / `lazyCache` discipline).

- Scenario: `schemaIds` does not leak across worlds
  GIVEN `AdHocSchema = z.object({ x: z.number().int() })`, and two independently constructed worlds `const worldA = createWorld({ seed: 1 })` and `const worldB = createWorld({ seed: 1 })`
  WHEN both worlds call `world.generate(AdHocSchema)`
  THEN both values are byte-identical (`JSON.stringify` equal), because each world assigns `AdHocSchema` its own `schemaId` (the integer is private; what matters is that the **fork key** `adhoc:0:1` on each world is the same and thus produces the same PRNG fork).

- Scenario: the per-schema slot increments per call on the same world
  GIVEN `AdHocSchema = z.object({ x: z.number().int() })` and `const world = createWorld({ seed: 1 })`
  WHEN the consumer calls `world.generate(AdHocSchema)` three times in a row, capturing the three returned `x` values as `[x1, x2, x3]`
  THEN `x1`, `x2`, `x3` are pairwise distinct (`new Set([x1, x2, x3]).size === 3`) — proving the per-schema slot advanced to 1, 2, 3 respectively, producing different PRNG forks.

### B39-R4: migrate the three counter-fork-key call sites in `src/world.ts`

Each of the three call sites MUST be migrated to use `nextSchemaSlot(...)`-derived
keys. The key shapes MUST be exactly as specified below (the test-writer will pin
these strings via the call-order-independence scenarios in B39-R1 — the strings
themselves are not part of the public surface, but their shape is fixed by this spec
so the implementer cannot drift).

**Site 1 — ad-hoc `generateSingleItem` ([src/world.ts:1180](../../src/world.ts#L1180)):**

```ts
// Before:
const recordId = `adhoc-${this.generationCounter}`;
const adHocPrng = this.prng.fork(recordId);

// After:
const { id, slot } = this.nextSchemaSlot(schema);
const recordId = `adhoc:${id}:${slot}`;
const adHocPrng = this.prng.fork(recordId);
```

The `schema` parameter is the one already in scope on `generateSingleItem` —
the *outer* schema reference the caller invoked `generate(...)` with (not
`targetSchema` after `lazy` resolution). Using the outer reference preserves
identity even when `z.lazy(() => X)` re-resolves: the call always uses the same
key for the same outer reference.

**Site 2 — `generateArray` ([src/world.ts:927](../../src/world.ts#L927)):**

```ts
// Before:
this.generationCounter++;
const genPrng = this.prng.fork(`gen-${this.generationCounter}`);

// After:
const { id, slot } = this.nextSchemaSlot(arraySchema);
const genPrng = this.prng.fork(`array:${id}:${slot}`);
```

The `arraySchema` parameter (already in scope) is the outer `ZodArray` reference
passed in. `innerSchema` MUST NOT be the identity used here — keying on the inner
element type would coalesce `z.array(X).min(3)` and `z.array(X).max(5)` into the
same slot bucket, regressing today's behaviour where they are independent calls.

**Site 3 — outer-wrapper roll in `WorldImpl.generate` ([src/world.ts:362](../../src/world.ts#L362)):**

```ts
// Before:
const prng = this.prng.fork(`gen-wrap-${this.generationCounter + 1}`);
// … inside the loop: this.generationCounter++ on a skip
// After:
const { id, slot } = this.nextSchemaSlot(schema);
const prng = this.prng.fork(`wrap:${id}:${slot}`);
// no counter mutation on skip — the slot was already consumed by nextSchemaSlot
```

The outer `schema` parameter is the original schema the caller passed to
`world.generate(...)`. The current `this.generationCounter++` on a skip
([src/world.ts:366](../../src/world.ts#L366)) is removed — `nextSchemaSlot` has
already advanced the per-schema slot; no second mutation is needed (the slot
advance is what gives subsequent calls on the same schema a distinct key).

**`WorldImpl.generationCounter`'s fate.** The field has one remaining consumer
after B39: the derived-without-source pair picker at
[src/world.ts:1171](../../src/world.ts#L1171) (`idx = (counter - 1) % pairs.length`),
which uses the counter as a round-robin index across `pairs`. Per the B27 audit
this use is **intentional** (documented "cycle through sources" derived behaviour)
and **out of scope** for B39 — B39 only fixes the fork-key uses, not the
round-robin. Two options for the field itself:

- **(a) Keep the global counter** for the round-robin pair picker only; rename
  it to `derivedPairCounter` to signal it is no longer a generation-wide call
  counter. `generateSingleItem` still increments it at the top so the
  derived-without-source path observes the same cycling sequence as today.
  Site 1 / Site 2 / Site 3 no longer read it. The B8-R9 `counter--` rollback
  on the upsert short-circuit stays in place (still required to keep the
  pair picker stable when an upsert hit short-circuits a `generateSingleItem`
  call).

- **(b) Move the counter into a per-derived-pair-list counter** keyed on the
  identity of the derived-regs vector. Functionally identical to (a) for
  current use, more disciplined, but a larger refactor.

**Adopted: (a) — keep the global counter, rename to `derivedPairCounter`.**
Rationale: smaller change, preserves the documented derived round-robin contract,
and B23 / B24 / B28's future decomposition of `generateSingleItem` / `generateArray`
can absorb option (b) later if desired.

- Scenario: site 1 — ad-hoc fork key shape
  GIVEN `AdHocSchema = z.object({ x: z.number().int() })` and a world `const world = createWorld({ seed: 7 })`
  WHEN the consumer calls `world.generate(AdHocSchema)` for the first time on this world
  THEN the value produced equals what the world would produce if it ran `this.prng.fork('adhoc:0:1')` and used that as the ad-hoc PRNG — verifiable by an in-test reconstruction that mirrors the implementation's fork-key formula. (This scenario is the implementer's pinning anchor; the test-writer MAY assert the cross-world equality of B39-R1 rather than the literal string, but the implementation MUST produce these key shapes.)

- Scenario: site 2 — array fork key shape
  GIVEN `ItemSchema = z.object({ id: z.uuid() })`, `ArraySchema = z.array(ItemSchema).length(3)`, and a fresh world `const world = createWorld({ seed: 7 })`
  WHEN the consumer calls `world.generate(ArraySchema)` for the first time on this world
  THEN the array length and per-element values are produced via `this.prng.fork('array:<id>:1')` where `<id>` is the integer assigned to `ArraySchema` (and NOT to `ItemSchema`).

- Scenario: site 3 — outer-wrap fork key shape
  GIVEN `Schema = z.array(z.object({ x: z.number().int() })).optional()` and a fresh world `const world = createWorld({ seed: 7 })`
  WHEN the consumer calls `world.generate(Schema)` for the first time on this world
  THEN the optional/nullable skip-vs-descend decision is produced via `this.prng.fork('wrap:<id>:1')` where `<id>` is the integer assigned to the **outer** `Schema` reference (the `.optional()` wrapper), NOT to the inner array.

- Scenario: D9 — B8 upsert short-circuit still neutralises the slot it consumed
  GIVEN the B8-R9 test setup ([tests/unit/core/derived-identity.test.ts:496-538](../../tests/unit/core/derived-identity.test.ts#L496))
  WHEN the upsert short-circuit fires
  THEN no per-schema slot has been observably consumed on `WorldImpl` for the schema whose `generateSingleItem` would have run (the implementer MUST roll back the `schemaCallCounts` entry the bypassed `generateSingleItem` would have advanced — equivalent to today's `generationCounter--`, but on the new map). The B8-R9 test MUST stay green.

### B39-R5: snapshot-churn enumeration (the load-bearing user-facing risk)

The full test suite was searched for every assertion that pins a specific
PRNG-derived value on the three counter-bearing paths (ad-hoc `generateSingleItem`,
`generateArray`, outer-wrapper roll). Searches performed:

- `Grep "toMatchSnapshot"` over `tests/` — **0 results.** The codebase uses no
  vitest snapshot files; nothing in `__snapshots__/` to re-pin.
- `Grep "JSON.stringify"` over `tests/` — 18 hits, all comparing two
  independently constructed same-seed worlds against each other (cross-world
  byte-equivalence pattern). These are robust under B39 because both worlds make
  the same call sequence and assign matching schema IDs in matching order, so
  the new fork keys agree on both sides.
- `Grep "toEqual\(\["` and `Grep "toBe\(\d` over `tests/` — every match pins
  either a matcher-returned value, a constraint-derived value (`% 100 === 0`,
  length, range), an override-derived value, or a count.
- `Grep "world\.generate\(" + array` over `tests/` — every array-result
  assertion uses `toHaveLength`, `.length`, `>=`/`<=` constraint checks, or
  `safeParse(item).success` (structural), never a specific generated value.

**Total snapshot churn estimate**: **0 tests need re-pinning** (R), **0 tests need
loosening** (L). The 906-ish tests in the suite are **untouched** (K) because the
codebase has consistently used structural assertions, cross-world byte-equivalence,
or matcher/override-pinned values rather than byte-pinning PRNG-derived output of
ad-hoc / array / outer-wrap generation.

**Estimated test-suite LOC churn**: ~0 lines of existing test changes; B39-R6 adds
**~40-60 new LOC** of regression tests pinning the call-order-independence
invariant.

Detailed enumeration (every file that mentions `world.generate(` was inspected;
findings classified):

| Path | What it asserts | Classification | Reason |
|------|------|----------------|--------|
| `tests/unit/core/world.test.ts:300-304` ("same seed → same array") | `r1.toEqual(r2)` for two fresh-world `setup().generate(z.array(PersonSchema).length(3))` calls | **K** | Both worlds make the same single call → same per-schema slot → byte-identical under B39. |
| `tests/unit/core/world.test.ts:308` | `world.generate(z.array(PersonSchema))).toHaveLength(3)` | **K** | Structural (length assertion only). |
| `tests/unit/core/world.test.ts:327-340` (optional/nullable array distribution) | 30 worlds, each calls once; asserts both `undefined` AND array variants appear | **K** | 30 different seeds (`createWorld({ seed: i })`); the new fork key `wrap:<id>:1` differs per-seed → distribution preserved. |
| `tests/unit/core/world.test.ts:621-642` (determinism describe block) | Two fresh-world equality; field-add invariance | **K** | Per-field determinism preserved; cross-world calls are 1:1 matching. |
| `tests/unit/core/world.test.ts:750-758` (overrides on array) | `result[0].val).toBe(999)` from `overrides[0].val: 999` | **K** | Override-derived, not PRNG-derived. |
| `tests/unit/core/derived-identity.test.ts:496-538` (B8-R9 ad-hoc lockstep) | Cross-world `JSON.stringify(aNext) === JSON.stringify(bNext)` on `worldA.generate(AdHocSchema)` vs `worldB.generate(AdHocSchema)` after an upsert hit on `worldB` | **K** | The test's purpose is exactly the call-order invariant B39 enforces. Both worlds make one `generate(AdHocSchema)` call after the same sequence of `UserProfileSchema` generations — under B39 the upsert short-circuit MUST rollback the `schemaCallCounts` entry (B39-R4 D9 scenario) so both worlds end with `schemaCallCounts.get(AdHocSchema) === 1` → same fork key → same value. |
| `tests/unit/core/generate-store-opt-out.test.ts:382-406` (B10-R7 lockstep) | Two worlds; one with `store: false`, one without; both end with `worldA.generate(AdHocSchema)` and `worldB.generate(AdHocSchema)` and assert equality | **K** | Same as above — both worlds make 1 `generate(AdHocSchema)` call. Under B39 both produce the same key `adhoc:<id>:1`. |
| `tests/unit/core/populate-factory.test.ts:161-179, 192-209` (B14 byte-equivalence) | `populate` byte-equivalence across two same-seed worlds | **K** | `populate` uses the registered-primary path (`reg{id}#{index}`), counter-independent today and tomorrow. |
| `tests/unit/core/world-populate-from.test.ts:444-463` (B13-R7 byte-equivalence) | `populateFrom` byte-equivalence across two same-seed worlds | **K** | Registered-derived path (`dreg{id}#{sourceIndex}`), unaffected. |
| `tests/unit/store-false-empty-from.test.ts:284-305` (B20 auto-provisioned source byte-equivalence) | `JSON.stringify(a) === JSON.stringify(c)` where `a` is `worldA.generate(Source)` after a `store: false` derived call and `c` is `worldC.registry.all(Source)[0]` after `worldC.populate(Source, 1)` | **K** | The compared values both flow through `generateAndStorePrimary` (`reg{id}#{index}`); see B20-R6 rationale. |
| `tests/unit/primary-array-overrides-throw.test.ts:146-162` (B38-R2 byte-equivalence) | Two fresh worlds, both call `generate(SimpleProductSchema.array().min(4).max(4))` once | **K** | Both worlds make the same single call; the new array fork key matches on both sides. |
| `tests/unit/primary-array-overrides-throw.test.ts:186-221` (B38-R3 ad-hoc array overrides) | `items.map(it => it.label)).toEqual(["first", "second", "third"])` — `label` from overrides | **K** | Override-derived. The `id` field is only checked for `typeof === "string"` and length > 0 (structural). |
| `tests/integration/invoicing/invoicing.test.ts:140-148` (price multiples) | `line.unitPriceCents % 100 === 0` over many lines | **K** | Constraint-driven (matcher emits step-100 prices); structural. |
| `tests/integration/invoicing/invoicing.test.ts:175-201` (determinism) | `a.toEqual(b)` for two same-seed builds; `inv.totalCents === expected` arithmetic invariant | **K** | Two-world cross-equality + matcher-driven invariant. |
| `tests/integration/media-library/media-library.test.ts:120-130, 220-230` | type-tag matchers (`expect(r.type).toBe("text")`) and status filter `expect(r.status).toBe("failed")` | **K** | All assertions are matcher-derived or filter-derived; no specific PRNG bytes pinned. |
| `tests/integration/document-corpus/document-corpus.test.ts:160-161` | Comparing `world1.generate(z.array(DocumentSchema).length(3))` to `world2.generate(z.array(DocumentSchema).length(3))` | **K** | Cross-world same-call lockstep. |
| `tests/integration/nested-matchers.test.ts:30-57` | Matcher-pinned values like `"MATCHED STREET"`, `99999`, `12345` | **K** | Matcher-derived. |
| `tests/integration/overrides-in-matchers.test.ts` | Override-pinned values | **K** | Override-derived. |
| `tests/integration/inline-schema.test.ts` | Structural assertions | **K** | Structural. |
| `tests/integration/scenarios/cascading-schemas.test.ts:48-82` | Matcher-pinned values (`"MATCHED_ENTERPRISE"`, etc.) | **K** | Matcher-derived. |
| `tests/unit/bug-hunt.test.ts:48-58` (default-variety) | `world.generate(schema)` 20× on same world, asserts `new Set(...).size > 1` | **K** | Variety still produced (per-schema slot advances per call → different fork keys → different values). |
| `tests/unit/generators/domains/collection.test.ts:40-65` (determinism) | Cross-world `a === b` style asserts on per-element arrays | **K** | Cross-world same-call lockstep. |
| All `tests/unit/core/relations.test.ts` array calls | `toHaveLength(N)`, `length === N`, structural | **K** | Structural. |
| All `tests/unit/core/cross-api.test.ts` array calls | Cross-API matcher-driven assertions | **K** | Matcher-derived (the test's whole purpose). |
| All `tests/unit/core/subject.test.ts` array calls | `toHaveLength(N)` and matcher-driven content | **K** | Structural / matcher-derived. |

**Headline finding**: the codebase has been disciplined about never pinning
PRNG-derived bytes on the three counter-bearing paths. The B39 behaviour change
**costs zero test re-pins** in this repo. Downstream consumers who snapshot
their own generated output across the counter-bearing paths will need to re-pin
(see B39-R8 changeset rationale).

- Scenario: full test suite green after migration
  GIVEN B39 implemented end-to-end (B39-R1 through B39-R4 + B39-R6 added)
  WHEN `pnpm test` is run
  THEN it exits 0 with all existing tests still green and the new B39-R6 regression tests green. No `.toBe`/`.toEqual` value was rewritten in any pre-existing test.

### B39-R6: regression tests pinning the call-order-independence invariant (D6)

A new test file `tests/unit/core/call-order-independence.test.ts` (or equivalent
location, at the test-writer's discretion) MUST be added and MUST contain at least
one failing-before-fix test for each of the three counter-bearing paths. The
failing-before-fix property MUST be verifiable by running the new tests against
HEAD prior to B39's implementation — every B39-R1 scenario MUST fail on the
pre-B39 code (which is exactly the soft-D4-violation the audit confirmed) and
MUST pass after B39's implementer migrates the three sites. This is the **D6**
regression test the bug requires.

- Scenario: ad-hoc call-order regression test
  GIVEN the test file at `tests/unit/core/call-order-independence.test.ts` containing the B39-R1 ad-hoc scenario as a vitest `it(...)` block
  WHEN the test is run against the codebase **before** B39's implementer migrates site 1
  THEN it FAILS (`JSON.stringify(a) !== JSON.stringify(b)` — the counter shift produced different ad-hoc values).
  AND WHEN the test is run after B39's implementer migrates site 1
  THEN it PASSES.

- Scenario: array call-order regression test
  GIVEN the test file containing the B39-R1 array scenario
  WHEN the test is run against the codebase **before** B39's implementer migrates site 2
  THEN it FAILS (the array's length and/or per-element values diverge between the two worlds).
  AND WHEN the test is run after B39's implementer migrates site 2
  THEN it PASSES.

- Scenario: outer-wrapper call-order regression test
  GIVEN the test file containing the B39-R1 outer-wrapper scenario
  WHEN the test is run against the codebase **before** B39's implementer migrates site 3
  THEN it FAILS (the outer-wrapper skip-vs-descend decision diverges).
  AND WHEN the test is run after B39's implementer migrates site 3
  THEN it PASSES.

### B39-R7: standing constraint promoted to `wiki/architecture.md` Rules + ADR D10

A new ADR entry D10 MUST be appended to
[wiki/decisions.md](../decisions.md) with the exact text below, and a new
one-line rule MUST be added by the manager to
[wiki/architecture.md](../architecture.md)'s Rules section (after the D9 rule
line). The rule line text:

> Generation determinism MUST be per-(seed + schema identity + per-schema call
> index); call order across distinct schemas MUST NOT affect any value. (→ D10)

The ADR text:

```
## D10: Generation determinism is per-(seed + schema identity + per-schema call index)

- **Date**: 2026-05-29
- **By**: spec-writer (B39) / manager promotion on item land
- **Context**: D4 historically meant "per-field `fork(key)` so adding/removing a
  field does not disturb other fields", which held in the letter. B22's
  codebase-complexity audit and B27's targeted audit
  (`wiki/research/engine/generation-counter-d4-audit.md`) surfaced that the unwritten
  spirit — "seed alone determines values" — was incompletely realised: three
  call sites in `WorldImpl` (`generateSingleItem` ad-hoc, `generateArray`, and
  the outer-wrapper optional/nullable roll in `WorldImpl.generate`) derived
  their PRNG fork keys from a per-world `generationCounter` rather than from a
  stable schema identity. The result: inserting a stray
  `world.generate(SomethingElse)` earlier in a session shifted the value of
  every subsequent ad-hoc, array, or outer-optional generation. B39 fixes the
  three sites and promotes the strengthened invariant to a binding rule.
- **Decision**: Generation determinism is contracted on **(seed + schema
  identity + per-schema call index)**. Two identically-seeded worlds with the
  same `withSchema`/`withGenerators` chain produce byte-identical output for
  the Nth `world.generate(X)` call regardless of which other
  `world.generate(Y_i)` (for `Y_i !== X`) calls happened in between. The
  per-schema call index is held on a private `WeakMap<ZodTypeAny, number>` in
  `WorldImpl`; the fork-key shapes are `adhoc:<id>:<slot>`,
  `array:<id>:<slot>`, and `wrap:<id>:<slot>`. Registered-primary and
  registered-derived paths (`reg{id}#{index}` / `dreg{id}#{sourceIndex}`) are
  unchanged — they were already on stable identity-based keys.
- **Consequences**: The published docs change from "same seed and same
  builder chain" / "deterministic for a given seed and call sequence" to
  "deterministic for a given seed and the per-schema call sequence"
  (`docs/api-reference.md` lines 90 and 485 — see B39-R9). Downstream
  consumers who snapshot their generated values across the three
  counter-bearing paths will see those values shift once on the upgrade
  (B39-R8 framed this as a `major` bump originally; revised to `minor` for 0.x SemVer convention). Future cache layers MUST honour
  this rule: a cache hit MUST consume no `schemaCallCounts` slot (D9 still
  applies, now on a per-schema slot rather than a global counter). The
  `WorldImpl.generationCounter` field is renamed to `derivedPairCounter`
  and is read only by the derived-without-source pair picker; the rename
  signals the field's remaining purpose.
- **Rule added/changed**: "Generation determinism MUST be per-(seed + schema
  identity + per-schema call index); call order across distinct schemas MUST
  NOT affect any value." Promoted to architecture.md by the manager when B39
  lands.
- **Supersedes**: none (extends D4; coexists with D9).
```

This requirement is **discharged by writing the ADR text into
`wiki/decisions.md` in the implementer's commit** — the spec-writer cannot
edit architecture.md's Rules section (per the spec-writer's "Rules" section
rules: manager owns rule promotion). The reviewer confirms the ADR is in
place; the manager promotes the rule line when the item moves to `done/`.

- Scenario: ADR D10 lands in `wiki/decisions.md`
  GIVEN B39 has been implemented and committed
  WHEN `wiki/decisions.md` is read
  THEN it contains a new `## D10:` block matching the text above, including the literal title "Generation determinism is per-(seed + schema identity + per-schema call index)" and the "Rule added/changed" line ready for the manager's architecture.md promotion.

### B39-R8: changeset bump — `minor` (revised; was `major`)

A changeset MUST be created at
`.changeset/b39-stable-identity-based-fork-keys.md` recording B39 as a
`"zod4-mock": minor` bump with a user-facing summary covering: (a) the
behavioural change — `world.generate(X)` is now order-independent of
intervening `generate(Y)` calls on distinct schemas; (b) the value shift for
ad-hoc / array / outer-wrap generation when seeds + builder chains stay the
same but a call was previously order-sensitive; (c) the unchanged paths —
registered-primary and registered-derived (`populate`, `populateFrom`,
`generate(RegisteredSchema)`); (d) the docs rewording at
`docs/api-reference.md` lines 90 and 485; (e) the recommended downstream
upgrade flow (re-snapshot any tests that pin specific bytes from the three
counter-bearing paths).

**Bump revised from `major` to `minor` post-implementation.** The original
B27 audit framing recommended `major` because the PRNG sequence is part of
the published `docs/api-reference.md` deterministic contract. That reasoning
holds — but under SemVer 0.x, breaking changes are conventionally `minor`
bumps; `major` is reserved for the deliberate 1.0.0 commitment to API
stability. With multiple open items still in flight (B42 Markov quality,
B43 primary-array `.min/.max`, B28 `world.ts` split, B41 populate dispatch
divergence), 1.0.0 is premature. Landing this as `minor` produces a
`0.7.x → 0.8.0` bump that honestly signals "behaviour shifted" without
locking in API stability.

The downstream-consumer guidance from the original `major` framing is
unchanged: re-snapshot any tests that pin specific bytes from the three
counter-bearing paths.

The changeset MUST include `(closes #N)` only if the item card carries a
GitHub issue number — the card does not, so the changeset MAY omit the
issue reference.

- Scenario: changeset file exists and is shaped as `minor`
  GIVEN B39 has been implemented
  WHEN `.changeset/b39-stable-identity-based-fork-keys.md` is read
  THEN its frontmatter declares `"zod4-mock": minor`, the body summarises the contract change and the downstream upgrade flow, and a final non-empty line either references the issue (`(closes #N)`) or is the final summary line (no issue exists on the card, so the issue reference is optional here).

### B39-R9: `docs/api-reference.md` updated in the same step (D5)

The public-contract phrasing at
[docs/api-reference.md:90](../../docs/api-reference.md#L90) and
[docs/api-reference.md:485](../../docs/api-reference.md#L485) MUST be revised to
reflect the strengthened contract:

- Line 90 — the `seed` entry's tagline currently reads:
  > "master seed for all generation in this world. The same seed with the
  > same builder chain always produces byte-identical output."

  MUST become (proposed text — exact wording is the implementer's, but the
  contract MUST be the strengthened one):
  > "master seed for all generation in this world. The same seed with the
  > same builder chain and the same per-schema call sequence always produces
  > byte-identical output. Call order across distinct schemas does not
  > affect any value: `world.generate(X); world.generate(Y)` and
  > `world.generate(Y); world.generate(X)` produce the same `X` and the
  > same `Y` either way."

- Line 485 — the `world.get` determinism note currently reads:
  > "`get` is deterministic for a given seed and call sequence and
  > idempotent for a repeated predicate"

  MUST become:
  > "`get` is deterministic for a given seed and the per-schema call sequence
  > and idempotent for a repeated predicate"

The "same builder chain" wording at line 90 remains — it is still required
(reordering `withSchema(X)` vs `withSchema(Y)` *can* affect values because
it shifts which regId each schema gets, which feeds the registered-primary
fork key shape). Only the "call sequence" framing changes.

`docs/concepts.md:171` ("same builder chain") MAY be updated for consistency
but is non-binding under this requirement — the change to
`docs/api-reference.md` is the contract surface.

- Scenario: docs reflect the strengthened contract
  GIVEN B39 has been implemented
  WHEN `docs/api-reference.md` is read at lines 90 and 485
  THEN line 90's `seed` entry mentions per-schema call sequence and explicitly states call-order independence across distinct schemas; line 485's `world.get` note reads "deterministic for a given seed and the per-schema call sequence and idempotent for a repeated predicate".

### B39-R10: opportunistic CLAUDE.md drift fix

`CLAUDE.md` line 52 currently reads:
> "**PRNG** — Mulberry32 seeded PRNG with FNV-1a hashing for per-field
> `fork(key)` derivation"

The PRNG was migrated from Mulberry32 to SFC32 (per
[src/prng.ts:13](../../src/prng.ts#L13) and the B27 audit §"Out of scope"
note). The B27 reviewer flagged this drift. B39's commit MUST update
CLAUDE.md line 52 to read:
> "**PRNG** — SFC32 seeded PRNG with FNV-1a hashing for per-field
> `fork(key)` derivation"

This is an opportunistic fix folded into B39's commit because the
documentation pass already touches the same conceptual area (the PRNG and
its determinism contract). It is NOT a separate item.

The same drift in
[wiki/codebase-map.md](../codebase-map.md) (Mulberry32 mention, per the B27
audit) MAY be updated in the same commit; the manager will route a
`/wiki-sync` if any drift remains after B39.

- Scenario: CLAUDE.md PRNG mention is current
  GIVEN B39 has been committed
  WHEN `CLAUDE.md` line 52 is read
  THEN it reads "SFC32 seeded PRNG with FNV-1a hashing for per-field `fork(key)` derivation", matching `src/prng.ts`'s docstring.

## Out of scope

- **Touching the B8 upsert map** — already keyed by source identity
  ([src/world.ts:168](../../src/world.ts#L168) and `:1096`); no change.
- **Touching `generateAndStorePrimary` / `populate` / `populateFrom`** — already
  use stable `reg{id}#{index}` / `dreg{id}#{sourceIndex}` keys; no change.
- **Decomposing `generateSingleItem` / `generateArray`** — that is B24 / B25's
  job; B39 lands the strengthened discipline first so the refactor inherits it.
- **Touching `src/prng.ts`** — only the fork-key *inputs* change (the keys passed
  to `prng.fork(...)`); the PRNG algorithm, the hash function, and the
  `Prng.fork(key)` API are unchanged.
- **Adding a public API to control the per-schema counter** — none needed; the
  counter is a private implementation detail.
- **Removing `WorldImpl.generationCounter` entirely** — the field is renamed to
  `derivedPairCounter` (B39-R4 option (a)) and retained for the
  derived-without-source round-robin pair picker
  ([src/world.ts:1171](../../src/world.ts#L1171)). The B27 audit explicitly
  documents that this single use is intentional and contract-bound; B39 leaves
  it alone.
- **Composite schema-identity keys** (e.g. hashing schema shape) — reference
  identity on the outer `ZodTypeAny` is sufficient and matches B8's identity
  model. A future item MAY refine if a real call site requires shape-based
  identity.
- **Re-snapshotting downstream consumers** — out-of-repo concern; documented in
  the B39-R8 changeset rationale.
- **Updating `wiki/codebase-map.md`'s Mulberry32 mention** — MAY be folded
  opportunistically per B39-R10's last paragraph, but is not asserted as a
  scenario.

## Open questions

- **Key shape (i) `WeakMap` vs (ii) strong `Map` vs (iii) `_zod.def` identity —
  Non-blocking.** Adopted as **(i) `WeakMap<ZodTypeAny, number>`** in B39-R3.
  Rationale captured in B39-R3 body. Recorded, not blocking.

- **`generationCounter` rename — Non-blocking.** Adopted as
  **`derivedPairCounter`** per B39-R4 option (a). The audit also recommended
  this rename as part of Option (a); B39 inherits it. Recorded, not blocking.

- **Changeset bump (`major` vs `minor`) — Non-blocking.** Adopted as **`major`**
  per B39-R8. The B27 audit framed Option (b) as major-version territory; the
  zero in-repo test churn does not weaken that argument because
  `docs/api-reference.md`'s public contract phrasing is the SemVer surface.
  Recorded, not blocking.

- **Opportunistic CLAUDE.md drift fix folded into the same commit — Non-blocking.**
  Adopted (B39-R10) — it is a one-line change in a documentation area already
  touched by the rule promotion. Recorded, not blocking.

- **Whether to also update `wiki/codebase-map.md`'s Mulberry32 mention — Non-blocking.**
  Recorded under Out of scope as `MAY`. Reviewer's call; not a B39 requirement.

No blocking open questions remain; the spec can advance to `test-writer`.
