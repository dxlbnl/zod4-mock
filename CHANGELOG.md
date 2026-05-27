# zod4-mock

## 0.6.1

### Patch Changes

- Re-ship `registry.find`, `ctx.related.many`, and `world.get`. These landed in source for 0.6.0 but were missing from the published 0.6.0 tarball, which was built from a stale `dist/`. 0.6.1 publishes them for real. A `prepublishOnly` build step now guards against publishing a stale build.

## 0.6.0

### Minor Changes

- Add three lookup/relation primitives for cross-referencing mocked data:

  - **`registry.find(schema, predicate)`** — returns the first stored record matching the predicate (insertion order), or `undefined`. A pure, non-mutating lookup that complements `filter`/`pick`. (#2)
  - **`ctx.related.many(name, count)`** — picks `count` distinct related records inside a matcher, auto-provisioning the shortfall, record-scoped and deterministic. `ctx.related` is now a callable object: the existing single-pick `ctx.related(name)` is unchanged. (#3)
  - **`world.get(schema, predicate?)`** — find-or-create by domain key: returns an existing record where every predicate key matches, or generates one with the predicate applied as overrides, stores it, and returns it. Idempotent for the same predicate and deterministic. The predicate is optional — `world.get(schema)` returns the first existing record, generating one if none exist. (#4)

## 0.5.0

### Minor Changes

- Setup extensible locales

### Patch Changes

- Updated dependencies
  - @zod4-mock/locale-core@0.2.0
