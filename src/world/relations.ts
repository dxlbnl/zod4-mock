/**
 * @module world/relations
 *
 * Pure helpers for relation resolution. The state-bearing methods
 * (`resolveRelated`, `resolveRelatedMany`, `resolveRelationPool`,
 * `ensurePrimaryRecord`) remain on `WorldImpl` in `engine.ts` per the B28
 * pragmatic split — they need access to the world's private state
 * (`relationPools`, `registry`, `effectiveStore`, `generateAndStorePrimary`).
 *
 * What lives here:
 *   - `RelationCacheKind` — the "single" vs "many" tag used as a discriminator
 *     in the shared `resolveRelationPool` (B32-R1 / R2).
 *   - `relationCacheKey(...)` — the cache-key string builder; the `":many"`
 *     suffix on the many path keeps it disjoint from the single path
 *     (B11-R3 / B11-R4 / B11-R7 — both caches are scoped per record).
 *   - `relationForkKey(...)` — the per-relation PRNG fork-key builder
 *     (D4 / D10 byte-identical fork-key shape; the `rel-many:` prefix on the
 *     many path keeps its fork independent of the single path's `rel:` fork).
 *   - `relationEmptyPoolMessage(...)` / `relationShortPoolMessage(...)` — the
 *     B11-R6 error messages thrown when a `where`-filtered pool is empty or
 *     undersupplied.
 */

export type RelationCacheKind = "single" | "many";

/**
 * Per-record relation pool cache key. The single and many paths use disjoint
 * cache keys so a record reading the same relation through both APIs gets
 * independent snapshots.
 */
export function relationCacheKey(
  recordId: string,
  relName: string,
  kind: RelationCacheKind,
): string {
  return kind === "many" ? `${recordId}:${relName}:many` : `${recordId}:${relName}`;
}

/**
 * Per-relation PRNG fork key — derived from `recordPrng` so all fields in one
 * record pick the same related entity (single) or set (many). The `rel-many:`
 * prefix on the many path keeps its fork independent of the single path's
 * `rel:` fork — D4 / D10 byte-identical fork-key shape.
 */
export function relationForkKey(relName: string, kind: RelationCacheKind): string {
  return kind === "many" ? `rel-many:${relName}` : `rel:${relName}`;
}

/**
 * B11-R6 — error thrown when the `where`-filtered pool is empty on the single
 * path. Surfaced before any PRNG fork is taken so no state is consumed.
 */
export function relationEmptyPoolMessage(relName: string): string {
  return (
    `No related '${relName}' matches the \`where\` predicate. ` +
    `Pre-populate the registry with records satisfying the predicate, or relax the predicate.`
  );
}

/**
 * B11-R6 — error thrown when the `where`-filtered pool is undersupplied on
 * the many path (`items.length < count`). Surfaced before any PRNG fork is
 * taken so no state is consumed.
 */
export function relationShortPoolMessage(
  relName: string,
  requested: number,
  available: number,
): string {
  return (
    `No related '${relName}' matches the \`where\` predicate ` +
    `(requested ${requested}, available ${available}). ` +
    `Pre-populate the registry with records satisfying the predicate, or relax the predicate.`
  );
}
