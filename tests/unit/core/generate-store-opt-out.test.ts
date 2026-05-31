/**
 * Unit tests for `world.generate(schema, { store: false })` — ephemeral
 * registry-write opt-out on `GenerateOptions` (B10).
 *
 * Written test-first against the spec
 * (wiki/specs/B10-generate-store-opt-out.md). Today the `GenerateOptions`
 * interface has **no** `store` field; the literal `{ store: false }` at every
 * call site below therefore fails `pnpm typecheck` (TS2353 — excess property)
 * AND every runtime assertion that relies on the store-suppression behaviour
 * fails because `world.generate` always writes to the registry today.
 *
 * Per requirement:
 *  - B10-R1: type-checks must compile after the field lands. Today FAIL at
 *    `pnpm typecheck`.
 *  - B10-R2: `store: false` suppresses the registry write for registered
 *    primary AND derived schemas. Today FAIL at runtime (registry inflated).
 *  - B10-R3: default / explicit `store: true` is byte-equivalent to today
 *    (regression guard — PASSES today; pins the contract once `store` lands).
 *  - B10-R4: nested propagation — outer `{ store: false }` propagates through
 *    inner registered schemas (search-bucket envelope; relation
 *    auto-provisioning). Today FAIL.
 *  - B10-R5: `world.get` is unaffected by any `store: false` notion — its
 *    create path always stores (B6-R3, B6-R7) and remains idempotent.
 *    PASSES today and pins the contract going forward.
 *  - B10-R6: `world.populate`'s factory return MAY include `store: false`,
 *    which `populate` MUST silently ignore (still write). Today FAIL at
 *    `pnpm typecheck` (no such field on `GenerateOptions`) AND at runtime
 *    (count guard would still pass, but the missing field makes the test
 *    unwriteable without the new option).
 *  - B10-R7: determinism preserved — `store: false` does not consume PRNG.
 *    Today FAIL at `pnpm typecheck` (no such field) — once the field lands,
 *    this pins that the side-effect suppression is *only* the registry write.
 *  - B10-R8: docs — verified by reviewer in docs/api-reference.md; no test
 *    here.
 *
 * No `any`, no casts (per architecture Rules D1; spec B10-R1).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

const SourceSchema = z.object({
  id: z.uuid(),
});

const DerivedSchema = z.object({
  id: z.uuid(),
  tag: z.string(),
});

const SearchBucketSchema = z.object({
  total: z.number().int(),
  content: z.array(ItemSchema).length(10),
});

const OwnerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

const FileSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
});

const ProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
});

const UserSchema = z.object({
  id: z.uuid(),
  username: z.string(),
});

const USER_PROFILES = [
  { username: "admin" },
  { username: "editor" },
  { username: "viewer" },
] as const;

// ---------------------------------------------------------------------------
// B10-R1: `GenerateOptions` gains an optional `store?: boolean` flag
// ---------------------------------------------------------------------------

describe("B10-R1: GenerateOptions.store is an optional boolean", () => {
  it("B10-R1 / option type-checks with no cast and no any", () => {
    // The call below MUST type-check after B10 lands. Today the literal
    // `{ store: false }` is an excess property on `GenerateOptions` and
    // `pnpm typecheck` fails with TS2353 — that is the desired RED state
    // (feature missing) and the failure traces directly to the missing
    // `store?: boolean` field. No cast, no `any`.
    const world = createWorld({ seed: 1 }).withSchema(ItemSchema);
    const result = world.generate(ItemSchema, { store: false });

    // Runtime sanity: the return value is still the schema's output type.
    expect(ItemSchema.safeParse(result).success).toBe(true);
  });

  it("B10-R1 / no new method is added (only the option)", () => {
    // B10-R1 explicitly rules out a `world.preview` (or similar) method.
    // The only opt-out is `{ store: false }` on `GenerateOptions`.
    const world = createWorld({ seed: 1 }).withSchema(ItemSchema);

    // A consumer attempting `world.preview(...)` must fail — there is no
    // such property on the `World` interface. We assert the absence at
    // runtime here; the structural-typing guarantee is enforced by
    // `pnpm typecheck` on the public `World` interface.
    expect("preview" in world).toBe(false);
    expect("generateNoStore" in world).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B10-R2: `store: false` suppresses the registry write at the top-level call
// ---------------------------------------------------------------------------

describe("B10-R2: store: false suppresses the registry write", () => {
  it("B10-R2 / registered primary — registry count unchanged after store: false", () => {
    const world = createWorld({ seed: 1 }).withSchema(ItemSchema);

    const before = world.registry.count(ItemSchema);
    const r = world.generate(ItemSchema, { store: false });
    const after = world.registry.count(ItemSchema);

    // No registry write occurred.
    expect(after).toBe(before);
    // Returned record is schema-valid.
    expect(ItemSchema.safeParse(r).success).toBe(true);
    // The returned record is NOT in the registry — D8's stored-equals-returned
    // contract is vacuous here because nothing was stored.
    const found = world.registry.find(ItemSchema, (x) => x.id === r.id);
    expect(found).toBeUndefined();
  });

  it("B10-R2 / registered derived — registry count unchanged after store: false", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(SourceSchema)
      .withSchema(DerivedSchema, {
        from: SourceSchema,
        matchers: { id: (ctx) => ctx.source.id },
      })
      .populate(SourceSchema, 1);

    const before = world.registry.count(DerivedSchema);
    world.generate(DerivedSchema, { store: false });
    const after = world.registry.count(DerivedSchema);

    // No derived-record write occurred.
    expect(after).toBe(before);
  });

  it("B10-R2 / matchers and overrides still apply under store: false", () => {
    const world = createWorld({ seed: 1 }).withSchema(ItemSchema, {
      matchers: { name: () => "matched" },
    });

    const r = world.generate(ItemSchema, {
      store: false,
      overrides: { name: "overridden" },
    });

    // Overrides win over matchers (same as store: true path).
    expect(r.name).toBe("overridden");
  });

  it("B10-R2 / transform still applies under store: false", () => {
    const world = createWorld({ seed: 1 }).withSchema(ItemSchema);

    const before = world.registry.count(ItemSchema);
    const r = world.generate(ItemSchema, {
      store: false,
      transform: (item) => ({ ...item, name: "T" }),
    });
    const after = world.registry.count(ItemSchema);

    expect(r.name).toBe("T");
    // Transform applied; registry unchanged.
    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// B10-R3: default (omitted) or `store: true` is byte-equivalent to today
// ---------------------------------------------------------------------------

describe("B10-R3: default or explicit store: true is byte-equivalent", () => {
  it("B10-R3 / omitted store — registry written and stored value deep-equals return", () => {
    const world = createWorld({ seed: 1 }).withSchema(ItemSchema);
    const r = world.generate(ItemSchema);

    expect(world.registry.count(ItemSchema)).toBe(1);
    // D8: stored equals returned.
    expect(world.registry.all(ItemSchema)[0]).toEqual(r);
  });

  it("B10-R3 / explicit store: true byte-equivalent to omitted", () => {
    // Two worlds, same seed: one omits `store`, the other passes `store: true`.
    // The returned record AND the registry state must be byte-identical.
    const worldOmitted = createWorld({ seed: 1 }).withSchema(ItemSchema);
    const worldExplicit = createWorld({ seed: 1 }).withSchema(ItemSchema);

    const a = worldOmitted.generate(ItemSchema);
    const b = worldExplicit.generate(ItemSchema, { store: true });

    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(JSON.stringify(worldOmitted.registry.all(ItemSchema))).toEqual(
      JSON.stringify(worldExplicit.registry.all(ItemSchema)),
    );
    expect(worldOmitted.registry.count(ItemSchema)).toBe(1);
    expect(worldExplicit.registry.count(ItemSchema)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B10-R4: nested generation propagates `store: false` through the recursion
// ---------------------------------------------------------------------------

describe("B10-R4: store: false propagates through nested generation", () => {
  it("B10-R4 / outer search-bucket — inner registered ItemSchema not stored", () => {
    const world = createWorld({ seed: 1 }).withSchema(ItemSchema).withSchema(SearchBucketSchema);

    expect(world.registry.count(ItemSchema)).toBe(0);
    const before = world.registry.count(ItemSchema);

    const bucket = world.generate(SearchBucketSchema, { store: false });
    const after = world.registry.count(ItemSchema);

    // The 10 inner ItemSchema records did NOT inflate the registry.
    expect(after).toBe(before);
    expect(after).toBe(0);
    // Bucket envelope is well-formed.
    expect(bucket.content).toHaveLength(10);
    for (const item of bucket.content) {
      expect(ItemSchema.safeParse(item).success).toBe(true);
    }
    // The bucket itself is also not stored.
    expect(world.registry.count(SearchBucketSchema)).toBe(0);
  });

  it("B10-R4 / relation auto-provisioning beneath store: false does not write", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(OwnerSchema)
      .withSchema(FileSchema, {
        relations: { owner: OwnerSchema },
        matchers: { ownerId: (ctx) => ctx.related("owner").id },
      });

    expect(world.registry.count(FileSchema)).toBe(0);
    expect(world.registry.count(OwnerSchema)).toBe(0);

    world.generate(FileSchema, { store: false });

    // Neither the file nor the auto-provisioned owner was written.
    expect(world.registry.count(FileSchema)).toBe(0);
    expect(world.registry.count(OwnerSchema)).toBe(0);
  });

  it("B10-R4 / propagation is scoped to one call — subsequent default generate still writes", () => {
    const world = createWorld({ seed: 1 }).withSchema(ItemSchema).withSchema(SearchBucketSchema);

    world.generate(SearchBucketSchema, { store: false });
    // Empty after the no-store call.
    expect(world.registry.count(ItemSchema)).toBe(0);

    // A subsequent default-mode generate writes normally (scope is the outer call).
    world.generate(ItemSchema);
    expect(world.registry.count(ItemSchema)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B10-R5: `world.get`'s create path is NOT affected by store: false
//
// `world.get` does not accept `GenerateOptions` today (its signature is
// `get(schema, predicate?)`). The spec resolves this by REQUIRING `get`'s
// implementation to construct its internal `GenerateOptions` with
// `store: true`, defeating any inherited or accidental `store: false`. With
// no consumer-visible `store: false` entry point to `get`, the observable
// requirement reduces to: `get`'s create path always stores and remains
// idempotent (B6-R3, B6-R7). These tests pin that invariant under B10.
// ---------------------------------------------------------------------------

describe("B10-R5: world.get create path always stores and is idempotent under B10", () => {
  it("B10-R5 / create path writes regardless of any caller intent", () => {
    const world = createWorld({ seed: 1 }).withSchema(ProductSchema);

    const before = world.registry.count(ProductSchema);
    const created = world.get(ProductSchema, { sku: "WIDGET-42" });

    // Create-path write performed (B6-R3 / D8).
    expect(world.registry.count(ProductSchema)).toBe(before + 1);
    // Discoverable by a subsequent find.
    const found = world.registry.find(ProductSchema, (p) => p.sku === "WIDGET-42");
    expect(found).toBe(created);
  });

  it("B10-R5 / world.get is idempotent — second call hits the find path", () => {
    const world = createWorld({ seed: 1 }).withSchema(ProductSchema);

    const a = world.get(ProductSchema, { sku: "ONCE" });
    const b = world.get(ProductSchema, { sku: "ONCE" });

    // Same instance — B6-R7 idempotence holds under B10.
    expect(a).toBe(b);
    expect(world.registry.count(ProductSchema)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B10-R6: `world.populate`'s factory cannot suppress storage
// ---------------------------------------------------------------------------

describe("B10-R6: populate ignores a factory's store: false", () => {
  it("B10-R6 / factory store: false ignored — all records stored", () => {
    const world = createWorld({ seed: 42 }).withSchema(UserSchema);

    world.populate(UserSchema, USER_PROFILES.length, (i) => ({
      store: false,
      overrides: { username: USER_PROFILES[i]!.username },
    }));

    // `store: false` was effectively a no-op on populate's path.
    expect(world.registry.count(UserSchema)).toBe(3);
    expect(world.registry.all(UserSchema).map((u) => u.username)).toEqual([
      "admin",
      "editor",
      "viewer",
    ]);
  });

  it("B10-R6 / factory store: true works identically (regression on B14)", () => {
    const world = createWorld({ seed: 42 }).withSchema(UserSchema);

    world.populate(UserSchema, USER_PROFILES.length, (i) => ({
      store: true,
      overrides: { username: USER_PROFILES[i]!.username },
    }));

    expect(world.registry.count(UserSchema)).toBe(3);
    expect(world.registry.all(UserSchema).map((u) => u.username)).toEqual([
      "admin",
      "editor",
      "viewer",
    ]);
  });
});

// ---------------------------------------------------------------------------
// B10-R7: determinism preserved — store: false does not consume PRNG
// ---------------------------------------------------------------------------

describe("B10-R7: store: false does not change generation order or PRNG consumption", () => {
  it("B10-R7 / same seed → byte-identical return value with vs. without store: false", () => {
    const worldA = createWorld({ seed: 42 }).withSchema(ItemSchema);
    const worldB = createWorld({ seed: 42 }).withSchema(ItemSchema);

    const a = worldA.generate(ItemSchema);
    const b = worldB.generate(ItemSchema, { store: false });

    // Field values identical; only the registry side effect differs.
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("B10-R7 / subsequent calls remain in lockstep across the two worlds", () => {
    // Note: worldA's first call stored; worldB's first call did not. For the
    // PRNG to stay in lockstep, the storage side-effect must not consume any
    // PRNG. To compare values on schemas that re-use the registry (e.g. via
    // relations/`from`), the stored-vs-not state would matter; here we use a
    // schema with no relations so the second-call value depends only on the
    // parent PRNG sequence — which must be the same.
    const worldA = createWorld({ seed: 42 }).withSchema(ItemSchema);
    const worldB = createWorld({ seed: 42 }).withSchema(ItemSchema);

    worldA.generate(ItemSchema);
    worldB.generate(ItemSchema, { store: false });

    // Second call: in worldA the registry has 1 item (primary mode would
    // re-yield it). To avoid the registry-reuse pathway and isolate "PRNG
    // consumption", we ask for an *unregistered* schema on the second call so
    // both worlds fall into the ad-hoc branch driven purely by the parent
    // PRNG counter. If `store: false` had consumed a PRNG draw, worldB's
    // value here would diverge from worldA's.
    const AdHocSchema = z.object({ x: z.number().int() });
    const a2 = worldA.generate(AdHocSchema);
    const b2 = worldB.generate(AdHocSchema);

    expect(JSON.stringify(a2)).toEqual(JSON.stringify(b2));
  });
});

// ---------------------------------------------------------------------------
// B10-R8: docs update — verified by reviewer in docs/api-reference.md.
// (No test here; this comment exists so every requirement ID is accounted for.)
// ---------------------------------------------------------------------------
