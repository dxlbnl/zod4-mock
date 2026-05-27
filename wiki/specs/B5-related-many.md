# B5: Add `ctx.related.many(name, count)` for one-to-many relations in matchers

## Context

`ctx.related(name)` resolves a **single** related record — ideal for foreign keys (one
document → one author). It is exposed on `GeneratorContext` as a callable
([src/types.ts](../../src/types.ts) line 93: `related<T = Record<string, unknown>>(relationName: string): T`),
typed more precisely on `MatcherCtx` via two overloads (types.ts lines 126–127), and
implemented in `WorldImpl.makeFieldCtx` → `resolveRelated`
([src/world.ts](../../src/world.ts) lines 308–365). It backs `wiki/requirements.md` R6
(relations keep IDs consistent across registered schemas via the registry).

There is no first-class primitive for **one-to-many** relations (a case → many users, an
order → many line items, a folder → many files). Both current workarounds fail:

- `ctx.registry.all(schema)` + `ctx.prng.sample(...)` bypasses the `relations:`
  declaration, so the schema stops documenting the relationship and there is no
  auto-provision.
- Calling `ctx.related(name)` repeatedly returns the **same** pick every time, because
  `related` is record-scoped (it caches the picked record per record+relation), so
  `[ctx.related('users'), ctx.related('users')]` yields two identical entries.

This item adds a `.many` method on `ctx.related` to pick `count` distinct related
records. See the item card
[wiki/backlog/doing/B5-related-many.md](../backlog/doing/B5-related-many.md) (GitHub
issue #3).

### How the real implementation grounds these requirements

The requirements below are written against the **actual** code, not the card's
illustrative `<T = any>` types:

- **`related` becomes a callable object.** Today `related` is a bare function. Adding
  `.many` means `related` must be a function value that also carries a `.many` property —
  a callable object. Both `GeneratorContext.related` (types.ts line 93) and the
  `MatcherCtx` overloaded `related` (types.ts lines 126–127) must gain the `.many`
  member, typed against the registered relation schema (`input<TRelations[K]>[]` on
  `MatcherCtx`), with **no `any`** (architecture Rules → D1).
- **Record-scoping mechanism.** Single `related` caches its snapshot of the relation's
  records in `WorldImpl.relationPools` under the key `${recordId}:${relName}` and derives
  a stable per-relation PRNG via `recordPrng.fork('rel:${relName}')` (world.ts lines
  337–364). `.many` must reuse the same per-record snapshot so that sibling matchers in
  the same record see the same records (this is what the "Regression Tests" case at
  tests/unit/core/relations.test.ts:288 protects for single `related`).
- **Auto-provision shortfall.** Single `related` provisions exactly one record when the
  relation's registry is empty, via `ensurePrimaryRecord` (world.ts lines 341–354). For a
  count of `N`, `.many` must provision until at least `N` records exist for that relation
  — extending the same `generateAndStorePrimary` path, not a new mechanism.
- **Determinism.** Picks must come from a per-field/per-relation PRNG fork (architecture
  Rules → D4); the impl is expected to reuse `prng.sample(items, count)`
  ([src/prng.ts](../../src/prng.ts) lines 103–107), which shuffles and slices and so
  yields **distinct** records and a stable order for a given PRNG state.
- **Imports** in `src/*.ts` use `.js` extensions (architecture Rules → Node16 ESM); the
  change adds no new imports but MUST not violate this.
- This is a **public API change** (extends `GeneratorContext`/`MatcherCtx`), so
  `docs/api-reference.md` MUST be updated in the same step (architecture Rules → D5;
  handled by the implementer).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B5-R1: `related` exposes a typed `.many` method

`ctx.related` MUST be a callable object that remains invokable as the existing single-pick
function and additionally carries a `many` method with the shape
`many<T = unknown>(relationName: string, count: number): T[]`; on `MatcherCtx`, for a
declared relation key `K`, `related.many(K, count)` MUST be typed to return
`input<TRelations[K]>[]` (no `any`, no cast at the call site).

- Scenario: existing single-pick call still works
  GIVEN a schema registered with `relations: { owner: PersonSchema }` and a matcher
  `ownerId: (ctx) => ctx.related('owner').personId`
  WHEN a record is generated
  THEN generation succeeds and `ownerId` equals the resolved person's `personId` (the
  single-pick behavior of `ctx.related` is unchanged).

- Scenario: `.many` is present and typed
  GIVEN a `GeneratorContext`/`MatcherCtx` inside a matcher for a schema with
  `relations: { users: UserSchema }`
  WHEN `ctx.related.many` is accessed
  THEN `typeof ctx.related.many === 'function'`, and the project type-checks
  (`pnpm typecheck`) with `ctx.related.many('users', n)` inferred as `input<UserSchema>[]`
  (no `any`, no cast).

### B5-R2: `.many(name, count)` returns `count` distinct records from the relation

`ctx.related.many(relationName, count)` MUST return an array of `count` records drawn from
the named relation's registry bucket, with no record appearing more than once in the
returned array (distinct by reference) when the relation has at least `count` records.

- Scenario: returns the requested number of distinct records
  GIVEN a world where `UserSchema` is registered and the registry is pre-populated with 5
  users, and `CaseSchema` is registered with `relations: { users: UserSchema }` and a
  matcher `users: (ctx) => ctx.related.many('users', 3)`
  WHEN a `CaseSchema` record is generated
  THEN `case.users` is an array of length 3, and its three entries are pairwise distinct
  (no duplicate reference), and each entry is one of the 5 pre-populated users.

- Scenario: every returned record belongs to the relation schema
  GIVEN the same setup with 5 pre-populated users
  WHEN a `CaseSchema` record is generated with `users: (ctx) => ctx.related.many('users', 3)`
  THEN every entry of `case.users` satisfies `UserSchema.safeParse(entry).success === true`
  and is present in `world.registry.all(UserSchema)`.

### B5-R3: `.many` auto-provisions the shortfall when the registry has too few records

When the named relation's registry bucket holds fewer than `count` records,
`ctx.related.many(relationName, count)` MUST auto-provision new records for that relation
(via the same primary-generation path single `related` uses) until the bucket holds at
least `count` records, then return `count` distinct records.

- Scenario: provisions from an empty registry
  GIVEN a world where `UserSchema` is registered, the registry has **no** users, and
  `CaseSchema` is registered with `relations: { users: UserSchema }` and a matcher
  `users: (ctx) => ctx.related.many('users', 3)`
  WHEN a `CaseSchema` record is generated
  THEN `world.registry.all(UserSchema).length` is at least 3, and `case.users` has length
  3 with three distinct entries, each present in the registry.

- Scenario: tops up a partially-populated registry
  GIVEN a world with `UserSchema` registered, the registry pre-populated with exactly 2
  users, and `CaseSchema` with `relations: { users: UserSchema }` and matcher
  `users: (ctx) => ctx.related.many('users', 4)`
  WHEN a `CaseSchema` record is generated
  THEN `world.registry.all(UserSchema).length` is at least 4, `case.users` has length 4
  with four distinct entries, and the 2 original users are still present in the registry
  (provisioning adds records, it does not replace them).

### B5-R4: `.many` is deterministic across runs for the same seed

`ctx.related.many(relationName, count)` MUST return the same `count` records in the same
order whenever the world is constructed with the same seed and the same registration
order (per architecture Rules → D4, the pick is derived from a per-relation PRNG fork, not
shared mutable state).

- Scenario: same seed yields identical result and order
  GIVEN two worlds independently created with `seed: 1`, each with `UserSchema` registered
  and pre-populated with 5 users in the same order, and `CaseSchema` registered with
  `relations: { users: UserSchema }` and matcher `users: (ctx) => ctx.related.many('users', 3)`
  WHEN a `CaseSchema` record is generated in each world
  THEN the two `case.users` arrays are deeply equal element-for-element, including order
  (e.g. `case1.users.map(u => u.id)` equals `case2.users.map(u => u.id)`).

### B5-R5: `.many` is record-scoped — repeated calls in one record agree

Within a single generated record, calling `ctx.related.many(relationName, count)` more
than once with the same arguments MUST return the same records in the same order, so
sibling matchers stay consistent (mirroring the per-record snapshot single `related` uses
in `WorldImpl.relationPools`).

- Scenario: sibling matchers see the same set in the same order
  GIVEN a world with `UserSchema` registered (5 users pre-populated) and `CaseSchema`
  registered with `relations: { users: UserSchema }` and matchers
  `users: (ctx) => ctx.related.many('users', 3)` and
  `usernames: (ctx) => ctx.related.many('users', 3).map(u => u.username)`
  WHEN a `CaseSchema` record is generated
  THEN `case.usernames` deeply equals `case.users.map(u => u.username)` (same three users
  in the same order across the two matchers).

- Scenario: result is stable even if the registry grows mid-record
  GIVEN a world where one matcher calls `ctx.related.many('users', 3)`, then stores an
  extra user into `world.registry` via `ctx.registry.store(...)`, and a sibling matcher
  also calls `ctx.related.many('users', 3)`
  WHEN the record is generated
  THEN both matchers return the same three records (the mid-record registry growth does
  not change the per-record snapshot), matching the existing single-`related` stability
  guarantee.

### B5-R6: requesting more records than possible returns all distinct records

When `count` exceeds the number of records that can exist for the relation after
auto-provisioning has run, `ctx.related.many` SHOULD return all available distinct records
(clamped, never duplicated) rather than throwing — consistent with `prng.sample`, which
clamps `count` into `[0, items.length]`.

- Scenario: self-referential relation with limited supply
  GIVEN a self-referential schema `CategorySchema` with `relations: { parent: CategorySchema }`
  (which is **not** auto-provisioned, per the self-reference guard in `resolveRelated`),
  generated such that only 2 category records exist, and a matcher calling
  `ctx.related.many('parent', 5)`
  WHEN the matcher runs against those 2 existing records
  THEN it returns at most the available distinct records (length ≤ 2, no duplicate
  references) and does not throw.

## Out of scope

- **`count` as a `[min, max]` range.** `ctx.related.many(name, [min, max])` shorthand is
  **not** added; matcher authors express variability in userland via
  `ctx.related.many(name, ctx.prng.int(min, max))` (the card and issue #3 lean this way to
  avoid doubling the API surface).
- **A "repeats allowed" mode.** `.many` is distinct-only; sampling with replacement is not
  offered (matchers can build that from `ctx.registry.all` + `ctx.prng` if ever needed).
- **`related.all()` / `related.find()` namespacing.** This item only adds `.many`; further
  methods on the `related` object are future work, not specified here.
- **Changes to single `related`, `registry`, `prng`, or the self-reference
  auto-provision guard** — `.many` reuses those mechanisms unchanged. (For a
  self-referential relation `.many` does not auto-provision, by R6, because single
  `related` does not either.)

## Open questions

- **Distinctness: distinct picks vs. allow repeats.** — **Non-blocking.** The card
  recommends distinct as the default, and this spec adopts it (B5-R2, B5-R6) — it is also
  the natural behavior of the `prng.sample` the implementation reuses. A repeats mode is
  recorded as out of scope. A recommended default exists and is specified, so the spec
  advances.
- **API shape: `related.many()` vs. flat `relatedMany()`.** — **Non-blocking.** The card
  recommends `related.many()` (it namespaces cleanly as the API grows), and this spec
  adopts it (B5-R1) by making `related` a callable object. The single-pick call signature
  is preserved, so the change is additive. Recorded; the spec advances.
- **`count` as a `[min, max]` range.** — **Non-blocking.** The card and issue #3 lean
  toward leaving this to userland (`related.many(name, prng.int(min, max))`); this spec
  declares it out of scope. Recorded; the spec advances.

None of these is blocking: reading `src/world.ts`, `src/prng.ts`, and `src/types.ts`
confirms record-scoping (`relationPools` per `recordId:relName`), distinct deterministic
sampling (`prng.sample` via Fisher-Yates shuffle on a per-relation fork), and
shortfall auto-provisioning (`ensurePrimaryRecord`/`generateAndStorePrimary`) are all
expressible with the current architecture without any `any`.
