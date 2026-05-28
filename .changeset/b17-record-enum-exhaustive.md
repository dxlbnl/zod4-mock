---
"zod4-mock": patch
---

Fix: `z.record(z.enum([...]), V)` now emits one entry per enum member in declared order, so the generated value satisfies Zod's strict-key inferred type. Previously, `generateZodRecord` unconditionally picked 2–5 random keys regardless of the `keyType`, producing a random subset of the enum's members and silently failing `schema.parse(value)` at the consumer. Open-key `z.record(z.string(), V)` and `z.record(z.number(), V)` are unchanged (still 2–5 random keys, byte-identical at a fixed seed). `z.map`, `z.nativeEnum`, and literal-union key types are deliberately out of scope for this fix. (closes #18)

```ts
const Status = z.enum(["PENDING", "IN_PROGRESS", "DONE"]);
const Counts = z.record(Status, z.number());

const value = generate(Counts);
// value === { PENDING: 42, IN_PROGRESS: 17, DONE: 99 }   (was: { PENDING: 42 })

Counts.parse(value); // ok    (was: ZodError — missing IN_PROGRESS, DONE)
```
