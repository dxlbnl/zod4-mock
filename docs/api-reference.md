# API Reference

Complete reference for every exported symbol. Use this as a lookup guide, not a reading-order document.

---

## Exports overview

| Export                 | Kind      | Description                                      |
| ---------------------- | --------- | ------------------------------------------------ |
| `generate`             | function  | Zero-config entry point — no world setup needed  |
| `createWorld`          | function  | Create a seeded generation world                 |
| `generators`           | namespace | Built-in primitive generators                    |
| `generateFromSchema`   | function  | Low-level schema-based generator                 |
| `generateFromKey`      | function  | Low-level key-based generator                    |
| `createPrng`           | function  | Create a standalone seeded PRNG                  |
| `fieldSeed`            | function  | Derive a per-field seed                          |
| `World`                | type      | The world interface                              |
| `WorldOptions`         | type      | Options for `createWorld`                        |
| `GeneratorContext`     | type      | Context passed to matchers and generators        |
| `BoundGenerators`      | type      | Pre-PRNG-bound generators namespace              |
| `PrimarySchemaOpts`    | type      | Options for primary/relational `withSchema` call |
| `DerivedSchemaOpts`    | type      | Options for derived `withSchema` call            |
| `Prng`                 | type      | The PRNG interface                               |
| `Registry`             | type      | The registry interface                           |
| `DEFAULT_KEY_MAP`      | object    | Declarative exact-match key→generator map        |
| `DEFAULT_KEY_PATTERNS` | object    | Suffix/prefix pattern rules                      |
| `KeyGenerator`         | type      | Custom field-name generator function             |
| `PrngGen`              | type      | `(prng: Prng) => T` — map value type             |
| `KeyPattern`           | type      | A pattern rule `{ test, generate }`              |
| `SchemaKeyMap`         | type      | Per-schema key generator map (typed)             |
| `GenerateOptions`      | type      | Options for `generate()` and `world.generate()`  |
| `DeepPartial`          | type      | Recursive optional type                          |
| `extend`               | function  | Shallow-per-section locale override helper       |
| `ExplainResult`        | type      | Return type of `world.explain(schema)` (B16)     |
| `FieldExplanation`     | type      | Per-field entry in `ExplainResult.fields`        |
| `RelationExplanation`  | type      | Per-relation entry in `ExplainResult.relations`  |
| `LocaleData`           | type      | Pluggable locale interface                       |
| `LastNamePrefix`       | type      | A surname prefix (tussenvoegsel) + its weight    |
| `Currency`             | type      | `{ code, name, symbol, numeric }`                |

The `en` and `nl` locales are **not** exported from `zod4-mock`. They live in
separate, opt-in workspace packages — see [Localization](#localization).

---

## `generate(schema, options?)`

```ts
function generate<TSchema extends ZodTypeAny>(
  schema: TSchema,
  options?: GenerateOptions<input<TSchema>>,
): input<TSchema>;
```

Zero-config entry point. Creates a temporary world internally and discards it. No setup required.

```ts
import { generate } from "zod4-mock";

const user = generate(UserSchema);
const admin = generate(UserSchema, { overrides: { role: "admin" }, seed: 42 });
```

`options.seed` defaults to a random value if omitted. Pass an explicit seed for deterministic output.

---

## `createWorld(options)`

```ts
function createWorld(options: WorldOptions): World;
```

Creates a new seeded world. Returns a `World` instance that supports fluent chaining.

### `WorldOptions`

```ts
interface WorldOptions {
  seed: number; // required
  optionalProbability?: number; // default: 0.2
  defaultArrayLength?: readonly [number, number]; // default: [1, 5]
  generators?: Record<string, KeyGenerator>; // default: {}
}
```

**`seed`** — master seed for all generation in this world. The same seed with the same builder chain and the same per-schema call sequence always produces byte-identical output. Call order across distinct schemas does not affect any value: `world.generate(X); world.generate(Y)` and `world.generate(Y); world.generate(X)` produce the same `X` and the same `Y` either way.

**Pattern — hoist schemas to module scope.** Determinism is keyed on schema _reference_ identity, not structural equality. If you construct a schema inline inside a factory or a per-test helper, two calls will see two different references and produce different output. Construct your schemas once (typically at module scope) and import them where needed — that's how the same seed gives the same output across separate `createWorld` calls.

```ts
// ✗ inline construction inside `make` — separate references, different output
const make = (seed: number) => createWorld({ seed }).generate(z.array(Person).length(3));

// ✓ hoist the schema — both calls share the reference, identical output
const ArrSchema = z.array(Person).length(3);
const make = (seed: number) => createWorld({ seed }).generate(ArrSchema);
```

**`optionalProbability`** — probability in [0, 1] that `z.optional()` or `z.nullable()` fields are omitted/nulled. Set to `0` to always generate optional fields; `1` to always omit them. Default `0.2`.

**`defaultArrayLength`** — fallback `[min, max]` when a `z.array()` schema has no `.min()`, `.max()`, or `.length()` constraint. Default `[1, 5]`.

**`generators`** — custom key-based generators applied to every schema in the world. Keys are matched case-insensitively. See [`KeyGenerator`](#keygenerator) below.

**`locale`** — active locale used by name and word generators. When omitted, a built-in **minimal English locale** is used (short curated word/name lists). For larger curated corpora install a full locale package and pass it explicitly:

```ts
import { createWorld } from "zod4-mock";
import { en } from "@zod4-mock/locale-en";
import { nl } from "@zod4-mock/locale-nl";

createWorld({ seed: 42 }); // minimal English default
createWorld({ seed: 42, locale: en }); // full English
createWorld({ seed: 42, locale: nl }); // Dutch
```

---

## `World` — builder methods

All builder methods return `this` for fluent chaining.

### `.withSchema(schema, opts?)`

Registers a schema with the world. Three modes:

**Primary** — schema generates independently:

```ts
withSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  opts?: PrimarySchemaOpts<TSchema>,
): this
```

```ts
interface PrimarySchemaOpts<TSchema extends ZodTypeAny> {
  relations?: Record<string, RelationEntry>;
  matchers?: {
    [K in keyof input<TSchema>]?: (ctx: GeneratorContext) => input<TSchema>[K];
  };
}

// A relation entry is either a bare Zod schema (the historic form) or an
// object that adds a `where` predicate filtering the candidate pool.
type RelationEntry<TRelation extends ZodTypeAny = ZodTypeAny> =
  | TRelation
  | {
      readonly schema: TRelation;
      readonly where?: (item: z.infer<TRelation>) => boolean;
    };
```

**Derived** — each output record is driven by one source record:

```ts
withSchema<TSchema extends ZodTypeAny, TSource extends ZodTypeAny>(
  schema: TSchema,
  opts: DerivedSchemaOpts<TSchema, TSource>,
): this
```

```ts
interface DerivedSchemaOpts<TSchema extends ZodTypeAny, TSource extends ZodTypeAny> {
  from: TSource;
  /**
   * Identity field on the source record used to key the per-pair derived-schema
   * upsert. Default identity is reference equality on `source`; declare
   * `sourceKey` for the look-alike case where the caller reconstructs the
   * source (`{ ...user }`) but the field (e.g. `id`) is stable. Declared at
   * registration only — not overridable per `generate` call.
   */
  sourceKey?: keyof input<TSource> & string;
  relations?: Record<string, RelationEntry>;
  matchers?: {
    [K in keyof input<TSchema>]?: (
      ctx: GeneratorContext & { readonly source: input<TSource> },
    ) => input<TSchema>[K];
  };
}
```

The same output schema can be registered multiple times with different `from:` values to represent multiple source types — generating the output will produce one record per source across all bindings.

**Identity-preserving derivation.** By default, `world.generate(DerivedSchema, { source: x })` is an **upsert** keyed by `(DerivedSchema, identity(x))`: the first call generates and stores; every subsequent call with the same identity returns the stored instance by reference and does not advance the PRNG. Identity is reference equality on `source` by default; declare `sourceKey: '<field>'` to use `source[sourceKey]` instead so a reconstructed look-alike resolves to the same record:

```ts
world.withSchema(UserProfileSchema, {
  from: UserSchema,
  sourceKey: "id", // identity = source.id, not the source reference
  matchers: { userId: (ctx) => ctx.source.id },
});

const a = world.generate(UserProfileSchema, { source: user });
const b = world.generate(UserProfileSchema, { source: { ...user } });
// a === b — resolved via `id`, not reference

// Opt out for "many derivations from one source":
world.generate(UserProfileSchema, { source: user, unique: false });
```

See [`GenerateOptions`](#generateoptions) for `unique?: boolean` and its interaction with `store: false`.

**Examples:**

```ts
// Primary — no relations
world.withSchema(PersonSchema);

// Relational — ownerId drawn from a related person
world.withSchema(FileSchema, {
  relations: { owner: PersonSchema },
  matchers: { ownerId: (ctx) => ctx.related("owner").personId },
});

// Derived — one output per text file source
world.withSchema(RawDataSchema, {
  from: TextFileSchema,
  matchers: {
    id: (ctx) => ctx.source.fileId,
    type: () => "text" as const,
  },
});
```

**Filtered relations (`where` predicate).** A relation entry MAY be written as an object `{ schema, where? }` to filter the candidate pool to records satisfying a predicate. The predicate receives `z.infer<RelationSchema>` (the registry-read shape, per [`registry.all`](#allschema)); no cast or `any` is required:

```ts
const PostSchema = z.object({
  id: z.string(),
  kind: z.enum(["article", "draft"]),
});

// Comments only relate to *article* posts; drafts are excluded.
world.withSchema(CommentSchema, {
  relations: {
    post: { schema: PostSchema, where: (p) => p.kind === "article" },
  },
  matchers: { postId: (ctx) => ctx.related("post").id },
});

// `ctx.related.many` honours the same predicate.
world.withSchema(DigestSchema, {
  relations: {
    items: { schema: PostSchema, where: (p) => p.kind === "article" },
  },
  matchers: { posts: (ctx) => ctx.related.many("items", 5) },
});
```

The bare-schema form is preserved unchanged — passing `relations: { post: PostSchema }` keeps the no-filter behaviour. Internally, both forms normalise to the same per-record snapshot; the predicate is evaluated once per `(record, relation)` when the snapshot is first built, so a same-record cache hit consumes no extra PRNG state and does not re-run `where`. The snapshot is re-evaluated for each new record, so records added to the registry between two generations are observable to the second.

**Empty filtered pool throws.** When `where` is declared and the candidate pool — `registry.all(schema).filter(where)` — is empty (or, for `.many(name, count)`, smaller than `count`), `ctx.related` / `ctx.related.many` throws a clear error naming the relation:

```
No related 'post' matches the `where` predicate. Pre-populate the registry
with records satisfying the predicate, or relax the predicate.
```

The library does NOT attempt to auto-provision a record that satisfies an arbitrary predicate; the predicate is your contract. Pre-populate the registry (via `world.populate(PostSchema, n)`, `world.registry.store(...)`, or explicit `world.generate(...)` calls) with records that satisfy `where`, or relax the predicate. Self-referential relations are exempt: an empty filtered pool returns `undefined` from `ctx.related` (matchers guard `?.id ?? null`) and `.many` clamps to whatever distinct records exist that satisfy `where`.

### `.withGenerators(map)`

```ts
withGenerators(map: Record<string, KeyGenerator>): this
```

Adds custom key-based generators. Calls are **additive** — each call merges without removing prior entries. Keys are matched case-insensitively and take priority over built-in heuristics.

```ts
world.withGenerators({
  vendorCode: (_schema, ctx) => `V-${generators.string.uuid(ctx.prng)}`,
});
```

### `.withKeyMap(schema, map)`

```ts
withKeyMap<T extends ZodTypeAny>(schema: T, map: SchemaKeyMap<T>): this
```

Binds per-field generator functions to a **specific schema**. Unlike `withGenerators` (global, untyped), `withKeyMap` is schema-scoped and fully type-safe.

**Priority order** (highest → lowest):

1. `withSchema` matchers
2. `withKeyMap`
3. `withGenerators` (global)
4. `DEFAULT_KEY_MAP` / `DEFAULT_KEY_PATTERNS` (built-in heuristics)
5. Schema-based fallback

```ts
world.withKeyMap(ProductSchema, {
  sku: (ctx) => `SKU-${ctx.prng.int(1000, 9999)}`,
  price: (ctx) => ctx.prng.int(100, 50000),
});
```

---

## `World` — generation

### `.generate(schema, options?)`

```ts
generate<TSchema extends ZodTypeAny>(
  schema: TSchema,
  options?: GenerateOptions<input<TSchema>>,
): input<TSchema>
```

Generates a value matching the schema. The return type is fully inferred.

- If `schema` is an array: returns an array. Length derived from Zod constraints, falling back to `defaultArrayLength`. Per-index `overrides` apply uniformly on every array dispatch arm (primary, derived, ad-hoc) via field-level deep-merge per record; on a primary-registered array with pre-existing registry records, override slots at indices `< existingCount` are ignored (records already stored under D8 are returned untouched — overrides apply to freshly-generated records). `{ store: false }` against a primary-registered inner schema returns ephemeral records of the auto-rolled length, no registry write.
- If the schema has `from:` bindings (derived): generates one output per source in the registry.
- If the schema is primary (registered or not): generates and stores a new record.
- If `schema` is registered with `from:` and the call passes `{ source: x }`, the call is an **upsert** keyed by `(schema, identity(x))` — repeat calls with the same identity return the stored record by reference. See [`.withSchema`](#withschemaschema-opts) and the `unique` option below.

**Array modifier chaining** is fully supported:

```ts
world.generate(PersonSchema.array()); // array
world.generate(PersonSchema.array().optional()); // array | undefined
world.generate(PersonSchema.array().nullable()); // array | null
```

**`GenerateOptions`**

```ts
interface GenerateOptions<T> {
  overrides?: DeepPartial<T>; // deep-merged after generation; arrays replaced
  transform?: (data: T) => T; // applied after overrides
  seed?: number; // only used by module-level generate()
  store?: boolean; // default true; false suppresses the registry write
  unique?: boolean; // default true; false bypasses the derived-schema upsert
}
```

**`overrides`** — deep-partial merge. Nested objects are merged recursively; arrays are replaced entirely. Applied before `transform`. For an **array schema**, pass an array of per-index overrides (`{ overrides: [obj0, obj1, ...] }`): `overrides[i]` deep-merges into the i-th returned record on every array dispatch arm (primary, derived, ad-hoc). On a **primary-registered** array with pre-existing registry records, override slots at indices `< existingCount` are ignored — records already stored under D8 are returned untouched; overrides apply only to freshly-generated records. To override **every** record in a primary-registered schema (including pre-existing ones, by triggering fresh generation), see [`world.populate(schema, count, factory)`](#populateschema-count-factory).

**`transform`** — receives the merged value; must return a value of the same type. Applied after `overrides`.

**`store`** — when `false`, the registry write that normally happens for a `withSchema`-registered schema is suppressed. The full pipeline (matchers, relations, key-based, schema-based, overrides, transform) still runs and the returned value is identical to a `store: true` call — only the side effect on `world.registry` is skipped. Propagates through nested generation: inner registered schemas reached via arrays, nested objects, or relation auto-provisioning are also not stored. Scoped to one outer `generate` call — a subsequent default `generate` writes normally. **Ignored** by `world.get` (its create path must always store — see [`.get`](#getschema-predicate)) and by `world.populate` (its purpose is to populate the registry — see [`.populate`](#populateschema-count-factory)).

**`unique`** — default `true`. For a schema registered with `from:`, a default `world.generate(DerivedSchema, { source: x })` call is an upsert keyed by `(schema, identity(x))` so repeated calls with the same source return the same record by reference. Pass `unique: false` to bypass the upsert for that call (both lookup **and** write) — useful for the rare "many derivations from one source" case. Has no effect on schemas without `from:`. **Interaction with `store: false`**: when `store: false` is set, the upsert lookup and write are also suppressed (every `store: false` derived call is fresh, and the upsert map stays consistent with the registry); a later default-mode call then generates and stores fresh, regardless of any prior `store: false` activity.

```ts
// Search-bucket envelope: 10 inner items per request, registry stays clean.
const SearchBucketSchema = z.object({
  total: z.number().int(),
  content: z.array(ItemSchema).length(10),
});

const world = createWorld({ seed: 1 }).withSchema(ItemSchema).withSchema(SearchBucketSchema);

http.get("/search", () => HttpResponse.json(world.generate(SearchBucketSchema, { store: false })));
// world.registry.count(ItemSchema) === 0  — even after many hits
```

### `.populate(schema, count, factory?)`

```ts
populate<TSchema extends ZodTypeAny>(
  schema: TSchema,
  count: number,
  factory?: (index: number) => GenerateOptions<TSchema>,
): this
```

Pre-generates `count` instances of the schema and stores them in the registry. Returns `this` for fluent chaining. (For per-record overrides across **all** records — including any pre-existing ones, by triggering fresh generation — use `populate` with a factory. `world.generate(RegisteredSchema.array(), { overrides: [...] })` applies per-index overrides only to freshly-generated records, leaving pre-existing registry records untouched; see the `overrides` note under [`GenerateOptions`](#generateschema-options).)

The simple two-arg form is unchanged:

```ts
const world = createWorld({ seed: 42 }).withSchema(PersonSchema).populate(PersonSchema, 3); // 3 persons in registry before any generate()
```

An optional **per-record factory** may be supplied as the third argument. When given, it is invoked exactly `count` times with the 0-based record index (`i = 0..count - 1`, in ascending order) and must return `GenerateOptions` (`overrides`, `transform`, etc.) for that record. The factory's return value flows through the same generate pipeline (matchers → key-based → schema-based → `overrides` → `transform`) — so `overrides` win over generated values and `transform` runs after overrides, per record.

```ts
const UserSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  role: z.enum(["admin", "editor", "viewer"]),
});

const USER_PROFILES = [
  { username: "admin", role: "admin" },
  { username: "editor", role: "editor" },
  { username: "viewer", role: "viewer" },
] as const;

const world = createWorld({ seed: 42 }).withSchema(UserSchema);

// Declarative per-record overrides — no for-loop over generate().
world.populate(UserSchema, USER_PROFILES.length, (i) => ({
  overrides: USER_PROFILES[i],
}));
```

The factory MUST be synchronous (matching `generate`'s contract) and SHOULD be pure: for a given world `seed`, the same sequence of `populate(schema, count, factory)` calls where `factory` returns the same `GenerateOptions` for the same `i` produces byte-identical registry contents across runs. A factory that reads/writes external state can break that guarantee by design.

A factory return that includes `store: false` is **silently ignored** — `populate`'s purpose is to populate the registry, so every record produced lands in it regardless. Other factory fields (`overrides`, `transform`, …) still flow through as documented above.

### `.populateFrom(derivedSchema, sourceSchema, predicate?, factory?)`

```ts
populateFrom<TDerived extends ZodTypeAny, TSource extends ZodTypeAny>(
  derivedSchema: TDerived,
  sourceSchema: TSource,
  predicate?: (item: z.infer<TSource>) => boolean,
  factory?: (source: z.infer<TSource>) => GenerateOptions<z.infer<TDerived>>,
): this
```

Iterates the source bucket and calls `world.generate(derivedSchema, { source: record })` once per source record (filtered by `predicate` if supplied). Returns `this` for fluent chaining — the natural counterpart to [`.populate`](#populateschema-count-factory) for **derived** schemas (those registered with `from:`).

```ts
const OrderSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "shipped", "cancelled"]),
  amount: z.number(),
});

const ShippedOrderSummarySchema = z.object({
  orderId: z.uuid(),
  shippedAmount: z.number(),
  label: z.string(),
});

const world = createWorld({ seed: 1 })
  .withSchema(OrderSchema)
  .withSchema(ShippedOrderSummarySchema, {
    from: OrderSchema,
    matchers: {
      orderId: (ctx) => ctx.source.id,
      shippedAmount: (ctx) => ctx.source.amount,
    },
  });

world.populate(OrderSchema, 30);

// One declarative line — populates a Summary per shipped order:
world.populateFrom(ShippedOrderSummarySchema, OrderSchema, (o) => o.status === "shipped");
```

**`predicate`** — typed `(item: z.infer<TSource>) => boolean` (the **output** shape, matching registry reads and `relations.where`). Inside the body, source-record fields are typed exactly as Zod's inferred output — `z.coerce.date()` fields are `Date`, enum fields are the enum literal type, no cast required.

**`factory`** — invoked once per surviving source record (after `predicate`), receiving the **source record itself** (`z.infer<TSource>`), and returns `GenerateOptions<TDerived>` (`overrides`, `transform`, `unique`, …). The return flows through the delegated `generate` call — `overrides` win over matchers and key/schema generators on conflicting keys, `transform` runs last. Distinct from [`.populate`](#populateschema-count-factory)'s factory, whose first argument is a numeric `index` — `populateFrom` is source-driven by design.

```ts
world.populateFrom(
  ShippedOrderSummarySchema,
  OrderSchema,
  (o) => o.status === "shipped",
  (source) => ({ overrides: { label: `summary-${source.id.slice(0, 6)}` } }),
);
```

**Idempotence (B8 upsert).** Because `populateFrom` delegates to `world.generate(derivedSchema, { source })` per record, and that call is a per-`(derivedSchema, identity(source))` **upsert** by default, calling `populateFrom(...)` twice with the same arguments leaves the derived bucket **unchanged** after the first call — same record count, same references, same order. Re-running is safe (e.g. test setup or a dev server's re-init).

**Snapshot semantics.** The source bucket is read **once** at the start of the call. Records added to it _during_ the iteration — by a matcher's side effect or a transitive auto-provisioned source — are **not** picked up by the current call; they become visible to the **next** `populateFrom` call (the B8 upsert short-circuits the already-derived records on that next call, so only the newly-added sources produce new derived records).

**Always writes.** Like `populate`, `populateFrom` has no `store: false` opt-out: a factory's `store: false` is silently stripped before the options reach the delegated `generate` call. Every derived record produced lands in the registry. (Use `world.generate(DerivedSchema, { source, store: false })` directly if you really want an ephemeral derived record.)

### `.get(schema, predicate?)`

```ts
get<TSchema extends ZodTypeAny>(
  schema: TSchema,
  predicate?: Partial<input<TSchema>>,
): z.infer<TSchema>
```

Find-or-create: returns the stored record in its **output shape** (`z.infer<T>`) —
matching what `world.generate` returns and what registry reads return — while the
`predicate` parameter accepts the permissive **input shape** (`Partial<input<TSchema>>`),
mirroring the `overrides` it is passed through on the create path. (Reads return the
output shape; writes / matchers / overrides accept the input shape — the asymmetry
mirrors `z.coerce`.)

Returns the first stored record (registry **insertion order**) for which **every** key in `predicate` matches, comparing shallow keys by value and nested-object values by **deep equality**. On a miss, it generates a new record via `generate` with `predicate` supplied as `overrides` (so the **predicate wins** over matchers and key/schema generators on conflicting keys), stores it in the registry for `schema`, and returns it. The found record is returned **by reference** (the same instance held in the registry).

`get` is **deterministic** for a given seed and the per-schema call sequence and **idempotent** for a repeated predicate: the first call generates-and-stores, and the second resolves via the find path and returns the same instance.

The create path **always stores** — `get` ignores any ambient `store: false` from an enclosing call. This is required for idempotence: if the first call's record were not written to the registry, the second call could not discover it.

The `predicate` is optional. An **absent** (`get(schema)`) or **empty** (`get(schema, {})`) predicate behaves identically and matches everything: it returns the first stored record if any exist, otherwise generates-and-stores one.

For a function-style, no-create lookup use [`registry.find(schema, fn)`](#findtschema-predicate) instead.

```ts
// MSW handler: the same mocked product every time /products/:sku is hit
http.get("/products/:sku", ({ params }) =>
  HttpResponse.json(world.get(productSchema, { sku: params.sku as string })),
);

const a = world.get(productSchema, { sku: "WIDGET-42" });
const b = world.get(productSchema, { sku: "WIDGET-42" });
// a === b — same instance from the registry
```

### `world.explain(schema)`

```ts
explain<TSchema extends ZodTypeAny>(schema: TSchema): ExplainResult<TSchema>
```

Debug helper: for each top-level field of `schema`, report which step of the resolution pipeline (matcher → `withKeyMap` → `withGenerators` → exact-key → key-pattern → schema-based) would resolve the field, plus a short reason. Returns a structured `ExplainResult` with a `toString()` formatter for human-readable, paste-able output.

```ts
interface FieldExplanation {
  readonly generator: string;
  readonly reason: string;
}

interface RelationExplanation {
  readonly schema: string;
  readonly where: "present" | "none";
}

interface ExplainResult<TSchema extends ZodTypeAny> {
  readonly fields: { readonly [K in keyof z.infer<TSchema> & string]: FieldExplanation };
  readonly relations: { readonly [relName: string]: RelationExplanation };
  toString(): string;
}
```

Example:

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

const r = world.explain(UserSchema);

r.fields.email;
// { generator: 'internet.email', reason: 'exact key: "email"' }

console.log(r.toString());
// id          → string.uuid      (key-pattern: ends with "id")
// firstName   → person.firstName (exact key: "firstname")
// email       → internet.email   (exact key: "email")
// createdAt   → date.anytime     (key-pattern: ends with "at")
// homeAddress → schema-based     (no key match, no matcher)
// kind        → matcher:kind     (matcher registered via withSchema)
```

The `homeAddress` line is the **near-miss diagnostic**: the field name did not match any auto-key, so a random schema-based string will be produced. Rename it to `address`, or register a matcher, to attach a realistic generator.

**Shallow.** `explain` only walks the top-level object shape. A nested-object field is summarised as one entry (`schema-based:object`); call `world.explain(NestedSchema)` to introspect it. Arrays of objects are summarised as `schema-based:array`.

**PRNG- and registry-neutral (read-only).** `explain` does not call any generator, does not consume PRNG state, does not advance any counter, and does not write to the registry — calling `explain` immediately before `generate` produces the same value as `generate` alone. It also does not auto-provision a related record, so a schema with `relations` declared can be inspected on an otherwise-empty world.

For the full table of exact-key entries, pattern rules, and the Dutch-localised aliases (`voornaam`, `bedrag`, `kenteken`, …), see [`docs/key-heuristics.md`](key-heuristics.md).

### `.registry`

```ts
readonly registry: Registry
```

Read-only access to the world's registry. See [`Registry`](#registry) below.

---

## `Registry`

```ts
interface Registry {
  store<T extends ZodTypeAny>(schema: T, item: input<T>): void;
  all<T extends ZodTypeAny>(schema: T): z.infer<T>[];
  pick<T extends ZodTypeAny>(schema: T): z.infer<T>;
  filter<T extends ZodTypeAny>(schema: T, predicate: (item: z.infer<T>) => boolean): z.infer<T>[];
  find<T extends ZodTypeAny>(
    schema: T,
    predicate: (item: z.infer<T>) => boolean,
  ): z.infer<T> | undefined;
  count(schema: ZodTypeAny): number;
}
```

Keys are Zod schema object references — the same object passed to `withSchema`. This gives typed lookup results without string casts.

**Input vs. output asymmetry.** Reads (`all` / `pick` / `filter` / `find`) return the
**output shape** (`z.infer<T>`) — the post-coerce, post-transform value Zod produces.
Writes (`store`) and the matcher / `overrides` surface (see `SchemaOpts.matchers` and
`GenerateOptions.overrides`) accept the **input shape** (`input<T>`) — the pre-coerce,
permissive side. This mirrors `z.coerce`: input permissive, output fixed. In practice it
means consumers naturally holding a `z.infer<T>` value need **no cast** at the registry
boundary, while matchers on `z.coerce` / `.transform()` fields keep the flexibility to
return any value Zod would accept as input.

### `.all(schema)`

Returns all stored items for `schema` in their **output shape** (`z.infer<T>[]`). Returns
an empty array if none.

```ts
const persons = world.registry.all(PersonSchema);
```

### `.pick(schema)`

Returns a random stored item in its **output shape** (`z.infer<T>`). **Throws** if none
exist.

```ts
// Inside a matcher
lines: (ctx) => {
  const product = ctx.registry.pick(ProductSchema);
  return [{ productId: product.productId, ... }];
},
```

### `.filter(schema, predicate)`

Returns all stored items for `schema` satisfying `predicate`, in their **output shape**
(`z.infer<T>[]`). The predicate receives items typed as `z.infer<T>`. Returns an empty
array if none match — never throws.

```ts
fileIds: (ctx) => ctx.registry
  .filter(FileSchema, (f) => f.ownerId === ctx.source.personId)
  .map((f) => f.fileId),
```

### `.find(schema, predicate)`

Returns the **first** stored item for `schema` satisfying `predicate`, in registry
insertion order (the order `store` was called), matching `Array.prototype.find`. The
stored record is returned in its **output shape** (`z.infer<T>`), and the predicate
receives items typed as `z.infer<T>`. Returns `undefined` if none match or none are
stored — never throws. A pure, non-mutating lookup that consumes no PRNG state.

```ts
createdBy: (ctx) => {
  const admin = ctx.registry.find(UserSchema, (u) => u.username === "admin");
  return admin?.username ?? "system";
},
```

### `.store(schema, item)`

Stores `item` in `schema`'s bucket. `item` is typed as the **input shape** (`input<T>`)
— the permissive pre-coerce side — so a matcher on a `z.coerce.date()` field that
returns a raw `string` lands in the registry without a cast. No runtime parse is
performed on store; the value is pushed as-is.

### `.count(schema)`

Returns the number of stored items. Returns `0` if none.

---

## `GeneratorContext`

```ts
interface GeneratorContext<T = any> {
  readonly prng: Prng;
  readonly gen: BoundGenerators;
  readonly source: unknown;
  readonly current: Partial<T>;
  readonly registry: Registry;
  readonly fieldPath: string;
  readonly optionalProbability?: number;
  readonly related: {
    <T = unknown>(relationName: string): T;
    many<T = unknown>(relationName: string, count: number): T[];
  };
}
```

Passed to every matcher function and custom generator. Each field receives its own forked PRNG — per-field stability means adding a field to a schema never disturbs other fields' values.

**`prng`** — PRNG forked for the current field. Use directly for ad-hoc randomness: `ctx.prng.int(1, 100)`.

**`gen`** — generators namespace with the field's PRNG pre-applied. Prefer this over calling `generators.*(ctx.prng)` manually:

```ts
matchers: {
  title: (ctx) => ctx.gen.word.sentence(),
  email: (ctx) => ctx.gen.internet.email(),
  code:  (ctx) => ctx.gen.string.alphanumeric(12),
}
```

Arguments still pass through: `ctx.gen.string.alphanumeric(12)` calls `alphanumeric(prng, 12)` internally.

Locale-aware helpers (every helper that accepts an optional `ctx?: GeneratorContext` — e.g. `word.noun`, `word.words`, `word.paragraph`, `location.city`, `commerce.productName`, `commerce.price`, `finance.iban`, `phone.number`, `company.name`, `date.month`, …) automatically receive the world's configured locale through `ctx.gen.<ns>.<fn>()`. You do not need to thread `ctx` through manually — `ctx.gen.word.noun()` honours `createWorld({ locale: nl })` out of the box. Helpers that take no `ctx` (`internet.ip`, `string.uuid`, `finance.bitcoinAddress`, …) are unaffected.

Caveat for `person.firstName` / `middleName` / `fullName` / `prefix`: these helpers take an optional first argument that is either a `Gender` string OR a `GeneratorContext`. Auto-forwarding only kicks in when the matcher passes no argument. If you need both a fixed gender and the configured locale, use the explicit-`ctx` form by reading the sibling gender field yourself, or call `ctx.gen.person.firstName(ctx)` (no gender) and let the helper read it via `ctx.current`.

**`source`** — for derived schemas (registered with `from:`), holds the source record that is driving this output. `undefined` for primary schemas. Typed as `input<TSource>` in `DerivedSchemaOpts` matchers.

```ts
matchers: {
  id:       (ctx) => ctx.source.personId,
  fullName: (ctx) => `${ctx.source.firstName} ${ctx.source.lastName}`,
}
```

**`registry`** — the world's full registry. Use `ctx.registry.pick(Schema)` or `ctx.registry.filter(Schema, pred)` for cross-schema lookups.

**`fieldPath`** — dot-separated path of the current field, prefixed by a stable record identifier (e.g. `"reg0#2.address.street"`). Use as a stable key for per-record state:

```ts
// Inside a lines matcher, accumulate total for the totalCents matcher:
lineTotals.set(ctx.fieldPath.replace(".lines", ""), total);

// Inside the totalCents matcher, read it back:
lineTotals.get(ctx.fieldPath.replace(".totalCents", ""));
```

**`related(name)`** — resolves the related schema instance declared in `relations`. Auto-provisions one if the registry is empty, then picks deterministically. All fields in the same record that call `ctx.related("owner")` receive the same owner — the pick is record-scoped, not field-scoped.

```ts
matchers: {
  authorId: (ctx) => ctx.related("author").authorId,
  language: (ctx) => ctx.related("author").language,  // same author as authorId
}
```

**Self-referential relations** — a relation may point at the same schema being generated (e.g. a category tree where each category's parent is another category). These are **not** auto-provisioned: doing so would re-enter the matcher and recurse forever. Instead the first record has no related instance and `ctx.related(name)` returns `undefined`; later records reference the earlier ones already generated. Guard the empty case in the matcher:

```ts
const categorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(40),
  slug: z.string(),
  parentId: z.uuid().nullable(), // → categorySchema.id (self)
});

world.withSchema(categorySchema, {
  relations: { parent: categorySchema },
  matchers: {
    parentId: (ctx) => ctx.related("parent")?.id ?? null, // first record → null
  },
});
```

**`related.many(name, count)`** — resolves a **one-to-many** relation: returns `count` **distinct** records (no duplicates) drawn from the named relation's bucket. Like `related(name)`, it is **record-scoped** (repeated calls within one record — across sibling matchers — return the same records in the same order, even if the registry grows mid-record) and **deterministic** for a given seed. If the bucket holds fewer than `count` records, `.many` **auto-provisions** the shortfall via the same primary-generation path `related` uses, until at least `count` exist. Self-referential relations are **not** auto-provisioned (same guard as single `related`); when `count` exceeds what is available, `.many` **clamps** to all available distinct records rather than throwing.

```ts
world.withSchema(caseSchema, {
  relations: { users: userSchema },
  matchers: {
    // Pick 2–4 distinct users; sibling matchers see the same set in the same order.
    users: (ctx) => ctx.related.many("users", ctx.prng.int(2, 4)),
    usernames: (ctx) => ctx.related.many("users", ctx.prng.int(2, 4)).map((u) => u.username),
  },
});
```

**`current`** — holds the partial sibling-field values accumulated so far for the current object. This is useful for cross-field consistency (e.g., matching a first name's gender to a sibling `gender` field).

**`locale`** — the active locale. Generators that are locale-aware read names, words, and format strings from this object. Use `ctx.locale` in custom matchers if you need locale-specific data.

```ts
matchers: {
  gender:    (ctx) => ctx.prng.pick(["male", "female"]),
  firstName: (ctx) => {
    // Access previously generated sibling values
    const gender = ctx.current.gender;
    return ctx.gen.person.firstName({ gender });
  }
}
```

---

## `Prng`

```ts
interface Prng {
  readonly seed: number;
  random(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly [T, ...T[]]): T;
  pick<T>(items: readonly T[]): T | undefined;
  shuffle<T>(items: readonly T[]): T[];
  sample<T>(items: readonly T[], count: number): T[];
  fork(key: string): Prng;
  bytes(n: number): Uint8Array;
}
```

### `.seed`

The raw 32-bit unsigned integer seed this PRNG was initialised with. Useful for debugging seed chains and for building optimized batch derivation on top of `fork`.

### `.random()`

Returns a float in [0, 1).

### `.int(min, max)`

Returns an integer in [min, max] inclusive.

### `.pick(items)`

Two overloads, chosen by the input type:

- **Non-empty tuple** — `pick<T>(items: readonly [T, ...T[]]): T`. When the input is a literal tuple known to be non-empty (e.g. `["a", "b", "c"] as const`), the return is the tuple-element union with **no `undefined`**.

  ```ts
  const v = ctx.prng.pick(["a", "b", "c"] as const); // v: "a" | "b" | "c"
  ```

- **Plain array** — `pick<T>(items: readonly T[]): T | undefined`. When the input is a plain `T[]` or `readonly T[]` (e.g. `Object.keys(...)`, a domain-config `string[]`), the return is `T | undefined`. An empty array returns `undefined` at runtime (the function never throws).

  ```ts
  const kinds: string[] = Object.keys(KIND_MAP);
  const k = ctx.prng.pick(kinds); // k: string | undefined
  ```

### `.shuffle(items)`

Returns a new array containing the same elements in a deterministic random order (Fisher-Yates). Does not mutate the input. An empty array returns an empty array.

### `.sample(items, count)`

Returns `count` distinct elements drawn at random from `items`, as a new array. Equivalent to `shuffle(items).slice(0, count)`. If `count` exceeds `items.length` it is clamped (you get all items, shuffled); negative counts yield an empty array.

```ts
matchers: {
  assignees: (ctx) => ctx.prng.sample(ctx.registry.all(userSchema), ctx.prng.int(2, 4)),
}
```

### `.fork(key)`

Derives a new, fully independent PRNG from a deterministic string key. The parent PRNG's state is **not consumed** — calling `fork` twice with the same key returns equivalent PRNGs.

```ts
const childPrng = ctx.prng.fork("my-subfield");
```

### `.bytes(n)`

Returns a `Uint8Array` of `n` random bytes. Internally extracts 4 bytes per SFC32 iteration, so one call is far cheaper than `n` individual `int()` calls. Useful for bulk generation:

```ts
// Uniform mapping into a 64-char alphabet (zero bias when alphabet size is power-of-2)
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const token = Array.from(ctx.prng.bytes(32), (v) => B64[v & 0x3f]!).join("");
```

---

## `generators` namespace

Built-in generators, organised into domain sub-namespaces. All functions take a `Prng` as their first argument.

```ts
import { generators } from "zod4-mock";
```

### `generators.person`

| Function    | Signature          | Output example        |
| ----------- | ------------------ | --------------------- |
| `firstName` | `(prng) => string` | `'Jan'`               |
| `lastName`  | `(prng) => string` | `'de Vries'`          |
| `fullName`  | `(prng) => string` | `'Jan de Vries'`      |
| `jobTitle`  | `(prng) => string` | `'Software Engineer'` |
| `jobArea`   | `(prng) => string` | `'Engineering'`       |

### `generators.internet`

| Function   | Signature          | Output example                |
| ---------- | ------------------ | ----------------------------- |
| `email`    | `(prng) => string` | `'jan.devries42@example.com'` |
| `url`      | `(prng) => string` | `'https://example.com/lorem'` |
| `username` | `(prng) => string` | `'jan42'`                     |
| `domain`   | `(prng) => string` | `'example.com'`               |
| `ip`       | `(prng) => string` | `'192.168.1.42'`              |

### `generators.location`

| Function        | Signature          | Output example       |
| --------------- | ------------------ | -------------------- |
| `city`          | `(prng) => string` | `'Amsterdam'`        |
| `country`       | `(prng) => string` | `'Netherlands'`      |
| `streetAddress` | `(prng) => string` | `'Keizersgracht 42'` |
| `postalCode`    | `(prng) => string` | `'1234 AB'`          |
| `latitude`      | `(prng) => number` | `52.370216`          |
| `longitude`     | `(prng) => number` | `4.895168`           |

### `generators.lorem` / `generators.word`

| Function    | Signature                         | Output example                  |
| ----------- | --------------------------------- | ------------------------------- |
| `word`      | `(prng) => string`                | `'lorem'`                       |
| `sentence`  | `(prng) => string`                | `'Lorem ipsum dolor sit amet.'` |
| `paragraph` | `(prng) => string`                | multiple sentences              |
| `words`     | `(prng, count: number) => string` | space-separated words           |

### `generators.string`

| Function       | Signature                           | Output example                    |
| -------------- | ----------------------------------- | --------------------------------- |
| `uuid`         | `(prng) => string`                  | `'a1b2c3d4-...'`                  |
| `alphanumeric` | `(prng, length?: number) => string` | `'aB3kP9mZ'` (default length 8)   |
| `hexadecimal`  | `(prng, length?: number) => string` | `'0x3f9a1c2b'` (default length 8) |
| `nanoid`       | `(prng) => string`                  | 21-char URL-safe string           |

**Prefer `ctx.gen` inside matchers** — it pre-applies the PRNG:

```ts
matchers: {
  sku:   (ctx) => ctx.gen.string.alphanumeric(6).toUpperCase(),
  email: (ctx) => ctx.gen.internet.email(),
  title: (ctx) => ctx.gen.word.sentence(),
}
```

---

## `DEFAULT_KEY_MAP`

```ts
const DEFAULT_KEY_MAP: Record<string, Record<string, PrngGen> | undefined>;
```

Exact-match key→generator map. When a field name matches a key exactly (case-insensitive), the mapped generator is used. Inspect or extend:

```ts
import { DEFAULT_KEY_MAP, DEFAULT_KEY_PATTERNS } from "zod4-mock";
console.log(Object.keys(DEFAULT_KEY_MAP));
```

## `DEFAULT_KEY_PATTERNS`

```ts
const DEFAULT_KEY_PATTERNS: KeyPattern[];

interface KeyPattern {
  test: (key: string) => boolean;
  generate: PrngGen;
}
```

Suffix/prefix pattern rules checked after `DEFAULT_KEY_MAP`. A pattern fires when `test(fieldName)` returns `true`.

---

## `KeyGenerator`

```ts
type KeyGenerator<T = unknown> = (schema: ZodTypeAny, ctx: GeneratorContext) => T;
```

A function that generates a value for a field. Used in `WorldOptions.generators` and `withGenerators`. Receives the field's Zod schema and a full `GeneratorContext`.

---

## `SchemaKeyMap`

```ts
type SchemaKeyMap<TSchema extends ZodTypeAny> = {
  [K in keyof input<TSchema>]?: (ctx: GeneratorContext) => input<TSchema>[K];
};
```

Per-schema, per-field generator map. Used with `withKeyMap`. Field names and return types are inferred from the schema.

---

## `GenerateOptions`

```ts
interface GenerateOptions<T> {
  readonly overrides?: DeepPartial<T>;
  readonly transform?: (data: T) => T;
  readonly seed?: number;
  readonly store?: boolean; // default true
  readonly unique?: boolean; // default true
}
```

`seed` is only used by the module-level `generate()` function; it is ignored by `world.generate()` (use `createWorld({ seed })` instead).

`store` (default `true`) suppresses the registry write for `world.generate` when set to `false`. The full pipeline still runs; only the side effect on `world.registry` is skipped, and the flag propagates through nested generation so inner registered schemas are also not stored. Ignored by `world.get` (its create path always stores) and by `world.populate` (its purpose is to populate the registry). See [`.generate`](#generateschema-options) for an example.

`unique` (default `true`) opts out of the derived-schema per-pair upsert when set to `false` — `world.generate(DerivedSchema, { source: x, unique: false })` generates a fresh record even if a derived record already exists for that source, and does not write to the upsert map. Has no effect on schemas without `from:`. A `store: false` derived call is always fresh (the upsert lookup and write are both suppressed under `effectiveStore === false`), so `unique` and `store` compose naturally. See [`.withSchema`](#withschemaschema-opts) and [`.generate`](#generateschema-options).

---

## Localization

Locale data and types live in separate workspace packages, not in `zod4-mock`
itself. This keeps the core library small and lets consumers install only the
locales they need.

| Package                  | Contents                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| `@zod4-mock/locale-core` | `LocaleData`, `LastNamePrefix`, `Currency`, etc. types + `extend()` |
| `@zod4-mock/locale-en`   | Full English locale (`en`) with curated real-wordlist corpora       |
| `@zod4-mock/locale-nl`   | Full Dutch locale (`nl`) with curated real-wordlist corpora         |

The `zod4-mock` package re-exports `extend` and the locale types for
convenience, but **not** `en` or `nl` — import those from their packages.

### Default locale

When `createWorld()` is called without a `locale`, a built-in **minimal English
locale** is used. It has short curated word and name lists. The full locale
packages (`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`) ship larger
corpora under the same canonical `readonly string[]` shape — install one and
pass it as `locale:` for the full set.

### `en` / `nl`

Pre-built locales, imported from their own packages:

```ts
import { createWorld } from "zod4-mock";
import { en } from "@zod4-mock/locale-en";
import { nl } from "@zod4-mock/locale-nl";

const world = createWorld({ seed: 1, locale: nl });
```

### `extend(base, overrides)`

Creates a locale by shallow-merging individual sections. Re-exported from
`zod4-mock`, or import directly from `@zod4-mock/locale-core`:

```ts
import { extend } from "zod4-mock";
import { en } from "@zod4-mock/locale-en";

const myLocale = extend(en, {
  address: {
    ...en.address,
    cities: ["London", "Manchester", "Edinburgh"],
    countryCode: "GB",
    phonePrefix: "+44",
  },
});
```

Each section is replaced as a whole — deep merging within a section is not performed.

### `LocaleData`

The interface every locale must satisfy (defined in `@zod4-mock/locale-core`). Key sections:

```ts
interface LastNamePrefix {
  prefix: string; // e.g. "de", "van der"
  weight: number; // relative weight vs. implicit "no prefix" weight of 100
}

interface Currency {
  code: string; // "USD"
  name: string; // "US Dollar"
  symbol: string; // "$"
  numeric: string; // "840"
}

interface LocaleData {
  id: string;
  person: {
    // Real wordlists sampled by `prng.pick`. Optional — locales may ship
    // none, some, or all three. When absent, `firstName` / `lastName` fall
    // back to a structured "Unknown" sentinel.
    firstNamesMale?: readonly string[];
    firstNamesFemale?: readonly string[];
    lastNames?: readonly string[];
    lastNamePrefixes?: readonly LastNamePrefix[]; // e.g. Dutch tussenvoegsels
    prefixes: { male: readonly string[]; female: readonly string[]; neutral: readonly string[] };
    suffixes: readonly string[];
    genders: readonly string[];
    jobTitles: readonly string[];
    jobAreas: readonly string[];
    jobTypes: readonly string[];
    jobDescriptors: readonly string[];
    formatFullName: (first: string, last: string) => string;
    formatBio: (prng, parts: { jobTitle; jobArea; jobType }) => string;
  };
  word: {
    // Real wordlists sampled by `prng.pick`. Optional.
    nouns?: readonly string[];
    adjectives?: readonly string[];
    articles: readonly string[]; /* ... other closed-class word lists */
    // Optional per-locale sentence formatter. When present, `sentence()`
    // delegates wholesale to this callback — the locale owns template
    // selection, lemma picking, and any grammar-specific composition
    // (inflection, pronoun agreement). When absent, `sentence()` falls
    // back to the library's 5-template default against `verbs` /
    // `verbsPlural`. See `formatSentence` below.
    formatSentence?(prng, ctx?): string;
  };
  address: {
    cities;
    states;
    countries;
    countryCodes;
    continents;
    languages;
    streetNames;
    streetSuffixes;
    cityPrefixes;
    cityCores;
    buildingNumberSuffixes;
    timeZones;
    directions;
    cardinalDirections;
    ordinalDirections;
    streetFormats;
    zipFormat;
    secondaryAddressFormat;
    phonePrefix;
    ibanPrefix;
    countryCode;
  };
  commerce: {
    departments;
    materials;
    productAdjectives;
    currencyCode;
    formatPrice;
    formatProductName;
    formatProductDescription;
  };
  company: {
    prefixes;
    suffixes;
    buzzAdjectives;
    buzzNouns;
    buzzVerbLemmas;
    catchPhraseAdjectives;
    catchPhraseDescriptors;
    catchPhraseNouns;
    formatBuzzPhrase;
  };
  finance: {
    bankCodes;
    bicLocations;
    currencies: readonly Currency[];
    accountNames;
    transactionTypes;
    transactionDescriptions;
    formatIban;
  };
  date: { months; monthsShort; weekdays; weekdaysShort; timeZones };
  color: { names: readonly string[] };
  phone: { mobilePrefix; landlinePrefixes; formatMobile; formatLandline };
}
```

**Single canonical shape.** Names and open-class words are real wordlists
sampled by `prng.pick`. The full locale packages
(`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`) ship curated corpora; the
built-in default locale ships short stubs of the same shape. There is no
Markov-model alternative — the Markov code path was removed in B48 in favour
of constant-PRNG-cost sampling from real lists.

`lastNamePrefixes` is optional. When present, `lastName()` prepends a prefix with probability `prefixWeightTotal / (prefixWeightTotal + 100)`, capitalised for standalone use. The prefix decision uses an independent `prng.fork("lastNamePrefix")` so the caller-visible per-call PRNG cost stays at exactly one draw. `formatFullName` in locales that have tussenvoegsels should lowercase the first character of the last name (Dutch convention: "Jan de Jong" not "Jan De Jong").

### `formatSentence` (`word.formatSentence`)

`LocaleData.word.formatSentence` is an optional per-locale sentence-formatter callback, mirroring the shape of `person.formatBio`, `commerce.formatProductName`, and `company.formatBuzzPhrase`. Signature:

```ts
formatSentence?(prng: Prng, ctx?: LocaleSentenceContext): string;
```

When the active locale defines `formatSentence`, the library's `sentence()` generator delegates to it wholesale — the locale owns template selection, lemma picking, and any grammar-specific composition (verb conjugation, plural-noun agreement, pronoun constraints). When the locale omits the field, `sentence()` falls back to the library's default 5-template English shape against `loc.verbs` / `loc.verbsPlural` / `loc.pronouns` / `loc.articles` / `loc.nouns` / `loc.adjectives`.

This shape lets each locale express its own grammar without forcing a universal inflection interface. `@zod4-mock/locale-en` ships `formatSentence` with 3ps-conjugated verbs, plural-noun agreement on the last noun slot, and a 3ps-singular pronoun constraint on the relevant template — the inflection helpers themselves are package-internal (see locale-en's exported `inflect` namespace for matcher-author access).

`verbsPlural` is marked `@deprecated` and will be removed in a future major; migrate locale-side sentence composition to `formatSentence`.
