# zod4-mock

## 0.7.2

### Patch Changes

- 96537da: Fix `TypeError: Cannot destructure property 'source' of 'pairs[idx]'` thrown from `world.generate(DerivedSchema, { store: false })` when called with no `source` override and an empty `from:` registry. The auto-provisioned source is now captured locally and not written to the registry under `store: false`, honouring B10-R4's transitive suppression.

  (closes #21)

## 0.7.1

### Patch Changes

- da72b78: Fix: `z.record(z.enum([...]), V)` now emits one entry per enum member in declared order, so the generated value satisfies Zod's strict-key inferred type. Previously, `generateZodRecord` unconditionally picked 2–5 random keys regardless of the `keyType`, producing a random subset of the enum's members and silently failing `schema.parse(value)` at the consumer. Open-key `z.record(z.string(), V)` and `z.record(z.number(), V)` are unchanged (still 2–5 random keys, byte-identical at a fixed seed). `z.map`, `z.nativeEnum`, and literal-union key types are deliberately out of scope for this fix. (closes #18)

  ```ts
  const Status = z.enum(["PENDING", "IN_PROGRESS", "DONE"]);
  const Counts = z.record(Status, z.number());

  const value = generate(Counts);
  // value === { PENDING: 42, IN_PROGRESS: 17, DONE: 99 }   (was: { PENDING: 42 })

  Counts.parse(value); // ok    (was: ZodError — missing IN_PROGRESS, DONE)
  ```

- df963b6: Fix: `deepMerge` (the helper behind every `overrides` merge — the B12 in-step matcher / key-map / key-based branches, the per-element `generateArray` branch, and the `generateSingleItem` final-pass) no longer recurses into non-plain objects. Previously, overriding a `z.date()` (or `z.instanceof(Map)` / `Set` / `RegExp` / any class-instance) field returned `{}` because `Object.keys(new Date())` is `[]` and `{ ...new Date() }` is `{}`, silently dropping the value. `deepMerge` now treats any value whose prototype is not `Object.prototype` or `null` as a leaf and returns it verbatim by reference; plain-object literals and `Object.create(null)` dicts still merge key-by-key as before. (closes #19)

  ```ts
  const Event = z.object({ id: z.string(), at: z.date() });

  const e = world.generate(Event, {
    overrides: { id: "evt-1", at: new Date("2024-01-01T00:00:00Z") },
  });

  e.at instanceof Date; // true   (was: false — `e.at` was `{}`)
  e.at.toISOString(); // "2024-01-01T00:00:00.000Z"
  ```

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
