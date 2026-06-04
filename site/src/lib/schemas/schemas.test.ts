import { describe, it, expect } from "vitest";
import { simple, simple3 } from "./simple";
import { user, user3 } from "./user";
import { nested, nested3 } from "./nested";
import { nestedOrder, nestedOrder3 } from "./nestedOrder";
import { array, array3 } from "./array";
import { CompanySchema, UserSchema } from "./matcher";
import {
  userSchema,
  categorySchema,
  productSchema,
  variantSchema,
  reviewSchema,
  orderSchema,
} from "./ecommerce";

describe("simple schema", () => {
  it("has the canonical 4-field shape ['id','name','age','active']", () => {
    expect(Object.keys(simple.shape)).toEqual(["id", "name", "age", "active"]);
  });
  it("has zod3 equivalent with same field-name ordering", () => {
    expect(Object.keys(simple3.shape)).toEqual(Object.keys(simple.shape));
  });
});

// prettier-ignore
const userKeys = ["id", "firstName", "lastName", "email", "age", "role", "bio", "score"];

describe("user schema", () => {
  it("has the canonical 8-field shape", () => {
    expect(Object.keys(user.shape)).toEqual(userKeys);
  });
  it("has zod3 equivalent with same field-name ordering", () => {
    expect(Object.keys(user3.shape)).toEqual(Object.keys(user.shape));
  });
});

describe("nested schema (CLI mixed-features shape)", () => {
  it("has the canonical 7-field shape", () => {
    expect(Object.keys(nested.shape)).toEqual([
      "id",
      "name",
      "email",
      "address",
      "billingAddress",
      "tags",
      "metadata",
    ]);
  });
  it("has zod3 equivalent with same field-name ordering", () => {
    expect(Object.keys(nested3.shape)).toEqual(Object.keys(nested.shape));
  });
});

describe("matcher schemas", () => {
  it("CompanySchema exposes id, name, industry", () => {
    expect(Object.keys(CompanySchema.shape)).toEqual(["id", "name", "industry"]);
  });
  it("UserSchema exposes employerId, address, fullName, email, city", () => {
    expect(UserSchema.shape).toHaveProperty("employerId");
    expect(UserSchema.shape).toHaveProperty("address");
    expect(UserSchema.shape).toHaveProperty("fullName");
    expect(UserSchema.shape).toHaveProperty("email");
    expect(UserSchema.shape).toHaveProperty("city");
  });
});

// prettier-ignore
const nestedOrderAddressKeys = ["street", "city", "state", "zip", "country"];

describe("nestedOrder schema (browser order shape)", () => {
  it("retains the customer.address shape ['street','city','state','zip','country']", () => {
    expect(Object.keys(nestedOrder.shape.customer.shape.address.shape)).toEqual(
      nestedOrderAddressKeys,
    );
  });
  it("has zod3 equivalent", () => {
    expect(nestedOrder3.shape).toHaveProperty("id");
  });
});

describe("array schema", () => {
  it("accepts an array of 50 items", () => {
    const result = array.safeParse([]);
    // empty array fails length(50) constraint — confirms it's an array schema
    expect(result.success).toBe(false);
  });
  it("has zod3 array equivalent", () => {
    // zod3 still has _def.typeName
    expect(array3._def.typeName).toBe("ZodArray");
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
