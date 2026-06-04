/**
 * B62 — focused unit tests for the `RelationResolver` collaborator
 * extracted from `WorldImpl`. These tests exercise the class via its
 * narrowed deps surface (registry + relationPools + findPrimaryReg +
 * generateAndStorePrimary callback + isStoreActive getter), independent of
 * the full `WorldImpl` plumbing. The integration-level relation contract
 * (B10/B11 store-off, where-filter, self-ref, deep chains) is covered by
 * `tests/unit/core/relations.test.ts` and the integration suite — these
 * tests assert the per-method invariants the extraction MUST preserve.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import type { ZodTypeAny } from "zod";

import { RelationResolver } from "../../src/world/relations.js";
import { SchemaRegistry } from "../../src/registry.js";
import { createPrng } from "../../src/prng.js";
import type { SchemaReg } from "../../src/world/registration.js";

// ---------------------------------------------------------------------------
// Test helpers — minimal fixture builder that mirrors the production deps
// surface without spinning up a full World.
// ---------------------------------------------------------------------------

function makeReg(schema: ZodTypeAny, relations: SchemaReg["relations"]): SchemaReg {
  return {
    schema,
    from: null,
    sourceKey: null,
    relations,
    matchers: {},
    regId: 0,
  };
}

interface Fixture {
  resolver: RelationResolver;
  registry: SchemaRegistry;
  relationPools: Map<string, unknown[]>;
  recordPrng: ReturnType<typeof createPrng>;
  generateCalls: { schema: ZodTypeAny; reg: SchemaReg | null }[];
}

function makeFixture(opts?: {
  registerPrimaryFor?: ZodTypeAny;
  primaryReg?: SchemaReg | null;
  storeActive?: boolean;
  factory?: (schema: ZodTypeAny) => unknown;
}): Fixture {
  const registry = new SchemaRegistry(createPrng(1));
  const relationPools = new Map<string, unknown[]>();
  const generateCalls: { schema: ZodTypeAny; reg: SchemaReg | null }[] = [];
  const factory =
    opts?.factory ?? ((_s: ZodTypeAny): unknown => ({ id: `auto-${generateCalls.length}` }));
  const isStoreActive = opts?.storeActive ?? true;
  const primaryReg = opts?.primaryReg ?? null;
  const registerPrimaryFor = opts?.registerPrimaryFor;

  const resolver = new RelationResolver({
    registry,
    // B97-R15: the production `WorldImpl` lazily allocates relation pools.
    // The fixture pre-allocates `relationPools` so the test's identity
    // assertions on the cache map still work; the resolver fetches it
    // lazily via the deps callback.
    getRelationPools: () => relationPools,
    findPrimaryReg: (schema) =>
      registerPrimaryFor !== undefined && schema === registerPrimaryFor ? primaryReg : null,
    generateAndStorePrimary: (schema, reg) => {
      generateCalls.push({ schema, reg });
      const value = factory(schema);
      if (isStoreActive) registry.store(schema, value);
      return value;
    },
    isStoreActive: () => isStoreActive,
  });

  return {
    resolver,
    registry,
    relationPools,
    recordPrng: createPrng(123),
    generateCalls,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RelationResolver (B62)", () => {
  const PersonSchema = z.object({ personId: z.uuid() });
  const FileSchema = z.object({ fileId: z.uuid(), ownerId: z.uuid() });

  it("constructs with the deps surface and exposes the four entangled methods", () => {
    // Construction MUST accept the deps surface and produce an instance whose
    // four methods are callable. This is the basic contract that `WorldImpl`
    // now relies on — no method has accidentally moved or been renamed.
    const { resolver } = makeFixture();
    expect(typeof resolver.resolveRelated).toBe("function");
    expect(typeof resolver.resolveRelatedMany).toBe("function");
    expect(typeof resolver.resolveRelationPool).toBe("function");
    expect(typeof resolver.ensurePrimaryRecord).toBe("function");
  });

  it("resolveRelationPool returns the pre-populated registry entries (no auto-provision when non-empty)", () => {
    // The hot path: when the registry already has records for the relation
    // schema, `resolveRelationPool` MUST snapshot them into the pool and
    // MUST NOT call `generateAndStorePrimary`.
    const fx = makeFixture();
    fx.registry.store(PersonSchema, { personId: "p1" });
    fx.registry.store(PersonSchema, { personId: "p2" });
    const reg = makeReg(FileSchema, { owner: { schema: PersonSchema, where: null } });

    const { items } = fx.resolver.resolveRelationPool(
      reg,
      fx.recordPrng,
      "file#0",
      "owner",
      "single",
    );

    expect(items).toHaveLength(2);
    expect(fx.generateCalls).toHaveLength(0);
  });

  it("resolveRelated is stable for the same (recordId, relName) — repeated calls return the same record", () => {
    // Per-record snapshot invariant (B11-R3 / B11-R4 / B11-R7 + D4/D10): the
    // same record reading the same relation twice MUST get the same pick.
    const fx = makeFixture();
    for (let i = 0; i < 5; i++) fx.registry.store(PersonSchema, { personId: `p${i}` });
    const reg = makeReg(FileSchema, { owner: { schema: PersonSchema, where: null } });

    const a = fx.resolver.resolveRelated<{ personId: string }>(
      reg,
      fx.recordPrng,
      "file#0",
      "owner",
    );
    const b = fx.resolver.resolveRelated<{ personId: string }>(
      reg,
      fx.recordPrng,
      "file#0",
      "owner",
    );

    expect(a.personId).toBe(b.personId);
  });

  it("resolveRelatedMany picks `count` distinct registry records (sampling without replacement)", () => {
    // B5: many MUST sample without replacement so the returned record set
    // contains N distinct entries (when the pool is large enough).
    const fx = makeFixture();
    for (let i = 0; i < 10; i++) fx.registry.store(PersonSchema, { personId: `p${i}` });
    const reg = makeReg(FileSchema, { owner: { schema: PersonSchema, where: null } });

    const picks = fx.resolver.resolveRelatedMany<{ personId: string }>(
      reg,
      fx.recordPrng,
      "file#0",
      "owner",
      4,
    );

    expect(picks).toHaveLength(4);
    expect(new Set(picks.map((p) => p.personId)).size).toBe(4);
  });

  it("self-referential single-relation does NOT auto-provision (cannot recurse)", () => {
    // Self-ref guard: the relation schema equals the registering schema. The
    // single-path MUST NOT call `generateAndStorePrimary` (would recurse) — it
    // caches the empty pool and returns it. The matcher handles the empty case.
    const fx = makeFixture();
    const reg = makeReg(PersonSchema, { parent: { schema: PersonSchema, where: null } });

    const { items } = fx.resolver.resolveRelationPool(
      reg,
      fx.recordPrng,
      "person#0",
      "parent",
      "single",
    );

    expect(items).toEqual([]);
    expect(fx.generateCalls).toHaveLength(0);
  });
});
