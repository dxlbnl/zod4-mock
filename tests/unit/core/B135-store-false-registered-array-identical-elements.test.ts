/**
 * Unit tests for B135 — BUG: `store: false` array of a registered schema yields
 * identical elements (the per-element seed index collapses to a constant).
 *
 * Spec: wiki/specs/B135-store-false-registered-array-identical-elements.md
 *
 * Root cause (spec Context): `generateArrayPrimary`'s store-off `Array.from`
 * branch seeds each element via `generateAndStorePrimary`, whose per-record
 * index is `registry.count(schema) + pending`. The `pending` counter cycles
 * 0→1→0 per sibling (decremented in `finally`) and under `store: false` the
 * registry write is suppressed so `registry.count` never advances — so every
 * element computes the same `recordIndex` → identical `recordId` → identical
 * field seed → identical record. The fix threads an explicit per-element index
 * (`existingCount + i`) so the i-th store-off element matches the store-on
 * record at index i (D4/D10 — toggling `store` is value-neutral).
 *
 * Per the minimum-tests directive + the spec's test matrix: one behaviour test
 * per behavioural R-ID — R1 (distinctness), R2 (store toggle value-neutral),
 * R3 (playground regression — the required bug regression test), R4 (derived
 * auto-provision), R5 (store-on byte-identical control). R6 (changeset) is
 * reviewer-only and NOT tested here.
 *
 * RED expectations pre-fix:
 *   - B135-R1: FAILS — the four store-off elements collapse to byte-identical
 *     records, so the distinct-Set size is < 4.
 *   - B135-R2: FAILS — store-off (collapsed) ≠ store-on (distinct), so the
 *     JSON-equality assertion fails.
 *   - B135-R3: FAILS — the `age|name` pairs are all identical (the collapse),
 *     so the distinct-Set size is 1, not > 1. (The override-threaded `number`
 *     values [0,1,2,3] still land — B53 intact.)
 *   - B135-R4: FAILS if the derived auto-provision sub-case also collapses.
 *   - B135-R5: PASSES pre-fix — the store-on path is already correct; this is
 *     the control that the fix doesn't disturb it.
 *
 * Schemas are module-scoped per D4 / D10 (determinism keyed on schema
 * reference identity). No `any`, no casts (D1). `.js` extensions on relative
 * imports (D1, Node16 ESM).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Module-scoped fixtures (D4 / D10 — per-schema slot keyed on identity).
// ---------------------------------------------------------------------------

const NestedThing = z.object({
  age: z.number(),
  name: z.string(),
  number: z.number(),
});

const Schema = z.object({
  name: z.string(),
  nested: NestedThing.array(),
});

const Source = z.object({ id: z.uuid(), label: z.string() });
const Derived = z.object({ sourceId: z.uuid(), tag: z.string() });

// ---------------------------------------------------------------------------
// B135-R1 — store-off registered-primary array elements seed from distinct
// per-element indices (pairwise distinct).
// ---------------------------------------------------------------------------

describe("B135-R1: store-off registered-primary array elements are pairwise distinct", () => {
  it("B135-R1 / four store-off elements of a registered schema are pairwise distinct", () => {
    const world = createWorld({ seed: 1 }).withSchema(NestedThing);

    // RED pre-fix: every element collapses to the same `recordId` → identical
    // records → `Set(...).size < 4`. Post-fix: distinct seeds → size === 4.
    const result = world.generate(NestedThing.array().length(4), { store: false });

    expect(result.length).toBe(4);
    expect(new Set(result.map((r) => JSON.stringify(r))).size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// B135-R2 — toggling `store` is value-neutral: the i-th store-off element
// equals the i-th store-on element (same seed, registration, call).
// ---------------------------------------------------------------------------

describe("B135-R2: store toggle is value-neutral for the registered-primary array arm", () => {
  it("B135-R2 / store-off elements equal store-on first-N records position-by-position", () => {
    const worldOn = createWorld({ seed: 7 }).withSchema(NestedThing);
    const worldOff = createWorld({ seed: 7 }).withSchema(NestedThing);

    const on = worldOn.generate(NestedThing.array().length(4)); // store on
    const off = worldOff.generate(NestedThing.array().length(4), { store: false }); // store off

    // RED pre-fix: `on` is distinct per element, `off` collapses → byte
    // strings differ. Post-fix: store-off seeds match store-on positions.
    expect(JSON.stringify(off)).toBe(JSON.stringify(on));

    // Only the registry side effect differs (D4/D10/D8).
    expect(worldOff.registry.count(NestedThing)).toBe(0);
    expect(worldOn.registry.count(NestedThing)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// B135-R3 — regression: the playground `store: false` registered-array repro
// produces distinct elements (the required bug regression test, D6).
// ---------------------------------------------------------------------------

describe("B135-R3: playground store:false registered-array repro yields distinct elements", () => {
  it("B135-R3 / nested registered-schema array under store:false is distinct, overrides preserved", () => {
    const world = createWorld({ seed: 1 }).withSchema(NestedThing).withSchema(Schema);

    const result = world.generate(Schema, {
      defaultArrayLength: [4, 4],
      store: false,
      overrides: { nested: Array.from({ length: 4 }, (_, number) => ({ number })) },
    });

    expect(result.nested.length).toBe(4);

    // B53 per-index override threading intact — the override `number` still
    // lands at each position (unaffected by the seed-index fix).
    expect(result.nested.map((n) => n.number)).toEqual([0, 1, 2, 3]);

    // RED pre-fix: the generated `age`/`name` pairs are all identical (the
    // collapse) → Set size === 1. Post-fix: distinct → Set size > 1.
    expect(new Set(result.nested.map((n) => `${n.age}|${n.name}`)).size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// B135-R4 — derived array auto-provisioned under `store: false` seeds from
// distinct indices (the structural twin of R1).
// ---------------------------------------------------------------------------

describe("B135-R4: derived array auto-provisioned under store:false yields distinct elements", () => {
  it("B135-R4 / derived store:false array auto-provisions distinct sources, no writes", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(Source)
      .withSchema(Derived, { from: Source, matchers: { sourceId: (ctx) => ctx.source.id } });

    // Source registry intentionally empty → the derived array must
    // auto-provision its sources under store: false.
    const result = world.generate(Derived.array().length(3), { store: false });

    expect(result.length).toBe(3);

    // RED pre-fix IF the auto-provision sub-case collapses (the
    // `registry.count(fromSchema)`-frozen floor loop). Post-fix: distinct.
    expect(new Set(result.map((r) => JSON.stringify(r))).size).toBe(3);

    // B10-R2/R4: no derived or auto-provisioned-source write under store:false.
    expect(world.registry.count(Derived)).toBe(0);
    expect(world.registry.count(Source)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B135-R5 — control: the store-on primary array path is unchanged by the fix.
// Expected to PASS pre-fix (the store-on path was already correct).
// ---------------------------------------------------------------------------

describe("B135-R5: store-on primary array path stays byte-identical (control)", () => {
  it("B135-R5 / store-on array call: length 4, stored == returned, pairwise distinct", () => {
    const world = createWorld({ seed: 3 }).withSchema(NestedThing);

    const result = world.generate(NestedThing.array().length(4)); // default store on

    expect(result.length).toBe(4);
    expect(world.registry.count(NestedThing)).toBe(4);

    // D8 — stored equals returned for registered schemas.
    expect(world.registry.all(NestedThing)).toEqual(result);

    // Already correct pre-fix; the fix must not disturb it.
    expect(new Set(result.map((r) => JSON.stringify(r))).size).toBe(4);
  });
});
