/**
 * @module types
 * Core TypeScript interfaces and types for the zod-mock library.
 *
 * Consumers import from the root `index.ts`; this file is the single
 * source of truth for every public type in the library.
 */

import type { ZodTypeAny, ZodObject, ZodRawShape, input } from "zod";

// ---------------------------------------------------------------------------
// Cardinality & Relations
// ---------------------------------------------------------------------------

/**
 * Expresses how many related subjects exist for a given relation.
 *
 * - `'0..1'` — optional, at most one
 * - `'1'`    — exactly one (required)
 * - `'0..n'` — optional, any number
 * - `'1..n'` — at least one
 */
export type Cardinality = "0..1" | "1" | "0..n" | "1..n";

/** A single relation from one subject type to another. */
export interface RelationDef {
  /** The target subject-type name (e.g. `'person'`, `'company'`). */
  readonly type: string;
  /** How many targets exist for this relation. */
  readonly cardinality: Cardinality;
  /**
   * The name of the field in the schema that acts as the foreign key for this relation.
   * If omitted, the library will attempt to auto-detect a matching field.
   */
  readonly key?: string;
}

/** A map of relation names to their definitions, as declared on a `SubjectType`. */
export type RelationMap = Record<string, RelationDef>;

// ---------------------------------------------------------------------------
// SubjectType
// ---------------------------------------------------------------------------

/**
 * A map of field names to `(prng: Prng) => T` generators scoped to a
 * specific subject type's schema.  Declared on `SubjectTypeOptions.keyMap`.
 *
 * These generators override the built-in `DEFAULT_KEY_MAP` heuristics for
 * subject data creation, but are themselves overridden by world-level
 * `withGenerators`.  The `(prng) => T` signature matches the sub-namespace
 * generator functions so they can be assigned directly:
 *
 * ```ts
 * defineSubjectType('product', ProductSchema, {
 *   keyMap: {
 *     name: generators.lorem.sentence,   // direct reference
 *   },
 * })
 * ```
 */
export type SubjectKeyMap<TData> = {
  [K in keyof TData]?: (prng: Prng) => TData[K];
};

/** Options passed to `defineSubjectType`. */
export interface SubjectTypeOptions<TRelations extends RelationMap = RelationMap, TData = unknown> {
  /**
   * Declares which other subject types this type can be related to, and the
   * cardinality of each relation.  Cyclical relations are supported; the world
   * resolves them lazily.
   *
   * @example
   * ```ts
   * relations: {
   *   partner:  { type: 'person', cardinality: '0..1' },
   *   children: { type: 'person', cardinality: '0..n' },
   * }
   * ```
   */
  readonly relations?: TRelations;

  /**
   * Derive field values from other already-generated fields of the same subject.
   *
   * Functions are called after all base fields are generated (key-based and
   * schema-based), and their return value overwrites the base-generated value.
   * Functions are called in declaration order, so a later entry can reference
   * an earlier derived field.
   *
   * World-level `generators` take priority over `derive` for the same key.
   *
   * @example
   * ```ts
   * derive: {
   *   email: ({ firstName, lastName }, prng) =>
   *     `${firstName![0]}.${lastName}${prng.int(10, 99)}@${prng.pick(DOMAINS)}`.toLowerCase(),
   * }
   * ```
   */
  readonly derive?: {
    [K in keyof TData]?: (partial: Partial<TData>, ctx: GeneratorContext) => TData[K];
  };

  /**
   * Per-field key generators for this subject type.  Applied during subject
   * data creation, after world-level `withGenerators` but before the built-in
   * `DEFAULT_KEY_MAP` heuristics.
   *
   * Use this to give domain-specific meaning to ambiguous field names like
   * `name` (default: person full name) for non-person subject types.
   *
   * Values are plain `(prng: Prng) => T` functions — `generators.*` can be
   * assigned directly.
   */
  readonly keyMap?: SubjectKeyMap<TData>;
}

/**
 * A named, typed subject definition produced by `defineSubjectType`.
 *
 * Subject types are application-specific — the library ships none of its own.
 * Register them with `world.withSubject(...)`.
 */
export interface SubjectType<
  TSchema extends ZodObject<ZodRawShape>,
  TRelations extends RelationMap = RelationMap,
> {
  readonly _tag: "SubjectType";
  /** Unique name used to look up this type in the world (e.g. `'person'`). */
  readonly name: string;
  /** The Zod schema that defines the subject's data fields. */
  readonly schema: TSchema;
  /** Declared relations to other subject types. */
  readonly relations: TRelations;
  /** Intra-subject derived fields. Erased to `unknown` at the `AnySubjectType` level. */
  readonly derive?: Record<
    string,
    (partial: Record<string, unknown>, ctx: GeneratorContext) => unknown
  >;
  /** Per-field key generators. Erased to `unknown` at the `AnySubjectType` level. */
  readonly keyMap?: Record<string, (prng: Prng) => unknown>;
}

/** Erased form of `SubjectType` used internally where the generics are irrelevant. */
export type AnySubjectType = SubjectType<ZodObject<ZodRawShape>, RelationMap>;

// ---------------------------------------------------------------------------
// Subject instances (generated data)
// ---------------------------------------------------------------------------

/** The inferred TypeScript type of a subject's data fields. */
export type SubjectData<T extends AnySubjectType> = input<T["schema"]>;

/**
 * A generated instance of a subject: its identity metadata plus its data.
 *
 * The `_type` and `_id` fields are synthetic — they are **not** part of the
 * Zod schema and will not appear in any generated app-schema output unless a
 * matcher explicitly maps them.
 */
export interface SubjectInstance<T extends AnySubjectType = AnySubjectType> {
  /** The subject-type name (e.g. `'person'`). */
  readonly _type: string;
  /** A deterministic, unique identifier for this instance within the world. */
  readonly _id: string;
  /** The generated data for this subject, matching its schema. */
  readonly data: SubjectData<T>;
  /** Stable record of resolved relationships for this instance. */
  readonly _relations: Record<string, AnySubjectInstance | AnySubjectInstance[] | null>;
}

/** Erased form of `SubjectInstance` used internally. */
export type AnySubjectInstance = SubjectInstance<AnySubjectType>;

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

/**
 * A seeded pseudo-random number generator (Mulberry32).
 *
 * All values produced by a `Prng` are deterministic: the same seed always
 * yields the same sequence.  Use `fork(key)` to derive an independent PRNG
 * from a stable string key; this is how per-field seeding is achieved.
 */
export interface Prng {
  /** Returns a float in [0, 1). */
  random(): number;
  /** Returns an integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Returns one element from a non-empty tuple. */
  pick<T>(items: readonly [T, ...T[]]): T;
  /**
   * Derives a new, independent PRNG from a deterministic key.
   * The parent PRNG's state is not consumed.
   *
   * @param key - A stable string used to compute the child seed via FNV-1a.
   */
  fork(key: string): Prng;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Stores and retrieves all data generated within a world.
 *
 * Items are stored by a string type name (e.g. `'text-file'`, `'sentence'`).
 * The registry is the bridge between independently generated datasets: a
 * matcher can call `ctx.registry.pick<SentenceData>('sentence')` to reference
 * a previously generated sentence from within an annotation's matcher.
 *
 * All retrieval methods are generic so callers get typed results without casts:
 * ```ts
 * const file = ctx.registry.pick<{ fileId: string; ownerId: string }>('text-file')
 * ```
 */
export interface Registry {
  /** Store an item under a named type. */
  store(type: string, item: unknown): void;
  /** Return all stored items of `type` as `T[]`. */
  all<T = unknown>(type: string): T[];
  /**
   * Return a random stored item of `type` as `T`.
   * @throws if no items of this type have been stored yet.
   */
  pick<T = unknown>(type: string): T;
  /**
   * Return a random stored item of `type` that satisfies `predicate`.
   * @throws if no matching items exist.
   */
  pickBy<T = unknown>(type: string, predicate: (item: T) => boolean): T;
  /**
   * Return all stored items of one or more types that satisfy `predicate`.
   *
   * When an array of types is passed the results are concatenated in
   * registration order.
   */
  filter<T = unknown>(type: string | string[], predicate: (item: T) => boolean): T[];
  /** Return the number of stored items of `type`. */
  count(type: string): number;
}

// ---------------------------------------------------------------------------
// Generator context
// ---------------------------------------------------------------------------

/**
 * Passed to every matcher function and generator during data generation.
 * Provides access to the PRNG, the active subject instance, and the registry.
 */
export interface GeneratorContext {
  /**
   * A PRNG already forked for the current field path.
   * Using this PRNG instead of a global one ensures per-field stability:
   * adding a new field to a schema does not disturb existing fields.
   */
  readonly prng: Prng;
  /**
   * The subject instance currently being used to drive generation, if any.
   * `undefined` for ad-hoc generation (schemas not bound to a subject type).
   */
  readonly subject: AnySubjectInstance | undefined;
  /** Access to all data generated and stored in this world so far. */
  readonly registry: Registry;
  /**
   * The dot-separated path of the field being generated (e.g. `'address.street'`).
   * Used internally for per-field PRNG seeding.
   */
  readonly fieldPath: string;
  /**
   * The partially generated object containing sibling fields.
   * Useful for cross-field inference (e.g. matching `firstName` to `gender`).
   */
  readonly parent?: Record<string, unknown>;
  /**
   * Probability in [0, 1] that `z.optional()` / `z.nullable()` fields are omitted.
   * Defaults to `WorldOptions.optionalProbability` (typically 0.2).
   */
  readonly optionalProbability?: number;
  /**
   * Lazily resolves and returns the data of a related subject instance (or array of instances)
   * based on the declared cardinality in `defineSubjectType`.
   *
   * @example
   * ```ts
   * ownerId: (_, ctx) => ctx.related<PersonData>('owner').personId
   * ```
   */
  related<T = unknown>(relationName: string): T;
  /**
   * Finds all instances of `targetType` that have a relationship named `relationName`
   * pointing to this subject. Returns their data.
   *
   * @example
   * ```ts
   * fileIds: (_, ctx) => ctx.relatedTo<TextFileData>('text-file', 'owner').map(f => f.fileId)
   * ```
   */
  relatedTo<T = unknown>(targetType: string, relationName: string): T[];
}

// ---------------------------------------------------------------------------
// KeyGenerator: custom field-name generator
// ---------------------------------------------------------------------------

/**
 * A custom field-name generator for use with `WorldOptions.generators` and
 * `world.withGenerators()`.
 *
 * Receives the field's Zod schema so the generator can gate on schema type,
 * mirroring how the built-in key-based heuristics work.
 *
 * @example
 * ```ts
 * const myGenerators: Record<string, KeyGenerator> = {
 *   vendorCode: (_schema, ctx) => `V-${generators.uuid(ctx.prng)}`,
 *   unitPrice:  (schema, ctx) => ctx.prng.int(100, 10000),
 * }
 * ```
 */
export type KeyGenerator<T = unknown> = (schema: ZodTypeAny, ctx: GeneratorContext) => T;

// ---------------------------------------------------------------------------
// SchemaKeyMap: per-schema key overrides (no subject required)
// ---------------------------------------------------------------------------

/**
 * A map of field names to generator functions for a specific schema.
 *
 * Unlike `Matchers`, these functions do not receive a subject — they are
 * suitable for any schema, including those not bound to a subject type.
 *
 * Register via `world.withKeyMap(schema, map)`.  Takes priority over global
 * `withGenerators` entries for the same field, but is overridden by `Matchers`.
 *
 * @example
 * ```ts
 * const map: SchemaKeyMap<typeof ProductSchema> = {
 *   sku: (ctx) => `SKU-${ctx.prng.int(1000, 9999)}`,
 * }
 * world.withKeyMap(ProductSchema, map)
 * ```
 */
export type SchemaKeyMap<TSchema extends ZodTypeAny> = {
  [K in keyof input<TSchema>]?: (ctx: GeneratorContext) => input<TSchema>[K];
};

// ---------------------------------------------------------------------------
// Matchers: field-level generators tied to a subject
// ---------------------------------------------------------------------------

/**
 * The first argument to a matcher function.
 *
 * Combines the subject's schema data fields with the instance metadata
 * (`_type` and `_id`) so that matchers can branch on the subject type
 * without going through `ctx.subject`.
 *
 * @example
 * ```ts
 * // Accessing data fields:
 * id: (s) => s.fileId
 *
 * // Accessing instance metadata (useful for multi-type schemas):
 * type: (s) => s._type === 'text-file' ? 'text' : 'audio'
 * ```
 */
export type SubjectMatcherArg<TData> = TData & {
  readonly _type: string;
  readonly _id: string;
};

/**
 * A function that derives a specific field value from the active subject.
 *
 * @typeParam TSubjectData - The data shape of the subject (from its schema).
 * @typeParam TValue - The type of the field being generated.
 */
export type MatcherFn<TSubjectData, TValue> = (
  subject: SubjectMatcherArg<TSubjectData>,
  ctx: GeneratorContext,
) => TValue;

/**
 * A record of matcher functions keyed by schema field names.
 *
 * Only the fields you want to derive from the subject need to be listed —
 * any unlisted field falls back to key-based → schema-based generation.
 *
 * @example
 * ```ts
 * const matchers: Matchers<typeof PersonApiSchema, PersonSubjectData> = {
 *   firstName: (s) => s.firstName,
 *   email:     (s) => `${s.firstName[0]}.${s.lastName}@example.nl`.toLowerCase(),
 * }
 * ```
 */
export type Matchers<TSchema extends ZodTypeAny, TSubjectData> = {
  [K in keyof input<TSchema>]?: MatcherFn<TSubjectData, input<TSchema>[K]>;
};

// ---------------------------------------------------------------------------
// Deep partial (for overrides)
// ---------------------------------------------------------------------------

/**
 * Recursively makes all properties of `T` optional.
 * Used for the `overrides` option in `world.generate(schema, { overrides })`.
 */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

// ---------------------------------------------------------------------------
// withSchema registration (internal)
// ---------------------------------------------------------------------------

/** Internal record of a schema registered via `world.withSchema`. */
export interface SchemaRegistration<TSchema extends ZodTypeAny, TSubjectData> {
  readonly schema: TSchema;
  readonly subjectTypes: string[];
  readonly matchers: Matchers<TSchema, TSubjectData>;
}

// ---------------------------------------------------------------------------
// generate() options
// ---------------------------------------------------------------------------

/**
 * Options accepted by `world.generate(schema, options)`.
 *
 * @typeParam T - The inferred output type of the schema being generated.
 */
export interface GenerateOptions<T> {
  /**
   * Force a specific subject type when the schema is registered for multiple
   * types and you want to pin the generation to one of them.
   */
  readonly subject?: string;
  /**
   * Deep-partial overrides merged into the generated value after matchers run.
   * Arrays are replaced (not merged); use `transform` for array-index edits.
   *
   * @example
   * ```ts
   * world.generate(FileSchema, { overrides: { status: 'failed' } })
   * ```
   */
  readonly overrides?: DeepPartial<T>;
  /**
   * A function applied after `overrides`.  Receives the merged value and must
   * return a new value of the same type.  Ideal for array-index manipulation.
   *
   * @example
   * ```ts
   * world.generate(FileSchema, {
   *   transform: (data) => ({
   *     ...data,
   *     steps: data.steps.map((s, i) =>
   *       i === 3 ? { ...s, status: 'failed' as const } : s
   *     ),
   *   }),
   * })
   * ```
   */
  readonly transform?: (data: T) => T;
}

// ---------------------------------------------------------------------------
// World options
// ---------------------------------------------------------------------------

/**
 * Configuration for `createWorld`.
 */
export interface WorldOptions {
  /**
   * Master seed for deterministic generation.
   * The same seed always produces the same world, including all subjects,
   * relations, and generated values.
   */
  readonly seed: number;
  /**
   * Probability in [0, 1] that an optional field is omitted (`undefined`).
   * Applies to `z.optional()` and `z.nullable()` fields.
   * @default 0.2
   */
  readonly optionalProbability?: number;
  /**
   * Fallback array length range `[min, max]` used when a `z.array()` schema
   * carries no `.min()` / `.max()` / `.length()` constraints.
   * @default [1, 5]
   */
  readonly defaultArrayLength?: readonly [number, number];
  /**
   * Custom key-based generators applied to every schema generated in this world.
   * Keys are matched case-insensitively. Takes priority over built-in heuristics.
   * Per-call overrides via `world.withGenerators()` are merged on top of these.
   */
  readonly generators?: Record<string, KeyGenerator>;
}

// ---------------------------------------------------------------------------
// World interface
// ---------------------------------------------------------------------------

/**
 * The central context for one data-generation session.
 *
 * Build a world declaratively with `withSubject` and `withSchema`, then call
 * `generate` to produce values.  The world is seeded and fully deterministic.
 *
 * @example
 * ```ts
 * const world = createWorld({ seed: 42 })
 *   .withSubject(PersonSubject)
 *   .withSchema(PersonApiSchema, 'person', {
 *     firstName: (s) => s.firstName,
 *     email:     (s) => `${s.firstName[0]}.${s.lastName}@example.nl`.toLowerCase(),
 *   })
 *
 * const people = world.generate(z.array(PersonApiSchema).min(5).max(20))
 * ```
 */
export interface World {
  /**
   * Register a subject type so the world can generate instances of it.
   * Returns `this` for fluent chaining.
   */
  withSubject(subjectType: AnySubjectType): this;

  /**
   * Bind an app schema to a subject type and optionally provide matcher
   * functions that derive field values from the active subject.
   *
   * Pass the `SubjectType` object (not just its name) to get full type
   * inference in your matchers.  Pass a string name for a weakly-typed
   * binding, or an array of strings to bind to multiple types at once.
   *
   * Returns `this` for fluent chaining.
   *
   * @example
   * ```ts
   * // Strongly typed: SubjectType object → matchers are fully type-safe
   * world.withSchema(PersonApiSchema, PersonSubject, {
   *   name: (s) => `${s.firstName} ${s.lastName}`,
   * })
   *
   * // Multiple types: separate withSchema call per type (recommended)
   * world.withSchema(RawDataSchema, TextFileSubject, { id: (s) => s.fileId, type: () => 'text' })
   * world.withSchema(RawDataSchema, AudioFileSubject, { id: (s) => s.fileId, type: () => 'audio' })
   *
   * // Weakly typed: string name (TSubjectData = unknown)
   * world.withSchema(PersonApiSchema, 'person', { name: (s) => (s as any).firstName })
   * ```
   */
  // Strongly typed overload: SubjectType object → infers TSubjectData
  withSchema<TSchema extends ZodTypeAny, TSubjectType extends AnySubjectType>(
    schema: TSchema,
    subjectType: TSubjectType,
    matchers?: Matchers<TSchema, SubjectData<TSubjectType>>,
  ): this;
  // Weakly typed overload: string name(s)
  withSchema<TSchema extends ZodTypeAny>(
    schema: TSchema,
    subjectTypes: string | string[],
    matchers?: Matchers<TSchema, unknown>,
  ): this;

  /**
   * Register additional key-based generators for this world.
   *
   * Calls are additive — each call merges new entries without removing prior ones.
   * Keys are matched case-insensitively and take priority over built-in heuristics.
   *
   * ```ts
   * world.withGenerators({
   *   vendorCode: (_schema, ctx) => `V-${generators.uuid(ctx.prng)}`,
   * })
   * ```
   */
  withGenerators(map: Record<string, KeyGenerator>): this;

  /**
   * Bind field generators to a specific schema.
   *
   * Unlike `withGenerators` (global, untyped), `withKeyMap` is schema-specific
   * and fully type-safe — field names and return types are inferred from the
   * schema.  Unlike `withSchema` matchers, no subject binding is required.
   *
   * Priority order (highest → lowest):
   * 1. `withSchema` matchers
   * 2. `withKeyMap` ← here
   * 3. `withGenerators` (global)
   * 4. Built-in key heuristics
   * 5. Schema-based fallback
   *
   * Calls for the same schema are merged additively; later entries overwrite
   * earlier ones for the same field key.
   *
   * ```ts
   * world.withKeyMap(ProductSchema, {
   *   sku:   (ctx) => `SKU-${ctx.prng.int(1000, 9999)}`,
   *   price: (ctx) => ctx.prng.int(100, 50000),
   * })
   * ```
   */
  withKeyMap<T extends ZodTypeAny>(schema: T, map: SchemaKeyMap<T>): this;

  /**
   * Generate a value (or array of values) from the given Zod schema.
   *
   * - For a plain `z.object(...)` schema: returns a single generated object.
   * - For a `z.array(schema)` schema: returns an array; length is derived from
   *   Zod constraints (`.min()`, `.max()`, `.length()`), falling back to
   *   `WorldOptions.defaultArrayLength`.
   *
   * Generation pipeline (in order):
   * 1. Matchers (from `withSchema`)
   * 2. Key-based generators (field name semantics)
   * 3. Schema-based generator (Zod type introspection)
   * 4. `options.overrides` (deep merge)
   * 5. `options.transform` (final transform function)
   *
   * @example
   * ```ts
   * // Single object
   * world.generate(PersonApiSchema)
   *
   * // Array with length constraints from Zod
   * world.generate(z.array(PersonApiSchema).min(5).max(20))
   *
   * // With overrides
   * world.generate(FileSchema, { overrides: { status: 'failed' } })
   * ```
   */
  generate<TSchema extends ZodTypeAny>(
    schema: TSchema,
    options?: GenerateOptions<input<TSchema>>,
  ): input<TSchema>;

  /**
   * Get the next subject instance of the given type.
   *
   * Subjects are generated lazily and deterministically.  Successive calls
   * with the same type return different subjects; the same world with the same
   * seed always produces the same sequence.
   *
   * @throws if the subject type has not been registered via `withSubject`.
   */
  subject(type: string): AnySubjectInstance;

  /**
   * Return all subject instances currently in this world, optionally filtered
   * by type name.
   *
   * @example
   * ```ts
   * world.subjects()           // all subjects across all types
   * world.subjects('person')   // only person instances
   * ```
   */
  subjects(type?: string): AnySubjectInstance[];

  /**
   * Pre-create `count` subject instances of the given type.
   *
   * Call this before `generate` when you want to control how many subjects
   * exist — for example, to ensure 3 persons exist before generating files so
   * that files are distributed across all 3 owners.
   *
   * Returns `this` for fluent chaining.
   *
   * @example
   * ```ts
   * const world = createMediaLibraryWorld(42)
   *   .populate(PersonSubject, 3)
   * ```
   */
  populate(subjectType: AnySubjectType | string, count: number): this;

  /** Access to all data generated and stored in this world. */
  readonly registry: Registry;
}
