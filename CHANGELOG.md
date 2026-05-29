# zod4-mock

## 0.8.0

### Minor Changes

- 0a1d5d2: Decompose `WorldImpl.generateSingleItem`'s four-branch cascade into named
  private methods (`generateWithSourceOverride`, `generateDerivedAutoSource`,
  `generatePrimary`, `generateAdHoc`), each readable end-to-end. The thin
  dispatcher routes by mode and applies the trailing overrides + transform.

  Also closes B21 — the no-source-derived branch (`world.generate(DerivedSchema)`
  with no `{ source }`) now stores the generated derived record by default,
  symmetric with the with-source path that B8 made store-by-default in 0.7.0.
  Previously the asymmetry meant `for (let i = 0; i < N; i++) world.generate(D)`
  left the Derived registry empty; now it stores N derived records (sharing the
  one auto-provisioned source per the existing round-robin). The store is gated
  on `effectiveStore`, so `world.generate(D, { store: false })` still
  suppresses both source and derived writes (B10/B20 unchanged).

  (closes B21)

- 8703c0a: Fix silent-drop bug in `world.generate(arraySchema, { overrides })` against primary-registered inner schemas. Previously, per-index `overrides` were silently ignored — the call returned `world.registry.all(innerSchema)` without applying any of the per-record overrides, and a second call on a "full" registry was a no-op. The call now throws an `Error` naming `world.populate(schema, count, factory)` as the right API. The ad-hoc (unregistered) array path, `world.populate`, and calls without `overrides` are unchanged.

  Before:

  ```ts
  world.withSchema(ProductSchema);
  world.generate(ProductSchema.array().min(4).max(4), {
    overrides: Array.from({ length: 4 }, () => ({ category: "alpha" })),
  });
  // returns [{...}, {...}, {...}, {...}] — `category` is NOT "alpha", silent failure
  ```

  After:

  ```ts
  // throws: Per-index overrides on a primary-registered array schema are not supported …
  //         Use world.populate(schema, count, factory) instead.

  // Recommended pattern:
  world.populate(ProductSchema, 4, () => ({
    overrides: { category: "alpha" },
  }));
  ```

  (closes #22)

- ba232fe: **Behaviour change — PRNG sequences shift for ad-hoc, array, and outer-wrapper paths.** Downstream snapshot tests against `world.generate(unregistered)`, `world.generate(schema.array(...))`, or `world.generate(schema.optional()/nullable())` will produce different (still-deterministic) values. Registered primary and derived paths are unchanged.

  Strengthen PRNG determinism so call order across distinct schemas no longer affects any value. Previously, `world.generate(X)` after `world.generate(Y)` produced a different value than `world.generate(X)` alone — because per-call fork keys were derived from a global generation counter. Now fork keys are derived from a stable per-schema identity (a module-global `WeakMap<ZodTypeAny, number>`) plus a per-schema call slot, so the Nth `generate(X)` on a world always uses the same fork key regardless of what other schemas were generated in between.

  The determinism contract is now **reference-identity-based**: two schemas that are `===` equal share fork keys; two schemas constructed separately (even if structurally identical) do NOT. Construct schemas once at module scope and reuse them — that is the deterministic-output pattern.

  Registered primary and derived paths are unchanged (they already used stable identity-based keys via `reg{id}#{index}` / `dreg{id}#{sourceIndex}`). Ad-hoc generation, array generation, and the outer optional/nullable roll all switch to the new shape.

  For most consumers this is invisible — the in-repo test suite required zero functional re-pins (three tests were restructured to hoist schema construction, preserving their intent under the new contract).

### Patch Changes

- f9ea47d: Promote the per-field generation pipeline to a `PIPELINE` list of named
  `PipelineStep` functions returning a `FieldResolution` tagged union (eight
  `kind` variants). `WorldImpl.generateObjectFields`, `explainSchema`, and
  `generateZodObject` (via the `PIPELINE_NO_REGISTRATION` subset) now all walk
  the same list — three drift-prone implementations collapsed to one canonical
  source of truth.

  Internal refactor; behaviour-neutral. PRNG fork keys and the B12 deep-merge
  contract are preserved byte-identically (every existing seeded test stays
  green without assertion updates), and `world.explain(schema)` output is
  byte-identical to pre-B23. The cleanup payoff: `src/explain.ts` shrinks by
  ~150 LOC (its `decideField` and pattern/identifier helpers fold into the
  pipeline steps' dry-run branches), and `generateObjectFields`'s method body
  drops from 118 LOC to under 50.

  Unblocks B37 (pipeline-numbering doc reconciliation).

- c4abb78: Extract `resolveMode(schema): SchemaMode` and unify the derived/primary/ad-hoc dispatch across `generateSingleItem`, `generateArray`, `populate`, and `populateFrom`. Discriminated union gives exhaustive switching at compile time. Internal refactor; no behaviour change.
- 61be65e: Replace `generateFromSchema`'s 38-case switch with a typed `DISPATCH` table. New Zod types are compile errors if missed. Internal refactor; behaviour unchanged.
- 66b25f1: Split `applyModifiers` into `applyStringModifiers` and `applyNumberModifiers`, with each pipeline pass as a named function. Internal refactor; behaviour unchanged.
- 631086a: Extract `unwrapOptionalChainForField` helper. Two duplicate optional/nullable/default unwrap state machines (in `generateObjectFields` and `generateZodObject`) collapsed to one. Internal refactor; PRNG consumption byte-identical, behaviour unchanged.
- d3d9797: Extract `resolveLazyChain` helper (4 duplicate `while (d.type === "lazy")` loops collapsed to one). Internal refactor; behaviour unchanged.
- c2b7825: Extract `resolveRelationPool` shared between `resolveRelated` and `resolveRelatedMany` (twin methods, ~80% duplicate). Internal refactor; PRNG fork keys + `where` filter behaviour unchanged.
- d4e9b0a: Encapsulate the `effectiveStore` push/pop pattern as a private `withEffectiveStore(value, fn)` helper. Internal refactor; behaviour unchanged.
- dca70c3: Replace `generateZodString`'s 22-arm format chain with a `FORMAT_GENERATORS` dispatch table at file top. Internal refactor; check-format ordering and fallback path unchanged.
- 6e03302: Build `DEFAULT_KEY_MAP`'s 10 text-aware aliases programmatically via a `TEXT_ALIASES` constant. Internal refactor; resulting map is byte-identical, no behaviour change.
- 9717326: Replace `bindGenerators`'s double-Proxy machinery with an eagerly-bound object built once per `makeFieldCtx`. Drops two pre-existing `Record<string, any>` types and the runtime Proxy overhead. B40's locale-forwarding contract is preserved verbatim, including the bucket-2 (`person.firstName`/`middleName`/`fullName`/`prefix`) no-args-only locale-forwarding semantics. Internal refactor; no behaviour change.
- d30e0de: Fix `ctx.gen.<ns>.<fn>()` silently falling back to `defaultLocale` instead of honouring the world's configured `locale`. Previously, matcher calls like `ctx.gen.word.noun()` produced English Markov / `TECH_WORDS` output even when the world was created with a non-default locale — the `bindGenerators` proxy only forwarded the per-field PRNG, so the `ctx?` parameter every locale-aware helper accepts was always `undefined`.

  The fix injects the active `GeneratorContext` into the proxy as the default `ctx` argument for every helper whose signature accepts one. Helpers that don't take ctx (e.g. `ctx.gen.internet.ip()`, `ctx.gen.string.uuid()`) are unaffected. Users who already adopted the documented workaround (`ctx.gen.word.noun(ctx)`) continue to work without modification — explicit ctx still wins.

  For `person.firstName(genderOrCtx?)`, `person.middleName`, `person.fullName`, and `person.prefix`, locale forwarding only kicks in when the caller passes **no** arguments — the Gender-string and explicit-ctx forms are preserved verbatim. The Gender-string-without-locale case is left for the follow-up `bindGenerators` rewrite (B36).

  (closes #23)

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
