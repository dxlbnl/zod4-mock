---
"zod4-mock": minor
---

Fix silent-drop bug in `world.generate(arraySchema, { overrides })` against primary-registered inner schemas. Previously, per-index `overrides` were silently ignored — the call returned `world.registry.all(innerSchema)` without applying any of the per-record overrides, and a second call on a "full" registry was a no-op. The call now throws an `Error` naming `world.populate(schema, count, factory)` as the right API. The ad-hoc (unregistered) array path, `world.populate`, and calls without `overrides` are unchanged.

Before:

```ts
world.withSchema(ProductSchema);
world.generate(ProductSchema.array().min(4).max(4), {
  overrides: Array.from({ length: 4 }, () => ({ category: "alpha" })),
});
// returns [{...}, {...}, {...}, {...}] — `category` is NOT "alpha", silent failure
```

After:

```ts
// throws: Per-index overrides on a primary-registered array schema are not supported …
//         Use world.populate(schema, count, factory) instead.

// Recommended pattern:
world.populate(ProductSchema, 4, () => ({ overrides: { category: "alpha" } }));
```

(closes #22)
