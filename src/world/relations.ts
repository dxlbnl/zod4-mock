import type { ZodTypeAny } from "zod";
import type { Prng, Registry } from "../types.js";
import type { createPrng } from "../prng.js";
import type { SchemaReg } from "./registration.js";

export type RelationCacheKind = "single" | "many";

// Single and many paths use disjoint cache keys so reading the same relation
// through both APIs gets independent snapshots.
export function relationCacheKey(
  recordId: string,
  relName: string,
  kind: RelationCacheKind,
): string {
  return kind === "many" ? `${recordId}:${relName}:many` : `${recordId}:${relName}`;
}

// The rel-many: prefix keeps the many fork independent of the single rel: fork.
export function relationForkKey(relName: string, kind: RelationCacheKind): string {
  return kind === "many" ? `rel-many:${relName}` : `rel:${relName}`;
}

export function relationEmptyPoolMessage(relName: string): string {
  return (
    `No related '${relName}' matches the \`where\` predicate. ` +
    `Pre-populate the registry with records satisfying the predicate, or relax the predicate.`
  );
}

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

export interface RelationResolverDeps {
  readonly registry: Registry;
  getRelationPools(): Map<string, unknown[]>;
  findPrimaryReg(schema: ZodTypeAny): SchemaReg | null;
  generateAndStorePrimary(schema: ZodTypeAny, reg: SchemaReg | null): unknown;
  // A function (not a boolean) because effectiveStore mutates per outer generate call.
  isStoreActive(): boolean;
}

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

    const relationPools = this.deps.getRelationPools();
    const cacheKey = relationCacheKey(recordId, relName, kind);
    let items = relationPools.get(cacheKey);

    if (!items) {
      if (kind === "single") {
        if (this.deps.registry.count(relSchema) === 0) {
          // A self-referential relation must NOT auto-provision — generating a
          // record would re-enter this matcher with the registry still empty and
          // recurse forever; later records reference earlier-stored ones instead.
          if (isSelfRef) {
            relationPools.set(cacheKey, []);
            items = [];
          } else {
            const provisioned = this.ensurePrimaryRecord(relSchema);
            // Under store:false the provisioned record wasn't written — use the
            // in-memory value directly so the matcher still sees a related instance.
            if (!this.deps.isStoreActive() && provisioned !== undefined) {
              items = [provisioned];
            }
          }
        }
      } else {
        // Auto-provision the shortfall up to `count`, except for self-ref (recurses)
        // or `where` (auto-provision can't guarantee the predicate — throw below).
        const want = count ?? 0;
        if (!isSelfRef && !where) {
          const relReg = this.deps.findPrimaryReg(relSchema);
          if (!this.deps.isStoreActive()) {
            // store:false: collect provisioned records into the pool directly.
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
      // Filter before caching so cache hits don't re-evaluate the predicate.
      if (where) {
        items = items.filter((it) => where(it));
      }
      // Throw before the PRNG fork so no PRNG state is consumed.
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

    // Per-relation fork so all fields in one record pick the same related entity/set.
    const prng = recordPrng.fork(relationForkKey(relName, kind));
    return { items, prng };
  }

  ensurePrimaryRecord(schema: ZodTypeAny): unknown | undefined {
    if (this.deps.registry.count(schema) > 0) return undefined;
    const reg = this.deps.findPrimaryReg(schema);
    return this.deps.generateAndStorePrimary(schema, reg);
  }
}
