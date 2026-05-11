import { describe, it, expect } from "vitest";
import { FIELD_TYPES, getModifiers, getMenuItems, SELECTABLE_FIELD_TYPES } from "./field-types";

describe("field-types", () => {
  it("defines expected core types", () => {
    expect(FIELD_TYPES.string).toBeDefined();
    expect(FIELD_TYPES.number).toBeDefined();
    expect(FIELD_TYPES.boolean).toBeDefined();
    expect(FIELD_TYPES.object).toBeDefined();
  });

  it("every selectable type has .array() as a modifier", () => {
    for (const type of SELECTABLE_FIELD_TYPES) {
      const mods = getModifiers(type);
      expect(
        mods.some((m) => m.name === ".array()"),
        `${type} missing .array() modifier`,
      ).toBe(true);
    }
  });

  it("returns modifiers for a type", () => {
    const mods = getModifiers("string");
    expect(mods.length).toBeGreaterThan(0);
    expect(mods.some((m) => m.name === ".min")).toBe(true);
  });

  it("returns menu items for a type", () => {
    const items = getMenuItems("number");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty("name");
    expect(items[0]).toHaveProperty("desc");
    expect(items[0]).toHaveProperty("category");
  });

  it("selectable types list is non-empty", () => {
    expect(SELECTABLE_FIELD_TYPES.length).toBeGreaterThan(0);
    expect(SELECTABLE_FIELD_TYPES).toContain("string");
  });
});
