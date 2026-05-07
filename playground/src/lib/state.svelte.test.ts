import { describe, it, expect } from "vitest";
import { createPlaygroundState } from "./state.svelte";

describe("state.svelte", () => {
  it("initializes with default state", () => {
    const store = createPlaygroundState();
    expect(store.state.subjects.length).toBeGreaterThan(0);
    expect(store.activeSubject).toBeDefined();
  });

  it("can add a subject", () => {
    const store = createPlaygroundState();
    const initialCount = store.state.subjects.length;
    store.addSubject("TestSubject");
    expect(store.state.subjects.length).toBe(initialCount + 1);
    expect(store.activeSubject?.name).toBe("TestSubject");
  });

  it("can add and remove a field", () => {
    const store = createPlaygroundState();
    const subj = store.activeSubject!;
    const initialFieldCount = subj.fields.length;

    store.addField("subject", subj.id);
    expect(subj.fields.length).toBe(initialFieldCount + 1);

    const newFieldId = subj.fields[subj.fields.length - 1].id;
    store.removeField("subject", subj.id, newFieldId);
    expect(subj.fields.length).toBe(initialFieldCount);
  });

  it("can update a field", () => {
    const store = createPlaygroundState();
    const subj = store.activeSubject!;
    const field = subj.fields[0];

    store.updateField("subject", subj.id, field.id, { key: "updatedKey", type: "number" });
    expect(field.key).toBe("updatedKey");
    expect(field.type).toBe("number");
  });

  it("can add and remove a modifier", () => {
    const store = createPlaygroundState();
    const subj = store.activeSubject!;
    const field = subj.fields[0];

    store.addModifier("subject", subj.id, field.id, { name: ".min", value: 5 });
    expect(field.modifiers.length).toBe(1);
    expect(field.modifiers[0].name).toBe(".min");

    store.removeModifier("subject", subj.id, field.id, 0);
    expect(field.modifiers.length).toBe(0);
  });
});
