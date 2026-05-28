# B8: Derived schemas (`from:`) should be 1:1 / identity-preserving with their source

## Context

A schema registered with `from: SourceSchema` ("derived") is today purely **structural** —
the matcher receives `ctx.source`, but `world.generate(derivedSchema, { source: x })`
called twice with the same `x` produces two separate derived records and stores both in
the registry. The implicit 1:1 contract between source and derivation is silently broken:
`world.registry.count(derivedSchema)` grows past the source count, every re-run of setup
duplicates derived records, and a request-handler that re-derives on each call inflates
the registry over time. The repro on the item card pins the failure:
`world.generate(UserProfileSchema, { source: user })` twice yields `a !== b` and
`registry.count === 2`.

This item makes derivation **identity-preserving**: for a `from:`-registered schema,
`world.generate(DerivedSchema, { source: x })` is an **upsert keyed by
`(DerivedSchema, identity(x))`** — the first call generates and stores; every subsequent
call with the same identity returns the same stored instance by reference. Identity
defaults to **reference equality on `source`** (the common case — `world.registry.pick`
hands out the same references on every read). For look-alike inputs (e.g. `{ ...user }`
reconstructed in a request handler with the same `id`), schemas may declare an explicit
`sourceKey: <field>` on `withSchema` so identity uses `source[sourceKey]`. An opt-out
`{ unique: false }` on `GenerateOptions` lets callers explicitly request a fresh derived
record per call ("many derivations from one source").

This spec composes with three recently-landed siblings — all of whose contracts B8 must
preserve:

- **B7 — registry output typing**
  ([wiki/specs/B7-registry-output-typing.md](B7-registry-output-typing.md)) — registry
  reads return `z.infer<T>` (output shape); writes / matchers / `GenerateOptions.overrides`
  stay input-typed (B7-R5). B8 adds new options on `SchemaOpts` (`sourceKey?: keyof input<TSource>`)
  and `GenerateOptions` (`unique?: boolean`); neither tightens the existing input/output
  asymmetry.
- **B10 — `{ store: false }` opt-out**
  ([wiki/specs/B10-generate-store-opt-out.md](B10-generate-store-opt-out.md)) — when
  `effectiveStore === false` for the outer call, B8 MUST suppress **both** the upsert
  *lookup* and the upsert *write* (B8-R7). Otherwise a default-mode call after a
  `store: false` call could return a derived record whose entry says "in registry" but
  isn't — a fresh class of stored-vs-returned divergence that D8 was introduced to
  eliminate.
- **B14 — `populate` factory**
  ([wiki/specs/B14-world-populate-factory.md](B14-world-populate-factory.md)) — `populate`
  already strips `store: false` from factory returns; B8 inherits that path unchanged.
  A future `world.populateFrom` item (B13) will be built on top of B8's idempotent
  generate-with-source path (recorded under Out of scope here).

**Architecture's binding Rules apply unchanged.** Per `wiki/architecture.md`'s Rules:

- D1 — no `any`; `.js` import extensions on any new imports.
- D3 — Zod v4 internals stay accessed via `_zod.def`; no change in B8.
- D4 — per-field PRNG determinism is preserved; B8 short-circuits the **upsert side
  effect**, never the PRNG. (When the upsert hits an existing record, generation is
  bypassed entirely — see B8-R1's scenario; no PRNG draw is made and the registry write
  is not re-issued. This is **scoped to the upsert hit path** and does not regress D4 for
  any first call or non-upsert call.)
- D5 — public API change (`sourceKey` on `SchemaOpts`, `unique` on `GenerateOptions`)
  MUST update `docs/api-reference.md` in the same step (B8-R10).
- D7 — `prepublishOnly` is unrelated to this item.
- D8 — for `withSchema`-registered schemas, stored equals returned (including
  `transform`). B8 preserves D8 by storing the post-transform value into the upsert map
  itself (B8-R6) — the same value returned to the caller and stored in the registry. The
  upsert map becomes a per-pair pointer **into** the registry's bucket; a registry record
  and its upsert entry MUST hold the same reference.

**Where the upsert map lives.** A new private field on `WorldImpl` (analogous to
`relationPools` / `lazyCache`) — a `Map<ZodTypeAny, Map<unknown, unknown>>` keyed by
derived schema reference at the outer level, and by source identity at the inner level
(reference for the default, `source[sourceKey]` for the opt-in case). The map MUST be
scoped to a single world instance — a new `createWorld({ seed })` MUST start with an
empty upsert map (no cross-world leakage).

**Where the upsert lookup/write fires.** In `WorldImpl.generateSingleItem`'s
`sourceOverride !== undefined` branch (`src/world.ts`, the path
`world.generate(DerivedSchema, { source })` flows through today). The lookup runs before
`generateDerivedRecord` is invoked; the write runs after the post-transform record is
produced and before it's returned. The write is **suppressed** under
`effectiveStore === false` (B8-R7) and **skipped** under `unique: false` (B8-R4).

Item card: [wiki/backlog/doing/B8-derived-schemas-identity.md](../backlog/doing/B8-derived-schemas-identity.md).
Closes GitHub issue #8.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B8-R1: per-`(derivedSchema, source)` upsert by default (reference identity)

For a schema registered with `from: SourceSchema` and **no** `sourceKey`, calling
`world.generate(DerivedSchema, { source: x })` MUST be an upsert keyed by
`(DerivedSchema, x)` using **reference equality** on `x` as the identity. The first such
call MUST generate-and-store a derived record (today's behaviour) and remember the
mapping. Every subsequent call with a reference-equal `source: x` for the same
`DerivedSchema` MUST return the **same instance** (`===`) as the first call, MUST NOT
re-invoke the generation pipeline (matchers / key-based / schema-based), and MUST NOT
write a second copy to the registry.

- Scenario: same-source upsert returns the same instance
  GIVEN `UserSchema = z.object({ id: z.uuid(), email: z.string() })` and
  `UserProfileSchema = z.object({ userId: z.uuid(), bio: z.string() })`, a world
  `createWorld({ seed: 42 }).withSchema(UserSchema).withSchema(UserProfileSchema, { from: UserSchema, matchers: { userId: (ctx) => ctx.source.id } })`,
  and one stored user `world.populate(UserSchema, 1); const user = world.registry.pick(UserSchema);`
  WHEN the consumer calls
  `const a = world.generate(UserProfileSchema, { source: user });`
  followed by `const b = world.generate(UserProfileSchema, { source: user });`
  THEN `a === b` (reference equality), `world.registry.count(UserProfileSchema) === 1`,
  and `a.userId === user.id` (the matcher's value is preserved).

- Scenario: upsert is observable in the registry
  GIVEN the same setup as above
  WHEN the consumer calls `world.generate(UserProfileSchema, { source: user });` twice
  THEN `world.registry.all(UserProfileSchema)` has length 1 and its single element
  `===` the returned value of both calls.

### B8-R2: upsert is per `(derivedSchema, source)` pair — multiple derivations from one source are independent

When two different derived schemas are both registered `from: SourceSchema`, calling
`world.generate(DerivedA, { source: x })` and `world.generate(DerivedB, { source: x })`
with the same `x` MUST produce **two** records — one stored under `DerivedA`, one under
`DerivedB`. The upsert key is the pair `(derivedSchema, identity(source))`, never the
identity alone; an entry under one derived schema MUST NOT short-circuit a generation
for a different derived schema.

- Scenario: two derived schemas from one source generate independent records
  GIVEN `UserSchema = z.object({ id: z.uuid(), email: z.string() })`,
  `UserProfileSchema = z.object({ userId: z.uuid(), bio: z.string() })`, and
  `UserSummarySchema = z.object({ userId: z.uuid(), title: z.string() })`,
  a world registered with `UserSchema` as primary plus
  `withSchema(UserProfileSchema, { from: UserSchema, matchers: { userId: (ctx) => ctx.source.id } })`
  and
  `withSchema(UserSummarySchema, { from: UserSchema, matchers: { userId: (ctx) => ctx.source.id } })`,
  and one stored `user`
  WHEN the consumer calls
  `const profile = world.generate(UserProfileSchema, { source: user });` and
  `const summary = world.generate(UserSummarySchema, { source: user });`
  THEN `profile !== summary` (different schemas, different records),
  `world.registry.count(UserProfileSchema) === 1` and
  `world.registry.count(UserSummarySchema) === 1`,
  and `profile.userId === user.id && summary.userId === user.id`.

### B8-R3: upsert persists across later calls within the same world

The upsert map MUST be retained on the `WorldImpl` instance (analogous to
`relationPools` / `lazyCache`) so a derived-with-source call made later in the same
world — after arbitrary intervening work (other `generate` / `populate` / `get` calls
on other schemas) — MUST still resolve to the existing derived record. The map MUST
NOT be cleared by any operation other than the world going out of scope. Different
worlds (separate `createWorld` invocations) MUST have separate upsert maps (no
cross-world identity leakage).

- Scenario: upsert survives intervening generation on other schemas
  GIVEN the setup from B8-R1
  WHEN the consumer calls
  `const a = world.generate(UserProfileSchema, { source: user });`,
  then performs unrelated work
  `world.populate(UserSchema, 3); world.generate(z.array(UserSchema).length(2));`,
  then calls `const b = world.generate(UserProfileSchema, { source: user });`
  THEN `a === b` (same instance returned after intervening work),
  `world.registry.count(UserProfileSchema) === 1`.

- Scenario: separate worlds have separate upsert maps
  GIVEN two independently created worlds `worldA = createWorld({ seed: 42 }).withSchema(UserSchema).withSchema(UserProfileSchema, { from: UserSchema, matchers: { userId: (ctx) => ctx.source.id } });`
  and `worldB` constructed the same way; and `const userA = (worldA.populate(UserSchema, 1), worldA.registry.pick(UserSchema));`
  WHEN the consumer calls `worldA.generate(UserProfileSchema, { source: userA });`
  THEN `worldB.registry.count(UserProfileSchema) === 0` (the upsert in `worldA` does
  not leak into `worldB`).

### B8-R4: `{ unique: false }` opt-out bypasses the upsert and generates a fresh record

`GenerateOptions<T>` MUST gain an optional `unique?: boolean` field. When the caller
passes `{ source: x, unique: false }` to `world.generate(DerivedSchema, ...)`, the
upsert lookup MUST be **bypassed** (no `(derivedSchema, identity)` read) AND the upsert
map MUST NOT be written (no `(derivedSchema, identity)` write) for that call. The call
MUST run the full generation pipeline and MUST store the new record in the registry
(subject to B10's `store: false`, which is independent). The default semantics MUST be
**`unique: true`** — an absent `unique` field, or explicit `unique: true`, behaves as
B8-R1 (upsert). The flag is a plain boolean; no other shape (object, enum, function)
MUST be introduced.

```ts
export interface GenerateOptions<T> {
  // … existing fields …
  readonly store?: boolean;
  /**
   * When `false`, bypass the derived-schema upsert keyed by `(schema, source)`:
   * generate a fresh record even if a derived record already exists for this
   * source. Has no effect on schemas without `from:`. Default `true` (upsert).
   */
  readonly unique?: boolean;
}
```

No `any` MUST appear in the new field. No cast MUST be required at the call site.

- Scenario: `unique: false` produces two distinct records from the same source
  GIVEN the B8-R1 setup with one stored `user`
  WHEN the consumer calls
  `const before = world.registry.count(UserProfileSchema);`,
  then `const a = world.generate(UserProfileSchema, { source: user, unique: false });`,
  then `const b = world.generate(UserProfileSchema, { source: user, unique: false });`,
  then `const after = world.registry.count(UserProfileSchema);`
  THEN `a !== b` (distinct instances), `after - before === 2` (registry grew by 2),
  and `a.userId === user.id && b.userId === user.id` (matcher still applied to both).

- Scenario: `unique: false` does not pollute the upsert map for later default calls
  GIVEN the same setup, and after a `unique: false` call has produced one fresh record
  WHEN the consumer then calls `world.generate(UserProfileSchema, { source: user });`
  (default — upsert mode) for the **first time** with that `user`
  THEN the returned record is a freshly generated upsert-stored record (not equal by
  reference to either of the two `unique: false` records produced before — those were
  never registered in the upsert map), and `world.registry.count(UserProfileSchema)`
  increases by 1 compared to the post-`unique: false` count. A subsequent default-mode
  call with the same `user` returns the same instance as this one (B8-R1).

### B8-R5: configurable `sourceKey` for look-alike source identity

`SchemaOpts` MUST gain an optional `sourceKey?: keyof input<TSource> & string` field
(typed against the `TSource` generic already present on `SchemaOpts`; no `any`). When a
derived schema is registered with `from: SourceSchema, sourceKey: '<field>'`, the
upsert identity for that schema MUST use `source[sourceKey]` (rather than the source
reference). A second `{ source }` call whose source is a **different reference** but
whose `source[sourceKey]` equals the first call's `source[sourceKey]` MUST resolve to
the same existing derived record. When `sourceKey` is **absent**, identity falls back
to reference equality (B8-R1). `sourceKey` MUST be declared at registration time on
`withSchema`; it MUST NOT be overridable per `generate` call.

```ts
export interface SchemaOpts<
  TSchema extends ZodTypeAny,
  TSource extends ZodTypeAny | undefined = undefined,
  TRelations extends Record<string, ZodTypeAny> = Record<never, never>,
> {
  from?: TSource;
  /** Identity field on the source record. Defaults to reference equality on `source`. */
  sourceKey?: TSource extends ZodTypeAny ? keyof input<TSource> & string : never;
  relations?: TRelations;
  matchers?: { /* unchanged */ };
}
```

- Scenario: `sourceKey: 'id'` resolves a reconstructed look-alike to the same record
  GIVEN `UserSchema = z.object({ id: z.uuid(), email: z.string() })`,
  `UserProfileSchema = z.object({ userId: z.uuid(), bio: z.string() })`, and a world
  `createWorld({ seed: 42 }).withSchema(UserSchema).withSchema(UserProfileSchema, { from: UserSchema, sourceKey: 'id', matchers: { userId: (ctx) => ctx.source.id } })`,
  with one stored user `world.populate(UserSchema, 1); const user = world.registry.pick(UserSchema);`
  WHEN the consumer calls
  `const a = world.generate(UserProfileSchema, { source: user });`,
  then constructs a look-alike `const lookAlike = { ...user };` so that
  `lookAlike !== user` but `lookAlike.id === user.id`,
  then calls `const b = world.generate(UserProfileSchema, { source: lookAlike });`
  THEN `a === b` (same instance — identity resolved via `id`, not reference),
  `world.registry.count(UserProfileSchema) === 1`.

- Scenario: without `sourceKey`, a look-alike is a different identity
  GIVEN the B8-R1 setup (no `sourceKey` declared) with one stored `user`
  WHEN the consumer calls
  `const a = world.generate(UserProfileSchema, { source: user });`, then constructs
  `const lookAlike = { ...user };`, then calls
  `const b = world.generate(UserProfileSchema, { source: lookAlike });`
  THEN `a !== b` (different identity — reference equality is the default),
  `world.registry.count(UserProfileSchema) === 2`.

### B8-R6: D8 holds — stored record equals returned record, including `transform`

For a derived schema with `from:`, the value the upsert map holds, the value stored in
the registry, and the value returned by `world.generate(DerivedSchema, { source })` MUST
be the **same reference**, including any `options.transform` applied to that call. The
transform MUST be applied **inside** the derived-record generation path
(`generateDerivedRecord`'s existing transform-apply, today guarded by `transformApplied`
in `generateSingleItem`) **before** the upsert write to the registry and to the upsert
map. D8's "registry storage equals `generate`'s return value" rule MUST continue to
hold for derived schemas after B8.

- Scenario: transform-bearing derived call — stored value equals returned value
  GIVEN the B8-R1 setup
  WHEN the consumer calls
  `const r = world.generate(UserProfileSchema, { source: user, transform: (p) => ({ ...p, bio: "T" }) });`
  THEN `r.bio === "T"` (transform applied to return value),
  `world.registry.all(UserProfileSchema).length === 1`, and
  `world.registry.all(UserProfileSchema)[0] === r` (the **stored reference** equals the
  returned reference — D8 holds).

- Scenario: upsert returns the transformed reference on a follow-up call
  GIVEN the same world after the previous scenario
  WHEN the consumer calls `world.generate(UserProfileSchema, { source: user });` again
  (no transform argument — the first call's transformed record is the existing
  upsert entry)
  THEN the returned value `===` the record from the previous scenario (`r.bio === "T"`
  on the second-call return). The follow-up call MUST NOT re-run the transform; it
  returns the cached upsert reference.

### B8-R7: `store: false` interaction — both upsert lookup and upsert write suppressed

When `world.generate(DerivedSchema, { source: x, store: false })` is called (i.e.
B10's `effectiveStore === false`), the call MUST:

- **NOT** consult the upsert map for an existing `(DerivedSchema, identity(x))` entry —
  every `store: false` derived call is fresh.
- **NOT** write the resulting derived record into the upsert map — the map MUST stay
  consistent with the registry (an entry in the map MUST correspond to a record in the
  registry's bucket; allowing a `store: false` write into the map would let a later
  default-mode call return a record that doesn't exist in the registry,
  contradicting D8).
- **NOT** write the resulting derived record into the registry (B10-R2 — already
  enforced; B8 inherits it).

A `store: false` derived call MUST still apply matchers, overrides, and transform, and
MUST return the generated value to the caller (B10-R2 invariants preserved). A
**subsequent default-mode** call with the same `source` and `derivedSchema` MUST
behave as if the `store: false` call had never happened — i.e. it MUST hit the upsert
on a previously-stored entry, or generate-and-store fresh if none exists.

- Scenario: `store: false` derived call is fresh and does not write to the upsert map
  GIVEN the B8-R1 setup with one stored user, and the upsert map empty for
  `UserProfileSchema`
  WHEN the consumer calls
  `const a = world.generate(UserProfileSchema, { source: user, store: false });`,
  then `const b = world.generate(UserProfileSchema, { source: user, store: false });`
  THEN `a !== b` (each `store: false` call is fresh),
  `world.registry.count(UserProfileSchema) === 0` (B10-R2 — no writes),
  and a **subsequent** `const c = world.generate(UserProfileSchema, { source: user });`
  (default mode) MUST run generation freshly (no upsert hit on a phantom entry),
  result in `world.registry.count(UserProfileSchema) === 1`, and `c !== a && c !== b`.

- Scenario: existing upsert entry is NOT returned by a `store: false` call
  GIVEN the B8-R1 setup with one stored user, and a prior default-mode call
  `const a = world.generate(UserProfileSchema, { source: user });` has populated the
  upsert map
  WHEN the consumer calls
  `const b = world.generate(UserProfileSchema, { source: user, store: false });`
  THEN `b !== a` (the upsert lookup was skipped — `store: false` is always fresh),
  `world.registry.count(UserProfileSchema) === 1` (unchanged — `b` was not stored),
  and a subsequent default-mode call returns `a` again (the upsert entry is intact).

### B8-R8: `world.get` is unaffected — predicate path stays the predicate path

`World.get(schema, predicate?)` is a find-or-create primitive over the registry's
predicate-matching path (B6, B10-R5) — **not** the derivation path. B8 MUST NOT change
its behaviour: `world.get` MUST continue to search the registry by predicate; on the
create path it MUST continue to call its internal `generate(...)` with `store: true`
(B10-R5) and MUST store the result. `world.get` MUST NOT consult or write the B8
upsert map.

- Scenario: `world.get` on a derived schema does not consult the upsert map
  GIVEN the B8-R1 setup, one stored user, and a prior
  `world.generate(UserProfileSchema, { source: user });` having populated the upsert
  map for that `(DerivedSchema, user)`
  WHEN the consumer calls `world.get(UserProfileSchema, { userId: user.id });` (note: a
  predicate, **not** a `source`)
  THEN the call returns the existing stored record (B6-R7 / B10-R5 — predicate match
  in the registry); `world.registry.count(UserProfileSchema)` remains `1`; and the
  upsert map is **not** modified (the count of derived records produced is unchanged).

### B8-R9: determinism preserved — upsert short-circuit does not re-draw the PRNG

When the upsert hits an existing record (B8-R1), the call MUST NOT consume any PRNG
state (no `fork`, no `int`, no record-PRNG construction for that source). When the
upsert misses (first call, `unique: false`, or `store: false`), generation MUST proceed
exactly as today — same field-PRNG forks, same value sequence — so the **first**
default-mode call's stored value for a given `(DerivedSchema, source)` MUST be
byte-identical across runs of the same world seed and same call order. (D4 holds: the
short-circuit is a registry/cache hit, not a PRNG variant.)

- Scenario: upsert short-circuit does not shift PRNG-consuming siblings
  GIVEN two worlds `worldA` and `worldB`, each constructed
  `createWorld({ seed: 42 }).withSchema(UserSchema).withSchema(UserProfileSchema, { from: UserSchema, matchers: { userId: (ctx) => ctx.source.id } });`,
  each populated with one identical user (same seed → same `user`)
  WHEN `worldA` calls
  `worldA.generate(UserProfileSchema, { source: userA });` once, then
  `worldA.generate(UserSchema);` (a new top-level primary generation), and `worldB`
  calls `worldB.generate(UserProfileSchema, { source: userB });` **twice** (the
  second is an upsert hit), then `worldB.generate(UserSchema);`
  THEN `worldA`'s second `UserSchema` value and `worldB`'s third `UserSchema` value are
  byte-identical (`JSON.stringify` deep-equal) — the upsert hit in `worldB`
  consumed no PRNG state, so subsequent generation in both worlds stays in lockstep.

### B8-R10: `docs/api-reference.md` updated in the same step

The public API additions in B8 — `sourceKey?` on `SchemaOpts` (line ~146 of
`docs/api-reference.md`) and `unique?: boolean` on `GenerateOptions` (line ~772) — MUST
be reflected in `docs/api-reference.md` in the same change (Rules: D5). Specifically:

- The `.withSchema` subsection (line ~113) MUST document `sourceKey` with a one-line
  description (identity field on the source record; defaults to reference equality on
  `source`) and a short example illustrating the `{...user}` look-alike case.
- The `.generate` subsection (line ~221) MUST mention the new identity semantics for
  derived schemas: by default, `world.generate(DerivedSchema, { source: x })` is an
  upsert keyed by `(DerivedSchema, identity(x))`.
- The `GenerateOptions` section (line ~772) MUST list `unique?: boolean` with default
  `true`, a one-line description (opt out of derived-schema upsert), and the
  interaction with `store: false` (a `store: false` call is always fresh — see
  B8-R7).

- Scenario: docs reflect the new options and identity semantics
  GIVEN the B8 change applied
  WHEN `docs/api-reference.md` is read
  THEN the `.withSchema` block lists `sourceKey?` with a default-reference-equality
  note and a look-alike example; the `.generate` block notes upsert-by-source for
  derived schemas; the `GenerateOptions` block lists `unique?: boolean` (default `true`)
  with a one-line opt-out description and cross-references B8-R7's `store: false`
  interaction.

### B8-R11: changeset entry created in the same step

A changeset MUST be created at `.changeset/b8-derived-schemas-identity.md` recording
B8 as a `"zod4-mock": minor` bump with a user-facing summary covering: (a) per-pair
upsert by default (`world.generate(DerivedSchema, { source })` is now idempotent), (b)
`{ unique: false }` opt-out for "many derivations from one source", and (c) the new
`sourceKey` option for look-alike identity. The changeset MUST include `(closes #8)`
on its final line, matching the convention of the sibling changesets
(`.changeset/b10-*.md`, `.changeset/b14-*.md`).

- Scenario: changeset file exists and has the required shape
  GIVEN the B8 change applied
  WHEN `.changeset/b8-derived-schemas-identity.md` is read
  THEN its frontmatter has `"zod4-mock": minor`; the body summarises the upsert
  default, the `unique: false` opt-out, and the `sourceKey` option; and the final
  non-empty line is `(closes #8)`.

## Out of scope

- **`world.populateFrom` (B13)** — a future item that re-runs setup idempotently for
  every source record. B13 will be built on top of B8's idempotent
  `world.generate(DerivedSchema, { source })`, but B8 does not introduce any
  `populateFrom`-shaped API; no requirement here covers it.
- **B11 "filtered relations" 1:1 over time** — the item card notes B8 pairs with B11;
  B8 makes the underlying derivation 1:1, but B11's own filtering rules are out of
  scope for this spec.
- **Auto-`unique: false` heuristics** — the upsert is always opt-in to bypass; there is
  no behaviour that *infers* a need to break identity (e.g. by `overrides` content).
  Callers who want a fresh record pass `unique: false` explicitly.
- **Composite `sourceKey`** (an array of fields, or a function). `sourceKey` is a
  **single key name** on the source's input shape. If a future item needs composite
  identity it can extend this; B8 does not.
- **Identity caching for primary (non-`from:`) schemas.** B8 is only about derived
  schemas. A primary `world.generate(PersonSchema)` call has no `source` and no upsert
  semantics; today's behaviour stands.
- **Renaming or removing the existing `source?: any` field on `GenerateOptions`.** Per
  B7-R5, the write side stays input-typed; tightening `source` is out of scope. (The
  type-cast at the read site in `WorldImpl.generateSingleItem` is preserved as today.)
- **A method `world.derive(DerivedSchema, source)` or similar.** The option-on-`generate`
  shape composes with `overrides` / `transform` / `unique` / `store`; no new method
  is introduced.
- **Clearing the upsert map mid-world** (a `world.resetDerivedCache()` or similar). The
  map lives for the world's lifetime; create a new world to reset. No requirement
  covers a clear operation.
- **`{ unique: false }` on non-derived schemas** — the flag is observable only on a
  derived schema with a `source` argument. On a primary schema, `unique` has no
  effect (recorded under the field's doc but not asserted as a separate scenario:
  primary generation has no upsert to bypass).
- **Throwing on a missing `sourceKey` field at runtime.** If a caller declares
  `sourceKey: 'id'` and then passes a `source` whose `.id` is `undefined`, the
  upsert key becomes `undefined`; the behaviour is "all such sources collapse to a
  single entry under `undefined`". B8 does not introduce a runtime validation pass
  on `sourceKey` — the field is typed at registration (B8-R5's `keyof input<TSource>`
  signature) and the TypeScript compiler catches the common misuse. (Recorded under
  Open questions / non-blocking below.)

## Open questions

- **Reference equality vs `sourceKey` — Non-blocking.** The item card poses this as the
  identity model. Both forms are provided in B8: reference equality is the default
  (B8-R1) and `sourceKey` is the opt-in escape hatch (B8-R5). Recorded; not blocking.

- **Opt-out form (`{ unique: false }` vs an alternative API) — Non-blocking.** The card
  proposes `{ unique: false }` as the opt-out for "many derivations from one source";
  adopted as such in B8-R4. The option composes with `overrides` / `transform` /
  `store` (the same `GenerateOptions` record) and keeps the public surface flat; no
  new method (`world.deriveFresh(...)`) is needed. Recorded; not blocking.

- **Runtime guard for a missing `sourceKey` field on the source record — Non-blocking.**
  When `sourceKey: 'id'` is declared and a caller passes a `source` whose `.id` is
  `undefined`, the upsert key collapses to `undefined` and all such sources share one
  entry. B8 documents the behaviour but does not add a runtime throw; the TypeScript
  signature (`keyof input<TSource> & string`) catches the common cases at compile time.
  A future item MAY add a runtime guard if a real call site is found that suffers from
  this. Recorded; not blocking.

No blocking open questions remain; the spec can advance to `test-writer`.
