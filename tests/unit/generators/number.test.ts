import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createPrng } from "../../../src/prng.js";
import { generateFromSchema } from "../../../src/generators/schema/router.js";
import { SchemaRegistry } from "../../../src/registry.js";
import type { BoundGenerators, GenerateOptions, GeneratorContext } from "../../../src/types.js";

const EMPTY_GEN = {} as BoundGenerators;

function ctx(seed = 42): GeneratorContext {
  const prng = createPrng(seed);
  const c: GeneratorContext = {
    prng,
    gen: EMPTY_GEN,
    current: {},
    source: undefined,
    registry: new SchemaRegistry(prng.fork("reg")),
    fieldPath: "",
    optionalProbability: 0,
    related: <T>(_: string) => ({}) as T,
    generate<S extends z.ZodTypeAny>(s: S, o?: GenerateOptions<z.infer<S>>) {
      const depth = (o?.fieldPath ?? this.fieldPath).split(".").filter(Boolean).length;
      if (depth > this.recursionLimit) return null as any;
      return generateFromSchema(s, { ...this, ...o }) as z.infer<S>;
    },
    recursionLimit: 5,
  };
  return c;
}

describe("schema/number", () => {
  it("generates random numbers", () => {
    const val = generateFromSchema(z.number(), ctx());
    expect(typeof val).toBe("number");
  });

  it("respects min and max", () => {
    const val = generateFromSchema(z.number().min(10).max(20), ctx());
    expect(val).toBeGreaterThanOrEqual(10);
    expect(val).toBeLessThanOrEqual(20);
  });

  it("respects int", () => {
    const val = generateFromSchema(z.number().int().min(1).max(5), ctx());
    expect(val).toBe(Math.floor(val as number));
    expect(val).toBeGreaterThanOrEqual(1);
    expect(val).toBeLessThanOrEqual(5);
  });

  it("generates random bigints", () => {
    const val = generateFromSchema(z.bigint().min(BigInt(10)).max(BigInt(20)), ctx());
    expect(typeof val).toBe("bigint");
    expect(val).toBeGreaterThanOrEqual(BigInt(10));
    expect(val).toBeLessThanOrEqual(BigInt(20));
  });
});
