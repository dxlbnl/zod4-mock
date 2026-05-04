import type { ZodTypeAny } from 'zod'
import type { GeneratorContext } from '../types.js'

/**
 * Generate a value from a Zod schema using type introspection.
 * Falls back to undefined for unknown types.
 */
export function generateFromSchema(
  schema: ZodTypeAny,
  ctx: GeneratorContext,
): unknown {
  throw new Error('not implemented')
}
