/**
 * zod-mock — generate realistic, deterministic mock data from Zod schemas.
 *
 * ## Quick start
 *
 * ```ts
 * import { z } from 'zod'
 * import { createWorld, defineSubjectType } from 'zod-mock'
 *
 * // 1. Define domain entities (subjects)
 * const PersonSubject = defineSubjectType('person', z.object({
 *   firstName: z.string(),
 *   lastName:  z.string(),
 *   email:     z.email(),
 * }))
 *
 * // 2. Create a seeded world
 * const world = createWorld({ seed: 42 })
 *   .withSubject(PersonSubject)
 *   .withSchema(PersonApiSchema, 'person', {
 *     firstName: (s) => s.firstName,
 *     email:     (s) => `${s.firstName[0]}.${s.lastName}@example.nl`.toLowerCase(),
 *   })
 *
 * // 3. Generate data
 * const people = world.generate(z.array(PersonApiSchema).min(5).max(20))
 * ```
 *
 * ## Cross-API consistency
 *
 * When multiple API schemas reference the same underlying entities, bind them
 * all to the same subject type.  The world uses subjects as ID anchors, so
 * `rawdata.id === text.fileId` automatically.
 *
 * See the `media-library` integration test for a full example.
 */

export { defineSubjectType } from "./subject.js";
export { createWorld } from "./world.js";
export { createPrng, fieldSeed } from "./prng.js";
export { generateFromSchema, generateFromKey } from "./generators/index.js";
export { DEFAULT_KEY_MAP, DEFAULT_KEY_PATTERNS } from "./generators/key-based.js";
export type { PrngGen, KeyPattern } from "./generators/key-based.js";

import {
  firstName,
  lastName,
  fullName,
  jobTitle,
  jobArea,
  email,
  url,
  username,
  domain,
  ip,
  city,
  country,
  streetAddress,
  postalCode,
  latitude,
  longitude,
  word,
  sentence,
  paragraph,
  uuid,
  alphanumeric,
  hexadecimal,
  nanoid,
  phone,
  date,
  loremText,
} from "./generators/key-based.js";

/**
 * Built-in generators, organised into Faker-style sub-namespaces.
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
 *
 * The flat top-level properties (`generators.firstName`, etc.) are kept for
 * backwards compatibility and are identical references to the sub-namespace
 * functions.
 */
export const generators = {
  // -------------------------------------------------------------------------
  // Sub-namespaces
  // -------------------------------------------------------------------------
  person: { firstName, lastName, fullName, jobTitle, jobArea },
  internet: { email, url, username, domain, ip },
  location: { city, country, streetAddress, postalCode, latitude, longitude },
  lorem: { word, sentence, paragraph },
  string: { uuid, alphanumeric, hexadecimal, nanoid },

  // -------------------------------------------------------------------------
  // Flat aliases (backwards compatibility)
  // -------------------------------------------------------------------------
  firstName,
  lastName,
  email,
  uuid,
  phone,
  postalCode,
  url,
  date,
  loremText,
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
