/**
 * The raw built-in generator namespace (`data.person`, `data.internet`, …).
 * Each function takes a `Prng` as its first argument; prefer the `generators`
 * export or `ctx.gen` (which pre-bind the field-seeded `Prng`) in matchers.
 *
 * @example
 * ```ts
 * import { generators, createPrng } from "zod4-mock";
 *
 * const name = generators.person.fullName(createPrng(1));
 * ```
 */
export * as data from "./data/index.js";
export { generateFromSchema } from "./schema/index.js";
export { generateFromKey, DEFAULT_KEY_MAP, DEFAULT_KEY_PATTERNS } from "./data/key-map.js";
export type { PrngGen, KeyPattern } from "./data/key-map.js";
