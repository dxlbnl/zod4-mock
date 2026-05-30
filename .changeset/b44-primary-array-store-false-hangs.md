---
"zod4-mock": patch
---

Fix infinite-loop hang in `world.generate(primaryArraySchema, { store: false })` against a primary-registered (`withSchema`) inner schema. `generateArray`'s primary-mode arm bounded its `while` loop on `registry.count(innerSchema) < target`, but under `store: false` (B10-R2/R4 transitive suppression) `generateAndStorePrimary` never writes — so the count never advanced past `existingCount` and the loop spun forever whenever the rolled `target` exceeded `existingCount`. The fix decouples the loop's progress counter from the registry under `!effectiveStore`: generate `target` records directly via `Array.from` and return them. The store-on path is byte-identical.

Before:

```ts
const schema = z.object({ id: z.string(), name: z.string() });
const world = createWorld({ seed: 1 });
world.withSchema(schema, { matchers: { name: () => "x" } });

world.generate(schema.array(), { store: false }); // HANGS forever
```

After:

```ts
const result = world.generate(schema.array(), { store: false });
// returns promptly; result.length in [1, 5] (default auto-roll range);
// result.every(r => r.name === "x") === true; registry untouched.
```

(closes #26)
