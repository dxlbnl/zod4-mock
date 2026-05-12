/**
 * Zod v4 compatibility contract tests.
 *
 * These tests assert the exact internal API surface that zod4-mock depends on.
 * If any assertion fails after a Zod upgrade, the failing test identifies exactly
 * which internal changed and which src file needs to be updated.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { def, checks, unwrap } from "../../src/generators/schema/zod-def.js";

// ---------------------------------------------------------------------------
// _zod.def accessor
// ---------------------------------------------------------------------------

describe("._zod.def accessor", () => {
  it("returns an object with a type field", () => {
    const d = def(z.string());
    expect(typeof d).toBe("object");
    expect(typeof d.type).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Schema type discriminators
// All values used in router.ts switch — if any string changes, that case breaks.
// ---------------------------------------------------------------------------

describe("schema type discriminators", () => {
  it.each([
    [z.string(), "string"],
    [z.number(), "number"],
    [z.boolean(), "boolean"],
    [z.bigint(), "bigint"],
    [z.symbol(), "symbol"],
    [z.nan(), "nan"],
    [z.never(), "never"],
    [z.null(), "null"],
    [z.undefined(), "undefined"],
    [z.void(), "void"],
    [z.any(), "any"],
    [z.unknown(), "unknown"],
    [z.date(), "date"],
    [z.object({}), "object"],
    [z.array(z.string()), "array"],
    [z.tuple([z.string()]), "tuple"],
    [z.record(z.string(), z.number()), "record"],
    [z.map(z.string(), z.number()), "map"],
    [z.set(z.string()), "set"],
    [z.union([z.string(), z.number()]), "union"],
    [z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })), "intersection"],
    [z.literal("x"), "literal"],
    [z.enum(["a", "b"]), "enum"],
    [z.string().optional(), "optional"],
    [z.string().nullable(), "nullable"],
    [z.string().default("x"), "default"],
    [z.string().catch("x"), "catch"],
    [z.string().readonly(), "readonly"],
    [z.lazy(() => z.string()), "lazy"],
    [z.promise(z.string()), "promise"],
    [z.string().pipe(z.string()), "pipe"],
    // NOTE: z.discriminatedUnion() stores as "union", not "discriminatedUnion"
    [
      z.discriminatedUnion("t", [z.object({ t: z.literal("a") }), z.object({ t: z.literal("b") })]),
      "union",
    ],
    // NOTE: z.templateLiteral() stores as "template_literal", not "templateLiteral"
    [z.templateLiteral([z.string(), " world"]), "template_literal"],
    // NOTE: .brand() is transparent — does not wrap with a new type
    [z.string().brand("Brand"), "string"],
  ] as const)("def(%#).type === %s", (schema, expectedType) => {
    expect(def(schema as z.ZodTypeAny).type).toBe(expectedType);
  });
});

// ---------------------------------------------------------------------------
// Wrapper innerType — optional, nullable, default, catch, readonly
// ---------------------------------------------------------------------------

describe("wrapper innerType", () => {
  it.each([
    ["optional", z.string().optional()],
    ["nullable", z.string().nullable()],
    ["default", z.string().default("x")],
    ["catch", z.string().catch("x")],
    ["readonly", z.string().readonly()],
  ])("%s has innerType pointing to the inner schema", (_name, schema) => {
    const inner = def(schema).innerType;
    expect(inner).toBeDefined();
    expect(def(inner!).type).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Collection def fields
// ---------------------------------------------------------------------------

describe("collection def fields", () => {
  it("array: d.element is the element schema", () => {
    const d = def(z.array(z.number()));
    expect(d.element).toBeDefined();
    expect(def(d.element!).type).toBe("number");
  });

  it("tuple: d.items is the items array", () => {
    const d = def(z.tuple([z.string(), z.number()]));
    expect(Array.isArray(d.items)).toBe(true);
    expect(d.items!.length).toBe(2);
    expect(def(d.items![0]!).type).toBe("string");
    expect(def(d.items![1]!).type).toBe("number");
  });

  it("tuple with rest: d.rest is the rest schema", () => {
    const d = def(z.tuple([z.string()]).rest(z.boolean()));
    expect(d.rest).toBeDefined();
    expect(def(d.rest!).type).toBe("boolean");
  });

  it("object: d.shape is a Record of field schemas", () => {
    const d = def(z.object({ name: z.string(), age: z.number() }));
    expect(d.shape).toBeDefined();
    expect(Object.keys(d.shape!)).toEqual(["name", "age"]);
    expect(def(d.shape!["name"]!).type).toBe("string");
    expect(def(d.shape!["age"]!).type).toBe("number");
  });

  it("record: d.keyType and d.valueType", () => {
    const d = def(z.record(z.string(), z.number()));
    expect(def(d.keyType!).type).toBe("string");
    expect(def(d.valueType!).type).toBe("number");
  });

  it("map: d.keyType and d.valueType", () => {
    const d = def(z.map(z.string(), z.boolean()));
    expect(def(d.keyType!).type).toBe("string");
    expect(def(d.valueType!).type).toBe("boolean");
  });

  it("set: d.valueType is the element schema", () => {
    const d = def(z.set(z.string()));
    expect(def(d.valueType!).type).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Union / enum def fields
// ---------------------------------------------------------------------------

describe("union and enum def fields", () => {
  it("union: d.options is an array of schemas", () => {
    const d = def(z.union([z.string(), z.number(), z.boolean()]));
    expect(Array.isArray(d.options)).toBe(true);
    expect(d.options!.length).toBe(3);
  });

  it("discriminatedUnion: stored as union with d.options (no optionsMap)", () => {
    const du = z.discriminatedUnion("type", [
      z.object({ type: z.literal("a") }),
      z.object({ type: z.literal("b") }),
    ]);
    const d = def(du);
    expect(d.type).toBe("union");
    expect(Array.isArray(d.options)).toBe(true);
    expect(d.options!.length).toBe(2);
    expect(d.optionsMap).toBeUndefined();
  });

  it("enum: d.entries maps key names to values", () => {
    const d = def(z.enum(["alpha", "beta"]));
    expect(d.entries).toBeDefined();
    expect(d.entries!["alpha"]).toBe("alpha");
    expect(d.entries!["beta"]).toBe("beta");
  });

  it("nativeEnum: d.entries maps key names to values", () => {
    enum Color {
      Red = "red",
      Blue = "blue",
    }
    const d = def(z.nativeEnum(Color));
    expect(d.entries).toBeDefined();
    expect(d.entries!["Red"]).toBe("red");
    expect(d.entries!["Blue"]).toBe("blue");
  });

  it("literal: d.values[0] is the literal value", () => {
    const d = def(z.literal("hello"));
    expect(Array.isArray(d.values)).toBe(true);
    expect(d.values![0]).toBe("hello");
  });
});

// ---------------------------------------------------------------------------
// Intersection / xor def fields
// ---------------------------------------------------------------------------

describe("intersection def fields", () => {
  it("d.left and d.right are both schemas", () => {
    const d = def(z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })));
    expect(d.left).toBeDefined();
    expect(d.right).toBeDefined();
    expect(def(d.left!).type).toBe("object");
    expect(def(d.right!).type).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// Lazy / pipe def fields
// ---------------------------------------------------------------------------

describe("lazy and pipe def fields", () => {
  it("lazy: d.getter is a callable that returns the schema", () => {
    const d = def(z.lazy(() => z.string()));
    expect(typeof d.getter).toBe("function");
    expect(def(d.getter!()).type).toBe("string");
  });

  it("pipe: d.in is the input schema", () => {
    const d = def(z.string().pipe(z.string()));
    expect(d.in).toBeDefined();
    expect(def(d.in!).type).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// checks() accessor — nested _zod.def extraction
// ---------------------------------------------------------------------------

describe("checks() accessor", () => {
  it("returns an empty array for a schema with no checks", () => {
    expect(checks(z.string()).length).toBe(0);
    expect(checks(z.number()).length).toBe(0);
  });

  it("returns flat check objects (not the raw {_zod:{def:...}} wrappers)", () => {
    const c = checks(z.string().min(3));
    expect(c.length).toBe(1);
    expect(c[0]!.check).toBe("min_length");
    expect("_zod" in c[0]!).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Number checks
// ---------------------------------------------------------------------------

describe("number checks", () => {
  it(".min(5) → greater_than with value 5 inclusive", () => {
    const c = checks(z.number().min(5)).find((x) => x.check === "greater_than");
    expect(c).toBeDefined();
    expect(c!.value).toBe(5);
    expect(c!.inclusive).toBe(true);
  });

  it(".gt(5) → greater_than with value 5 exclusive", () => {
    const c = checks(z.number().gt(5)).find((x) => x.check === "greater_than");
    expect(c!.value).toBe(5);
    expect(c!.inclusive).toBe(false);
  });

  it(".max(10) → less_than with value 10 inclusive", () => {
    const c = checks(z.number().max(10)).find((x) => x.check === "less_than");
    expect(c).toBeDefined();
    expect(c!.value).toBe(10);
    expect(c!.inclusive).toBe(true);
  });

  it(".lt(10) → less_than with value 10 exclusive", () => {
    const c = checks(z.number().lt(10)).find((x) => x.check === "less_than");
    expect(c!.value).toBe(10);
    expect(c!.inclusive).toBe(false);
  });

  it(".multipleOf(3) → multiple_of with value 3", () => {
    const c = checks(z.number().multipleOf(3)).find((x) => x.check === "multiple_of");
    expect(c).toBeDefined();
    expect(c!.value).toBe(3);
  });

  // NOTE: .int() produces format "safeint", not "int" — there is no "int" format in Zod v4
  it(".int() → number_format with format 'safeint'", () => {
    const c = checks(z.number().int()).find((x) => x.check === "number_format");
    expect(c).toBeDefined();
    expect(c!.format).toBe("safeint");
  });

  it("z.int32() → standalone schema with inline format 'int32'", () => {
    const d = def(z.int32());
    expect(d.check).toBe("number_format");
    expect(d.format).toBe("int32");
  });
});

// ---------------------------------------------------------------------------
// BigInt checks
// ---------------------------------------------------------------------------

describe("bigint checks", () => {
  it(".min(5n) → greater_than with value 5n inclusive", () => {
    const c = checks(z.bigint().min(5n)).find((x) => x.check === "greater_than");
    expect(c).toBeDefined();
    expect(c!.value).toBe(5n);
    expect(c!.inclusive).toBe(true);
  });

  it(".max(100n) → less_than with value 100n inclusive", () => {
    const c = checks(z.bigint().max(100n)).find((x) => x.check === "less_than");
    expect(c).toBeDefined();
    expect(c!.value).toBe(100n);
    expect(c!.inclusive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// String length checks
// ---------------------------------------------------------------------------

describe("string length checks", () => {
  it(".min(3) → min_length with minimum 3", () => {
    const c = checks(z.string().min(3)).find((x) => x.check === "min_length");
    expect(c).toBeDefined();
    expect(c!.minimum).toBe(3);
  });

  it(".max(10) → max_length with maximum 10", () => {
    const c = checks(z.string().max(10)).find((x) => x.check === "max_length");
    expect(c).toBeDefined();
    expect(c!.maximum).toBe(10);
  });

  it(".length(5) → length_equals with length 5", () => {
    const c = checks(z.string().length(5)).find((x) => x.check === "length_equals");
    expect(c).toBeDefined();
    expect(c!.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// String format — via checks array (z.string().email())
// ---------------------------------------------------------------------------

describe("string format checks — via checks array", () => {
  it.each([
    ["email", z.string().email()],
    ["uuid", z.string().uuid()],
    ["url", z.string().url()],
    ["cuid", z.string().cuid()],
    ["cuid2", z.string().cuid2()],
    ["ulid", z.string().ulid()],
    ["nanoid", z.string().nanoid()],
    ["base64", z.string().base64()],
  ])(".%s() → string_format check with format '%s'", (format, schema) => {
    const c = checks(schema).find((x) => x.check === "string_format");
    expect(c).toBeDefined();
    expect(c!.format).toBe(format);
  });
});

// ---------------------------------------------------------------------------
// String format — inline at def level (z.email() standalone)
// ---------------------------------------------------------------------------

describe("string format — inline at def level (z.email() shorthand)", () => {
  it("z.email() stores check and format directly in def, not checks array", () => {
    const d = def(z.email());
    expect(d.type).toBe("string");
    expect(d.check).toBe("string_format");
    expect(d.format).toBe("email");
    expect(checks(z.email()).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// String sub-format checks
// ---------------------------------------------------------------------------

describe("string sub-format checks", () => {
  it(".startsWith('foo') → string_format with format 'starts_with' and prefix 'foo'", () => {
    const c = checks(z.string().startsWith("foo")).find((x) => x.check === "string_format");
    expect(c).toBeDefined();
    expect(c!.format).toBe("starts_with");
    expect(c!.prefix).toBe("foo");
  });

  it(".endsWith('bar') → string_format with format 'ends_with' and suffix 'bar'", () => {
    const c = checks(z.string().endsWith("bar")).find((x) => x.check === "string_format");
    expect(c!.format).toBe("ends_with");
    expect(c!.suffix).toBe("bar");
  });

  it(".includes('baz') → string_format with format 'includes' and includes 'baz'", () => {
    const c = checks(z.string().includes("baz")).find((x) => x.check === "string_format");
    expect(c!.format).toBe("includes");
    expect(c!.includes).toBe("baz");
  });

  it(".regex(/abc/) → string_format with format 'regex' and a RegExp pattern", () => {
    const c = checks(z.string().regex(/abc/)).find((x) => x.check === "string_format");
    expect(c!.format).toBe("regex");
    expect(c!.pattern).toBeInstanceOf(RegExp);
  });
});

// ---------------------------------------------------------------------------
// String transformation checks
// NOTE: In Zod v4, .toLowerCase()/.toUpperCase()/.trim() are stored as
// {check:"overwrite"} with a `tx` function, NOT as "toLowerCase" etc.
// Our generator handles these via the `c.check === "overwrite"` path.
// ---------------------------------------------------------------------------

describe("string transformation checks", () => {
  it.each([
    ["toLowerCase", z.string().toLowerCase()],
    ["toUpperCase", z.string().toUpperCase()],
    ["trim", z.string().trim()],
  ])(".%s() → 'overwrite' check with a tx function", (_method, schema) => {
    const c = checks(schema).find((x) => x.check === "overwrite");
    expect(c).toBeDefined();
    expect(typeof (c as unknown as { tx?: unknown }).tx).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Array size checks
// ---------------------------------------------------------------------------

describe("array size checks", () => {
  it(".min(2) → min_length with minimum 2", () => {
    const c = checks(z.array(z.string()).min(2)).find((x) => x.check === "min_length");
    expect(c).toBeDefined();
    expect(c!.minimum).toBe(2);
  });

  it(".max(5) → max_length with maximum 5", () => {
    const c = checks(z.array(z.string()).max(5)).find((x) => x.check === "max_length");
    expect(c).toBeDefined();
    expect(c!.maximum).toBe(5);
  });

  it(".length(3) → length_equals with length 3", () => {
    const c = checks(z.array(z.string()).length(3)).find((x) => x.check === "length_equals");
    expect(c).toBeDefined();
    expect(c!.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Set size checks
// ---------------------------------------------------------------------------

describe("set size checks", () => {
  it(".min(1) → min_size with minimum 1", () => {
    const c = checks(z.set(z.string()).min(1)).find((x) => x.check === "min_size");
    expect(c).toBeDefined();
    expect(c!.minimum).toBe(1);
  });

  it(".max(4) → max_size with maximum 4", () => {
    const c = checks(z.set(z.string()).max(4)).find((x) => x.check === "max_size");
    expect(c).toBeDefined();
    expect(c!.maximum).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Date checks
// ---------------------------------------------------------------------------

describe("date checks", () => {
  const d = new Date("2023-06-15");

  it(".min(date) → greater_than with the date value inclusive", () => {
    const c = checks(z.date().min(d)).find((x) => x.check === "greater_than");
    expect(c).toBeDefined();
    expect(c!.value).toEqual(d);
    expect(c!.inclusive).toBe(true);
  });

  it(".max(date) → less_than with the date value inclusive", () => {
    const c = checks(z.date().max(d)).find((x) => x.check === "less_than");
    expect(c).toBeDefined();
    expect(c!.value).toEqual(d);
    expect(c!.inclusive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// unwrap() utility
// ---------------------------------------------------------------------------

describe("unwrap() utility", () => {
  it("strips optional to reveal inner type", () => {
    expect(def(unwrap(z.string().optional())).type).toBe("string");
  });

  it("strips nullable to reveal inner type", () => {
    expect(def(unwrap(z.string().nullable())).type).toBe("string");
  });

  it("strips default to reveal inner type", () => {
    expect(def(unwrap(z.string().default("x"))).type).toBe("string");
  });

  it("strips catch to reveal inner type", () => {
    expect(def(unwrap(z.string().catch("x"))).type).toBe("string");
  });

  it("strips readonly to reveal inner type", () => {
    expect(def(unwrap(z.string().readonly())).type).toBe("string");
  });

  it("handles deeply chained wrappers", () => {
    const s = z.string().optional().nullable().default("x");
    expect(def(unwrap(s)).type).toBe("string");
  });

  it("returns the same schema when there is nothing to unwrap", () => {
    const s = z.number();
    expect(unwrap(s)).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// Template literal def — actual internal structure
// NOTE: router.ts currently handles case "templateLiteral" but the actual
// type string is "template_literal". Parts are in d.parts, not d.types/d.items.
// ---------------------------------------------------------------------------

describe("template literal def structure", () => {
  it("type is 'template_literal' (not 'templateLiteral')", () => {
    const d = def(z.templateLiteral([z.string(), " world"]));
    expect(d.type).toBe("template_literal");
  });

  it("parts are stored in d.parts (not d.types or d.items)", () => {
    const d = def(z.templateLiteral([z.string(), " world"])) as unknown as {
      parts?: unknown[];
      types?: unknown;
      items?: unknown;
    };
    expect(Array.isArray(d.parts)).toBe(true);
    expect(d.parts!.length).toBe(2);
    expect(d.types).toBeUndefined();
    expect(d.items).toBeUndefined();
  });
});

describe("discriminated union def structure", () => {
  it("type is 'union' (not 'discriminatedUnion')", () => {
    const s1 = z.object({ type: z.literal("a"), value: z.string() });
    const s2 = z.object({ type: z.literal("b"), value: z.number() });
    const du = z.discriminatedUnion("type", [s1, s2]);
    const d = def(du);

    expect(d.type).toBe("union");
    expect(d.discriminator).toBe("type");
    expect(d.options).toBeDefined();
  });
});

describe("effects and pipelines (unified as 'pipe' in v4)", () => {
  it("z.transform is typed as 'pipe'", () => {
    const s = z.string().transform((v) => v.length);
    const d = def(s);
    expect(d.type).toBe("pipe");
  });

  it("distinguishes between effects and pipelines", () => {
    const eff = z.string().transform((v) => v.length);
    const pre = z.preprocess((v) => String(v), z.string());
    const pipe = z.string().pipe(z.number() as any);

    const dEff = def(eff) as any;
    const dPre = def(pre) as any;
    const dPipe = def(pipe) as any;

    expect(dEff.type).toBe("pipe");
    expect(def(dEff.out).type).toBe("transform");

    expect(dPre.type).toBe("pipe");
    expect(def(dPre.in).type).toBe("transform");

    expect(dPipe.type).toBe("pipe");
    expect(def(dPipe.in).type).toBe("string");
    expect(def(dPipe.out).type).toBe("number");
  });
});

describe("intersection def structure", () => {
  it("type is 'intersection' even for objects", () => {
    const s1 = z.object({ a: z.string() });
    const s2 = z.object({ b: z.number() });
    const s = s1.and(s2);
    const d = def(s);
    expect(d.type).toBe("intersection");
  });
});
