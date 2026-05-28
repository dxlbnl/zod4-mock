# B13: Add `world.populateFrom(derivedSchema, sourceSchema, predicate?, factory?)`

## Context

Setting up a derived schema today requires the consumer to hand-roll the loop that
`world.populate(schema, count)` already encapsulates for primary schemas: iterate the
source records, call `world.generate(DerivedSchema, { source: record })` per record, repeat.
The item card pins the friction:

```ts
// Before — hand-rolled loop:
for (const order of world.registry.filter(OrderSchema, (o) => o.status === "shipped")) {
  world.generate(ShippedOrderSummarySchema, { source: order });
}

// After — declarative:
world.populateFrom(ShippedOrderSummarySchema, OrderSchema, (o) => o.status === "shipped");
```

This item adds the missing primitive. `populateFrom` is the natural counterpart to
`populate` for derived schemas: it iterates a *source* bucket, calls
`world.generate(derivedSchema, { source: record })` once per record (or per record matching
an optional `predicate`), and returns `this` for fluent chaining. The whole behaviour
delegates to `world.generate`'s existing `sourceOverride` branch — `populateFrom` is the
loop, nothing more.

Item card: [wiki/backlog/doing/B13-world-populate-from.md](../backlog/doing/B13-world-populate-from.md).
Closes GitHub issue #13.

### How this spec sits on the just-landed siblings

The siblings B7 / B8 / B10 / B11 / B14 frame what `populateFrom` does and does not need to
re-do. Reading the contracts together makes the surface area small:

- **B7 — registry output typing** ([wiki/specs/B7-registry-output-typing.md](B7-registry-output-typing.md)).
  Registry reads return `z.infer<T>` (output shape). The source-side iteration in
  `populateFrom` MUST therefore type the predicate parameter and the factory parameter as
  `z.infer<TSource>` — that is what the consumer sees when looking at the source records.
  Writes / `overrides` stay input-typed (B7-R5); the factory returns
  `GenerateOptions<TDerived>` which carries `overrides: DeepPartial<input<TDerived>>` per
  today's typing (untouched).
- **B8 — derived-schema identity** ([wiki/specs/B8-derived-schemas-identity.md](B8-derived-schemas-identity.md)).
  `world.generate(DerivedSchema, { source })` is now a per-`(derivedSchema, identity(source))`
  upsert by default (B8-R1). Because `populateFrom` delegates to `world.generate(...)` per
  source record, **idempotence on a second `populateFrom` call comes entirely from B8** —
  this spec does **not** add its own dedup logic, and re-running `populateFrom` with the
  same arguments leaves the registry unchanged after the first run (B13-R4).
- **B10 — `store: false` opt-out** ([wiki/specs/B10-generate-store-opt-out.md](B10-generate-store-opt-out.md)).
  `populateFrom`'s contract, like `populate`'s, is to write derived records into the
  registry. There is no opt-out for storage on `populateFrom`. The per-call factory MUST
  NOT be allowed to suppress storage via `store: false` (B13-R8 — mirrors B10-R6 for
  `populate`).
- **B11 — `relations` predicate shape** ([wiki/specs/B11-relations-predicate-filter.md](B11-relations-predicate-filter.md)).
  B11's `relations.where` predicate is typed `(item: z.infer<RelationSchema>) => boolean`
  — the same shape this spec adopts for `populateFrom`'s predicate (B13-R1, B13-R5). The
  same input shape, the same B7 read contract, the same no-`any`-no-cast story.
- **B14 — `populate` factory** ([wiki/specs/B14-world-populate-factory.md](B14-world-populate-factory.md)).
  `world.populate` already accepts a per-record `factory?: (index: number) => GenerateOptions<TSchema>`.
  `populateFrom` adopts an **analogous** factory but with **different semantics**: the
  factory's first argument is the **source record** (`z.infer<TSource>`), not a numeric
  index — the natural shape for source-driven per-record overrides (e.g.
  `overrides: { label: \`summary-${source.id.slice(0,6)}\` }`). This is the per-source
  factory pattern the B13 card calls out under "Pairs naturally with B14." (B13-R9.)

### Where `populateFrom` fits in `src/`

- **Public interface** —
  [src/types.ts](../../src/types.ts) `interface World` (line 264 onwards). The new method
  sits next to `populate` (line 346).
- **Implementation** —
  [src/world.ts](../../src/world.ts) `WorldImpl`. The body iterates
  `this.registry.all(sourceSchema)` (B7-typed `z.infer<TSource>[]`) — taking a **snapshot
  by spread** at the start of the call so a side-effecting matcher cannot influence the
  iteration mid-loop (B13-R6) — applies the `predicate` if given, and for each surviving
  source record calls `this.generate(derivedSchema, { source, ...factoryReturn })`. The
  upsert behaviour comes from `generateSingleItem`'s `sourceOverride !== undefined` branch
  unchanged (B8-R1; see `src/world.ts` lines 998–1055).

### Architecturally significant scoping decisions

- **Iteration order = registry insertion order.** `populateFrom` iterates
  `this.registry.all(sourceSchema)` directly. `SchemaRegistry.all` returns the underlying
  bucket in **insertion order** ([src/registry.ts](../../src/registry.ts) lines 24–26). The
  order of the produced derived records is therefore deterministic and equals the order in
  which source records were stored. This is consistent with `registry.find`'s "first
  match" semantics (B4) and with the implicit ordering everywhere else in the library.
- **Idempotence comes entirely from B8.** A second `populateFrom(D, S, p?)` call iterates
  the same source set and re-issues the same `world.generate(D, { source })` calls; B8's
  upsert short-circuits each one to the existing derived record. `populateFrom` does NOT
  carry its own "has this been run?" guard.
- **Factory semantics — source not index.** The factory parameter is the source record
  (`z.infer<TSource>`), not a numeric index. This is intentionally **different** from
  B14's `populate` factory (whose first arg is `i: number`). Rationale: per-source-driven
  control is the whole reason `populateFrom` exists; passing a bare index would force
  every factory to re-look-up the source from the iteration. The signatures look similar
  but the inputs differ — documented in B13-R9 and the API reference (B13-R10).
- **Snapshot semantics.** `populateFrom` reads the source bucket **once** at the start of
  the call (B13-R6). A matcher invoked during the iteration MAY store new source records
  via `world.registry.store(sourceSchema, ...)`, but those will NOT be picked up by the
  same `populateFrom` call — they are visible to the *next* call. This mirrors
  B11-R5's "within-record snapshot is stable" but applied across the whole `populateFrom`
  call.

### Architecture's binding Rules apply unchanged

Per [wiki/architecture.md](../architecture.md)'s Rules:

- **D1** — no `any` in the new `populateFrom` signature or its body; `.js` import
  extensions on any new imports.
- **D5** — public API change → `docs/api-reference.md` MUST be updated in the same step
  (B13-R10).
- **D7** — `prepublishOnly` is unrelated to this item.
- **D8** — for `withSchema`-registered derived schemas, stored equals returned. Because
  `populateFrom` delegates to `world.generate(DerivedSchema, { source })` per record, D8
  is inherited unchanged: B8-R6 already pins it for the derived path.
- **D9** — cache short-circuits stay PRNG- and counter-neutral. `populateFrom` itself
  introduces no cache layer; per-source delegation to `world.generate` is whatever
  `generateSingleItem`'s B8 upsert path already does. A re-run hits the upsert
  short-circuit per source — PRNG-neutral per B8-R9.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B13-R1: `World.populateFrom` is added to the public interface

The `World` interface in [src/types.ts](../../src/types.ts) MUST gain a new method
`populateFrom` whose signature is:

```ts
populateFrom<TDerived extends ZodTypeAny, TSource extends ZodTypeAny>(
  derivedSchema: TDerived,
  sourceSchema: TSource,
  predicate?: (item: z.infer<TSource>) => boolean,
  factory?: (source: z.infer<TSource>) => GenerateOptions<z.infer<TDerived>>,
): this;
```

`WorldImpl` MUST implement it. No `any` MUST appear in the public signature, in the
internal body, or be required at any call site. The `predicate` parameter MUST be typed
`(item: z.infer<TSource>) => boolean` — the output shape, consistent with B7-R1 (registry
reads) and B11's predicate shape. The `factory` parameter MUST be typed
`(source: z.infer<TSource>) => GenerateOptions<z.infer<TDerived>>` — the same source the
predicate filtered on, returning `GenerateOptions` exactly as `world.generate` accepts.
Both parameters MUST remain optional and independently omissible (predicate-only,
factory-only, and the three-arg base form all type-check).

- Scenario: signature is present and well-typed
  GIVEN the project after B13 is applied
  WHEN a consumer writes
  `const world = createWorld({ seed: 1 }).withSchema(OrderSchema).withSchema(SummarySchema, { from: OrderSchema, matchers: { orderId: (ctx) => ctx.source.id } });`
  followed by
  `world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");`
  and `pnpm typecheck` is run
  THEN `pnpm typecheck` exits 0 with no `any` in the signature; the predicate's
  `o` parameter is inferred as `z.infer<typeof OrderSchema>` (e.g. its `status` is the
  enum literal type); the call returns the world (B13-R3); and no cast appears at the
  call site.

- Scenario: `populateFrom` is omissible per-argument
  GIVEN the same world setup
  WHEN a consumer writes any of:
  `world.populateFrom(SummarySchema, OrderSchema);`,
  `world.populateFrom(SummarySchema, OrderSchema, (o) => o.amount > 0);`,
  `world.populateFrom(SummarySchema, OrderSchema, undefined, (s) => ({ overrides: { label: s.id } }));`,
  or
  `world.populateFrom(SummarySchema, OrderSchema, (o) => o.amount > 0, (s) => ({ overrides: { label: s.id } }));`
  and `pnpm typecheck` is run
  THEN every form exits 0 — both `predicate` and `factory` are optional and may be
  supplied independently.

### B13-R2: iterates the (predicate-filtered) source registry, one `generate` per record

When called, `populateFrom(derivedSchema, sourceSchema, predicate?, factory?)` MUST:

1. Take a **snapshot** of the source bucket at the start of the call by reading
   `this.registry.all(sourceSchema)` (post-B7 output shape) **once** and copying the
   result into a local array (B13-R6 pins the snapshot semantics).
2. If `predicate` is supplied, filter that snapshot to records for which
   `predicate(record)` returns truthy.
3. For each surviving record `record`, invoke
   `this.generate(derivedSchema, { source: record, ...(factory ? factory(record) : {}) })`
   exactly once, in the order yielded by the snapshot (== registry insertion order).
4. Discard the returned derived records (the call's value is `this`; the records land in
   the registry via `generate`'s normal storage path — B8-R1 / D8).

The implementation MUST NOT consult or filter any bucket other than the source bucket
(`sourceSchema`'s), and MUST NOT call `world.populate` or `generateAndStorePrimary`
directly — every derived record passes through the same `world.generate(derivedSchema, {
source })` code path the consumer would call themselves.

- Scenario: predicate filters; one derived record per surviving source
  GIVEN
  `OrderSchema = z.object({ id: z.string(), status: z.enum(["pending", "shipped", "cancelled"]), amount: z.number() })`,
  `SummarySchema = z.object({ orderId: z.string(), shippedAmount: z.number() })`,
  a world `createWorld({ seed: 7 }).withSchema(OrderSchema).withSchema(SummarySchema, { from: OrderSchema, matchers: { orderId: (ctx) => ctx.source.id, shippedAmount: (ctx) => ctx.source.amount } });`,
  and 30 orders pre-populated via `world.populate(OrderSchema, 30)` with a deterministic
  distribution of statuses such that exactly `K` orders satisfy `o.status === "shipped"`
  (K is recoverable at runtime via `world.registry.filter(OrderSchema, (o) => o.status === "shipped").length`)
  WHEN the consumer calls
  `world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");`
  THEN `world.registry.count(SummarySchema) === K` (exactly one Summary per shipped
  order, no Summary for non-shipped orders); for every stored Summary `s`, there exists
  a shipped order `o` with `s.orderId === o.id && s.shippedAmount === o.amount`; and no
  Summary's `orderId` matches a non-shipped order's `id`.

- Scenario: no predicate — one derived record per source record
  GIVEN the same `OrderSchema` / `SummarySchema` setup with 4 orders pre-populated
  (any statuses)
  WHEN the consumer calls
  `world.populateFrom(SummarySchema, OrderSchema);`
  THEN `world.registry.count(SummarySchema) === 4` and the produced Summaries' `orderId`
  values, in insertion order, deep-equal the source orders' `id` values in insertion
  order.

- Scenario: produced derived records appear in source-insertion order
  GIVEN the same setup with 5 shipped orders pre-populated, captured as
  `const shipped = world.registry.filter(OrderSchema, (o) => o.status === "shipped");`
  WHEN the consumer calls
  `world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");`
  THEN `world.registry.all(SummarySchema).map(s => s.orderId)` deep-equals
  `shipped.map(o => o.id)` — order preserved.

### B13-R3: returns `this` for fluent chaining

`populateFrom` MUST return the world instance (`this`) on completion — the same fluent
convention as `populate` (B14-R6) and `withSchema`. Callers MUST be able to chain
further methods after `populateFrom`.

- Scenario: `populateFrom` returns the world
  GIVEN the B13-R2 world with orders pre-populated
  WHEN the consumer calls
  `const returned = world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");`
  THEN `returned === world` (reference equality), and a fluent chain
  `world.populateFrom(SummarySchema, OrderSchema).populate(OrderSchema, 1)` type-checks
  and runs.

### B13-R4: idempotence — re-running `populateFrom` leaves the registry unchanged

Because `populateFrom` delegates to `world.generate(derivedSchema, { source })` per
source record, and that call is the per-`(derivedSchema, identity(source))` upsert
defined by B8-R1, calling `populateFrom(...)` twice with the same arguments on the same
world MUST leave the derived bucket **unchanged** after the first call — same record
count, same record references, same insertion order. `populateFrom` MUST NOT introduce
its own dedup logic and MUST NOT bypass the B8 upsert (it MUST NOT pass
`{ unique: false }` on its delegated `generate` calls).

- Scenario: two consecutive `populateFrom` calls leave the registry unchanged after the first
  GIVEN the B13-R2 setup with 30 orders of which K are shipped, and one prior call
  `world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");`
  WHEN the consumer captures
  `const beforeCount = world.registry.count(SummarySchema);`
  and
  `const beforeRefs = [...world.registry.all(SummarySchema)];`,
  then calls
  `world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");` a
  second time
  THEN `world.registry.count(SummarySchema) === beforeCount` (no growth);
  `world.registry.all(SummarySchema).length === beforeRefs.length`; and for every index
  `i`, `world.registry.all(SummarySchema)[i] === beforeRefs[i]` (same record
  references — the upsert short-circuit returned the cached entries).

- Scenario: `populateFrom` does NOT pass `unique: false`
  GIVEN the same setup with one prior `populateFrom` call and one specific shipped
  order `o` whose Summary `s = world.registry.find(SummarySchema, (x) => x.orderId === o.id)!`
  WHEN the second `populateFrom` call runs, and afterwards the consumer reads the
  Summary for the same order:
  `const sAfter = world.registry.find(SummarySchema, (x) => x.orderId === o.id);`
  THEN `sAfter === s` (same reference — upsert hit). If `populateFrom` had bypassed the
  B8 upsert with `unique: false`, a fresh Summary would have been written and `sAfter
  !== s`. The reference equality pins that `populateFrom` MUST NOT bypass the upsert.

### B13-R5: predicate parameter type alignment with B7 / B11

The `predicate` parameter MUST be typed `(item: z.infer<TSource>) => boolean` —
identical in shape to B11's `relations.where`. At the call site the predicate's
parameter MUST be inferred as `z.infer<typeof SourceSchema>` (the **output** shape per
B7-R1, B11-R1), and no cast and no `any` MUST be required to read source-record fields
inside the predicate body.

- Scenario: predicate parameter is `z.infer<TSource>` — coerce field reads as output
  GIVEN
  `OrderSchema = z.object({ id: z.string(), placedAt: z.coerce.date(), amount: z.number() })`
  (a coerce field — its `input<>` is `unknown`, its `z.infer<>` is `Date`),
  `SummarySchema = z.object({ orderId: z.string() })`,
  and a world `createWorld({ seed: 1 }).withSchema(OrderSchema).withSchema(SummarySchema, { from: OrderSchema, matchers: { orderId: (ctx) => ctx.source.id } });`
  with orders pre-populated
  WHEN the consumer writes
  `world.populateFrom(SummarySchema, OrderSchema, (o) => o.placedAt.getTime() > 0);`
  and runs `pnpm typecheck`
  THEN `pnpm typecheck` exits 0 — inside the predicate, `o.placedAt` is typed `Date`
  (the output shape) so `.getTime()` compiles with no cast; no `any` is introduced.

### B13-R6: source-bucket iteration uses a snapshot taken at call start

`populateFrom` MUST iterate over a **snapshot** of the source bucket taken at the
start of the call (e.g. `const sources = [...this.registry.all(sourceSchema)];`).
Records added to the source bucket **during** the iteration — by a matcher's side
effect, a derived `from:` chain's auto-provision under
`world.generate(DerivedSchema, { source })`, or any other transitive write — MUST
NOT extend the iteration of the *current* `populateFrom` call. They WILL be visible
to the **next** `populateFrom` call (B13-R4's idempotence still holds: the next call
re-snapshots and the B8 upsert short-circuits already-derived records, while any
newly-added source record produces a new derived record on that next call).

- Scenario: a source record added by a matcher mid-loop is NOT iterated in the same call
  GIVEN
  `OrderSchema = z.object({ id: z.string(), amount: z.number() })`,
  `SummarySchema = z.object({ orderId: z.string(), label: z.string() })`,
  and a world `createWorld({ seed: 1 }).withSchema(OrderSchema).withSchema(SummarySchema, { from: OrderSchema, matchers: { orderId: (ctx) => ctx.source.id, label: (ctx) => { if (world.registry.count(OrderSchema) < 5) { world.registry.store(OrderSchema, { id: \`extra-${world.registry.count(OrderSchema)}\`, amount: 0 }); } return "L"; } } });`
  with exactly 3 orders pre-populated
  WHEN the consumer calls `world.populateFrom(SummarySchema, OrderSchema);`
  THEN `world.registry.count(SummarySchema) === 3` (only the 3 originally-snapshot
  orders produced Summaries — the mid-loop side-effect inserts did NOT add to this
  call's iteration), and `world.registry.count(OrderSchema)` MAY be greater than 3
  (the side-effect inserts went through, just not into this iteration's pool).

- Scenario: side-effect-added source records appear in the NEXT `populateFrom` call
  GIVEN the same world after the previous scenario
  (`world.registry.count(SummarySchema) === 3`, `world.registry.count(OrderSchema) >= 3`)
  WHEN the consumer calls `world.populateFrom(SummarySchema, OrderSchema);` a second time
  THEN `world.registry.count(SummarySchema) === world.registry.count(OrderSchema)` —
  every order now has a Summary; B13-R4's idempotence holds for the originally-derived
  Summaries (same references) and new Summaries land for the side-effect-added orders.

### B13-R7: determinism preserved across runs with the same seed

For two independently created worlds with the same `seed`, the same `withSchema`
registrations, the same source-population sequence, and the same `populateFrom` call
sequence with the same predicate and factory (whose return is the same for the same
source record), the produced derived records MUST be byte-identical: same count, same
order, same field values. D4 (per-field PRNG determinism) is preserved end-to-end
because `populateFrom` does not introduce its own PRNG draw — every derived record's
PRNG forks descend from the existing `generateDerivedRecord` path.

- Scenario: same seed → byte-identical derived bucket
  GIVEN two worlds `worldA` and `worldB` constructed independently with the same seed,
  the same `OrderSchema` + `SummarySchema` registrations, both populated with 10 orders
  via `world.populate(OrderSchema, 10)`
  WHEN `worldA.populateFrom(SummarySchema, OrderSchema, (o) => o.amount > 0);` is
  called, and the same call is made on `worldB`
  THEN `JSON.stringify(worldA.registry.all(SummarySchema)) === JSON.stringify(worldB.registry.all(SummarySchema))`
  (deep-equal stringified bodies, identical ordering).

### B13-R8: `populateFrom` always writes — no `store: false` opt-out

`populateFrom` is a write primitive (like `populate`). It MUST NOT accept a top-level
`store: false` flag, and if the optional `factory` (B13-R9) returns
`GenerateOptions` whose `store` field is `false`, that field MUST be **silently
stripped** before the options reach the delegated `world.generate` call — mirroring
B10-R6's "factory's `store: false` ignored" rule for `populate`. Every derived record
produced by `populateFrom` MUST land in the registry.

- Scenario: factory `store: false` ignored — derived records still stored
  GIVEN the B13-R2 setup with 4 orders pre-populated
  WHEN the consumer calls
  `world.populateFrom(SummarySchema, OrderSchema, undefined, (s) => ({ store: false, overrides: { label: s.id } }));`
  THEN `world.registry.count(SummarySchema) === 4` (the `store: false` was a no-op);
  every stored Summary's `label` equals its source order's `id` (B13-R9 — the factory's
  other fields still flow through).

### B13-R9: per-source factory composes with the source record

When the optional `factory` is supplied, `populateFrom` MUST invoke it once per
surviving source record (after `predicate`), passing the source record itself as the
sole argument, and MUST pass the factory's return value through to the delegated
`world.generate(derivedSchema, { source, ...factoryReturn })` call. The factory's
fields (`overrides`, `transform`, `unique`, etc.) MUST be honoured by `world.generate`
exactly as if the consumer had passed them themselves, with one exception: `store:
false` is stripped (B13-R8). `populateFrom` MUST NOT inject a `unique: false` of its
own (B13-R4 requires the B8 upsert to apply).

The factory's first argument is the **source record** (`z.infer<TSource>`),
distinct from B14's `populate` factory whose first argument is a numeric index
(`i: number`). This is a deliberate API difference — `populateFrom`'s factory is
source-driven by design.

- Scenario: factory return flows through `generate` (overrides win)
  GIVEN
  `OrderSchema = z.object({ id: z.string(), amount: z.number() })`,
  `SummarySchema = z.object({ orderId: z.string(), label: z.string() })`,
  a world `createWorld({ seed: 1 }).withSchema(OrderSchema).withSchema(SummarySchema, { from: OrderSchema, matchers: { orderId: (ctx) => ctx.source.id } });`,
  and 3 orders pre-populated with distinct `id` values
  WHEN the consumer calls
  `world.populateFrom(SummarySchema, OrderSchema, undefined, (source) => ({ overrides: { label: \`summary-${source.id.slice(0, 6)}\` } }));`
  THEN `world.registry.count(SummarySchema) === 3`; for each Summary `s` there exists
  a unique order `o` with `s.orderId === o.id && s.label === \`summary-${o.id.slice(0, 6)}\``
  (the factory-supplied `overrides.label` wins on every record); and the factory was
  invoked once per surviving source record.

- Scenario: factory receives the source record (not an index)
  GIVEN the same setup
  WHEN the consumer writes
  `const seen: Array<z.infer<typeof OrderSchema>> = []; world.populateFrom(SummarySchema, OrderSchema, undefined, (source) => { seen.push(source); return {}; });`
  THEN `seen.length === 3`, and `seen.map(o => o.id)` deep-equals
  `world.registry.all(OrderSchema).map(o => o.id)` — the factory saw the source records
  in iteration order, not indices.

### B13-R10: `docs/api-reference.md` updated in the same step

The public API addition in B13 (the new `World.populateFrom` method) MUST be
reflected in `docs/api-reference.md` in the same change (Rules → D5). Specifically:

- A new `.populateFrom(derivedSchema, sourceSchema, predicate?, factory?)` subsection
  MUST be added (sibling to `.populate`, after `.populate`'s block at line ~354).
- The signature shown MUST be the full four-arg form pinned in B13-R1, including the
  predicate's `(item: z.infer<TSource>) => boolean` typing and the factory's
  `(source: z.infer<TSource>) => GenerateOptions<z.infer<TDerived>>` typing.
- The doc MUST include a **complete domain-wiring example** drawn from the item card:
  registering an `OrderSchema`, a derived `ShippedOrderSummarySchema` with
  `from: OrderSchema`, populating 30 orders, then the one-line
  `world.populateFrom(ShippedOrderSummarySchema, OrderSchema, (o) => o.status === "shipped");`
  call.
- The doc MUST note: (a) idempotence comes from B8 (re-running is safe — no
  duplicates); (b) the iteration uses a snapshot of the source bucket at call start
  (matchers may add source records mid-loop without affecting this call); (c) the
  factory receives the source record (not an index) — explicitly contrasted with
  `populate`'s factory which receives an index; (d) `populateFrom` always writes (no
  `store: false` opt-out — a factory's `store: false` is silently stripped, mirroring
  `populate`).
- The `.populate` subsection MUST be left unchanged.

- Scenario: docs reflect the new method
  GIVEN the B13 change applied
  WHEN `docs/api-reference.md` is read
  THEN there is a `.populateFrom(derivedSchema, sourceSchema, predicate?, factory?)`
  subsection showing the full signature; the section contains the `OrderSchema` →
  `ShippedOrderSummarySchema` end-to-end example with the `o.status === "shipped"`
  predicate; the notes section calls out B8-derived idempotence, the per-call
  snapshot semantics, the source-record factory contrast with `populate`'s
  index-based factory, and the "always writes" rule mirroring `populate` (factory's
  `store: false` is silently stripped).

### B13-R11: changeset entry created in the same step

A changeset MUST be created at `.changeset/b13-world-populate-from.md` recording B13
as a `"zod4-mock": minor` bump. The body MUST cover (a) the new
`world.populateFrom(derivedSchema, sourceSchema, predicate?, factory?)` signature,
(b) the predicate's `z.infer<TSource>` typing per B7 / B11, (c) the per-source
factory (and its distinction from `populate`'s index-based factory), and (d)
idempotence inherited from B8's per-pair upsert (re-running is safe). The final
non-empty line MUST be `(closes #13)`, matching the convention of the sibling
changesets (`.changeset/b8-*.md`, `.changeset/b10-*.md`, `.changeset/b11-*.md`,
`.changeset/b14-*.md`).

- Scenario: changeset file exists and has the required shape
  GIVEN the B13 change applied
  WHEN `.changeset/b13-world-populate-from.md` is read
  THEN its frontmatter has `"zod4-mock": minor`; its body summarises the new method,
  the predicate typing, the per-source factory (vs `populate`'s index factory), and
  the B8-inherited idempotence; and the final non-empty line is `(closes #13)`.

## Out of scope

- **Auto-provision of source records.** `populateFrom` does NOT generate source records
  when the source bucket is empty. The contract is "iterate what is there." If the
  source bucket is empty (or the predicate filters every record out), `populateFrom`
  produces zero derived records — no throw, no warning, no auto-fill. (Recorded; not
  pinned as a separate scenario — falls out of B13-R2: zero surviving sources ⇒ zero
  delegated `generate` calls.) A future item MAY add a "populate the source first" sugar
  layer.
- **A `take` / `limit` argument** ("first N matching sources"). The card mentions this
  as a small extension — **out of scope** for B13. The consumer can compose this today
  with a predicate that counts via a closure, or by capping `world.registry.all` /
  `world.registry.filter` upstream.
- **Asynchronous predicate or factory.** Both MUST be synchronous, matching
  `world.generate`'s synchronous contract. A `Promise`-returning predicate / factory is
  not supported.
- **Multiple source schemas in one call.** `populateFrom` takes exactly one source
  schema. Cross-schema fan-out is composed by calling `populateFrom` multiple times,
  one per source-derived pair.
- **Non-`from:` derived semantics.** `populateFrom` is the loop-friendly counterpart to
  `world.generate(DerivedSchema, { source })`. If `derivedSchema` is not registered with
  `from:`, the delegated `world.generate` call still flows through
  `generateSingleItem`'s `sourceOverride !== undefined` branch (which uses an
  `EMPTY_REG` for the matcher), but no B8 upsert key is established (B8 only fires for
  registered derived schemas). The card does not pin behaviour for that case and this
  spec does not extend it; consumers SHOULD register the derived schema with `from:` to
  benefit from idempotence.
- **Mutating the source bucket from inside the factory.** Allowed — the factory runs
  inside `world.generate`'s pipeline like any matcher — but the snapshot semantics
  (B13-R6) mean the in-progress iteration is unaffected. No requirement covers a
  side-effect contract beyond what's already documented.
- **Per-call override of source identity (`sourceKey`).** `sourceKey` is declared on
  `withSchema` (B8-R5). `populateFrom` does NOT introduce a per-call sourceKey override;
  the upsert identity for each delegated call is whatever the derived schema's
  registration declares.
- **An eager `forEach`-style API** (`world.eachSource(source, (record) => world.generate(...))`).
  `populateFrom` is the right primitive — the consumer's intent is "populate"; an
  eager-callback API would re-invent `Array.prototype.forEach` without adding value.
- **A `populateFromMany`-style API** for fanning one source out to many derivations
  (`populateFrom(DerivedSchema, SourceSchema, (s) => 5)` returning N records per source).
  The B8 upsert is per-`(DerivedSchema, identity(source))`, so the request is undefined
  for derived schemas as currently scoped. A future item MAY explore it on top of the
  `{ unique: false }` flag (B8-R4); B13 does not.

## Open questions

- **Predicate input type — `input<T>` vs `z.infer<T>`. — Non-blocking.** Adopted as
  `z.infer<T>` per B7-R1 (registry reads are output-shaped) and consistent with B11-R1
  (`relations.where`). Pinned in B13-R1 and B13-R5. The card itself proposed this
  resolution ("Should match B7 — `z.infer<T>`"). Recorded; not blocking.

- **Unregistered ad-hoc source schemas. — Non-blocking.** A `sourceSchema` whose
  registry bucket has been populated by direct `world.registry.store(sourceSchema, ...)`
  calls (no `withSchema(sourceSchema)`) is still iterable by `populateFrom` — the
  iteration reads `this.registry.all(sourceSchema)`, which is keyed by schema reference
  regardless of registration (B6 / B7 convention). The derived schema, however, SHOULD
  be `withSchema`-registered with `from: sourceSchema` to benefit from B8's idempotent
  upsert (B13-R4); without that, every `populateFrom` call freshly generates derived
  records. Recorded; not blocking (callers who want idempotence register the derived
  schema — same as today's `world.generate({ source })` story).

No blocking open questions remain; the spec can advance to `test-writer`.
