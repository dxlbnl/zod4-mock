import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createPrng } from "../../../src/prng.js";
import { generateFromSchema } from "../../../src/generators/schema/router.js";
import { SchemaRegistry } from "../../../src/registry.js";
import type { BoundGenerators, GeneratorContext } from "../../../src/types.js";

const EMPTY_GEN: BoundGenerators = {};

function ctx(seed = 42): GeneratorContext {
  const prng = createPrng(seed);
  return {
    prng,
    gen: EMPTY_GEN,
    source: undefined,
    registry: new SchemaRegistry(prng.fork("reg")),
    fieldPath: "",
    optionalProbability: 0,
    related: <T>(_: string) => ({}) as T,
  };
}

describe("schema/collection", () => {
  it("generates arrays", () => {
    const val = generateFromSchema(z.array(z.string()).min(2).max(4), ctx()) as string[];
    expect(Array.isArray(val)).toBe(true);
    expect(val.length).toBeGreaterThanOrEqual(2);
    expect(val.length).toBeLessThanOrEqual(4);
    expect(typeof val[0]).toBe("string");
  });

  it("generates tuples", () => {
    const val = generateFromSchema(z.tuple([z.string(), z.number()]), ctx()) as [string, number];
    expect(Array.isArray(val)).toBe(true);
    expect(val.length).toBe(2);
    expect(typeof val[0]).toBe("string");
    expect(typeof val[1]).toBe("number");
  });

  it("generates objects", () => {
    const val = generateFromSchema(z.object({ a: z.string(), b: z.number() }), ctx()) as { a: string; b: number };
    expect(typeof val).toBe("object");
    expect(val).not.toBeNull();
    expect(typeof val.a).toBe("string");
    expect(typeof val.b).toBe("number");
  });

  it("generates records", () => {
    const val = generateFromSchema(z.record(z.string(), z.number()), ctx()) as Record<string, number>;
    expect(typeof val).toBe("object");
    expect(val).not.toBeNull();
    const keys = Object.keys(val);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(typeof val[keys[0]!]).toBe("number");
  });
});
