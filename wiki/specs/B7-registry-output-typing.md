# B7: Registry read methods should return `z.infer<T>` (output shape), not `input<T>`

## Context

The `Registry` interface ([src/types.ts](../../src/types.ts)) currently types every read
method (`all`, `pick`, `filter`, `find`) as `input<T>` — the pre-coerce / pre-transform
input shape. At runtime the library's generators (and `world.generate` itself — see
[src/world.ts](../../src/world.ts)) produce **output-shaped** values: a field declared
`z.coerce.date()` ends up as a `Date`, a `.transform(v => v.length)` field as a number,
and so on. So the static type tells consumers "you hold the pre-coerce input shape" while
the runtime value is the post-coerce output shape. Every consumer who naturally holds a
`z.infer<T>` (the output type, the common case) must cast at the registry boundary, and
the same value type is exposed in two contradictory ways: `world.generate(schema)` returns
`z.infer<T>` but `world.registry.all(schema)` of those same values claims `input<T>`.

This item makes the registry's read surface **asymmetric in the same direction Zod itself
is asymmetric**: reads expose the output shape (`z.infer<T>`), writes still accept the
input shape (`input<T>`). It mirrors how `z.coerce` works (input permissive, output
fixed). Matchers and `GenerateOptions.overrides` stay input-shaped so a matcher on a
`coerce.date()` field can still return `string | number | Date` — flexibility is kept
where data flows *in*, fixity is gained where data flows *out*.

This also **retrofits the just-landed B4 and B6 signatures**:
[wiki/specs/B4-registry-find.md](B4-registry-find.md) (B4-R1) typed `registry.find` with
`input<T>` predicates and return, and
[wiki/specs/B6-world-get-find-or-create.md](B6-world-get-find-or-create.md) (B6-R1) typed
`world.get`'s return as `input<TSchema>`. The implementations in `src/registry.ts` and
`src/world.ts` are schema-bound generics already (not raw `unknown`), so the change is
confined to the **interface types** in `src/types.ts` plus the matching prose in
`docs/api-reference.md`. No method body changes shape; this is purely a typing fix.

Architecture's binding **Rules** apply unchanged: no `any` (D1), `.js` import extensions
for any new imports (D1), and — because this changes the published types of `Registry` and
`World` — **`docs/api-reference.md` MUST be updated in the same step** (D5).

The item card classifies this `feature` with `priority: medium` and ships under
`flags: [review]`; the card carries one open question on matcher return contracts —
classified non-blocking below.

Item card: [wiki/backlog/doing/B7-registry-output-typing.md](../backlog/doing/B7-registry-output-typing.md).
Closes GitHub issues #7 and #16 (duplicate filings of the same body).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B7-R1: `Registry` read methods return `z.infer<T>` (output shape)

The `Registry` interface in `src/types.ts` MUST type its read methods — `all`, `pick`,
`filter`, `find` — and the predicate parameters of `filter` and `find`, in terms of
`z.infer<T>` (the **output** shape) rather than `input<T>` (the input shape). The required
signatures are:

```ts
all<T extends ZodTypeAny>(schema: T): z.infer<T>[];
pick<T extends ZodTypeAny>(schema: T): z.infer<T>;
filter<T extends ZodTypeAny>(
  schema: T,
  predicate: (item: z.infer<T>) => boolean,
): z.infer<T>[];
find<T extends ZodTypeAny>(
  schema: T,
  predicate: (item: z.infer<T>) => boolean,
): z.infer<T> | undefined;
```

`count` is unchanged (it does not expose a value type). No `any` MUST appear and no cast
MUST be required at the call site for a consumer holding a `z.infer<T>` value.

- Scenario: coerced field reads back as the output type with no cast
  GIVEN a schema `EventSchema = z.object({ id: z.string(), occurredAt: z.coerce.date() })`
  registered on a world (`world.withSchema(EventSchema)`), and one record stored for it
  WHEN a consumer writes `const items: z.infer<typeof EventSchema>[] = world.registry.all(EventSchema);`
  with **no cast** and runs `pnpm typecheck`
  THEN the project type-checks (`pnpm typecheck` exits 0), `items[0]!.occurredAt` is
  inferred as `Date`, and no `any` is introduced.

- Scenario: `find`/`filter` predicates receive the output shape
  GIVEN the same `EventSchema` and a stored record
  WHEN a consumer writes
  `world.registry.find(EventSchema, (e) => e.occurredAt.getTime() > 0)` and
  `world.registry.filter(EventSchema, (e) => e.occurredAt instanceof Date)`
  THEN both call sites type-check with no cast: inside each predicate `e.occurredAt` is
  typed `Date` (the output shape) — calling `Date` methods on it compiles, and the return
  type is `z.infer<typeof EventSchema> | undefined` / `z.infer<typeof EventSchema>[]`
  respectively (no `any`).

- Scenario: `pick` returns the output shape
  GIVEN the same `EventSchema` and at least one stored record
  WHEN a consumer writes `const evt: z.infer<typeof EventSchema> = world.registry.pick(EventSchema);`
  with no cast
  THEN the project type-checks and `evt.occurredAt` is inferred as `Date`.

### B7-R2: `Registry.store` still accepts `input<T>` (write side stays permissive)

`Registry.store`'s `item` parameter MUST remain typed `input<T>` (the input shape, the
pre-coerce / pre-transform side). This MUST NOT be tightened to `z.infer<T>` alongside the
read-side change — the asymmetry is the point. Matchers on coerce / transform fields
return values in the input shape (see B7-R5), and `store` is how those values land in the
registry.

- Scenario: a `coerce`-field write accepts the permissive input shape
  GIVEN a schema `EventSchema = z.object({ id: z.string(), occurredAt: z.coerce.date() })`
  whose `input<typeof EventSchema>.occurredAt` is `unknown` and whose
  `z.infer<typeof EventSchema>.occurredAt` is `Date`
  WHEN library code writes `registry.store(EventSchema, { id: "e1", occurredAt: "2024-01-01" });`
  (a string, not a `Date`)
  THEN the project type-checks (`pnpm typecheck` exits 0) — the input-shaped value is
  accepted by `store` — and no `any` is required.

### B7-R3: `World.get` returns `z.infer<T>` (predicate stays input-typed)

`World.get` in `src/types.ts` MUST be retyped so its **return value** is `z.infer<TSchema>`
(matching what the registry now returns from the find path and what `generate` returns on
the create path). Its **`predicate` parameter** MUST remain `Partial<input<TSchema>>` —
predicates flow *in*, mirroring matcher returns and the shape `overrides` accepts. This
supersedes B6-R1's `input<TSchema>` return-type clause for `get`. The required signature
is:

```ts
get<TSchema extends ZodTypeAny>(
  schema: TSchema,
  predicate?: Partial<input<TSchema>>,
): z.infer<TSchema>;
```

- Scenario: `get` return is output-typed at the call site, no cast
  GIVEN a world (`createWorld({ seed: 1 }).withSchema(EventSchema)`) where
  `EventSchema` has a `z.coerce.date()` field `occurredAt`
  WHEN a consumer writes `const evt: z.infer<typeof EventSchema> = world.get(EventSchema, { id: "e1" });`
  with no cast
  THEN the project type-checks and `evt.occurredAt` is inferred as `Date`.

- Scenario: `get` predicate still accepts the permissive input shape
  GIVEN the same world and schema
  WHEN a consumer writes `world.get(EventSchema, { occurredAt: "2024-01-01" });` (a
  string-valued predicate key for a `coerce.date()` field)
  THEN the project type-checks (the predicate parameter is `Partial<input<typeof EventSchema>>`,
  which permits `unknown` for `occurredAt`) and no `any` is required at the call site.

### B7-R4: `World.generate` return type stays `z.infer<TSchema>` (invariant pinned)

`World.generate` (and the top-level `generate(schema, options?)` re-export in
`src/index.ts`) MUST keep its return type `z.infer<TSchema>`. This already holds today;
this requirement pins the invariant so a future refactor cannot regress it. It is the
symmetry the read side now matches: registry reads and `generate` return the **same**
value type.

- Scenario: `generate` returns the output shape
  GIVEN a schema `EventSchema = z.object({ id: z.string(), occurredAt: z.coerce.date() })`
  WHEN a consumer writes `const evt: z.infer<typeof EventSchema> = world.generate(EventSchema);`
  with no cast
  THEN the project type-checks and `evt.occurredAt` is inferred as `Date`.

- Scenario: top-level `generate` returns the output shape
  GIVEN the same schema
  WHEN a consumer writes `const evt: z.infer<typeof EventSchema> = generate(EventSchema, { seed: 1 });`
  using the re-exported `generate` from `zod4-mock`
  THEN the project type-checks and `evt.occurredAt` is inferred as `Date`.

### B7-R5: matchers and `GenerateOptions['overrides']` stay input-typed

The write-side type surface MUST NOT be tightened by this change. Specifically:

- `SchemaOpts.matchers[K]` MUST keep its return type as `input<TSchema>[K]` — a matcher on
  a coerce / transform field is permitted to return any value Zod would accept as input
  for that field (e.g. `string | number | Date` for `z.coerce.date()`).
- `SchemaKeyMap<T>[K]` MUST keep its return type as `input<T>[K]`.
- `MatcherCtx.related(name)` / `related.many(name, count)` MUST keep returning the related
  schema's `input<TRelations[K]>` / `input<TRelations[K]>[]`.
- `GenerateOptions.overrides` MUST remain `DeepPartial<T>` where `T` is the caller-supplied
  type parameter on `GenerateOptions<T>` (typically `z.infer<TSchema>` at the
  `world.generate` call site) — i.e. the deep-partial of whatever the caller already passes
  through, unchanged from today; this requirement records that B7 does not narrow it.

- Scenario: matcher returns a permissive input value for a coerce field
  GIVEN a schema `EventSchema = z.object({ id: z.string(), occurredAt: z.coerce.date() })`
  registered with `withSchema(EventSchema, { matchers: { occurredAt: () => "2024-01-01" } })`
  (the matcher returns a `string`, not a `Date`)
  WHEN the project is type-checked
  THEN `pnpm typecheck` exits 0 — the matcher's return type is `input<typeof EventSchema>["occurredAt"]`,
  which is `unknown` for a `coerce.date()` field — and no cast is required to return the
  string.

- Scenario: a `Partial<input<TSchema>>` predicate is assignable to `overrides`
  GIVEN the `World.get` implementation in `src/world.ts` that passes its
  `predicate` argument through as `overrides` on the create path
  WHEN the project is type-checked
  THEN `pnpm typecheck` exits 0 — the predicate (input-typed) remains assignable to the
  generate options' `overrides` (deep-partial of the caller's `T`, with `T` being the
  schema's `z.infer<TSchema>`-or-`input<TSchema>` shape at that call site) — no `any` and
  no new cast beyond what the implementation already has.

### B7-R6: pure type change — runtime behaviour and the full test suite are unchanged

B7 MUST be a type-only change. The bodies of `SchemaRegistry.store`, `all`, `pick`,
`filter`, `find`, `count`, `WorldImpl.get`, and `WorldImpl.generate` MUST NOT change
semantically; in particular, no `schema.parse` / `safeParse` call MUST be added on `store`
or any read method (that would change runtime cost and is explicitly out of scope — see
Out of scope and Open questions). The full existing suite MUST stay green: `pnpm test`
(and `pnpm test:all` for the workspaces) MUST exit 0 after the change, including the B4
and B6 specs' tests at
[tests/unit/core/registry.test.ts](../../tests/unit/core/registry.test.ts) and
[tests/unit/core/world-get.test.ts](../../tests/unit/core/world-get.test.ts). Existing
test-local type aliases that mirror the old `input<T>` shape (the `WithFind` /
`WithGet` interfaces in those two files) MAY be updated to mirror the new shape; no test
**assertion** body MAY be changed by B7 because runtime values are unchanged.

- Scenario: full suite still green after the type change
  GIVEN the B7 type change applied to `src/types.ts` (and any test-local type aliases in
  `tests/unit/core/registry.test.ts` / `tests/unit/core/world-get.test.ts` updated to
  mirror the new signatures)
  WHEN `pnpm typecheck` and `pnpm test` are run
  THEN both exit 0; in particular every `it(...)` in `registry.test.ts` and
  `world-get.test.ts` still passes with unchanged assertion bodies (only their local
  `WithFind` / `WithGet` interfaces may have been edited, and only to match the new
  signatures).

- Scenario: no runtime parse added by `store` or reads
  GIVEN the B7 change applied
  WHEN a consumer calls `registry.store(EventSchema, item)` with a value whose
  `occurredAt` field is a raw string (not a `Date`)
  THEN the call returns without throwing and `registry.all(EventSchema)[0]!.occurredAt`
  is **strictly equal** (`===`) to the original string passed in (no implicit
  `coerce.date()` parse occurred on store, no transformation on read).

### B7-R7: `docs/api-reference.md` updated in the same step

The public type-surface change in B7 (the `Registry` read methods, `World.get`'s return)
MUST be reflected in `docs/api-reference.md` in the same change (Rules: D5). Specifically:
the Registry section's interface block and the `.all` / `.pick` / `.filter` / `.find`
subsections MUST show the new `z.infer<T>` / `z.infer<T>[]` shapes (replacing the current
`T = unknown` illustration), and the `world.get` subsection MUST show the
`Partial<input<TSchema>>`-in / `z.infer<TSchema>`-out signature; matcher and `overrides`
prose MUST continue to describe them as input-typed (B7-R5). No prose outside this
ratification SHOULD change in this step.

- Scenario: docs reflect the new typing
  GIVEN the B7 change applied
  WHEN `docs/api-reference.md` is read
  THEN the Registry interface block lists `all`/`pick`/`filter`/`find` typed against
  `z.infer<T>` (output-shaped); `store` still shows an input-shaped item parameter; the
  `world.get` subsection shows return type `z.infer<TSchema>` and predicate type
  `Partial<input<TSchema>>`; and matchers / `overrides` are still described as
  input-typed.

## Out of scope

- **Parsing matcher or `store` values through the schema on write** (the open-question
  option (a) in the item card). B7 is documentation-of-contract, not enforcement; option
  (a) would add a runtime parse cost on every write and could reject matchers that
  intentionally produce invalid-but-useful test data. Recorded under Open questions as the
  rejected alternative; not implemented here. A future item MAY revisit it.
- Changing `Registry.store`, `SchemaOpts.matchers[K]`, `SchemaKeyMap`,
  `MatcherCtx.related`, or `GenerateOptions.overrides` to the output shape — these stay
  input-typed by design (B7-R2, B7-R5).
- Changing the implementation files `src/registry.ts` or the body of `WorldImpl.get` /
  `WorldImpl.generate` beyond what is required for the new interface types (the methods'
  generic parameters are already schema-bound; B7 is a type-surface change at the
  interface, not a behaviour change).
- Adding new registry methods (`findOrThrow`, `findLast`, `findIndex`, …) — these remain
  out of scope per B4.
- Migrating consumers to a new value type at runtime — there is no runtime migration; this
  is purely a typing fix.
- Editing the existing `WithFind` / `WithGet` test-local helper interfaces beyond the
  narrow adjustment B7-R6 permits (mirroring the new signatures so the structural
  intersection still holds).

## Open questions

- **Matcher return contract: parse-through-schema vs document-the-contract — Non-blocking.**
  The item card poses two closures for the asymmetry: (a) parse matcher / `store` inputs
  through the schema on write — a strong runtime guarantee but adds parse cost on every
  write and breaks matchers that deliberately produce invalid-but-useful data; (b)
  **document** the contract that "generators / matchers produce output-shaped values for
  output-shaped reads" and leave the runtime untouched — matches today's de-facto
  behaviour, zero runtime change. The card recommends (b); a search of the codebase
  confirms **no matcher in `src/` and no matcher in `tests/`** uses `z.coerce` or
  deliberately returns a pre-coerce value (the only `.transform()` uses are isolated
  schema-introspection tests in `tests/unit/bug-hunt.test.ts`,
  `tests/unit/generators/domains/advanced.test.ts`, and
  `tests/unit/core/zod-internals.test.ts` — none of those are matchers; they are local
  schemas, not values stored back through `registry.store`). So no current matcher relies
  on round-tripping a pre-coerce value, and (b) holds with no behavioural risk. **Adopted
  as (b)** for B7: B7-R6 pins "no parse added on write," matcher / `store` types stay
  permissive (B7-R2, B7-R5), and the contract is documented in `docs/api-reference.md`
  (B7-R7). Option (a) is deferred to a possible future item and is captured under Out of
  scope. Recorded, not blocking.

No blocking open questions remain; the spec can advance to `test-writer`.
