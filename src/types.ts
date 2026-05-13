/**
 * @module types
 * Core TypeScript interfaces and types for the zod-mock library.
 */

import type { ZodTypeAny, input, z } from "zod";
import type { createPrng } from "./prng.js";

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

export interface Prng {
  random(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly [T, ...T[]]): T;
  fork(key: string): Prng;
  bytes(n: number): Uint8Array;
}

// ---------------------------------------------------------------------------
// Registry — schema-reference based
//
// Keys are Zod schema object references (not strings). This gives typed
// lookup results without string casts.
// ---------------------------------------------------------------------------

export interface Registry {
  store<T extends ZodTypeAny>(schema: T, item: input<T>): void;
  all<T extends ZodTypeAny>(schema: T): input<T>[];
  pick<T extends ZodTypeAny>(schema: T): input<T>;
  filter<T extends ZodTypeAny>(schema: T, predicate: (item: input<T>) => boolean): input<T>[];
  count(schema: ZodTypeAny): number;
}

import type * as gen from "./generators/data/index.js";

type BoundModule<T> = {
  [K in keyof T]: T[K] extends (prng: Prng, ...args: infer P) => infer R ? (...args: P) => R : T[K];
};

export type CoreGenerators = {
  [K in keyof typeof gen]: BoundModule<(typeof gen)[K]>;
};

export type BoundGenerators = CoreGenerators & Record<string, any>;

// ---------------------------------------------------------------------------
// Generator context
// ---------------------------------------------------------------------------

export interface GeneratorContext<T = any> {
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
  readonly current: Partial<T>;
  /**
   * Resolves a related schema instance declared in the schema's `relations`.
   * Auto-provisions one if the registry is empty.
   */
  related<T = Record<string, unknown>>(relationName: string): T;
  /**
   * Generates a value using the full world engine (honoring matchers and registry).
   */
  generate<S extends ZodTypeAny>(schema: S, options?: GenerateOptions<z.infer<S>>): z.infer<S>;
  /**
   * Maximum recursion depth.
   */
  readonly recursionLimit: number;
}

// ---------------------------------------------------------------------------
// MatcherCtx — GeneratorContext with typed related() for schema matchers
//
// TRelations is inferred from the `relations` property passed to withSchema.
// When TRelations = Record<never, never> (no relations), the typed overload is
// unreachable and the fallback (string → Record<string, unknown>) applies.
// ---------------------------------------------------------------------------

export type MatcherCtx<
  TRelations extends Record<string, ZodTypeAny> = Record<never, never>,
  TSource = undefined,
  TOutput = any,
> = Omit<GeneratorContext<TOutput>, "related" | "source"> & {
  readonly source: TSource;
  related<K extends keyof TRelations & string>(name: K): input<TRelations[K]>;
  related(name: string): Record<string, unknown>;
};

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
  readonly optionalProbability?: number;
  readonly defaultArrayLength?: readonly [number, number];
  readonly recursionLimit?: number;
  readonly source?: any;
  readonly fieldPath?: string;
  readonly prng?: ReturnType<typeof createPrng>;
}

// ---------------------------------------------------------------------------
// World options
// ---------------------------------------------------------------------------

export interface WorldOptions {
  readonly seed?: number;
  readonly optionalProbability?: number;
  readonly defaultArrayLength?: readonly [number, number];
  readonly generators?: Record<string, KeyGenerator>;
  readonly recursionLimit?: number;
}

// ---------------------------------------------------------------------------
// Schema registration options
// ---------------------------------------------------------------------------

/**
 * Options for withSchema.
 * - If `from` is provided, the schema is "derived" and matchers receive `ctx.source`.
 * - If `from` is omitted, the schema is "primary" and `ctx.source` is undefined.
 */
export interface SchemaOpts<
  TSchema extends ZodTypeAny,
  TSource extends ZodTypeAny | undefined = undefined,
  TRelations extends Record<string, ZodTypeAny> = Record<never, never>,
> {
  from?: TSource;
  relations?: TRelations;
  matchers?: {
    [K in keyof input<TSchema>]?: (
      ctx: MatcherCtx<
        TRelations,
        TSource extends ZodTypeAny ? input<TSource> : undefined,
        input<TSchema>
      >,
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
  withSchema<
    TSchema extends ZodTypeAny,
    TSource extends ZodTypeAny | undefined = undefined,
    TRelations extends Record<string, ZodTypeAny> = Record<never, never>,
  >(
    schema: TSchema,
    opts?: SchemaOpts<TSchema, TSource, TRelations>,
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
    options?: GenerateOptions<z.infer<TSchema>>,
  ): z.infer<TSchema>;

  /**
   * Pre-generate `count` instances of the schema and store them in the registry.
   * Returns `this` for fluent chaining.
   */
  populate(schema: ZodTypeAny, count: number): this;

  /** Access to all data generated and stored in this world. */
  readonly registry: Registry;
  /** Internal PRNG for testing and stability checks. */
  readonly prng: ReturnType<typeof createPrng>;
}
