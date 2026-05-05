/**
 * @module subject
 * Factory for creating subject-type definitions.
 *
 * Subject types are application-specific: the library ships none of its own.
 * Call `defineSubjectType` once per domain entity (Person, Company, TextFile,
 * …) and register the result with `world.withSubject(...)`.
 */

import type { ZodObject, ZodRawShape, input } from "zod";
import type { AnySubjectType, RelationMap, SubjectTypeOptions, Prng } from "./types.js";

/**
 * Define a named subject type backed by a Zod schema.
 *
 * Subject types are the identity anchors of the world.  All app-level schemas
 * registered with `world.withSchema` derive their ID fields and cross-API
 * consistency from subject instances.
 *
 * @param name    - A unique string identifier (e.g. `'person'`, `'text-file'`).
 * @param schema  - A `z.object(...)` schema describing the subject's data fields.
 * @param options - Optional: relation declarations.
 *
 * @example
 * ```ts
 * const PersonSubject = defineSubjectType('person', z.object({
 *   firstName: z.string(),
 *   lastName:  z.string(),
 *   email:     z.email(),
 * }), {
 *   relations: {
 *     partner:  { type: 'person',  cardinality: '0..1' },
 *     employer: { type: 'company', cardinality: '0..1' },
 *   },
 * })
 * ```
 */
export function defineSubjectType<
  TSchema extends ZodObject<ZodRawShape>,
  TRelations extends RelationMap = Record<never, never>,
>(
  name: string,
  schema: TSchema,
  options?: SubjectTypeOptions<TRelations, input<TSchema>>,
): AnySubjectType & { schema: TSchema; relations: TRelations } {
  return {
    _tag: "SubjectType",
    name,
    schema,
    relations: (options?.relations ?? {}) as TRelations,
    ...(options?.derive !== undefined && {
      derive: options.derive as Record<
        string,
        (partial: Record<string, unknown>, prng: Prng) => unknown
      >,
    }),
    ...(options?.keyMap !== undefined && {
      keyMap: options.keyMap as Record<string, (prng: Prng) => unknown>,
    }),
  };
}
