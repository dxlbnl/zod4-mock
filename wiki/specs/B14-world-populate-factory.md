# B14: `world.populate` should support a per-record factory for `GenerateOptions`

## Context

`world.populate(schema, count)` ([src/types.ts](../../src/types.ts) line 307,
[src/world.ts](../../src/world.ts) `WorldImpl.populate`) pre-generates `count` records of
`schema` and stores them in the registry, returning `this` for chaining. It is the
matcher-default primitive for "I just need N of these." The moment a caller needs
*per-record* control — N **named** records, N records each with a different `overrides`
value — they fall out of `populate` into a `for`-loop calling `world.generate(schema, …)`
per record. That loop **re-invents** what `populate` already does (count, ordering,
registry storage, fluent chaining) for the sole reason that `populate` has no per-record
hook. The before/after on the item card makes the friction concrete: turning a 3-line
loop over `USER_PROFILES` into one declarative call.

The fix is small and additive: a per-record **factory** that, given the 0-based record
index, returns the same `GenerateOptions<TSchema>` that `world.generate` already takes —
so the factory's return value flows through the existing generate pipeline (matchers →
key-based → schema-based → overrides → transform), no new code path. The existing
two-arg form (`populate(schema, count)`) keeps its exact behaviour; the factory is an
optional third parameter.

Today `src/types.ts` declares the public signature
`populate(schema: ZodTypeAny, count: number): this` (line 307) and the implementation in
`src/world.ts` (lines 167–191) loops `count` times calling either
`this.generateAndStorePrimary(schema, primaryRegs[0]!)` (no options),
`this.generateDerivedRecord(schema, reg, sources[i], i)` (no options), or
`this.generateAndStorePrimary(schema, null)` (no options) — three branches that all
ignore `GenerateOptions` because none is given. None of `src/`, `tests/`, or `docs/`
references any other `populate` overload (e.g. `populate(schema, items[])` accepting an
array of pre-built records); confirmed via `Grep populate src tests docs` — the only
public surface today is the two-arg form, and the only docs hit is
[docs/api-reference.md](../../docs/api-reference.md) lines 258–268. So the spec is
exclusively about adding the third argument.

Architecture's binding **Rules** apply unchanged: no `any` (D1), `.js` import extensions
for any new imports (D1), Zod v4 internals via `_zod.def` (D3), per-field PRNG
determinism preserved (D4), `docs/api-reference.md` updated in the same step because
this is a public API change (D5), and the publishable-package `prepublishOnly` rule
(D7) is unrelated to this item (already covered by B15).

This spec also coexists with the just-landed B7 contract
([wiki/specs/B7-registry-output-typing.md](B7-registry-output-typing.md)): reads return
the output shape (`z.infer<T>`), but **writes / matchers / `GenerateOptions.overrides`
stay input-typed**. The factory therefore returns `GenerateOptions<TSchema>` whose
generic parameter `T` matches what `world.generate(schema, options)` already uses
internally for that schema — overrides remain input-shaped, matcher returns remain
input-shaped (B7-R5). No tightening of the write side.

Item card: [wiki/backlog/doing/B14-world-populate-factory.md](../backlog/doing/B14-world-populate-factory.md).
Closes GitHub issue #14.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B14-R1: `populate` accepts an optional per-record factory

The `World.populate` signature in `src/types.ts` MUST gain an optional third parameter
of shape `factory?: (index: number) => GenerateOptions<TSchema>`, generic over
`TSchema extends ZodTypeAny`, while keeping the existing two-arg form valid. The
required signature is:

```ts
populate<TSchema extends ZodTypeAny>(
  schema: TSchema,
  count: number,
  factory?: (index: number) => GenerateOptions<TSchema>,
): this;
```

No `any` MUST appear in the public signature and no cast MUST be required at the call
site for either the existing two-arg form or the new three-arg form.

- Scenario: existing two-arg call still type-checks and behaves identically
  GIVEN the codebase before B14 contains
  `createWorld({ seed: 42 }).withSchema(PersonSchema).populate(PersonSchema, 5)`
  WHEN B14 is applied and `pnpm typecheck` is run
  THEN `pnpm typecheck` exits 0 with that call unchanged; running it produces 5 records
  in `world.registry.all(PersonSchema)` exactly as before B14 — byte-equivalent output
  for `seed: 42` (B14-R4 pins this byte-equivalence).

- Scenario: three-arg call type-checks with no `any` and no cast
  GIVEN `const USER_PROFILES = [{ username: "admin" }, { username: "editor" }] as const`
  and a schema `UserSchema = z.object({ id: z.uuid(), username: z.string() })`
  registered via `world.withSchema(UserSchema)`
  WHEN a consumer writes
  `world.populate(UserSchema, USER_PROFILES.length, (i) => ({ overrides: { username: USER_PROFILES[i]!.username } }))`
  and runs `pnpm typecheck`
  THEN `pnpm typecheck` exits 0; the factory parameter `i` is inferred as `number`; the
  factory return type is `GenerateOptions<typeof UserSchema>`; no `any` or cast appears
  at the call site.

### B14-R2: factory is invoked per-record with the 0-based index

When the factory is provided, `populate` MUST call it exactly `count` times with
`i = 0, 1, …, count - 1` in that order, and pass the returned `GenerateOptions` to the
internal generate path for that record (B14-R3 specifies the wiring). The factory MUST
NOT be called more or fewer times than `count`, and MUST NOT be called when no factory
is provided (B14-R4).

- Scenario: factory is called `count` times with indexes 0..count-1 in order
  GIVEN `const seen: number[] = []` and a world
  `createWorld({ seed: 42 }).withSchema(UserSchema)`
  WHEN the consumer calls
  `world.populate(UserSchema, 4, (i) => { seen.push(i); return {}; })`
  THEN `seen` equals `[0, 1, 2, 3]` (length 4, strictly ascending, starting at 0) and
  `world.registry.all(UserSchema)` has length 4.

- Scenario: zero-count call does not invoke the factory
  GIVEN a world `createWorld({ seed: 42 }).withSchema(UserSchema)` and
  `let called = 0`
  WHEN the consumer calls
  `world.populate(UserSchema, 0, () => { called++; return {}; })`
  THEN `called === 0` and `world.registry.all(UserSchema)` has length 0.

### B14-R3: factory output flows through the normal generate pipeline

The `GenerateOptions` value returned by the factory MUST be honored by `populate` for
its record exactly as if the caller had called `world.generate(schema, factoryReturn)`
themselves — i.e. `overrides`, `transform`, and any other `GenerateOptions` field
already accepted by `world.generate` are applied through the same code path that
`world.generate` uses. `populate` MUST NOT silently drop or rename any field of the
factory's return value.

- Scenario: `overrides` from the factory win on the populated record
  GIVEN `const USER_PROFILES = [{ username: "admin" }, { username: "editor" }, { username: "viewer" }] as const`,
  `UserSchema = z.object({ id: z.uuid(), username: z.string() })`,
  and a world `createWorld({ seed: 42 }).withSchema(UserSchema)`
  WHEN the consumer calls
  `world.populate(UserSchema, USER_PROFILES.length, (i) => ({ overrides: { username: USER_PROFILES[i]!.username } }))`
  THEN `world.registry.all(UserSchema).map((u) => u.username)` deep-equals
  `["admin", "editor", "viewer"]` (one record per profile, in input order, with the
  factory-supplied `username` winning over any generated value).

- Scenario: `transform` from the factory is applied per record
  GIVEN `UserSchema = z.object({ id: z.uuid(), username: z.string() })` and a world
  `createWorld({ seed: 42 }).withSchema(UserSchema)`
  WHEN the consumer calls
  `world.populate(UserSchema, 3, (i) => ({ transform: (u) => ({ ...u, username: \`u-${i}\` }) }))`
  THEN `world.registry.all(UserSchema).map((u) => u.username)` deep-equals
  `["u-0", "u-1", "u-2"]` — proving the factory's `transform` ran for each record,
  receiving the merged value and producing the final stored shape.

### B14-R4: no-factory form is unchanged

`populate(schema, count)` called without a third argument MUST produce `count` records
through the same code paths that exist in `WorldImpl.populate` today
(`generateAndStorePrimary` for primary-registered or unregistered schemas;
`generateDerivedRecord` for derived schemas) with **no** `GenerateOptions` passed —
byte-equivalent registry contents for the same seed and schema as before B14.

- Scenario: no-factory call is byte-equivalent to today
  GIVEN a fixed schema `PersonSchema = z.object({ personId: z.uuid(), firstName: z.string(), lastName: z.string(), email: z.email(), age: z.number().int().min(18).max(90) })`,
  the same `seed: 42`, and the same registration order
  `createWorld({ seed: 42 }).withSchema(PersonSchema).populate(PersonSchema, 5)`
  WHEN the call is made before B14 (capture `world.registry.all(PersonSchema)` as
  `BASELINE`) and again after B14 (capture as `AFTER`)
  THEN `JSON.stringify(AFTER) === JSON.stringify(BASELINE)` — the no-factory branch
  has not shifted any field value, count, or ordering.

- Scenario: factory not invoked when omitted
  GIVEN a world `createWorld({ seed: 42 }).withSchema(UserSchema)` and any sentinel
  WHEN the consumer calls `world.populate(UserSchema, 3)` (no third argument)
  THEN no factory-related code runs (proved by B14-R4's byte-equivalence to the
  pre-B14 baseline) and `world.registry.all(UserSchema)` has length 3.

### B14-R5: deterministic across runs for the same seed and factory output

For a given world `seed`, the same sequence of `populate(schema, count, factory)` calls
where `factory` returns the same `GenerateOptions` for the same `i` MUST produce the
same stored records in the same order across runs (D4 — per-field PRNG determinism is
preserved end-to-end). The factory is treated as pure for this guarantee: the
`GenerateOptions` permissive typing does not forbid side effects, but a factory that
reads/writes external state is documented as caller-discouraged because B14 makes no
guarantee about determinism beyond the factory's own return.

- Scenario: same seed + same factory → byte-identical registry across runs
  GIVEN a pure factory `(i) => ({ overrides: { username: USER_PROFILES[i]!.username } })`
  and `USER_PROFILES` and `UserSchema` as in B14-R3
  WHEN the consumer runs
  `const a = createWorld({ seed: 42 }).withSchema(UserSchema); a.populate(UserSchema, 3, factory); const A = a.registry.all(UserSchema)`
  and, separately,
  `const b = createWorld({ seed: 42 }).withSchema(UserSchema); b.populate(UserSchema, 3, factory); const B = b.registry.all(UserSchema)`
  THEN `JSON.stringify(A) === JSON.stringify(B)` (deep-equal, identical ordering).

### B14-R6: `populate` keeps returning `this` for fluent chaining

The three-arg form MUST keep returning the world (`this`) on completion, identically to
the two-arg form today (`src/world.ts` line 190). Callers MUST be able to chain further
methods after a factory-using `populate` exactly as they can today.

- Scenario: three-arg `populate` returns the world
  GIVEN a world `const world = createWorld({ seed: 42 }).withSchema(UserSchema)`
  WHEN the consumer calls `world.populate(UserSchema, 2, () => ({}))`
  THEN the returned value `===` `world` (reference equality), enabling
  `world.populate(UserSchema, 2, () => ({})).populate(UserSchema, 1)` to type-check
  and run.

### B14-R7: `docs/api-reference.md` updated in the same step

The public API change in B14 (the third parameter on `World.populate`) MUST be
reflected in `docs/api-reference.md` in the same change (Rules: D5). Specifically, the
`.populate` subsection (currently lines 258–268) MUST show the updated signature
with the optional `factory?: (index: number) => GenerateOptions<TSchema>` parameter and
include a short example illustrating the per-record-overrides use case (the
`USER_PROFILES` pattern from the item card). The existing two-arg example MUST remain
to advertise that the simple form is unchanged.

- Scenario: docs reflect the new signature
  GIVEN the B14 change applied
  WHEN `docs/api-reference.md` is read
  THEN the `.populate` subsection shows
  `populate<TSchema extends ZodTypeAny>(schema: TSchema, count: number, factory?: (index: number) => GenerateOptions<TSchema>): this`,
  carries a `USER_PROFILES`-style example using the factory form, and still shows the
  unchanged two-arg call as the simple case.

## Out of scope

- **Reusing the factory shape on `world.populateFrom`** — B14 is only about `populate`.
  The card notes B13 (`populateFrom`) "pairs naturally" with the same factory shape, but
  that adoption belongs to B13's own spec when it is opened. Nothing in B14 forbids it;
  B14 just does not commit to it.
- **`{ source }` factory returns for B8 derived schemas** — likewise mentioned on the
  card as a pair-naturally. The factory **may** return `{ source: … }` already today
  because `GenerateOptions` includes `source?: any` (see `src/types.ts` line 179), but
  B14 does not specify behaviour for that path beyond "honored as `world.generate`
  honors it." Pinning `source` semantics on `populate` is left to B8.
- **Accepting a pre-built array of records instead of a factory** —
  `populate(schema, items[])` is **not** added by B14. A `Grep` over `src/`, `tests/`,
  and `docs/` confirms no such overload exists today and B14 does not introduce one.
- **Async factories** — the factory MUST be synchronous, matching `world.generate`'s
  synchronous contract. Returning a `Promise<GenerateOptions<TSchema>>` from the
  factory is out of scope and not supported; no requirement here covers it.
- **Determinism guarantees for factories with side effects** — the factory is documented
  as caller-discouraged-from-side-effects (B14-R5). A factory that closes over and
  mutates external state can break determinism by design; B14 does not promise to
  rescue that.
- **Changing matcher / `overrides` / `store` typing.** B14 keeps the write surface
  input-shaped per B7-R5 ([wiki/specs/B7-registry-output-typing.md](B7-registry-output-typing.md)).
  `GenerateOptions<TSchema>.overrides` remains `DeepPartial<T>` for whatever `T` the
  factory's return is parameterized over; no tightening, no widening.
- **Renaming or splitting `populate`.** No `populateMany`, `populateAll`,
  `populateNamed`, etc. — B14 extends the existing method.

## Open questions

- **Factory signature: `(i: number) => GenerateOptions<TSchema>` vs. `(i: number) => Partial<input<T>>` (overrides-only sugar). — Non-blocking.**
  The item card proposes `GenerateOptions<TSchema>` (full control: `overrides`,
  `transform`, and any future `GenerateOptions` field) and recommends adopting it. The
  alternative — sugar that only sets `overrides` from a `Partial<input<T>>` — saves one
  level of object literal at the call site (`(i) => USER_PROFILES[i]` instead of
  `(i) => ({ overrides: USER_PROFILES[i] })`) but locks future per-record needs
  (`transform`, `source`, future fields) out of the factory path. **Adopted as
  `GenerateOptions<TSchema>`** for B14 (pinned in B14-R1's signature). Sugar can be
  layered later without breaking B14: a future helper could wrap a `Partial<input<T>>`
  into `{ overrides: … }` and pass it through, but B14 itself does not add it.
  Recorded, not blocking.

- **Determinism + pure-factory contract. — Non-blocking.**
  The card notes "factory is pure (no PRNG inside); deterministic across runs for the
  same seed. Document." **Adopted**: B14-R5 pins determinism conditional on the
  factory returning the same `GenerateOptions` for the same `i` across runs, and the
  factory is documented as caller-discouraged-from-side-effects. The factory is **not**
  forbidden from doing impure work (`GenerateOptions`'s typing is permissive and B14
  does not police it at runtime), but B14 makes no determinism promise beyond what the
  factory itself returns. Recorded, not blocking.

No blocking open questions remain; the spec can advance to `test-writer`.
