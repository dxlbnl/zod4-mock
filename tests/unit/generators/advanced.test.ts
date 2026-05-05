import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createPrng } from "../../../src/prng.js";
import {
  generateFromSchema,
  UnsupportedSchemaError,
} from "../../../src/generators/schema/router.js";
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

describe("schema/advanced", () => {
  it("throws on unsupported schemas", () => {
    expect(() => generateFromSchema(z.function(), ctx())).toThrow(UnsupportedSchemaError);
    expect(() =>
      generateFromSchema(
        z.custom(() => true),
        ctx(),
      ),
    ).toThrow(UnsupportedSchemaError);
    expect(() => generateFromSchema(z.instanceof(Date), ctx())).toThrow(UnsupportedSchemaError);
  });

  it("generates from discriminatedUnion", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("a"), a: z.string() }),
      z.object({ type: z.literal("b"), b: z.number() }),
    ]);
    const val = generateFromSchema(schema, ctx()) as any;
    expect(["a", "b"]).toContain(val.type);
    if (val.type === "a") expect(typeof val.a).toBe("string");
    if (val.type === "b") expect(typeof val.b).toBe("number");
  });

  it("generates random json", () => {
    // Actually Zod 4 json() might not be exposed as z.json() directly.
    // It's just a test to make sure json type works if passed.
    // Zod 4 usually uses custom for json or a lazy schema.
    // But if our router catches 'json' type, it should return json.
    const mockSchema = { _zod: { def: { type: "json" } } } as any;
    const val = generateFromSchema(mockSchema, ctx());
    expect(val).toBeDefined();
  });

  it("generates from intersection", () => {
    const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }));
    const val = generateFromSchema(schema, ctx()) as any;
    expect(typeof val.a).toBe("string");
    expect(typeof val.b).toBe("number");
  });
});
