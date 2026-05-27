import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createPrng } from "../../../../src/prng.js";
import { generateFromSchema } from "../../../../src/generators/schema/router.js";
import { SchemaRegistry } from "../../../../src/registry.js";
import type { BoundGenerators, GenerateOptions, GeneratorContext } from "../../../../src/types.js";
import { en } from "@zod4-mock/locale-en";

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
    related: Object.assign(<T>(_: string) => ({}) as T, {
      many: <T>(_: string, __: number) => [] as T[],
    }),
    generate<S extends z.ZodTypeAny>(s: S, o?: GenerateOptions<z.infer<S>>) {
      const depth = (o?.fieldPath ?? this.fieldPath).split(".").filter(Boolean).length;
      if (depth > this.recursionLimit) return null as any;
      return generateFromSchema(s, { ...this, ...o }) as z.infer<S>;
    },
    recursionLimit: 5,
    locale: en,
  };
  return c;
}

describe("batch array generation (ZodObject elements)", () => {
  const UserSchema = z.object({ name: z.string(), age: z.number() });

  it("produces a deterministic array with the same seed", () => {
    const a = ctx(42).generate(z.array(UserSchema).length(10));
    const b = ctx(42).generate(z.array(UserSchema).length(10));
    expect(a).toEqual(b);
  });

  it("elements differ from each other", () => {
    const arr = ctx(42).generate(z.array(UserSchema).length(5)) as Array<{ name: string }>;
    expect(new Set(arr.map((u) => u.name)).size).toBeGreaterThan(1);
  });

  it("batch array has correct shape", () => {
    const arr = ctx(42).generate(z.array(UserSchema).length(20)) as Array<{
      name: string;
      age: number;
    }>;
    expect(arr).toHaveLength(20);
    for (const u of arr) {
      expect(typeof u.name).toBe("string");
      expect(typeof u.age).toBe("number");
    }
  });

  it("large array (1000 elements) is deterministic", () => {
    const BigSchema = z.object({ id: z.string(), val: z.number(), label: z.string() });
    const a = ctx(1).generate(z.array(BigSchema).length(1000));
    const b = ctx(1).generate(z.array(BigSchema).length(1000));
    expect(a).toEqual(b);
  });
});

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
    const val = generateFromSchema(z.object({ a: z.string(), b: z.number() }), ctx()) as {
      a: string;
      b: number;
    };
    expect(typeof val).toBe("object");
    expect(val).not.toBeNull();
    expect(typeof val.a).toBe("string");
    expect(typeof val.b).toBe("number");
  });

  it("generates records", () => {
    const val = generateFromSchema(z.record(z.string(), z.number()), ctx()) as Record<
      string,
      number
    >;
    expect(typeof val).toBe("object");
    expect(val).not.toBeNull();
    const keys = Object.keys(val);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(typeof val[keys[0]!]).toBe("number");
  });
});
