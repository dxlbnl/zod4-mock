# B4: Add `registry.find()` — single-record predicate lookup

## Context

The `Registry` ([src/registry.ts](../../src/registry.ts), interface in
[src/types.ts](../../src/types.ts)) is the in-memory store backing cross-API consistency
(`wiki/requirements.md` R6: relations keep IDs consistent via the registry). It currently
exposes `store`, `all`, `pick`, `filter`, and `count`. There is no first-class way to look
up _one specific_ stored record by a property: `pick` is random, `filter` returns a `T[]`,
and `all` returns everything. Matchers that want "the one user named `admin`" or "the person
with this `personId`" today write `filter(schema, pred)[0]`, which obscures intent and — via
the `T[]` return — does not force the caller to handle the absence case.

This item adds `find`, semantically `filter(schema, pred)[0]` but expressed as the actual
intent, with a return type that forces handling absence. It is foundational for **B6
(`world.get`)** ("`find`, or `generate` with overrides") and is sequenced before B6. See the
item card: [wiki/backlog/doing/B4-registry-find.md](../backlog/doing/B4-registry-find.md)
(GitHub issue #2).

The real `Registry` interface generic-binds the schema, not the record: each method is
`<T extends ZodTypeAny>(schema: T, …)` and types records as `input<T>` — _not_ the card's
illustrative `<T = unknown>`. `find` MUST follow the existing interface convention so the
predicate parameter and return are typed `input<T>` with no `any` (Rules: no `any`). The
implementation file uses `.js` import extensions (Rules: Node16 ESM); the new method adds no
new imports but MUST not violate either rule. Per the doc rule, this public API change MUST
update `docs/api-reference.md` in the same step (handled by the implementer).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B4-R1: `find` is added to the `Registry` interface

The `Registry` interface and its `SchemaRegistry` implementation MUST expose a `find` method
matching the existing schema-bound, `input<T>`-typed convention, with the shape
`find<T extends ZodTypeAny>(schema: T, predicate: (item: input<T>) => boolean): input<T> | undefined`.

- Scenario: method present and typed
  GIVEN a `SchemaRegistry` instance
  WHEN its `find` member is accessed
  THEN `find` is a function (`typeof registry.find === "function"`), and the project
  type-checks (`pnpm typecheck`) with the predicate parameter and return value typed as the
  schema's `input<T>` (no `any`, no cast at the call site).

### B4-R2: `find` returns the first matching record

`find` MUST return the first record stored for the given schema for which `predicate` returns
a truthy value.

- Scenario: single match returned
  GIVEN a registry where three records are stored for `userSchema`, exactly one of which has
  `username === "admin"`
  WHEN `registry.find(userSchema, u => u.username === "admin")` is called
  THEN it returns that record (the object whose `username` is `"admin"`).

- Scenario: lookup by id across records
  GIVEN a registry where several `personSchema` records are stored, one with
  `personId === 42`
  WHEN `registry.find(personSchema, p => p.personId === 42)` is called
  THEN it returns the record whose `personId` is `42`.

### B4-R3: `find` returns `undefined` when nothing matches

`find` MUST return `undefined` when no stored record for the schema satisfies the predicate,
including when no records are stored for that schema at all (it MUST NOT throw).

- Scenario: no record matches the predicate
  GIVEN a registry with records stored for `userSchema`, none of which has
  `username === "nobody"`
  WHEN `registry.find(userSchema, u => u.username === "nobody")` is called
  THEN it returns `undefined` and does not throw.

- Scenario: schema has no stored records
  GIVEN a registry where nothing has been stored for `userSchema`
  WHEN `registry.find(userSchema, () => true)` is called
  THEN it returns `undefined` and does not throw.

### B4-R4: "First" means registry insertion order

When more than one stored record satisfies the predicate, `find` MUST return the record that
was stored earliest (the order in which `store` was called for that schema), matching
`Array.prototype.find` semantics over the underlying bucket.

- Scenario: earliest matching record wins
  GIVEN a registry where, for `userSchema`, a record `{ role: "member", n: 1 }` is stored
  first and a record `{ role: "member", n: 2 }` is stored second
  WHEN `registry.find(userSchema, u => u.role === "member")` is called
  THEN it returns the first-stored record (`n === 1`), not the second.

### B4-R5: `find` is a pure, non-mutating lookup

`find` MUST NOT mutate the registry, MUST NOT consume PRNG state, and repeated calls with the
same arguments MUST return the same record (no randomness, no determinism concern — unlike
`pick`).

- Scenario: registry contents unchanged and PRNG untouched
  GIVEN a registry with records stored for `userSchema` and a known PRNG state
  WHEN `registry.find(userSchema, u => u.username === "admin")` is called twice in a row
  THEN both calls return the same record, `registry.count(userSchema)` and `registry.all(userSchema)`
  are unchanged by the calls, and the registry's PRNG advances by zero steps (a subsequent
  `pick`/PRNG-consuming call yields the same value it would have yielded had `find` never been
  called).

## Out of scope

- A throwing variant (`findOrThrow`) — explicitly deferred to a possible later item per the
  issue; not added here.
- Finding across multiple schemas at once, or by schema _string_ name (the registry is keyed
  by schema object reference, not by name).
- `findLast`, `findIndex`, or returning all matches — `filter` already covers the multi-match
  case.
- Any change to `store`, `all`, `pick`, `filter`, or `count`.
- `world.get` (B6) — this spec only delivers the registry primitive B6 will build on.

## Open questions

- **Return contract: `T | undefined` vs. throw-on-no-match.** — **Non-blocking.** The card
  and GitHub issue #2 both recommend `input<T> | undefined` (symmetric with
  `Array.prototype.find`, forces null-handling, low friction when a fixture may not exist
  yet), and this spec adopts it as the contract in B4-R3. A throwing form is recorded as a
  possible future `findOrThrow` variant (Out of scope). A recommended default exists and is
  specified, so the spec can advance; this is recorded, not blocking.
