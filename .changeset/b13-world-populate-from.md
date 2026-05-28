---
"zod4-mock": minor
---

Add `world.populateFrom(derivedSchema, sourceSchema, predicate?, factory?)` — the declarative counterpart to `world.populate` for derived schemas:

```ts
// Before — hand-rolled loop:
for (const order of world.registry.filter(OrderSchema, (o) => o.status === "shipped")) {
  world.generate(ShippedOrderSummarySchema, { source: order });
}

// After:
world.populateFrom(ShippedOrderSummarySchema, OrderSchema, (o) => o.status === "shipped");
```

`populateFrom` iterates the source bucket (snapshotted at call start) and calls `world.generate(derivedSchema, { source: record })` once per record matching the optional `predicate`. Returns `this` for fluent chaining.

- **`predicate`** is typed `(item: z.infer<TSource>) => boolean` — the output shape, consistent with B7's registry reads and B11's `relations.where`. No cast needed inside the predicate body.
- **`factory`** is per-source: `(source: z.infer<TSource>) => GenerateOptions<z.infer<TDerived>>`. Distinct from `populate`'s index-based factory — `populateFrom` is source-driven by design (the factory receives the source record itself). The return flows through the delegated `generate` call — `overrides` win and `transform` runs last.
- **Idempotence is inherited from B8**'s per-`(derivedSchema, identity(source))` upsert: re-running `populateFrom` with the same arguments leaves the registry unchanged after the first call (same references, same order). Safe to call from test setup or a dev server's re-init.
- **Always writes**, like `populate`. A factory's `store: false` is silently stripped.

(closes #13)
