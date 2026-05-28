/**
 * Unit tests for B8 — derived-schema identity-preserving generation.
 *
 * Written test-first against the spec
 * (wiki/specs/B8-derived-schemas-identity.md). Today
 *   1. `world.generate(DerivedSchema, { source })` neither upserts by source
 *      identity nor stores derived records in the registry — it freshly
 *      generates and returns a new record every call.
 *   2. `GenerateOptions<T>` has no `unique?: boolean` field, so call sites
 *      that pass `{ unique: false }` are TS2353 (excess property) — that is
 *      the desired type-level RED for B8-R4.
 *   3. `SchemaOpts` has no `sourceKey?: keyof input<TSource>` field, so
 *      registration sites that pass `sourceKey: 'id'` are TS2353 — that is
 *      the desired type-level RED for B8-R5.
 *
 * Per requirement (R10 docs and R11 changeset are reviewer-verified — no
 * test here):
 *  - B8-R1: per-pair upsert by reference identity. Two `generate(D, { source })`
 *    calls return `a === b`; `registry.count(D) === 1`. RED today (no upsert,
 *    no store).
 *  - B8-R2: per-pair independence. UserProfile and UserSummary both
 *    `from: UserSchema` produce independent records for the same source. RED
 *    today (no store).
 *  - B8-R3: upsert persists across intervening work. RED today.
 *  - B8-R4: `{ unique: false }` bypasses the upsert. RED at typecheck (no
 *    `unique` field on `GenerateOptions`) and at runtime (registry growth
 *    expected after B8; today nothing is stored).
 *  - B8-R5: `sourceKey: 'id'` look-alike resolution. RED at typecheck (no
 *    `sourceKey` field on `SchemaOpts`) and at runtime.
 *  - B8-R6: D8 alignment — derived `transform` returns post-transform record
 *    AND the registry holds that same post-transform reference. RED today
 *    (no store).
 *  - B8-R7: `store: false` interaction — nothing stored, upsert map not
 *    updated; subsequent default-mode call generates fresh. RED today —
 *    today's default-mode call doesn't store, so the post-store-false
 *    default-mode call still leaves `count === 0`.
 *  - B8-R8: `world.get` untouched — predicate find-or-create stays the path,
 *    no upsert-map consult. PASSES-AS-GUARD today only because nothing is
 *    stored and `get` falls through to its own create path; the assertion
 *    that count remains 1 after the get call fails today (since the prior
 *    derive call didn't store).
 *  - B8-R9: determinism — upsert hit consumes no PRNG. Two worlds same seed,
 *    one with two derive calls (the second is an upsert hit); a subsequent
 *    PRNG-consuming primary generation must stay in lockstep. RED today
 *    (the second derive call freshly draws PRNG and shifts subsequent
 *    output).
 *
 * No `any`, no casts at the call sites that exercise B8's new types
 * (`unique`, `sourceKey`) — per architecture Rules D1 and per the spec.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const UserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
});

const UserProfileSchema = z.object({
  userId: z.uuid(),
  bio: z.string(),
});

const UserSummarySchema = z.object({
  userId: z.uuid(),
  title: z.string(),
});

// A separate registered (non-derived) schema used by B8-R8 — `world.get`
// must continue to drive predicate-based find-or-create over this schema's
// own registry bucket.
const ProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
});

// ---------------------------------------------------------------------------
// makeWorld — fresh world with the canonical B8 registrations
// ---------------------------------------------------------------------------

function makeWorld(seed = 42) {
  return createWorld({ seed })
    .withSchema(UserSchema)
    .withSchema(UserProfileSchema, {
      from: UserSchema,
      matchers: { userId: (ctx) => ctx.source.id },
    });
}

function makeWorldWithSummary(seed = 42) {
  return createWorld({ seed })
    .withSchema(UserSchema)
    .withSchema(UserProfileSchema, {
      from: UserSchema,
      matchers: { userId: (ctx) => ctx.source.id },
    })
    .withSchema(UserSummarySchema, {
      from: UserSchema,
      matchers: { userId: (ctx) => ctx.source.id },
    });
}

// ---------------------------------------------------------------------------
// B8-R1: per-(derivedSchema, source) upsert by default
// ---------------------------------------------------------------------------

describe("B8-R1: per-pair upsert keyed by source reference identity", () => {
  it("B8-R1 / same source ref -> same derived record (same instance, registry count 1)", () => {
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const a = world.generate(UserProfileSchema, { source: user });
    const b = world.generate(UserProfileSchema, { source: user });

    // Spec: a === b (reference equality on the returned derived record).
    expect(a).toBe(b);
    // Spec: registry holds exactly one derived record after the two calls.
    expect(world.registry.count(UserProfileSchema)).toBe(1);
    // Matcher's value is preserved on the upsert hit.
    expect(a.userId).toBe(user.id);
  });

  it("B8-R1 / upsert is observable in the registry (single element equals the returned ref)", () => {
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    world.generate(UserProfileSchema, { source: user });
    const second = world.generate(UserProfileSchema, { source: user });

    const stored = world.registry.all(UserProfileSchema);
    expect(stored).toHaveLength(1);
    // The single registry element is the very same reference both calls returned.
    expect(stored[0]).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// B8-R2: per-(derivedSchema, source) — independent records per derived schema
// ---------------------------------------------------------------------------

describe("B8-R2: independence across derived schemas from the same source", () => {
  it("B8-R2 / UserProfile and UserSummary from one user are two independent records", () => {
    const world = makeWorldWithSummary();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const profile = world.generate(UserProfileSchema, { source: user });
    const summary = world.generate(UserSummarySchema, { source: user });

    // Two different schemas -> two different records.
    expect(profile).not.toBe(summary);
    // Each derived bucket counts one.
    expect(world.registry.count(UserProfileSchema)).toBe(1);
    expect(world.registry.count(UserSummarySchema)).toBe(1);
    // Matchers were applied on both.
    expect(profile.userId).toBe(user.id);
    expect(summary.userId).toBe(user.id);
  });
});

// ---------------------------------------------------------------------------
// B8-R3: upsert map persists across intervening work
// ---------------------------------------------------------------------------

describe("B8-R3: upsert survives later unrelated work within the same world", () => {
  it("B8-R3 / a === b after intervening generate/populate calls; count stays at 1", () => {
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const a = world.generate(UserProfileSchema, { source: user });

    // Unrelated work in between (B8-R3 scenario).
    world.populate(UserSchema, 3);
    world.generate(z.array(UserSchema).length(2));

    const b = world.generate(UserProfileSchema, { source: user });

    // Same upsert entry hit; both the upsert map and the registry agree.
    expect(a).toBe(b);
    expect(world.registry.count(UserProfileSchema)).toBe(1);
    // The single stored record is the upsert entry (combined upsert+registry
    // assertion: today's `generate({source})` path doesn't write the
    // registry at all — this is the explicit registry side of the
    // map-vs-registry consistency that B8-R3 + D8 require).
    expect(world.registry.all(UserProfileSchema)[0]).toBe(a);
  });

  it("B8-R3 / separate worlds have separate upsert maps (no cross-world leakage)", () => {
    const worldA = makeWorld(42);
    const worldB = makeWorld(42);

    worldA.populate(UserSchema, 1);
    const userA = worldA.registry.pick(UserSchema);
    worldA.generate(UserProfileSchema, { source: userA });

    // worldB has done nothing on UserProfileSchema.
    expect(worldB.registry.count(UserProfileSchema)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B8-R4: { unique: false } opt-out
//
// Type-level RED: `GenerateOptions<T>` has no `unique?: boolean` field today,
// so the literal `{ source: user, unique: false }` is TS2353. No cast, no
// `any` — that is the prescribed RED for B8-R4.
// ---------------------------------------------------------------------------

describe("B8-R4: { unique: false } bypasses the upsert and creates a fresh record", () => {
  it("B8-R4 / unique: false yields two distinct records; registry grows by 2; matcher still runs", () => {
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const before = world.registry.count(UserProfileSchema);
    const a = world.generate(UserProfileSchema, { source: user, unique: false });
    const b = world.generate(UserProfileSchema, { source: user, unique: false });
    const after = world.registry.count(UserProfileSchema);

    // Two distinct records were produced.
    expect(a).not.toBe(b);
    // Registry grew by 2 — unique: false still writes (subject to B10's
    // independent store flag).
    expect(after - before).toBe(2);
    // Matcher applied on both records.
    expect(a.userId).toBe(user.id);
    expect(b.userId).toBe(user.id);
  });

  it("B8-R4 / unique: false does NOT pollute the upsert map for later default-mode calls", () => {
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const a = world.generate(UserProfileSchema, { source: user, unique: false });

    // First default-mode call after the unique: false call — must NOT
    // return the previous (ephemeral-to-the-map) record; must store a
    // fresh upsert entry.
    const afterUniqueFalse = world.registry.count(UserProfileSchema);
    const b = world.generate(UserProfileSchema, { source: user });
    const afterDefault = world.registry.count(UserProfileSchema);

    // A brand-new record was registered (count grew by 1).
    expect(afterDefault - afterUniqueFalse).toBe(1);
    // The default-mode call did NOT alias to the unique: false output.
    expect(b).not.toBe(a);

    // And a subsequent default-mode call returns the same instance as `b`
    // (B8-R1 upsert holds from the moment the default-mode call landed).
    const c = world.generate(UserProfileSchema, { source: user });
    expect(c).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// B8-R5: sourceKey for look-alike identity
//
// Type-level RED: `SchemaOpts` has no `sourceKey?: keyof input<TSource>` field
// today, so `withSchema(D, { from: S, sourceKey: 'id', ... })` is TS2353. No
// cast, no `any` — that is the prescribed RED for B8-R5.
// ---------------------------------------------------------------------------

describe("B8-R5: sourceKey resolves look-alike sources to the same derived record", () => {
  it("B8-R5 / sourceKey: 'id' — different source reference, same id -> same derived record", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(UserSchema)
      .withSchema(UserProfileSchema, {
        from: UserSchema,
        sourceKey: "id",
        matchers: { userId: (ctx) => ctx.source.id },
      });

    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const a = world.generate(UserProfileSchema, { source: user });

    // Reconstruct a look-alike — different reference, same `id`.
    const lookAlike = { ...user };
    expect(lookAlike).not.toBe(user);
    expect(lookAlike.id).toBe(user.id);

    const b = world.generate(UserProfileSchema, { source: lookAlike });

    // Identity is resolved via `id`, not reference.
    expect(a).toBe(b);
    expect(world.registry.count(UserProfileSchema)).toBe(1);
  });

  it("B8-R5 / no sourceKey -> a look-alike is a DIFFERENT identity (reference equality is the default)", () => {
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const a = world.generate(UserProfileSchema, { source: user });

    const lookAlike = { ...user };
    expect(lookAlike).not.toBe(user);

    const b = world.generate(UserProfileSchema, { source: lookAlike });

    // Default identity is reference equality — two different sources -> two records.
    expect(a).not.toBe(b);
    expect(world.registry.count(UserProfileSchema)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// B8-R6: D8 holds — stored record equals returned record, including transform
// ---------------------------------------------------------------------------

describe("B8-R6: D8 alignment — registry, upsert map, and return value are the same reference", () => {
  it("B8-R6 / transform-bearing derived call — registry holds the post-transform value", () => {
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const r = world.generate(UserProfileSchema, {
      source: user,
      transform: (p) => ({ ...p, bio: "T" }),
    });

    // Transform was applied to the return value.
    expect(r.bio).toBe("T");
    // Registry bucket has exactly the one post-transform record.
    expect(world.registry.all(UserProfileSchema)).toHaveLength(1);
    // The stored reference IS the returned reference (D8).
    expect(world.registry.all(UserProfileSchema)[0]).toBe(r);
  });

  it("B8-R6 / follow-up default-mode call returns the cached post-transform reference", () => {
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const first = world.generate(UserProfileSchema, {
      source: user,
      transform: (p) => ({ ...p, bio: "T" }),
    });

    // Follow-up: no transform argument; the upsert entry IS the prior
    // post-transform record.
    const second = world.generate(UserProfileSchema, { source: user });

    // Same reference — the upsert returned the cached entry; transform is
    // NOT re-run.
    expect(second).toBe(first);
    expect(second.bio).toBe("T");
    // Still exactly one record in the registry.
    expect(world.registry.count(UserProfileSchema)).toBe(1);
  });

  it("B8-R6 / non-idempotent transform applied exactly once (D8 regression)", () => {
    // Regression for the source-override branch double-applying
    // `options.overrides` + `options.transform` after
    // `generateDerivedRecord` already applied them. The existing
    // transform-bearing test used an idempotent transform
    // (`bio: "T"`) which hides the bug. A non-idempotent transform —
    // appending "!" to `bio` — exposes it: applying twice yields
    // "...!!" instead of "...!". D8 requires that the stored value
    // equal the returned value AND that `generate`'s transform is
    // applied exactly once.
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const r = world.generate(UserProfileSchema, {
      source: user,
      transform: (p) => ({ ...p, bio: `${p.bio}!` }),
    });

    // Transform applied exactly once: bio ends with a single "!".
    expect(r.bio.endsWith("!")).toBe(true);
    expect(r.bio.endsWith("!!")).toBe(false);

    // Registry holds exactly one record, and it IS the returned reference (D8).
    expect(world.registry.all(UserProfileSchema)).toHaveLength(1);
    expect(world.registry.all(UserProfileSchema)[0]).toBe(r);

    // A follow-up default-mode call MUST hit the upsert: same reference,
    // transform NOT re-applied. (If transform re-ran on the cache hit,
    // bio would gain a second "!"; the cache returns the original ref.)
    const second = world.generate(UserProfileSchema, { source: user });
    expect(second).toBe(r);
    expect(second.bio).toBe(r.bio);
    expect(world.registry.count(UserProfileSchema)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B8-R7: store: false interaction — upsert lookup AND write both suppressed
// ---------------------------------------------------------------------------

describe("B8-R7: store: false suppresses both the upsert lookup and the upsert write", () => {
  it("B8-R7 / store: false derived calls are fresh; nothing written; default-mode then stores fresh", () => {
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    // Upsert map is empty for UserProfileSchema at this point.
    const a = world.generate(UserProfileSchema, { source: user, store: false });
    const b = world.generate(UserProfileSchema, { source: user, store: false });

    // Each store: false call is fresh.
    expect(a).not.toBe(b);
    // Returns are valid records (B10-R2 invariants preserved).
    expect(UserProfileSchema.safeParse(a).success).toBe(true);
    expect(UserProfileSchema.safeParse(b).success).toBe(true);
    // No writes happened (B10-R2 — already enforced; B8 inherits it).
    expect(world.registry.count(UserProfileSchema)).toBe(0);

    // A subsequent default-mode call MUST run generation freshly (no
    // upsert hit on a phantom entry) and MUST store the fresh record.
    const c = world.generate(UserProfileSchema, { source: user });
    expect(world.registry.count(UserProfileSchema)).toBe(1);
    expect(c).not.toBe(a);
    expect(c).not.toBe(b);
  });

  it("B8-R7 / existing upsert entry is NOT returned by a store: false call (upsert lookup skipped)", () => {
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    // Populate the upsert map via a default-mode call.
    const a = world.generate(UserProfileSchema, { source: user });
    expect(world.registry.count(UserProfileSchema)).toBe(1);

    // A store: false call MUST bypass the upsert lookup — must NOT return `a`.
    const b = world.generate(UserProfileSchema, { source: user, store: false });
    expect(b).not.toBe(a);
    // The store: false call did not write to the registry — count is still 1.
    expect(world.registry.count(UserProfileSchema)).toBe(1);

    // The upsert entry is intact — a subsequent default-mode call returns `a`.
    const c = world.generate(UserProfileSchema, { source: user });
    expect(c).toBe(a);
    expect(world.registry.count(UserProfileSchema)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B8-R8: world.get is untouched — predicate path stays the predicate path
// ---------------------------------------------------------------------------

describe("B8-R8: world.get does not consult or write the B8 upsert map", () => {
  it("B8-R8 / non-derived registered schema: world.get continues to find-or-create over the registry", () => {
    // `world.get` is a predicate-based find-or-create primitive (B6 / B10-R5).
    // B8 must not change its behaviour on registered (non-derived) schemas.
    const world = createWorld({ seed: 1 }).withSchema(ProductSchema);

    // First call: no match -> create + store.
    const a = world.get(ProductSchema, { sku: "WIDGET-42" });
    expect(world.registry.count(ProductSchema)).toBe(1);

    // Second call with the same predicate: predicate find returns the stored
    // record by reference — idempotence (B6-R7) is unaffected by B8.
    const b = world.get(ProductSchema, { sku: "WIDGET-42" });
    expect(b).toBe(a);
    expect(world.registry.count(ProductSchema)).toBe(1);
  });

  it("B8-R8 / world.get on a derived schema does not consult the upsert map", () => {
    // Pre-condition: B8 has populated the upsert map for (UserProfileSchema, user).
    const world = makeWorld();
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);
    world.generate(UserProfileSchema, { source: user });

    const beforeCount = world.registry.count(UserProfileSchema);
    // world.get takes a predicate (not a source); it must drive the
    // registry's predicate-match path and find the existing record.
    const got = world.get(UserProfileSchema, { userId: user.id });

    // Found the existing record; count unchanged (no new derived record
    // produced; upsert map not modified by `get`).
    expect(world.registry.count(UserProfileSchema)).toBe(beforeCount);
    expect(got.userId).toBe(user.id);
  });
});

// ---------------------------------------------------------------------------
// B8-R9: determinism — upsert short-circuit does not consume PRNG
// ---------------------------------------------------------------------------

describe("B8-R9: upsert short-circuit does not re-draw PRNG; sibling generation stays in lockstep", () => {
  it("B8-R9 / two worlds, same seed: an upsert hit in worldB must not shift worldB's subsequent ad-hoc generation", () => {
    // To isolate "the upsert hit consumed no PRNG state", we compare an
    // ad-hoc (unregistered) schema's output across two worlds. Ad-hoc
    // generation uses `adhoc-${this.generationCounter}` as its recordId
    // seed source (src/world.ts), so any PRNG-state shift made by the
    // upsert call WOULD shift this output. Registered primary schemas
    // seed their recordPrng off `registry.count(schema)` (D4 per-record
    // determinism), so they are insensitive to whether one extra
    // intervening derive happened — that's why we use an ad-hoc schema
    // here.
    const AdHocSchema = z.object({ x: z.number().int() });

    // worldA: one derive call (miss -> generates + stores), then one
    // ad-hoc generation.
    const worldA = makeWorld(42);
    worldA.populate(UserSchema, 1);
    const userA = worldA.registry.pick(UserSchema);

    // worldB: two derive calls (second is an upsert hit, MUST consume zero
    // PRNG and MUST NOT advance the world's generation counter), then one
    // ad-hoc generation.
    const worldB = makeWorld(42);
    worldB.populate(UserSchema, 1);
    const userB = worldB.registry.pick(UserSchema);

    // Same seed -> same first user.
    expect(JSON.stringify(userA)).toBe(JSON.stringify(userB));

    worldA.generate(UserProfileSchema, { source: userA });
    const aNext = worldA.generate(AdHocSchema);

    worldB.generate(UserProfileSchema, { source: userB });
    // Second derive call MUST be an upsert hit, consuming no PRNG and
    // not advancing the world's counter.
    worldB.generate(UserProfileSchema, { source: userB });
    const bNext = worldB.generate(AdHocSchema);

    // If the upsert hit had consumed PRNG state (or advanced the
    // generation counter), worldB's next ad-hoc record would diverge
    // from worldA's. They must be byte-identical.
    expect(JSON.stringify(bNext)).toBe(JSON.stringify(aNext));
  });
});
