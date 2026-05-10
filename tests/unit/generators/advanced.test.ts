import { describe, it, expect } from "vitest";
import { z } from "zod";
import type { ZodTypeAny } from "zod";
import { createPrng } from "../../../src/prng.js";
import {
  generateFromSchema,
  UnsupportedSchemaError,
} from "../../../src/generators/schema/router.js";
import { SchemaRegistry } from "../../../src/registry.js";
import type { BoundGenerators, GeneratorContext } from "../../../src/types.js";

const EMPTY_GEN = {} as BoundGenerators;

function ctx(seed = 42): GeneratorContext {
  const prng = createPrng(seed);
  return {
    prng,
    gen: EMPTY_GEN,
    current: {},
    source: undefined,
    registry: new SchemaRegistry(prng.fork("reg")),
    fieldPath: "",
    optionalProbability: 0,
    related: <T>(_: string) => ({}) as T,
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
    const val = generateFromSchema(schema, ctx()) as { type: string; a?: string; b?: number };
    expect(["a", "b"]).toContain(val.type);
    if (val.type === "a") expect(typeof val.a).toBe("string");
    if (val.type === "b") expect(typeof val.b).toBe("number");
  });

  it("generates random json", () => {
    // Zod 4 json type is accessed via the internal router — test that the router handles it.
    const mockSchema = { _zod: { def: { type: "json" } } } as unknown as ZodTypeAny;
    const val = generateFromSchema(mockSchema, ctx());
    expect(val).toBeDefined();
  });

  it("generates from intersection", () => {
    const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }));
    const val = generateFromSchema(schema, ctx()) as { a: string; b: number };
    expect(typeof val.a).toBe("string");
    expect(typeof val.b).toBe("number");
  });
});
