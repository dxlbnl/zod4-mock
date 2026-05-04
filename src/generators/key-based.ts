/**
 * @module generators/key-based
 * Generates semantically meaningful values based on field name patterns.
 *
 * Position in the generation pipeline:
 *
 *   matchers → **key-based** → schema-based
 *
 * The generator maps common field name patterns to realistic generators:
 * - `firstName`, `lastName`, `fullName` → Dutch/English personal names
 * - `email` → an email address derived from first+last name when available
 * - `phone`, `phoneNumber` → a plausible phone number
 * - `street`, `city`, `postalCode`, `country` → address components
 * - `id`, `*Id`, `*Uuid` → UUIDs (defers to schema-based for `z.string().uuid()`)
 * - `createdAt`, `updatedAt`, `date`, `*At` → dates
 * - `url`, `website` → URLs
 * - `description`, `bio`, `notes`, `comment` → short prose
 * - `title`, `name` → capitalised words
 * - `amount`, `price`, `total`, `*Cents` → numbers
 * - `status` → the first enum value from the schema (if available)
 *
 * Field name matching is case-insensitive and uses suffix/prefix heuristics.
 * When no pattern matches, `undefined` is returned and the caller falls back
 * to schema-based generation.
 *
 * @param key    - The field name being generated (e.g. `'firstName'`).
 * @param schema - The Zod schema for this field (used for type checking).
 * @param ctx    - Generation context with PRNG and subject data.
 * @returns A generated value, or `undefined` if the key is unrecognised.
 */

import type { ZodTypeAny } from 'zod'
import type { GeneratorContext } from '../types.js'

/**
 * Attempt to generate a realistic value based on field name semantics.
 *
 * Returns `undefined` when the key does not match any known pattern, signalling
 * to the caller that schema-based generation should be used instead.
 */
export function generateFromKey(
  key: string,
  schema: ZodTypeAny,
  ctx: GeneratorContext,
): unknown {
  throw new Error('not implemented')
}
