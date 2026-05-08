/**
 * Unit tests for `createWorld` and the `World` interface.
 *
 * Most tests will fail with "not implemented" until fase 3.  They document
 * the expected contract and serve as the acceptance criteria for the
 * implementation.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld, defineSubjectType, generators } from "../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PersonSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  age: z.number().int().min(18).max(90),
});

const PersonSubject = defineSubjectType(
  "person",
  z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
  }),
);

const CompanySubject = defineSubjectType(
  "company",
  z.object({
    name: z.string(),
    sector: z.enum(["tech", "finance", "retail"]),
  }),
  {
    relations: {
      employees: { type: "person", cardinality: "0..n" },
    },
  },
);

// ---------------------------------------------------------------------------
// createWorld
// ---------------------------------------------------------------------------

describe("createWorld", () => {
  it("creates a world without throwing", () => {
    expect(() => createWorld({ seed: 42 })).not.toThrow();
  });

  it("exposes a registry property", () => {
    const world = createWorld({ seed: 42 });
    expect(world.registry).toBeDefined();
  });

  it("withSubject returns the world (fluent API)", () => {
    const world = createWorld({ seed: 42 });
    expect(world.withSubject(PersonSubject)).toBe(world);
  });

  it("withSchema returns the world (fluent API)", () => {
    const world = createWorld({ seed: 42 }).withSubject(PersonSubject);
    expect(world.withSchema(PersonSchema, PersonSubject)).toBe(world);
  });

  it("withSchema accepts string names (weakly typed)", () => {
    const world = createWorld({ seed: 42 }).withSubject(PersonSubject).withSubject(CompanySubject);
    expect(() =>
      world.withSchema(z.object({ id: z.string() }), ["person", "company"]),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// world.subject
// ---------------------------------------------------------------------------

describe("world.subject", () => {
  it("returns an object with _type matching the requested type", () => {
    const world = createWorld({ seed: 42 }).withSubject(PersonSubject);
    const person = world.subject("person");
    expect(person._type).toBe("person");
  });

  it("returns an object with a string _id", () => {
    const world = createWorld({ seed: 42 }).withSubject(PersonSubject);
    const person = world.subject("person");
    expect(typeof person._id).toBe("string");
    expect(person._id.length).toBeGreaterThan(0);
  });

  it("returns a data object", () => {
    const world = createWorld({ seed: 42 }).withSubject(PersonSubject);
    const person = world.subject("person");
    expect(person.data).toBeDefined();
    expect(typeof person.data).toBe("object");
  });

  it("is deterministic: same seed + same call order → same result", () => {
    const makeWorld = () => createWorld({ seed: 42 }).withSubject(PersonSubject);
    const p1 = makeWorld().subject("person");
    const p2 = makeWorld().subject("person");
    expect(p1._id).toBe(p2._id);
    expect(p1.data).toEqual(p2.data);
  });

  it("successive calls return different subjects", () => {
    const world = createWorld({ seed: 42 }).withSubject(PersonSubject);
    const p1 = world.subject("person");
    const p2 = world.subject("person");
    expect(p1._id).not.toBe(p2._id);
  });

  it("subject data validates against the registered schema", () => {
    const world = createWorld({ seed: 42 }).withSubject(PersonSubject);
    const person = world.subject("person");
    const result = PersonSubject.schema.safeParse(person.data);
    expect(result.success).toBe(true);
  });

  it("throws for an unregistered subject type", () => {
    const world = createWorld({ seed: 42 });
    expect(() => world.subject("nonexistent")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// world.generate — basic schema types
// ---------------------------------------------------------------------------

describe("world.generate — primitives (ad-hoc, no subject binding)", () => {
  it("generates a string for z.string()", () => {
    const world = createWorld({ seed: 42 });
    expect(typeof world.generate(z.string())).toBe("string");
  });

  it("generates a number for z.number()", () => {
    const world = createWorld({ seed: 42 });
    expect(typeof world.generate(z.number())).toBe("number");
  });

  it("generates a boolean for z.boolean()", () => {
    const world = createWorld({ seed: 42 });
    expect(typeof world.generate(z.boolean())).toBe("boolean");
  });

  it("generates a Date for z.date()", () => {
    const world = createWorld({ seed: 42 });
    expect(world.generate(z.date())).toBeInstanceOf(Date);
  });

  it("generates a member of a z.enum()", () => {
    const world = createWorld({ seed: 42 });
    const schema = z.enum(["a", "b", "c"]);
    const results = Array.from({ length: 30 }, () => world.generate(schema));
    expect(results.every((r) => ["a", "b", "c"].includes(r))).toBe(true);
  });

  it("generates all fields of a z.object()", () => {
    const world = createWorld({ seed: 42 });
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = world.generate(schema);
    expect(typeof result.name).toBe("string");
    expect(typeof result.age).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// world.generate — registered schema with subject matchers
// ---------------------------------------------------------------------------

describe("world.generate — registered schema", () => {
  function setup() {
    return createWorld({ seed: 42 })
      .withSubject(PersonSubject)
      .withSchema(PersonSchema, PersonSubject, {
        firstName: (s) => s.firstName,
        lastName: (s) => s.lastName,
        email: (s) => `${s.firstName[0]}.${s.lastName}@example.nl`.toLowerCase(),
      });
  }

  it("generates an object that validates against the schema", () => {
    const result = setup().generate(PersonSchema);
    expect(PersonSchema.safeParse(result).success).toBe(true);
  });

  it("applies matcher: email is derived from firstName and lastName", () => {
    const result = setup().generate(PersonSchema);
    expect(result.email).toMatch(/@example\.nl$/);
  });

  it("is deterministic: same seed → same output", () => {
    const r1 = setup().generate(PersonSchema);
    const r2 = setup().generate(PersonSchema);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// world.generate — arrays
// ---------------------------------------------------------------------------

describe("world.generate — z.array()", () => {
  function setup() {
    return createWorld({ seed: 42 })
      .withSubject(PersonSubject)
      .withSchema(PersonSchema, PersonSubject);
  }

  it("generates an array", () => {
    const result = setup().generate(z.array(PersonSchema));
    expect(Array.isArray(result)).toBe(true);
  });

  it("all elements validate against the schema", () => {
    const result = setup().generate(z.array(PersonSchema).min(3).max(10));
    for (const item of result) {
      expect(PersonSchema.safeParse(item).success).toBe(true);
    }
  });

  it("respects .min() and .max()", () => {
    const result = setup().generate(z.array(PersonSchema).min(5).max(10));
    expect(result.length).toBeGreaterThanOrEqual(5);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("respects .length(n) for exact length", () => {
    const result = setup().generate(z.array(PersonSchema).length(7));
    expect(result).toHaveLength(7);
  });

  it("is deterministic: same seed → same array", () => {
    const r1 = setup().generate(z.array(PersonSchema).length(3));
    const r2 = setup().generate(z.array(PersonSchema).length(3));
    expect(r1).toEqual(r2);
  });

  it("uses world defaultArrayLength when no constraints are present", () => {
    const world = createWorld({ seed: 42, defaultArrayLength: [3, 3] })
      .withSubject(PersonSubject)
      .withSchema(PersonSchema, PersonSubject);
    const result = world.generate(z.array(PersonSchema));
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// world.generate — array modifier chaining
// ---------------------------------------------------------------------------

describe("world.generate — array as modifier chain", () => {
  function setup() {
    return createWorld({ seed: 42 })
      .withSubject(PersonSubject)
      .withSchema(PersonSchema, PersonSubject);
  }

  it("schema.array() works like z.array(schema)", () => {
    const result = setup().generate(PersonSchema.array());
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("schema.array().optional() returns an array or undefined", () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      createWorld({ seed: i })
        .withSubject(PersonSubject)
        .withSchema(PersonSchema, PersonSubject)
        .generate(PersonSchema.array().optional()),
    );
    expect(results.some((r) => Array.isArray(r))).toBe(true);
    expect(results.some((r) => r === undefined)).toBe(true);
  });

  it("schema.array().nullable() returns an array or null", () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      createWorld({ seed: i })
        .withSubject(PersonSubject)
        .withSchema(PersonSchema, PersonSubject)
        .generate(PersonSchema.array().nullable()),
    );
    expect(results.some((r) => Array.isArray(r))).toBe(true);
    expect(results.some((r) => r === null)).toBe(true);
  });

  it("uses subject-aware generation through modifier chain", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(PersonSubject)
      .withSchema(PersonSchema, PersonSubject, {
        firstName: (s) => s.firstName,
      });
    const result = world.generate(PersonSchema.array().optional());
    if (result !== undefined) {
      for (const item of result) {
        expect(typeof item.firstName).toBe("string");
      }
    }
  });

  it("respects .min()/.max() constraints on the array", () => {
    const result = setup().generate(PersonSchema.array().min(4).max(6));
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it("z.object({}).optional().array().optional() resolves correctly", () => {
    const schema = z.object({ id: z.string() }).optional().array().optional();
    const results = Array.from({ length: 20 }, (_, i) =>
      createWorld({ seed: i }).generate(schema),
    );
    expect(results.some((r) => Array.isArray(r))).toBe(true);
    expect(results.some((r) => r === undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// world.generate — optional and nullable fields
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

  it("respects optionalProbability: 1.0 always omits optional fields", () => {
    const world = createWorld({ seed: 42, optionalProbability: 1.0 });
    const result = world.generate(SchemaWithOptionals);
    expect(result.bio).toBeUndefined();
    expect(result.score).toBeUndefined();
    expect(result.tag).toBeNull();
  });

  it("respects optionalProbability: 0 never omits optional fields", () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      createWorld({ seed: i, optionalProbability: 0 }).generate(SchemaWithOptionals),
    );
    expect(results.every((r) => r.bio !== undefined)).toBe(true);
    expect(results.every((r) => r.tag !== null)).toBe(true);
  });

  it("derive: overwrites base-generated field with derived value", () => {
    const Subject = defineSubjectType(
      "person",
      z.object({ firstName: z.string(), lastName: z.string(), email: z.email() }),
      {
        derive: {
          email: ({ firstName, lastName }) => `${firstName![0]}.${lastName}@test.com`.toLowerCase(),
        },
      },
    );
    const world = createWorld({ seed: 42 }).withSubject(Subject);
    const inst = world.subject("person");
    const data = inst.data as { firstName: string; lastName: string; email: string };
    expect(data.email).toBe(`${data.firstName[0]}.${data.lastName}@test.com`.toLowerCase());
  });

  it("derive: partial receives all base-generated sibling fields", () => {
    const Subject = defineSubjectType("tagged", z.object({ name: z.string(), tag: z.string() }), {
      derive: {
        tag: ({ name }) => `tag-${name}`,
      },
    });
    const world = createWorld({ seed: 1 }).withSubject(Subject);
    const data = world.subject("tagged").data as { name: string; tag: string };
    expect(data.tag).toBe(`tag-${data.name}`);
  });

  it("derive: declaration order enables chaining (B sees A's derived value)", () => {
    const Subject = defineSubjectType(
      "chained",
      z.object({ base: z.string(), mid: z.string(), top: z.string() }),
      {
        derive: {
          mid: ({ base }) => `mid-${base}`,
          top: ({ mid }) => `top-${mid}`,
        },
      },
    );
    const world = createWorld({ seed: 1 }).withSubject(Subject);
    const data = world.subject("chained").data as { base: string; mid: string; top: string };
    expect(data.mid).toBe(`mid-${data.base}`);
    expect(data.top).toBe(`top-${data.mid}`);
  });

  it("derive: world-level generator overrides derive for the same key", () => {
    const Subject = defineSubjectType(
      "person",
      z.object({ firstName: z.string(), email: z.email() }),
      {
        derive: {
          email: ({ firstName }) => `derive-${firstName}@test.com`,
        },
      },
    );
    const world = createWorld({
      seed: 42,
      generators: { email: () => "world@override.com" },
    }).withSubject(Subject);
    const data = world.subject("person").data as { email: string };
    expect(data.email).toBe("world@override.com");
  });

  it("key-based generator fires for optional fields in a registered (subject-bound) schema", () => {
    // 'email' wrapped in .optional() should still produce an email-formatted string,
    // not a generic word string. Without the fix, isStringSchema() returns false for
    // the optional wrapper, so the key-based email generator never fires and the
    // field gets a generic word string instead.
    const UserSubject = defineSubjectType("user", z.object({ userId: z.uuid() }));
    const ProfileSchema = z.object({
      userId: z.string(),
      email: z.string().optional(), // key-based: 'email' → email-formatted
    });
    const results = Array.from({ length: 20 }, (_, i) => {
      const world = createWorld({ seed: i, optionalProbability: 0 })
        .withSubject(UserSubject)
        .withSchema(ProfileSchema, UserSubject);
      return world.generate(ProfileSchema);
    });
    // Every present email should be email-formatted (key-based generator fired)
    expect(results.every((r) => typeof r.email === "string" && r.email.includes("@"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Subject-type keyMap
// ---------------------------------------------------------------------------

describe("subject-type keyMap", () => {
  const ProductSchema = z.object({
    name: z.string(),
    sku: z.string(),
    quantity: z.number().int(),
  });

  const ProductSubject = defineSubjectType("product", ProductSchema, {
    keyMap: {
      name: (prng) => `Product ${prng.int(100, 999)}`,
    },
  });

  it("subject keyMap overrides the default key heuristic for that field", () => {
    const world = createWorld({ seed: 42 }).withSubject(ProductSubject);
    const inst = world.subject("product");
    const data = inst.data as { name: string };
    // Default would produce a person full name; keyMap should produce "Product NNN"
    expect(data.name).toMatch(/^Product \d{3}$/);
  });

  it("other fields still use the default heuristics when not in keyMap", () => {
    const world = createWorld({ seed: 42 }).withSubject(ProductSubject);
    const inst = world.subject("product");
    const data = inst.data as { sku: string; quantity: number };
    // 'sku' is in DEFAULT_KEY_MAP — should be code-like, e.g. 'AB-1234'
    expect(typeof data.sku).toBe("string");
    expect(data.sku).toMatch(/^[A-Z]{2}-\d{4}$/);
    // 'quantity' is in DEFAULT_KEY_MAP.number
    expect(Number.isInteger(data.quantity)).toBe(true);
  });

  it("world-level withGenerators overrides subject keyMap for the same field", () => {
    const world = createWorld({
      seed: 42,
      generators: { name: () => "world-override" },
    }).withSubject(ProductSubject);

    const data = world.subject("product").data as { name: string };
    expect(data.name).toBe("world-override");
  });

  it("subject keyMap is deterministic across worlds with the same seed", () => {
    const make = () =>
      createWorld({ seed: 42 }).withSubject(ProductSubject).subject("product").data as {
        name: string;
      };

    expect(make().name).toBe(make().name);
  });

  it("subject keyMap receives a Prng that produces deterministic values", () => {
    const calls: number[] = [];
    const Subject = defineSubjectType("tracked", z.object({ val: z.number() }), {
      keyMap: {
        val: (prng) => {
          const v = prng.int(1, 1000);
          calls.push(v);
          return v;
        },
      },
    });
    const world = createWorld({ seed: 7 }).withSubject(Subject);
    world.subject("tracked");
    world.subject("tracked");
    // Both subjects should have produced values
    expect(calls.length).toBe(2);
    // Different subjects should get different seeded values
    expect(calls[0]).not.toBe(calls[1]);
  });

  it("subject keyMap generator can use generators.* functions directly", () => {
    const Subject = defineSubjectType(
      "article",
      z.object({ title: z.string(), name: z.string() }),
      {
        keyMap: {
          // Direct reference to a generators.* function (prng-only signature)
          name: generators.lorem.sentence,
        },
      },
    );
    const world = createWorld({ seed: 42 }).withSubject(Subject);
    const data = world.subject("article").data as { name: string };
    // lorem.sentence returns a capitalised string ending with a period
    expect(data.name.endsWith(".")).toBe(true);
  });
});
