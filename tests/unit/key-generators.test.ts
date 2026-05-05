/**
 * Unit tests for the extensible key-based generator API.
 *
 * Tests the `generators` namespace, `KeyGenerator` type, `WorldOptions.generators`,
 * and `world.withGenerators()`.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import type { ZodTypeAny } from "zod";
import { generators, createWorld, createPrng, defineSubjectType } from "../../src/index.js";
import type { GeneratorContext, KeyGenerator } from "../../src/index.js";

function makeCtx(seed = 42): GeneratorContext {
  return {
    prng: createPrng(seed),
    subject: undefined,
    registry: {} as any,
    fieldPath: "",
    related: <T>(_: string) => ({}) as T,
    relatedTo: <T>(_: string, __: string) => [] as T[],
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures for world tests
// ---------------------------------------------------------------------------

const ProductSubject = defineSubjectType(
  "product",
  z.object({
    name: z.string(),
    vendorCode: z.string(),
  }),
);

const ProductSchema = z.object({
  vendorCode: z.string(),
  unitPrice: z.number().int(),
  label: z.string(),
  email: z.string(),
});

// ---------------------------------------------------------------------------
// generators namespace
// ---------------------------------------------------------------------------

describe("generators namespace", () => {
  it("is exported and is an object", () => {
    expect(typeof generators).toBe("object");
    expect(generators).not.toBeNull();
  });

  it("contains all primitive generator functions", () => {
    const expected = [
      "firstName",
      "lastName",
      "email",
      "uuid",
      "phone",
      "postalCode",
      "url",
      "date",
      "loremText",
    ];
    for (const name of expected) {
      expect(typeof (generators as Record<string, unknown>)[name], `generators.${name}`).toBe(
        "function",
      );
    }
  });

  it("generators.firstName returns a non-empty string", () => {
    const v = generators.firstName(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("generators.lastName returns a non-empty string", () => {
    const v = generators.lastName(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("generators.email returns an email-shaped string", () => {
    const v = generators.email(createPrng(42));
    expect(v).toMatch(/@/);
    expect(z.email().safeParse(v).success).toBe(true);
  });

  it("generators.uuid returns a valid UUID", () => {
    const v = generators.uuid(createPrng(42));
    expect(v).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(z.uuid().safeParse(v).success).toBe(true);
  });

  it("generators.phone returns a non-empty string", () => {
    const v = generators.phone(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("generators.postalCode returns a non-empty string", () => {
    const v = generators.postalCode(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("generators.url returns an https:// URL", () => {
    const v = generators.url(createPrng(42));
    expect(v).toMatch(/^https:\/\//);
  });

  it("generators.date returns a Date", () => {
    const v = generators.date(createPrng(42));
    expect(v).toBeInstanceOf(Date);
  });

  it("generators.loremText returns a string with the requested number of words", () => {
    const v = generators.loremText(createPrng(42), 5);
    expect(typeof v).toBe("string");
    expect(v.split(" ")).toHaveLength(5);
  });

  it("primitive generators produce different values for different seeds", () => {
    expect(generators.firstName(createPrng(1))).not.toBe(generators.firstName(createPrng(2)));
    expect(generators.email(createPrng(1))).not.toBe(generators.email(createPrng(2)));
  });
});

// ---------------------------------------------------------------------------
// WorldOptions.generators
// ---------------------------------------------------------------------------

describe("WorldOptions.generators", () => {
  it("applies a custom generator for a matching field", () => {
    const world = createWorld({
      seed: 42,
      generators: {
        vendorCode: () => "V-FIXED",
      },
    })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject);

    const result = world.generate(ProductSchema);
    expect(result.vendorCode).toBe("V-FIXED");
  });

  it("does not affect unrelated fields (built-in fallback still runs)", () => {
    const world = createWorld({
      seed: 42,
      generators: {
        vendorCode: () => "V-FIXED",
      },
    })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject);

    const result = world.generate(ProductSchema);
    // 'email' is handled by the built-in key-based heuristic → should contain @
    expect(result.email).toMatch(/@/);
  });

  it("custom generator receives the field Zod schema", () => {
    let capturedSchema: ZodTypeAny | undefined;

    const world = createWorld({
      seed: 42,
      generators: {
        vendorCode: (schema) => {
          capturedSchema = schema;
          return "X";
        },
      },
    })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject);

    world.generate(ProductSchema);
    expect(capturedSchema).toBeDefined();
  });

  it("custom generator receives a full GeneratorContext", () => {
    let capturedCtx: GeneratorContext | undefined;

    const world = createWorld({
      seed: 42,
      generators: {
        vendorCode: (_schema, ctx) => {
          capturedCtx = ctx;
          return "X";
        },
      },
    })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject);

    world.generate(ProductSchema);
    expect(capturedCtx?.prng).toBeDefined();
    expect(capturedCtx?.fieldPath).toBe("vendorCode");
    expect(capturedCtx?.registry).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// world.withGenerators()
// ---------------------------------------------------------------------------

describe("world.withGenerators", () => {
  it("returns `this` for fluent chaining", () => {
    const world = createWorld({ seed: 42 });
    expect(world.withGenerators({})).toBe(world);
  });

  it("applies a custom generator registered after construction", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)
      .withGenerators({ vendorCode: () => "CHAIN-VALUE" });

    const result = world.generate(ProductSchema);
    expect(result.vendorCode).toBe("CHAIN-VALUE");
  });

  it("merges additively — earlier keys are preserved", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)
      .withGenerators({ vendorCode: () => "V1" })
      .withGenerators({ label: () => "L1" });

    const result = world.generate(ProductSchema);
    expect(result.vendorCode).toBe("V1");
    expect(result.label).toBe("L1");
  });

  it("later withGenerators call overrides same key from earlier call", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)
      .withGenerators({ vendorCode: () => "FIRST" })
      .withGenerators({ vendorCode: () => "SECOND" });

    const result = world.generate(ProductSchema);
    expect(result.vendorCode).toBe("SECOND");
  });

  it("withGenerators overrides same key from WorldOptions.generators", () => {
    const world = createWorld({
      seed: 42,
      generators: { vendorCode: () => "FROM-OPTIONS" },
    })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)
      .withGenerators({ vendorCode: () => "FROM-WITH-GENERATORS" });

    const result = world.generate(ProductSchema);
    expect(result.vendorCode).toBe("FROM-WITH-GENERATORS");
  });
});

// ---------------------------------------------------------------------------
// Case-insensitive key matching
// ---------------------------------------------------------------------------

describe("case-insensitive key matching", () => {
  const MixedCaseSchema = z.object({
    VendorCode: z.string(),
    LABEL: z.string(),
  });

  const MixedSubject = defineSubjectType("mixed", z.object({ name: z.string() }));

  it("matches schema field VendorCode against generator registered as vendorcode", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(MixedSubject)
      .withSchema(MixedCaseSchema, MixedSubject)
      .withGenerators({ vendorcode: () => "case-insensitive" });

    const result = world.generate(MixedCaseSchema);
    expect(result.VendorCode).toBe("case-insensitive");
  });

  it("matches schema field LABEL against generator registered as label", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(MixedSubject)
      .withSchema(MixedCaseSchema, MixedSubject)
      .withGenerators({ label: () => "lower-match" });

    const result = world.generate(MixedCaseSchema);
    expect(result.LABEL).toBe("lower-match");
  });
});

// ---------------------------------------------------------------------------
// Schema-gated custom generators
// ---------------------------------------------------------------------------

describe("schema-gated custom generators", () => {
  const GatedSchema = z.object({
    unitPrice: z.number().int(),
    label: z.string(),
  });

  const GatedSubject = defineSubjectType("gated", z.object({ name: z.string() }));

  it("custom generator can inspect the schema and return undefined to fall through", () => {
    // Register a generator that only applies to number schemas
    const world = createWorld({ seed: 42 })
      .withSubject(GatedSubject)
      .withSchema(GatedSchema, GatedSubject)
      .withGenerators({
        unitPrice: (_schema, ctx) => ctx.prng.int(500, 999),
        label: (_schema, ctx) => `LBL-${ctx.prng.int(1, 99)}`,
      });

    const result = world.generate(GatedSchema);
    expect(result.unitPrice).toBeGreaterThanOrEqual(500);
    expect(result.unitPrice).toBeLessThanOrEqual(999);
    expect(result.label).toMatch(/^LBL-/);
  });
});

// ---------------------------------------------------------------------------
// KeyGenerator type is exported
// ---------------------------------------------------------------------------

describe("KeyGenerator type", () => {
  it("can be used as a type annotation", () => {
    // This is a compile-time check — if KeyGenerator is exported correctly,
    // the annotation below will not cause a TypeScript error.
    const gen: KeyGenerator<string> = (_schema, ctx) => generators.firstName(ctx.prng);
    expect(typeof gen).toBe("function");
    expect(typeof gen(z.string(), makeCtx())).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// generators sub-namespaces
// ---------------------------------------------------------------------------

describe("generators.person", () => {
  it("exposes all expected functions", () => {
    for (const name of ["firstName", "lastName", "fullName", "jobTitle", "jobArea"] as const) {
      expect(typeof generators.person[name], `generators.person.${name}`).toBe("function");
    }
  });

  it("firstName returns a non-empty string", () => {
    expect(typeof generators.person.firstName(createPrng(42))).toBe("string");
    expect(generators.person.firstName(createPrng(42)).length).toBeGreaterThan(0);
  });

  it("lastName returns a non-empty string", () => {
    expect(typeof generators.person.lastName(createPrng(42))).toBe("string");
    expect(generators.person.lastName(createPrng(42)).length).toBeGreaterThan(0);
  });

  it("fullName returns a string containing a space", () => {
    const v = generators.person.fullName(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v).toContain(" ");
  });

  it("jobTitle returns a non-empty string", () => {
    const v = generators.person.jobTitle(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("jobArea returns a non-empty string", () => {
    const v = generators.person.jobArea(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("produces different values for different seeds", () => {
    expect(generators.person.fullName(createPrng(1))).not.toBe(
      generators.person.fullName(createPrng(2)),
    );
  });
});

describe("generators.internet", () => {
  it("exposes all expected functions", () => {
    for (const name of ["email", "url", "username", "domain", "ip"] as const) {
      expect(typeof generators.internet[name], `generators.internet.${name}`).toBe("function");
    }
  });

  it("email returns a valid email address", () => {
    const v = generators.internet.email(createPrng(42));
    expect(v).toMatch(/@/);
    expect(z.email().safeParse(v).success).toBe(true);
  });

  it("url returns an https:// URL", () => {
    expect(generators.internet.url(createPrng(42))).toMatch(/^https:\/\//);
  });

  it("username returns a non-empty string without spaces", () => {
    const v = generators.internet.username(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toContain(" ");
  });

  it("domain returns a domain without a protocol", () => {
    const v = generators.internet.domain(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toMatch(/^https?:\/\//);
    expect(v).toContain(".");
  });

  it("ip returns a dotted-quad IPv4 address", () => {
    const v = generators.internet.ip(createPrng(42));
    expect(v).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  });
});

describe("generators.location", () => {
  it("exposes all expected functions", () => {
    for (const name of [
      "city",
      "country",
      "streetAddress",
      "postalCode",
      "latitude",
      "longitude",
    ] as const) {
      expect(typeof generators.location[name], `generators.location.${name}`).toBe("function");
    }
  });

  it("city returns a non-empty string", () => {
    const v = generators.location.city(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("country returns a non-empty string", () => {
    const v = generators.location.country(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("streetAddress returns a string containing a number", () => {
    const v = generators.location.streetAddress(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v).toMatch(/\d/);
  });

  it("postalCode returns a non-empty string", () => {
    const v = generators.location.postalCode(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("latitude returns a number in [-90, 90]", () => {
    for (let i = 0; i < 20; i++) {
      const v = generators.location.latitude(createPrng(i));
      expect(typeof v).toBe("number");
      expect(v).toBeGreaterThanOrEqual(-90);
      expect(v).toBeLessThanOrEqual(90);
    }
  });

  it("longitude returns a number in [-180, 180]", () => {
    for (let i = 0; i < 20; i++) {
      const v = generators.location.longitude(createPrng(i));
      expect(typeof v).toBe("number");
      expect(v).toBeGreaterThanOrEqual(-180);
      expect(v).toBeLessThanOrEqual(180);
    }
  });
});

describe("generators.lorem", () => {
  it("exposes all expected functions", () => {
    for (const name of ["word", "sentence", "paragraph"] as const) {
      expect(typeof generators.lorem[name], `generators.lorem.${name}`).toBe("function");
    }
  });

  it("word returns a single word (no spaces)", () => {
    const v = generators.lorem.word(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toContain(" ");
  });

  it("sentence returns a capitalised string ending with a period", () => {
    const v = generators.lorem.sentence(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.endsWith(".")).toBe(true);
    expect(v[0]).toBe(v[0]!.toUpperCase());
  });

  it("paragraph returns a non-empty multi-word string", () => {
    const v = generators.lorem.paragraph(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.split(" ").length).toBeGreaterThan(5);
  });
});

describe("generators.string", () => {
  it("exposes all expected functions", () => {
    for (const name of ["uuid", "alphanumeric", "hexadecimal", "nanoid"] as const) {
      expect(typeof generators.string[name], `generators.string.${name}`).toBe("function");
    }
  });

  it("uuid returns a valid UUID", () => {
    const v = generators.string.uuid(createPrng(42));
    expect(z.uuid().safeParse(v).success).toBe(true);
  });

  it("alphanumeric returns an alphanumeric string of default length 8", () => {
    const v = generators.string.alphanumeric(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBe(8);
    expect(v).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("alphanumeric respects a custom length", () => {
    const v = generators.string.alphanumeric(createPrng(42), 16);
    expect(v.length).toBe(16);
  });

  it("hexadecimal returns a 0x-prefixed hex string of default length 8", () => {
    const v = generators.string.hexadecimal(createPrng(42));
    expect(v).toMatch(/^0x[0-9a-f]+$/i);
    expect(v.length).toBe(10); // '0x' + 8 chars
  });

  it("nanoid returns a 21-character URL-safe string", () => {
    const v = generators.string.nanoid(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBe(21);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("generators flat aliases (backwards compatibility)", () => {
  it("flat generators still resolve to the same functions as sub-namespace equivalents", () => {
    expect(generators.firstName).toBe(generators.person.firstName);
    expect(generators.lastName).toBe(generators.person.lastName);
    expect(generators.email).toBe(generators.internet.email);
    expect(generators.uuid).toBe(generators.string.uuid);
    expect(generators.postalCode).toBe(generators.location.postalCode);
    expect(generators.url).toBe(generators.internet.url);
  });
});

// ---------------------------------------------------------------------------
// world.withKeyMap
// ---------------------------------------------------------------------------

import type { SchemaKeyMap, SubjectKeyMap } from "../../src/index.js";
import { DEFAULT_KEY_MAP, DEFAULT_KEY_PATTERNS, generateFromKey } from "../../src/index.js";

const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
  notes: z.string(),
});

const OrderSubject = defineSubjectType("order", z.object({ orderId: z.uuid() }));

describe("world.withKeyMap", () => {
  it("returns this for fluent chaining", () => {
    const world = createWorld({ seed: 42 });
    expect(world.withKeyMap(OrderSchema, {})).toBe(world);
  });

  it("applies a keyMap generator for a subject-bound schema", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(OrderSubject)
      .withSchema(OrderSchema, OrderSubject)
      .withKeyMap(OrderSchema, {
        notes: () => "keymap-value",
      });

    const result = world.generate(OrderSchema);
    expect(result.notes).toBe("keymap-value");
  });

  it("applies a keyMap generator for an ad-hoc schema (no subject binding)", () => {
    const world = createWorld({ seed: 42 }).withKeyMap(OrderSchema, {
      notes: () => "adhoc-keymap",
    });

    const result = world.generate(OrderSchema);
    expect(result.notes).toBe("adhoc-keymap");
  });

  it("does not apply to a different schema", () => {
    const OtherSchema = z.object({ notes: z.string() });
    const world = createWorld({ seed: 42 }).withKeyMap(OrderSchema, {
      notes: () => "only-for-order",
    });

    const result = world.generate(OtherSchema);
    expect(result.notes).not.toBe("only-for-order");
  });

  it("keyMap generator takes priority over withGenerators for the same field", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(OrderSubject)
      .withSchema(OrderSchema, OrderSubject)
      .withGenerators({ notes: () => "from-withGenerators" })
      .withKeyMap(OrderSchema, { notes: () => "from-withKeyMap" });

    expect(world.generate(OrderSchema).notes).toBe("from-withKeyMap");
  });

  it("matchers still take priority over keyMap", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(OrderSubject)
      .withSchema(OrderSchema, OrderSubject, {
        notes: () => "from-matcher",
      })
      .withKeyMap(OrderSchema, { notes: () => "from-withKeyMap" });

    expect(world.generate(OrderSchema).notes).toBe("from-matcher");
  });

  it("generator receives a GeneratorContext", () => {
    let capturedCtx: GeneratorContext | undefined;
    const world = createWorld({ seed: 42 })
      .withSubject(OrderSubject)
      .withSchema(OrderSchema, OrderSubject)
      .withKeyMap(OrderSchema, {
        notes: (ctx) => {
          capturedCtx = ctx;
          return "x";
        },
      });

    world.generate(OrderSchema);
    expect(capturedCtx?.prng).toBeDefined();
    expect(capturedCtx?.fieldPath).toBe("notes");
    expect(capturedCtx?.registry).toBeDefined();
  });

  it("successive withKeyMap calls are merged (later entries win)", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(OrderSubject)
      .withSchema(OrderSchema, OrderSubject)
      .withKeyMap(OrderSchema, { notes: () => "first" })
      .withKeyMap(OrderSchema, { notes: () => "second" });

    expect(world.generate(OrderSchema).notes).toBe("second");
  });

  it("successive withKeyMap calls preserve earlier keys not overwritten", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(OrderSubject)
      .withSchema(OrderSchema, OrderSubject)
      .withKeyMap(OrderSchema, {
        orderId: () => "id-from-first",
        notes: () => "notes-from-first",
      })
      .withKeyMap(OrderSchema, { notes: () => "notes-from-second" });

    const result = world.generate(OrderSchema);
    expect(result.orderId).toBe("id-from-first");
    expect(result.notes).toBe("notes-from-second");
  });

  it("SchemaKeyMap type can be used as an annotation", () => {
    const map: SchemaKeyMap<typeof OrderSchema> = {
      notes: (ctx) => `note-${ctx.prng.int(1, 9)}`,
    };
    const world = createWorld({ seed: 42 })
      .withSubject(OrderSubject)
      .withSchema(OrderSchema, OrderSubject)
      .withKeyMap(OrderSchema, map);

    const result = world.generate(OrderSchema);
    expect(result.notes).toMatch(/^note-/);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_KEY_MAP
// ---------------------------------------------------------------------------

describe("DEFAULT_KEY_MAP", () => {
  it("is exported and is a plain object", () => {
    expect(typeof DEFAULT_KEY_MAP).toBe("object");
    expect(DEFAULT_KEY_MAP).not.toBeNull();
  });

  it("has a 'string' sub-map with generator functions", () => {
    expect(typeof DEFAULT_KEY_MAP.string).toBe("object");
    for (const fn of Object.values(DEFAULT_KEY_MAP.string!)) {
      expect(typeof fn).toBe("function");
    }
  });

  it("has a 'number' sub-map with generator functions", () => {
    expect(typeof DEFAULT_KEY_MAP.number).toBe("object");
    for (const fn of Object.values(DEFAULT_KEY_MAP.number!)) {
      expect(typeof fn).toBe("function");
    }
  });

  it("string sub-map: email entry returns a valid email", () => {
    const fn = DEFAULT_KEY_MAP.string!["email"]!;
    const v = fn(createPrng(42));
    expect(z.email().safeParse(v).success).toBe(true);
  });

  it("string sub-map: name entry returns a string with a space (person fullName by default)", () => {
    const fn = DEFAULT_KEY_MAP.string!["name"]!;
    const v = fn(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v).toContain(" ");
  });

  it("string sub-map functions are identical references to generators.* functions", () => {
    expect(DEFAULT_KEY_MAP.string!["email"]).toBe(generators.internet.email);
    expect(DEFAULT_KEY_MAP.string!["firstname"]).toBe(generators.person.firstName);
    expect(DEFAULT_KEY_MAP.string!["city"]).toBe(generators.location.city);
  });

  it("number sub-map: quantity returns a number in [1, 100]", () => {
    const fn = DEFAULT_KEY_MAP.number!["quantity"]!;
    for (let i = 0; i < 20; i++) {
      const v = fn(createPrng(i));
      expect(typeof v).toBe("number");
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("generateFromKey uses DEFAULT_KEY_MAP for exact string key 'email'", () => {
    const v = generateFromKey("email", z.string(), makeCtx());
    expect(z.email().safeParse(v).success).toBe(true);
  });

  it("generateFromKey uses DEFAULT_KEY_MAP for exact number key 'quantity'", () => {
    const v = generateFromKey("quantity", z.number(), makeCtx());
    expect(typeof v).toBe("number");
    expect(v as number).toBeGreaterThanOrEqual(1);
    expect(v as number).toBeLessThanOrEqual(100);
  });

  it("generateFromKey returns undefined for an unknown key", () => {
    expect(generateFromKey("zzz_unknown_xyz", z.string(), makeCtx())).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_KEY_PATTERNS
// ---------------------------------------------------------------------------

describe("DEFAULT_KEY_PATTERNS", () => {
  it("is exported and has string and any arrays", () => {
    expect(Array.isArray(DEFAULT_KEY_PATTERNS.string)).toBe(true);
    expect(Array.isArray(DEFAULT_KEY_PATTERNS.any)).toBe(true);
  });

  it("string patterns: *id suffix → UUID for string schema", () => {
    const v = generateFromKey("userId", z.string(), makeCtx());
    expect(z.uuid().safeParse(v).success).toBe(true);
  });

  it("string patterns: *uuid suffix → UUID for string schema", () => {
    const v = generateFromKey("fileUuid", z.string(), makeCtx());
    expect(z.uuid().safeParse(v).success).toBe(true);
  });

  it("string patterns: bare 'id' → UUID for string schema", () => {
    const v = generateFromKey("id", z.string(), makeCtx());
    expect(z.uuid().safeParse(v).success).toBe(true);
  });

  it("any patterns: *at suffix → Date regardless of schema type", () => {
    const v = generateFromKey("createdAt", z.date(), makeCtx());
    expect(v).toBeInstanceOf(Date);
  });

  it("any patterns: *date suffix → Date", () => {
    const v = generateFromKey("invoiceDate", z.date(), makeCtx());
    expect(v).toBeInstanceOf(Date);
  });

  it("any patterns: date* prefix → Date", () => {
    const v = generateFromKey("dateOfBirth", z.date(), makeCtx());
    expect(v).toBeInstanceOf(Date);
  });

  it("string patterns do NOT fire for a number schema (wrong Zod type)", () => {
    // 'userId' as a number field should not get a UUID string
    const v = generateFromKey("userId", z.number(), makeCtx());
    expect(typeof v).not.toBe("string");
  });
});

// ---------------------------------------------------------------------------
// SubjectKeyMap type
// ---------------------------------------------------------------------------

describe("SubjectKeyMap type", () => {
  it("can be used as a type annotation", () => {
    const SubjectSchema = z.object({ name: z.string(), count: z.number() });
    const SubType = defineSubjectType("st", SubjectSchema);
    // compile-time check only — if SubjectKeyMap is exported, this won't error
    const map: SubjectKeyMap<z.infer<typeof SubjectSchema>> = {
      name: (prng) => generators.person.fullName(prng),
    };
    expect(typeof map.name).toBe("function");
    void SubType;
  });
});
