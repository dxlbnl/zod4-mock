/**
 * @module types
 * Core TypeScript interfaces and types for the zod-mock library.
 */

import type { ZodTypeAny, ZodObject, ZodRawShape, input } from "zod";

// ---------------------------------------------------------------------------
// Cardinality & Relations (kept for internal use)
// ---------------------------------------------------------------------------

export type Cardinality = "0..1" | "1" | "0..n" | "1..n";

export interface RelationDef {
  readonly type: string;
  readonly cardinality: Cardinality;
  readonly key?: string;
}

export type RelationMap = Record<string, RelationDef>;

// ---------------------------------------------------------------------------
// Legacy subject types (kept for internal compatibility)
// ---------------------------------------------------------------------------

export type SubjectKeyMap<TData> = {
  [K in keyof TData]?: (prng: Prng) => TData[K];
};

export interface SubjectTypeOptions<TRelations extends RelationMap = RelationMap, TData = unknown> {
  readonly relations?: TRelations;
  readonly derive?: {
    [K in keyof TData]?: (partial: Partial<TData>, ctx: GeneratorContext) => TData[K];
  };
  readonly keyMap?: SubjectKeyMap<TData>;
}

export interface SubjectType<
  TSchema extends ZodObject<ZodRawShape>,
  TRelations extends RelationMap = RelationMap,
> {
  readonly _tag: "SubjectType";
  readonly name: string;
  readonly schema: TSchema;
  readonly relations: TRelations;
  readonly derive?: Record<
    string,
    (partial: Record<string, unknown>, ctx: GeneratorContext) => unknown
  >;
  readonly keyMap?: Record<string, (prng: Prng) => unknown>;
}

export type AnySubjectType = SubjectType<ZodObject<ZodRawShape>, RelationMap>;

export type SubjectData<T extends AnySubjectType> = input<T["schema"]>;

export interface SubjectInstance<T extends AnySubjectType = AnySubjectType> {
  readonly _type: string;
  readonly _id: string;
  readonly data: SubjectData<T>;
  readonly _relations: Record<string, AnySubjectInstance | AnySubjectInstance[] | null>;
}

export type AnySubjectInstance = SubjectInstance<AnySubjectType>;

export type SubjectMatcherArg<TData> = TData & {
  readonly _type: string;
  readonly _id: string;
};

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

export interface Prng {
  random(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly [T, ...T[]]): T;
  fork(key: string): Prng;
}

// ---------------------------------------------------------------------------
// Registry — schema-reference based
//
// Keys are Zod schema object references (not strings). This gives typed
// lookup results without string casts.
// ---------------------------------------------------------------------------

export interface Registry {
  store(schema: ZodTypeAny, item: unknown): void;
  all<T = unknown>(schema: ZodTypeAny): T[];
  pick<T = unknown>(schema: ZodTypeAny): T;
  filter<T = unknown>(schema: ZodTypeAny, predicate: (item: T) => boolean): T[];
  count(schema: ZodTypeAny): number;
}

// ---------------------------------------------------------------------------
// Bound generators (ctx.gen)
//
// The same shape as the top-level `generators` namespace, but with the
// field-seeded PRNG pre-applied. Call ctx.gen.person.firstName() instead of
// generators.person.firstName(ctx.prng).
// ---------------------------------------------------------------------------

export type BoundGenerators = Record<string, Record<string, (...args: unknown[]) => unknown>>;

// ---------------------------------------------------------------------------
// Generator context
// ---------------------------------------------------------------------------

export interface GeneratorContext {
  /**
   * A PRNG forked for the current field path. Using this PRNG ensures
   * per-field stability: adding a field doesn't disturb existing fields.
   */
  readonly prng: Prng;
  /**
   * Generators namespace with the field-seeded PRNG pre-applied.
   * Call ctx.gen.person.firstName() instead of generators.person.firstName(ctx.prng).
   */
  readonly gen: BoundGenerators;
  /**
   * For derived schemas (registered with `from:`), this holds the source
   * schema record currently driving generation. `undefined` for primary schemas.
   */
  readonly source: unknown;
  readonly registry: Registry;
  readonly fieldPath: string;
  readonly optionalProbability?: number;
  /**
   * When generating nested object fields, holds the partial sibling-field values
   * accumulated so far. Used internally for gender-aware name generation.
   */
  readonly parent?: Record<string, unknown>;
  /**
   * Resolves a related schema instance declared in the schema's `relations`.
   * Auto-provisions one if the registry is empty.
   */
  related<T = unknown>(relationName: string): T;
}

// ---------------------------------------------------------------------------
// KeyGenerator: custom field-name generator
// ---------------------------------------------------------------------------

export type KeyGenerator<T = unknown> = (schema: ZodTypeAny, ctx: GeneratorContext) => T;

// ---------------------------------------------------------------------------
// SchemaKeyMap: per-schema key overrides
// ---------------------------------------------------------------------------

export type SchemaKeyMap<TSchema extends ZodTypeAny> = {
  [K in keyof input<TSchema>]?: (ctx: GeneratorContext) => input<TSchema>[K];
};

// ---------------------------------------------------------------------------
// Matchers: field-level generators for withSchema
//
// New signature: (ctx: GeneratorContext) => value
// For derived schemas with from:, ctx.source is typed as input<TSource>.
// ---------------------------------------------------------------------------

export type MatcherFn<TSubjectData, TValue> = (
  subject: SubjectMatcherArg<TSubjectData>,
  ctx: GeneratorContext,
) => TValue;

export type Matchers<TSchema extends ZodTypeAny, TSubjectData = unknown> = {
  [K in keyof input<TSchema>]?: MatcherFn<TSubjectData, input<TSchema>[K]>;
};

// ---------------------------------------------------------------------------
// Deep partial (for overrides)
// ---------------------------------------------------------------------------

export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

// ---------------------------------------------------------------------------
// generate() options
// ---------------------------------------------------------------------------

export interface GenerateOptions<T> {
  readonly overrides?: DeepPartial<T>;
  readonly transform?: (data: T) => T;
  readonly seed?: number;
}

// ---------------------------------------------------------------------------
// World options
// ---------------------------------------------------------------------------

export interface WorldOptions {
  readonly seed: number;
  readonly optionalProbability?: number;
  readonly defaultArrayLength?: readonly [number, number];
  readonly generators?: Record<string, KeyGenerator>;
}

// ---------------------------------------------------------------------------
// Schema registration options
// ---------------------------------------------------------------------------

/**
 * Options for withSchema — primary or relational registration (no `from:`).
 * Matchers receive a GeneratorContext; ctx.source is undefined.
 */
export interface PrimarySchemaOpts<TSchema extends ZodTypeAny> {
  relations?: Record<string, ZodTypeAny>;
  matchers?: {
    [K in keyof input<TSchema>]?: (ctx: GeneratorContext) => input<TSchema>[K];
  };
}

/**
 * Options for withSchema — derived registration (with `from:`).
 * Matchers receive a GeneratorContext where ctx.source is typed as input<TSource>.
 */
export interface DerivedSchemaOpts<TSchema extends ZodTypeAny, TSource extends ZodTypeAny> {
  from: TSource;
  relations?: Record<string, ZodTypeAny>;
  matchers?: {
    [K in keyof input<TSchema>]?: (
      ctx: GeneratorContext & { readonly source: input<TSource> },
    ) => input<TSchema>[K];
  };
}

// ---------------------------------------------------------------------------
// World interface
// ---------------------------------------------------------------------------

export interface World {
  /**
   * Register a schema with optional matchers, relations, or a source binding.
   *
   * Primary (no from:):
   *   world.withSchema(PersonSchema, { matchers: { email: (ctx) => ... } })
   *
   * Relational (with relations:):
   *   world.withSchema(FileSchema, {
   *     relations: { owner: PersonSchema },
   *     matchers: { ownerId: (ctx) => ctx.related("owner").personId },
   *   })
   *
   * Derived (with from:):
   *   world.withSchema(SummarySchema, {
   *     from: PersonSchema,
   *     matchers: { id: (ctx) => ctx.source.personId },
   *   })
   *
   * The same output schema can be registered multiple times, each with a
   * different `from:` binding, to represent multiple source types.
   */
  withSchema<TSchema extends ZodTypeAny>(
    schema: TSchema,
    opts?: PrimarySchemaOpts<TSchema>,
  ): this;
  withSchema<TSchema extends ZodTypeAny, TSource extends ZodTypeAny>(
    schema: TSchema,
    opts: DerivedSchemaOpts<TSchema, TSource>,
  ): this;

  /**
   * Register additional key-based generators. Calls are additive.
   * Keys are matched case-insensitively against field names.
   */
  withGenerators(map: Record<string, KeyGenerator>): this;

  /**
   * Bind field generators to a specific schema (legacy API, kept for compat).
   */
  withKeyMap<T extends ZodTypeAny>(schema: T, map: SchemaKeyMap<T>): this;

  /**
   * Generate a value from a Zod schema.
   *
   * - Object schema → single generated object
   * - z.array(schema) → array respecting min/max/length constraints
   * - Registered derived schemas → one record per source
   */
  generate<TSchema extends ZodTypeAny>(
    schema: TSchema,
    options?: GenerateOptions<input<TSchema>>,
  ): input<TSchema>;

  /**
   * Pre-generate `count` instances of the schema and store them in the registry.
   * Returns `this` for fluent chaining.
   */
  populate(schema: ZodTypeAny, count: number): this;

  /** Access to all data generated and stored in this world. */
  readonly registry: Registry;

  // Legacy API — kept for backward compat but prefer schema-based alternatives
  withSubject(subjectType: AnySubjectType): this;
  subject(type: string): AnySubjectInstance;
  subjects(type?: string): AnySubjectInstance[];
}

// ---------------------------------------------------------------------------
// Legacy schema registration (kept for backward compat)
// ---------------------------------------------------------------------------

export interface SchemaRegistration<TSchema extends ZodTypeAny, TSubjectData> {
  readonly schema: TSchema;
  readonly subjectTypes: string[];
  readonly matchers: Matchers<TSchema, TSubjectData>;
}
