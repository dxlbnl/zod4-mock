# B16: Surface the auto key-match list (`docs/key-heuristics.md` + `world.explain`)

## Context

Key-based generation is one of `zod4-mock`'s most valuable affordances — a field
named `kenteken` produces a VRM, `bedrag` a finance amount, `*at`/`*date` an ISO
date / `Date` / timestamp depending on the Zod type, `*id`/`*uuid` a UUID, etc.
The dispatch table that powers this lives in
[`src/generators/data/key-map.ts`](../../src/generators/data/key-map.ts) as
**`DEFAULT_KEY_MAP`** (the exact-key, schema-type-gated entries) plus
**`DEFAULT_KEY_PATTERNS`** (suffix/prefix rules) and is consulted by
`generateFromKey(key, schema, ctx)` in the same file. The pipeline calls it from
[`src/world.ts`](../../src/world.ts) `WorldImpl.generateObjectFields` between
matchers / per-schema key maps / `withGenerators` and the schema-based fallback
in [`src/generators/schema/router.ts`](../../src/generators/schema/router.ts)
(`generateFromSchema`). All resolution decisions are field-local and made off
the *field key* + the *leaf Zod type* — no PRNG state is consumed by the
*decision* itself, only by the chosen generator.

Two affordances are bundled in GitHub issue #17, both about discoverability of
the same feature:

1. A reference page at `docs/key-heuristics.md` that lists every exact-key
   entry, every pattern, and the Dutch-localised aliases that already ship
   (`voornaam`, `achternaam`, `straat`, `stad`, `land`, `kenteken`,
   `voertuigkleur`, `kleur`, `telefoon`, `bedrag`, `prijs`, `omschrijving`,
   `bericht`). The existing `docs/key-heuristics.md` is partial, out of date,
   and lists rules that no longer exist as written; it needs to be regenerated
   from the real source.
2. A debug helper `world.explain(schema)` that returns, per field, the
   identifier of the generator that *would* resolve that field and a short
   reason — so "why is this field random?" and "did my field name almost match
   a key?" become one call away.

Both are pure read-side surfaces. The card spells out illustrative output
(here the `createdAt` field is `z.coerce.date()`, so the `date`-leaf pattern
fires and the identifier is the bare `date.anytime` — no `+toISOString`
suffix; that suffix only applies to the `string`-leaf branch of the same
pattern, see B16-R2 below for the leaf-by-leaf identifier table):

```text
id          → string.uuid      (key-pattern: ends with "id")
firstName   → person.firstName (exact key: "firstname")
email       → internet.email   (exact key: "email")
createdAt   → date.anytime     (key-pattern: ends with "at")
homeAddress → schema-based     (no key match, no matcher)
kind        → schema-based     (no key match, no matcher)
```

**Architectural notes (called out for the implementer):**

- `explain` MUST reuse the existing resolution logic — `WorldImpl`'s
  per-field decision in `generateObjectFields` — by **exposing the decision**
  rather than executing the generation. A minimal, additive refactor that
  splits "decide which generator" from "run it" is acceptable, but the spec
  pins behaviour parity (B16-R8): a separate code path that drifts from
  `generateObjectFields` would defeat the helper's purpose.
- `explain` MUST be PRNG-neutral and registry-neutral (B16-R8). It allocates
  no `recordPrng`, calls no `prng.fork`, never invokes a generator, never
  writes to the registry, never advances `generationCounter`, and never
  mutates the world's caches (`lazyCache`, `derivedUpsert`, `relationPools`,
  `pendingCounts`). Calling `explain` followed by `generate` MUST yield the
  same value as `generate` alone — this is the analogue of D9 (cache
  neutrality) for an introspection helper.
- **Localised aliases live in `DEFAULT_KEY_MAP`, not in the locale packages.**
  `packages/locale-*` provide `LocaleData` (vocabulary, formatters, Markov
  models) but no key-map merging. The Dutch aliases (`voornaam`, `bedrag`,
  `kenteken`, …) are entries in the single `DEFAULT_KEY_MAP` in
  `src/generators/data/key-map.ts`. The documentation surface (B16-R9)
  reflects this — there is no separate per-locale alias table to load.

`world.explain` adds a new method to the published `World` interface in
`src/types.ts`, so per D5 the public API change MUST be documented in
`docs/api-reference.md` in the **same** step (B16-R10). The rest of the
architecture Rules apply unchanged: D1 (no `any`, `.js` import extensions),
D4 (per-field PRNG determinism — `explain` does not allocate forks),
D9 (cache short-circuits are PRNG/counter-neutral — applies here in the
analogous sense: the `explain` path is *itself* a no-side-effect short-circuit
of generation).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as
> defined in RFC 2119 — they mark genuine requirements, not emphasis.

Item card: [wiki/backlog/doing/B16-surface-key-match-list.md](../backlog/doing/B16-surface-key-match-list.md).
Closes GitHub issue #17.

## Requirements

### B16-R1: `World.explain` is added as a typed read-only method

The `World` interface in [`src/types.ts`](../../src/types.ts) MUST add an
`explain` method, implemented on `WorldImpl` in
[`src/world.ts`](../../src/world.ts), with the signature:

```ts
explain<TSchema extends ZodTypeAny>(schema: TSchema): ExplainResult<TSchema>;
```

`ExplainResult<TSchema>` is a new exported type from `src/types.ts`:

```ts
export interface FieldExplanation {
  readonly generator: string;
  readonly reason: string;
}

export interface ExplainResult<TSchema extends ZodTypeAny> {
  /** Structured map keyed by field name in the schema's object shape. */
  readonly fields: { readonly [K in keyof z.infer<TSchema> & string]: FieldExplanation };
  /**
   * Human-readable formatter producing the card's per-line output (see
   * B16-R7). MUST be a method on the returned object (not just a `toString`
   * tag) so callers can write `world.explain(S).toString()` directly.
   */
  toString(): string;
}
```

No `any` MAY appear in the public surface (D1). The `fields` map MUST be a
plain `Record`-shaped object (enumerable string-keyed properties), so
`Object.keys(result.fields)` returns the field names in schema-shape order.
The return value MUST be a plain object (not a class instance the consumer
cannot reproduce in tests) — i.e. `Object.getPrototypeOf(result) === null` or
`=== Object.prototype` is acceptable; what matters is no exotic behaviour
beyond the documented `toString`.

- Scenario: signature compiles against `z.infer<TSchema>`
  GIVEN a world `world = createWorld({ seed: 1 })` and
  `const UserSchema = z.object({ id: z.string(), firstName: z.string() });`
  WHEN a consumer writes `const r = world.explain(UserSchema); const id: { generator: string; reason: string } = r.fields.id;`
  with no cast
  THEN `pnpm typecheck` exits 0, `r.fields.id.generator` and `r.fields.id.reason`
  are typed `string`, and no `any` appears at the call site.

- Scenario: `explain` is a method on the `World` interface
  GIVEN the `World` interface in `src/types.ts`
  WHEN the file is read
  THEN it declares an `explain<TSchema extends ZodTypeAny>(schema: TSchema): ExplainResult<TSchema>` method and exports the `ExplainResult` / `FieldExplanation` types from `src/index.ts`.

### B16-R2: `explain` returns per-field resolution mirroring the generation pipeline

For each field in the schema's top-level object shape, `explain` MUST return
a `FieldExplanation` whose `generator` and `reason` strings reflect the
**same** resolution the generation pipeline would pick if `generate(schema)`
were called immediately afterwards (B16-R8). The decision is made off the
field key and the leaf Zod type **only** — no PRNG draw, no probabilistic
optional/nullable roll, no auto-provision. Concretely, for each field key
`K` with schema `FieldSchema`:

1. If the schema is registered via `withSchema(schema, { matchers })` and
   `matchers[K]` is defined, the entry MUST be
   `{ generator: 'matcher:' + K, reason: 'matcher registered via withSchema' }`
   (B16-R4).
2. Else, if a per-schema key map registered via `withKeyMap(schema, map)`
   covers `K`, the entry MUST be
   `{ generator: 'key-map:' + K, reason: 'per-schema key map registered via withKeyMap' }`.
3. Else, if the world has a custom world-level key generator (registered
   via `withGenerators` or `WorldOptions.generators`) keyed on `K.toLowerCase()`,
   the entry MUST be
   `{ generator: 'custom:' + K.toLowerCase(), reason: 'custom generator registered via withGenerators' }`.
4. Else, if the inner (unwrapped) field schema's leaf type has an exact-key
   entry in `DEFAULT_KEY_MAP[leafType][K.toLowerCase()]`, the entry MUST be
   `{ generator: <data-namespace>.<fn-name>, reason: 'exact key: "<K.toLowerCase()>"' }`.
   The `<data-namespace>.<fn-name>` identifier is the dotted path under the
   `data` namespace (e.g. `'person.firstName'`, `'internet.email'`,
   `'location.streetAddress'`, `'finance.amount'`, `'vehicle.vrm'`,
   `'commerce.price'`). For inline/anonymous entries (e.g. the
   length-aware `text`/`description`/`bio`, the `sku` builder, the
   `accountnumber` wrapper) the identifier MUST be a stable, human-readable
   token of the form `'inline:<key>'` (e.g. `'inline:sku'`,
   `'inline:description'`). The token MUST be stable across runs.
5. Else, if a `DEFAULT_KEY_PATTERNS[leafType]` rule matches
   `K.toLowerCase()`, the entry MUST be
   `{ generator: <identifier>, reason: 'key-pattern: ' + <pattern-label> }`.
   The matching is first-match-wins, mirroring `generateFromKey`'s loop.
   Each shipped pattern rule MUST expose a documented `<pattern-label>`
   (see B16-R3 for the table) — e.g. `'ends with "id"'`,
   `'ends with "name"'`, `'ends with "url"'`, `'ends with "email"'`,
   `'ends with "at"'`.
6. Else, the entry MUST be
   `{ generator: 'schema-based', reason: 'no key match, no matcher' }`
   (B16-R6).

A field declared with relation provenance (the schema is registered with
`relations` and the user's matcher references it via `ctx.related(...)`)
is **not** treated specially by `explain` at this stage — the matcher
branch (rule 1) wins, and the returned `generator` is `'matcher:' + K`.
The presence of a `where` predicate on the relation does not change the
entry for the field carrying the matcher; see B16-R5 for how relations
themselves are surfaced.

- Scenario: exact-key entry, matcher, no-match, and pattern in one schema
  GIVEN
  ```ts
  const UserSchema = z.object({
    id: z.string(),
    firstName: z.string(),
    email: z.string(),
    createdAt: z.coerce.date(),
    homeAddress: z.string(),
    kind: z.string(),
  });
  const world = createWorld({ seed: 1 }).withSchema(UserSchema, {
    matchers: { kind: () => "admin" },
  });
  ```
  WHEN `const r = world.explain(UserSchema);` is called
  THEN
  - `r.fields.id.generator === 'string.uuid'` and
    `r.fields.id.reason === 'key-pattern: ends with "id"'` (rule 5);
  - `r.fields.firstName.generator === 'person.firstName'` and
    `r.fields.firstName.reason === 'exact key: "firstname"'` (rule 4);
  - `r.fields.email.generator === 'internet.email'` and
    `r.fields.email.reason === 'exact key: "email"'` (rule 4);
  - `r.fields.createdAt.generator === 'date.anytime'` and
    `r.fields.createdAt.reason === 'key-pattern: ends with "at"'` (rule 5,
    `date` leaf type);
  - `r.fields.homeAddress.generator === 'schema-based'` and
    `r.fields.homeAddress.reason === 'no key match, no matcher'` (rule 6);
  - `r.fields.kind.generator === 'matcher:kind'` and
    `r.fields.kind.reason === 'matcher registered via withSchema'` (rule 1).

- Scenario: schema-type gating — string-only key on a number field skips to schema-based
  GIVEN `const S = z.object({ email: z.number() });` (numerically typed
  field whose name would match the `email` exact-key entry only for the
  `string` leaf type) registered on a world with no matchers
  WHEN `world.explain(S)` is called
  THEN `r.fields.email.generator === 'schema-based'` and
  `r.fields.email.reason === 'no key match, no matcher'` — the
  `DEFAULT_KEY_MAP.string.email` entry MUST NOT fire for a `z.number()`
  field, mirroring `generateFromKey`'s `DEFAULT_KEY_MAP[schemaType]?.[lk]`
  gate.

- Scenario: ISO-date pattern reports the right identifier for the leaf type
  GIVEN `const S = z.object({ createdAt: z.string(), occurredAt: z.date(), millisAt: z.number() });`
  WHEN `world.explain(S)` is called
  THEN the three entries report, respectively:
  - `createdAt`: `{ generator: 'date.anytime+toISOString', reason: 'key-pattern: ends with "at"' }`
  - `occurredAt`: `{ generator: 'date.anytime', reason: 'key-pattern: ends with "at"' }`
  - `millisAt`: `{ generator: 'date.anytime+getTime', reason: 'key-pattern: ends with "at"' }`
  The identifier MUST carry the leaf-type-specific transform suffix (`+toISOString`
  for the string pattern, `+getTime` for the number pattern; no suffix for the
  raw `date` pattern) so the consumer can distinguish the three.

### B16-R3: `explain` covers the top-level object shape (shallow); nested object fields are summarised

`explain` MUST traverse the schema's **top-level** object shape only — i.e.
exactly the fields enumerable from `def(schema).shape` after unwrapping
outer `optional`/`nullable`/`lazy` wrappers in the same order
`WorldImpl.generate` unwraps them. For a field whose inner (unwrapped)
schema is itself an object (or `lazy` resolving to an object),
`explain` MUST report a single line of the form
`{ generator: 'schema-based:object', reason: 'nested object — call explain(<FieldSchema>) for details' }`
**unless** a matcher / per-schema key map / custom generator covers the
field key, in which case rules 1–3 of B16-R2 still win (and the explanation
notes that — `'matcher:<key>'`, etc., as usual). Nested arrays of objects
are likewise summarised as
`{ generator: 'schema-based:array', reason: 'array — element type explained on demand' }`.

This is the explicit "shallow" choice that closes the card's open question
on traversal depth. Deeper recursion (e.g. an opt-in
`world.explain(schema, { deep: true })`) is **out of scope** (see Out of
scope). The shallow contract keeps the helper cheap, the output a single
flat table, and leaves room for a deep variant later without breaking the
returned shape.

- Scenario: nested object summarised, top-level keys explained
  GIVEN
  ```ts
  const AddressSchema = z.object({ street: z.string(), city: z.string() });
  const UserSchema = z.object({
    id: z.string(),
    address: AddressSchema,
    tags: z.array(z.object({ name: z.string() })),
  });
  const world = createWorld({ seed: 1 });
  ```
  WHEN `const r = world.explain(UserSchema);` is called
  THEN
  - `Object.keys(r.fields)` is exactly `['id', 'address', 'tags']` (top-level
    keys in shape order);
  - `r.fields.id.generator === 'string.uuid'`;
  - `r.fields.address.generator === 'schema-based:object'` and
    `r.fields.address.reason === 'nested object — call explain(<FieldSchema>) for details'`;
  - `r.fields.tags.generator === 'schema-based:array'` and
    `r.fields.tags.reason === 'array — element type explained on demand'`.

- Scenario: matcher on a nested-object field wins over the nested-object summary
  GIVEN the same `UserSchema` and a world registered with
  `world.withSchema(UserSchema, { matchers: { address: () => ({ street: "Main", city: "Berlin" }) } })`
  WHEN `world.explain(UserSchema)` is called
  THEN `r.fields.address.generator === 'matcher:address'` and
  `r.fields.address.reason === 'matcher registered via withSchema'` —
  the matcher branch (B16-R2 rule 1) wins over the nested-object summary.

### B16-R4: matchers are surfaced

A field key `K` for which the most recent `withSchema(schema, { matchers })`
registration provides `matchers[K]` MUST produce
`{ generator: 'matcher:' + K, reason: 'matcher registered via withSchema' }`
in the `fields` map (rule 1 of B16-R2). This pins the rule against
regression and is the primary affordance for the card's stated use case
("did my matcher actually fire for this key?").

- Scenario: matcher entry reports the matcher provenance
  GIVEN
  ```ts
  const OrderSchema = z.object({ id: z.string(), total: z.number() });
  const world = createWorld({ seed: 1 }).withSchema(OrderSchema, {
    matchers: { total: () => 42 },
  });
  ```
  WHEN `world.explain(OrderSchema)` is called
  THEN `r.fields.total.generator === 'matcher:total'` and
  `r.fields.total.reason === 'matcher registered via withSchema'`,
  while `r.fields.id.generator === 'string.uuid'`
  (`'key-pattern: ends with "id"'`) — the matcher did not shadow the `id`
  field.

### B16-R5: relations referenced from a matcher show the matcher; relations on the schema are summarised

`explain` is field-scoped, not relation-scoped: when a matcher reads
`ctx.related("owner")` to compute its field, the field's entry is the
matcher entry (B16-R4). For consumer discoverability, `explain` MUST also
report the schema's declared `relations` in an additional, separate top-level
property on the returned object:

```ts
interface ExplainResult<TSchema> {
  readonly fields: { readonly [K in keyof z.infer<TSchema> & string]: FieldExplanation };
  readonly relations: { readonly [relName: string]: { readonly schema: string; readonly where: 'present' | 'none' } };
  toString(): string;
}
```

Where the per-relation entry MUST report:

- `schema`: a stable, human-readable identifier for the related schema —
  the `def(relSchema).type` value (e.g. `'object'`, `'lazy'`) for now is
  acceptable as a v1 placeholder, since Zod v4 does not name anonymous
  object schemas (no `_zod.def.name` to read); the spec pins the literal
  string `def(relSchema).type` so the output is deterministic.
- `where`: `'present'` when the relation entry is the object form
  `{ schema, where }` with `where` defined (B11), `'none'` otherwise.

If the schema has no relations (the common case), `relations` MUST be an
empty object `{}` — never `undefined`, so consumers can iterate without a
nullish guard.

- Scenario: relation with `where` predicate is reported as present
  GIVEN
  ```ts
  const PostSchema = z.object({ id: z.string(), published: z.boolean() });
  const ActivitySchema = z.object({ id: z.string(), postId: z.string() });
  const world = createWorld({ seed: 1 })
    .withSchema(PostSchema)
    .withSchema(ActivitySchema, {
      relations: { post: { schema: PostSchema, where: (p) => p.published } },
      matchers: { postId: (ctx) => ctx.related("post").id },
    });
  ```
  WHEN `const r = world.explain(ActivitySchema);` is called
  THEN
  - `r.fields.postId.generator === 'matcher:postId'` and
    `r.fields.postId.reason === 'matcher registered via withSchema'`;
  - `r.relations.post.schema === 'object'` (the leaf-`def.type` of `PostSchema`)
    and `r.relations.post.where === 'present'`.

- Scenario: bare-schema relation reports `where: 'none'`
  GIVEN `world.withSchema(ActivitySchema, { relations: { post: PostSchema } })`
  (the historic bare-schema form)
  WHEN `world.explain(ActivitySchema)` is called
  THEN `r.relations.post.where === 'none'`.

- Scenario: schema with no relations exposes `{}`
  GIVEN a world `world = createWorld({ seed: 1 }).withSchema(z.object({ id: z.string() }));`
  WHEN `world.explain(...)` is called on that schema
  THEN `r.relations` is strictly equal to `{}` (an empty object, not `undefined`,
  not a `null` prototype) and `Object.keys(r.relations).length === 0`.

### B16-R6: the no-match / ad-hoc / unregistered case reports the schema-based fallback

When no matcher, per-schema key map, world-level custom generator,
`DEFAULT_KEY_MAP` exact-key entry, or `DEFAULT_KEY_PATTERNS` rule applies
for a field key `K`, the entry MUST be exactly
`{ generator: 'schema-based', reason: 'no key match, no matcher' }`.
This is the card's "near-miss" diagnostic — the line the user reads to
realise their field name (e.g. `homeAddress`, `kind`) did not auto-resolve
and a random schema-based value will be produced.

This applies whether or not the schema is registered via `withSchema`: an
unregistered schema (`world.explain(SomeAdHocSchema)`) MUST still produce
this fallback line for every field that does not match the key/pattern
maps (no matchers exist on an unregistered schema, so rule 1 of B16-R2 is
inapplicable).

- Scenario: unregistered schema, no key matches
  GIVEN `const S = z.object({ kind: z.string(), homeAddress: z.string() });`
  on a world with no registration of `S`
  WHEN `world.explain(S)` is called
  THEN `r.fields.kind.generator === 'schema-based'` and
  `r.fields.kind.reason === 'no key match, no matcher'`, and
  `r.fields.homeAddress.generator === 'schema-based'` and
  `r.fields.homeAddress.reason === 'no key match, no matcher'`.

### B16-R7: `toString()` produces a human-readable, aligned table

`ExplainResult.toString()` MUST return a string composed of one line per
field, in the order `Object.keys(r.fields)` returns them. Each line MUST
match the format

```
<fieldName padded to column-1 width> → <generator padded to column-2 width> (<reason>)
```

where the column-1 width is `max(fieldNameLength) + 1` (one space minimum
between the longest name and the arrow) and the column-2 width is
`max(generatorLength) + 1`. Trailing spaces on each line MUST be trimmed
*before* the arrow / parenthesis but the padding before the arrow MUST be
preserved (alignment is the point). Lines MUST be separated by `\n`.
After the field lines, if `relations` has at least one entry, `toString()`
MUST append a blank line followed by

```
relations:
  <relName> → <schema>  (where: <present|none>)
```

— one line per relation, in `Object.keys(r.relations)` order.

A scenario pins the exact substring for the card's example, so a future
formatter change cannot silently break the output users paste into
GitHub issues.

- Scenario: `toString()` output for the card's example schema
  GIVEN the `UserSchema` and world from the B16-R2 first scenario (the
  six-field card example with a matcher on `kind`, where
  `createdAt: z.coerce.date()` — a `date` leaf, so the pattern identifier
  is the bare `date.anytime` with no `+toISOString` suffix)
  WHEN `const out = world.explain(UserSchema).toString();` is called
  THEN `out` contains, as exact substrings (each on its own line, in
  schema-shape order — column-1 width = 12, column-2 width = 17,
  re-derived from the longest field name `homeAddress` (11 chars) and
  the longest generator identifier `person.firstName` (16 chars)):
  - `'id          → string.uuid      (key-pattern: ends with "id")'`
  - `'firstName   → person.firstName (exact key: "firstname")'`
  - `'email       → internet.email   (exact key: "email")'`
  - `'createdAt   → date.anytime     (key-pattern: ends with "at")'`
  - `'homeAddress → schema-based     (no key match, no matcher)'`
  - `'kind        → matcher:kind     (matcher registered via withSchema)'`
  AND `out.split('\n').length === 6` (no trailing blank line when there
  are no relations). The per-field identifiers in this output MUST be
  byte-identical to `r.fields[k].generator` — `toString()` is a pure
  formatter over the structured `fields` map (no parallel display map,
  no per-leaf-type re-rendering), so the structured form (B16-R2) and
  the rendered form are guaranteed in lock-step.

- Scenario: `toString()` includes a relations block when relations exist
  GIVEN the `ActivitySchema` world from B16-R5's first scenario
  WHEN `const out = world.explain(ActivitySchema).toString();` is called
  THEN `out` ends with the substring
  `'\nrelations:\n  post → object  (where: present)'`.

### B16-R8: `explain` is read-only — no PRNG draw, no registry mutation, no counter advance

`world.explain(schema)` MUST NOT:

- Call `prng.fork(...)`, `prng.random()`, `prng.int(...)`, `prng.pick(...)`,
  `prng.shuffle(...)`, `prng.sample(...)`, or `prng.bytes(...)` on the
  world's PRNG (or on any PRNG it allocates — it MUST NOT allocate any).
- Advance the world's `generationCounter`.
- Write to the registry (no `registry.store` call).
- Auto-provision a related record, run any matcher, or invoke
  `generateFromKey` / `generateFromSchema`.
- Mutate `lazyCache`, `derivedUpsert`, `relationPools`, or `pendingCounts`.

This is the analogue of D9 (cache short-circuits are PRNG/counter-neutral)
for an introspection helper: calling `explain` MUST leave observable world
state byte-identical to never having called it. The test pins this with
two cloned worlds: one calls `explain` before `generate`, the other only
calls `generate` — the generated records MUST be deeply equal.

`explain` MAY resolve `lazy` wrappers using the **same** `lazyCache` the
generation pipeline reads from, populating it for the duration of the call
— this is a benign read-through cache, not an observable mutation, and it
keeps `explain` cheap on recursive schemas. If the implementer chooses to
populate the cache, doing so MUST NOT change later `generate` behaviour
(the cache already memoises the same `getter()` result the next
`generate` call would produce; populating it eagerly is equivalent to
populating it lazily on first `generate`). If this turns out to be
observable in any test, the implementer MUST instead use a local cache
scoped to the `explain` call.

- Scenario: `explain` is PRNG- and registry-neutral
  GIVEN two worlds created with the same seed:
  ```ts
  const A = createWorld({ seed: 7 }).withSchema(UserSchema);
  const B = createWorld({ seed: 7 }).withSchema(UserSchema);
  ```
  WHEN `A.explain(UserSchema)` is called, then `A.generate(UserSchema)`,
  while `B` only calls `B.generate(UserSchema)`
  THEN `A.generate(UserSchema)`'s result deep-equals
  `B.generate(UserSchema)`'s result (no PRNG drift), AND
  `A.registry.count(UserSchema) === B.registry.count(UserSchema)` after
  the calls (no extra rows stored by `A.explain`).

- Scenario: `explain` does not advance `generationCounter`
  GIVEN a world `world = createWorld({ seed: 7 }).withSchema(UserSchema)`
  and a snapshot of `world.prng.seed` before the call
  WHEN `world.explain(UserSchema)` is invoked
  THEN `world.prng.seed` is byte-identical afterwards (the world PRNG was
  not consumed), AND subsequent `world.generate(UserSchema)` produces the
  same value as a freshly-seeded sibling world that never called
  `explain`.

### B16-R9: `docs/key-heuristics.md` is regenerated to match the real source

The existing `docs/key-heuristics.md` is partial and lists rules that no
longer reflect the live `DEFAULT_KEY_MAP` / `DEFAULT_KEY_PATTERNS`. It MUST
be replaced (in the same item) with a page that lists, in this order:

1. A **How it works** section pointing at `generateFromKey` and the
   matcher → key-map → custom → key-based → schema-based pipeline order,
   and that key matching is case-insensitive (lowercased before lookup).
2. The **Exact-key generators** table for `string` leaf type — every key
   in `DEFAULT_KEY_MAP.string` with its generator identifier (matching
   `world.explain`'s identifier, B16-R2 rule 4) and a one-line description.
3. The **Exact-key generators** table for `number` leaf type — every key
   in `DEFAULT_KEY_MAP.number`.
4. The **Pattern generators** tables for `string`, `date`, and `number`
   leaf types — every rule in `DEFAULT_KEY_PATTERNS` with its label
   (matching `world.explain`'s pattern label, B16-R2 rule 5) and a
   one-line description.
5. A **Localised aliases** section, surfacing the Dutch-language keys
   that already ship in `DEFAULT_KEY_MAP.string`: `voornaam`,
   `achternaam`, `straat`, `stad`, `land`, `kenteken`,
   `voertuigkleur`, `kleur`, `telefoon`, `prijs`, `omschrijving`,
   `bericht` (and any other locale-flagged entry — the implementer
   re-derives this list from the source map). The section MUST note
   that locale packages (`@zod4-mock/locale-*`) provide vocabulary, not
   key maps — the aliases live in `DEFAULT_KEY_MAP` itself.
6. A short **Using `world.explain` to debug a schema** subsection (1–2
   examples) cross-linking to `docs/api-reference.md#worldexplainschema`
   (B16-R10).

The page MUST list **every** exact-key entry currently in
`DEFAULT_KEY_MAP.string` and `DEFAULT_KEY_MAP.number`, and **every**
pattern rule in `DEFAULT_KEY_PATTERNS.string` / `.date` / `.number`.
"Hand-curated" is acceptable (faster than a generator script for the
initial drop); a follow-up to automate the table from
`src/generators/data/key-map.ts` is recorded under Out of scope. The
implementer MUST cross-check by enumerating `Object.keys(DEFAULT_KEY_MAP.string)`
and `Object.keys(DEFAULT_KEY_MAP.number)` while writing the page, so no
shipped key is silently omitted.

- Scenario: every shipped key appears in the page
  GIVEN `DEFAULT_KEY_MAP` imported from `src/generators/data/key-map.ts`
  WHEN the test reads `docs/key-heuristics.md` as a string
  THEN for every key in `Object.keys(DEFAULT_KEY_MAP.string)` and every
  key in `Object.keys(DEFAULT_KEY_MAP.number)`, the lowercased key
  appears at least once as a substring in the doc; AND the page contains
  the literal headings `Exact-key generators (string)`,
  `Exact-key generators (number)`, `Pattern generators`, and
  `Localised aliases`.

- Scenario: Dutch aliases listed
  GIVEN the page content from `docs/key-heuristics.md`
  WHEN it is read
  THEN the substrings `voornaam`, `achternaam`, `straat`, `stad`,
  `kenteken`, `bedrag`, `telefoon`, `omschrijving`, `bericht`, and
  `kleur` all appear inside (or following) the **Localised aliases**
  section heading.

### B16-R10: `docs/api-reference.md` documents `world.explain` (D5 — same step)

Per the standing rule D5, the API reference MUST be updated **in the same
change** that lands `world.explain`. The update MUST include:

- A new entry in the "Exports overview" table for `ExplainResult` /
  `FieldExplanation` types (or the smallest equivalent if those names
  change; the rule is "the new types are listed").
- A new subsection `### world.explain(schema)` under `createWorld`'s
  `World` section, showing the signature, the returned
  `ExplainResult` shape (the `fields` map, the `relations` map, and the
  `toString()` formatter), an example output (the card's six-field
  example or equivalent), and an explicit note that the helper is
  read-only and PRNG-neutral (B16-R8).
- A cross-link from the existing key-heuristics prose / table reference
  to `docs/key-heuristics.md`.

- Scenario: `docs/api-reference.md` carries the new section
  GIVEN the B16 change applied
  WHEN `docs/api-reference.md` is read
  THEN the file contains the literal substring `### world.explain(schema)`
  (the heading) AND the literal substring `ExplainResult` (the returned
  type name) AND a fenced TypeScript code block showing the
  `explain<TSchema extends ZodTypeAny>(schema: TSchema): ExplainResult<TSchema>`
  signature.

### B16-R11: changeset entry

A changeset file MUST be added at
`.changeset/b16-world-explain-and-key-heuristics.md` of bump kind
`"zod4-mock": minor` (new public method on a minor-line, no breaking
change). The summary MUST cover both bundled affordances —
`world.explain` (the new method, its read-only PRNG-neutral contract,
and the structured + `toString` output) and the regenerated
`docs/key-heuristics.md` surface (exact keys, patterns, Dutch aliases) —
and MUST reference closing GitHub issue #17.

- Scenario: changeset file present and well-formed
  GIVEN the B16 change applied
  WHEN `.changeset/b16-world-explain-and-key-heuristics.md` is read
  THEN the file starts with a frontmatter block of exactly
  `---\n"zod4-mock": minor\n---\n` (a minor bump for the root package),
  the body mentions both `world.explain` and `docs/key-heuristics.md`,
  and the body contains the literal substring `#17` (the closing issue
  reference).

## Out of scope

- **Deep recursion through nested object fields.** B16-R3 pins a shallow
  contract — nested objects are summarised as one line. An opt-in
  `world.explain(schema, { deep: true })` (or a separate
  `world.explain(NestedSchema)` call by the consumer) is left for a
  follow-up. The shallow output is the contract; future deep mode SHOULD
  be additive, not a re-shape of `ExplainResult.fields`.
- **`world.generate(schema, { inspect: true })` flag.** The card raised
  the option of generating without storing and returning per-field
  provenance instead of values. B16 ships the standalone `explain`
  method only; the `inspect` flag is a possible future composition with
  `overrides` (dry-run debugging) and is **not** implemented here.
- **Cross-schema explain** (e.g. `world.explain()` reporting on all
  registered schemas at once, or `world.explain(SchemaA, SchemaB)`).
  Single-schema scope only in v1; a future iteration MAY add a
  `world.explainAll()` returning a `Record<schemaName, ExplainResult>`
  but that is not in this item.
- **Auto-generation of `docs/key-heuristics.md` from
  `src/generators/data/key-map.ts`.** B16-R9 ships a hand-curated page
  cross-checked against `Object.keys(DEFAULT_KEY_MAP.*)`; a follow-up
  item MAY add `scripts/gen-key-table.ts` to keep the page mechanically
  in lockstep with the source.
- **Performance benchmarks / profiling.** `explain` is read-only and
  per-field, so its cost is `O(n_fields)`; no benchmark requirement is
  attached.
- **UI / Playground integration.** The playground may *use* the new
  helper but this item ships no playground changes.
- **Behaviour changes to `generateFromKey`, `DEFAULT_KEY_MAP`, or any
  generator.** B16 is read-side surfacing only; touching the dispatch
  table to make a key "more findable" is a separate item. Any minimal,
  additive refactor that splits "decide which generator" from "run it"
  (B16-R8 implementation hint) MUST preserve the existing per-field
  decision order from `WorldImpl.generateObjectFields` byte-for-byte —
  no scenario in the existing suite changes its value.

## Open questions

- **Structured data vs string output — Non-blocking.** The card asked
  whether `explain` should return human-readable lines or a structured
  object. Adopted as **both**: structured `ExplainResult.fields` /
  `relations` is the primary return (B16-R1), and a `toString()`
  formatter renders the card's per-line format (B16-R7). Recorded,
  proceeds.
- **`explain` method vs `generate({ inspect: true })` flag — Non-blocking.**
  Adopted as a **standalone `explain` method**. The `inspect` flag is
  recorded under Out of scope as a future consideration; B16 does not
  implement it. Recorded, proceeds.
- **Single-schema scope — Non-blocking.** Adopted: `explain` is
  schema-scoped (no cross-schema or all-schemas form in v1). Recorded
  under Out of scope as well; the v1 shape (`fields` + `relations` +
  `toString`) leaves room for a future `world.explainAll()` that
  returns a `Record<schemaName, ExplainResult>` without re-shaping the
  per-schema result. Recorded, proceeds.

No blocking open questions remain; the spec can advance to `test-writer`.
