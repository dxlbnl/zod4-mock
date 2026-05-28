---
"zod4-mock": minor
---

Derived schemas registered with `from:` are now **identity-preserving** by default: `world.generate(DerivedSchema, { source: x })` is a per-pair upsert keyed by `(DerivedSchema, identity(x))`. Calling it twice with the same `source` returns the same record by reference and writes the registry exactly once — re-running setup, or a request handler that re-derives on each call, no longer inflates the registry past the source count.

```ts
const profile = world.generate(UserProfileSchema, { source: user });
const same = world.generate(UserProfileSchema, { source: user });
profile === same;                                  // true
world.registry.count(UserProfileSchema);           // 1
```

- Identity defaults to **reference equality** on `source`. For look-alike inputs (e.g. `{ ...user }` reconstructed in a request handler), declare `sourceKey: '<field>'` on `withSchema` so identity uses `source[sourceKey]` instead:

  ```ts
  world.withSchema(UserProfileSchema, {
    from: UserSchema,
    sourceKey: "id",
    matchers: { userId: (ctx) => ctx.source.id },
  });
  ```

- Opt out with `{ unique: false }` on `GenerateOptions` for the rare "many derivations from one source" case — the upsert lookup **and** write are bypassed, the call generates a fresh record, and a later default-mode call is unaffected:

  ```ts
  world.generate(UserProfileSchema, { source: user, unique: false });
  ```

- Composes with B10's `{ store: false }`: when `store: false`, both the upsert lookup and the upsert write are suppressed so the map stays consistent with the registry. Every `store: false` derived call is fresh, and a subsequent default-mode call generates-and-stores from scratch.

The post-transform record is the value held by the upsert map, the registry bucket, and the call's return value (D8 — registry storage equals `generate`'s return value). `world.get` is unchanged — it continues to use the predicate-based find-or-create path, never the upsert map.

(closes #8)
