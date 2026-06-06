/**
 * zod-mock — generate realistic, deterministic mock data from Zod schemas.
 */

/**
 * Create a deterministic generation session. See {@link createWorld}.
 *
 * @example
 * ```ts
 * import { createWorld } from "zod4-mock";
 * const world = createWorld({ seed: 1 });
 * ```
 */
export { createWorld } from "./world.js";

/**
 * Seeded-PRNG helpers. See {@link createPrng} and {@link fieldSeed}.
 *
 * @example
 * ```ts
 * import { createPrng } from "zod4-mock";
 * const prng = createPrng(1);
 * ```
 * @example
 * ```ts
 * import { createPrng, fieldSeed } from "zod4-mock";
 * const fieldPrng = createPrng(fieldSeed(1, "user#0", "name"));
 * ```
 */
export { createPrng, fieldSeed } from "./prng.js";

/**
 * Pipeline generator rungs. See {@link generateFromSchema} and
 * {@link generateFromKey}.
 *
 * @example
 * ```ts
 * import { generateFromSchema } from "zod4-mock";
 * ```
 * @example
 * ```ts
 * import { generateFromKey } from "zod4-mock";
 * ```
 */
export { generateFromSchema, generateFromKey } from "./generators/index.js";

import * as dataNs from "./generators/data/index.js";
/**
 * The raw built-in generator namespace (`data.person`, `data.internet`, …).
 * Each function takes a `Prng` as its first argument; prefer `generators` or
 * `ctx.gen` (which pre-bind the field-seeded `Prng`) inside matchers.
 *
 * @example
 * ```ts
 * import { data, createPrng } from "zod4-mock";
 * const name = data.person.fullName(createPrng(1));
 * ```
 */
export const data: typeof dataNs = dataNs;

/**
 * Built-in field-name heuristic tables. See {@link DEFAULT_KEY_MAP} and
 * {@link DEFAULT_KEY_PATTERNS}.
 *
 * @example
 * ```ts
 * import { DEFAULT_KEY_MAP } from "zod4-mock";
 * ```
 * @example
 * ```ts
 * import { DEFAULT_KEY_PATTERNS } from "zod4-mock";
 * ```
 */
export { DEFAULT_KEY_MAP, DEFAULT_KEY_PATTERNS } from "./generators/index.js";

export type { PrngGen, KeyPattern } from "./generators/index.js";

/**
 * Compose a locale by shallow-merging overrides onto a base. See {@link extend}.
 *
 * @example
 * ```ts
 * import { extend } from "zod4-mock";
 * import { en } from "@zod4-mock/locale-en";
 * const myLocale = extend(en, { id: "en-custom" });
 * ```
 */
export { extend } from "@zod4-mock/locale-core";

import { z } from "zod";
import type { GenerateOptions, WorldOptions } from "./types.js";
import { createWorld } from "./world.js";

/**
 * Built-in generators organised into sub-namespaces (`generators.person`,
 * `generators.internet`, …). Each function takes a `Prng` as its first
 * argument; pass `ctx.prng` from a matcher or key map.
 *
 * @example
 * ```ts
 * import { generators } from "zod4-mock";
 *
 * world.withKeyMap(ProductSchema, {
 *   name: (ctx) => generators.person.fullName(ctx.prng),
 *   email: (ctx) => generators.internet.email(ctx.prng),
 * });
 * ```
 */
export const generators: typeof dataNs = dataNs;

/**
 * Zero-config entry point. Generates a value from any Zod schema without
 * any world setup. Internally creates a temporary world and discards it.
 *
 * @param schema - Any Zod schema to generate a value from.
 * @param options - Per-call {@link GenerateOptions} (`seed`, `overrides`, …).
 *
 * @example
 * ```ts
 * import { generate } from "zod4-mock";
 *
 * const user = generate(UserSchema);
 * const admin = generate(UserSchema, { overrides: { role: "admin" }, seed: 42 });
 * ```
 */
export function generate<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  options?: GenerateOptions<z.infer<TSchema>>,
): z.infer<TSchema> {
  const worldOptions: WorldOptions = {
    ...options,
    ...(options?.seed !== undefined && { seed: options.seed }),
    ...(options?.optionalProbability !== undefined && {
      optionalProbability: options.optionalProbability,
    }),
    ...(options?.defaultArrayLength !== undefined && {
      defaultArrayLength: options.defaultArrayLength,
    }),
    ...(options?.recursionLimit !== undefined && {
      recursionLimit: options.recursionLimit,
    }),
  };

  const world = createWorld(worldOptions);
  return world.generate(schema, options);
}

export type {
  // Core
  World,
  WorldOptions,
  Registry,

  // Generation
  GeneratorContext,
  BoundGenerators,
  Prng,
  KeyGenerator,

  // Schema registration
  SchemaOpts,
  MatcherCtx,

  // Override / transform
  DeepPartial,
  GenerateOptions,

  // Key maps
  SchemaKeyMap,

  // Explain (B16)
  ExplainResult,
  FieldExplanation,
  RelationExplanation,

  // Localization
  LocaleData,
  LastNamePrefix,
  Currency,
} from "./types.js";
