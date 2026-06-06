# API Reference

> Generated from the TSDoc and types of the `src/` public exports by `pnpm docs:generate`. Do not edit by hand — update the exported symbol's TSDoc in `src/` and regenerate. Parity is verified by `pnpm docs:check`.

## Exports overview

| Export | Kind | Summary |
| ------ | ---- | ------- |
| `generate` | function | Zero-config entry point. |
| `createWorld` | function | Create a {@link World} — the central, deterministic generation session. |
| `createPrng` | function | Create a seeded PRNG. |
| `fieldSeed` | function | Derive a deterministic field-level seed from three stable inputs. |
| `generators` | object | Built-in generators organised into sub-namespaces (`generators.person`, `generators.internet`, …). |
| `data` | object | The raw built-in generator namespace (`data.person`, `data.internet`, …). |
| `generateFromSchema` | function | Schema-based fallback generator: produces a value purely from Zod type introspection (enum member, number in range, nested object, …). |
| `generateFromKey` | function | Key-based heuristic generator: resolves a value from a field's name by consulting {@link DEFAULT_KEY_MAP} (exact keys) then {@link DEFAULT_KEY_PATTERNS} (regex-like rules). |
| `DEFAULT_KEY_MAP` | object | Built-in exact-field-name heuristics, keyed by Zod leaf type then lower-cased field name (e.g. |
| `DEFAULT_KEY_PATTERNS` | object | Built-in suffix/prefix field-name heuristics, keyed by Zod leaf type (e.g. |
| `extend` | function | Shallow-per-section merge: creates a new locale by overriding individual sections. |
| `World` | type | One deterministic generation session, built fluently from `createWorld`. |
| `WorldOptions` | type | Options passed to `createWorld`. |
| `Registry` | type | In-memory store of every record generated within one world, keyed by Zod schema reference. |
| `GeneratorContext` | type | The per-field context handed to every generator and matcher. |
| `MatcherCtx` | type | The {@link GeneratorContext} variant passed to `withSchema` matchers, with `related()` typed from the schema's declared `relations` and `source` typed from its `from:` binding. |
| `BoundGenerators` | type | The built-in `generators` namespace with the field-seeded `Prng` pre-bound as the first argument of every generator. |
| `Prng` | type | Seeded pseudo-random number generator. |
| `PrngGen` | type | A generator that takes a Prng and an optional full context. |
| `KeyGenerator` | type | A field-name generator registered via `world.withGenerators`. |
| `KeyPattern` | type | A pattern rule: a key test function + a PrngGen generator. |
| `SchemaOpts` | type | Options for withSchema. |
| `SchemaKeyMap` | type | A per-schema map of field name → generator, registered via `world.withKeyMap`. |
| `GenerateOptions` | type | Per-call options for `generate` / `world.generate`: `overrides` (deep-merged onto the result), a `transform` post-processor, the `seed`, and tuning knobs for optional probability, array length, recursion, and registry writes. |
| `DeepPartial` | type | Recursively makes every property of `T` optional. |
| `ExplainResult` | type | Structured introspection result for `world.explain(schema)`. |
| `FieldExplanation` | type | Per-field resolution record returned by `world.explain(schema)`. |
| `RelationExplanation` | type | Per-relation record on `ExplainResult.relations`. |
| `LocaleData` | type | The full set of locale-specific word lists and formatting callbacks a world draws from. |
| `LastNamePrefix` | type | A surname prefix (tussenvoegsel) with its relative sampling weight. |
| `Currency` | type | An ISO 4217 currency record drawn by money generators: alphabetic `code`, display `name`, `symbol`, and the ISO `numeric` code. |

## generate

```ts
function generate<TSchema extends z.ZodTypeAny>(schema: TSchema, options?: GenerateOptions<z.infer<TSchema>>): z.infer<TSchema>
```

Zero-config entry point. Generates a value from any Zod schema without
any world setup. Internally creates a temporary world and discards it.

**Parameters**

| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `schema` | `TSchema` | — | Any Zod schema to generate a value from. |
| `options` | `GenerateOptions<z.infer<TSchema>>` | — | Per-call {@link GenerateOptions} (`seed`, `overrides`, …). |

**Example**

```ts
import { generate } from "zod4-mock";

const user = generate(UserSchema);
const admin = generate(UserSchema, { overrides: { role: "admin" }, seed: 42 });
```

## createWorld

```ts
function createWorld(options?: WorldOptions): World
```

Create a {@link World} — the central, deterministic generation session.
Chain `.withSchema` / `.withGenerators` / `.withKeyMap` to configure it, then
`.generate` / `.populate` to produce data. One world = one seed = one dataset.

**Parameters**

| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `options` | `WorldOptions` | — | World-wide settings ({@link WorldOptions}); the `seed` fixes determinism. |

**Example**

```ts
import { createWorld } from "zod4-mock";

const world = createWorld({ seed: 1 });
world.withSchema(UserSchema);
const user = world.generate(UserSchema);
```

## createPrng

```ts
function createPrng(seed: number): Prng
```

Create a seeded PRNG.

**Parameters**

| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `seed` | `number` | — | Any 32-bit integer.  The same seed always produces the same sequence. |

**Example**

```ts
import { createPrng } from "zod4-mock";
const prng = createPrng(1);
```

**Example**

```ts
import { createPrng, fieldSeed } from "zod4-mock";
const fieldPrng = createPrng(fieldSeed(1, "user#0", "name"));
```

## fieldSeed

```ts
function fieldSeed(worldSeed: number, subjectId: string, fieldPath: string): number
```

Derive a deterministic field-level seed from three stable inputs.

Used to give each field its own independent PRNG so that schema changes
(adding / removing fields) do not affect unrelated fields.

**Parameters**

| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `worldSeed` | `number` | — | The world's master seed. |
| `subjectId` | `string` | — | The subject instance's unique ID (e.g. `'person#3'`). |
| `fieldPath` | `string` | — | Dot-separated field path (e.g. `'address.street'`). |

**Example**

```ts
import { createPrng } from "zod4-mock";
const prng = createPrng(1);
```

**Example**

```ts
import { createPrng, fieldSeed } from "zod4-mock";
const fieldPrng = createPrng(fieldSeed(1, "user#0", "name"));
```

## generators

```ts
const generators: typeof dataNs
```

Built-in generators organised into sub-namespaces (`generators.person`,
`generators.internet`, …). Each function takes a `Prng` as its first
argument; pass `ctx.prng` from a matcher or key map.

**Example**

```ts
import { generators } from "zod4-mock";

world.withKeyMap(ProductSchema, {
  name: (ctx) => generators.person.fullName(ctx.prng),
  email: (ctx) => generators.internet.email(ctx.prng),
});
```

## data

```ts
const data: typeof dataNs
```

The raw built-in generator namespace (`data.person`, `data.internet`, …).
Each function takes a `Prng` as its first argument; prefer `generators` or
`ctx.gen` (which pre-bind the field-seeded `Prng`) inside matchers.

**Example**

```ts
import { data, createPrng } from "zod4-mock";
const name = data.person.fullName(createPrng(1));
```

## generateFromSchema

```ts
function generateFromSchema(schema: ZodTypeAny, ctx: GeneratorContext): unknown
```

Schema-based fallback generator: produces a value purely from Zod type
introspection (enum member, number in range, nested object, …). This is the
pipeline's always-resolving final rung, with no field-name heuristics.

**Parameters**

| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `schema` | `ZodTypeAny` | — | The Zod schema to introspect. |
| `ctx` | `GeneratorContext` | — | The current field {@link GeneratorContext}. |

**Example**

```ts
import { createWorld, generateFromSchema } from "zod4-mock";
import { z } from "zod";

const world = createWorld({ seed: 1 });
const value = world.generate(z.number().int().min(1).max(10));
```

## generateFromKey

```ts
function generateFromKey(key: string, schema: ZodTypeAny, ctx: GeneratorContext): unknown
```

Key-based heuristic generator: resolves a value from a field's name by
consulting {@link DEFAULT_KEY_MAP} (exact keys) then
{@link DEFAULT_KEY_PATTERNS} (regex-like rules). Returns `undefined` when no
heuristic matches, letting the pipeline fall through to the schema-based step.

**Parameters**

| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `key` | `string` | — | The field name being generated (e.g. `"email"`). |
| `schema` | `ZodTypeAny` | — | The field's Zod schema. |
| `ctx` | `GeneratorContext` | — | The current field {@link GeneratorContext}. |

**Example**

```ts
import { createWorld } from "zod4-mock";
import { z } from "zod";

// The field name `email` triggers the key-based heuristic.
const out = createWorld({ seed: 1 }).generate(z.object({ email: z.string() }));
```

## DEFAULT_KEY_MAP

```ts
const DEFAULT_KEY_MAP: Record<string, Record<string, PrngGen> | undefined>
```

Built-in exact-field-name heuristics, keyed by Zod leaf type then lower-cased
field name (e.g. `string.email` → a realistic email). The first table the
key-based pipeline step consults before {@link DEFAULT_KEY_PATTERNS}.

**Example**

```ts
import { DEFAULT_KEY_MAP } from "zod4-mock";

const emailGen = DEFAULT_KEY_MAP.string?.email;
```

## DEFAULT_KEY_PATTERNS

```ts
const DEFAULT_KEY_PATTERNS: Record<string, KeyPattern[]>
```

Built-in suffix/prefix field-name heuristics, keyed by Zod leaf type (e.g. a
`string` field ending in `name` → a full name, `...At` → an ISO date). The
regex-like fallback consulted after {@link DEFAULT_KEY_MAP}.

**Example**

```ts
import { DEFAULT_KEY_PATTERNS } from "zod4-mock";

const stringRules = DEFAULT_KEY_PATTERNS.string;
```

## extend

```ts
function extend(base: LocaleData, overrides: LocaleOverrides): LocaleData
```

Shallow-per-section merge: creates a new locale by overriding individual sections.

**Parameters**

| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `base` | `LocaleData` | — |  |
| `overrides` | `LocaleOverrides` | — |  |

**Example**

```ts
import { extend } from "zod4-mock";
import { en } from "@zod4-mock/locale-en";
const myLocale = extend(en, { id: "en-custom" });
```

## World

```ts
interface World
```

One deterministic generation session, built fluently from `createWorld`.
Register schemas (`withSchema`), wire generators (`withGenerators`,
`withKeyMap`), produce data (`generate`, `get`, `populate`, `populateFrom`),
and introspect resolution (`explain`); all records live in its `registry`.

## WorldOptions

```ts
interface WorldOptions
```

Options passed to `createWorld`. Sets the master `seed` and world-wide
defaults — optional-field probability, unconstrained-array length, custom
key generators, recursion limit, and the active locale.

## Registry

```ts
interface Registry
```

In-memory store of every record generated within one world, keyed by Zod
schema reference. Matchers reach across schemas through it (`pick`, `all`,
`find`) to keep generated data mutually consistent.

## GeneratorContext

```ts
interface GeneratorContext<T = any>
```

The per-field context handed to every generator and matcher. Carries the
field-seeded `prng`, the bound `gen` namespace, registry access, the
relation resolver, accumulated sibling values (`current`), and the active
locale for one field of one record.

## MatcherCtx

```ts
export type MatcherCtx< TRelations extends Record<string, ZodTypeAny> = Record<never, never>, TSource = undefined, TOutput = any, > = Omit<GeneratorContext<TOutput>, "related" | "source"> & { readonly source: TSource; readonly related: { <K extends keyof TRelations & string>(name: K): input<TRelations[K]>; (name: string): Record<string, unknown>; many<K extends keyof TRelations & string>(name: K, count: number): input<TRelations[K]>[]; many<T = unknown>(name: string, count: number): T[]; }; };
```

The {@link GeneratorContext} variant passed to `withSchema` matchers, with
`related()` typed from the schema's declared `relations` and `source` typed
from its `from:` binding. For a primary schema `source` is `undefined`.

## BoundGenerators

```ts
export type BoundGenerators = CoreGenerators;
```

The built-in `generators` namespace with the field-seeded `Prng` pre-bound
as the first argument of every generator. Exposed on `ctx.gen` so matchers
call `ctx.gen.person.firstName()` instead of passing a `Prng` by hand.

## Prng

```ts
interface Prng
```

Seeded pseudo-random number generator. Implemented in the main `zod4-mock` package.

## PrngGen

```ts
export type PrngGen<T = unknown> = (prng: Prng, ctx?: GeneratorContext, schema?: ZodTypeAny) => T;
```

A generator that takes a Prng and an optional full context.

## KeyGenerator

```ts
export type KeyGenerator<T = unknown> = (schema: ZodTypeAny, ctx: GeneratorContext) => T;
```

A field-name generator registered via `world.withGenerators`. Receives the
field's Zod schema and its {@link GeneratorContext} and returns the value for
that field; matched case-insensitively by field name.

## KeyPattern

```ts
export type KeyPattern = { test: (key: string) => boolean; generate: PrngGen };
```

A pattern rule: a key test function + a PrngGen generator.

## SchemaOpts

```ts
interface SchemaOpts<TSchema extends ZodTypeAny, TSource extends ZodTypeAny | undefined = undefined, TRelations extends Record<string, ZodTypeAny> = Record<never, never>>
```

Options for withSchema.
- If `from` is provided, the schema is "derived" and matchers receive `ctx.source`.
- If `from` is omitted, the schema is "primary" and `ctx.source` is undefined.

## SchemaKeyMap

```ts
export type SchemaKeyMap<TSchema extends ZodTypeAny> = { [K in keyof input<TSchema>]?: (ctx: GeneratorContext) => input<TSchema>[K]; };
```

A per-schema map of field name → generator, registered via
`world.withKeyMap`. Each entry is typed against the matching field of the
schema's input shape and receives a {@link GeneratorContext}.

## GenerateOptions

```ts
interface GenerateOptions<T>
```

Per-call options for `generate` / `world.generate`: `overrides` (deep-merged
onto the result), a `transform` post-processor, the `seed`, and tuning knobs
for optional probability, array length, recursion, and registry writes.

## DeepPartial

```ts
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
```

Recursively makes every property of `T` optional. Used to type
`GenerateOptions.overrides`, so a caller may override only the nested fields
they care about.

## ExplainResult

```ts
interface ExplainResult<TSchema extends ZodTypeAny>
```

Structured introspection result for `world.explain(schema)`. The `fields`
map is keyed by top-level field name in schema-shape order; the
`relations` map is keyed by relation name (empty `{}` when none). The
`toString()` method produces a human-readable aligned table — see
B16-R7.

## FieldExplanation

```ts
interface FieldExplanation
```

Per-field resolution record returned by `world.explain(schema)`.

`generator` is a stable identifier (e.g. `'person.firstName'`,
`'matcher:<key>'`, `'schema-based'`); `reason` is a short human-readable
explanation of which step of the pipeline picked it.

## RelationExplanation

```ts
interface RelationExplanation
```

Per-relation record on `ExplainResult.relations`. `schema` is the leaf
`def.type` of the related schema (e.g. `'object'`, `'lazy'`); `where`
reports whether the relation entry was the B11 object form
`{ schema, where }` with a predicate.

## LocaleData

```ts
interface LocaleData
```

The full set of locale-specific word lists and formatting callbacks a world
draws from. Bundled locales (`en`, `nl`) implement it; pass a custom one via
`WorldOptions.locale` or compose one with {@link extend}.

## LastNamePrefix

```ts
interface LastNamePrefix
```

A surname prefix (tussenvoegsel) with its relative sampling weight.

## Currency

```ts
interface Currency
```

An ISO 4217 currency record drawn by money generators: alphabetic `code`,
display `name`, `symbol`, and the ISO `numeric` code.
