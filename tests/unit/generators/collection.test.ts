import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createPrng } from "../../../src/prng.js";
import { generateFromSchema } from "../../../src/generators/schema/router.js";
import { SubjectRegistry } from "../../../src/registry.js";
import type { GeneratorContext } from "../../../src/types.js";

function ctx(seed = 42): GeneratorContext {
  const prng = createPrng(seed);
  return {
    prng,
    subject: undefined,
    registry: new SubjectRegistry(prng.fork("reg")),
    fieldPath: "",
    optionalProbability: 0,
  };
}

describe("schema/collection", () => {
  it("generates arrays", () => {
    const val = generateFromSchema(z.array(z.string()).min(2).max(4), ctx());
    expect(Array.isArray(val)).toBe(true);
    expect((val as any[]).length).toBeGreaterThanOrEqual(2);
    expect((val as any[]).length).toBeLessThanOrEqual(4);
    expect(typeof (val as any[])[0]).toBe("string");
  });

  it("generates tuples", () => {
    const val = generateFromSchema(z.tuple([z.string(), z.number()]), ctx());
    expect(Array.isArray(val)).toBe(true);
    expect((val as any[]).length).toBe(2);
    expect(typeof (val as any[])[0]).toBe("string");
    expect(typeof (val as any[])[1]).toBe("number");
  });

  it("generates objects", () => {
    const val = generateFromSchema(z.object({ a: z.string(), b: z.number() }), ctx());
    expect(typeof val).toBe("object");
    expect(val).not.toBeNull();
    expect(typeof (val as any).a).toBe("string");
    expect(typeof (val as any).b).toBe("number");
  });

  it("generates records", () => {
    const val = generateFromSchema(z.record(z.string(), z.number()), ctx());
    expect(typeof val).toBe("object");
    expect(val).not.toBeNull();
    const keys = Object.keys(val as any);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(typeof (val as any)[keys[0]!]).toBe("number");
  });
});
