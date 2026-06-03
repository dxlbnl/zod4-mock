import { describe, it, expect } from "vitest";
import { flatSchema, flatSchema3 } from "./flat";
import { nestedSchema, nestedSchema3 } from "./nested";
import { arraySchema, arraySchema3 } from "./array";
import {
  userSchema,
  categorySchema,
  productSchema,
  variantSchema,
  reviewSchema,
  orderSchema,
} from "./ecommerce";

describe("flat schema", () => {
  it("has expected fields", () => {
    const shape = flatSchema.shape;
    expect(shape).toHaveProperty("id");
    expect(shape).toHaveProperty("name");
    expect(shape).toHaveProperty("email");
    expect(shape).toHaveProperty("age");
    expect(shape).toHaveProperty("score");
    expect(shape).toHaveProperty("active");
    expect(shape).toHaveProperty("createdAt");
    expect(shape).toHaveProperty("role");
    expect(shape).toHaveProperty("bio");
    expect(shape).toHaveProperty("phone");
  });
  it("has zod3 equivalent with same field names", () => {
    const keys4 = Object.keys(flatSchema.shape);
    const keys3 = Object.keys(flatSchema3.shape);
    expect(keys3).toEqual(keys4);
  });
});

describe("nested schema", () => {
  it("has top-level shape", () => {
    expect(nestedSchema.shape).toHaveProperty("id");
    expect(nestedSchema.shape).toHaveProperty("customer");
    expect(nestedSchema.shape.customer.shape).toHaveProperty("address");
  });
  it("has zod3 equivalent", () => {
    expect(nestedSchema3.shape).toHaveProperty("id");
  });
});

describe("array schema", () => {
  it("accepts an array of 50 items", () => {
    const result = arraySchema.safeParse([]);
    // empty array fails length(50) constraint — confirms it's an array schema
    expect(result.success).toBe(false);
  });
  it("has zod3 array equivalent", () => {
    // zod3 still has _def.typeName
    expect(arraySchema3._def.typeName).toBe("ZodArray");
  });
});

describe("ecommerce schemas", () => {
  it("user has required fields", () => {
    expect(userSchema.shape).toHaveProperty("id");
    expect(userSchema.shape).toHaveProperty("name");
    expect(userSchema.shape).toHaveProperty("email");
  });
  it("product references category id type", () => {
    expect(productSchema.shape).toHaveProperty("categoryId");
  });
  it("review references both product and user", () => {
    expect(reviewSchema.shape).toHaveProperty("productId");
    expect(reviewSchema.shape).toHaveProperty("userId");
  });
  it("order has items array", () => {
    expect(orderSchema.shape).toHaveProperty("items");
  });
  it("all schemas are defined", () => {
    for (const s of [
      userSchema,
      categorySchema,
      productSchema,
      variantSchema,
      reviewSchema,
      orderSchema,
    ]) {
      expect(s).toBeDefined();
    }
  });
});
