/**
 * @module world/derived
 *
 * B8 — per-pair derived upsert map and source-identity helpers.
 *
 * The upsert map is keyed `<DerivedSchema, source-identity → derived record>`.
 * `WorldImpl` holds the outer `Map<ZodTypeAny, Map<unknown, unknown>>` as a
 * private field; this module exposes the small set of read/write helpers used
 * by `generateSingleItem` (cache short-circuit) and `generateWithSourceOverride`
 * (the write path).
 *
 * The cache short-circuit and `derivedPairCounter--` rollback live in the
 * dispatcher in `engine.ts` (D9 / B8-R9 — cache-neutral); these helpers are
 * pure read/write of the map and pure computation of the source identity.
 *
 * The stored value is the post-transform derived record — the same reference
 * that lives in the registry (D8 — see `wiki/decisions.md`).
 */

import type { ZodTypeAny } from "zod";

/** Outer map: derived schema reference → per-source-identity inner map. */
export type DerivedUpsertMap = Map<ZodTypeAny, Map<unknown, unknown>>;

/**
 * Compute the source identity used as the inner-map key. When a registration
 * specified `sourceKey: "id"`, the identity is `source[sourceKey]`; otherwise
 * it is the source reference itself.
 */
export function computeSourceIdentity(
  sourceKey: string | null | undefined,
  source: unknown,
): unknown {
  if (sourceKey !== null && sourceKey !== undefined) {
    return (source as Record<string, unknown>)[sourceKey];
  }
  return source;
}

/**
 * Cache lookup: return the previously-derived record for `(schema, identity)`
 * if present. The dispatcher in `engine.ts` short-circuits the rest of the
 * branch on a hit and rolls back `derivedPairCounter` (D9 / B8-R9).
 */
export function getDerivedUpsert(
  upsertMap: DerivedUpsertMap,
  schema: ZodTypeAny,
  identity: unknown,
): unknown | undefined {
  return upsertMap.get(schema)?.get(identity);
}

/**
 * Write path: record the `(schema, identity → result)` mapping. Lazily creates
 * the inner `Map` on first sight of the schema. Mirrors the write site in
 * `generateWithSourceOverride`.
 */
export function setDerivedUpsert(
  upsertMap: DerivedUpsertMap,
  schema: ZodTypeAny,
  identity: unknown,
  result: unknown,
): void {
  let inner = upsertMap.get(schema);
  if (!inner) {
    inner = new Map<unknown, unknown>();
    upsertMap.set(schema, inner);
  }
  inner.set(identity, result);
}
