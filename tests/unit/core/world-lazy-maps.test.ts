/**
 * B97-R15 — `WorldImpl` maps are lazily allocated.
 *
 * Tests-first RED file. The spec ([B97-R15](../../../wiki/specs/B97-fix-eager-bindgenerators-perf-regression.md))
 * requires the five mutable maps on `WorldImpl` (today eagerly initialised
 * to empty `Map`s at field-declaration time — `src/world/engine.ts:248-262`)
 * to be declared as `Map<…> | null` and allocated on first write.
 *
 *   - `customKeyGenerators`
 *   - `schemaKeyMaps`
 *   - `relationPools`
 *   - `pendingCounts`
 *   - `derivedUpsert`
 *
 * The implementer adds a test-only `__inspectLazyMaps(world)` accessor
 * re-exported from `src/world/engine.ts` that returns each map ref (or
 * `null`).
 *
 * Failure modes today (pre-fix):
 *   - `__inspectLazyMaps` is not exported from `src/world/engine.ts`. The
 *     helper accessor throws "not exported" — every test goes RED at
 *     first call.
 *   - Even with the seam wired, today's constructor allocates all five
 *     maps eagerly (`= new Map()` in the field declarations) so every
 *     scenario's `=== null` assertion would still fail.
 *
 * Spec gap noted: the spec text uses `withKeyGen` for the world-level
 * custom-generator registration method, but the actual public API
 * (`src/world/engine.ts:404`, `src/types.ts:319`) is `withGenerators`.
 * This test uses `withGenerators` as the truth-of-the-code; the
 * test-writer report surfaces this as a spec gap for the reviewer /
 * manager to reconcile.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import * as engineModule from "../../../src/world/engine.js";

const simpleSchema = z.object({
  id: z.string(),
  name: z.string(),
});

interface LazyMapsSnapshot {
  customKeyGenerators: Map<unknown, unknown> | null;
  schemaKeyMaps: Map<unknown, unknown> | null;
  relationPools: Map<unknown, unknown> | null;
  pendingCounts: Map<unknown, unknown> | null;
  derivedUpsert: Map<unknown, unknown> | null;
}

function inspectLazyMaps(world: unknown): LazyMapsSnapshot {
  const fn = (
    engineModule as {
      __inspectLazyMaps?: (w: unknown) => LazyMapsSnapshot;
    }
  ).__inspectLazyMaps;
  if (typeof fn !== "function") {
    throw new Error(
      "__inspectLazyMaps is not exported from src/world/engine.ts — the implementer must add this test-only accessor (B97-R15)",
    );
  }
  return fn(world);
}

// ---------------------------------------------------------------------------
// B97-R15 / Scenario 1 — fresh world has all five lazy maps at null
// ---------------------------------------------------------------------------

describe("B97-R15 / fresh world: all five lazy maps are null", () => {
  it("B97-R15 / createWorld({ seed: 1 }) → all five fields === null", () => {
    const world = createWorld({ seed: 1 });
    const m = inspectLazyMaps(world);
    expect(m.customKeyGenerators).toBe(null);
    expect(m.schemaKeyMaps).toBe(null);
    expect(m.relationPools).toBe(null);
    expect(m.pendingCounts).toBe(null);
    expect(m.derivedUpsert).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// B97-R15 / Scenario 2 — zero-config generate does not allocate the maps
// ---------------------------------------------------------------------------

describe("B97-R15 / zero-config generate does not allocate the lazy maps", () => {
  it("B97-R15 / world.generate(simpleSchema) on a fresh world leaves all five fields === null", () => {
    const world = createWorld({ seed: 1 });
    world.generate(simpleSchema, { store: false });
    const m = inspectLazyMaps(world);
    expect(m.customKeyGenerators).toBe(null);
    expect(m.schemaKeyMaps).toBe(null);
    expect(m.relationPools).toBe(null);
    expect(m.pendingCounts).toBe(null);
    expect(m.derivedUpsert).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// B97-R15 / Scenario 3 — withKeyMap allocates schemaKeyMaps (and only that)
// ---------------------------------------------------------------------------

describe("B97-R15 / withKeyMap allocates schemaKeyMaps", () => {
  it("B97-R15 / world.withKeyMap(schema, { foo: () => 'x' }) → schemaKeyMaps instanceof Map; others still null", () => {
    const Schema = z.object({ foo: z.string() });
    const world = createWorld({ seed: 1 }).withKeyMap(Schema, {
      foo: () => "x",
    });
    const m = inspectLazyMaps(world);
    expect(m.schemaKeyMaps).toBeInstanceOf(Map);
    expect(m.customKeyGenerators).toBe(null);
    expect(m.relationPools).toBe(null);
    expect(m.pendingCounts).toBe(null);
    expect(m.derivedUpsert).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// B97-R15 / Scenario 4 — withGenerators allocates customKeyGenerators
//
// Spec text says `withKeyGen({ ... })` but the actual public API is
// `withGenerators(map)` (see src/types.ts:319, src/world/engine.ts:404).
// The test uses `withGenerators` (the source of truth); test-writer
// reports the naming gap for the reviewer to reconcile.
// ---------------------------------------------------------------------------

describe("B97-R15 / withGenerators allocates customKeyGenerators", () => {
  it("B97-R15 / world.withGenerators({ foo: () => 'x' }) → customKeyGenerators instanceof Map; others still null", () => {
    const world = createWorld({ seed: 1 }).withGenerators({
      foo: () => "x",
    });
    const m = inspectLazyMaps(world);
    expect(m.customKeyGenerators).toBeInstanceOf(Map);
    expect(m.schemaKeyMaps).toBe(null);
    expect(m.relationPools).toBe(null);
    expect(m.pendingCounts).toBe(null);
    expect(m.derivedUpsert).toBe(null);
  });
});
