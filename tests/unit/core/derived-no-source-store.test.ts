/**
 * Unit tests for B24 — `WorldImpl.generateSingleItem` decomposition closes B21.
 *
 * Written test-first against the spec
 * (wiki/specs/B24-decompose-generate-single-item.md). B24's R7 mandates a
 * regression test for the B21 asymmetry: today the no-source-derived branch
 * of `generateSingleItem` (src/world.ts ~lines 1122-1156, the
 * `else if (derivedRegs.length > 0)` block reached when
 * `world.generate(DerivedSchema)` is called WITHOUT `{ source }` and the
 * schema is registered with `from: SourceSchema`) generates the derived
 * record and returns it, but does NOT write it to the registry — even under
 * default `store: true`. The with-source branch (B8) stores by default
 * (src/world.ts:1110); the no-source branch does not. B24's R3 closes that
 * asymmetry by adding `if (this.effectiveStore) this.registry.store(schema, result)`
 * to the no-source path inside the new `generateDerivedAutoSource` method.
 *
 * Spec-mandated requirements (R7's four scenarios, B21's closure pin):
 *
 *  - B24-R7 / no-source-derived stores by default (closes B21):
 *    a single `world.generate(Derived)` call (no source, default store:true)
 *    auto-provisions a source AND stores the derived record. Today
 *    `count(Derived) === 0` (asymmetric); post-B24 `count(Derived) === 1`.
 *    RED today.
 *
 *  - B24-R7 / loop symmetry: 5 calls produce 5 derived records:
 *    canonical B21 use case. `for (let i = 0; i < 5; i++) world.generate(Derived)`
 *    yields `count(Source) === 5` and `count(Derived) === 5`. Today
 *    `count(Derived) === 0` (the no-source branch never stores). RED today.
 *
 *  - B24-R7 / with-source path unchanged (B8 regression guard):
 *    the explicit `{ source }` path still upserts to exactly one derived
 *    record. GREEN today, GREEN after B24 — pins B8-R1 against the
 *    decomposition.
 *
 *  - B24-R7 / store:false no-source-derived suppresses both (B10/B20 regression
 *    guard): under `{ store: false }`, neither source nor derived land in the
 *    registry. GREEN today (B20 fix), GREEN after B24 — the B24 store call
 *    is gated by `if (this.effectiveStore)`, so the B10-R4 transitive
 *    suppression and B20-R2's local-capture path stay intact.
 *
 * Schemas are module-scoped per D4 / D10 (the architecture rule that ties
 * determinism to schema reference identity): every test reuses the same
 * `Source` and `Derived` references so the per-schema slot model from B39
 * is exercised through stable identities.
 *
 * No `any`, no casts (architecture Rules D1).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures (module-scoped per D4 / D10 stable reference-identity rule
// from B39 — the per-schema slot keys on the schema reference identity, so
// reusing the same module-scoped references is the canonical test shape).
// ---------------------------------------------------------------------------

const Source = z.object({ id: z.uuid(), name: z.string() });
const Derived = z.object({ sourceId: z.uuid(), label: z.string() });

const setup = (seed: number) => {
  const world = createWorld({ seed });
  world.withSchema(Source);
  world.withSchema(Derived, {
    from: Source,
    matchers: { sourceId: (ctx) => ctx.source.id },
  });
  return world;
};

// ---------------------------------------------------------------------------
// B24-R7 / no-source-derived stores by default (closes B21)
// ---------------------------------------------------------------------------

describe("B24-R7: no-source-derived stores by default (closes B21)", () => {
  it("B24-R7 / no-source-derived stores by default (closes B21)", () => {
    const world = setup(1);

    // Sanity: registry empty before the call.
    expect(world.registry.count(Source)).toBe(0);
    expect(world.registry.count(Derived)).toBe(0);

    const r = world.generate(Derived);

    // Returned record is valid.
    expect(Derived.safeParse(r).success).toBe(true);
    expect(typeof r.sourceId).toBe("string");
    expect(r.sourceId.length).toBeGreaterThan(0);

    // The auto-provisioned source was stored (today's behaviour — unchanged).
    expect(world.registry.count(Source)).toBe(1);

    // B24-R3 / B21 fix: the no-source-derived record now lands in the
    // registry, symmetric with the with-source branch (B8). Pre-B24 this is
    // `0`; post-B24 this is `1`.
    expect(world.registry.count(Derived)).toBe(1);

    // The stored derived record's `sourceId` matches the auto-provisioned
    // source's id — the matcher resolved against the auto-provisioned
    // source.
    const storedSource = world.registry.all(Source)[0];
    expect(storedSource).toBeDefined();
    expect(r.sourceId).toBe(storedSource!.id);
  });
});

// ---------------------------------------------------------------------------
// B24-R7 / loop symmetry: N no-source generate calls produce N derived records
// (the canonical B21 use case — the asymmetry was discovered as a user calling
// `for (let i = 0; i < 5; i++) world.generate(Derived)` and getting only one
// derived record instead of the N they expected). The user-expectation framing
// is "N calls should yield N derived records, with the source pool reused";
// the test pins that intent.
// ---------------------------------------------------------------------------

describe("B24-R7: loop symmetry — N no-source generate calls produce N derived records", () => {
  it("B24-R7 / loop symmetry: 5 calls produce 5 derived records", () => {
    const world = setup(1);

    for (let i = 0; i < 5; i++) {
      world.generate(Derived);
    }

    // Source pool is auto-provisioned exactly ONCE — the no-source branch in
    // `src/world.ts` only auto-provisions when `registry.count(reg.from!) === 0`
    // at call time. After the first call stores the source, subsequent calls
    // see a non-empty source registry and reuse the existing source via the
    // pair-loop's modulo round-robin (`pairs[idx % pairs.length]`). So
    // `count(Source)` stays at 1 across all 5 calls, both pre- and post-B24.
    expect(world.registry.count(Source)).toBe(1);

    // B24-R3 / B21 fix: each call now stores its derived record. Pre-B24 this
    // is `0` (the no-source branch returns without writing); post-B24 this is
    // `5` — N derived records for N calls, the user-expected "N-out-N-in"
    // symmetric outcome with the source pool reused.
    expect(world.registry.count(Derived)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// B24-R7 / with-source path unchanged (B8 regression guard)
// ---------------------------------------------------------------------------

describe("B24-R7: with-source path unchanged (B8 regression guard)", () => {
  it("B24-R7 / with-source path unchanged: source-provided generate upserts to exactly one record", () => {
    const world = setup(1);

    // Provision one source up front via `populate`, then call
    // `generate(Derived, { source })` — exercises the B8 with-source upsert
    // path. B8-R1: the second call returns the same instance and does not
    // grow the registry.
    world.populate(Source, 1);
    const src = world.registry.all(Source)[0];
    expect(src).toBeDefined();

    const a = world.generate(Derived, { source: src });
    const b = world.generate(Derived, { source: src });

    // B8-R1 upsert: same reference, registry count is 1.
    expect(a).toBe(b);
    expect(world.registry.count(Derived)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B24-R7 / store:false no-source-derived suppresses both (B10/B20 regression
// guard) — the B24 store call MUST be gated by `if (this.effectiveStore)`.
// ---------------------------------------------------------------------------

describe("B24-R7: store: false no-source-derived suppresses both (B10/B20 regression guard)", () => {
  it("B24-R7 / store: false no-source-derived suppresses both source and derived writes", () => {
    const world = setup(1);

    // Empty registry up front.
    expect(world.registry.count(Source)).toBe(0);
    expect(world.registry.count(Derived)).toBe(0);

    const r = world.generate(Derived, { store: false });

    // Returned record is valid.
    expect(Derived.safeParse(r).success).toBe(true);

    // B10-R4 / B20-R2: under `store: false`, neither the auto-provisioned
    // source nor the derived record lands in the registry — even after B24
    // adds the new store call on the default path, the `if (this.effectiveStore)`
    // gate keeps the no-source-derived `store: false` path write-free.
    expect(world.registry.count(Source)).toBe(0);
    expect(world.registry.count(Derived)).toBe(0);
  });
});
