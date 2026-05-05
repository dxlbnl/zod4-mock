/**
 * @module generators
 * Re-exports all generator functions.
 *
 * Generation pipeline (highest to lowest priority):
 * 1. Matchers declared in `world.withSchema(schema, type, matchers)`
 * 2. Key-based generators (`generateFromKey`) — field name semantics
 * 3. Schema-based generator (`generateFromSchema`) — Zod type introspection
 */

export { generateFromSchema } from "./schema/index.js";
export {
  generateFromKey,
  firstName,
  lastName,
  email,
  uuid,
  phone,
  postalCode,
  url,
  date,
  loremText,
} from "./key-based.js";
