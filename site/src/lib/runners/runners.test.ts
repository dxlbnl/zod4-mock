import { describe, it, expect } from "vitest";
import { runZod4Mock } from "./zod4mock";
import { runZodMock } from "./zodmock";
import { runFaker } from "./faker";
import { flatSchema, flatSchema3 } from "../schemas/flat";
import { nestedSchema, nestedSchema3 } from "../schemas/nested";
import { arraySchema } from "../schemas/array";

describe("zod4mock runner", () => {
  it("generates a flat record matching the schema", () => {
    const record = runZod4Mock.flat();
    const result = flatSchema.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("generates a nested record", () => {
    const record = runZod4Mock.nested();
    const result = nestedSchema.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("generates an array of 50 variants", () => {
    const record = runZod4Mock.array();
    const result = arraySchema.safeParse(record);
    expect(result.success).toBe(true);
    expect(Array.isArray(record)).toBe(true);
    expect((record as unknown[]).length).toBe(50);
  });

  it("generates a batch of N records", () => {
    const batch = runZod4Mock.batch("flat", 10);
    expect(batch).toHaveLength(10);
  });
});

describe("zodmock runner", () => {
  it("generates a flat record with the right shape", () => {
    const record = runZodMock.flat();
    const result = flatSchema3.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("generates a nested record", () => {
    const record = runZodMock.nested();
    const result = nestedSchema3.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("generates an array of 50 items", () => {
    const record = runZodMock.array();
    expect(Array.isArray(record)).toBe(true);
    expect((record as unknown[]).length).toBe(50);
  });
});

describe("faker runner", () => {
  it("generates a flat record with expected keys", () => {
    const record = runFaker.flat();
    const keys = Object.keys(flatSchema.shape);
    for (const key of keys) {
      expect(record).toHaveProperty(key);
    }
  });

  it("generates a nested record", () => {
    const record = runFaker.nested();
    expect(record).toHaveProperty("customer");
    expect((record as { customer: unknown }).customer).toHaveProperty("address");
  });

  it("generates an array of 50 items", () => {
    const record = runFaker.array();
    expect(Array.isArray(record)).toBe(true);
    expect((record as unknown[]).length).toBe(50);
  });
});
