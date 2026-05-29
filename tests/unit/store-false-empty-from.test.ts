/**
 * Unit tests for B20 — `world.generate(DerivedSchema, { store: false })`
 * crashes when the `from:` registry is empty.
 *
 * Written test-first against the spec
 * (wiki/specs/B20-store-false-empty-from-crash.md). This file IS the
 * regression test required by B20-R7 / D6: the B20-R1 scenario reproduces the
 * exact #21 repro and asserts the call does not throw.
 *
 * Today (0.7.1), in `src/world.ts` ~lines 1122-1144, the no-source derived
 * branch of `generateSingleItem` auto-provisions one source per derivedReg
 * via `generateAndStorePrimary(reg.from, fromReg)`. Under `store: false` the
 * call generates but does NOT write to the registry (B10-R4), so
 * `this.registry.all(reg.from)` still returns `[]`, `pairs` stays empty,
 * `(this.generationCounter - 1) % 0` is `NaN`, and the destructuring
 * `const { source, reg, sourceIndex } = pairs[NaN]!` throws:
 *
 *   TypeError: Cannot destructure property 'source' of 'pairs[idx]'
 *              as it is undefined.
 *
 * Spec-mandated requirements (R8 is reviewer-only — changeset file):
 *  - B20-R1: exact #21 repro must not crash; result is `Derived`-valid.
 *    RED today — throws `TypeError`.
 *  - B20-R2: source auto-provisioned under `store: false` does not land in
 *    source registry. RED today — the crash prevents observation; once the
 *    crash is fixed, Fix B (the chosen fix) guarantees zero registry write.
 *    The follow-up scenario (a default-mode `generate` after a prior
 *    `store: false` call) is RED today too — the prior call crashes.
 *  - B20-R3: matcher reading `ctx.source.id` sees the auto-provisioned
 *    source's id (non-empty string). RED today — the crash prevents reaching
 *    the matcher.
 *  - B20-R4: pre-populated source registry — `store: false` reads from
 *    registry as today. PASS-AS-GUARD today (non-empty path is already
 *    correct in 0.7.1); the test pins that the fix does not regress this
 *    path.
 *  - B20-R5: default-mode no-source derived generate — registry writes match
 *    today. PASS-AS-GUARD today; pins the default path stays byte-identical.
 *  - B20-R6: subsequent `Source` generation lands on the same PRNG-derived
 *    value as the `populate(Source, 1)` control world produces. PASS-AS-GUARD
 *    today only because the `worldA` path crashes before the comparison
 *    runs — once Fix B lands, this is the determinism guard for D4 (the
 *    auto-provisioned source value via the local-capture path must equal the
 *    value produced via the registry path).
 *  - B20-R7: regression test exists — satisfied by this very file (B20-R1).
 *  - B20-R8: changeset entry — reviewer-only; no test here.
 *
 * No `any`, no casts (architecture Rules D1).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures — the exact #21 schemas (per B20-R1's GIVEN block).
// ---------------------------------------------------------------------------

const Source = z.object({ id: z.uuid(), name: z.string() });
const Derived = z.object({ sourceId: z.uuid(), label: z.string() });

// ---------------------------------------------------------------------------
// B20-R1: empty from-registry with `store: false` returns a valid record
// ---------------------------------------------------------------------------

describe("B20-R1: empty from-registry with store: false returns a valid record", () => {
  it("B20-R1 / exact #21 repro — empty from-registry with store: false returns a valid record", () => {
    const world = createWorld({ seed: 1 });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => ctx.source.id },
    });

    // Sanity: registry is empty for both schemas at this point.
    expect(world.registry.count(Source)).toBe(0);
    expect(world.registry.count(Derived)).toBe(0);

    // The call MUST NOT throw — today it throws `TypeError`.
    let result: z.infer<typeof Derived> | undefined;
    expect(() => {
      result = world.generate(Derived, { store: false });
    }).not.toThrow();

    // Returned record satisfies the schema.
    expect(result).toBeDefined();
    expect(Derived.safeParse(result).success).toBe(true);
    expect(typeof result!.sourceId).toBe("string");
    expect(typeof result!.label).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// B20-R2: source auto-provisioned under `store: false` does not land in
// the source registry; and a follow-up default-mode `generate` works.
// ---------------------------------------------------------------------------

describe("B20-R2: store: false suppresses the auto-provisioned source's registry write", () => {
  it("B20-R2 / source auto-provisioned under store: false does not land in source registry", () => {
    const world = createWorld({ seed: 1 });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => ctx.source.id },
    });

    expect(world.registry.count(Source)).toBe(0);
    expect(world.registry.count(Derived)).toBe(0);

    world.generate(Derived, { store: false });

    // Honouring B10-R4 transitive suppression: neither the auto-provisioned
    // source nor the derived record landed in the registry.
    expect(world.registry.count(Source)).toBe(0);
    expect(world.registry.count(Derived)).toBe(0);
  });

  it("B20-R2 / follow-up default-mode generate runs from a still-empty registry", () => {
    const world = createWorld({ seed: 1 });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => ctx.source.id },
    });

    // First call: store: false. Registry is empty before and after.
    world.generate(Derived, { store: false });
    expect(world.registry.count(Source)).toBe(0);
    expect(world.registry.count(Derived)).toBe(0);

    // Second call: default mode (store: true). MUST NOT throw — the registry
    // is still empty, so this is once again the auto-provision path, but
    // this time the source MUST land.
    let r2: z.infer<typeof Derived> | undefined;
    expect(() => {
      r2 = world.generate(Derived);
    }).not.toThrow();

    expect(r2).toBeDefined();
    expect(Derived.safeParse(r2).success).toBe(true);
    // B24-R3 update (closes B21 / behaviour-aligning fix mandated by B24-R7
    // and called out in B24-R8): the no-source-derived branch under default
    // `store: true` now stores the derived record symmetric with the
    // with-source path (B8). The auto-provisioned source still lands
    // (today's behaviour, unchanged), and the derived record now lands too
    // — was `count(Derived) === 0` pre-B24; is `count(Derived) === 1`
    // post-B24. Spec B20-R2's "follow-up default-mode generate" scenario is
    // explicitly updated by B24-R8.
    expect(world.registry.count(Source)).toBe(1);
    expect(world.registry.count(Derived)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B20-R3: matcher reading `ctx.source` sees the auto-provisioned source's id
// even though that source is never written to the registry.
// ---------------------------------------------------------------------------

describe("B20-R3: matchers see the auto-provisioned source under store: false", () => {
  it("B20-R3 / matcher sees the auto-provisioned source's id under store: false", () => {
    const world = createWorld({ seed: 1 });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => ctx.source.id },
    });

    expect(world.registry.count(Source)).toBe(0);

    const r = world.generate(Derived, { store: false });

    // The matcher resolved to a real (non-empty) id from the auto-provisioned
    // source — not `undefined`, no throw from the matcher.
    expect(typeof r.sourceId).toBe("string");
    expect(r.sourceId.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// B20-R4: pre-populated source registry — `store: false` reads from registry
// as today (the non-empty path must remain unchanged by the fix).
// ---------------------------------------------------------------------------

describe("B20-R4: pre-populated source registry — store: false unchanged", () => {
  it("B20-R4 / pre-populated source registry — store: false reads from registry as today", () => {
    const world = createWorld({ seed: 1 });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => ctx.source.id },
    });

    world.populate(Source, 1);
    const before = world.registry.count(Source);
    expect(before).toBe(1);

    let r: z.infer<typeof Derived> | undefined;
    expect(() => {
      r = world.generate(Derived, { store: false });
    }).not.toThrow();

    expect(r).toBeDefined();
    expect(Derived.safeParse(r).success).toBe(true);

    // The matcher picked the pre-populated source (registry-resident path).
    const stored = world.registry.all(Source)[0];
    expect(stored).toBeDefined();
    expect(r!.sourceId).toBe(stored!.id);

    // No new source write; no derived write (B10-R2 still holds).
    expect(world.registry.count(Source)).toBe(before);
    expect(world.registry.count(Derived)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B20-R5: default-mode (`store: true`) no-source derived generate — registry
// writes must match today's behaviour.
// ---------------------------------------------------------------------------

describe("B20-R5: default-mode no-source derived generate — registry writes match today", () => {
  it("B20-R5 / default-mode no-source derived generate — registry writes match today", () => {
    const world = createWorld({ seed: 1 });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => ctx.source.id },
    });

    expect(world.registry.count(Source)).toBe(0);
    expect(world.registry.count(Derived)).toBe(0);

    let r: z.infer<typeof Derived> | undefined;
    expect(() => {
      r = world.generate(Derived);
    }).not.toThrow();

    expect(r).toBeDefined();
    expect(Derived.safeParse(r).success).toBe(true);
    // B24-R3 update (closes B21 — symmetric to the B20-R2 follow-up update
    // mandated by B24-R8): the no-source-derived branch under default
    // `store: true` now stores the derived record, aligning with B20-R5's
    // original spec text (`count(Derived) === 1`). The pre-B24 codebase
    // pinned "today's actual behaviour" (`count(Derived) === 0`) and the
    // test-writer flagged the discrepancy at that time; B24-R3 closes it.
    expect(world.registry.count(Source)).toBe(1);
    expect(world.registry.count(Derived)).toBe(1);

    // The derived record's `sourceId` matches the auto-provisioned source's
    // id — the matcher resolved against the registry-resident source.
    const storedSource = world.registry.all(Source)[0];
    expect(storedSource).toBeDefined();
    expect(r!.sourceId).toBe(storedSource!.id);
  });
});

// ---------------------------------------------------------------------------
// B20-R6: determinism — subsequent `Source` generation lands on the same
// PRNG-derived value whether the auto-provision happens via the local-capture
// path (worldA, empty registry under `store: false`) or via the registry
// path (worldC, pre-populated with `populate(Source, 1)`).
//
// All worlds use the same seed; the spec's suggested phrasing is to build a
// "control" worldC with `populate(Source, 1)` and compare the auto-provisioned
// source value byte-identically to worldA's follow-up `generate(Source)`.
// ---------------------------------------------------------------------------

describe("B20-R6: determinism — auto-provision PRNG fork sequence matches pre-population path", () => {
  it("B20-R6 / subsequent Source generation lands on the same PRNG-derived value", () => {
    // worldA — empty registry, store: false derived call (Fix B's local-capture
    // path), then a follow-up `generate(Source)` to extract the next value the
    // parent PRNG produces.
    const worldA = createWorld({ seed: 7 });
    worldA.withSchema(Source);
    worldA.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => ctx.source.id },
    });

    // Pre-fix: this throws. Post-fix (Fix B): the auto-provisioned source is
    // captured locally; the registry stays empty.
    expect(() => worldA.generate(Derived, { store: false })).not.toThrow();
    const a = worldA.generate(Source);

    // worldC — same seed, but the source is provisioned via the registry path
    // (`populate(Source, 1)`). The expectation: the value produced is
    // byte-identical to worldA's auto-provisioned source value, because the
    // PRNG fork sequence is the same (per D4 / B20-R6 rationale — only the
    // registry side effect is suppressed, not PRNG consumption).
    const worldC = createWorld({ seed: 7 });
    worldC.withSchema(Source);
    worldC.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => ctx.source.id },
    });
    worldC.populate(Source, 1);
    const c = worldC.registry.all(Source)[0];

    expect(c).toBeDefined();
    // The auto-provisioned source value in worldA (now produced as the
    // follow-up `generate(Source)` after the `store: false` derived call)
    // must be byte-identical to worldC's pre-populated source value.
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
  });
});

// ---------------------------------------------------------------------------
// B20-R7 — regression test exists. SATISFIED by this file (the B20-R1 test
// pins the exact #21 repro). No separate test added to avoid duplication.
//
// B20-R8 — changeset entry. Reviewer-only; not testable via vitest.
// ---------------------------------------------------------------------------
