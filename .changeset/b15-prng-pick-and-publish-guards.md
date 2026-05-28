---
"zod4-mock": minor
"@zod4-mock/locale-core": minor
---

`Prng.pick` now accepts a plain `readonly T[]`:

```ts
pick<T>(items: readonly [T, ...T[]]): T;          // existing — non-empty tuple, guaranteed T
pick<T>(items: readonly T[]): T | undefined;      // new — plain arrays / empty
```

Calling `prng.pick(Object.keys(MAP))` no longer needs a `[string, ...string[]]` cast; the existing strict-tuple form is preserved for known-non-empty literal tuples.

Also: pins `Prng.shuffle` and `Prng.sample` on the shared `@zod4-mock/locale-core` interface so the published artifact stays in sync with source (the 0.2.0 npm publish predated these methods). Adds `prepublishOnly: "pnpm build"` to all four locale workspace packages so a stale `dist/` can no longer ship — the same recurrence guard that fixed the root after 0.6.0. (closes #15)
