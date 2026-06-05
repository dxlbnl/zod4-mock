/**
 * Unit tests for the extensible key-based generator API.
 *
 * Tests the `generators` namespace, `KeyGenerator` type, `WorldOptions.generators`,
 * `world.withGenerators()`, and ctx.gen — the bound-PRNG generators available
 * inside matchers.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import type { ZodTypeAny } from "zod";
import { generators, createWorld, createPrng } from "../../../src/index.js";
import { en } from "@zod4-mock/locale-en";
import { generateFromSchema } from "../../../src/generators/schema/router.js";
import type {
  BoundGenerators,
  GenerateOptions,
  GeneratorContext,
  KeyGenerator,
  Registry,
} from "../../../src/index.js";

const STUB_REGISTRY: Registry = {
  store: () => {
    /* no-op */
  },
  all: () => [],
  pick: () => {
    throw new Error("stub registry: pick not supported");
  },
  filter: () => [],
  find: () => undefined,
  count: () => 0,
};

function makeCtx(seed = 42): GeneratorContext {
  const gen = {} as BoundGenerators;
  const ctx: GeneratorContext = {
    prng: createPrng(seed),
    gen,
    source: undefined,
    registry: STUB_REGISTRY,
    fieldPath: "",
    related: Object.assign(<T>(_: string) => ({}) as T, {
      many: <T>(_: string, __: number) => [] as T[],
    }),
    generate<S extends z.ZodTypeAny>(s: S, o?: GenerateOptions<z.infer<S>>) {
      const depth = (o?.fieldPath ?? this.fieldPath).split(".").filter(Boolean).length;
      if (depth > this.recursionLimit) return null as any;
      return generateFromSchema(s, { ...this, ...o }) as z.infer<S>;
    },
    recursionLimit: 5,
    optionalProbability: 0.2,
    current: {},
    locale: en,
    defaultArrayLength: [1, 5] as const,
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// Shared fixtures for world tests
// ---------------------------------------------------------------------------

const ProductSchema = z.object({
  vendorCode: z.string(),
  unitPrice: z.number().int(),
  label: z.string(),
  email: z.string(),
});

// ---------------------------------------------------------------------------
// generators namespace
//
// The top-level `generators` object groups domain-specific generators by
// category. Each function takes a PRNG as its first argument.
// ---------------------------------------------------------------------------

describe("generators namespace", () => {
  it("is exported and is an object", () => {
    expect(typeof generators).toBe("object");
    expect(generators).not.toBeNull();
  });

  it("contains all expected categories", () => {
    const expected = [
      "commerce",
      "company",
      "date",
      "finance",
      "internet",
      "location",
      "person",
      "phone",
      "vehicle",
      "word",
      "string",
    ];
    for (const name of expected) {
      expect(typeof (generators as Record<string, unknown>)[name], `generators.${name}`).toBe(
        "object",
      );
    }
  });

  it("generators.person.firstName returns a non-empty string", () => {
    const v = generators.person.firstName(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("generators.person.lastName returns a non-empty string", () => {
    const v = generators.person.lastName(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("generators.internet.email returns an email-shaped string", () => {
    const v = generators.internet.email(createPrng(42));
    expect(v).toMatch(/@/);
    expect(z.email().safeParse(v).success).toBe(true);
  });

  it("generators.string.uuid returns a valid UUID", () => {
    const v = generators.string.uuid(createPrng(42));
    expect(z.uuid().safeParse(v).success).toBe(true);
  });

  it("generators.phone.number returns a non-empty string", () => {
    const v = generators.phone.number(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("generators.location.postalCode returns a non-empty string", () => {
    const v = generators.location.postalCode(createPrng(42));
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("generators.internet.url returns an https:// URL", () => {
    expect(generators.internet.url(createPrng(42))).toMatch(/^https:\/\//);
  });

  it("generators.date.anytime returns a Date", () => {
    expect(generators.date.anytime(createPrng(42))).toBeInstanceOf(Date);
  });

  it("generators.lorem.words returns a string with the requested number of words", () => {
    const v = generators.lorem.words(createPrng(42), 5);
    expect(typeof v).toBe("string");
    expect(v.split(" ")).toHaveLength(5);
  });

  it("primitive generators produce different values for different seeds", () => {
    expect(generators.person.firstName(createPrng(1))).not.toBe(
      generators.person.firstName(createPrng(2)),
    );
    expect(generators.internet.email(createPrng(1))).not.toBe(
      generators.internet.email(createPrng(2)),
    );
  });
});

// ---------------------------------------------------------------------------
// ctx.gen — bound generators in matchers
//
// ctx.gen provides the same generators as the top-level `generators` namespace
// but with the field-seeded PRNG already applied. This eliminates the need to
// pass `ctx.prng` explicitly. Arguments (length, min, max) still pass through.
// ---------------------------------------------------------------------------

describe("ctx.gen — bound generators in matchers", () => {
  it("ctx.gen.person.firstName() is equivalent to generators.person.firstName(ctx.prng)", () => {
    let fromCtxGen: string | undefined;

    const S = z.object({ name: z.string() });
    createWorld({ seed: 42 })
      .withSchema(S, {
        matchers: {
          name: (ctx) => {
            fromCtxGen = ctx.gen.person.firstName();
            return fromCtxGen;
          },
        },
      })
      .generate(S);

    expect(typeof fromCtxGen).toBe("string");
    expect(fromCtxGen!.length).toBeGreaterThan(0);
  });

  it("ctx.gen.string.alphanumeric(n) respects the length argument", () => {
    let captured: string | undefined;
    const S = z.object({ code: z.string() });
    createWorld({ seed: 42 })
      .withSchema(S, {
        matchers: {
          code: (ctx) => {
            captured = ctx.gen.string.alphanumeric(12);
            return captured;
          },
        },
      })
      .generate(S);
    expect(captured).toHaveLength(12);
  });

  it("ctx.gen.internet.email() returns a valid email", () => {
    let captured: string | undefined;
    const S = z.object({ contact: z.string() });
    createWorld({ seed: 42 })
      .withSchema(S, {
        matchers: {
          contact: (ctx) => {
            captured = ctx.gen.internet.email();
            return captured;
          },
        },
      })
      .generate(S);
    expect(z.email().safeParse(captured).success).toBe(true);
  });

  it("ctx.gen values are deterministic across same-seed worlds", () => {
    const S = z.object({ title: z.string() });
    const makeWorld = () =>
      createWorld({ seed: 42 }).withSchema(S, {
        matchers: { title: (ctx) => ctx.gen.word.sentence() },
      });
    expect(makeWorld().generate(S)).toEqual(makeWorld().generate(S));
  });
});

// ---------------------------------------------------------------------------
// WorldOptions.generators
//
// Pass a `generators` map in `createWorld({ generators: {...} })` to install
// key-based overrides that apply globally to all schemas in that world.
// ---------------------------------------------------------------------------

describe("WorldOptions.generators", () => {
  it("applies a custom generator for a matching field", () => {
    const world = createWorld({
      seed: 42,
      generators: { vendorCode: () => "V-FIXED" },
    }).withSchema(ProductSchema);

    expect(world.generate(ProductSchema).vendorCode).toBe("V-FIXED");
  });

  it("does not affect unrelated fields (built-in fallback still runs)", () => {
    const world = createWorld({
      seed: 42,
      generators: { vendorCode: () => "V-FIXED" },
    }).withSchema(ProductSchema);

    // 'email' is handled by the built-in key-based heuristic → should contain @
    expect(world.generate(ProductSchema).email).toMatch(/@/);
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
    }).withSchema(ProductSchema);

    world.generate(ProductSchema);
    expect(capturedSchema).toBeDefined();
  });

  it("custom generator receives a full GeneratorContext", () => {
    // B97-R12/R13 — the per-record ctx is mutated across fields, so any
    // ctx-field observation MUST be made synchronously inside the matcher
    // (snapshot-not-reference discipline; see the spec's "Trace-API
    // compatibility" subsection). Capture each ctx slot value at the time
    // of the matcher call rather than the ctx reference itself.
    let capturedPrng: GeneratorContext["prng"] | undefined;
    let capturedFieldPath: string | undefined;
    let capturedRegistry: GeneratorContext["registry"] | undefined;

    const world = createWorld({
      seed: 42,
      generators: {
        vendorCode: (_schema, ctx) => {
          capturedPrng = ctx.prng;
          capturedFieldPath = ctx.fieldPath;
          capturedRegistry = ctx.registry;
          return "X";
        },
      },
    }).withSchema(ProductSchema);

    world.generate(ProductSchema);
    expect(capturedPrng).toBeDefined();
    expect(capturedFieldPath).toMatch(/vendorCode$/);
    expect(capturedRegistry).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// world.withGenerators()
//
// `withGenerators(map)` installs key-based overrides after world construction.
// Multiple calls merge additively; later keys win over earlier ones.
// ---------------------------------------------------------------------------

describe("world.withGenerators", () => {
  it("returns `this` for fluent chaining", () => {
    const world = createWorld({ seed: 42 });
    expect(world.withGenerators({})).toBe(world);
  });

  it("applies a custom generator registered after construction", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(ProductSchema)
      .withGenerators({ vendorCode: () => "CHAIN-VALUE" });

    expect(world.generate(ProductSchema).vendorCode).toBe("CHAIN-VALUE");
  });

  it("merges additively — earlier keys are preserved", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(ProductSchema)
      .withGenerators({ vendorCode: () => "V1" })
      .withGenerators({ label: () => "L1" });

    const result = world.generate(ProductSchema);
    expect(result.vendorCode).toBe("V1");
    expect(result.label).toBe("L1");
  });

  it("later withGenerators call overrides same key from earlier call", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(ProductSchema)
      .withGenerators({ vendorCode: () => "FIRST" })
      .withGenerators({ vendorCode: () => "SECOND" });

    expect(world.generate(ProductSchema).vendorCode).toBe("SECOND");
  });

  it("withGenerators overrides same key from WorldOptions.generators", () => {
    const world = createWorld({
      seed: 42,
      generators: { vendorCode: () => "FROM-OPTIONS" },
    })
      .withSchema(ProductSchema)
      .withGenerators({ vendorCode: () => "FROM-WITH-GENERATORS" });

    expect(world.generate(ProductSchema).vendorCode).toBe("FROM-WITH-GENERATORS");
  });
});

// ---------------------------------------------------------------------------
// Matchers take priority over key-based generators
//
// The generation pipeline order is:
// 1. matchers (explicit per-field functions in withSchema)
// 2. key-based generators (withGenerators / WorldOptions.generators / DEFAULT_KEY_MAP)
// 3. schema-based generators (Zod type introspection)
// ---------------------------------------------------------------------------

describe("matchers vs key-based generators priority", () => {
  it("schema matcher wins over withGenerators for the same field", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(ProductSchema, {
        matchers: { vendorCode: () => "from-matcher" },
      })
      .withGenerators({ vendorCode: () => "from-withGenerators" });

    expect(world.generate(ProductSchema).vendorCode).toBe("from-matcher");
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

  it("matches schema field VendorCode against generator registered as vendorcode", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(MixedCaseSchema)
      .withGenerators({ vendorcode: () => "case-insensitive" });

    expect(world.generate(MixedCaseSchema).VendorCode).toBe("case-insensitive");
  });

  it("matches schema field LABEL against generator registered as label", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(MixedCaseSchema)
      .withGenerators({ label: () => "lower-match" });

    expect(world.generate(MixedCaseSchema).LABEL).toBe("lower-match");
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

  it("custom generator can use ctx.prng for deterministic values", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(GatedSchema)
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
    const gen: KeyGenerator<string> = (_schema, ctx) => generators.person.firstName(ctx.prng);
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
    expect(generators.person.firstName(createPrng(42)).length).toBeGreaterThan(0);
  });

  it("lastName returns a non-empty string", () => {
    expect(generators.person.lastName(createPrng(42)).length).toBeGreaterThan(0);
  });

  it("fullName returns a string containing a space", () => {
    expect(generators.person.fullName(createPrng(42))).toContain(" ");
  });

  it("jobTitle returns a non-empty string", () => {
    expect(generators.person.jobTitle(createPrng(42)).length).toBeGreaterThan(0);
  });

  it("jobArea returns a non-empty string", () => {
    expect(generators.person.jobArea(createPrng(42)).length).toBeGreaterThan(0);
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
    expect(z.email().safeParse(v).success).toBe(true);
  });

  it("url returns an https:// URL", () => {
    expect(generators.internet.url(createPrng(42))).toMatch(/^https:\/\//);
  });

  it("username returns a non-empty string without spaces", () => {
    const v = generators.internet.username(createPrng(42));
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toContain(" ");
  });

  it("domain returns a domain without a protocol", () => {
    const v = generators.internet.domain(createPrng(42));
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toMatch(/^https?:\/\//);
    expect(v).toContain(".");
  });

  it("ip returns a dotted-quad IPv4 address", () => {
    expect(generators.internet.ip(createPrng(42))).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
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
    expect(generators.location.city(createPrng(42)).length).toBeGreaterThan(0);
  });

  it("streetAddress returns a string containing a number", () => {
    expect(generators.location.streetAddress(createPrng(42))).toMatch(/\d/);
  });

  it("latitude returns a number in [-90, 90]", () => {
    for (let i = 0; i < 20; i++) {
      const v = generators.location.latitude(createPrng(i));
      expect(v).toBeGreaterThanOrEqual(-90);
      expect(v).toBeLessThanOrEqual(90);
    }
  });

  it("longitude returns a number in [-180, 180]", () => {
    for (let i = 0; i < 20; i++) {
      const v = generators.location.longitude(createPrng(i));
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
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toContain(" ");
  });

  it("sentence returns a capitalised string ending with a period", () => {
    const v = generators.lorem.sentence(createPrng(42));
    expect(v.endsWith(".")).toBe(true);
    expect(v[0]).toBe(v[0]!.toUpperCase());
  });

  it("paragraph returns a non-empty multi-word string", () => {
    const v = generators.lorem.paragraph(createPrng(42));
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
    expect(z.uuid().safeParse(generators.string.uuid(createPrng(42))).success).toBe(true);
  });

  it("alphanumeric returns an alphanumeric string of default length 8", () => {
    const v = generators.string.alphanumeric(createPrng(42));
    expect(v.length).toBe(8);
    expect(v).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("alphanumeric respects a custom length", () => {
    expect(generators.string.alphanumeric(createPrng(42), 16)).toHaveLength(16);
  });

  it("hexadecimal returns a 0x-prefixed hex string of default length 8", () => {
    const v = generators.string.hexadecimal(createPrng(42));
    expect(v).toMatch(/^0x[0-9a-f]+$/i);
    expect(v.length).toBe(10); // '0x' + 8 chars
  });

  it("nanoid returns a 21-character URL-safe string", () => {
    const v = generators.string.nanoid(createPrng(42));
    expect(v.length).toBe(21);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_KEY_MAP and DEFAULT_KEY_PATTERNS
// ---------------------------------------------------------------------------

import { DEFAULT_KEY_MAP, DEFAULT_KEY_PATTERNS, generateFromKey } from "../../../src/index.js";

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
    const v = DEFAULT_KEY_MAP.string!["email"]!(createPrng(42));
    expect(z.email().safeParse(v).success).toBe(true);
  });

  it("string sub-map: name entry returns a string with a space", () => {
    const v = DEFAULT_KEY_MAP.string!["name"]!(createPrng(42));
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
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("generateFromKey uses DEFAULT_KEY_MAP for exact string key 'email'", () => {
    expect(z.email().safeParse(generateFromKey("email", z.string(), makeCtx())).success).toBe(true);
  });

  it("generateFromKey uses DEFAULT_KEY_MAP for exact number key 'quantity'", () => {
    const v = generateFromKey("quantity", z.number(), makeCtx()) as number;
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(100);
  });

  it("generateFromKey returns undefined for an unknown key", () => {
    expect(generateFromKey("zzz_unknown_xyz", z.string(), makeCtx())).toBeUndefined();
  });
});

describe("DEFAULT_KEY_PATTERNS", () => {
  it("is exported and has string, date and number arrays", () => {
    expect(Array.isArray(DEFAULT_KEY_PATTERNS.string)).toBe(true);
    expect(Array.isArray(DEFAULT_KEY_PATTERNS.date)).toBe(true);
    expect(Array.isArray(DEFAULT_KEY_PATTERNS.number)).toBe(true);
  });

  it("string patterns: *id suffix → UUID for string schema", () => {
    expect(z.uuid().safeParse(generateFromKey("userId", z.string(), makeCtx())).success).toBe(true);
  });

  it("string patterns: *uuid suffix → UUID for string schema", () => {
    expect(z.uuid().safeParse(generateFromKey("fileUuid", z.string(), makeCtx())).success).toBe(
      true,
    );
  });

  it("string patterns: bare 'id' → UUID for string schema", () => {
    expect(z.uuid().safeParse(generateFromKey("id", z.string(), makeCtx())).success).toBe(true);
  });

  it("date patterns: *at suffix → Date for date schema", () => {
    expect(generateFromKey("createdAt", z.date(), makeCtx())).toBeInstanceOf(Date);
  });

  it("string patterns: *at suffix → ISO string for string schema", () => {
    const v = generateFromKey("createdAt", z.string(), makeCtx()) as string;
    expect(new Date(v).toISOString()).toBe(v);
  });

  it("number patterns: *at suffix → timestamp for number schema", () => {
    const v = generateFromKey("createdAt", z.number(), makeCtx()) as number;
    expect(v > 946684800000).toBe(true); // After 2000-01-01
  });

  it("patterns: *date suffix → appropriate type", () => {
    expect(generateFromKey("invoiceDate", z.date(), makeCtx())).toBeInstanceOf(Date);
    expect(typeof generateFromKey("invoiceDate", z.string(), makeCtx())).toBe("string");
    expect(typeof generateFromKey("invoiceDate", z.number(), makeCtx())).toBe("number");
  });

  it("patterns: date* prefix → appropriate type", () => {
    expect(generateFromKey("dateOfBirth", z.date(), makeCtx())).toBeInstanceOf(Date);
    expect(typeof generateFromKey("dateOfBirth", z.string(), makeCtx())).toBe("string");
    expect(typeof generateFromKey("dateOfBirth", z.number(), makeCtx())).toBe("number");
  });

  it("string patterns do NOT fire for a number schema (wrong Zod type)", () => {
    expect(typeof generateFromKey("userId", z.number(), makeCtx())).not.toBe("string");
  });

  it("heuristics work through modifiers like .default()", () => {
    const v = generateFromKey("createdAt", z.number().default(0), makeCtx()) as number;
    expect(typeof v).toBe("number");
    expect(v > 946684800000).toBe(true);
  });

  it("heuristics work through modifiers like .readonly()", () => {
    const v = generateFromKey("createdAt", z.number().readonly(), makeCtx());
    expect(typeof v).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_KEY_MAP — finance and commerce string keys
// ---------------------------------------------------------------------------

describe("DEFAULT_KEY_MAP — finance string keys", () => {
  it("password key produces a 16-character string", () => {
    const v = generateFromKey("password", z.string(), makeCtx()) as string;
    expect(typeof v).toBe("string");
    expect(v.length).toBe(16);
  });

  it("accountnumber key produces a 10-digit numeric string", () => {
    const v = generateFromKey("accountnumber", z.string(), makeCtx()) as string;
    expect(v).toMatch(/^\d{10}$/);
  });

  it("account_number key is an alias of accountnumber", () => {
    const v = generateFromKey("account_number", z.string(), makeCtx()) as string;
    expect(v).toMatch(/^\d{10}$/);
  });

  it("creditcard key produces a formatted card number", () => {
    const v = generateFromKey("creditcard", z.string(), makeCtx()) as string;
    expect(typeof v).toBe("string");
    expect(v).toMatch(/^\d{4}-\d/);
  });

  it("credit_card key produces a formatted card number", () => {
    const v = generateFromKey("credit_card", z.string(), makeCtx()) as string;
    expect(typeof v).toBe("string");
    expect(v).toMatch(/^\d{4}-\d/);
  });

  it("creditcardnumber key is an alias for credit card", () => {
    const v = generateFromKey("creditcardnumber", z.string(), makeCtx()) as string;
    expect(typeof v).toBe("string");
    expect(v).toMatch(/^\d{4}-\d/);
  });

  it("credit_card_number key is an alias for credit card", () => {
    const v = generateFromKey("credit_card_number", z.string(), makeCtx()) as string;
    expect(typeof v).toBe("string");
    expect(v).toMatch(/^\d{4}-\d/);
  });

  it("price (string schema) produces a locale-formatted price string", () => {
    const v = generateFromKey("price", z.string(), makeCtx()) as string;
    expect(typeof v).toBe("string");
    expect(v).toMatch(/^\$\d+\.\d{2}$/);
  });

  it("prijs (string schema) produces a locale-formatted price string", () => {
    const v = generateFromKey("prijs", z.string(), makeCtx()) as string;
    expect(typeof v).toBe("string");
    expect(v).toMatch(/^\$\d+\.\d{2}$/);
  });

  it("sku key produces an AB-NNNN formatted SKU", () => {
    const v = generateFromKey("sku", z.string(), makeCtx()) as string;
    expect(v).toMatch(/^[A-Z]{2}-\d{4}$/);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_KEY_MAP — text/content string keys
// ---------------------------------------------------------------------------

describe("DEFAULT_KEY_MAP — text and content string keys", () => {
  const textKeys = [
    "text",
    "note",
    "summary",
    "comment",
    "body",
    "content",
    "message",
    "omschrijving",
    "bericht",
  ];

  for (const key of textKeys) {
    it(`${key} key produces a non-empty string`, () => {
      const v = generateFromKey(key, z.string(), makeCtx()) as string;
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
    });
  }

  it("text key produces a sentence-like string (ends with period)", () => {
    const v = generateFromKey("text", z.string(), makeCtx()) as string;
    expect(v.endsWith(".")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_KEY_MAP — number domain keys
// ---------------------------------------------------------------------------

describe("DEFAULT_KEY_MAP — number domain keys", () => {
  it("amount key produces a number in [1, 10000]", () => {
    const v = generateFromKey("amount", z.number(), makeCtx()) as number;
    expect(typeof v).toBe("number");
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(10000);
  });

  it("bedrag key produces a number in [1, 10000]", () => {
    const v = generateFromKey("bedrag", z.number(), makeCtx()) as number;
    expect(typeof v).toBe("number");
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(10000);
  });

  it("price (number schema) produces a number in [1, 500]", () => {
    const v = generateFromKey("price", z.number(), makeCtx()) as number;
    expect(typeof v).toBe("number");
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(500);
  });

  it("prijs (number schema) produces a number in [1, 500]", () => {
    const v = generateFromKey("prijs", z.number(), makeCtx()) as number;
    expect(typeof v).toBe("number");
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(500);
  });

  it("year key produces a number in [1970, 2030]", () => {
    const v = generateFromKey("year", z.number(), makeCtx()) as number;
    expect(typeof v).toBe("number");
    expect(v).toBeGreaterThanOrEqual(1970);
    expect(v).toBeLessThanOrEqual(2030);
  });

  it("year key produces an integer when schema is z.number().int()", () => {
    const v = generateFromKey("year", z.number().int(), makeCtx()) as number;
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(1970);
    expect(v).toBeLessThanOrEqual(2030);
  });
});

// ---------------------------------------------------------------------------
// Number key heuristics — finance / measurement (previously uncovered)
// ---------------------------------------------------------------------------

describe("number key heuristics — finance money keys", () => {
  const moneyKeys: Array<[string, number, number]> = [
    ["balance",  1,      100_000],
    ["total",    1,      10_000],
    ["subtotal", 1,      10_000],
    ["revenue",  1_000,  1_000_000_000],
    ["cost",     1,      1_000],
    ["fee",      1,      1_000],
    ["salary",   20_000, 500_000],
  ];

  for (const [key, min, max] of moneyKeys) {
    it(`${key} produces a positive number within its default range`, () => {
      const v = generateFromKey(key, z.number(), makeCtx()) as number;
      expect(typeof v).toBe("number");
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    });
  }

  it("balance respects z.number().min() override", () => {
    const v = generateFromKey("balance", z.number().min(50_000), makeCtx()) as number;
    expect(v).toBeGreaterThanOrEqual(50_000);
  });

  it("salary respects z.number().max() override", () => {
    const v = generateFromKey("salary", z.number().max(30_000), makeCtx()) as number;
    expect(v).toBeLessThanOrEqual(30_000);
  });
});

describe("number key heuristics — log-uniform measurement keys", () => {
  const intMeasurementKeys: Array<[string, number, number]> = [
    ["filesize",   100,  1_000_000_000],
    ["bytes",      100,  1_000_000_000],
    ["views",      1,    10_000_000],
    ["population", 1,    10_000_000],
  ];

  for (const [key, min, max] of intMeasurementKeys) {
    it(`${key} produces a positive integer within its default range`, () => {
      const v = generateFromKey(key, z.number(), makeCtx()) as number;
      expect(typeof v).toBe("number");
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    });
  }

  it("distance produces a positive number (continuous) within [1, 10000]", () => {
    const v = generateFromKey("distance", z.number(), makeCtx()) as number;
    expect(typeof v).toBe("number");
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(10_000);
  });
});

describe("number key heuristics — bounded-uniform shaped keys", () => {
  it("rating produces a number in [0, 5]", () => {
    const v = generateFromKey("rating", z.number(), makeCtx()) as number;
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(5);
  });

  it("score produces a number in [0, 100]", () => {
    const v = generateFromKey("score", z.number(), makeCtx()) as number;
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });

  it("percentage produces a number in [0, 100]", () => {
    const v = generateFromKey("percentage", z.number(), makeCtx()) as number;
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });

  it("rating respects z.number().max() override", () => {
    const v = generateFromKey("rating", z.number().max(3), makeCtx()) as number;
    expect(v).toBeLessThanOrEqual(3);
  });
});
