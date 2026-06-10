/**
 * @module world/relations
 *
 * Relation resolution — both the pure cache-key/fork-key/error-message helpers
 * and the stateful `RelationResolver` collaborator
 * that owns the per-record relation pool cache and the
 * resolve-single / resolve-many / ensure-primary pipeline.
 *
 * What lives here:
 *   - `RelationCacheKind` — the "single" vs "many" tag used as a discriminator
 *     in the shared `resolveRelationPool`.
 *   - `relationCacheKey(...)` — the cache-key string builder; the `":many"`
 *     suffix on the many path keeps it disjoint from the single path
 *     (both caches are scoped per record).
 *   - `relationForkKey(...)` — the per-relation PRNG fork-key builder
 *     (byte-identical fork-key shape; the `rel-many:` prefix on the
 *     many path keeps its fork independent of the single path's `rel:` fork).
 *   - `relationEmptyPoolMessage(...)` / `relationShortPoolMessage(...)` — the
 *     error messages thrown when a `where`-filtered pool is empty or
 *     undersupplied.
 *   - `RelationResolver` — collaborator class owning `relationPools`,
 *     constructed with the world's registry, primary-reg lookup, a
 *     `generateAndStorePrimary` callback, and an `isStoreActive` getter.
 *     Hosts the four entangled methods that previously lived on `WorldImpl`:
 *     `resolveRelated`, `resolveRelatedMany`, `resolveRelationPool`,
 *     `ensurePrimaryRecord`. Module-private collaborator — `WorldImpl` remains
 *     the public face.
 */

import type { ZodTypeAny } from "zod";
import type { Prng, Registry } from "../types.js";
import type { createPrng } from "../prng.js";
import type { SchemaReg } from "./registration.js";

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
 * `rel:` fork — byte-identical fork-key shape.
 */
export function relationForkKey(relName: string, kind: RelationCacheKind): string {
  return kind === "many" ? `rel-many:${relName}` : `rel:${relName}`;
}

/**
 * Error thrown when the `where`-filtered pool is empty on the single
 * path. Surfaced before any PRNG fork is taken so no state is consumed.
 */
export function relationEmptyPoolMessage(relName: string): string {
  return (
    `No related '${relName}' matches the \`where\` predicate. ` +
    `Pre-populate the registry with records satisfying the predicate, or relax the predicate.`
  );
}

/**
 * Error thrown when the `where`-filtered pool is undersupplied on
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

// ---------------------------------------------------------------------------
// RelationResolver
// ---------------------------------------------------------------------------

/**
 * Collaborator surface the `RelationResolver` needs from `WorldImpl`. The
 * registry and the relation pool cache it owns directly; the schema-registry
 * lookups (`findPrimaryReg`), the primary-record generator
 * (`generateAndStorePrimary`), and the live `effectiveStore` mode are exposed
 * as callbacks so the resolver does not need to reach back into private
 * `WorldImpl` state. `isStoreActive` is a function (not a boolean) because
 * `effectiveStore` mutates per outer `generate` call.
 */
export interface RelationResolverDeps {
  readonly registry: Registry;
  /**
   * Lazy accessor for the relation pool cache. The
   * `WorldImpl`-side helper allocates the map on first call and returns it;
   * a world that never resolves a relation never triggers allocation.
   */
  getRelationPools(): Map<string, unknown[]>;
  findPrimaryReg(schema: ZodTypeAny): SchemaReg | null;
  generateAndStorePrimary(schema: ZodTypeAny, reg: SchemaReg | null): unknown;
  isStoreActive(): boolean;
}

/**
 * Owns the per-record relation pool cache and the four entangled methods
 * extracted from `WorldImpl` (`resolveRelated`, `resolveRelatedMany`,
 * `resolveRelationPool`, `ensurePrimaryRecord`). Behaviour-neutral with respect
 * to the previous in-engine implementation; collaborator surface narrowed to
 * the minimum the methods need so the class is independently unit-testable.
 */
export class RelationResolver {
  constructor(private readonly deps: RelationResolverDeps) {}

  resolveRelated<T = Record<string, unknown>>(
    reg: SchemaReg,
    recordPrng: ReturnType<typeof createPrng>,
    recordId: string,
    relName: string,
  ): T {
    const { items, prng } = this.resolveRelationPool(reg, recordPrng, recordId, relName, "single");
    if (items.length === 0) return undefined as T;
    const pickedIdx = prng.int(0, items.length - 1);
    return items[pickedIdx]! as T;
  }

  resolveRelatedMany<T = unknown>(
    reg: SchemaReg,
    recordPrng: ReturnType<typeof createPrng>,
    recordId: string,
    relName: string,
    count: number,
  ): T[] {
    const { items, prng } = this.resolveRelationPool(
      reg,
      recordPrng,
      recordId,
      relName,
      "many",
      count,
    );
    return prng.sample(items, count) as T[];
  }

  /**
   * Shared snapshot+fork pipeline for `ctx.related` (kind="single") and
   * `ctx.related.many` (kind="many"). Builds the per-record candidate pool —
   * applying `where` once before caching — and
   * returns it alongside a per-relation PRNG fork.
   *
   * Diverges by `kind`:
   * - cache key suffix (`""` vs `":many"`),
   * - auto-provision: single calls `ensurePrimaryRecord` when the registry is
   *   empty; many runs an explicit shortfall loop up to `count` (and skips
   *   under `where`, since auto-provision cannot guarantee the predicate),
   * - PRNG fork key (`rel:<name>` vs `rel-many:<name>`),
   * - empty-pool throw threshold (`< 1` vs `< count`).
   *
   * Self-referential relations are exempt from auto-provision (would recurse)
   * and from the empty-pool throw; callers handle the empty
   * pool themselves.
   */
  resolveRelationPool(
    reg: SchemaReg,
    recordPrng: ReturnType<typeof createPrng>,
    recordId: string,
    relName: string,
    kind: RelationCacheKind,
    count?: number,
  ): { items: unknown[]; prng: Prng } {
    const rel = reg.relations[relName];
    if (!rel) {
      throw new Error(
        `Relation '${relName}' is not defined. Declare it in the relations option of withSchema().`,
      );
    }
    const relSchema = rel.schema;
    const where = rel.where;
    const isSelfRef = relSchema === reg.schema;

    // The relation-pool map is lazily allocated. Resolving any
    // relation triggers allocation; worlds without relations never pay.
    const relationPools = this.deps.getRelationPools();
    const cacheKey = relationCacheKey(recordId, relName, kind);
    let items = relationPools.get(cacheKey);

    if (!items) {
      if (kind === "single") {
        if (this.deps.registry.count(relSchema) === 0) {
          // A self-referential relation (the schema relates to itself, e.g. a
          // category whose parent is another category) must NOT auto-provision:
          // generating a new record would re-enter this matcher with the
          // registry still empty and recurse forever. Instead the first record
          // simply has no related instance yet — later records reference the
          // earlier ones already stored. The matcher handles the empty case
          // (e.g. `ctx.related("parent")?.id ?? null`).
          if (isSelfRef) {
            relationPools.set(cacheKey, []);
            items = [];
          } else {
            const provisioned = this.ensurePrimaryRecord(relSchema);
            // When the outer call opted out of storage, the
            // auto-provisioned record was NOT written to the registry. Use
            // the in-memory value directly so the matcher still sees a
            // related instance.
            if (!this.deps.isStoreActive() && provisioned !== undefined) {
              items = [provisioned];
            }
          }
        }
      } else {
        // kind === "many": auto-provision the shortfall until at least `count`
        // records exist — except for self-referential relations (would recurse,
        // see the single guard above). Under `where`, auto-provision cannot
        // guarantee the predicate is satisfied — we do not attempt to
        // coax matchers into producing predicate-satisfying records; if the
        // filtered pool falls short, we throw below.
        const want = count ?? 0;
        if (!isSelfRef && !where) {
          const relReg = this.deps.findPrimaryReg(relSchema);
          if (!this.deps.isStoreActive()) {
            // Under `store: false`, the registry is not written;
            // collect provisioned records directly into the pool so the
            // matcher still sees them.
            const pool: unknown[] = [...this.deps.registry.all(relSchema)];
            while (pool.length < want) {
              const provisioned = this.deps.generateAndStorePrimary(relSchema, relReg);
              pool.push(provisioned);
            }
            items = pool;
          } else {
            while (this.deps.registry.count(relSchema) < want) {
              this.deps.generateAndStorePrimary(relSchema, relReg);
            }
          }
        }
      }
      if (!items) {
        items = [...this.deps.registry.all(relSchema)];
      }
      // Apply `where` once, here, when building the
      // snapshot. Filtering before caching means subsequent cache hits do not
      // re-evaluate the predicate (cache neutrality).
      if (where) {
        items = items.filter((it) => where(it));
      }
      // Empty / undersupplied filtered pool throws for
      // non-self-referential relations. The throw happens before the PRNG fork
      // so no PRNG state is consumed.
      if (where && !isSelfRef) {
        if (kind === "single" && items.length === 0) {
          throw new Error(relationEmptyPoolMessage(relName));
        }
        if (kind === "many" && items.length < (count ?? 0)) {
          throw new Error(relationShortPoolMessage(relName, count ?? 0, items.length));
        }
      }
      relationPools.set(cacheKey, items);
    }

    // Derive a stable per-relation PRNG so all fields in one record pick the
    // same related entity (single) or set (many). The `rel-many:` prefix on
    // the many path keeps its fork independent of the single path's `rel:`
    // fork — byte-identical fork-key shape.
    const prng = recordPrng.fork(relationForkKey(relName, kind));
    return { items, prng };
  }

  ensurePrimaryRecord(schema: ZodTypeAny): unknown | undefined {
    if (this.deps.registry.count(schema) > 0) return undefined;
    const reg = this.deps.findPrimaryReg(schema);
    return this.deps.generateAndStorePrimary(schema, reg);
  }
}
