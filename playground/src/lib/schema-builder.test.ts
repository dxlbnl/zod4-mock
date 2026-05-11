import { describe, it, expect } from "vitest";
import { z } from "zod";
import { buildZodField, buildZodSchema, buildWorld } from "./schema-builder";
import { makeField } from "./state.svelte";
import type { FieldDef, PlaygroundState } from "./state.svelte";

describe("schema-builder", () => {
  describe("buildZodField", () => {
    it("builds a basic string field", () => {
      const field = makeField({ key: "name", type: "string" });
      const schema = buildZodField(z, field);
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
      const schema = buildZodField(z, field) as z.ZodString;
      expect(schema.minLength).toBe(5);
      expect(schema.maxLength).toBe(10);
    });
  });

  describe("buildZodSchema", () => {
    it("builds a full schema object", () => {
      const fields: FieldDef[] = [
        makeField({ key: "id", type: "uuid" }),
        makeField({ key: "email", type: "email" }),
      ];
      const schema = buildZodSchema(z, fields);
      expect(schema).toBeInstanceOf(z.ZodObject);
      expect(schema.shape.id).toBeDefined();
    });
  });

  describe("buildWorld", () => {
    it("builds a world from unified schema state", () => {
      const state: PlaygroundState = {
        world: {
          seed: 123,
          optionalProbability: 0.1,
          defaultArrayLengthMin: 2,
          defaultArrayLengthMax: 4,
          zodVersion: "4.4.3",
        },
        schemas: [
          {
            id: "s1",
            name: "User",
            populateCount: 5,
            relations: [],
            fields: [makeField({ key: "id", type: "uuid" })],
          },
        ],
        activeSchemaId: "s1",
        ui: { exportOpen: false, outputTab: "code", activeMobileTab: "editor" },
        z: z,
        availableZodVersions: ["4.4.3"],
        isZodLoading: false,
      };

      const { world, schemaMap } = buildWorld(state);
      expect(world).toBeDefined();
      expect(schemaMap.has("s1")).toBe(true);
      
      // Verify registry population
      const users = world.registry.all(schemaMap.get("s1")!);
      expect(users.length).toBe(5);
    });
  });
});
