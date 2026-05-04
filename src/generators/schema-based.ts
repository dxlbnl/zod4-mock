/**
 * @module generators/schema-based
 * Generates values by introspecting Zod schema types and their constraints.
 *
 * This is the lowest-priority fallback in the generation pipeline:
 *
 *   matchers → key-based → **schema-based**
 *
 * The generator handles all core Zod types (string, number, boolean, date,
 * enum, object, array, optional, nullable, union, literal) and respects Zod
 * validation constraints (`.min()`, `.max()`, `.length()`, `.email()`,
 * `.uuid()`, etc.).
 *
 * Nested `z.object(...)` schemas are generated recursively with the same
 * context (same subject, same registry, child field paths).
 */

import type { ZodTypeAny } from 'zod'
import type { GeneratorContext } from '../types.js'

/**
 * Generate a value from `schema` using Zod type introspection.
 *
 * @param schema - Any Zod schema.
 * @param ctx    - Generation context carrying the PRNG, subject, and registry.
 * @returns A value that satisfies `schema`.
 */
export function generateFromSchema(
  schema: ZodTypeAny,
  ctx: GeneratorContext,
): unknown {
  throw new Error('not implemented')
}
