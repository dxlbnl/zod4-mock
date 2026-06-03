import { describe, it, expect } from "vitest";
import { generateWorld } from "./ecommerce";
import {
  userSchema,
  categorySchema,
  productSchema,
  variantSchema,
  reviewSchema,
  orderSchema,
} from "../schemas/ecommerce";

const world = generateWorld(42);

describe("generateWorld shape", () => {
  it("generates the right entity counts", () => {
    expect(world.users).toHaveLength(10);
    expect(world.categories).toHaveLength(5);
    expect(world.products).toHaveLength(20);
    expect(world.variants).toHaveLength(60);
    expect(world.reviews).toHaveLength(30);
    expect(world.orders).toHaveLength(5);
  });

  it("every entity passes its schema", () => {
    for (const u of world.users)
      expect(userSchema.safeParse(u).success).toBe(true);
    for (const c of world.categories)
      expect(categorySchema.safeParse(c).success).toBe(true);
    for (const p of world.products)
      expect(productSchema.safeParse(p).success).toBe(true);
    for (const v of world.variants)
      expect(variantSchema.safeParse(v).success).toBe(true);
    for (const r of world.reviews)
      expect(reviewSchema.safeParse(r).success).toBe(true);
    for (const o of world.orders)
      expect(orderSchema.safeParse(o).success).toBe(true);
  });
});

describe("generateWorld relations", () => {
  const userIds = new Set(world.users.map((u) => u.id));
  const categoryIds = new Set(world.categories.map((c) => c.id));
  const productIds = new Set(world.products.map((p) => p.id));
  const variantIds = new Set(world.variants.map((v) => v.id));

  it("product.categoryId → a real category", () => {
    for (const p of world.products) {
      expect(
        categoryIds.has(p.categoryId),
        `product ${p.id} has unknown categoryId ${p.categoryId}`,
      ).toBe(true);
    }
  });

  it("variant.productId → a real product", () => {
    for (const v of world.variants) {
      expect(
        productIds.has(v.productId),
        `variant ${v.id} has unknown productId ${v.productId}`,
      ).toBe(true);
    }
  });

  it("review.productId → a real product", () => {
    for (const r of world.reviews) {
      expect(
        productIds.has(r.productId),
        `review ${r.id} has unknown productId ${r.productId}`,
      ).toBe(true);
    }
  });

  it("review.userId → a real user", () => {
    for (const r of world.reviews) {
      expect(
        userIds.has(r.userId),
        `review ${r.id} has unknown userId ${r.userId}`,
      ).toBe(true);
    }
  });

  it("order.userId → a real user", () => {
    for (const o of world.orders) {
      expect(
        userIds.has(o.userId),
        `order ${o.id} has unknown userId ${o.userId}`,
      ).toBe(true);
    }
  });

  it("order item productId → a real product", () => {
    for (const o of world.orders) {
      for (const item of o.items) {
        expect(
          productIds.has(item.productId),
          `order ${o.id} item has unknown productId ${item.productId}`,
        ).toBe(true);
      }
    }
  });

  it("order item variantId → a real variant", () => {
    for (const o of world.orders) {
      for (const item of o.items) {
        expect(
          variantIds.has(item.variantId),
          `order ${o.id} item has unknown variantId ${item.variantId}`,
        ).toBe(true);
      }
    }
  });

  it("category.parentId → a real category or null", () => {
    for (const c of world.categories) {
      if (c.parentId !== null) {
        expect(
          categoryIds.has(c.parentId),
          `category ${c.id} has unknown parentId ${c.parentId}`,
        ).toBe(true);
      }
    }
  });

  it("order.total matches sum of items", () => {
    for (const o of world.orders) {
      const expected = o.items.reduce(
        (sum, item) => sum + item.qty * item.unitPrice,
        0,
      );
      expect(o.total).toBeCloseTo(expected, 5);
    }
  });
});

describe("generateWorld determinism", () => {
  it("same seed produces identical worlds", () => {
    const a = generateWorld(42);
    const b = generateWorld(42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different seeds produce different worlds", () => {
    const a = generateWorld(42);
    const b = generateWorld(99);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("unseeded world produces valid data", () => {
    const w = generateWorld();
    expect(w.users).toHaveLength(10);
    expect(w.products).toHaveLength(20);
  });
});
