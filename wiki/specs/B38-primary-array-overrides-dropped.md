# B38: BUG — `world.generate(primaryArraySchema, { overrides })` silently drops per-index overrides

## Context

GitHub issue [#22](https://github.com/dxlbnl/zod4-mock/issues/22). User-classified
**Mid** severity — silent failure: the call returns a plausible-looking array, but
the per-index `overrides` are never applied to the records and (on a second call) no new
records are added either, so an unrelated downstream test fails for the wrong reason.

The bug lives in `WorldImpl.generateArray`
([src/world.ts:917-1024](../../src/world.ts#L917)), in the **primary-mode** arm
(`primaryRegs.length > 0`, lines 968–984):

```ts
if (primaryRegs.length > 0) {
  const reg = primaryRegs[0]!;
  const existingCount = this.registry.count(innerSchema);
  const target = Math.max(existingCount, genPrng.int(...));
  while (this.registry.count(innerSchema) < target) {
    this.generateAndStorePrimary(innerSchema, reg);
    //   ↑ no options, no overrides, no per-position info
  }
  return this.registry.all(innerSchema);
}
```

Two compounded effects (verified during `/intake` and re-verified here against current
`src/world.ts`):

1. **Per-index overrides aren't passed through.** `generateAndStorePrimary(innerSchema, reg)`
   is called with no `options` argument, even though
   `generateAndStorePrimary(schema, reg, options?)` already accepts `GenerateOptions`
   today (line 691; it is the third parameter the `populate` factory threads through). So
   `options.overrides[i]` from the outer `generateArray` call never reaches the
   field generator. There is no equivalent of the ad-hoc branch's
   `result.map((item, i) => deepMerge(item, overrides[i]))` (lines 1011–1017).
2. **`existingCount` short-circuits the top-up loop.** `target = max(existingCount, …)`
   means a **second** call with `existingCount >= target` does nothing observable: no
   records are added (the `while` exits immediately), and no overrides are applied to
   the existing records either. The function returns
   `this.registry.all(innerSchema)` — exactly what was already there.

The repro on the item card walks straight into both effects: three loop iterations of
`world.generate(ProductSchema.array().min(4).max(4), { overrides: Array(4).fill({ category }) })`
end with **4** products in the registry instead of **12**, none with `category` set by
the caller.

### Existing safe alternative

`world.populate(schema, count, factory)` ([B14](B14-world-populate-factory.md), shipped
in 0.7.0; see also `docs/api-reference.md` `.populate` subsection) is the **right** API
for this use case. Each factory return flows through `generateAndStorePrimary` with the
factory's `GenerateOptions` (`src/world.ts` lines 254–280) — overrides land per record,
records accumulate per call, and the contract is "write `count` more records to the
registry," which is exactly what the bug's caller wanted.

### Composes with these spec contracts

This bug fix is bounded by three binding contracts already in the wiki — verified for
this spec:

- **D8 — stored equals returned** (`architecture.md` Rules, line 62). For schemas
  registered via `withSchema`, the value stored in the registry MUST equal the value
  returned by `world.generate`. This rules out the proposed direction **B** ("apply the
  per-index override to the returned array only, not the registry") — the returned array
  would diverge from `registry.all`, which D8 was introduced to eliminate. See the
  **Decision** section below.
- **B10 — `effectiveStore` contract** ([B10-R2/R4](B10-generate-store-opt-out.md#b10-r2-store-false-suppresses-the-registry-write-at-the-top-level-call)).
  `store: false` propagates through the recursion via `WorldImpl.effectiveStore` and is
  scoped to the outer `generate` call (push/pop in `try`/`finally`). The B38 fix sits
  **above** this layer — it gates the call before any pipeline work runs, so
  `effectiveStore` is not consulted and the contract is untouched.
- **B12 — deep-merge override on top of matcher result** ([B12-R1/R3/R5](B12-nested-override-skips-matcher.md)).
  The per-index `overrides[i]` semantics on the ad-hoc array branch are
  `deepMerge(item, overrides[i])` (lines 1011–1017) — a plain-object override merges,
  a primitive/array/null override replaces. B38 keeps this semantics unchanged on the
  ad-hoc branch (B38-R3) and does not introduce a third merge variant.
- **B14 — `populate` factory** ([B14-R3](B14-world-populate-factory.md#b14-r3-factory-output-flows-through-the-normal-generate-pipeline))
  is the recommended workaround surfaced by the new error and the docs note (B38-R1,
  B38-R6). B14's contract is preserved unchanged (B38-R4).

Architecture's binding **Rules** apply unchanged:

- **D1**: no `any` and `.js` import extensions on any new imports. The throw site lives
  inside the existing `generateArray` method, accessing already-typed `options.overrides`
  (`unknown[]`) — no new `any` needed.
- **D5**: `docs/api-reference.md` is updated in the same step for the
  `GenerateOptions.overrides` note (B38-R6).
- **D6**: a regression test pinning the exact #22 repro is added under
  `tests/unit/` (B38-R5).
- **D8**: as discussed — the chosen direction (throw) preserves D8 by construction.

Item card: [wiki/backlog/doing/B38-primary-array-overrides-dropped.md](../backlog/doing/B38-primary-array-overrides-dropped.md).
Closes GitHub issue #22.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Decision

The item card proposes four directions (A/B/C/D). The choice is **C + D combined**:
**throw loudly** on the unsafe call shape, and **document** `world.populate(schema, count, factory)`
as the right API for the use case. Reasoning, tied to the binding rules:

- **A — "silent fix that kinda works"** (apply per-index overrides to the freshly-generated
  records only). Rejected. It improves the new-record positions but leaves the
  pre-existing-records edge case (`overrides.length > target - existingCount`) silently
  dropping the rest. Silently improving silent behaviour is incomplete and still
  surprises the caller on the second loop iteration (the exact iteration the card's
  repro fails on).
- **B — A + deep-merge `overrides[i]` onto `registry.all()[i]` in the returned array only**.
  **Rejected by D8.** The returned array would carry the caller-intended values while the
  registry kept the un-overridden originals — exactly the stored-vs-returned divergence
  D8 was introduced to eliminate. Revisiting D8 to permit B is out of scope (no item has
  argued for it, and the principle behind D8 — `populate` / `get` / relation picks all
  trust the registry to reflect the generated truth — does not weaken for this case).
- **C — throw when `overrides.length > target - existingCount`**. Adopted. Makes the
  failure mode loud, points the caller at `world.populate(schema, count, factory)`, and
  preserves D8 + B14's contract.
- **D — `docs/api-reference.md` note under `GenerateOptions.overrides`**. Adopted as
  B38-R6, paired with C. Explicit one-line redirect to `world.populate(schema, count, factory)`.

Concretely the throw fires when **either** of the two compounded effects would have
caused a silent drop:

1. The outer call passes `overrides.length > 0`, AND
2. either some `overrides[i]` is for a position that wouldn't be filled by this
   call (`i >= target - existingCount`), OR — equivalently in the repro — the loop body
   `generateAndStorePrimary` is called without forwarding the per-index override (the
   call-shape bug itself).

The simplest implementation is: in the `primaryRegs.length > 0` branch of
`generateArray`, if `options.overrides` is a non-empty array and the inner schema is
primary-registered, throw immediately with an actionable message naming
`world.populate(schema, count, factory)`. This is stricter than strictly necessary (it
fires even when `overrides.length === target - existingCount` and could in principle
succeed via A), but it has two advantages: (a) the throw site is one cheap guard at
the top of the branch, no per-index bookkeeping, no `target` arithmetic to get wrong;
(b) the message is unambiguous — "per-index overrides on a primary-registered array
schema aren't supported; use `world.populate(schema, count, factory)`" — and steers
every caller to the API that actually does what they want. The empty-overrides case
(no `overrides` field or `overrides: []`) keeps today's behaviour verbatim (B38-R2).

## Requirements

### B38-R1: throw when per-index overrides target a primary-registered array

`WorldImpl.generateArray` ([src/world.ts:917-1024](../../src/world.ts#L917)) MUST throw
an `Error` when **all** of the following hold:

1. the inner schema is **primary-registered** (`this.findPrimaryRegs(innerSchema).length > 0`),
2. `options.overrides` is an array with `length > 0`.

The error message MUST:

- name `world.populate(schema, count, factory)` as the right API (verbatim, including
  the parens, so a `grep` from the user lands on this method);
- mention that per-index overrides on a primary-registered array schema are not
  supported on `world.generate`;
- be a plain `Error` (or a subclass thereof) — no `any`-typed throw, no string-throw
  (D1).

No `any` MUST appear in the new code. The throw MUST fire **before** any record is
generated by this call (so no partial work lands in the registry).

- Scenario: minimal repro — primary-array with per-index overrides throws
  GIVEN `ProductSchema = z.object({ id: z.uuid(), category: z.enum(["alpha", "bravo", "charlie"]), name: z.string() })`
  registered via `world.withSchema(ProductSchema)` on `createWorld({ seed: 1 })`
  WHEN the consumer calls
  `world.generate(ProductSchema.array().min(4).max(4), { overrides: Array.from({ length: 4 }, () => ({ category: "alpha" as const })) })`
  THEN the call throws an `Error` whose `message` contains the literal substring
  `world.populate(schema, count, factory)` and mentions "overrides" and
  "array"/"primary", AND `world.registry.count(ProductSchema) === 0` (no record was
  written before the throw).

- Scenario: error message is actionable (names the right API)
  GIVEN the same world as above
  WHEN the consumer makes the same call
  THEN catching the thrown error, `err instanceof Error` is `true` and
  `err.message.includes("world.populate(schema, count, factory)")` is `true` — the
  message guides the user directly to the workaround.

### B38-R2: empty / absent overrides keep today's behaviour byte-equivalent

When the outer `world.generate(arraySchema, options?)` call EITHER omits `options`
ENTIRELY, OR passes `options` whose `overrides` field is absent, OR passes
`overrides: []` (empty array), the primary-mode branch of `generateArray` MUST behave
**byte-equivalent** to the pre-B38 implementation: same number of records added to the
registry, same field values, same ordering, for the same seed. No throw fires.

(Rationale: the bug only manifests when the caller passes non-empty per-index overrides.
Callers who never used that pattern see no behaviour change, no surprise throws on
existing array fixtures.)

- Scenario: no-options primary-array call is byte-equivalent to today
  GIVEN `ProductSchema = z.object({ id: z.uuid(), name: z.string() })` registered on
  `createWorld({ seed: 1 })`, and a baseline captured before B38 as
  `BASELINE = JSON.stringify(world.generate(ProductSchema.array().min(4).max(4)))`
  WHEN the same call is made after B38 on an independent identically-seeded world,
  capturing `AFTER = JSON.stringify(world.generate(ProductSchema.array().min(4).max(4)))`
  THEN `AFTER === BASELINE` — no throw, identical records.

- Scenario: explicit empty overrides array does not throw
  GIVEN the same world as above
  WHEN the consumer calls
  `world.generate(ProductSchema.array().min(4).max(4), { overrides: [] })`
  THEN the call does NOT throw, and `world.registry.count(ProductSchema)` equals the
  number of records the array request asked for (4 in this case, since this is the first
  call on a fresh world).

### B38-R3: ad-hoc (unregistered) array branch unchanged

When the inner schema is **NOT** primary-registered (`findPrimaryRegs(innerSchema).length === 0`)
AND NOT derived (`findDerivedRegs(innerSchema).length === 0`) — the ad-hoc branch at
`src/world.ts:986-1023` — `options.overrides` MUST continue to be applied per-element
via `deepMerge` exactly as today, with the per-element override flowing through the
existing `result.map((item, i) => deepMerge(item, overrides[i]))` pattern (line 1015).
No throw MUST fire on this branch for non-empty `overrides`. B12-R3/R5 semantics
(plain-object override deep-merges, primitive/array/null override replaces) MUST be
preserved.

- Scenario: ad-hoc array with per-index overrides still works
  GIVEN an unregistered schema `Item = z.object({ id: z.string(), label: z.string() })`
  and a world `createWorld({ seed: 1 })` with NO `withSchema(Item)` call
  WHEN the consumer calls
  `const items = world.generate(Item.array().length(3), { overrides: [{ label: "first" }, { label: "second" }, { label: "third" }] })`
  THEN the call does NOT throw, `items.length === 3`, and
  `items.map((it) => it.label)` deep-equals `["first", "second", "third"]` — the
  per-index overrides are applied via `deepMerge`, with sibling fields (the generated
  `id`) preserved on each element.

- Scenario: ad-hoc array with primitive-array override does not throw
  GIVEN an unregistered schema `Tags = z.string().array().length(2)` and a world
  `createWorld({ seed: 1 })`
  WHEN the consumer calls
  `world.generate(Tags, { overrides: ["alpha", "beta"] })`
  THEN the call does NOT throw and returns `["alpha", "beta"]` (each primitive
  override replaces the generated string, per B12-R3's array/primitive-replace pinning
  on the per-element `deepMerge`).

### B38-R4: `world.populate(schema, count, factory)` is unaffected

The recommended workaround — `world.populate(schema, count, factory)` ([B14](B14-world-populate-factory.md))
— MUST continue to work exactly as B14-R1..R7 specify. In particular, the B38 throw site
in `generateArray` MUST NOT be reachable from `populate`'s loops: `populate` calls
`generateAndStorePrimary` (and `generateDerivedRecord`) **directly**, not via
`generate(arraySchema, …)`, so the array path is never entered. The factory's
`overrides` continues to land per record through B14-R3's pipeline.

- Scenario: populate with factory overrides per record (B14-R3 regression check)
  GIVEN `ProductSchema = z.object({ id: z.uuid(), category: z.enum(["alpha", "bravo", "charlie"]), name: z.string() })`
  registered on `createWorld({ seed: 1 })`
  WHEN the consumer runs the repro's intent via `populate`:
  ```ts
  for (const category of ["alpha", "bravo", "charlie"] as const) {
    world.populate(ProductSchema, 4, () => ({ overrides: { category } }));
  }
  ```
  THEN `world.registry.count(ProductSchema) === 12` AND
  `world.registry.all(ProductSchema).map((p) => p.category)` deep-equals
  `["alpha", "alpha", "alpha", "alpha", "bravo", "bravo", "bravo", "bravo", "charlie", "charlie", "charlie", "charlie"]`
  — the workaround named by B38-R1's error message does what the original failing call
  intended.

### B38-R5: regression test pinning the exact #22 repro

A regression test MUST live under `tests/unit/` (D6) and MUST reproduce the exact
failure from the item card's `### Repro (from #22)` block, specifically:

1. Register `ProductSchema = z.object({ id: z.uuid(), category: z.enum(['alpha', 'bravo', 'charlie']), name: z.string() })`
   on `createWorld({ seed: 1 })`.
2. Loop over `['alpha', 'bravo', 'charlie'] as const`, calling
   `world.generate(ProductSchema.array().min(4).max(4), { overrides: Array.from({ length: 4 }, () => ({ category })) })`
   on each iteration.
3. Assert that the loop throws on the **first** iteration (B38's chosen direction — throw
   immediately on a non-empty per-index overrides array against a primary-registered
   inner schema — fires on iteration 1, not iteration 2 as the original loose-A
   reasoning would have suggested). Today's silent failure is captured by an _equivalent_
   pre-B38 assertion in the docstring comment of the test: with the bug, the loop
   completes silently and `world.registry.count(ProductSchema) === 4`; after B38, the
   loop throws on iteration 1 and the test catches and asserts the error.

The test MUST assert the throw via `expect(() => …).toThrow(/world\.populate\(schema, count, factory\)/)`
(or equivalent) so the error message regression is also pinned.

- Scenario: the regression test exists and passes
  GIVEN the regression test file under `tests/unit/`
  WHEN `pnpm test` is run
  THEN the file contains the exact #22 repro setup (ProductSchema, three-category loop,
  `.array().min(4).max(4)` with `overrides: Array.from({ length: 4 }, () => ({ category }))`),
  asserts the first iteration throws an `Error` whose message contains
  `world.populate(schema, count, factory)`, AND the suite is green.

### B38-R6: `docs/api-reference.md` updated in the same step

The new error path on `world.generate(arraySchema, { overrides })` against a
primary-registered inner schema is an observable contract change: callers who relied on
the silent no-op now get a throw. Per D5 (`architecture.md` Rules), `docs/api-reference.md`
MUST be updated in the same step. Specifically:

- The **`GenerateOptions`** subsection (line ~320) — the `overrides` paragraph
  (line 332) — MUST gain a one-line note that per-index `overrides` on a
  **primary-registered** array schema **throw** (with the one-line redirect to
  `world.populate(schema, count, factory)`).
- The **`.generate`** subsection (line ~296) — the bullet "If `schema` is an array:
  returns an array..." block (lines 307–310) — MUST cross-link to the throw note
  (a parenthetical "per-index overrides → see [`.populate`](#populateschema-count-factory)
  for primary-registered inner schemas" is sufficient).
- The **`.populate`** subsection (line ~357) — the existing per-record-overrides
  example with `USER_PROFILES` already advertises the right pattern; no rewrite is
  required, but the subsection MAY add a short parenthetical noting "this is the
  supported way to per-record-override a registered schema" so the redirect from the
  generate-side note has a landing spot.

- Scenario: docs reflect the new throw and the redirect
  GIVEN the B38 change applied
  WHEN `docs/api-reference.md` is read
  THEN the `overrides` paragraph in the `GenerateOptions` subsection mentions the
  per-index-overrides-throw rule and names `world.populate(schema, count, factory)` as
  the workaround, AND the `.generate` subsection's array-return bullet cross-links to
  `.populate` for the primary-registered case.

### B38-R7: changeset entry recording the new throw behaviour

A changeset file at `.changeset/b38-primary-array-overrides-throw.md` MUST be added in
the same step. The frontmatter MUST declare a **minor** bump for `zod4-mock` —
rationale: while the silent no-op was never a _documented_ contract (no spec or
api-reference page said `world.generate(primaryArraySchema, { overrides })` was a no-op),
real users in the wild (per #22) relied on the silent behaviour to not throw. Promoting
that to a hard throw is a behavioural break for those callers; `minor` reflects that
honestly. The choice of `minor` over `patch` is the conservative reading and matches
how the codebase treated the comparable B10 introduction of `store: false` (a new
observable behaviour for callers who never used it).

The changeset body MUST:

- summarise the bug (per-index overrides silently dropped on primary-registered array
  schemas);
- describe the new throw behaviour (loud `Error` naming
  `world.populate(schema, count, factory)`);
- show a short before/after example consistent with the item card's repro;
- end with the literal final non-empty line `(closes #22)` (per
  the codebase's commit-message-issue-references convention).

- Scenario: changeset exists with the right bump and closes-line
  GIVEN the B38 change applied
  WHEN `.changeset/b38-primary-array-overrides-throw.md` is read
  THEN its frontmatter contains `"zod4-mock": minor`, its body summarises the bug and
  the new throw behaviour, and its final non-empty line is `(closes #22)`.

## Out of scope

- **Changing the derived-mode branch** (`derivedRegs.length > 0`, lines 936–963). The
  bug is specific to the primary-mode arm; derived arrays generate one output per source
  record, a different model that does not take per-index overrides today. Adding
  per-index overrides on derived arrays is a separate item.
- **Changing the `existingCount` short-circuit** (`target = max(existingCount, …)`).
  The second compounding effect — `existingCount >= target` makes the loop a no-op — is
  intentional behaviour for repeated `generate(primaryArraySchema)` calls on a registered
  inner: it acts as "give me at least N of these, including any already there." B38
  does not re-architect this. The throw in B38-R1 just refuses to silently ignore
  caller-supplied overrides on top of it.
- **A "make `generate(arraySchema, { overrides })` work like `populate`" feature**.
  Direction A (silently honour overrides for the freshly-generated positions only) is
  explicitly rejected (see Decision); direction B (apply overrides to the returned array
  but not the registry) is rejected by D8. Adding `populate`-like semantics to
  `world.generate(arraySchema, …)` would require a new spec and a deliberate D8
  revisit; B38 does not pursue it.
- **Element-wise array overrides on the ad-hoc branch beyond today's `deepMerge` pattern**.
  B12-R5 and the ad-hoc branch's `result.map((item, i) => deepMerge(item, overrides[i]))`
  semantics (line 1015) are unchanged. The "merge override `[i].field` into matcher
  `[i].field`" mid-record behaviour is whatever B12-R1/R5 already pin for the per-element
  recursion into `generate(innerSchema, …)`.
- **Renaming or removing `GenerateOptions.overrides` on arrays**. The field stays
  typed as `DeepPartial<unknown[]>` (whatever type `GenerateOptions<T[]>['overrides']`
  resolves to today); B38 narrows runtime behaviour for the primary-registered-inner
  case only.
- **Decomposing `generateArray`** (B22/B25/B28 complexity-research refactor). The item
  card explicitly notes "this bug should land **before** B25 / B28 so the regression
  test isn't disturbed mid-decomposition." B38 lands the throw + regression test on the
  current `generateArray` shape; the future decomposition is responsible for keeping
  B38's behaviour intact.
- **A `World.preview`-style "generate-an-array-from-overrides" method**. Not adopted;
  the canonical answer is `world.populate(schema, count, factory)` per B14.

## Open questions

- **Changeset bump: `minor` vs `patch`. — Non-blocking.** B38-R7 pins **minor** for the
  conservative reading (real users in #22 relied on the silent no-op). A reviewer
  preferring `patch` could argue: the silent no-op was never a documented contract — no
  page in `wiki/specs/`, no section in `docs/api-reference.md`, and no test asserted the
  silent-no-op shape — so the throw is closer to "bug fix that surfaces previously
  hidden misuse" than to a breaking change. Adopted as **minor** by B38-R7; the
  alternative is recorded so a reviewer can downgrade to `patch` with an explicit
  rationale on the PR if they prefer. Either choice is principled; minor is the
  safer caller-respecting default.

- **Throw also when `overrides.length === target - existingCount` (the "could have
  worked under A" case). — Non-blocking.** B38-R1 throws on _any_ non-empty
  `overrides` for a primary-registered inner. A more permissive variant would only
  throw when `overrides.length > target - existingCount`, silently honouring the
  overrides on the freshly-generated positions otherwise (direction A as a fallback).
  Adopted as the **strict** form for two reasons: (a) the call shape is then 1:1 — "did
  you pass per-index overrides on a primary-registered array? use `populate`" — with no
  arithmetic for the user to model, and (b) the permissive variant re-introduces the
  category of silent partial application that B38 is meant to eliminate. Recorded; not
  blocking.

- **Error class: plain `Error` vs a named subclass (`Zod4MockError`,
  `PrimaryArrayOverridesError`, etc.). — Non-blocking.** B38-R1 mandates a plain
  `Error` (or subclass). The codebase today does not export a named error subclass for
  user-facing errors (a `Grep` over `src/` shows `throw new Error(...)` is the
  convention). B38 inherits that convention. If a future item introduces a named error
  hierarchy, B38's throw can be retypeised then; B38 itself does not pre-empt that
  decision. Recorded; not blocking.

No blocking open questions remain; the spec can advance to `test-writer`.
