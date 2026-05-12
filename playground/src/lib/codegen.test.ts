import { describe, it, expect } from "vitest";
import {
  generateSchemaCode,
  generateWorldCode,
  generateFullExport,
  generateTokenizedCode,
  generateTokenizedFullExport,
} from "./codegen";
import type { SchemaDef, PlaygroundState } from "./state.svelte";
import { makeField } from "./state.svelte";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const userSchema: SchemaDef = {
  id: "s1",
  name: "User",
  populateCount: 3,
  relations: [],
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
  ],
};

const orderSchema: SchemaDef = {
  id: "s2",
  name: "Order",
  populateCount: 2,
  relations: [{ name: "customer", targetSchemaId: "s1" }],
  fields: [
    { ...makeField(), id: "f5", key: "id", type: "uuid" },
    {
      ...makeField(),
      id: "f6",
      key: "userId",
      type: "uuid",
      relationMapping: { relationName: "customer", targetFieldKey: "id" },
    },
  ],
};

const userApiSchema: SchemaDef = {
  id: "s3",
  name: "UserApi",
  populateCount: 0,
  derivedFrom: "s1",
  relations: [],
  fields: [{ ...makeField(), id: "sf1", key: "userId", type: "uuid", sourceMapping: "id" }],
};

const minimalState: PlaygroundState = {
  world: {
    seed: 42,
    optionalProbability: 0.2,
    defaultArrayLengthMin: 1,
    defaultArrayLengthMax: 5,
    zodVersion: "4.4.3",
  },
  schemas: [userSchema, orderSchema, userApiSchema],
  activeSchemaId: "s1",
  ui: { exportOpen: false, outputTab: "code", activeMobileTab: "editor" },
  z: null,
  availableZodVersions: ["4.4.3"],
  isZodLoading: false,
};

// ─── generateSchemaCode ───────────────────────────────────────────────────────

describe("generateSchemaCode", () => {
  it("produces a const schema declaration", () => {
    const code = generateSchemaCode(userSchema);
    expect(code).toContain("const UserSchema");
    expect(code).toContain("z.object(");
  });

  it("includes fields and modifiers", () => {
    const code = generateSchemaCode(userSchema);
    expect(code).toContain("id: z.uuid()");
    expect(code).toContain("email: z.email()");
    expect(code).toContain(".int().min(18)");
  });
});

// ─── generateWorldCode ────────────────────────────────────────────────────────

describe("generateWorldCode", () => {
  it("includes createWorld with seed", () => {
    const code = generateWorldCode(minimalState);
    expect(code).toContain("createWorld({ seed: 42 })");
  });

  it("registers schemas with relations and matchers", () => {
    const code = generateWorldCode(minimalState);
    expect(code).toContain(".withSchema(UserSchema)");
    expect(code).toContain(".withSchema(OrderSchema, {");
    expect(code).toContain("relations: {");
    expect(code).toContain("customer: UserSchema");
    expect(code).toContain('userId: (ctx) => ctx.related("customer").id');
  });

  it("registers derived schemas", () => {
    const code = generateWorldCode(minimalState);
    expect(code).toContain(".withSchema(UserApiSchema, {");
    expect(code).toContain("from: UserSchema");
    expect(code).toContain("userId: (ctx) => ctx.source.id");
  });

  it("populates registry", () => {
    const code = generateWorldCode(minimalState);
    expect(code).toContain(".populate(UserSchema, 3)");
    expect(code).toContain(".populate(OrderSchema, 2)");
  });
});

// ─── generateFullExport ───────────────────────────────────────────────────────

describe("generateFullExport", () => {
  it("includes imports and full setup", () => {
    const code = generateFullExport(minimalState);
    expect(code).toContain('import { z } from "zod"');
    expect(code).toContain('import { createWorld } from "zod4-mock"');
    expect(code).toContain("const UserSchema = z.object");
    expect(code).toContain("const world = createWorld");
  });
});

// ─── generateTokenizedCode ────────────────────────────────────────────────────

describe("generateTokenizedCode", () => {
  it("returns an array of CodeLines for editor highlighting", () => {
    const lines = generateTokenizedCode(userSchema);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].lineNumber).toBe(1);
  });
});
// ─── generateTokenizedFullExport ──────────────────────────────────────────────

describe("generateTokenizedFullExport", () => {
  it("returns semantic tokens for world setup", () => {
    const lines = generateTokenizedFullExport(minimalState);

    // Find world setup line (not the import line)
    const createWorldLine = lines.find(
      (l) => l.tokens.some((t) => t.text === "world") && l.tokens.some((t) => t.text === "createWorld"),
    );
    expect(createWorldLine).toBeDefined();

    const seedToken = createWorldLine!.tokens.find((t) => t.text === "seed");
    expect(seedToken?.kind).toBe("property");

    const numToken = createWorldLine!.tokens.find((t) => t.text === "42");
    expect(numToken?.kind).toBe("number");

    // Find withSchema line
    const withSchemaLine = lines.find((l) => l.tokens.some((t) => t.text === "withSchema"));
    expect(withSchemaLine).toBeDefined();
    expect(withSchemaLine!.tokens.find((t) => t.text === "withSchema")?.kind).toBe("fn");
    expect(withSchemaLine!.tokens.find((t) => t.text === "UserSchema")?.kind).toBe("type");
  });
});

// ─── Folding & Depth ─────────────────────────────────────────────────────────

describe("TokenEmitter Folding", () => {
  it("calculates depth correctly for nested blocks", () => {
    const nestedSchema: SchemaDef = {
      id: "sn",
      name: "Nested",
      populateCount: 0,
      derivedFrom: null,
      relations: [],
      fields: [
        {
          ...makeField(),
          key: "obj",
          type: "object",
          children: [
            { ...makeField(), key: "inner", type: "string" }
          ]
        }
      ]
    };
    
    const lines = generateTokenizedCode(nestedSchema);
    
    // Find the line that starts the object block
    const objLine = lines.find(l => l.tokens.some(t => t.text === "object") && l.isFoldable);
    expect(objLine).toBeDefined();
    expect(objLine!.isFoldable).toBe(true);
    
    // Find the inner field line
    const innerLine = lines.find(l => l.tokens.some(t => t.text === "inner"));
    expect(innerLine).toBeDefined();
    expect(innerLine!.depth).toBeGreaterThan(objLine!.depth);
    
    // Find the closing line
    const closingLine = lines.find(l => l.tokens.some(t => t.text.startsWith("}")));
    expect(closingLine).toBeDefined();
    expect(closingLine!.depth).toBe(objLine!.depth);
  });
});
