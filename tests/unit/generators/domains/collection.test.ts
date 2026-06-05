import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createPrng } from "../../../../src/prng.js";
import { generateFromSchema } from "../../../../src/generators/schema/router.js";
import { SchemaRegistry } from "../../../../src/registry.js";
import type { BoundGenerators, GenerateOptions, GeneratorContext } from "../../../../src/types.js";
import { en } from "@zod4-mock/locale-en";
import { generate, createWorld } from "../../../../src/index.js";

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
    defaultArrayLength: [1, 5] as const,
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

  // -------------------------------------------------------------------------
  // B17 — z.record(enum, V) should exhaust the enum's declared key set
  //
  // Bug: generateZodRecord unconditionally picks ctx.prng.int(2, 5) keys even
  // when the keyType is a finite enum. The inferred type of
  // `z.record(z.enum([...]), V)` is strict over the enum's members, so a random
  // subset fails schema.parse() at the consumer. Spec: B17-R1, R4, R5, R6.
  // -------------------------------------------------------------------------

  it("B17-R1 / three-member enum produces all three keys, in declared order", () => {
    const Status = z.enum(["PENDING", "IN_PROGRESS", "DONE"]);
    const schema = z.record(Status, z.number());

    const value = generate(schema, { seed: 1 }) as Record<string, number>;

    // Declared order — not alphabetical, not insertion-order-by-random-pick.
    expect(Object.keys(value)).toEqual(["PENDING", "IN_PROGRESS", "DONE"]);
    expect(schema.safeParse(value).success).toBe(true);
    for (const key of ["PENDING", "IN_PROGRESS", "DONE"]) {
      expect(typeof value[key]).toBe("number");
    }
  });

  it("B17-R1 / single-member enum produces a single entry", () => {
    const One = z.enum(["ONLY"]);
    const schema = z.record(One, z.string());

    const value = generate(schema, { seed: 1 }) as Record<string, string>;

    expect(Object.keys(value)).toEqual(["ONLY"]);
    expect(schema.safeParse(value).success).toBe(true);
  });

  it("B17-R1 / empty enum produces {}", () => {
    // An empty enum has no parse-time keys; the record must be {}.
    // Zod's z.enum type requires a non-empty tuple; the spec deliberately
    // covers the runtime empty case so we go through `unknown` rather than
    // `any` (per the no-`any` rule in architecture.md).
    const Empty = z.enum([] as unknown as [string, ...string[]]);
    const schema = z.record(Empty, z.number());

    const value = generate(schema, { seed: 1 }) as Record<string, number>;

    expect(value).toEqual({});
    expect(schema.safeParse(value).success).toBe(true);
  });

  it("B17-R4 / z.record(z.string(), z.number()) unchanged at a fixed seed", () => {
    // Regression guard: the open-key path keeps today's 2–5 random-key behaviour.
    // Two runs at the same seed must deep-equal; both runs must have 2–5 entries
    // with string keys and number values.
    const schema = z.record(z.string(), z.number());

    const a = generate(schema, { seed: 1 }) as Record<string, number>;
    const b = generate(schema, { seed: 1 }) as Record<string, number>;

    expect(a).toEqual(b);
    const keys = Object.keys(a);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys.length).toBeLessThanOrEqual(5);
    for (const k of keys) {
      expect(typeof k).toBe("string");
      expect(typeof a[k]).toBe("number");
    }
  });

  it("B17-R4 / z.record(z.number(), z.string()) unchanged at a fixed seed", () => {
    // Regression guard: numeric open-key path also unchanged at a fixed seed.
    const schema = z.record(z.number(), z.string());

    const a = generate(schema, { seed: 1 }) as Record<string, string>;
    const b = generate(schema, { seed: 1 }) as Record<string, string>;

    expect(a).toEqual(b);
    const keys = Object.keys(a);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys.length).toBeLessThanOrEqual(5);
    for (const k of keys) {
      expect(typeof a[k]).toBe("string");
    }
  });

  it("B17-R5 / card repro — Status enum record, all three keys + safeParse green", () => {
    // Mandatory regression test for the exact card repro (D6, GitHub issue #18).
    // Both halves of the assertion must hold so this test fails if either the
    // "all keys present" property or the "satisfies the strict-key inferred type"
    // property ever regresses.
    const Status = z.enum(["PENDING", "IN_PROGRESS", "DONE"]);
    const schema = z.record(Status, z.number());

    const value = generate(schema) as Record<string, number>;

    // (a) — sorted to make the assertion stable regardless of declared-order
    // assertion in B17-R1; a regression to "missing one key" fails this.
    expect(Object.keys(value).sort()).toEqual(["DONE", "IN_PROGRESS", "PENDING"]);
    // (b) — strict-key inferred type satisfied (every member present + value type).
    expect(schema.safeParse(value).success).toBe(true);
  });

  it("B17-R6 / appending an enum member only disturbs the new member's value", () => {
    // Per the spec, the per-key value PRNG is forked by entry index (`rv-${i}`).
    // Iterating in declared order means appending 'C' at the end of the enum
    // disturbs only C's value — A and B at index 0 and 1 are byte-identical
    // across the two schemas at the same seed.
    //
    // Under B39/D10 (reference-identity determinism) the shared value schema
    // `Num` MUST be hoisted: inline `z.number()` calls would each get a
    // distinct schema identity, so A and B's fork keys would diverge between
    // S1 and S2. Hoisting preserves the B17-R6 intent under the new contract.
    const Num = z.number();
    const E1 = z.enum(["A", "B"]);
    const S1 = z.record(E1, Num);
    const E2 = z.enum(["A", "B", "C"]);
    const S2 = z.record(E2, Num);

    const v1 = generate(S1, { seed: 1 }) as Record<string, number>;
    const v2 = generate(S2, { seed: 1 }) as Record<string, number>;

    expect(v1.A).toBe(v2.A);
    expect(v1.B).toBe(v2.B);
    expect(typeof v2.C).toBe("number");
  });

  it("B17-R6 / same enum and same seed produces identical output across runs", () => {
    // Determinism: same enum, same seed, two independent worlds → identical output.
    const Status = z.enum(["PENDING", "IN_PROGRESS", "DONE"]);
    const schema = z.record(Status, z.number());

    const w1 = createWorld({ seed: 42 });
    const w2 = createWorld({ seed: 42 });

    const v1 = w1.generate(schema) as Record<string, number>;
    const v2 = w2.generate(schema) as Record<string, number>;

    expect(v1).toEqual(v2);
  });
});

// ---------------------------------------------------------------------------
// generateZodMap — previously uncovered
// ---------------------------------------------------------------------------

describe("schema/collection — z.map()", () => {
  it("generates a Map with 2–4 entries", () => {
    const schema = z.map(z.string(), z.number());
    const result = generateFromSchema(schema, ctx()) as Map<string, number>;
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBeGreaterThanOrEqual(2);
    expect(result.size).toBeLessThanOrEqual(4);
  });

  it("keys are strings, values are numbers", () => {
    const schema = z.map(z.string(), z.number());
    const result = generateFromSchema(schema, ctx()) as Map<string, number>;
    for (const [k, v] of result) {
      expect(typeof k).toBe("string");
      expect(typeof v).toBe("number");
    }
  });

  it("is deterministic for the same seed", () => {
    const schema = z.map(z.string(), z.number());
    const r1 = generateFromSchema(schema, ctx(7)) as Map<string, number>;
    const r2 = generateFromSchema(schema, ctx(7)) as Map<string, number>;
    expect([...r1.entries()]).toEqual([...r2.entries()]);
  });

  it("works with non-string keys (z.number() key)", () => {
    const schema = z.map(z.number(), z.string());
    const result = generateFromSchema(schema, ctx()) as Map<number, string>;
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBeGreaterThanOrEqual(2);
    for (const [k, v] of result) {
      expect(typeof k).toBe("number");
      expect(typeof v).toBe("string");
    }
  });

  it("via world.generate produces a Map", () => {
    const schema = z.map(z.string(), z.boolean());
    const result = createWorld({ seed: 1 }).generate(schema) as Map<string, boolean>;
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// generateZodSet — previously uncovered
// ---------------------------------------------------------------------------

describe("schema/collection — z.set()", () => {
  it("generates a Set with 1–4 entries (default bounds)", () => {
    const schema = z.set(z.string());
    const result = generateFromSchema(schema, ctx()) as Set<string>;
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBeGreaterThanOrEqual(1);
    expect(result.size).toBeLessThanOrEqual(4);
  });

  it("all entries satisfy the element type", () => {
    const schema = z.set(z.number().int().min(0).max(1000));
    const result = generateFromSchema(schema, ctx()) as Set<number>;
    for (const v of result) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1000);
    }
  });

  it("respects .min() / .max() size constraints", () => {
    const schema = z.set(z.string()).min(3).max(3);
    const result = generateFromSchema(schema, ctx()) as Set<string>;
    expect(result.size).toBe(3);
  });

  it("is deterministic for the same seed", () => {
    const schema = z.set(z.string());
    const r1 = generateFromSchema(schema, ctx(99)) as Set<string>;
    const r2 = generateFromSchema(schema, ctx(99)) as Set<string>;
    expect([...r1]).toEqual([...r2]);
  });

  it("via world.generate produces a Set", () => {
    const schema = z.set(z.number().int());
    const result = createWorld({ seed: 1 }).generate(schema) as Set<number>;
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBeGreaterThanOrEqual(1);
  });
});
