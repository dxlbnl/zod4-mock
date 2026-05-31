---
id: B13
title: Add `world.populateFrom(derivedSchema, sourceSchema, predicate?)`
type: feature
priority: medium
flags: [review]
created: 2026-05-28
spec: wiki/specs/B13-world-populate-from.md
---

## Description

Setting up a derived schema today requires manually iterating the source registry and
calling `world.generate` per source record — re-inventing the natural counterpart to
`world.populate(schema, count)`. Worth a primitive. (GitHub issue #13.)

```ts
// Before — hand-rolled loop:
for (const order of world.registry.filter(OrderSchema, (o) => o.status === "shipped")) {
  world.generate(ShippedOrderSummarySchema, { source: order });
}

// After — declarative:
world.populateFrom(ShippedOrderSummarySchema, OrderSchema, (o) => o.status === "shipped");
```

## Proposal

```ts
world.populateFrom<TDerived extends ZodTypeAny, TSource extends ZodTypeAny>(
  derivedSchema: TDerived,
  sourceSchema: TSource,
  predicate?: (item: z.infer<TSource>) => boolean,
): this;
```

Semantics:

- Iterates `world.registry` for `sourceSchema` (filtered by `predicate` if given).
- For each source record, calls `world.generate(derivedSchema, { source: record })`.
- Returns `this` for fluent chaining (like `populate`).

## Example

```ts
const OrderSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "shipped", "cancelled"]),
  amount: z.number(),
});

const ShippedOrderSummarySchema = z.object({
  orderId: z.uuid(),
  shippedAmount: z.number(),
  label: z.string(),
});

world.withSchema(OrderSchema);
world.populate(OrderSchema, 30);

world.withSchema(ShippedOrderSummarySchema, {
  from: OrderSchema,
  matchers: {
    orderId: (ctx) => ctx.source.id,
    shippedAmount: (ctx) => ctx.source.amount,
  },
});

// One declarative line — populates a summary per shipped order:
world.populateFrom(ShippedOrderSummarySchema, OrderSchema, (o) => o.status === "shipped");
```

## Variants / extensions

- Without a predicate: one derived record per source record across the entire pool.
- A `take`/`limit` arg for "first N matching sources" — small extension.
- Pairs naturally with **B14 per-record factory** — same factory shape would let
  consumers tweak per-source overrides.

## Pairs with

- **B11 filtered relations** — same predicate shape both in `relations.where` and
  `populateFrom`'s third arg.
- **B8 identity-preserving derived schemas** — re-running `populateFrom` is safe; each
  source record produces the same derived record. Tests / dev servers can re-init
  without duplicates.

## Open questions (resolve in spec)

- Predicate runs over `input<T>` or `z.infer<T>`? Should match **B7** — `z.infer<T>`.
- Should this also accept an `unregistered ad-hoc` `sourceSchema` (e.g. read from
  `registry.all` even if `withSchema` wasn't called)? Probably yes — the registry is
  keyed by reference regardless.

## Notes

- Public API change (adds `World.populateFrom`) → update `docs/api-reference.md`.
