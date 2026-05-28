---
"zod4-mock": minor
---

Add an optional per-record factory to `world.populate`:

```ts
world.populate(UserSchema, 6, (i) => ({ overrides: USER_PROFILES[i] }));
```

The factory receives the 0-based index and returns `GenerateOptions<TSchema>` for that record. The existing two-arg form (`populate(schema, count)`) is unchanged. Deterministic for a given seed + factory output.

Also: for schemas registered via `withSchema`, the value stored in the registry now equals the value returned by `world.generate` — including any `options.transform`. Previously `generate` returned the transformed value while the registry held the pre-transform value, silently diverging from the documented read-side `z.infer<T>` shape. (closes #14)
