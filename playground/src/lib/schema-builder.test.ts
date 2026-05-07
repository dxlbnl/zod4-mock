import { describe, it, expect } from "vitest";
import { z } from "zod";
import { buildZodField, buildZodSchema, buildWorld } from "./schema-builder";
import { makeField } from "./state.svelte";
import type { FieldDef, PlaygroundState } from "./state.svelte";

describe("schema-builder", () => {
  describe("buildZodField", () => {
    it("builds a basic string field", () => {
      const field = makeField({ key: "name", type: "string" });
      const schema = buildZodField(field);
      expect(schema).toBeInstanceOf(z.ZodString);
    });

    it("applies string modifiers", () => {
      const field = makeField({
        key: "name",
        type: "string",
        modifiers: [
          { name: ".min", value: 5 },
          { name: ".max", value: 10 },
        ],
      });
      const schema = buildZodField(field) as z.ZodString;
      expect(schema.minLength).toBe(5);
      expect(schema.maxLength).toBe(10);
    });

    it("builds a number field with integer modifier", () => {
      const field = makeField({
        key: "age",
        type: "number",
        modifiers: [{ name: ".int()" }],
      });
      const schema = buildZodField(field);
      expect(schema).toBeInstanceOf(z.ZodNumber);
      // ZodNumber doesn't easily expose "isInt", but we can check if it parses floats
      expect(schema.safeParse(1.5).success).toBe(false);
    });

    it("builds an enum field", () => {
      const field = makeField({
        key: "role",
        type: "enum",
        enumValues: ["admin", "user"],
      });
      const schema = buildZodField(field);
      expect(schema).toBeInstanceOf(z.ZodEnum);
      expect(schema.safeParse("admin").success).toBe(true);
      expect(schema.safeParse("guest").success).toBe(false);
    });

    it("builds a nested object field", () => {
      const field = makeField({
        key: "address",
        type: "object",
        children: [
          makeField({ key: "city", type: "string" }),
          makeField({ key: "zip", type: "number" }),
        ],
      });
      const schema = buildZodField(field);
      expect(schema).toBeInstanceOf(z.ZodObject);
      const shape = (schema as z.ZodObject<any>).shape;
      expect(shape.city).toBeInstanceOf(z.ZodString);
      expect(shape.zip).toBeInstanceOf(z.ZodNumber);
    });
  });

  describe("buildZodSchema", () => {
    it("builds a full schema object", () => {
      const fields: FieldDef[] = [
        makeField({ key: "id", type: "uuid" }),
        makeField({ key: "email", type: "email" }),
      ];
      const schema = buildZodSchema(fields);
      expect(schema).toBeInstanceOf(z.ZodObject);
      // Verify they are at least string-compatible
      expect(schema.shape.id.safeParse("not-a-uuid").success).toBe(false);
      expect(schema.shape.email.safeParse("not-an-email").success).toBe(false);
    });
  });

  describe("buildWorld", () => {
    it("builds a world from state", () => {
      const state: PlaygroundState = {
        world: {
          seed: 123,
          optionalProbability: 0.1,
          defaultArrayLengthMin: 2,
          defaultArrayLengthMax: 4,
        },
        subjects: [
          {
            id: "s1",
            name: "User",
            count: 5,
            fields: [makeField({ key: "id", type: "uuid" })],
          },
        ],
        activeSubjectId: "s1",
        schemas: [],
        activeSchemaId: null,
        activeEntityType: "subject",
        relationships: [],
        bindings: [],
        ui: { exportOpen: false, outputTab: "code", sectionStates: {} },
      };

      const { world, subjectMap } = buildWorld(state);
      expect(world).toBeDefined();
      expect(subjectMap.has("s1")).toBe(true);
    });
  });
});
