/**
 * Inline fallback corpus for `packages/locale-nl/scripts/fetch-data.ts`.
 *
 * These arrays are the Phase 1 migrated corpus, captured here so a Phase 2
 * blob can be regenerated even when network sources are unreachable. The
 * fetch script prefers fresh network sources first, falls back to the
 * previously-committed blob next, and uses these constants only as the final
 * safety net.
 *
 * Provenance:
 *   - first names: open-nl-data/dutch-names-dataset (MIT) — Mannen>100 /
 *     Vrouwen>100 thresholds.
 *   - last names:  Phase 1 migration from the prior `locale-names/groups/dutch`
 *     slice (2007 NL top-1000 surname survey, Meertens-NFB-derived).
 *   - nouns/adj:   small curated Dutch stubs (Phase 1 placeholders).
 */

export { FALLBACK_FIRST_NAMES_MALE } from "./fallback-first-names-male.js";
export { FALLBACK_FIRST_NAMES_FEMALE } from "./fallback-first-names-female.js";
export { FALLBACK_LAST_NAMES } from "./fallback-last-names.js";
export { FALLBACK_NOUNS } from "./fallback-nouns.js";
export { FALLBACK_ADJECTIVES } from "./fallback-adjectives.js";
