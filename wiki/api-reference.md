# API Reference

Complete reference for every exported symbol. Use this as a lookup guide, not a reading-order document.

---

## Exports overview

| Export                 | Kind      | Description                               |
| ---------------------- | --------- | ----------------------------------------- |
| `createWorld`          | function  | Create a seeded generation world          |
| `defineSubjectType`    | function  | Define a named domain entity              |
| `generators`           | namespace | Built-in primitive generators             |
| `generateFromSchema`   | function  | Low-level schema-based generator          |
| `generateFromKey`      | function  | Low-level key-based generator             |
| `createPrng`           | function  | Create a standalone seeded PRNG           |
| `fieldSeed`            | function  | Derive a per-field seed                   |
| `World`                | type      | The world interface                       |
| `WorldOptions`         | type      | Options for `createWorld`                 |
| `SubjectType`          | type      | A subject type descriptor                 |
| `SubjectInstance`      | type      | A generated subject instance              |
| `SubjectData`          | type      | Inferred data type of a subject           |
| `GeneratorContext`     | type      | Context passed to matchers and generators |
| `Prng`                 | type      | The PRNG interface                        |
| `Registry`             | type      | The registry interface                    |
| `DEFAULT_KEY_MAP`      | object    | Declarative exact-match key→generator map |
| `DEFAULT_KEY_PATTERNS` | object    | Suffix/prefix pattern rules               |
| `KeyGenerator`         | type      | Custom field-name generator function      |
| `PrngGen`              | type      | `(prng: Prng) => T` — map value type      |
| `KeyPattern`           | type      | A pattern rule `{ test, generate }`       |
| `SchemaKeyMap`         | type      | Per-schema key generator map (typed)      |
| `SubjectKeyMap`        | type      | Per-subject-type key override map (typed) |
| `Matchers`             | type      | Map of matcher functions for a schema     |
| `MatcherFn`            | type      | A single matcher function                 |
| `GenerateOptions`      | type      | Options for `world.generate()`            |
| `DeepPartial`          | type      | Recursive optional type                   |
| `Cardinality`          | type      | Relation cardinality string               |
| `RelationDef`          | type      | A declared relation                       |
| `RelationMap`          | type      | Map of relation definitions               |

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

**`seed`** — master seed for all generation in this world. The same seed with the same builder chain always produces byte-identical output.

**`optionalProbability`** — probability in [0, 1] that `z.optional()` or `z.nullable()` fields are omitted/nulled. Set to `0` to always generate optional fields; `1` to always omit them. Default `0.2`.

**`defaultArrayLength`** — fallback `[min, max]` when a `z.array()` schema has no `.min()`, `.max()`, or `.length()` constraint. Default `[1, 5]`.

**`generators`** — custom key-based generators applied to every schema in the world. Keys are matched case-insensitively. See [`KeyGenerator`](#keygenerator) below.

---

## `World` — builder methods

All builder methods return `this` for fluent chaining.

### `.withSubject(subjectType)`

```ts
withSubject(subjectType: AnySubjectType): this
```

Registers a subject type. Must be called before `withSchema` for the same type, and before `generate`.

### `.withSchema(schema, subjectType, matchers?)`

Binds an app schema to one or more subject types and optionally provides matcher functions.

**Strongly typed overload** — pass a `SubjectType` object for full type inference on matchers:

```ts
withSchema<TSchema, TSubjectType extends AnySubjectType>(
  schema: TSchema,
  subjectType: TSubjectType,
  matchers?: Matchers<TSchema, SubjectData<TSubjectType>>,
): this
```

**Weakly typed overload** — pass a string name or array of strings (matchers typed as `unknown`):

```ts
withSchema<TSchema>(
  schema: TSchema,
  subjectTypes: string | string[],
  matchers?: Matchers<TSchema, unknown>,
): this
```

Binding one schema to multiple subject types is the multi-API consistency pattern — see the [media library recipe](recipes.md#recipe-multi-api-media-library).

### `.withGenerators(map)`

```ts
withGenerators(map: Record<string, KeyGenerator>): this
```

Adds custom key-based generators. Calls are **additive** — each call merges without removing prior entries. Keys are matched case-insensitively and take priority over built-in heuristics.

```ts
world.withGenerators({
  vendorCode: (_schema, ctx) => `V-${generators.uuid(ctx.prng)}`,
});
```

### `.withKeyMap(schema, map)`

```ts
withKeyMap<T extends ZodTypeAny>(schema: T, map: SchemaKeyMap<T>): this
```

Binds per-field generator functions to a **specific schema**. Unlike `withGenerators` (global, untyped), `withKeyMap` is schema-scoped and fully type-safe — field names and return types are inferred from the schema. Unlike `withSchema` matchers, no subject binding is required.

**Priority order** (highest → lowest):

1. `withSchema` matchers
2. `withKeyMap` ← here
3. subject-type `keyMap` (declared on `defineSubjectType`)
4. `withGenerators` (global)
5. `DEFAULT_KEY_MAP` / `DEFAULT_KEY_PATTERNS` (built-in heuristics)
6. Schema-based fallback

Calls for the same schema are **merged** — later entries overwrite earlier ones for the same field key, other keys are preserved.

Works for both subject-bound schemas and ad-hoc schemas (those not registered with `withSchema`).

```ts
world.withKeyMap(ProductSchema, {
  sku: (ctx) => `SKU-${ctx.prng.int(1000, 9999)}`,
  price: (ctx) => ctx.prng.int(100, 50000),
});
```

Use the `SchemaKeyMap<T>` type to annotate a map before passing it:

```ts
const productMap: SchemaKeyMap<typeof ProductSchema> = {
  sku: (ctx) => `SKU-${ctx.prng.int(1000, 9999)}`,
};
world.withKeyMap(ProductSchema, productMap);
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

- If `schema` is a `z.array(...)`: returns an array. Length is derived from Zod constraints (`.min()`, `.max()`, `.length()`), falling back to `defaultArrayLength`.
- Otherwise: returns a single object.

When the schema is bound to one or more subject types, the world cycles through existing subjects deterministically. When the schema is not bound (ad-hoc), generation is purely schema-based.

**`GenerateOptions`**

```ts
interface GenerateOptions<T> {
  subject?: string; // pin to a specific subject type when multi-bound
  overrides?: DeepPartial<T>; // deep-merged after generation; arrays replaced
  transform?: (data: T) => T; // applied after overrides
}
```

**`subject`** — when one schema is bound to multiple subject types (e.g., `RawDataSchema` bound to both `TextFileSubject` and `AudioFileSubject`), use this to pin generation to one type.

**`overrides`** — deep-partial merge. Nested objects are merged recursively. Arrays are replaced entirely (not element-merged). Applied before `transform`.

**`transform`** — receives the merged value; must return a value of the same type. Applied after `overrides`. Use for array-index edits or derived fields that depend on the full generated object.

### `.subject(type)`

```ts
subject(type: string): AnySubjectInstance
```

Returns the **next** subject instance of the given type, creating it if needed. Subjects are generated lazily and cached; the sequence is deterministic.

```ts
interface AnySubjectInstance {
  _type: string; // e.g. 'person'
  _id: string; // e.g. 'person#1'
  data: unknown; // typed as SubjectData<T> when using the generic form
}
```

Throws if the type has not been registered via `.withSubject()`.

### `.subjects(type?)`

```ts
subjects(type?: string): AnySubjectInstance[]
```

Returns all subject instances currently in the world, optionally filtered by type name. Returns instances in creation order. Useful for inspecting or asserting on the full set of generated subjects.

```ts
world.subjects(); // all subjects across all types
world.subjects("person"); // only person instances
```

### `.populate(subjectType, count)`

```ts
populate(subjectType: AnySubjectType | string, count: number): this
```

Pre-creates `count` subject instances of the given type. Returns `this` for fluent chaining.

Call this before `generate` when you need a specific number of subjects to exist upfront — for example, to ensure 3 persons are available so that file subjects' `ownerId` fields distribute across all 3 owners rather than defaulting to a single auto-created one.

```ts
// Fluent — pre-create 3 persons before generating any data
const world = createMediaLibraryWorld(42).populate(PersonSubject, 3);
const rawdata = world.generate(z.array(RawDataSchema).min(6));
const entities = world.generate(z.array(EntityApiSchema));
// → entities has 3 items, files spread across all 3 owners
```

Accepts either a `SubjectType` object (type-safe) or a plain string name (same as `.withSubject` / `.subject`).

---

## `World` — registry

### `.registry`

```ts
readonly registry: Registry
```

Read-only access to the world's registry. Available after any `generate()` call. See [`Registry`](#registry) below.

---

## `defineSubjectType(name, schema, options?)`

```ts
function defineSubjectType<TSchema, TRelations>(
  name: string,
  schema: TSchema,
  options?: SubjectTypeOptions<TRelations>,
): SubjectType<TSchema, TRelations>;
```

Creates a subject type descriptor. The `name` string is used everywhere to look up the type (case-sensitive).

```ts
interface SubjectTypeOptions<TRelations extends RelationMap, TData> {
  relations?: TRelations
  keyMap?:    SubjectKeyMap<TData>
  derive?:    { ... }
}
```

**`relations`** — declares relationships to other subject types. Currently metadata only; the world does not enforce them automatically. See [Advanced Topics — Relations](advanced.md#relations-declared-but-not-yet-enforced).

**`keyMap`** — per-field generators for this subject type. Consulted after `withKeyMap` and before `withGenerators` in the generation pipeline. Values are `(prng: Prng) => T` — they accept only a PRNG, so `generators.*` functions can be assigned directly.

```ts
const ProductSubject = defineSubjectType("product", ProductSchema, {
  keyMap: {
    // Override default name → fullName with a product-appropriate word
    name: generators.lorem.sentence,
    // Use a custom generator
    sku: (prng) => `PROD-${prng.int(1000, 9999)}`,
  },
});
```

Use `SubjectKeyMap<typeof ProductSchema>` to annotate the map before passing:

```ts
const productKeyMap: SubjectKeyMap<typeof ProductSchema> = {
  name: generators.lorem.sentence,
};
```

```ts
const PersonSubject = defineSubjectType(
  "person",
  z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
  }),
  {
    relations: {
      employer: { type: "company", cardinality: "0..1" },
    },
    derive: {
      email: ({ firstName, lastName }, prng) => {
        const ln = lastName!.toLowerCase().replace(/[\s']/g, "");
        return `${firstName![0]}.${ln}${prng.int(10, 99)}@example.com`.toLowerCase();
      },
    },
  },
);
```

### `derive`

```ts
derive?: {
  [K in keyof SubjectData<T>]?: (partial: Partial<SubjectData<T>>, prng: Prng) => SubjectData<T>[K]
}
```

Derives field values from already-generated sibling fields of the same subject. Each function receives a `partial` snapshot of the subject's data (everything generated so far in declaration order) and a PRNG forked for that field.

**Execution order:**

1. All fields are generated via the normal pipeline first (world generators → key-based → schema-based).
2. Then each `derive` entry runs in declaration order, overwriting the base-generated value.

This means later entries see earlier entries' derived values — declare dependencies before dependents.

**World-level `generators` take priority:** if the world registers a generator for the same field key, `derive` is skipped for that key.

```ts
derive: {
  // mid is derived from base (a base field)
  mid: ({ base }) => `mid-${base}`,
  // top is derived from mid (a derived field — declared after mid, so it sees mid's value)
  top: ({ mid }) => `top-${mid}`,
}
```

### `Cardinality`

```ts
type Cardinality = "0..1" | "1" | "0..n" | "1..n";
```

| Value    | Meaning                |
| -------- | ---------------------- |
| `'0..1'` | Optional, at most one  |
| `'1'`    | Exactly one (required) |
| `'0..n'` | Optional, any number   |
| `'1..n'` | At least one           |

---

## `Registry`

```ts
interface Registry {
  all<T = unknown>(type: string): T[];
  pick<T = unknown>(type: string): T;
  pickBy<T = unknown>(type: string, predicate: (item: T) => boolean): T;
  filter<T = unknown>(type: string | string[], predicate: (item: T) => boolean): T[];
  count(type: string): number;
}
```

All methods are generic. Pass a type parameter to get a typed result without casting:

```ts
const file = ctx.registry.pick<{ fileId: string; ownerId: string }>("text-file");
```

### `.all<T>(type)`

Returns all stored items of `type` as `T[]`. Returns an empty array if none.

### `.pick<T>(type)`

Returns a random stored item of `type`. **Throws** if no items have been stored for this type yet.

Use inside matchers to pick a random related entity:

```ts
const product = ctx.registry.pick<ProductData>("product");
```

### `.pickBy<T>(type, predicate)`

Returns a random stored item of `type` satisfying `predicate`. **Throws** if no matching items exist.

```ts
const englishDoc = ctx.registry.pickBy<DocumentData>("document", (d) => d.language === "en");
```

### `.filter<T>(type | type[], predicate)`

Returns **all** stored items (across one or more types) satisfying `predicate`.

```ts
// Single type
const paid = ctx.registry.filter<Invoice>("invoice", (i) => i.status === "paid");

// Multiple types — concatenated in registration order
const allFileRefs = ctx.registry.filter<FileRef>(
  ["text-file", "audio-file", "bank-file"],
  (f) => f.ownerId === s.personId,
);
```

Returns an empty array if none match. Does not throw.

### `.count(type)`

Returns the number of stored items of `type`. Returns `0` if none.

---

## `Prng`

```ts
interface Prng {
  random(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly [T, ...T[]]): T;
  fork(key: string): Prng;
}
```

### `.random()`

Returns a float in [0, 1).

### `.int(min, max)`

Returns an integer in [min, max] inclusive.

### `.pick(items)`

Returns one element from a non-empty tuple (requires at least one element at the type level).

### `.fork(key)`

Derives a new, fully independent PRNG from a deterministic string key. The parent PRNG's state is **not consumed** — calling `fork` twice with the same key returns equivalent PRNGs.

```ts
const childPrng = ctx.prng.fork("my-subfield");
// childPrng is independent of ctx.prng
```

Use `fork` inside matchers when you need multiple independent random values for a single field:

```ts
lines: (s, ctx) => {
  const linesPrng = ctx.prng.fork("lines");
  const count = linesPrng.int(1, 4);
  // ...
};
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

### `generators.lorem`

| Function    | Signature          | Output example                  |
| ----------- | ------------------ | ------------------------------- |
| `word`      | `(prng) => string` | `'lorem'`                       |
| `sentence`  | `(prng) => string` | `'Lorem ipsum dolor sit amet.'` |
| `paragraph` | `(prng) => string` | multiple sentences              |

### `generators.string`

| Function       | Signature                           | Output example                    |
| -------------- | ----------------------------------- | --------------------------------- |
| `uuid`         | `(prng) => string`                  | `'a1b2c3d4-...'`                  |
| `alphanumeric` | `(prng, length?: number) => string` | `'aB3kP9mZ'` (default length 8)   |
| `hexadecimal`  | `(prng, length?: number) => string` | `'0x3f9a1c2b'` (default length 8) |
| `nanoid`       | `(prng) => string`                  | 21-char URL-safe string           |

### Flat aliases (backwards compatibility)

The following top-level properties on `generators` are kept for compatibility. They are identical references to the sub-namespace functions:

```ts
generators.firstName; // → generators.person.firstName
generators.lastName; // → generators.person.lastName
generators.email; // → generators.internet.email
generators.url; // → generators.internet.url
generators.uuid; // → generators.string.uuid
generators.postalCode; // → generators.location.postalCode
generators.phone; // flat only (no sub-namespace; returns '+31 612345678')
generators.date; // flat only (returns a random Date in 2020–2025)
generators.loremText; // flat only ((prng, words: number) => string)
```

**Example — using sub-namespaces in `withKeyMap`:**

```ts
world.withKeyMap(ProductSchema, {
  name: (ctx) => generators.person.fullName(ctx.prng),
  email: (ctx) => generators.internet.email(ctx.prng),
  notes: (ctx) => generators.lorem.paragraph(ctx.prng),
  sku: (ctx) => generators.string.alphanumeric(ctx.prng, 6),
});
```

---

## `DEFAULT_KEY_MAP`

```ts
const DEFAULT_KEY_MAP: Record<string, Record<string, PrngGen> | undefined>;
```

Declarative, exact-match key→generator map, organised by Zod schema type. The top-level key is the Zod type name (`'string'`, `'number'`); the inner key is the lowercased field name.

`generateFromKey` consults this map first. You can read it, replace entries, or merge your own map on top to extend/override built-in behaviour.

**Built-in string entries** include: `email`, `firstname` / `first_name`, `lastname` / `last_name` / `surname`, `fullname` / `full_name` / `name`, `phone` / `phonenumber` / `phone_number`, `city`, `country`, `street` / `streetname` / `street_name`, `postalcode` / `zipcode` / `postal_code`, `url` / `website` / `homepage`, `title`, `description` / `bio` / `notes` / `note` / `comment` / `content` / `body` / `text` / `message` / `summary` / `transcript`, `sku`, `vatnumber` / `vat_number`.

**Built-in number entries** include: `wordcount` / `word_count`, `quantity`, `position`, `count`.

---

## `DEFAULT_KEY_PATTERNS`

```ts
const DEFAULT_KEY_PATTERNS: { string: KeyPattern[]; any: KeyPattern[] };
```

Suffix/prefix pattern rules applied after `DEFAULT_KEY_MAP` exact-match lookup misses. `string` rules only fire for `z.string()` fields; `any` fires regardless of schema type.

**Built-in rules:**

| Sub-map  | Pattern                                               | Generator                |
| -------- | ----------------------------------------------------- | ------------------------ |
| `string` | key `=== 'id'` or ends with `'id'` or `'uuid'`        | `generators.string.uuid` |
| `any`    | ends with `'at'` or `'date'`, or starts with `'date'` | `generators.date`        |

---

## `PrngGen<T>`

```ts
type PrngGen<T = unknown> = (prng: Prng) => T;
```

The value type for entries in `DEFAULT_KEY_MAP`, `DEFAULT_KEY_PATTERNS`, and `SubjectKeyMap`. Accepts only a `Prng`, which means all `generators.*` functions can be assigned directly:

```ts
DEFAULT_KEY_MAP.string!.email = generators.internet.email; // ✓ direct reference
```

---

## `KeyPattern`

```ts
type KeyPattern = { test: (key: string) => boolean; generate: PrngGen };
```

A single entry in `DEFAULT_KEY_PATTERNS`. `test` receives the lowercased field name; `generate` is called when `test` returns `true`.

---

## `KeyGenerator`

```ts
type KeyGenerator<T = unknown> = (schema: ZodTypeAny, ctx: GeneratorContext) => T;
```

A custom field-name generator. Receives the field's Zod schema so the generator can check the schema type (e.g., only fire for `z.number()` fields).

## `SubjectKeyMap<TData>`

```ts
type SubjectKeyMap<TData> = {
  [K in keyof TData]?: (prng: Prng) => TData[K];
};
```

A typed map of field generators scoped to a specific subject type. Field names and return types are inferred from the subject schema. Functions accept only a `Prng` (matching `PrngGen`), so `generators.*` functions can be assigned directly.

Used as the `keyMap` option on `defineSubjectType`. See [`defineSubjectType` — `keyMap`](#keymap).

## `SchemaKeyMap<TSchema>`

```ts
type SchemaKeyMap<TSchema extends ZodTypeAny> = {
  [K in keyof input<TSchema>]?: (ctx: GeneratorContext) => input<TSchema>[K];
};
```

A typed map of field generators scoped to a specific schema. Field names and return types are inferred from the schema — TypeScript will error if a key doesn't exist or a return type is wrong.

Used with `world.withKeyMap(schema, map)`. Unlike `KeyGenerator`, the functions here do **not** receive the field's Zod schema (use the `GeneratorContext` instead). Unlike `MatcherFn`, they do not receive subject data.

### `GeneratorContext`

```ts
interface GeneratorContext {
  prng: Prng;
  subject: AnySubjectInstance | undefined;
  registry: Registry;
  fieldPath: string;
  optionalProbability?: number;
}
```

**`prng`** — already forked for the current field path. Use directly without forking again (unless you need multiple independent values for the same field).

**`subject`** — the active subject instance. `undefined` for ad-hoc generation (when the schema is not bound to a subject type).

**`registry`** — the world's registry. Call `ctx.registry.pick<T>(type)` to reference other generated data.

**`fieldPath`** — dot-separated path (e.g., `'address.street'`). Useful for conditional logic in generators.

**`optionalProbability`** — the world's configured probability. Pass to schema-based generation if delegating.

---

## `MatcherFn` and `Matchers`

```ts
type MatcherFn<TSubjectData, TValue> = (
  subject: SubjectMatcherArg<TSubjectData>,
  ctx: GeneratorContext,
) => TValue;

type SubjectMatcherArg<TData> = TData & {
  readonly _type: string;
  readonly _id: string;
};

type Matchers<TSchema extends ZodTypeAny, TSubjectData> = {
  [K in keyof input<TSchema>]?: MatcherFn<TSubjectData, input<TSchema>[K]>;
};
```

The `subject` argument in matchers is the subject's data fields plus `_type` and `_id`. Use `_type` to branch in multi-type schemas:

```ts
.withSchema(RawDataSchema, TextFileSubject, {
  type: (s) => 'text' as const,  // s._type === 'text-file'
})
.withSchema(RawDataSchema, AudioFileSubject, {
  type: (s) => 'audio' as const, // s._type === 'audio-file'
})
```

**Type inference:** passing a `SubjectType` object (not a string) to `withSchema` gives full inference — `s` is typed as `SubjectData<TSubjectType>`.

---

## `DeepPartial<T>`

```ts
type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
```

Recursively makes all properties optional. Used for the `overrides` option.

**Note:** arrays are not partially typed — pass a complete replacement array in overrides, or use `transform` for index-level edits.

---

## Lower-level exports

These are exported for advanced use cases such as writing your own generation orchestration. In normal use, call `world.generate()` instead.

### `generateFromSchema(schema, ctx)`

```ts
function generateFromSchema(schema: ZodTypeAny, ctx: GeneratorContext): unknown;
```

Generates a value using Zod type introspection only. No matchers, no key heuristics.

### `generateFromKey(key, schema, ctx)`

```ts
function generateFromKey(key: string, schema: ZodTypeAny, ctx: GeneratorContext): unknown;
```

Attempts key-based generation using `DEFAULT_KEY_MAP` (exact match) then `DEFAULT_KEY_PATTERNS` (suffix/prefix rules). Returns `undefined` if neither matches.

### `createPrng(seed)`

```ts
function createPrng(seed: number): Prng;
```

Creates a standalone Mulberry32 PRNG seeded with `seed`.

### `fieldSeed(worldSeed, subjectId, fieldPath)`

```ts
function fieldSeed(worldSeed: number, subjectId: string, fieldPath: string): number;
```

Derives a deterministic per-field seed from the three inputs via FNV-1a hashing. Used internally by the world; exposed for advanced custom orchestration.
