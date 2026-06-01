/**
 * Unit tests for B52 — `generateArray` + `populate` dispatch paths diverge
 * across modes (bounds, overrides, transform).
 *
 * Spec: wiki/specs/B52-generate-array-dispatch-inconsistencies.md
 *
 * Per the minimum-tests directive ([[feedback-minimal-tests]] + the spec's
 * permutation matrix): one test per R-ID (R1..R8) + multi-sub-scenario
 * pinning where the spec splits a single R across two named scenarios. R9
 * (changeset) and R10 (docs audit) are reviewer-only and NOT tested here.
 *
 * RED expectations today (pre-fix):
 *   - R1 (both scenarios): FAIL — derived arm returns one element per source
 *     pair; .max() / defMax not honoured.
 *   - R2 (user's repro): FAIL — primary arm under `store: false` skips the
 *     B43 callerMax slice; returns 10 instead of 6.
 *   - R3 (both scenarios): FAIL — primary arm returns BEFORE the trailing
 *     `options.transform` pass.
 *   - R4 (both scenarios): FAIL — derived arm calls `generateDerivedRecord`
 *     with NO options, silently dropping overrides and transform.
 *   - R5: FAIL — populate derived caps loop at `Math.min(count, sources.length)`,
 *     silently writing fewer derived records than asked.
 *   - R6: PASS today (guard) — the existing primary-first pre-check writes
 *     records. MUST stay PASS through R6's rewrite (the new `case "primary"`
 *     arm matches the removed pre-check's behaviour).
 *   - R7 (both scenarios): PASS today (guard) — the inline ad-hoc loop
 *     computes the same bounds as the helpers; pins behaviour through R7's
 *     refactor.
 *   - R8 (both scenarios): FAIL — derived arm ignores `defMax`; returns one
 *     element per source pair regardless of `defaultArrayLength[1]`.
 *
 * Schemas constructed at module scope (D4 / D10 — determinism keyed on
 * schema reference identity). No `any`, no casts (D1). `.js` extensions on
 * relative imports (D1, Node16 ESM).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/index.js";

// ---------------------------------------------------------------------------
// Module-scoped fixtures
// ---------------------------------------------------------------------------

// Primary-registered Person — R2 (the user's repro), R3, R6.
const Person = z.object({ id: z.string(), name: z.string() });

// Source / Derived pair — R1, R4, R5, R8.
const Source = z.object({ id: z.uuid() });
const Derived = z.object({ sourceId: z.uuid() });

// Derived with an extra `label` slot used by R4 overrides.
const DerivedWithLabel = z.object({ sourceId: z.uuid(), label: z.string() });

// Unregistered ad-hoc element schema — R7 (no `withSchema(Item)` call).
const Item = z.object({ id: z.string() });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("B52: generateArray + populate dispatch inconsistencies", () => {
  // -------------------------------------------------------------------------
  // R1 — derived-mode generateArray MUST honour .max() / .length() and defMax
  // -------------------------------------------------------------------------

  it("B52-R1 / derived .max(6) with 50 sources caps at 6", () => {
    // Spec §R1 scenario 1. RED today: derived arm returns one element per
    // source pair (50), ignoring .max(6).
    const world = createWorld({ seed: 1 });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => (ctx.source as { id: string }).id },
    });
    world.populate(Source, 50);

    const result = world.generate(Derived.array().max(6));

    expect(result.length).toBe(6);
    // D8 — cap applied at production time, not as a post-slice: every
    // returned record was stored before it was returned.
    expect(world.registry.count(Derived)).toBe(6);
  });

  it("B52-R1 / derived no-caller-bound caps at defaultArrayLength[1]", () => {
    // Spec §R1 scenario 2. RED today: derived arm ignores `defMax`, returns
    // one element per source pair (50) on a [1, 4] default.
    const world = createWorld({ seed: 1, defaultArrayLength: [1, 4] });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => (ctx.source as { id: string }).id },
    });
    world.populate(Source, 50);

    const result = world.generate(Derived.array());

    expect(result.length).toBe(4);
  });

  // -------------------------------------------------------------------------
  // R2 — primary-mode generateArray under { store: false } MUST honour .max()
  // -------------------------------------------------------------------------

  it("B52-R2 / primary .min(6).max(6) + store:false + populate(10) returns 6 (user's repro)", () => {
    // Spec §R2 scenario — the user's reported regression. RED today:
    // `target = max(10, prng.int(6, 6)) = 10`, the B44 early-return path
    // returns all 10 records, and `.max(6)` is silently ignored.
    //
    // Default vitest 5s per-test timeout is enough margin: post-fix the
    // call returns near-instantly; the B44 no-infinite-loop property MUST
    // be preserved (no `while (registry.count < target)` re-introduced).
    const world = createWorld({ seed: 1 }).withSchema(Person);
    world.populate(Person, 10);

    const result = world.generate(Person.array().min(6).max(6), { store: false });

    expect(result.length).toBe(6);
    // B10-R4 — `store: false` is transitive; populate's 10 records persist,
    // the store-off call neither adds nor removes from the registry.
    expect(world.registry.count(Person)).toBe(10);
  });

  // -------------------------------------------------------------------------
  // R3 — primary-mode generateArray MUST apply options.transform
  // -------------------------------------------------------------------------

  it("B52-R3 / primary store-on + transform applies to every element", () => {
    // Spec §R3 scenario 1. RED today: primary arm returns at the registry
    // slice, BEFORE the trailing `options.transform` pass at lines 1412-1414.
    //
    // NOTE: `GenerateOptions.transform` is typed as `(data: T) => T`, where
    // for `T.array()` calls T is the array. But the engine implementation at
    // src/world/engine.ts:1412-1414 actually applies it per-element via
    // `result.map(options.transform as any)` — so the per-element shape
    // tested below is what the spec's R3 scenarios pin. The cast through
    // `unknown` is the test-side mirror of the engine's `as any`.
    const world = createWorld({ seed: 1 }).withSchema(Person);

    type PersonHidden = z.infer<typeof Person> & { hidden: true };
    const perElementTransform = (p: z.infer<typeof Person>): z.infer<typeof Person> =>
      ({ ...p, hidden: true }) as unknown as z.infer<typeof Person>;
    const result = world.generate(Person.array().min(3).max(3), {
      transform: perElementTransform as unknown as (
        data: z.infer<typeof Person>[],
      ) => z.infer<typeof Person>[],
    });

    expect(result.length).toBe(3);
    expect(result.every((r) => (r as unknown as PersonHidden).hidden === true)).toBe(true);
  });

  it("B52-R3 / primary store-off + transform applies to every element", () => {
    // Spec §R3 scenario 2. RED today: the B44 store-off early-return path
    // ALSO bypasses the trailing transform pass.
    const world = createWorld({ seed: 1 }).withSchema(Person);
    world.populate(Person, 3);

    type PersonHidden = z.infer<typeof Person> & { hidden: true };
    const perElementTransform = (p: z.infer<typeof Person>): z.infer<typeof Person> =>
      ({ ...p, hidden: true }) as unknown as z.infer<typeof Person>;
    const result = world.generate(Person.array().min(3).max(3), {
      store: false,
      transform: perElementTransform as unknown as (
        data: z.infer<typeof Person>[],
      ) => z.infer<typeof Person>[],
    });

    expect(result.length).toBe(3);
    expect(result.every((r) => (r as unknown as PersonHidden).hidden === true)).toBe(true);
    // B10-R4 — no growth under store: false; the populate(3) records persist.
    expect(world.registry.count(Person)).toBe(3);
  });

  // -------------------------------------------------------------------------
  // R4 — derived-mode generateArray MUST apply overrides and transform
  // -------------------------------------------------------------------------

  it("B52-R4 / derived + per-index overrides applies deepMerge per record", () => {
    // Spec §R4 scenario 1. RED today: derived arm calls
    // `generateDerivedRecord(...)` with no options, silently dropping
    // per-record overrides.
    const world = createWorld({ seed: 1 });
    world.withSchema(Source);
    world.withSchema(DerivedWithLabel, {
      from: Source,
      matchers: { sourceId: (ctx) => (ctx.source as { id: string }).id },
    });
    world.populate(Source, 3);

    const result = world.generate(DerivedWithLabel.array(), {
      overrides: [{ label: "first" }, { label: "second" }, { label: "third" }],
    });

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.label)).toEqual(["first", "second", "third"]);

    // Sibling preserved — each record's `sourceId` matches the corresponding
    // Source record's `id` (the override merges WITH the derived record,
    // sibling fields not clobbered).
    const sources = world.registry.all(Source);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]!.sourceId).toBe(sources[i]!.id);
    }
  });

  it("B52-R4 / derived + transform applies to every element", () => {
    // Spec §R4 scenario 2. RED today: the missing options pass-through ALSO
    // drops the trailing transform.
    const world = createWorld({ seed: 1 });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => (ctx.source as { id: string }).id },
    });
    world.populate(Source, 3);

    type DerivedMarked = z.infer<typeof Derived> & { marked: true };
    const perElementTransform = (d: z.infer<typeof Derived>): z.infer<typeof Derived> =>
      ({ ...d, marked: true }) as unknown as z.infer<typeof Derived>;
    const result = world.generate(Derived.array(), {
      transform: perElementTransform as unknown as (
        data: z.infer<typeof Derived>[],
      ) => z.infer<typeof Derived>[],
    });

    expect(result.length).toBe(3);
    expect(result.every((r) => (r as unknown as DerivedMarked).marked === true)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // R5 — populate derived MUST auto-provision sources to reach `count`
  // -------------------------------------------------------------------------

  it("B52-R5 / populate derived with count > sources auto-provisions", () => {
    // Spec §R5 scenario. RED today: `populate`'s derived branch caps at
    // `N = Math.min(count, sources.length) = 5`, silently returning 5
    // derived records instead of 10.
    const world = createWorld({ seed: 1 });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => (ctx.source as { id: string }).id },
    });
    world.populate(Source, 5);

    world.populate(Derived, 10);

    expect(world.registry.count(Derived)).toBe(10);
    // The auto-provisioned 5 additional sources MUST also land in the source
    // registry (populate's always-write contract — B10-R6).
    expect(world.registry.count(Source)).toBe(10);
  });

  // -------------------------------------------------------------------------
  // R6 — populate's primary-first explicit pre-check MUST be removed as
  //      dead code. PASS today as guard; MUST stay PASS through R6 rewrite.
  // -------------------------------------------------------------------------

  it("B52-R6 / populate against primary-registered schema still writes records", () => {
    // Spec §R6 scenario 1. PASS today via the existing primary-first
    // pre-check; the rewritten `case "primary"` arm MUST produce the same
    // observable result after the pre-check is removed.
    const world = createWorld({ seed: 1 }).withSchema(Person);

    world.populate(Person, 5);

    expect(world.registry.count(Person)).toBe(5);
    const all = world.registry.all(Person);
    expect(all).toHaveLength(5);
    // Each record matches the Person schema — `id` and `name` are populated
    // strings (the schema-based fallback).
    for (const p of all) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.name).toBe("string");
    }
  });

  // R6 scenario 2 (populate against derived still auto-provisions) composes
  // with R5's test — see B52-R5 above. Not re-asserted here.

  // -------------------------------------------------------------------------
  // R7 — generateArray ad-hoc branch MUST share the bound helpers
  //      PASS today as guard; MUST stay PASS through R7's refactor.
  // -------------------------------------------------------------------------

  it("B52-R7 / ad-hoc array honours .min(3).max(7) via helpers", () => {
    // Spec §R7 scenario 1. The inline loop and the helpers compute the same
    // [min, max] pair; this is a positive guard against regression.
    const world = createWorld({ seed: 1 });

    const result = world.generate(Item.array().min(3).max(7));

    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(7);
  });

  it("B52-R7 / ad-hoc array honours .length(4) via helpers", () => {
    // Spec §R7 scenario 2. `.length(N)` takes precedence over min/max in
    // both the inline loop and the helpers; positive guard.
    const world = createWorld({ seed: 1 });

    const result = world.generate(Item.array().length(4));

    expect(result.length).toBe(4);
  });

  // -------------------------------------------------------------------------
  // R8 — derived-mode generateArray MUST consult defMax when no caller bound
  // -------------------------------------------------------------------------

  it("B52-R8 / derived no-caller-bound + many sources caps at defaultArrayLength[1]", () => {
    // Spec §R8 scenario 1. RED today: derived arm ignores `defMax`, returns
    // 50 (one per source) regardless of `defaultArrayLength: [1, 5]`.
    const world = createWorld({ seed: 1, defaultArrayLength: [1, 5] });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => (ctx.source as { id: string }).id },
    });
    world.populate(Source, 50);

    const result = world.generate(Derived.array());

    expect(result.length).toBe(5);
  });

  it("B52-R8 / derived no-caller-bound + zero sources auto-provisions to defMin", () => {
    // Spec §R8 scenario 2. RED today: with zero sources, today's derived
    // arm auto-provisions only up to `minRequired = defMin = 2` (this part
    // already works), but doesn't apply a cap. The cap (`defMax = 4`) is
    // the new contract; the floor (`>= 2`) is the existing behaviour.
    // Together: length must be in [2, 4] AND >= 2 sources land in the
    // source registry.
    const world = createWorld({ seed: 1, defaultArrayLength: [2, 4] });
    world.withSchema(Source);
    world.withSchema(Derived, {
      from: Source,
      matchers: { sourceId: (ctx) => (ctx.source as { id: string }).id },
    });

    const result = world.generate(Derived.array());

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(4);
    expect(world.registry.count(Source)).toBeGreaterThanOrEqual(2);
  });
});
