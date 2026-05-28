# @zod4-mock/locale-core

## 0.3.0

### Minor Changes

- **`Prng.pick(readonly T[])` overload** returning `T | undefined`; existing strict-tuple form preserved. Pins `Prng.shuffle` / `Prng.sample` on the shared interface (the 0.2.0 publish predated them). Adds `prepublishOnly: "pnpm build"` to the locale workspace packages so a stale `dist/` can no longer ship. (closes #15)

## 0.2.0

### Minor Changes

- Setup extensible locales
