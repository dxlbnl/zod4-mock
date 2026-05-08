import { describe, it, expect } from "vitest";
import {
  generateSubjectCode,
  generateSchemaCode,
  generateWorldCode,
  generateFullExport,
  generateTokenizedCode,
} from "./codegen";
import type { SubjectDef, SchemaDef, PlaygroundState } from "./state.svelte";
import { makeField } from "./state.svelte";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const userSubject: SubjectDef = {
  id: "subj-1",
  name: "User",
  count: 3,
  fields: [
    { ...makeField(), id: "f1", key: "id", type: "uuid" },
    { ...makeField(), id: "f2", key: "email", type: "email" },
    {
      ...makeField(),
      id: "f3",
      key: "age",
      type: "number",
      modifiers: [{ name: ".int()" }, { name: ".min", value: 18 }],
    },
    { ...makeField(), id: "f4", key: "role", type: "enum", enumValues: ["admin", "member"] },
  ],
};

const orderSubject: SubjectDef = {
  id: "subj-2",
  name: "Order",
  count: 2,
  fields: [
    { ...makeField(), id: "f5", key: "id", type: "uuid" },
    { ...makeField(), id: "f6", key: "userId", type: "uuid" },
    {
      ...makeField(),
      id: "f7",
      key: "totalCents",
      type: "number",
      modifiers: [{ name: ".int()" }, { name: ".min", value: 0 }],
    },
  ],
};

const userApiSchema: SchemaDef = {
  id: "schema-1",
  name: "UserApi",
  fields: [
    { ...makeField(), id: "sf1", key: "userId", type: "uuid" },
    { ...makeField(), id: "sf2", key: "email", type: "email" },
  ],
};

const minimalState: PlaygroundState = {
  world: { seed: 42, optionalProbability: 0.2, defaultArrayLengthMin: 1, defaultArrayLengthMax: 5 },
  subjects: [userSubject, orderSubject],
  activeSubjectId: "subj-1",
  schemas: [userApiSchema],
  activeSchemaId: null,
  activeEntityType: "subject",
  relationships: [],
  bindings: [
    { schemaId: "schema-1", subjectId: "subj-1", fieldMap: { userId: "id", email: "email" } },
  ],
  ui: { exportOpen: false, outputTab: "code", sectionStates: {} },
};

// ─── generateSubjectCode ──────────────────────────────────────────────────────

describe("generateSubjectCode", () => {
  it("produces a defineSubjectType call", () => {
    const code = generateSubjectCode(userSubject, []);
    expect(code).toContain('defineSubjectType("User"');
    expect(code).toContain("const UserSubject");
  });

  it("includes relationships in the code", () => {
    const rels = [{ id: "r1", from: "Order", to: "User", cardinality: "1" as const, relationName: "customer" }];
    const code = generateSubjectCode(orderSubject, rels);
    expect(code).toContain("relations: {");
    expect(code).toContain('customer: { to: "User", cardinality: "1" }');
  });

  it("includes uuid field", () => {
    const code = generateSubjectCode(userSubject, []);
    expect(code).toContain("id: z.uuid()");
  });

  it("includes email field", () => {
    const code = generateSubjectCode(userSubject, []);
    expect(code).toContain("email: z.email()");
  });

  it("applies number modifiers", () => {
    const code = generateSubjectCode(userSubject, []);
    expect(code).toContain(".int()");
    expect(code).toContain(".min(18)");
  });

  it("generates enum with values", () => {
    const code = generateSubjectCode(userSubject, []);
    expect(code).toContain('z.enum(["admin", "member"])');
  });

  it("handles empty fields", () => {
    const empty: SubjectDef = { id: "x", name: "Empty", count: 1, fields: [] };
    const code = generateSubjectCode(empty, []);
    expect(code).toContain("z.object({})");
  });
});

// ─── generateSchemaCode ───────────────────────────────────────────────────────

describe("generateSchemaCode", () => {
  it("produces a const schema declaration", () => {
    const code = generateSchemaCode(userApiSchema);
    expect(code).toContain("const UserApiSchema");
    expect(code).toContain("z.object(");
  });

  it("includes all fields", () => {
    const code = generateSchemaCode(userApiSchema);
    expect(code).toContain("userId: z.uuid()");
    expect(code).toContain("email: z.email()");
  });
});

// ─── generateWorldCode ────────────────────────────────────────────────────────

describe("generateWorldCode", () => {
  it("includes createWorld with seed", () => {
    const code = generateWorldCode(minimalState);
    expect(code).toContain("createWorld({ seed: 42 })");
  });

  it("registers all subjects", () => {
    const code = generateWorldCode(minimalState);
    expect(code).toContain(".withSubject(UserSubject)");
    expect(code).toContain(".withSubject(OrderSubject)");
  });

  it("registers bound schema with matchers", () => {
    const code = generateWorldCode(minimalState);
    expect(code).toContain(".withSchema(UserApiSchema, UserSubject");
    expect(code).toContain("userId: (s) => s.id");
    expect(code).toContain("email: (s) => s.email");
  });

  it("populates subjects", () => {
    const code = generateWorldCode(minimalState);
    expect(code).toContain(".populate(UserSubject, 3)");
    expect(code).toContain(".populate(OrderSubject, 2)");
  });

  it("includes non-default optionalProbability", () => {
    const state = { ...minimalState, world: { ...minimalState.world, optionalProbability: 0 } };
    const code = generateWorldCode(state);
    expect(code).toContain("optionalProbability: 0");
  });

  it("omits default optionalProbability", () => {
    const code = generateWorldCode(minimalState);
    expect(code).not.toContain("optionalProbability");
  });
});

// ─── generateFullExport ───────────────────────────────────────────────────────

describe("generateFullExport", () => {
  it("includes imports", () => {
    const code = generateFullExport(minimalState);
    expect(code).toContain('import { z } from "zod"');
    expect(code).toContain('import { createWorld, defineSubjectType } from "zod4-mock"');
  });

  it("includes subject definitions", () => {
    const code = generateFullExport(minimalState);
    expect(code).toContain("const UserSubject = defineSubjectType");
    expect(code).toContain("const OrderSubject = defineSubjectType");
  });

  it("includes schema definitions", () => {
    const code = generateFullExport(minimalState);
    expect(code).toContain("const UserApiSchema = z.object(");
  });

  it("includes world setup", () => {
    const code = generateFullExport(minimalState);
    expect(code).toContain("const world = createWorld(");
  });
});

// ─── generateTokenizedCode ────────────────────────────────────────────────────

describe("generateTokenizedCode", () => {
  it("returns an array of CodeLines", () => {
    const lines = generateTokenizedCode(userSubject, []);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("each line has a lineNumber starting at 1", () => {
    const lines = generateTokenizedCode(userSubject, []);
    expect(lines[0].lineNumber).toBe(1);
    expect(lines[lines.length - 1].lineNumber).toBe(lines.length);
  });

  it("field lines have a fieldId", () => {
    const lines = generateTokenizedCode(userSubject, []);
    const fieldLines = lines.filter((l) => l.fieldId);
    expect(fieldLines.length).toBe(userSubject.fields.length);
  });

  it("each line has tokens", () => {
    const lines = generateTokenizedCode(userSubject, []);
    for (const line of lines) {
      expect(line.tokens.length).toBeGreaterThan(0);
    }
  });
});
