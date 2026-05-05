/**
 * @module generators
 * Re-exports all generator functions.
 *
 * Generation pipeline (highest to lowest priority):
 * 1. Matchers declared in `world.withSchema(schema, type, matchers)`
 * 2. Key-based generators (`generateFromKey`) — field name semantics
 * 3. Schema-based generator (`generateFromSchema`) — Zod type introspection
 */

export * as data from "./data/index.js";
export { generateFromSchema } from "./schema/index.js";
export { generateFromKey, DEFAULT_KEY_MAP, DEFAULT_KEY_PATTERNS } from "./data/key-map.js";
export type { PrngGen, KeyPattern } from "./data/key-map.js";
