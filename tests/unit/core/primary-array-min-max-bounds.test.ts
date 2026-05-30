/**
 * Unit tests for B43 — `world.generate(primaryArraySchema.min(N).max(M))`
 * silently ignores `.min()` / `.max()` modifiers. Closes GitHub issue
 * [#25](https://github.com/dxlbnl/zod4-mock/issues/25).
 *
 * Fix direction: honour caller-side bounds by slicing the registry to the
 * caller's specified `.max()` / `.length()` in `WorldImpl.generateArray`'s
 * primary-mode arm. Only the caller-written upper bound triggers the slice —
 * the library-side `defaultArrayLength[1]` fallback MUST NOT cap an
 * unbounded `.array()` call.
 *
 * Schemas module-scoped per D4 / D10 (per-schema slot keyed on identity).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

const Product = z.object({ id: z.uuid(), name: z.string() });

describe("B43: primary-array .min() / .max() honoured by slicing", () => {
  it("B43 / #25 repro: .min(2).max(2) slices registry of 6 to 2", () => {
    const world = createWorld({ seed: 1 }).withSchema(Product);
    world.populate(Product, 6);
    expect(world.generate(Product.array().min(2).max(2)).length).toBe(2);
  });

  it("B43 / .length(N) slices to N", () => {
    const world = createWorld({ seed: 1 }).withSchema(Product);
    world.populate(Product, 6);
    expect(world.generate(Product.array().length(3)).length).toBe(3);
  });

  it("B43 / no caller bound → return whole registry (no library-fallback cap)", () => {
    const world = createWorld({ seed: 1 }).withSchema(Product);
    world.populate(Product, 6);
    // Registry holds 6; default `defaultArrayLength` is [1, 5]. If we sliced
    // on the library-side `defMax`, we'd cap at 5. We must not.
    expect(world.generate(Product.array()).length).toBe(6);
  });

  it("B43 / sanity: registry < .min triggers top-up, returns >= min", () => {
    // Sanity pin on the existing top-up path: when the registry holds fewer
    // records than `.min`, `generateArray` tops it up via
    // `generateAndStorePrimary` until `count >= target`. With no `.max`, the
    // returned array is the full registry.
    const world = createWorld({ seed: 1 }).withSchema(Product);
    world.populate(Product, 2);
    const result = world.generate(Product.array().min(5));
    expect(result.length).toBeGreaterThanOrEqual(5);
  });
});
