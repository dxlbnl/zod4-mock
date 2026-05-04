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
 *   email:     z.string().email(),
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

export { defineSubjectType } from './subject.js'
export { createWorld } from './world.js'
export { createPrng, fieldSeed } from './prng.js'
export { generateFromSchema, generateFromKey } from './generators/index.js'

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
  Matchers,
  MatcherFn,
  SubjectMatcherArg,

  // Override / transform
  DeepPartial,
  GenerateOptions,
} from './types.js'
