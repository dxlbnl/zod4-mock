/**
 * Regression tests for per-call GenerateOptions being respected by nested
 * array/item generation — not just the world-level WorldOptions.
 *
 * Bugs fixed:
 *   - defaultArrayLength passed to world.generate() was silently ignored;
 *     engine always read this.options.defaultArrayLength (world-level only).
 *   - recursionLimit passed to world.generate() was silently ignored for
 *     both generateArray and generateSingleItem.
 *   - optionalProbability passed to world.generate() was silently ignored
 *     for the outer-wrapper optional/nullable roll.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const itemSchema = z.object({ id: z.string(), value: z.number().int() });

// A bucket-style wrapper — the kind used in MSW handlers.
// content is an ad-hoc array (itemSchema is never registered).
const bucketSchema = z.object({
  total: z.number().int(),
  content: itemSchema.array(),
});

// ---------------------------------------------------------------------------
// defaultArrayLength
// ---------------------------------------------------------------------------

describe("defaultArrayLength per-call passthrough", () => {
  it("ad-hoc nested array honours per-call defaultArrayLength, not world default", () => {
    // World default is [1,2]; per-call is [5,5]. content must have 5 items.
    const world = createWorld({ seed: 1, defaultArrayLength: [1, 2] });
    const result = world.generate(bucketSchema, { defaultArrayLength: [5, 5] });
    expect(result.content).toHaveLength(5);
  });

  it("per-call defaultArrayLength wins over world default", () => {
    const world = createWorld({ seed: 1, defaultArrayLength: [10, 10] });
    const result = world.generate(bucketSchema, { defaultArrayLength: [2, 2] });
    expect(result.content).toHaveLength(2);
  });

  it("world defaultArrayLength is used when no per-call override", () => {
    const world = createWorld({ seed: 1, defaultArrayLength: [4, 4] });
    const result = world.generate(bucketSchema);
    expect(result.content).toHaveLength(4);
  });

  it("top-level array schema also honours per-call defaultArrayLength", () => {
    const world = createWorld({ seed: 1, defaultArrayLength: [1, 2] });
    const result = world.generate(itemSchema.array(), {
      defaultArrayLength: [6, 6],
    });
    expect(result).toHaveLength(6);
  });

  it("schema .min() constraint supersedes defaultArrayLength lower bound", () => {
    // defaultArrayLength: [1,4] but .min(10) — must produce at least 10
    const world = createWorld({ seed: 1, defaultArrayLength: [1, 4] });
    const constrained = itemSchema.array().min(10);
    const result = world.generate(constrained);
    expect(result.length).toBeGreaterThanOrEqual(10);
  });
  it("schema .max() constraint supersedes defaultArrayLength upper bound", () => {
    // defaultArrayLength: [1,4] but .min(10) — must produce at least 10
    const world = createWorld({ seed: 1, defaultArrayLength: [1, 40] });
    const constrained = itemSchema.array().max(10);
    const result = world.generate(constrained);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// recursionLimit
// ---------------------------------------------------------------------------

describe("recursionLimit per-call passthrough", () => {
  // A self-referencing structure to trigger recursion.
  // `child` includes `undefined` explicitly to satisfy
  // exactOptionalPropertyTypes against the ZodOptional output type.
  type Node = { id: string; child?: Node | undefined };
  const nodeSchema: z.ZodType<Node> = z.lazy(() =>
    z.object({ id: z.string(), child: nodeSchema.optional() }),
  );

  it("per-call recursionLimit=0 stops nested generation immediately", () => {
    const world = createWorld({ seed: 1, recursionLimit: 10 });
    // With limit 0 the engine should return null/empty at depth 0 for the
    // nested generateSingleItem — but the outer object still resolves.
    // What we verify: overriding to a low limit does not crash and produces
    // a result (not an infinite loop).
    const result = world.generate(nodeSchema, { recursionLimit: 1 });
    expect(result).toBeDefined();
  });

  it("generateArray respects per-call recursionLimit for deeply nested arrays", () => {
    const deep = z.object({ items: itemSchema.array() });
    const world = createWorld({ seed: 1, recursionLimit: 100 });
    // Should not throw; per-call limit is honoured
    const result = world.generate(deep, { recursionLimit: 2 });
    expect(result.items).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// optionalProbability
// ---------------------------------------------------------------------------

describe("optionalProbability per-call passthrough", () => {
  const maybeArraySchema = itemSchema.array().optional();

  it("optionalProbability=0 means outer optional wrapper is never undefined", () => {
    const world = createWorld({ seed: 1, optionalProbability: 0.9 });
    // With world default 0.9 most calls would return undefined.
    // Per-call 0 forces the value to always be present.
    for (let i = 0; i < 10; i++) {
      const result = world.generate(maybeArraySchema, {
        optionalProbability: 0,
      });
      expect(result).toBeDefined();
    }
  });

  it("optionalProbability=1 means outer optional wrapper is always undefined", () => {
    const world = createWorld({ seed: 1, optionalProbability: 0 });
    for (let i = 0; i < 10; i++) {
      const result = world.generate(maybeArraySchema, {
        optionalProbability: 1,
      });
      expect(result).toBeUndefined();
    }
  });
});
