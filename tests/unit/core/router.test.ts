import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generateFromSchema } from "../../../src/generators/schema/router.js";
import { createWorld } from "../../../src/index.js";

describe("router - generateFromSchema", () => {
  const world = createWorld();
  const prng = world.prng;
  const ctx = {
    prng,
    optionalProbability: 0.2,
    generate: (s: any) => generateFromSchema(s, ctx),
    fork: (seed: string) => ({ ...ctx, prng: prng.fork(seed) }),
    // ... other ctx fields if needed
  } as any;

  it("routes to string generator", () => {
    const result = generateFromSchema(z.string(), ctx);
    expect(typeof result).toBe("string");
  });

  it("routes to number generator", () => {
    const result = generateFromSchema(z.number(), ctx);
    expect(typeof result).toBe("number");
  });

  it("handles optionality by sometimes returning undefined", () => {
    const schema = z.string().optional();
    const results = Array.from({ length: 100 }, () =>
      generateFromSchema(schema, { ...ctx, optionalProbability: 0.5 }),
    );
    expect(results.some((r) => r === undefined)).toBe(true);
    expect(results.some((r) => typeof r === "string")).toBe(true);
  });

  it("handles nullability by sometimes returning null", () => {
    const schema = z.string().nullable();
    const results = Array.from({ length: 100 }, () =>
      generateFromSchema(schema, { ...ctx, optionalProbability: 0.5 }),
    );
    expect(results.some((r) => r === null)).toBe(true);
    expect(results.some((r) => typeof r === "string")).toBe(true);
  });

  it("handles literal types", () => {
    expect(generateFromSchema(z.literal("hello"), ctx)).toBe("hello");
    expect(generateFromSchema(z.literal(123), ctx)).toBe(123);
    expect(generateFromSchema(z.literal(true), ctx)).toBe(true);
  });

  it("handles enums", () => {
    const schema = z.enum(["A", "B", "C"]);
    const result = generateFromSchema(schema, ctx);
    expect(["A", "B", "C"]).toContain(result);
  });

  it("handles unions", () => {
    const schema = z.union([z.string(), z.number()]);
    const results = Array.from({ length: 50 }, () => generateFromSchema(schema, ctx));
    expect(results.some((r) => typeof r === "string")).toBe(true);
    expect(results.some((r) => typeof r === "number")).toBe(true);
  });
});
