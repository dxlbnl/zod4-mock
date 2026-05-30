---
"zod4-mock": patch
---

Fix `world.generate(primaryArraySchema.min(N).max(M))` silently ignoring the caller's `.min()` / `.max()` / `.length()` modifiers on a primary-registered (`withSchema`) inner schema. `WorldImpl.generateArray`'s primary-mode arm used `.min` / `.max` only to compute the auto-provision **floor** (how many records to top the registry up to) but unconditionally returned the entire `registry.all(innerSchema)` — so `world.populate(S, 6)` followed by `world.generate(S.array().min(2).max(2))` returned 6 instead of 2. The fix honours caller-side bounds by slicing the returned array to the caller's `.max()` / `.length()`; the library-side `defaultArrayLength[1]` fallback is intentionally NOT applied, so an unbounded `world.generate(S.array())` against a 10-record registry still returns all 10.

```ts
const Product = z.object({ id: z.uuid(), name: z.string() });
const world = createWorld({ seed: 1 }).withSchema(Product);
world.populate(Product, 6);

world.generate(Product.array().min(2).max(2)).length; // before: 6 — after: 2
world.generate(Product.array().length(3)).length;     // before: 6 — after: 3
world.generate(Product.array()).length;               // before: 6 — after: 6 (unchanged)
```

(closes #25)
