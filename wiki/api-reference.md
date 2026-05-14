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
| `LocaleData`           | type      | Pluggable locale interface                       |
| `MarkovModel`          | type      | Trained n-gram model for word/name generation    |
| `NameOriginSet`        | type      | A Markov name model + its sampling weight        |
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

**`seed`** — master seed for all generation in this world. The same seed with the same builder chain always produces byte-identical output.

**`optionalProbability`** — probability in [0, 1] that `z.optional()` or `z.nullable()` fields are omitted/nulled. Set to `0` to always generate optional fields; `1` to always omit them. Default `0.2`.

**`defaultArrayLength`** — fallback `[min, max]` when a `z.array()` schema has no `.min()`, `.max()`, or `.length()` constraint. Default `[1, 5]`.

**`generators`** — custom key-based generators applied to every schema in the world. Keys are matched case-insensitively. See [`KeyGenerator`](#keygenerator) below.

**`locale`** — active locale used by name and word generators. When omitted, a built-in **minimal English locale** is used (small curated word/name lists, no Markov generation). For realistic, Markov-generated data install a full locale package and pass it explicitly:

```ts
import { createWorld } from "zod4-mock";
import { en } from "@zod4-mock/locale-en";
import { nl } from "@zod4-mock/locale-nl";

createWorld({ seed: 42 });              // minimal English default
createWorld({ seed: 42, locale: en });  // full English (Markov)
createWorld({ seed: 42, locale: nl });  // Dutch (Markov)
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
  relations?: Record<string, ZodTypeAny>;
  matchers?: {
    [K in keyof input<TSchema>]?: (ctx: GeneratorContext) => input<TSchema>[K];
  };
}
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
  relations?: Record<string, ZodTypeAny>;
  matchers?: {
    [K in keyof input<TSchema>]?: (
      ctx: GeneratorContext & { readonly source: input<TSource> },
    ) => input<TSchema>[K];
  };
}
```

The same output schema can be registered multiple times with different `from:` values to represent multiple source types — generating the output will produce one record per source across all bindings.

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

- If `schema` is an array: returns an array. Length derived from Zod constraints, falling back to `defaultArrayLength`.
- If the schema has `from:` bindings (derived): generates one output per source in the registry.
- If the schema is primary (registered or not): generates and stores a new record.

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
}
```

**`overrides`** — deep-partial merge. Nested objects are merged recursively; arrays are replaced entirely. Applied before `transform`.

**`transform`** — receives the merged value; must return a value of the same type. Applied after `overrides`.

### `.populate(schema, count)`

```ts
populate(schema: ZodTypeAny, count: number): this
```

Pre-generates `count` instances of the schema and stores them in the registry. Returns `this` for fluent chaining.

```ts
const world = createWorld({ seed: 42 }).withSchema(PersonSchema).populate(PersonSchema, 3); // 3 persons in registry before any generate()
```

### `.registry`

```ts
readonly registry: Registry
```

Read-only access to the world's registry. See [`Registry`](#registry) below.

---

## `Registry`

```ts
interface Registry {
  store(schema: ZodTypeAny, item: unknown): void;
  all<T = unknown>(schema: ZodTypeAny): T[];
  pick<T = unknown>(schema: ZodTypeAny): T;
  filter<T = unknown>(schema: ZodTypeAny, predicate: (item: T) => boolean): T[];
  count(schema: ZodTypeAny): number;
}
```

Keys are Zod schema object references — the same object passed to `withSchema`. This gives typed lookup results without string casts.

### `.all<T>(schema)`

Returns all stored items for `schema` as `T[]`. Returns an empty array if none.

```ts
const persons = world.registry.all(PersonSchema);
```

### `.pick<T>(schema)`

Returns a random stored item. **Throws** if none exist.

```ts
// Inside a matcher
lines: (ctx) => {
  const product = ctx.registry.pick(ProductSchema);
  return [{ productId: product.productId, ... }];
},
```

### `.filter<T>(schema, predicate)`

Returns all stored items for `schema` satisfying `predicate`. Returns an empty array if none match — never throws.

```ts
fileIds: (ctx) => ctx.registry
  .filter(FileSchema, (f) => f.ownerId === ctx.source.personId)
  .map((f) => f.fileId),
```

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
  related<T = unknown>(relationName: string): T;
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

Returns one element from a non-empty tuple (requires at least one element at the type level).

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
}
```

`seed` is only used by the module-level `generate()` function; it is ignored by `world.generate()` (use `createWorld({ seed })` instead).

---

## Localization

Locale data and types live in separate workspace packages, not in `zod4-mock`
itself. This keeps the core library small and lets consumers install only the
locales they need.

| Package                  | Contents                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| `@zod4-mock/locale-core` | `LocaleData`, `MarkovModel`, `Currency`, etc. types + `extend()`       |
| `@zod4-mock/locale-en`   | Full English locale (`en`) with Markov-trained name & word models     |
| `@zod4-mock/locale-nl`   | Full Dutch locale (`nl`) with Markov-trained models                   |
| `@zod4-mock/locale-names`| Pre-trained Markov name models by cultural origin (shared dependency) |

The `zod4-mock` package re-exports `extend` and the locale types for
convenience, but **not** `en` or `nl` — import those from their packages.

### Default locale

When `createWorld()` is called without a `locale`, a built-in **minimal English
locale** is used. It has small curated word and name lists and does **not** use
Markov generation — output is plain (`"John Smith"`, `"Section"`) rather than
realistically varied. Install `@zod4-mock/locale-en` and pass `en` for the full
Markov-backed experience.

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
interface NameOriginSet {
  model: MarkovModel;
  weight: number;        // relative probability weight (need not sum to 100)
}

interface LastNamePrefix {
  prefix: string;        // e.g. "de", "van der"
  weight: number;        // relative weight vs. implicit "no prefix" weight of 100
}

interface Currency {
  code: string;          // "USD"
  name: string;          // "US Dollar"
  symbol: string;        // "$"
  numeric: string;       // "840"
}

interface LocaleData {
  id: string;
  person: {
    // Markov-based names (full locales) — OR simple arrays (minimal locales).
    firstNamesMale?:   readonly NameOriginSet[];
    firstNamesFemale?: readonly NameOriginSet[];
    lastNames?:        readonly NameOriginSet[];
    simpleFirstNamesMale?:   readonly string[];
    simpleFirstNamesFemale?: readonly string[];
    simpleLastNames?:        readonly string[];
    lastNamePrefixes?: readonly LastNamePrefix[]; // e.g. Dutch tussenvoegsels
    prefixes: { male: string[]; female: string[]; neutral: string[] };
    suffixes: string[];
    genders: string[];
    jobTitles: string[]; jobAreas: string[]; jobTypes: string[]; jobDescriptors: string[];
    formatFullName: (first: string, last: string) => string;
    formatBio: (prng, parts: { jobTitle; jobArea; jobType }) => string;
  };
  word: {
    nounModel?: MarkovModel;       // Markov — OR the `nouns` array below
    adjectiveModel?: MarkovModel;
    nouns?: readonly string[];
    adjectives?: readonly string[];
    articles: string[]; /* ... other closed-class word lists */
  };
  address: {
    cities; states; countries; countryCodes; continents; languages;
    streetNames; streetSuffixes; cityPrefixes; cityCores;
    buildingNumberSuffixes; timeZones; directions;
    cardinalDirections; ordinalDirections;
    streetFormats; zipFormat; secondaryAddressFormat;
    phonePrefix; ibanPrefix; countryCode;
  };
  commerce: {
    departments; materials; productAdjectives; currencyCode;
    formatPrice; formatProductName; formatProductDescription;
  };
  company: {
    prefixes; suffixes; buzzAdjectives; buzzNouns; buzzVerbLemmas;
    catchPhraseAdjectives; catchPhraseDescriptors; catchPhraseNouns;
    formatBuzzPhrase;
  };
  finance: {
    bankCodes; bicLocations; currencies: readonly Currency[];
    accountNames; transactionTypes; transactionDescriptions; formatIban;
  };
  date:  { months; monthsShort; weekdays; weekdaysShort; timeZones };
  color: { names: readonly string[] };
  phone: { mobilePrefix; landlinePrefixes; formatMobile; formatLandline };
}
```

**Markov vs. simple locales.** A locale supplies either Markov models
(`firstNamesMale`, `nounModel`, …) or plain string arrays
(`simpleFirstNamesMale`, `nouns`, …). Generators prefer the Markov model when
present and fall back to the array otherwise. Full locale packages
(`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`) ship Markov models; the
built-in default locale ships only the simple arrays.

`firstNamesMale`, `firstNamesFemale`, and `lastNames` accept an array of `NameOriginSet` entries. `sampleWeighted(prng, sets)` picks an origin proportionally to weights, then samples from that model. This enables realistic demographic distributions — e.g., the `nl` locale mixes Dutch (68%), Arabic (12%), Turkish (6%), and Frisian (2%) models.

`lastNamePrefixes` is optional. When present, `lastName()` prepends a prefix with probability `prefixWeightTotal / (prefixWeightTotal + 100)`, capitalised for standalone use. `formatFullName` in locales that have tussenvoegsels should lowercase the first character of the last name (Dutch convention: "Jan de Jong" not "Jan De Jong").

### `MarkovModel`

```ts
interface MarkovModel {
  order: number;            // n-gram order (2 = bigram)
  prior: number;            // Dirichlet smoothing (e.g. 0.01)
  chars: string;            // alphabet + "$" end-of-word sentinel
  table: Record<string, number[]>; // n-gram state → CDF weights
}
```

Models are trained offline (see `scripts/train-markov.ts` in Commit 2) and committed as TypeScript files. The runtime `sampleMarkov(prng, model)` function performs binary-search CDF sampling.
