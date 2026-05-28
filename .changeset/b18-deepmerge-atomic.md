---
"zod4-mock": patch
---

Fix: `deepMerge` (the helper behind every `overrides` merge — the B12 in-step matcher / key-map / key-based branches, the per-element `generateArray` branch, and the `generateSingleItem` final-pass) no longer recurses into non-plain objects. Previously, overriding a `z.date()` (or `z.instanceof(Map)` / `Set` / `RegExp` / any class-instance) field returned `{}` because `Object.keys(new Date())` is `[]` and `{ ...new Date() }` is `{}`, silently dropping the value. `deepMerge` now treats any value whose prototype is not `Object.prototype` or `null` as a leaf and returns it verbatim by reference; plain-object literals and `Object.create(null)` dicts still merge key-by-key as before. (closes #19)

```ts
const Event = z.object({ id: z.string(), at: z.date() });

const e = world.generate(Event, {
  overrides: { id: "evt-1", at: new Date("2024-01-01T00:00:00Z") },
});

e.at instanceof Date; // true   (was: false — `e.at` was `{}`)
e.at.toISOString();   // "2024-01-01T00:00:00.000Z"
```
