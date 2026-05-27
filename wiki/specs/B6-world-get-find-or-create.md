# B6: Add `world.get(schema, predicate)` — find an existing record matching the predicate, or generate one

## Context

When mocks cross-reference records by a domain identifier (slug, sku, externalId), there
is no clean primitive for "give me the record with this key, creating it if it does not
exist." `registry.find` (B4, [wiki/specs/B4-registry-find.md](B4-registry-find.md)) returns
`undefined` with no auto-create, and the caller must also remember to feed the predicate
value back as an `overrides` when generating. `ctx.related` is for declared relationships,
not ad-hoc lookups by domain key. This pattern recurs in MSW handlers — the URL carries a
parameter (`/products/:sku`) and the handler wants the *same* mocked product every time
that URL is hit. (Item card: [wiki/backlog/doing/B6-world-get-find-or-create.md](../backlog/doing/B6-world-get-find-or-create.md);
GitHub issue #4.)

This item adds `World.get`, semantically "`registry.find` keyed by the predicate, or
`world.generate` with the predicate deep-merged as `overrides` and the result stored." It
**composes directly on B4** (`registry.find`) and on the existing `generate` overrides+store
path — it introduces **no new store mechanism**.

The real `World` interface ([src/types.ts](../../src/types.ts)) generic-binds each method
`<TSchema extends ZodTypeAny>` and types values with `input<TSchema>` / `z.infer<TSchema>`
(not the card's illustrative free types). `get` MUST follow that convention with no `any`.

**`get` lives on `World`, not the registry (design decision).** `get`'s create-on-miss path
needs `world.generate` — matchers, overrides, and the full resolution pipeline — whereas
`SchemaRegistry` is a pure data store (its constructor takes only a `Prng`, with no
world/`generate` reference). Putting find-or-create on the registry would require injecting a
`generate` back-reference into the store, creating a circular dependency. So `registry.find`
(B4) stays the pure-lookup primitive and `World.get` *composes* `find` + `generate`. This
choice changes no requirement below — `get` was already specified on `World`; it is recorded
here so the boundary is explicit.

One implementation nuance that shapes the requirements below: `generate` only writes a
record into the registry when the schema is registered as a *primary* schema (via
`withSchema`) or auto-provisioned through a relation. For an **unregistered, ad-hoc object
schema**, `generate` takes its ad-hoc branch and does **not** store the result. Because
`get`'s idempotence depends on the created record being discoverable by a later `find`,
`get` MUST ensure the created record is stored regardless of whether the schema was
registered (see B6-R3, B6-R7).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B6-R1: `get` is added to the `World` interface

The `World` interface and its `WorldImpl` class MUST expose a `get` method with the shape
`get<TSchema extends ZodTypeAny>(schema: TSchema, predicate?: Partial<input<TSchema>>): input<TSchema>`
— the `predicate` argument is **optional**. It is typed against the existing `World` interface
convention: the predicate and return value are the schema's `input<TSchema>` with no `any` and
no cast at the call site (Rules: no `any`).

- Scenario: method present and typed
  GIVEN a world created with `createWorld({ seed: 1 })`
  WHEN its `get` member is accessed
  THEN `get` is a function (`typeof world.get === "function"`) and the project type-checks
  (`pnpm typecheck`) with `world.get(productSchema, { sku: "WIDGET-42" })` returning a value
  assignable to `input<typeof productSchema>` (no `any`, no cast at the call site).

- Scenario: predicate is optional — no-argument call type-checks
  GIVEN a world created with `createWorld({ seed: 1 })`
  WHEN `world.get(productSchema)` is called with no second argument
  THEN the project type-checks (`pnpm typecheck`) and the call returns a value assignable to
  `input<typeof productSchema>` (no `any`, no cast at the call site).

### B6-R2: find path — return an existing matching record

`get` MUST return the existing stored record when a record is already stored for `schema`
for which **every** key present in `predicate` matches the record's value for that key
(shallow keys compared by value; values that are nested objects compared by deep equality —
see B6-R8). An absent or empty predicate has no keys, so every stored record trivially
matches (see B6-R9). The returned value MUST be the same instance held in the registry
(reference equality), not a copy.

- Scenario: existing record returned by reference
  GIVEN a world that has already stored a `productSchema` record with `sku === "WIDGET-42"`
  (e.g. produced by an earlier `world.get(productSchema, { sku: "WIDGET-42" })`)
  WHEN `world.get(productSchema, { sku: "WIDGET-42" })` is called again
  THEN it returns that stored record and the returned value is the **same instance**
  (`result === registry.find(productSchema, p => p.sku === "WIDGET-42")`), and no new record
  is created (`registry.count(productSchema)` is unchanged by the call).

- Scenario: multi-field predicate — all keys must match
  GIVEN a world that has stored a `nodeSchema` record with `externalId === "ext-1"` and
  `tenantId === "t-1"`, and another with `externalId === "ext-1"` and `tenantId === "t-2"`
  WHEN `world.get(nodeSchema, { externalId: "ext-1", tenantId: "t-1" })` is called
  THEN it returns the record whose `tenantId` is `"t-1"` (the one where *every* predicate key
  matches), not the `"t-2"` record.

### B6-R3: create path — generate with predicate as overrides, store, and return

When no stored record for `schema` matches every key in `predicate`, `get` MUST generate a
new record via the existing `generate` overrides path with `predicate` supplied as
`overrides`, store the new record in the registry for `schema`, and return it — so that the
natural key is honored and a subsequent `find`/`get` can discover it. `get` MUST NOT
introduce a store mechanism other than `registry.store` / the existing generate-and-store
path.

- Scenario: miss generates, honors the key, and is discoverable
  GIVEN a world (seed `1`) with no stored `productSchema` record having `sku === "GADGET-99"`
  WHEN `world.get(productSchema, { sku: "GADGET-99" })` is called
  THEN it returns a freshly generated product whose `sku` is `"GADGET-99"`, the other fields
  are populated by the normal generation pipeline (the result satisfies
  `productSchema.safeParse(result).success === true`), `registry.count(productSchema)`
  increases by one, and `registry.find(productSchema, p => p.sku === "GADGET-99")` now returns
  that same record.

- Scenario: created record stored even for an unregistered ad-hoc schema
  GIVEN a world where `gadgetSchema` (an object schema) was **never** passed to `withSchema`
  WHEN `world.get(gadgetSchema, { code: "X1" })` is called and then
  `world.get(gadgetSchema, { code: "X1" })` is called a second time
  THEN both calls return the same instance and `registry.count(gadgetSchema) === 1` after the
  second call (the first call stored the record even though the schema was not registered).

### B6-R4: predicate wins over matchers on conflicting keys

On the create path, where a predicate key also has a matcher (or key-based/schema-based
generator) for the same field, the predicate value MUST win — consistent with how
`overrides` override matchers in `generate` today.

- Scenario: predicate overrides a matcher
  GIVEN a world where `productSchema` is registered with a matcher that sets
  `sku` to `"AUTO-SKU"`
  WHEN `world.get(productSchema, { sku: "WIDGET-42" })` is called and no record with that sku
  exists yet
  THEN the returned record's `sku` is `"WIDGET-42"` (the predicate value), not `"AUTO-SKU"`.

### B6-R5: multiple matches resolve to the first in insertion order

When more than one stored record satisfies every key in `predicate`, `get` MUST return the
record stored earliest (registry insertion order), consistent with `registry.find` (B4-R4).

- Scenario: earliest matching record wins
  GIVEN a world where two `productSchema` records are stored that both have
  `category === "tools"` — the first stored has `n === 1`, the second `n === 2`
  WHEN `world.get(productSchema, { category: "tools" })` is called
  THEN it returns the first-stored record (`n === 1`), not the second.

### B6-R6: deterministic for a given seed and call sequence

For a fixed seed, the same sequence of `get` calls MUST produce identical records on every
run and machine; the create-on-miss path is deterministic because it delegates to `generate`
(Rules: determinism via per-field PRNG `fork`).

- Scenario: identical records across two worlds with the same seed
  GIVEN two worlds created independently with `createWorld({ seed: 7 })`, each with the same
  `productSchema` registration
  WHEN each world runs the identical sequence
  `get(productSchema, { sku: "A" })` then `get(productSchema, { sku: "B" })`
  THEN the two worlds' results are deeply equal pairwise
  (`worldX.results` `toEqual` `worldY.results`).

### B6-R7: idempotent for the same predicate

Calling `get(schema, predicate)` twice with the same predicate MUST return the same instance:
the first call generates-and-stores (miss), the second call resolves via the find path.

- Scenario: second call returns the first call's instance
  GIVEN a world (seed `3`) with no `productSchema` record having `sku === "ONCE"`
  WHEN `const a = world.get(productSchema, { sku: "ONCE" })` then
  `const b = world.get(productSchema, { sku: "ONCE" })` are called
  THEN `a === b` (same instance) and `registry.count(productSchema) === 1` (only one record
  was created across both calls).

### B6-R8: nested-object predicate keys compared by deep equality

A predicate key whose value is a nested object MUST be matched by **deep** equality against
the record's value for that key (consistent with the deep-merge semantics `overrides` uses),
not by reference identity.

- Scenario: nested-object predicate matches by value
  GIVEN a world that has stored a `nodeSchema` record whose `meta` field deep-equals
  `{ region: "eu", zone: 1 }`
  WHEN `world.get(nodeSchema, { meta: { region: "eu", zone: 1 } })` is called with a
  *different object instance* that deep-equals that `meta`
  THEN it returns the existing stored record (a value match), and does not generate a new one
  (`registry.count(nodeSchema)` is unchanged).

### B6-R9: absent or empty predicate returns the first existing record, else generates one

When the predicate is **absent** (`get(schema)`) or **empty** (`get(schema, {})`), `get` MUST
behave identically: return the first stored record for `schema` if any exist, and otherwise
generate-and-store one and return it — equivalent in behaviour to
`registry.all(schema)[0] ?? <generate-and-store one>`. (Both forms have no keys, so under
B6-R2's "every key present in `predicate`" rule every record trivially matches and the first
existing record is the natural result; this requirement pins that behaviour rather than
throwing.)

- Scenario: no-argument call returns the first existing record
  GIVEN a world where two `productSchema` records are stored (first has `n === 1`)
  WHEN `world.get(productSchema)` is called with no second argument
  THEN it returns the first-stored record (`n === 1`) and `registry.count(productSchema)` is
  unchanged.

- Scenario: empty predicate returns the first existing record
  GIVEN a world where two `productSchema` records are stored (first has `n === 1`)
  WHEN `world.get(productSchema, {})` is called
  THEN it returns the first-stored record (`n === 1`) and `registry.count(productSchema)` is
  unchanged (identical to the no-argument call above).

- Scenario: empty/absent predicate with an empty registry generates one
  GIVEN a world (seed `5`) with no stored `productSchema` records
  WHEN `world.get(productSchema, {})` is called — and equivalently `world.get(productSchema)`
  with no argument
  THEN it returns a freshly generated, schema-valid product
  (`productSchema.safeParse(result).success === true`) and `registry.count(productSchema)`
  becomes `1`.

## Out of scope

- A function-style predicate (`get(schema, fn)`). That is deliberately `registry.find(schema, fn)`
  (no auto-create); `get` is value-shape only, per the card's "Why a `Partial` predicate"
  rationale.
- A throwing or `Result`-typed variant of `get`. The single contract is "find or generate";
  callers wanting "any record or throw" use `registry.pick`, and "lookup that may be absent"
  use `registry.find`.
- Removing a record, updating an existing record's non-key fields to match a later predicate,
  or any mutation of already-stored records. `get` either returns an existing record as-is or
  creates a new one.
- Cross-schema lookup, or lookup by schema *string* name — the registry is keyed by schema
  object reference (same constraint as B4).
- Changes to `registry.find`, `generate`, `populate`, or the resolution-order pipeline beyond
  adding `get` and ensuring the created record is stored.
- The naming alternative `findOrGenerate` — `get` is adopted (see Open questions).

## Open questions

- **Nested-object predicate equality (deep vs reference) — Non-blocking.** Adopted as **deep**
  equality in B6-R8, for consistency with the deep-merge semantics `overrides` already uses;
  reference equality would make multi-field predicates with object values nearly unusable.
  The implementation has structural-equality helpers available and the existing `find`
  predicate is an arbitrary function, so this is straightforward. Recorded, not blocking.

- **Name `get` vs `findOrGenerate` — Non-blocking.** Adopted as **`get`**, per the card and
  GitHub issue #4 (short, reads naturally), with the dual behaviour documented prominently in
  `docs/api-reference.md`. Recorded, not blocking.

- **Multiple matches → first — Non-blocking.** Adopted as **first in insertion order** in
  B6-R5, consistent with `registry.find` (B4-R4). Recorded, not blocking.

No blocking open questions remain; the spec can advance to `test-writer`.
