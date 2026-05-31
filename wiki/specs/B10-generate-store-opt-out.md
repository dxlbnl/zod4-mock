# B10: Add an opt-out for registry storage on `world.generate`

## Context

`world.generate` always stores its result into the registry when the schema is
**registered** (`withSchema`) — either via `generateAndStorePrimary` (primary path) or
`generateDerivedRecord` (derived `from:` path; storage happens in `populate`'s
caller for derived). That default is correct for setup and find-or-create flows
(`populate`, `world.get`, relation auto-provisioning) but wrong for **ephemeral**
generation: building a search-bucket envelope, producing a paginated array for one HTTP
response, generating a one-off fixture in a request handler. Each such call inflates the
registry; over a long-running dev server or many test iterations the bucket grows
unboundedly and skews subsequent `registry.all` / `registry.find` / relation picks. The
standalone `generate` export (in `src/index.ts`) is no-store, but it discards the entire
world setup (matchers, relations, locale) — exactly what the caller wants to keep.

This item adds an opt-out on `GenerateOptions` so the world setup applies (matchers,
relations, locale, overrides, transform), only the **registry write** is suppressed.

Item card: [wiki/backlog/doing/B10-generate-store-opt-out.md](../backlog/doing/B10-generate-store-opt-out.md);
GitHub issue #10.

Touch points in [src/world.ts](../../src/world.ts):

- `WorldImpl.generate` (public entry; threads `options` into `generateArray` /
  `generateSingleItem`).
- `WorldImpl.generateAndStorePrimary` (primary registered path; the `this.registry.store(schema, result)`
  call must be suppressed when `options.store === false`).
- `WorldImpl.generateDerivedRecord` (derived path; called both from `populate` — which
  stores itself — and from `generateArray` derived-mode + `generateSingleItem`).
- `WorldImpl.generateSingleItem` (ad-hoc/unregistered single-item path — does **not**
  store today; remains a no-op for storage).
- `WorldImpl.generateObjectFields` and `WorldImpl.generateArray` (recursion points where
  `store: false` MUST propagate through to inner `world.generate` calls that touch
  registered schemas — relations / `from:` / nested registered objects).
- `WorldImpl.get` (find-or-create primitive that itself calls `registry.store` for the
  unregistered create path — its contract requires storage and MUST NOT be defeatable by
  `store: false`).
- `WorldImpl.populate` (factory may return `GenerateOptions`; `populate`'s contract is
  to write the registry, so `store: false` MUST NOT be honored on that path).

This spec composes with three recently-landed siblings:

- **B6 — `world.get`** ([wiki/specs/B6-world-get-find-or-create.md](B6-world-get-find-or-create.md))
  — its create path uses `world.generate(...)` with `overrides` and explicitly calls
  `registry.store` for unregistered ad-hoc schemas (B6-R3, B6-R7); `get`'s idempotence
  requires the created record to be discoverable by a later `find`/`get`. Therefore `get`
  MUST always store.
- **B7 — registry output typing** ([wiki/specs/B7-registry-output-typing.md](B7-registry-output-typing.md))
  — reads return `z.infer<T>`, writes / `GenerateOptions.overrides` stay input-typed
  (B7-R5). The new `store?: boolean` is a primitive boolean, unrelated to that asymmetry.
- **B14 — `populate` factory** ([wiki/specs/B14-world-populate-factory.md](B14-world-populate-factory.md))
  — `populate(schema, count, factory?)` threads `GenerateOptions` from the factory
  through `generateAndStorePrimary` / `generateDerivedRecord`. The factory could return
  `{ store: false }`; `populate`'s whole purpose is to populate the registry, so a
  factory's `store: false` MUST be ignored on that path.

Architecture's binding **Rules** apply unchanged: no `any` (D1); `.js` import extensions
(D1); Zod v4 internals via `_zod.def` (D3); per-field PRNG determinism preserved (D4 —
B10 suppresses only the registry **side effect**, never PRNG consumption); the public
API change updates `docs/api-reference.md` in the same step (D5); D7's `prepublishOnly`
guard is unrelated to this item.

**D8 interaction**: D8 ("registry storage = `generate`'s return value for registered
schemas") still holds. When `store: true` (default), the stored record equals the
returned record (including `transform`). When `store: false`, nothing is stored, so the
equality is **vacuous** for that call — the contract is preserved because there is no
stored value to disagree with the return. D8 does, however, **mandate B10-R5**: if
`world.get` honored `store: false` on its create path, the very next find call would not
discover the created record, breaking `get`'s idempotence (B6-R7) **and** producing a
returned record that has no registry counterpart — a fresh class of stored-vs-returned
divergence. So `get` MUST ignore `store: false`. Similarly, `populate` is the explicit
"write the registry" primitive and a factory's `store: false` MUST be ignored there too
(B10-R6).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B10-R1: `GenerateOptions` gains an optional `store?: boolean` flag (default `true`)

The `GenerateOptions<T>` interface in `src/types.ts` MUST gain an optional boolean field
`store?: boolean`. The default semantics MUST be: an **absent** `store` field behaves
identically to `store: true` (today's behaviour, see B10-R3). The flag MUST be a plain
boolean; no other shape (e.g. an object, a function, an enum) MUST be introduced. The
`World.generate` method signature MUST NOT change beyond the new field being available on
`GenerateOptions` — no new method (`world.preview`, `world.generateNoStore`, …) MUST be
added; the card's `world.preview` alternative is **not** adopted.

```ts
export interface GenerateOptions<T> {
  readonly overrides?: DeepPartial<T>;
  readonly transform?: (data: T) => T;
  readonly seed?: number;
  readonly optionalProbability?: number;
  readonly defaultArrayLength?: readonly [number, number];
  readonly recursionLimit?: number;
  readonly source?: any;
  readonly fieldPath?: string;
  readonly prng?: ReturnType<typeof createPrng>;
  readonly locale?: LocaleData;
  /** When `false`, suppress the registry write at the top-level call. Default `true`. */
  readonly store?: boolean;
}
```

No `any` MUST appear in the new field. No cast MUST be required at the call site.

- Scenario: option type-checks with no cast and no `any`
  GIVEN a project that consumes `zod4-mock` and writes
  `const world = createWorld({ seed: 1 }).withSchema(ItemSchema);`
  followed by `world.generate(ItemSchema, { store: false });`
  WHEN `pnpm typecheck` is run
  THEN `pnpm typecheck` exits 0; the call type-checks with no `any` and no cast; the
  return type is `z.infer<typeof ItemSchema>` (B7-R4 / B10-R3 invariant).

- Scenario: no new method is added
  GIVEN the B10 change applied to `src/types.ts` and `src/world.ts`
  WHEN a consumer attempts to call `world.preview(ItemSchema)` (or any
  `world.generateNoStore`-style method)
  THEN `pnpm typecheck` reports a type error — no such method exists on `World`; the
  only opt-out is `{ store: false }` on `GenerateOptions`.

### B10-R2: `store: false` suppresses the registry write at the top-level call

When `world.generate(schema, options)` is called with `options.store === false` and
`schema` is **registered** via `withSchema` (primary or derived), the generation
pipeline MUST run end-to-end (matchers → key-based → schema-based → overrides →
transform) and MUST return the same value it would return with `store: true`, but the
internal call sites that write to the registry (`generateAndStorePrimary`'s
`this.registry.store(schema, result)` line and `generateDerivedRecord`'s caller-side
`this.registry.store(schema, result)` line when reached via `generate`) MUST be skipped.
The returned value's shape MUST equal what today's `store: true` call returns (D8
holds for the default; `store: false` is the explicit exemption).

- Scenario: registered primary — registry count unchanged after `store: false`
  GIVEN `const ItemSchema = z.object({ id: z.uuid(), name: z.string() })` and a world
  `const world = createWorld({ seed: 1 }).withSchema(ItemSchema);`
  WHEN the consumer calls `const before = world.registry.count(ItemSchema); const r = world.generate(ItemSchema, { store: false }); const after = world.registry.count(ItemSchema);`
  THEN `after === before` (no registry write occurred), `r` satisfies
  `ItemSchema.safeParse(r).success === true`, and `world.registry.find(ItemSchema, x => x.id === r.id) === undefined` (the returned record is **not** in the registry).

- Scenario: registered derived — registry count unchanged after `store: false`
  GIVEN `SourceSchema = z.object({ id: z.uuid() })` and
  `DerivedSchema = z.object({ id: z.uuid(), tag: z.string() })`,
  a world with `world.withSchema(SourceSchema).withSchema(DerivedSchema, { from: SourceSchema, matchers: { id: (ctx) => ctx.source.id } })`,
  and one source record pre-populated via `world.populate(SourceSchema, 1)`
  WHEN the consumer calls `const before = world.registry.count(DerivedSchema); world.generate(DerivedSchema, { store: false }); const after = world.registry.count(DerivedSchema);`
  THEN `after === before` (no derived-record write occurred).

- Scenario: matchers and overrides still apply under `store: false`
  GIVEN `ItemSchema = z.object({ id: z.uuid(), name: z.string() })` and a world
  `createWorld({ seed: 1 }).withSchema(ItemSchema, { matchers: { name: () => "matched" } })`
  WHEN the consumer calls
  `world.generate(ItemSchema, { store: false, overrides: { name: "overridden" } })`
  THEN the returned record's `name` is `"overridden"` (overrides win over matchers, exactly
  as in the store: true path).

- Scenario: `transform` still applies under `store: false`
  GIVEN `ItemSchema = z.object({ id: z.uuid(), name: z.string() })` registered on a world
  WHEN the consumer calls
  `world.generate(ItemSchema, { store: false, transform: (item) => ({ ...item, name: "T" }) })`
  THEN the returned record's `name` is `"T"` (transform applied), and
  `world.registry.count(ItemSchema)` is unchanged (no write).

### B10-R3: default behaviour (omitted or `store: true`) is byte-equivalent to today

Calling `world.generate(schema, options)` with `options.store` **absent**, or explicitly
`true`, MUST behave byte-equivalent to the pre-B10 implementation (matchers, key-based,
schema-based, overrides, transform, registry storage all happen exactly as before). For
registered schemas, the registry write is **still** performed; D8's
"stored = returned" rule MUST continue to hold for the default path.

- Scenario: omitted `store` — registry written and matches return (byte-equivalent baseline)
  GIVEN `ItemSchema = z.object({ id: z.uuid(), name: z.string() })` and a world
  `createWorld({ seed: 1 }).withSchema(ItemSchema)`
  WHEN the consumer calls `const r = world.generate(ItemSchema);` (no options)
  THEN `world.registry.count(ItemSchema) === 1`, `world.registry.all(ItemSchema)[0]` deep-equals
  `r`, and the entire registry contents and `r` are byte-identical to a pre-B10 run with
  the same seed and schema.

- Scenario: explicit `store: true` — identical to omitted
  GIVEN the same world as above
  WHEN the consumer calls `const r = world.generate(ItemSchema, { store: true });`
  THEN `world.registry.count(ItemSchema) === 1` and `world.registry.all(ItemSchema)[0]`
  deep-equals `r` (identical to the omitted case).

### B10-R4: nested generation propagates `store: false` through the recursion

When the outer `world.generate(schema, { store: false })` recurses through
`generateObjectFields` / `generateArray` into inner `world.generate(InnerSchema, ...)`
calls for **registered** inner schemas (relation auto-provisioning,
`generateArray`'s primary-mode `generateAndStorePrimary` loop, `generateArray`'s
derived-mode pair loop, and `generateObjectFields`'s `fieldCtx.generate(innerSchema, …)`
call for nested objects), the inner calls MUST also see `store: false` and MUST NOT
write to the registry. The mechanism MUST be: the option flag is threaded through the
recursion. The cleanest threading point in [src/world.ts](../../src/world.ts) is to
extend the internal recursion methods (`generateObjectFields`, `generateArray`,
`generateAndStorePrimary`, `generateDerivedRecord`, the `fieldCtx.generate` closure
constructed in `makeFieldCtx`, and `generateArray`'s element-loop
`this.generate(innerSchema, { … })`) to accept and forward `store: boolean` alongside
the existing `overrides` / `fieldPath` arguments. Implementation MAY equivalently
maintain a "current store-mode" on the `WorldImpl` instance scoped to the outer call
(push/pop in a `try`/`finally`), but the **observable** requirement is the same: any
registry write triggered transitively by a `{ store: false }` outer call MUST be
suppressed.

The propagation rule is **transitive** — relations auto-provisioned beneath a
`store: false` call also do not write, even though they would normally be created via
`ensurePrimaryRecord` / `generateAndStorePrimary`. (Rationale: the call's intent is
"do not pollute the registry"; a leaky shallow scope is surprising and re-introduces
the very inflation the option exists to prevent.)

- Scenario: outer search-bucket recursing into a registered inner schema
  GIVEN `ItemSchema = z.object({ id: z.uuid(), name: z.string() })`,
  `SearchBucketSchema = z.object({ total: z.number().int(), content: z.array(ItemSchema).length(10) })`,
  a world `createWorld({ seed: 1 }).withSchema(ItemSchema).withSchema(SearchBucketSchema)`,
  and the registry empty for both schemas
  WHEN the consumer calls `const before = world.registry.count(ItemSchema); const bucket = world.generate(SearchBucketSchema, { store: false }); const after = world.registry.count(ItemSchema);`
  THEN `after === before` (i.e. `0`) — the 10 inner `ItemSchema` records produced
  inside `bucket.content` did NOT inflate the registry — and `bucket.content` has length
  10 with each element satisfying `ItemSchema.safeParse(item).success === true`.

- Scenario: relation auto-provisioning beneath `store: false` does not write
  GIVEN `OwnerSchema = z.object({ id: z.uuid(), name: z.string() })` and
  `FileSchema = z.object({ id: z.uuid(), ownerId: z.uuid() })`,
  a world
  `createWorld({ seed: 1 }).withSchema(OwnerSchema).withSchema(FileSchema, { relations: { owner: OwnerSchema }, matchers: { ownerId: (ctx) => ctx.related("owner").id } })`,
  and the registry empty for both schemas
  WHEN the consumer calls `world.generate(FileSchema, { store: false });`
  THEN `world.registry.count(FileSchema) === 0` AND `world.registry.count(OwnerSchema) === 0`
  (the auto-provisioned owner under the relation pick also did not write).

- Scenario: subsequent default-mode `generate` still writes normally
  GIVEN the bucket world from the first scenario in B10-R4 (registry empty after the
  `store: false` call)
  WHEN the consumer next calls `world.generate(ItemSchema);` (omitted `store`)
  THEN `world.registry.count(ItemSchema) === 1` — the propagation is **scoped to the
  outer call** and does NOT linger across separate `world.generate` invocations.

### B10-R5: `world.get`'s create path is NOT affected by `store: false`

`World.get` (B6) is a find-or-create primitive whose contract (B6-R3, B6-R7) requires
the created record to be discoverable by a later `find`/`get`. `World.get` MUST always
store on the create path, regardless of how it invokes `world.generate` internally. If a
caller's path causes `store: false` to be visible to `get`'s internal `generate` call,
`get` MUST either (a) **ignore** the `store: false` and proceed with the default storage
behaviour, or (b) override `store` back to `true` before delegating to `generate`. The
chosen behaviour is **(b) override to `true`** — `world.get`'s implementation MUST
construct its internal `GenerateOptions` so `store: true` is set on the create-path
delegate call, defeating any inherited or accidental `store: false`. The unregistered
ad-hoc branch of `get` (which calls `registry.store` directly, see
[src/world.ts](../../src/world.ts) `WorldImpl.get`) is unaffected by this requirement —
it stores unconditionally as today (B6-R3, B6-R7).

(Rationale: B6-R7 idempotence — `get(s, p)` then `get(s, p)` returns the same instance —
requires the first call's record to be in the registry. Allowing `store: false` to
propagate into `get` would break that and produce a stored-vs-returned divergence that
D8 was introduced to eliminate.)

- Scenario: `world.get` create path writes regardless of any caller intent
  GIVEN `ProductSchema = z.object({ sku: z.string(), name: z.string() })` and a world
  `createWorld({ seed: 1 }).withSchema(ProductSchema)` with no stored product having
  `sku === "WIDGET-42"`
  WHEN the consumer calls `world.get(ProductSchema, { sku: "WIDGET-42" });` once
  THEN `world.registry.count(ProductSchema) === 1` and
  `world.registry.find(ProductSchema, p => p.sku === "WIDGET-42")` returns a record
  (the create-path write was performed, exactly as in B6-R3 / B6-R7).

- Scenario: `world.get` is idempotent — second call hits the find path
  GIVEN the same world as above
  WHEN the consumer calls
  `const a = world.get(ProductSchema, { sku: "ONCE" });`
  followed by `const b = world.get(ProductSchema, { sku: "ONCE" });`
  THEN `a === b` (same instance), `world.registry.count(ProductSchema) === 1` —
  identical to B6-R7's behaviour, unaffected by B10.

### B10-R6: `world.populate`'s factory cannot suppress storage

`World.populate(schema, count, factory?)` (B14) is by definition the "populate the
registry" primitive: its loops in [src/world.ts](../../src/world.ts) call
`generateAndStorePrimary` / `generateDerivedRecord` + `registry.store` to write `count`
records. When the optional factory returns `GenerateOptions` whose `store` field is
`false`, `populate` MUST ignore that field — every record produced by `populate(schema, count, factory)`
MUST land in the registry, count and ordering preserved. The factory's other fields
(`overrides`, `transform`, etc.) MUST still flow through per B14-R3.

The chosen behaviour is **ignore-silently**, not throw. Rationale: a factory that
accidentally includes `store: false` (e.g. a shared options builder reused across
`generate` and `populate` call sites) should not crash `populate`; the surprising
outcome (records vanishing from the registry) would be worse than the silent override.
The factory's `store` field MUST be stripped (or overridden to `true`) by `populate`
before the options reach `generateAndStorePrimary` / `generateDerivedRecord`.

- Scenario: factory `store: false` ignored, all records stored
  GIVEN `UserSchema = z.object({ id: z.uuid(), username: z.string() })`,
  `const USER_PROFILES = [{ username: "admin" }, { username: "editor" }, { username: "viewer" }] as const`,
  and a world `createWorld({ seed: 42 }).withSchema(UserSchema)`
  WHEN the consumer calls
  `world.populate(UserSchema, USER_PROFILES.length, (i) => ({ store: false, overrides: { username: USER_PROFILES[i]!.username } }));`
  THEN `world.registry.count(UserSchema) === 3`, `world.registry.all(UserSchema).map(u => u.username)`
  deep-equals `["admin", "editor", "viewer"]` (B14-R3 overrides still honored), and the
  `store: false` was effectively a no-op.

- Scenario: factory `store: true` works identically (regression check on B14)
  GIVEN the same world and `USER_PROFILES`
  WHEN the consumer calls
  `world.populate(UserSchema, USER_PROFILES.length, (i) => ({ store: true, overrides: { username: USER_PROFILES[i]!.username } }));`
  THEN `world.registry.count(UserSchema) === 3` with the same `username` values as above
  (identical to omitting `store`).

### B10-R7: determinism preserved — `store: false` does not change generation order or PRNG consumption

Suppressing the registry write MUST NOT change the **value** produced by `generate`, the
order of internal PRNG forks, or the value consumed from the parent PRNG. Specifically:
two worlds created with the same seed and the same `withSchema` registrations MUST
produce identical values from `world.generate(schema, …)` whether `store: false` or
omitted is passed on the call, and subsequent calls on either world that consume the
PRNG MUST produce the same values across the two worlds at the same position in the
call sequence. D4 (per-field PRNG determinism via `fork`) is preserved.

- Scenario: same seed → byte-identical return value with vs. without `store: false`
  GIVEN `ItemSchema = z.object({ id: z.uuid(), name: z.string() })` and two worlds
  created independently with `seed: 42` and the same `withSchema(ItemSchema)`
  registration: `worldA` and `worldB`
  WHEN `worldA.generate(ItemSchema)` is called (default) and `worldB.generate(ItemSchema, { store: false })`
  is called, and the returned values are captured as `a` and `b`
  THEN `JSON.stringify(a) === JSON.stringify(b)` (the field values are identical;
  only the registry side effect differs).

- Scenario: subsequent calls remain in lockstep across the two worlds
  GIVEN the same two worlds as above
  WHEN, immediately after the first call, each world calls `world.generate(ItemSchema);`
  a second time and the returned values are captured as `a2` and `b2`
  THEN `JSON.stringify(a2) === JSON.stringify(b2)` — the no-store call on `worldB` did
  not shift the PRNG.

### B10-R8: `docs/api-reference.md` updated in the same step

The public API change in B10 (the new `store?: boolean` field on `GenerateOptions`) MUST
be reflected in `docs/api-reference.md` in the same change (Rules: D5). Specifically:
the `GenerateOptions` section (line ~748) MUST document the new `store` field with its
default (`true`), and the `.generate(schema, options?)` subsection (line ~221) MUST
mention the ephemeral / no-store use case with a short example illustrating
`world.generate(SearchBucketSchema, { store: false })`. The interaction with `world.get`
(B10-R5) and `world.populate` (B10-R6) MUST be called out in those respective subsections
(`.get` and `.populate`) so consumers see the safety scope.

- Scenario: docs reflect the new field and the safety scope
  GIVEN the B10 change applied
  WHEN `docs/api-reference.md` is read
  THEN the `GenerateOptions` section lists `store?: boolean` (default `true`) with a
  one-line description of its purpose (suppress the registry write); the
  `.generate` subsection shows a `{ store: false }` example; the `.get` subsection notes
  that `store: false` is **ignored** on the create path (B10-R5); and the `.populate`
  subsection notes that a factory returning `store: false` is **ignored** (B10-R6).

## Out of scope

- **A named method `world.preview(schema, options?)`.** The card proposed it as Option B;
  it is **not** adopted (B10-R1). The option-on-`GenerateOptions` composes with
  `overrides` / `transform` / factory and keeps the public surface flat.
- **Changing the default to opt-in storage** (i.e. making `store: false` the default).
  Storage is the right default for `withSchema`-registered entities and for the
  find-or-create / relations flows that depend on it; flipping the default would surprise
  every existing caller and break find-or-create.
- **Per-field opt-out** (suppressing the write of _one_ nested record but storing
  others). The flag is whole-call ephemeral; if a caller needs fine-grained mixing they
  compose two separate `generate` calls.
- **Suppressing relation auto-provisioning of `from:` source records that the matcher
  reads from.** `store: false` suppresses _registry writes_; it does not change how
  relations resolve. Auto-provisioned records under a `store: false` outer call also
  don't write (B10-R4), so the relation matcher's `ctx.related(...)` returns the
  in-memory record without persisting it.
- **A no-store overload that also bypasses matchers / world setup.** That is already
  available as the standalone `generate(...)` export (`src/index.ts`); B10 deliberately
  keeps matchers + locale + overrides + transform active.
- **`Registry.store` accepting an opt-out flag.** `store` remains the pure storage
  primitive; the suppression lives at the _call site_ (`generate`) where the intent is
  expressed.
- **Tightening the `Registry.store` signature** (B7-R2 keeps writes input-typed).
- **Behaviour for an explicit invalid value** (e.g. `store: undefined` vs. omitted, or
  `store: 0` truthiness). The field is typed `boolean | undefined`; only `true`,
  `false`, and absent are defined behaviours, and `false` is the only opt-out trigger.
  Any TypeScript-level misuse is caught by `pnpm typecheck`.
- **Changing `world.populate` to expose a no-store mode.** `populate`'s purpose is to
  populate the registry; B10-R6 explicitly forbids it.

## Open questions

- **Nested-generation propagation: propagate vs. shallow — Non-blocking.** Adopted as
  **propagate** in B10-R4. The card flagged this as the principled answer (the call's
  intent is "don't pollute the registry"; a shallow scope leaks for any envelope schema
  that recurses into registered inner records — the exact use case the option exists to
  serve). The alternative ("shallow unless the caller propagates explicitly") would
  re-introduce the inflation B10 is meant to prevent for the most common ephemeral
  shape (a search-bucket of registered items). Recorded, not blocking.

- **Naming `{ store: false }` vs. `world.preview(...)` — Non-blocking.** Adopted as the
  **option-on-`GenerateOptions`** in B10-R1. Rationale: the option composes with
  `overrides` / `transform` / future `GenerateOptions` fields and keeps the public
  surface flat (no new method); `world.preview` would either duplicate the entire
  generate surface or expose a stripped-down variant whose differences callers must
  learn separately. The factory path in `world.populate(schema, count, factory)` (B14)
  already takes `GenerateOptions`, so extending that record's fields keeps `populate`'s
  type story consistent (subject to the safety scope in B10-R6). Recorded, not blocking.

No blocking open questions remain; the spec can advance to `test-writer`.
