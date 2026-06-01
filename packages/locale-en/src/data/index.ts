/**
 * Locale-en data layer — plain-TypeScript barrel.
 *
 * The five string-array corpora are emitted as runtime-agnostic source by
 * `packages/locale-en/scripts/fetch-data.ts`. Re-run that script to refresh
 * the data; the consumer's bundler handles compression/tree-shaking.
 *
 * No `node:*` imports — this loader runs unmodified in browsers, MSW,
 * service workers, and edge runtimes.
 */

export { firstNamesMale } from "./first-names-male.js";
export { firstNamesFemale } from "./first-names-female.js";
export { lastNames } from "./last-names.js";
export { nouns } from "./nouns.js";
export { adjectives } from "./adjectives.js";
