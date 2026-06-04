import { describe, it, expect } from "vitest";
import { runZod4Mock } from "./zod4mock";
import { runZodMock } from "./zodmock";
import { runFaker } from "./faker";
import { simple, simple3 } from "../schemas/simple";
import { nestedOrder, nestedOrder3 } from "../schemas/nestedOrder";
import { array } from "../schemas/array";

describe("zod4mock runner", () => {
  it("generates a simple record matching the schema", () => {
    const record = runZod4Mock.simple();
    const result = simple.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("generates a nested order record", () => {
    const record = runZod4Mock.nestedOrder();
    const result = nestedOrder.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("generates an array of 50 variants", () => {
    const record = runZod4Mock.array();
    const result = array.safeParse(record);
    expect(result.success).toBe(true);
    expect(Array.isArray(record)).toBe(true);
    expect((record as unknown[]).length).toBe(50);
  });

  it("generates a batch of N records", () => {
    const batch = runZod4Mock.batch("simple", 10);
    expect(batch).toHaveLength(10);
  });
});

describe("zodmock runner", () => {
  it("generates a simple record with the right shape", () => {
    const record = runZodMock.simple();
    const result = simple3.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("generates a nested order record", () => {
    const record = runZodMock.nestedOrder();
    const result = nestedOrder3.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("generates an array of 50 items", () => {
    const record = runZodMock.array();
    expect(Array.isArray(record)).toBe(true);
    expect((record as unknown[]).length).toBe(50);
  });
});

describe("faker runner", () => {
  it("generates a simple record with expected keys", () => {
    const record = runFaker.simple();
    const keys = Object.keys(simple.shape);
    for (const key of keys) {
      expect(record).toHaveProperty(key);
    }
  });

  it("generates a nested order record", () => {
    const record = runFaker.nestedOrder();
    expect(record).toHaveProperty("customer");
    expect((record as { customer: unknown }).customer).toHaveProperty("address");
  });

  it("generates an array of 50 items", () => {
    const record = runFaker.array();
    expect(Array.isArray(record)).toBe(true);
    expect((record as unknown[]).length).toBe(50);
  });
});
