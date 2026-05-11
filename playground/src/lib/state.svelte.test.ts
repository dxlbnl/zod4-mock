import { describe, it, expect } from "vitest";
import { createPlaygroundState } from "./state.svelte";

describe("state.svelte", () => {
  it("initializes with default schemas", () => {
    const store = createPlaygroundState();
    expect(store.state.schemas.length).toBeGreaterThan(0);
    expect(store.activeSchema).toBeDefined();
  });

  it("can add a schema", () => {
    const store = createPlaygroundState();
    const initialCount = store.state.schemas.length;
    store.addSchema("TestSchema");
    expect(store.state.schemas.length).toBe(initialCount + 1);
    expect(store.activeSchema?.name).toBe("TestSchema");
  });

  it("can add and remove a field", () => {
    const store = createPlaygroundState();
    const schema = store.activeSchema!;
    const initialFieldCount = schema.fields.length;

    store.addField(schema.id);
    expect(schema.fields.length).toBe(initialFieldCount + 1);

    const newFieldId = schema.fields[schema.fields.length - 1].id;
    store.removeField(schema.id, newFieldId);
    expect(schema.fields.length).toBe(initialFieldCount);
  });

  it("can update a field", () => {
    const store = createPlaygroundState();
    const schema = store.activeSchema!;
    const field = schema.fields[0];

    store.updateField(schema.id, field.id, { key: "updatedKey", type: "number" });
    expect(field.key).toBe("updatedKey");
    expect(field.type).toBe("number");
  });

  it("can add and remove a modifier", () => {
    const store = createPlaygroundState();
    const schema = store.activeSchema!;
    const field = schema.fields[0];

    store.addModifier(schema.id, field.id, { name: ".min", value: 5 });
    expect(field.modifiers.length).toBe(1);
    expect(field.modifiers[0].name).toBe(".min");

    store.removeModifier(schema.id, field.id, 0);
    expect(field.modifiers.length).toBe(0);
  });

  it("can rename a schema", () => {
    const store = createPlaygroundState();
    const user = store.state.schemas.find((s) => s.name === "User")!;
    store.renameSchema(user.id, "Account");
    expect(user.name).toBe("Account");
  });
});
