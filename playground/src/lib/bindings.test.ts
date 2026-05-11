import { describe, it, expect } from "vitest";
import { createPlaygroundState, makeField } from "./state.svelte";
import { buildWorld } from "./schema-builder";

describe("Schema Relations & Projections", () => {
  it("should honor derived mappings in buildWorld", () => {
    const store = createPlaygroundState();
    const state = store.state;

    // 1. Create a primary schema
    const userSchema = {
      id: "s1",
      name: "User",
      populateCount: 1,
      relations: [],
      fields: [
        makeField({ key: "id", type: "uuid" }),
        makeField({ key: "name", type: "string" }),
      ],
    };

    // 2. Create a derived API schema
    const apiSchema = {
      id: "s2",
      name: "UserApi",
      populateCount: 0,
      derivedFrom: "s1",
      relations: [],
      fields: [
        makeField({ key: "userId", type: "uuid", sourceMapping: "id" }),
        makeField({ key: "fullName", type: "string", sourceMapping: "name" }),
      ],
    };

    state.schemas = [userSchema, apiSchema];

    // 3. Build world
    const { world, schemaMap } = buildWorld(state);
    const zUserApi = schemaMap.get("s2");
    expect(zUserApi).toBeDefined();

    // 4. Generate data
    const data = world.generate(zUserApi!) as any;

    // 5. Verify data matches source schema in registry
    const users = world.registry.all(schemaMap.get("s1")!) as any[];
    expect(data.userId).toBe(users[0].id);
    expect(data.fullName).toBe(users[0].name);
  });

  it("should honor relation mappings for foreign keys", () => {
    const store = createPlaygroundState();
    const state = store.state;

    const userSchema = {
      id: "s1",
      name: "User",
      populateCount: 1,
      relations: [],
      fields: [makeField({ key: "id", type: "uuid" })],
    };

    const orderSchema = {
      id: "s2",
      name: "Order",
      populateCount: 1,
      relations: [{ name: "customer", targetSchemaId: "s1" }],
      fields: [
        makeField({ 
          key: "userId", 
          type: "uuid", 
          relationMapping: { relationName: "customer", targetFieldKey: "id" } 
        }),
      ],
    };

    state.schemas = [userSchema, orderSchema];

    const { world, schemaMap } = buildWorld(state);
    const orders = world.registry.all(schemaMap.get("s2")!) as any[];
    const users = world.registry.all(schemaMap.get("s1")!) as any[];

    expect(orders[0].userId).toBe(users[0].id);
  });
});
