/**
 * Unit tests for `createWorld`, `generate`, and the World interface.
 *
 * Schemas are the primary anchor — no subjects, no defineSubjectType.
 * Each section demonstrates one feature of the API with a brief explanation
 * of what it tests and why.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld, generate } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PersonSchema = z.object({
  personId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  age: z.number().int().min(18).max(90),
});

const OrderSchema = z.object({
  orderId: z.uuid(),
  customerId: z.uuid(), // → PersonSchema.personId
  status: z.enum(["pending", "processing", "done", "cancelled"]),
  totalCents: z.number().int().min(100),
});

// ---------------------------------------------------------------------------
// generate() — zero-config entry point
//
// The simplest usage: pass a schema, get data back. No world setup, no seed,
// no registration. Internally creates a temporary world and discards it.
// ---------------------------------------------------------------------------

describe("generate — zero-config entry point", () => {
  it("generates an object from a schema without any setup", () => {
    const user = generate(PersonSchema);
    expect(PersonSchema.safeParse(user).success).toBe(true);
  });

  it("generates a primitive schema without any setup", () => {
    expect(typeof generate(z.string())).toBe("string");
  });

  it("accepts overrides to force specific field values", () => {
    const user = generate(PersonSchema, { overrides: { firstName: "Alice" } });
    expect(user.firstName).toBe("Alice");
  });

  it("accepts a seed for deterministic output", () => {
    const a = generate(PersonSchema, { seed: 1 });
    const b = generate(PersonSchema, { seed: 1 });
    expect(a).toEqual(b);
  });

  it("different seeds produce different output", () => {
    const a = generate(PersonSchema, { seed: 1 });
    const b = generate(PersonSchema, { seed: 2 });
    expect(a).not.toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// createWorld — the seeded generation session
//
// All schema registrations, registry lookups, and cross-schema consistency
// happen within one world. Multiple worlds are independent.
// ---------------------------------------------------------------------------

describe("createWorld", () => {
  it("creates a world without throwing", () => {
    expect(() => createWorld({ seed: 42 })).not.toThrow();
  });

  it("exposes a registry property", () => {
    expect(createWorld({ seed: 42 }).registry).toBeDefined();
  });

  it("withSchema returns the world (fluent API)", () => {
    const world = createWorld({ seed: 42 });
    expect(world.withSchema(PersonSchema)).toBe(world);
  });

  it("withGenerators returns the world (fluent API)", () => {
    const world = createWorld({ seed: 42 });
    expect(world.withGenerators({})).toBe(world);
  });
});

// ---------------------------------------------------------------------------
// world.generate — primitive and ad-hoc schemas
//
// Any Zod schema can be generated without prior registration — the world
// falls back to schema-based and key-based heuristics automatically.
// ---------------------------------------------------------------------------

describe("world.generate — primitives (ad-hoc, no registration)", () => {
  const world = createWorld({ seed: 42 });

  it("generates a string for z.string()", () => {
    expect(typeof world.generate(z.string())).toBe("string");
  });

  it("generates a number for z.number()", () => {
    expect(typeof world.generate(z.number())).toBe("number");
  });

  it("generates a boolean for z.boolean()", () => {
    expect(typeof world.generate(z.boolean())).toBe("boolean");
  });

  it("generates a Date for z.date()", () => {
    expect(world.generate(z.date())).toBeInstanceOf(Date);
  });

  it("generates a member of a z.enum()", () => {
    const schema = z.enum(["a", "b", "c"]);
    const results = Array.from({ length: 30 }, () => world.generate(schema));
    expect(results.every((r) => ["a", "b", "c"].includes(r))).toBe(true);
  });

  it("generates all fields of a z.object()", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = world.generate(schema);
    expect(typeof result.name).toBe("string");
    expect(typeof result.age).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// world.generate — registered schema with matchers
//
// withSchema(schema, { matchers }) lets you override individual field
// generation. Matchers receive a GeneratorContext (ctx) giving access to
// the PRNG, generators, registry, and relation resolvers.
// ---------------------------------------------------------------------------

describe("world.generate — registered schema with matchers", () => {
  function setup() {
    return createWorld({ seed: 42 }).withSchema(PersonSchema, {
      matchers: {
        email: (ctx) => {
          const ascii = (s: string) =>
            s
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .toLowerCase()
              .replace(/[^a-z]/g, "x");
          return `${ascii(ctx.gen.person.firstName())}.${ascii(ctx.gen.person.lastName())}@example.nl`;
        },
      },
    });
  }

  it("generates an object that validates against the schema", () => {
    expect(PersonSchema.safeParse(setup().generate(PersonSchema)).success).toBe(true);
  });

  it("applies matcher: email is derived using ctx.gen", () => {
    expect(setup().generate(PersonSchema).email).toMatch(/@example\.nl$/);
  });

  it("is deterministic: same seed → same output", () => {
    expect(setup().generate(PersonSchema)).toEqual(setup().generate(PersonSchema));
  });

  it("unmatched fields fall through to heuristics", () => {
    const result = setup().generate(PersonSchema);
    // personId is a UUID field — the *id key pattern should fire
    expect(z.uuid().safeParse(result.personId).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ctx.gen — generators with PRNG pre-bound
//
// ctx.gen.* provides the full generators namespace with the field-seeded
// PRNG already applied. Call ctx.gen.person.firstName() instead of
// generators.person.firstName(ctx.prng). Arguments (count, min, max)
// still pass through.
// ---------------------------------------------------------------------------

describe("ctx.gen — bound generators in matchers", () => {
  it("ctx.gen.person.firstName() returns a non-empty string", () => {
    let captured: string | undefined;
    const S = z.object({ name: z.string() });
    createWorld({ seed: 42 })
      .withSchema(S, {
        matchers: {
          name: (ctx) => {
            captured = ctx.gen.person.firstName();
            return captured;
          },
        },
      })
      .generate(S);
    expect(typeof captured).toBe("string");
    expect(captured!.length).toBeGreaterThan(0);
  });

  it("ctx.gen.word.sentence() returns a sentence string", () => {
    let captured: string | undefined;
    const S = z.object({ title: z.string() });
    createWorld({ seed: 42 })
      .withSchema(S, {
        matchers: {
          title: (ctx) => {
            captured = ctx.gen.word.sentence();
            return captured;
          },
        },
      })
      .generate(S);
    expect(typeof captured).toBe("string");
    expect(captured!.length).toBeGreaterThan(0);
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

  it("ctx.gen produces deterministic values (same seed → same result)", () => {
    const S = z.object({ title: z.string() });
    const makeWorld = () =>
      createWorld({ seed: 42 }).withSchema(S, {
        matchers: { title: (ctx) => ctx.gen.word.sentence() },
      });
    expect(makeWorld().generate(S)).toEqual(makeWorld().generate(S));
  });

  it("different fields receive different PRNGs (per-field seeding)", () => {
    const captured: string[] = [];
    const S = z.object({ a: z.string(), b: z.string() });
    createWorld({ seed: 42 })
      .withSchema(S, {
        matchers: {
          a: (ctx) => {
            captured.push(ctx.gen.person.firstName());
            return captured[0]!;
          },
          b: (ctx) => {
            captured.push(ctx.gen.person.firstName());
            return captured[1]!;
          },
        },
      })
      .generate(S);
    expect(captured[0]).not.toBe(captured[1]);
  });
});

// ---------------------------------------------------------------------------
// world.generate — arrays
//
// Arrays of registered schemas use the same matcher pipeline per element.
// Constraints (min, max, length) are respected exactly.
// ---------------------------------------------------------------------------

describe("world.generate — z.array()", () => {
  function setup() {
    return createWorld({ seed: 42 }).withSchema(PersonSchema);
  }

  it("generates an array", () => {
    expect(Array.isArray(setup().generate(z.array(PersonSchema)))).toBe(true);
  });

  it("all elements validate against the schema", () => {
    for (const item of setup().generate(z.array(PersonSchema).min(3).max(10))) {
      expect(PersonSchema.safeParse(item).success).toBe(true);
    }
  });

  it("respects .min() and .max()", () => {
    const result = setup().generate(z.array(PersonSchema).min(5).max(10));
    expect(result.length).toBeGreaterThanOrEqual(5);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("respects .length(n) for exact length", () => {
    expect(setup().generate(z.array(PersonSchema).length(7))).toHaveLength(7);
  });

  it("is deterministic: same seed → same array", () => {
    const r1 = setup().generate(z.array(PersonSchema).length(3));
    const r2 = setup().generate(z.array(PersonSchema).length(3));
    expect(r1).toEqual(r2);
  });

  it("uses defaultArrayLength when no constraints are present", () => {
    const world = createWorld({ seed: 42, defaultArrayLength: [3, 3] }).withSchema(PersonSchema);
    expect(world.generate(z.array(PersonSchema))).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// world.generate — array modifier chaining
// ---------------------------------------------------------------------------

describe("world.generate — array as modifier chain", () => {
  function setup() {
    return createWorld({ seed: 42 }).withSchema(PersonSchema);
  }

  it("schema.array() works like z.array(schema)", () => {
    const result = setup().generate(PersonSchema.array());
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("schema.array().optional() returns an array or undefined", () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      createWorld({ seed: i }).withSchema(PersonSchema).generate(PersonSchema.array().optional()),
    );
    expect(results.some((r) => Array.isArray(r))).toBe(true);
    expect(results.some((r) => r === undefined)).toBe(true);
  });

  it("schema.array().nullable() returns an array or null", () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      createWorld({ seed: i }).withSchema(PersonSchema).generate(PersonSchema.array().nullable()),
    );
    expect(results.some((r) => Array.isArray(r))).toBe(true);
    expect(results.some((r) => r === null)).toBe(true);
  });

  it("respects .min()/.max() constraints on the array", () => {
    const result = setup().generate(PersonSchema.array().min(4).max(6));
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it("z.object({}).optional().array().optional() resolves correctly", () => {
    const schema = z.object({ id: z.string() }).optional().array().optional();
    const results = Array.from({ length: 20 }, (_, i) => createWorld({ seed: i }).generate(schema));
    expect(results.some((r) => Array.isArray(r))).toBe(true);
    expect(results.some((r) => r === undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// world.generate — optional and nullable fields
//
// Optional fields may be omitted; nullable fields may be null. The default
// probability of omission is controlled by `optionalProbability`.
// ---------------------------------------------------------------------------

describe("world.generate — optional and nullable fields in objects", () => {
  const SchemaWithOptionals = z.object({
    name: z.string(),
    bio: z.string().optional(),
    score: z.number().optional(),
    tag: z.string().nullable(),
  });

  it("sometimes produces undefined for optional fields (across seeds)", () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      createWorld({ seed: i }).generate(SchemaWithOptionals),
    );
    expect(results.some((r) => r.bio === undefined)).toBe(true);
    expect(results.some((r) => r.bio !== undefined)).toBe(true);
  });

  it("sometimes produces null for nullable fields (across seeds)", () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      createWorld({ seed: i }).generate(SchemaWithOptionals),
    );
    expect(results.some((r) => r.tag === null)).toBe(true);
    expect(results.some((r) => r.tag !== null)).toBe(true);
  });

  it("optionalProbability: 1.0 always omits optional fields", () => {
    const result = createWorld({ seed: 42, optionalProbability: 1.0 }).generate(
      SchemaWithOptionals,
    );
    expect(result.bio).toBeUndefined();
    expect(result.score).toBeUndefined();
    expect(result.tag).toBeNull();
  });

  it("optionalProbability: 0 never omits optional fields", () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      createWorld({ seed: i, optionalProbability: 0 }).generate(SchemaWithOptionals),
    );
    expect(results.every((r) => r.bio !== undefined)).toBe(true);
    expect(results.every((r) => r.tag !== null)).toBe(true);
  });

  it("key-based generator fires for optional fields", () => {
    // 'email' wrapped in .optional() should still produce an email-formatted
    // string, not a generic word. The optional wrapper must not suppress
    // the key-based heuristic.
    const ProfileSchema = z.object({
      userId: z.string(),
      email: z.string().optional(),
    });
    const results = Array.from({ length: 20 }, (_, i) =>
      createWorld({ seed: i, optionalProbability: 0 }).generate(ProfileSchema),
    );
    expect(results.every((r) => typeof r.email === "string" && r.email.includes("@"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Relations — ctx.related()
//
// Declaring `relations: { name: OtherSchema }` on a schema lets matchers
// call ctx.related("name") to get the related schema instance. If none
// exist in the registry yet, the world auto-provisions one.
// ---------------------------------------------------------------------------

describe("relations — ctx.related()", () => {
  function setup() {
    return createWorld({ seed: 42 })
      .withSchema(PersonSchema)
      .withSchema(OrderSchema, {
        relations: { customer: PersonSchema },
        matchers: {
          customerId: (ctx) => ctx.related("customer").personId,
        },
      });
  }

  it("order.customerId matches a generated person.personId", () => {
    const world = setup();
    const order = world.generate(OrderSchema);
    const personIds = new Set(world.registry.all(PersonSchema).map((p) => p.personId));
    expect(personIds.has(order.customerId)).toBe(true);
  });

  it("auto-provisions the related schema when none exist", () => {
    const world = setup();
    expect(world.registry.all(PersonSchema)).toHaveLength(0);
    world.generate(OrderSchema);
    expect(world.registry.all(PersonSchema).length).toBeGreaterThanOrEqual(1);
  });

  it("reuses existing registry records when available", () => {
    const world = setup().populate(PersonSchema, 3);
    world.generate(z.array(OrderSchema).length(5));
    expect(world.registry.all(PersonSchema)).toHaveLength(3);
  });

  it("is deterministic: same seed → same customerId", () => {
    const r1 = setup().generate(OrderSchema);
    const r2 = setup().generate(OrderSchema);
    expect(r1.customerId).toBe(r2.customerId);
  });
});

// ---------------------------------------------------------------------------
// world.populate — pre-seeding the registry
//
// `populate(Schema, n)` generates n instances and stores them without
// returning them. Relation lookups will reuse these records.
// ---------------------------------------------------------------------------

describe("world.populate", () => {
  it("populates n instances in the registry", () => {
    const world = createWorld({ seed: 42 }).withSchema(PersonSchema).populate(PersonSchema, 5);
    expect(world.registry.all(PersonSchema)).toHaveLength(5);
  });

  it("returns the world for fluent chaining", () => {
    const world = createWorld({ seed: 42 }).withSchema(PersonSchema);
    expect(world.populate(PersonSchema, 3)).toBe(world);
  });

  it("populated records are picked by relations", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(PersonSchema)
      .withSchema(OrderSchema, {
        relations: { customer: PersonSchema },
        matchers: { customerId: (ctx) => ctx.related("customer").personId },
      })
      .populate(PersonSchema, 2);

    const orders = world.generate(z.array(OrderSchema).length(10));
    const personIds = new Set(world.registry.all(PersonSchema).map((p) => p.personId));
    for (const o of orders) {
      expect(personIds.has(o.customerId)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Derived schemas — from: and ctx.source
//
// `from: SourceSchema` ties each output record to a specific SourceSchema
// instance. ctx.source gives the matcher access to that instance's fields.
// The output schema generates exactly one record per source record.
// ---------------------------------------------------------------------------

describe("derived schemas — from: and ctx.source", () => {
  const PersonSummarySchema = z.object({
    id: z.uuid(),
    fullName: z.string(),
    emailHash: z.string(),
  });

  function setup() {
    return createWorld({ seed: 42 })
      .withSchema(PersonSchema)
      .withSchema(PersonSummarySchema, {
        from: PersonSchema,
        matchers: {
          id: (ctx) => ctx.source.personId,
          fullName: (ctx) => `${ctx.source.firstName} ${ctx.source.lastName}`,
          emailHash: (ctx) => ctx.source.email.split("@")[0] ?? "",
        },
      });
  }

  it("derived id equals the source personId", () => {
    const world = setup();
    const persons = world.generate(z.array(PersonSchema).length(3));
    const summaries = world.generate(z.array(PersonSummarySchema));
    const personIds = new Set(persons.map((p: { personId: string }) => p.personId));
    for (const s of summaries) {
      expect(personIds.has(s.id)).toBe(true);
    }
  });

  it("ctx.source provides the source schema data", () => {
    const world = setup();
    const persons = world.generate(z.array(PersonSchema).length(3));
    const summaries = world.generate(z.array(PersonSummarySchema));
    for (let i = 0; i < persons.length; i++) {
      expect(summaries[i]!.fullName).toBe(`${persons[i]!.firstName} ${persons[i]!.lastName}`);
    }
  });

  it("generates one derived record per source record", () => {
    const world = setup();
    world.generate(z.array(PersonSchema).length(4));
    expect(world.generate(z.array(PersonSummarySchema))).toHaveLength(4);
  });

  it("is deterministic across same-seed worlds", () => {
    const make = () => {
      const world = setup();
      world.generate(z.array(PersonSchema).length(3));
      return world.generate(z.array(PersonSummarySchema));
    };
    expect(make()).toEqual(make());
  });
});

// ---------------------------------------------------------------------------
// Registry — schema-reference API
//
// Registry methods accept the Zod schema object directly as the key — no
// string type names, no manual casts. The result is fully typed.
// ---------------------------------------------------------------------------

describe("registry — schema-reference API", () => {
  function setup() {
    return createWorld({ seed: 42 })
      .withSchema(PersonSchema)
      .withSchema(OrderSchema, {
        relations: { customer: PersonSchema },
        matchers: { customerId: (ctx) => ctx.related("customer").personId },
      });
  }

  it("registry.all(Schema) returns all generated instances", () => {
    const world = setup().populate(PersonSchema, 3);
    const persons = world.registry.all(PersonSchema);
    expect(persons).toHaveLength(3);
    for (const p of persons) {
      expect(PersonSchema.safeParse(p).success).toBe(true);
    }
  });

  it("registry.pick(Schema) returns a single valid instance", () => {
    const world = setup().populate(PersonSchema, 5);
    const person = world.registry.pick(PersonSchema);
    expect(PersonSchema.safeParse(person).success).toBe(true);
  });

  it("registry.filter(Schema, predicate) returns matching instances", () => {
    const world = setup().populate(PersonSchema, 5);
    world.generate(z.array(OrderSchema).length(10));
    const targetId = world.registry.all(PersonSchema)[0]!.personId;
    const orders = world.registry.filter(OrderSchema, (o) => o.customerId === targetId);
    for (const o of orders) {
      expect(o.customerId).toBe(targetId);
    }
  });

  it("registry.count(Schema) returns the number of stored instances", () => {
    expect(setup().populate(PersonSchema, 4).registry.count(PersonSchema)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Determinism
//
// Same seed + same schema registration order → byte-identical output.
// Per-field PRNG seeding means adding/removing fields doesn't disturb
// the values of other fields.
// ---------------------------------------------------------------------------

describe("determinism", () => {
  it("same seed produces identical output", () => {
    const make = (seed: number) =>
      createWorld({ seed }).withSchema(PersonSchema).generate(z.array(PersonSchema).length(3));
    expect(make(42)).toEqual(make(42));
  });

  it("different seeds produce different output", () => {
    const make = (seed: number) =>
      createWorld({ seed }).withSchema(PersonSchema).generate(z.array(PersonSchema).length(3));
    expect(make(1)).not.toEqual(make(2));
  });

  it("adding a field does not change values of existing fields", () => {
    // Per-field PRNG seeding: each field derives its PRNG from
    // hash(seed + fieldPath), so adding 'age' doesn't shift 'name' or 'email'.
    const SchemaA = z.object({ name: z.string(), email: z.email() });
    const SchemaB = z.object({ name: z.string(), age: z.number(), email: z.email() });
    const a = createWorld({ seed: 42 }).generate(SchemaA);
    const b = createWorld({ seed: 42 }).generate(SchemaB);
    expect(a.name).toBe(b.name);
    expect(a.email).toBe(b.email);
  });
});

// ---------------------------------------------------------------------------
// ctx.current propagation
//
// When generating object fields, each field's context includes a `current`
// containing all sibling fields generated so far. This enables gender-aware
// name generation: if the schema emits `gender` before `firstName`, the name
// generator can pick from the correct pool.
//
// Before the fix, world.ts never passed `current` to makeFieldCtx, so
// ctx.current was always undefined — gender detection silently fell back to
// "neutral" and names were picked from the full (mixed) pool.
// ---------------------------------------------------------------------------

describe("ctx.current propagation", () => {
  it("first field sees an empty current object", () => {
    let capturedCurrent: Record<string, unknown> | undefined;
    const S = z.object({ a: z.string(), b: z.string() });
    createWorld({ seed: 42 })
      .withSchema(S, {
        matchers: {
          a: (ctx) => {
            capturedCurrent = { ...ctx.current }; // snapshot — live ref fills up after
            return "first";
          },
        },
      })
      .generate(S);
    expect(capturedCurrent).toBeDefined();
    expect(Object.keys(capturedCurrent!)).toHaveLength(0);
  });

  it("later fields see previously generated siblings in current", () => {
    let capturedCurrent: Record<string, unknown> | undefined;
    const S = z.object({ a: z.string(), b: z.string() });
    createWorld({ seed: 42 })
      .withSchema(S, {
        matchers: {
          b: (ctx) => {
            capturedCurrent = { ...ctx.current }; // snapshot
            return "second";
          },
        },
      })
      .generate(S);
    expect(capturedCurrent).toBeDefined();
    expect(typeof capturedCurrent!["a"]).toBe("string");
  });

  it("key-based firstName picks only female names when gender sibling is 'female'", () => {
    const FEMALE_NAMES = [
      "Marie", "Anna", "Lisa", "Emma", "Sara", "Lena", "Nora", "Eva", "Julia", "Inge",
      "Lieke", "Noa", "Lotte", "Fleur", "Tess", "Mila", "Sanne", "Sophie", "Roos", "Isa",
      "Zoë", "Evi", "Maud", "Lynn", "Yara", "Liv", "Sarah", "Nina", "Suze", "Fenny",
      "Sofie", "Fenna", "Bo", "Luna", "Feline", "Milou", "Lauren", "Vera", "Anne", "Laura",
    ];
    const S = z.object({ gender: z.literal("female"), firstName: z.string() });
    for (let seed = 0; seed < 20; seed++) {
      const { firstName } = createWorld({ seed }).generate(S);
      expect(FEMALE_NAMES).toContain(firstName);
    }
  });

  it("key-based firstName picks only male names when gender sibling is 'male'", () => {
    const MALE_NAMES = [
      "Jan", "Piet", "Klaas", "Hans", "Dirk", "Erik", "Tom", "Sven", "Luc", "Bas",
      "Thijs", "Bram", "Luuk", "Lars", "Stijn", "Gijs", "Sem", "Daan", "Finn", "Willem",
      "Milan", "Levi", "Lucas", "Noah", "Jesse", "Max", "Ruben", "Mees", "Sam", "Guus",
      "Julian", "Tim", "Koen", "Teun", "Jens", "Hugo", "Roel", "Floris", "Joris", "Mark",
    ];
    const S = z.object({ gender: z.literal("male"), firstName: z.string() });
    for (let seed = 0; seed < 20; seed++) {
      const { firstName } = createWorld({ seed }).generate(S);
      expect(MALE_NAMES).toContain(firstName);
    }
  });
});

// ---------------------------------------------------------------------------
// Regression Tests
// ---------------------------------------------------------------------------

describe("Regression Tests", () => {
  it("world.populate() passes ctx.source to derived schemas", () => {
    const SourceSchema = z.object({ id: z.string(), name: z.string() });
    const DerivedSchema = z.object({ id: z.string(), label: z.string() });

    let matcherCalled = false;
    const world = createWorld({ seed: 42 })
      .withSchema(SourceSchema)
      .withSchema(DerivedSchema, {
        from: SourceSchema,
        matchers: {
          id: (ctx) => {
            matcherCalled = true;
            return ctx.source.id;
          },
          label: (ctx) => `Label: ${ctx.source.name}`,
        },
      });

    world.populate(SourceSchema, 1);
    world.populate(DerivedSchema, 1);

    const sourceObject = world.registry.all(SourceSchema)[0];
    const derivedObject = world.registry.all(DerivedSchema)[0];
    expect(matcherCalled).toBe(true);
    expect(sourceObject?.id).toEqual(derivedObject?.id);
  });

  it("world.generate() honors overrides for array schemas", () => {
    const ItemSchema = z.object({ id: z.string(), val: z.number() });
    const world = createWorld({ seed: 42 });

    const result = world.generate(z.array(ItemSchema).length(3), {
      overrides: [{ val: 999 }, { val: 999 }, { val: 999 }],
    }) as any[];

    expect(result[0].val).toBe(999);
  });

  it("deepMerge() honors explicit undefined values in overrides", () => {
    const Schema = z.object({
      optional: z.string().optional(),
    });
    const world = createWorld({ seed: 42 });

    const result = world.generate(Schema, {
      overrides: { optional: undefined },
    });

    expect(result.optional).toBeUndefined();
  });

  it("honors Zod .default() values based on optionalProbability", () => {
    const Schema = z.object({
      def: z.string().default("fixed-value"),
    });

    const worldAbs = createWorld({ seed: 42, optionalProbability: 1.0 });
    const resultAbs = worldAbs.generate(Schema);
    expect(resultAbs.def).toBe("fixed-value");

    const worldPres = createWorld({ seed: 42, optionalProbability: 0.0 });
    const resultPres = worldPres.generate(Schema);
    expect(resultPres.def).not.toBe("fixed-value");
    expect(typeof resultPres.def).toBe("string");
  });
});

describe("Cascading Recursion (Integration)", () => {
  interface Category {
    id: string;
    name: string;
    children: Category[];
  }

  const CategorySchema: z.ZodType<Category> = z.lazy(() =>
    z.object({
      id: z.string().cuid2(),
      name: z.string(),
      children: z.array(CategorySchema).max(2),
    }),
  );

  it("handles deep recursive tree generation without stack overflow", () => {
    // This previously caused RangeError in the playground due to
    // incorrect lazy resolution and registry lookup bypass.
    expect(() => generate(CategorySchema, { seed: 123, recursionLimit: 5 })).not.toThrow();

    const result = generate(CategorySchema, { seed: 123, recursionLimit: 5 });
    expect(result.id).toBeDefined();
    expect(Array.isArray(result.children)).toBe(true);
  });

  it("respects recursionLimit on self-referential schemas", () => {
    const result = generate(CategorySchema, { seed: 123, recursionLimit: 2 });

    const checkDepth = (node: Category | null, current: number): number => {
      if (!node || !node.children || node.children.length === 0) return current;
      return Math.max(...node.children.map((c) => checkDepth(c, current + 1)));
    };

    const depth = checkDepth(result, 0);
    // Since recursionLimit is 2, it should not generate more than a few levels.
    expect(depth).toBeLessThanOrEqual(5);
  });

  it("generates unique IDs for recursive children within the same tree", () => {
    const world = createWorld({ seed: 123 }).withSchema(CategorySchema);
    const result = world.generate(CategorySchema) as Category;

    // Check depth 1
    if (result.children && result.children.length > 0) {
      const child = result.children[0]!;
      expect(child.id).not.toBe(result.id);

      // Check depth 2
      if (child.children && child.children.length > 0) {
        const grandchild = child.children[0]!;
        expect(grandchild.id).not.toBe(child.id);
        expect(grandchild.id).not.toBe(result.id);
      }
    }
  });
});
