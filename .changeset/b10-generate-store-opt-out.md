---
"zod4-mock": minor
---

Add an opt-out for registry storage on `world.generate` via a new `store?: boolean` field on `GenerateOptions` (default `true`):

```ts
// Ephemeral generation — matchers + relations + overrides still apply,
// only the registry write is suppressed.
world.generate(SearchBucketSchema, { store: false });
```

- `store: false` propagates through nested generation so inner registered schemas (arrays of registered items, nested objects, relation auto-provisioning) also don't write to the registry. Scope is one outer `generate` call.
- `world.get` ignores `store: false` on its create path — its idempotence contract requires the created record to be discoverable by a later `find`/`get`.
- `world.populate` silently ignores a factory return's `store: false` — `populate`'s purpose is to populate the registry.

(closes #10)
