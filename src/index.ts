/**
 * zod-mock — generate realistic, deterministic mock data from Zod schemas.
 */

export { createWorld } from "./world.js";
export { createPrng, fieldSeed } from "./prng.js";
export { generateFromSchema, generateFromKey, data } from "./generators/index.js";
export { DEFAULT_KEY_MAP, DEFAULT_KEY_PATTERNS } from "./generators/index.js";
export type { PrngGen, KeyPattern } from "./generators/index.js";

import { z } from "zod";
import type { GenerateOptions, WorldOptions } from "./types.js";
import { createWorld } from "./world.js";
export * as generators from "./generators/data/index.js";

/**
 * Zero-config entry point. Generates a value from any Zod schema without
 * any world setup. Internally creates a temporary world and discards it.
 *
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
    ...(options?.seed !== undefined && { seed: options.seed }),
    ...(options?.optionalProbability !== undefined && {
      optionalProbability: options.optionalProbability,
    }),
    ...(options?.defaultArrayLength !== undefined && {
      defaultArrayLength: options.defaultArrayLength,
    }),
    ...(options?.recursionLimit !== undefined && { recursionLimit: options.recursionLimit }),
  };

  const world = createWorld(worldOptions);
  return world.generate(schema, options);
}

/**
 * Built-in generators, organised into sub-namespaces.
 * All functions take a `Prng` as their first argument.
 *
 * ```ts
 * import { generators } from 'zod4-mock'
 *
 * world.withKeyMap(ProductSchema, {
 *   name:  (ctx) => generators.person.fullName(ctx.prng),
 *   email: (ctx) => generators.internet.email(ctx.prng),
 * })
 * ```
 */

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
} from "./types.js";
