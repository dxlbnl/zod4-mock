/**
 * Unit tests for the low-level generator functions.
 *
 * These test `generateFromSchema` and `generateFromKey` in isolation, without
 * a full world. A minimal `GeneratorContext` is constructed inline.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generateFromSchema, generateFromKey, createPrng } from "../../../src/index.js";
import type { BoundGenerators, GeneratorContext, Registry } from "../../../src/index.js";
import { en } from "@zod4-mock/locale-en";

// ---------------------------------------------------------------------------
// Minimal stub registry for isolated generator tests
// ---------------------------------------------------------------------------

const stubRegistry: Registry = {
  store: () => {
    /* no-op */
  },
  all: () => [],
  pick: () => {
    throw new Error("no items in stub registry");
  },
  filter: () => [],
  find: () => undefined,
  count: () => 0,
};

function makeCtx(seed = 42, fieldPath = "test"): GeneratorContext {
  const prng = createPrng(seed);
  const gen = {} as BoundGenerators;
  const ctx: GeneratorContext = {
    prng,
    gen,
    source: undefined,
    registry: stubRegistry,
    fieldPath,
    optionalProbability: 0.2,
    related: Object.assign(<T>(_: string) => ({}) as T, {
      many: <T>(_: string, __: number) => [] as T[],
    }),
    generate<S extends z.ZodTypeAny>(s: S, o?: any) {
      const depth = (o?.fieldPath ?? this.fieldPath).split(".").filter(Boolean).length;
      if (depth > this.recursionLimit) return null as any;

      let current = s as any;
      let d = (current as any)._zod.def;
      while (d.type === "lazy") {
        current = d.getter();
        d = current._zod.def;
      }
      return generateFromSchema(current, { ...this, ...o }) as z.infer<S>;
    },
    recursionLimit: 5,
    current: {},
    locale: en,
    defaultArrayLength: [1, 5] as const,
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// generateFromSchema — primitive types
// ---------------------------------------------------------------------------

describe("generateFromSchema — primitives", () => {
  it("generates a string for z.string()", () => {
    expect(typeof generateFromSchema(z.string(), makeCtx())).toBe("string");
  });

  it("generates a number for z.number()", () => {
    expect(typeof generateFromSchema(z.number(), makeCtx())).toBe("number");
  });

  it("generates a boolean for z.boolean()", () => {
    expect(typeof generateFromSchema(z.boolean(), makeCtx())).toBe("boolean");
  });

  it("generates a Date for z.date()", () => {
    expect(generateFromSchema(z.date(), makeCtx())).toBeInstanceOf(Date);
  });

  it("generates a valid integer within range for z.number().int().min().max()", () => {
    const schema = z.number().int().min(5).max(10);
    const v = generateFromSchema(schema, makeCtx()) as number;
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(5);
    expect(v).toBeLessThanOrEqual(10);
  });

  it("stays within range over many calls", () => {
    const schema = z.number().int().min(0).max(100);
    for (let i = 0; i < 100; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as number;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — string formats
// ---------------------------------------------------------------------------

describe("generateFromSchema — string formats", () => {
  it("generates a valid email for z.email()", () => {
    const v = generateFromSchema(z.email(), makeCtx()) as string;
    expect(v).toMatch(/@/);
    expect(z.email().safeParse(v).success).toBe(true);
  });

  it("generates a valid UUID for z.uuid()", () => {
    const v = generateFromSchema(z.uuid(), makeCtx()) as string;
    expect(v).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(z.uuid().safeParse(v).success).toBe(true);
  });

  it("generates a string respecting .min() length", () => {
    const schema = z.string().min(10);
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(v.length).toBeGreaterThanOrEqual(10);
  });

  it("generates a string respecting .max() length", () => {
    const schema = z.string().max(5);
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(v.length).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — composite types
// ---------------------------------------------------------------------------

describe("generateFromSchema — composite types", () => {
  it("generates a member of z.enum()", () => {
    const schema = z.enum(["a", "b", "c"]);
    for (let i = 0; i < 30; i++) {
      const v = generateFromSchema(schema, makeCtx(i));
      expect(["a", "b", "c"]).toContain(v);
    }
  });

  it("generates all fields of z.object()", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const v = generateFromSchema(schema, makeCtx()) as {
      name: string;
      age: number;
    };
    expect(typeof v.name).toBe("string");
    expect(typeof v.age).toBe("number");
  });

  it("generates an array for z.array()", () => {
    const v = generateFromSchema(z.array(z.string()), makeCtx());
    expect(Array.isArray(v)).toBe(true);
  });

  it("z.array().length(n) generates exactly n items", () => {
    const v = generateFromSchema(z.array(z.string()).length(4), makeCtx()) as unknown[];
    expect(v).toHaveLength(4);
  });

  it("generates a value for z.literal()", () => {
    expect(generateFromSchema(z.literal("hello"), makeCtx())).toBe("hello");
    expect(generateFromSchema(z.literal(42), makeCtx())).toBe(42);
    expect(generateFromSchema(z.literal(true), makeCtx())).toBe(true);
  });

  it("generates null or a value for z.nullable()", () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      generateFromSchema(z.nullable(z.string()), makeCtx(i)),
    );
    expect(results.some((r) => r === null)).toBe(true);
    expect(results.some((r) => typeof r === "string")).toBe(true);
  });

  it("generates undefined or a value for z.optional()", () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      generateFromSchema(z.optional(z.string()), makeCtx(i)),
    );
    expect(results.some((r) => r === undefined)).toBe(true);
    expect(results.some((r) => typeof r === "string")).toBe(true);
  });

  it("generates a nested object recursively", () => {
    const schema = z.object({
      name: z.string(),
      address: z.object({
        street: z.string(),
        city: z.string(),
      }),
    });
    const v = generateFromSchema(schema, makeCtx()) as {
      name: string;
      address: { street: string; city: string };
    };
    expect(typeof v.name).toBe("string");
    expect(typeof v.address.street).toBe("string");
    expect(typeof v.address.city).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// generateFromKey — key-based generators
// ---------------------------------------------------------------------------

describe("generateFromKey", () => {
  it("does not throw for an unrecognised key", () => {
    expect(() => generateFromKey("zzz_unknown_field_xyz", z.string(), makeCtx())).not.toThrow();
  });

  it('generates a non-empty string for key "firstName"', () => {
    const v = generateFromKey("firstName", z.string(), makeCtx());
    expect(typeof v).toBe("string");
    expect((v as string).length).toBeGreaterThan(0);
  });

  it('generates a non-empty string for key "lastName"', () => {
    const v = generateFromKey("lastName", z.string(), makeCtx());
    expect(typeof v).toBe("string");
    expect((v as string).length).toBeGreaterThan(0);
  });

  it('generates an email-shaped string for key "email"', () => {
    const v = generateFromKey("email", z.string(), makeCtx());
    expect(typeof v).toBe("string");
    expect(v as string).toMatch(/@/);
  });

  it('generates a valid email for key "email"', () => {
    const v = generateFromKey("email", z.string(), makeCtx());
    expect(z.email().safeParse(v).success).toBe(true);
  });

  it('generates a UUID-shaped value for key "id"', () => {
    const v = generateFromKey("id", z.uuid(), makeCtx());
    expect(z.uuid().safeParse(v).success).toBe(true);
  });

  it('generates a UUID-shaped value for keys ending in "Id"', () => {
    const v = generateFromKey("userId", z.uuid(), makeCtx());
    expect(z.uuid().safeParse(v).success).toBe(true);
  });

  it("generates different values for different seeds", () => {
    const a = generateFromKey("firstName", z.string(), makeCtx(1));
    const b = generateFromKey("firstName", z.string(), makeCtx(2));
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — new string formats
// ---------------------------------------------------------------------------

describe("generateFromSchema — new string formats", () => {
  it("generates a valid cuid for z.cuid()", () => {
    const schema = z.cuid();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid cuid2 for z.cuid2()", () => {
    const schema = z.cuid2();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid ulid for z.ulid()", () => {
    const schema = z.ulid();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid nanoid for z.nanoid()", () => {
    const schema = z.nanoid();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates valid base64 for z.base64()", () => {
    const schema = z.base64();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates valid base64url for z.base64url()", () => {
    const schema = z.base64url();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid JWT for z.jwt()", () => {
    const schema = z.jwt();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid emoji for z.emoji()", () => {
    const schema = z.emoji();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid e164 phone for z.e164()", () => {
    const schema = z.e164();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid cidrv4 for z.cidrv4()", () => {
    const schema = z.cidrv4();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid cidrv6 for z.cidrv6()", () => {
    const schema = z.cidrv6();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid ISO date for z.iso.date()", () => {
    const schema = z.iso.date();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid ISO time for z.iso.time()", () => {
    const schema = z.iso.time();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid ISO datetime for z.iso.datetime()", () => {
    const schema = z.iso.datetime();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a valid ISO duration for z.iso.duration()", () => {
    const schema = z.iso.duration();
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a string starting with the required prefix for .startsWith()", () => {
    const schema = z.string().startsWith("hello");
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
    expect(v.startsWith("hello")).toBe(true);
  });

  it("generates a string ending with the required suffix for .endsWith()", () => {
    const schema = z.string().endsWith("world");
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
    expect(v.endsWith("world")).toBe(true);
  });

  it("generates a string containing the required substring for .includes()", () => {
    const schema = z.string().includes("test");
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
    expect(v.includes("test")).toBe(true);
  });

  it("generates a string matching a simple anchored regex", () => {
    const schema = z.string().regex(/^alpha$/);
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a string matching a digit pattern regex", () => {
    const schema = z.string().regex(/^\d{4}$/);
    const v = generateFromSchema(schema, makeCtx()) as string;
    expect(schema.safeParse(v).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — z.int() and z.int32()
// ---------------------------------------------------------------------------

describe("generateFromSchema — z.int() and z.int32()", () => {
  it("generates a safe integer for z.int()", () => {
    const schema = z.int();
    const v = generateFromSchema(schema, makeCtx()) as number;
    expect(Number.isInteger(v)).toBe(true);
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a 32-bit integer for z.int32()", () => {
    const schema = z.int32();
    const v = generateFromSchema(schema, makeCtx()) as number;
    expect(Number.isInteger(v)).toBe(true);
    expect(schema.safeParse(v).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — number multiple_of
// ---------------------------------------------------------------------------

describe("generateFromSchema — number multiple_of", () => {
  it("generates a multiple of 5", () => {
    const schema = z.number().multipleOf(5);
    for (let i = 0; i < 20; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as number;
      expect(schema.safeParse(v).success).toBe(true);
      expect(Math.abs(v % 5)).toBe(0);
    }
  });

  it("generates a multiple of 3 within range", () => {
    const schema = z.number().int().min(0).max(30).multipleOf(3);
    for (let i = 0; i < 20; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as number;
      expect(schema.safeParse(v).success).toBe(true);
      expect(v % 3).toBe(0);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(30);
    }
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — date constraints
// ---------------------------------------------------------------------------

describe("generateFromSchema — date constraints", () => {
  it("respects .min() on z.date()", () => {
    const minDate = new Date("2024-01-01");
    const schema = z.date().min(minDate);
    for (let i = 0; i < 20; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as Date;
      expect(schema.safeParse(v).success).toBe(true);
      expect(v.getTime()).toBeGreaterThanOrEqual(minDate.getTime());
    }
  });

  it("respects .max() on z.date()", () => {
    const maxDate = new Date("2022-12-31");
    const schema = z.date().max(maxDate);
    for (let i = 0; i < 20; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as Date;
      expect(schema.safeParse(v).success).toBe(true);
      expect(v.getTime()).toBeLessThanOrEqual(maxDate.getTime());
    }
  });

  it("respects both .min() and .max() on z.date()", () => {
    const minDate = new Date("2023-06-01");
    const maxDate = new Date("2023-06-30");
    const schema = z.date().min(minDate).max(maxDate);
    for (let i = 0; i < 20; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as Date;
      expect(schema.safeParse(v).success).toBe(true);
      expect(v.getTime()).toBeGreaterThanOrEqual(minDate.getTime());
      expect(v.getTime()).toBeLessThanOrEqual(maxDate.getTime());
    }
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — tuple
// ---------------------------------------------------------------------------

describe("generateFromSchema — tuple", () => {
  it("generates a tuple with correct types at each position", () => {
    const schema = z.tuple([z.string(), z.number(), z.boolean()]);
    const v = generateFromSchema(schema, makeCtx()) as [string, number, boolean];
    expect(schema.safeParse(v).success).toBe(true);
    expect(typeof v[0]).toBe("string");
    expect(typeof v[1]).toBe("number");
    expect(typeof v[2]).toBe("boolean");
  });

  it("generates an array of the correct length", () => {
    const schema = z.tuple([z.string(), z.number()]);
    const v = generateFromSchema(schema, makeCtx()) as unknown[];
    expect(v).toHaveLength(2);
  });

  it("generates a tuple with rest elements", () => {
    const schema = z.tuple([z.string()]).rest(z.number());
    const v = generateFromSchema(schema, makeCtx()) as unknown[];
    expect(schema.safeParse(v).success).toBe(true);
    expect(typeof v[0]).toBe("string");
    for (let i = 1; i < v.length; i++) {
      expect(typeof v[i]).toBe("number");
    }
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — record
// ---------------------------------------------------------------------------

describe("generateFromSchema — record", () => {
  it("generates a record with string keys and number values", () => {
    const schema = z.record(z.string(), z.number());
    const v = generateFromSchema(schema, makeCtx()) as Record<string, number>;
    expect(schema.safeParse(v).success).toBe(true);
    expect(typeof v).toBe("object");
    for (const val of Object.values(v)) {
      expect(typeof val).toBe("number");
    }
  });

  it("generates a record with string keys and string values", () => {
    const schema = z.record(z.string(), z.string());
    const v = generateFromSchema(schema, makeCtx()) as Record<string, string>;
    expect(schema.safeParse(v).success).toBe(true);
    expect(Object.keys(v).length).toBeGreaterThan(0);
  });

  it("generates a record with at least one entry", () => {
    const schema = z.record(z.string(), z.boolean());
    const v = generateFromSchema(schema, makeCtx()) as Record<string, boolean>;
    expect(Object.keys(v).length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — map
// ---------------------------------------------------------------------------

describe("generateFromSchema — map", () => {
  it("generates a Map instance", () => {
    const schema = z.map(z.string(), z.number());
    const v = generateFromSchema(schema, makeCtx());
    expect(v).toBeInstanceOf(Map);
  });

  it("generates a Map that passes safeParse", () => {
    const schema = z.map(z.string(), z.number());
    const v = generateFromSchema(schema, makeCtx());
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a Map with correctly typed entries", () => {
    const schema = z.map(z.string(), z.boolean());
    const v = generateFromSchema(schema, makeCtx()) as Map<string, boolean>;
    for (const [k, val] of v) {
      expect(typeof k).toBe("string");
      expect(typeof val).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — set
// ---------------------------------------------------------------------------

describe("generateFromSchema — set", () => {
  it("generates a Set instance", () => {
    const schema = z.set(z.string());
    const v = generateFromSchema(schema, makeCtx());
    expect(v).toBeInstanceOf(Set);
  });

  it("generates a Set that passes safeParse", () => {
    const schema = z.set(z.number());
    const v = generateFromSchema(schema, makeCtx());
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("respects .min() on z.set()", () => {
    const schema = z.set(z.string()).min(3);
    for (let i = 0; i < 10; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as Set<string>;
      expect(schema.safeParse(v).success).toBe(true);
      expect(v.size).toBeGreaterThanOrEqual(3);
    }
  });

  it("respects .max() on z.set()", () => {
    const schema = z.set(z.string()).max(2);
    for (let i = 0; i < 10; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as Set<string>;
      expect(schema.safeParse(v).success).toBe(true);
      expect(v.size).toBeLessThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — intersection
// ---------------------------------------------------------------------------

describe("generateFromSchema — intersection", () => {
  it("generates an object satisfying both sides of z.intersection()", () => {
    const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }));
    const v = generateFromSchema(schema, makeCtx()) as { a: string; b: number };
    expect(schema.safeParse(v).success).toBe(true);
    expect(typeof v.a).toBe("string");
    expect(typeof v.b).toBe("number");
  });

  it("right-side fields overwrite left on key collision", () => {
    const schema = z.intersection(
      z.object({ x: z.literal("left") }),
      z.object({ x: z.literal("right") }),
    );
    const v = generateFromSchema(schema, makeCtx()) as { x: string };
    expect(v.x).toBe("right");
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — bigint
// ---------------------------------------------------------------------------

describe("generateFromSchema — bigint", () => {
  it("generates a BigInt for z.bigint()", () => {
    const v = generateFromSchema(z.bigint(), makeCtx());
    expect(typeof v).toBe("bigint");
  });

  it("generates a BigInt that passes safeParse", () => {
    const schema = z.bigint();
    const v = generateFromSchema(schema, makeCtx());
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("respects .min() on z.bigint()", () => {
    const schema = z.bigint().min(100n);
    for (let i = 0; i < 10; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as bigint;
      expect(schema.safeParse(v).success).toBe(true);
      expect(v).toBeGreaterThanOrEqual(100n);
    }
  });

  it("respects .max() on z.bigint()", () => {
    const schema = z.bigint().max(50n);
    for (let i = 0; i < 10; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as bigint;
      expect(schema.safeParse(v).success).toBe(true);
      expect(v).toBeLessThanOrEqual(50n);
    }
  });

  it("respects .min() and .max() together", () => {
    const schema = z.bigint().min(10n).max(20n);
    for (let i = 0; i < 10; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as bigint;
      expect(schema.safeParse(v).success).toBe(true);
      expect(v).toBeGreaterThanOrEqual(10n);
      expect(v).toBeLessThanOrEqual(20n);
    }
  });
});

// ---------------------------------------------------------------------------
// generateFromSchema — other types
// ---------------------------------------------------------------------------

describe("generateFromSchema — other types", () => {
  it("generates a symbol for z.symbol()", () => {
    const v = generateFromSchema(z.symbol(), makeCtx());
    expect(typeof v).toBe("symbol");
  });

  it("generates NaN for z.nan()", () => {
    const v = generateFromSchema(z.nan(), makeCtx());
    expect(Number.isNaN(v)).toBe(true);
  });

  it("generates a value for z.catch(fallback)", () => {
    const schema = z.string().catch("fallback");
    const v = generateFromSchema(schema, makeCtx());
    expect(schema.safeParse(v).success).toBe(true);
  });

  it("generates a value for z.readonly()", () => {
    const schema = z.object({ x: z.string() }).readonly();
    const v = generateFromSchema(schema, makeCtx()) as { x: string };
    expect(schema.safeParse(v).success).toBe(true);
    expect(typeof v.x).toBe("string");
  });

  it("generates a value for z.lazy() without infinite recursion", () => {
    const schema: z.ZodType<string> = z.lazy(() => z.string());
    const v = generateFromSchema(schema, makeCtx());
    expect(typeof v).toBe("string");
  });

  it("handles a self-referential lazy schema without hanging", () => {
    type Tree = { value: number; children: Tree[] };
    const TreeSchema: z.ZodType<Tree> = z.lazy(() =>
      z.object({ value: z.number(), children: z.array(TreeSchema) }),
    );
    expect(() => generateFromSchema(TreeSchema, makeCtx())).not.toThrow();
  });

  it("generates undefined for z.never()", () => {
    const v = generateFromSchema(z.never(), makeCtx());
    expect(v).toBeUndefined();
  });

  it("generates null for z.null()", () => {
    expect(generateFromSchema(z.null(), makeCtx())).toBeNull();
  });

  it("generates undefined for z.undefined()", () => {
    expect(generateFromSchema(z.undefined(), makeCtx())).toBeUndefined();
  });

  it("generates undefined for z.void()", () => {
    expect(generateFromSchema(z.void(), makeCtx())).toBeUndefined();
  });

  it("generates a string for z.any()", () => {
    expect(typeof generateFromSchema(z.any(), makeCtx())).toBe("string");
  });

  it("generates a string for z.unknown()", () => {
    expect(typeof generateFromSchema(z.unknown(), makeCtx())).toBe("string");
  });

  it("generates one of the union options for z.union()", () => {
    const schema = z.union([z.string(), z.number()]);
    for (let i = 0; i < 20; i++) {
      const v = generateFromSchema(schema, makeCtx(i));
      expect(typeof v === "string" || typeof v === "number").toBe(true);
    }
  });

  it("generates undefined for z.promise()", () => {
    expect(generateFromSchema(z.promise(z.string()), makeCtx())).toBeUndefined();
  });

  it("generates from the input side of z.pipe()", () => {
    const schema = z.string().pipe(z.string());
    expect(typeof generateFromSchema(schema, makeCtx())).toBe("string");
  });

  it("generates a value for z.default()", () => {
    const schema = z.string().default("fallback");
    expect(typeof generateFromSchema(schema, makeCtx())).toBe("string");
  });
});
