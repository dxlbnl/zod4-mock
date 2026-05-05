/**
 * zod-mock — generate realistic, deterministic mock data from Zod schemas.
 */

export { defineSubjectType } from "./subject.js";
export { createWorld } from "./world.js";
export { createPrng, fieldSeed } from "./prng.js";
export { generateFromSchema, generateFromKey, data } from "./generators/index.js";
export { DEFAULT_KEY_MAP, DEFAULT_KEY_PATTERNS } from "./generators/index.js";
export type { PrngGen, KeyPattern } from "./generators/index.js";

import * as gen from "./generators/data/index.js";

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
export const generators = {
  // -------------------------------------------------------------------------
  // Sub-namespaces
  // -------------------------------------------------------------------------
  ...gen,
  internet: {
    ...gen.internet,
    domain: gen.internet.domainName, // Alias for tests
  },
  location: {
    ...gen.location,
    postalCode: gen.location.zipCode, // Alias for tests
  },
  lorem: {
    ...gen.word,
    word: gen.word.noun, // Alias for tests
  },

} as const;

export type {
  // Core
  World,
  WorldOptions,
  Registry,

  // Subject types
  AnySubjectType,
  AnySubjectInstance,
  SubjectType,
  SubjectData,
  SubjectInstance,
  SubjectTypeOptions,

  // Relations
  RelationDef,
  RelationMap,
  Cardinality,

  // Generation
  GeneratorContext,
  Prng,
  KeyGenerator,
  Matchers,
  MatcherFn,
  SubjectMatcherArg,

  // Override / transform
  DeepPartial,
  GenerateOptions,

  // Key maps
  SchemaKeyMap,
  SubjectKeyMap,
} from "./types.js";
