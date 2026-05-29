/**
 * Unit tests for B39 — replace `generationCounter`-derived PRNG fork keys with
 * stable per-schema identity-based ones (D4 strengthening).
 *
 * Written test-first against the spec
 * (wiki/specs/B39-stable-identity-based-fork-keys.md). Today three call sites
 * on `WorldImpl` derive their PRNG fork keys from a per-world
 * `generationCounter` rather than from a stable schema identity:
 *
 *   - `generateSingleItem` ad-hoc branch — `adhoc-${generationCounter}`
 *     (src/world.ts:1180)
 *   - `generateArray` (every mode)        — `gen-${generationCounter}`
 *     (src/world.ts:927)
 *   - outer-wrapper optional/nullable roll — `gen-wrap-${generationCounter+1}`
 *     (src/world.ts:362)
 *
 * As a result, inserting a stray `world.generate(SomethingElse)` earlier in a
 * session shifts the value of every subsequent ad-hoc, array, or outer-optional
 * generation. B39's fix is to key each fork on a per-world per-schema slot
 * (a `WeakMap<ZodTypeAny, number>` integer ID + a per-schema call counter).
 *
 * Per requirement:
 *  - B39-R1: `world.generate(X)` is call-order-independent across distinct
 *    schemas. Today FAIL on the three call sites (counter-shifted fork keys).
 *  - B39-R2: registered-primary (`reg{id}#{index}`) and registered-derived
 *    (`dreg{id}#{sourceIndex}`) paths are byte-identical to today —
 *    REGRESSION GUARD. Today PASS; must continue to pass after B39.
 *  - B39-R3..R10: implementation/promotion/docs requirements; not direct
 *    behavioural tests (R3 is implementation detail per spec, R4 is
 *    implementation-only covered by the R1 scenarios collectively, R7/R8/R9/R10
 *    are reviewer-verified).
 *  - B39-R6: this file IS the regression test the bug requires (D6).
 *
 * **Important determinism guard** (per the test-writer brief): the new
 * invariant is "calls on the same world to the same schema produce the same
 * Nth value regardless of intervening calls to *other* schemas." It is NOT
 * "two different `z.object(...)` constructions of the same shape produce the
 * same value" — those have different reference identities and will produce
 * different `WeakMap` IDs (and therefore different values). All schemas used
 * for the cross-world equality assertions are constructed **once at module
 * scope** and reused, so reference identity is preserved across the two
 * worlds' calls.
 *
 * No `any`, no casts (per architecture Rules D1).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures — constructed ONCE at module scope so reference identity is
// stable across worlds. Under B39 the fork key derives from the schema
// reference's identity; constructing a fresh `z.object({...})` per world
// would assign each construction a different per-world `WeakMap` ID and
// (correctly) produce different values.
// ---------------------------------------------------------------------------

const AdHocSchema = z.object({
  x: z.number().int(),
  y: z.string(),
});

const OtherSchema = z.object({
  z: z.number().int(),
});

const ItemSchema = z.object({
  id: z.uuid(),
  label: z.string(),
});

const ArraySchema = z.array(ItemSchema).min(1).max(5);

const MaybeSchema = z.object({ x: z.number().int() }).optional();

// Schemas for the registered-paths regression guard (B39-R2).
const PersonSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
});

const OrderSchema = z.object({
  id: z.uuid(),
  amount: z.number().int(),
});

const SummarySchema = z.object({
  orderId: z.uuid(),
  note: z.string(),
});

// ---------------------------------------------------------------------------
// B39-R1: call-order-independence across distinct schemas
// ---------------------------------------------------------------------------
// Each scenario constructs two identically-seeded worlds. `worldA` makes the
// "minimal" call sequence (just the target schema). `worldB` makes the
// "polluted" sequence (an intervening `generate(OtherSchema)` first). Today,
// the counter-derived fork key shifts on `worldB`, so its value for the
// target schema diverges from `worldA`'s. Under B39 the per-schema slot
// counter for the target schema is 1 on both worlds, so the values match.
// ---------------------------------------------------------------------------

describe("B39-R1: world.generate(X) is call-order-independent across distinct schemas", () => {
  it("B39-R1 / ad-hoc single — generate(X) is byte-identical regardless of prior generate(Y) calls", () => {
    // GIVEN: AdHocSchema (unregistered) + OtherSchema (unregistered).
    // Two identically-seeded worlds.
    const worldA = createWorld({ seed: 42 });
    const worldB = createWorld({ seed: 42 });

    // WHEN: worldA generates AdHocSchema directly. worldB first generates
    // OtherSchema, then generates AdHocSchema.
    const a = worldA.generate(AdHocSchema);
    worldB.generate(OtherSchema);
    const b = worldB.generate(AdHocSchema);

    // THEN: both must be byte-identical. The intervening OtherSchema call on
    // worldB must not shift AdHocSchema's value. (Today: FAILS because the
    // ad-hoc fork key is `adhoc-${counter}` which differs across the two
    // worlds.)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("B39-R1 / ad-hoc array — generate(X.array().length(N)) is byte-identical regardless of prior calls", () => {
    // GIVEN: ItemSchema + ArraySchema (unregistered) + OtherSchema.
    const worldA = createWorld({ seed: 42 });
    const worldB = createWorld({ seed: 42 });

    // WHEN: worldA generates ArraySchema directly. worldB first generates
    // OtherSchema, then generates ArraySchema.
    const a = worldA.generate(ArraySchema);
    worldB.generate(OtherSchema);
    const b = worldB.generate(ArraySchema);

    // THEN: both the array length and every per-element value must be
    // byte-identical. (Today: FAILS — the array's `genPrng` fork key is
    // `gen-${counter}` which differs across the two worlds, so the length
    // roll and the per-element forks all diverge.)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("B39-R1 / outer-wrapper optional — generate(X.optional()) is byte-identical regardless of prior calls", () => {
    // GIVEN: MaybeSchema = z.object({...}).optional() (unregistered) + OtherSchema.
    const worldA = createWorld({ seed: 42 });
    const worldB = createWorld({ seed: 42 });

    // WHEN: worldA generates MaybeSchema directly. worldB first generates
    // OtherSchema, then generates MaybeSchema.
    const a = worldA.generate(MaybeSchema);
    worldB.generate(OtherSchema);
    const b = worldB.generate(MaybeSchema);

    // THEN: the skip-to-`undefined` vs descend decision must be the same on
    // both worlds, AND when both descend, the inner value must match too.
    // (Today: FAILS — the outer-wrap fork key is `gen-wrap-${counter+1}`
    // which differs across the two worlds, so the optional roll diverges and
    // the descended value diverges with it.)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("B39-R1 / interleaved schemas don't disturb each other (every Nth call to X matches)", () => {
    // This is the strongest version of the invariant: two worlds whose call
    // sequences to a given schema X are the same Nth-call-by-Nth-call, even
    // though they interleave different other-schema calls, must produce the
    // same value for the Nth `generate(X)`.
    //
    // GIVEN: AdHocSchema + OtherSchema (both unregistered).
    const worldA = createWorld({ seed: 42 });
    const worldB = createWorld({ seed: 42 });

    // WHEN:
    //   worldA: generate(X), generate(X)
    //   worldB: generate(X), generate(Y), generate(X)
    const aFirst = worldA.generate(AdHocSchema);
    const aSecond = worldA.generate(AdHocSchema);

    const bFirst = worldB.generate(AdHocSchema);
    worldB.generate(OtherSchema);
    const bSecond = worldB.generate(AdHocSchema);

    // THEN: the Nth generate(X) is the same on both worlds for every N.
    // (Today: FAILS on the second pair — worldA's second call observes
    // generationCounter=2, worldB's observes generationCounter=3, so their
    // ad-hoc fork keys diverge.)
    expect(JSON.stringify(bFirst)).toBe(JSON.stringify(aFirst));
    expect(JSON.stringify(bSecond)).toBe(JSON.stringify(aSecond));

    // Sanity: two consecutive calls to the *same* schema on the *same* world
    // still differ — the per-schema slot must advance per call (per
    // B39-R1's fourth scenario and B39-R3's "per-schema slot increments per
    // call" scenario). If this collapsed, B39 would have over-fixed.
    expect(JSON.stringify(aFirst)).not.toBe(JSON.stringify(aSecond));
  });
});

// ---------------------------------------------------------------------------
// B39-R2: registered-primary and registered-derived paths byte-identical to
// today (REGRESSION GUARD). These already use stable identity-based fork
// keys (`reg{id}#{index}` and `dreg{id}#{sourceIndex}`); B39 must not regress
// them. These tests PASS today and MUST continue to pass after B39.
// ---------------------------------------------------------------------------

describe("B39-R2: registered paths byte-identical across worlds (regression guard)", () => {
  it("B39-R2 / registered-primary populate output is byte-equivalent across two same-seed worlds", () => {
    // Two independent worlds, same seed, same registration order, same call.
    // Both flow through the registered-primary path (`reg{id}#{index}`),
    // which B39 does not touch.
    const a = createWorld({ seed: 42 }).withSchema(PersonSchema);
    a.populate(PersonSchema, 4);

    const b = createWorld({ seed: 42 }).withSchema(PersonSchema);
    b.populate(PersonSchema, 4);

    expect(JSON.stringify(a.registry.all(PersonSchema))).toBe(
      JSON.stringify(b.registry.all(PersonSchema)),
    );
    // Sanity: assertion above isn't a vacuous `"[] === []"`.
    expect(a.registry.all(PersonSchema)).toHaveLength(4);
  });

  it("B39-R2 / registered-derived record output is byte-equivalent across two same-seed worlds", () => {
    // Two independent worlds, same seed, same registration order. The
    // derived path uses `dreg{id}#{sourceIndex}` as its fork key — stable
    // identity-based, and B39 does not touch it.
    const a = createWorld({ seed: 42 })
      .withSchema(OrderSchema)
      .withSchema(SummarySchema, {
        from: OrderSchema,
        matchers: { orderId: (ctx) => ctx.source.id },
      });
    a.populate(OrderSchema, 2);
    const aSource = a.registry.all(OrderSchema)[0]!;
    const aDerived = a.generate(SummarySchema, { source: aSource });

    const b = createWorld({ seed: 42 })
      .withSchema(OrderSchema)
      .withSchema(SummarySchema, {
        from: OrderSchema,
        matchers: { orderId: (ctx) => ctx.source.id },
      });
    b.populate(OrderSchema, 2);
    const bSource = b.registry.all(OrderSchema)[0]!;
    const bDerived = b.generate(SummarySchema, { source: bSource });

    // Source records match (registered-primary path, unchanged).
    expect(JSON.stringify(a.registry.all(OrderSchema))).toBe(
      JSON.stringify(b.registry.all(OrderSchema)),
    );
    // Derived records match (registered-derived path, unchanged).
    expect(JSON.stringify(aDerived)).toBe(JSON.stringify(bDerived));
    // The matcher's value flowed through (sanity).
    expect(aDerived.orderId).toBe(aSource.id);
  });
});

// ---------------------------------------------------------------------------
// B39-R3 / B39-R4 / B39-R6 / B39-R7 / B39-R8 / B39-R9 / B39-R10:
//   - B39-R3 is an implementation-detail requirement (WeakMap + helper
//     shape). Per the test-writer brief, skip — not observable except
//     through the B39-R1 scenarios above.
//   - B39-R4 enumerates the three site migrations. The three B39-R1
//     scenarios above cover the three sites collectively (ad-hoc single,
//     ad-hoc array, outer-wrapper optional).
//   - B39-R6 IS this file.
//   - B39-R7 (ADR D10), B39-R8 (changeset), B39-R9 (docs), B39-R10
//     (CLAUDE.md drift fix) are reviewer-verified — no test here.
// ---------------------------------------------------------------------------
