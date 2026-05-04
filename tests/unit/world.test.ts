/**
 * Unit tests for `createWorld` and the `World` interface.
 *
 * Most tests will fail with "not implemented" until fase 3.  They document
 * the expected contract and serve as the acceptance criteria for the
 * implementation.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld, defineSubjectType } from "../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PersonSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  age: z.number().int().min(18).max(90),
});

const PersonSubject = defineSubjectType(
  "person",
  z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
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
    const world = createWorld({ seed: 42 })
      .withSubject(PersonSubject)
      .withSubject(CompanySubject);
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
    const makeWorld = () =>
      createWorld({ seed: 42 }).withSubject(PersonSubject);
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
        email: (s) =>
          `${s.firstName[0]}.${s.lastName}@example.nl`.toLowerCase(),
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
      createWorld({ seed: i, optionalProbability: 0 }).generate(
        SchemaWithOptionals,
      ),
    );
    expect(results.every((r) => r.bio !== undefined)).toBe(true);
    expect(results.every((r) => r.tag !== null)).toBe(true);
  });

  it("key-based generator fires for optional fields in a registered (subject-bound) schema", () => {
    // 'email' wrapped in .optional() should still produce an email-formatted string,
    // not a generic word string. Without the fix, isStringSchema() returns false for
    // the optional wrapper, so the key-based email generator never fires and the
    // field gets a generic word string instead.
    const UserSubject = defineSubjectType(
      "user",
      z.object({ userId: z.uuid() }),
    );
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
    expect(
      results.every(
        (r) => typeof r.email === "string" && r.email.includes("@"),
      ),
    ).toBe(true);
  });
});
