import type { ZodTypeAny } from 'zod'
import type { GeneratorContext } from '../types.js'

/**
 * Attempt to generate a realistic value based on field name semantics.
 * Returns undefined if the key is not recognised.
 */
export function generateFromKey(
  key: string,
  schema: ZodTypeAny,
  ctx: GeneratorContext,
): unknown {
  throw new Error('not implemented')
}
