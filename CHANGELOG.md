# zod4-mock

## 0.7.0

### Minor Changes

- **`world.explain(schema)`** — read-only, PRNG-neutral debug helper that returns per-field generator + reason for any object schema, with a `toString()` formatter for paste-able output. Surfaces declared relations (and their `where` predicates). Also regenerates `docs/key-heuristics.md` with every exact-key entry, every pattern rule, and the Dutch-localised aliases. (closes #17)

- **`world.populateFrom(derivedSchema, sourceSchema, predicate?, factory?)`** — declarative one-per-source population for derived schemas. Iterates the source registry (snapshotted at entry), calls `generate(D, { source })` per surviving record, returns `this`. Idempotent via the new derived-schema identity. (closes #13)

- **`world.populate(schema, count, factory?)`** — optional per-record factory `(i) => GenerateOptions<TSchema>` for N named records. Two-arg form unchanged. (closes #14)

- **Identity-preserving derivation.** `world.generate(DerivedSchema, { source })` is now a per-`(DerivedSchema, source)` upsert by default — same `source` returns the same record by reference; the registry is written exactly once. Opt out with `{ unique: false }`; declare `sourceKey: 'id'` on `withSchema` for look-alike-source identity. (closes #8)

- **`relations: { schema, where }` object form.** Predicate filters the candidate pool for `ctx.related` and `ctx.related.many`; runs once per `(record, relation)` snapshot then cached (no PRNG on cache hits). Empty filtered pool throws with a remediation message. The bare-schema form (`relations: { post: PostSchema }`) is unchanged. (closes #11)

- **`world.generate(schema, { store: false })`** — opt out of registry storage for ephemeral generation. Propagates through nested generation. `world.get` and `world.populate` ignore it (they're write-the-registry methods by contract). (closes #10)

- **Asymmetric registry typing.** Registry reads (`all`/`pick`/`filter`/`find`) and `world.get` now return `z.infer<T>` (output shape); `store`, matchers, and `overrides` still accept `input<T>`. No casts at read sites. Mirrors `z.coerce`. Non-breaking in practice. (closes #7, #16)

- **`Prng.pick(readonly T[])` overload** returning `T | undefined`; existing strict-tuple form preserved. (closes #15)

- For schemas registered via `withSchema`, the registry now holds the **post-transform** value — same as the value `world.generate` returns. Previously the two diverged for transform-bearing schemas.

### Patch Changes

- Fix: nested-object overrides no longer skip the matcher. The matcher runs and the override is deep-merged on top (matcher-only leaves preserved). Same fix applies to the per-schema key map and custom world-level generator branches; primitives and arrays keep replace semantics. (closes #12)

- Updated dependencies:
  - `@zod4-mock/locale-core@0.3.0`

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
