import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/index.js";

describe("Overrides in Matchers", () => {
  it("should make overridden values available to subsequent field matchers via ctx.current", () => {
    const Schema = z.object({
      price: z.number(),
      quantity: z.number(),
      total: z.number(),
    });

    let capturedPrice: number | undefined;

    const world = createWorld({ seed: 123 }).withSchema(Schema, {
      matchers: {
        total: (ctx) => {
          capturedPrice = ctx.current.price;
          return (ctx.current.price ?? 0) * (ctx.current.quantity ?? 0);
        },
      },
    });

    const result = world.generate(Schema, {
      overrides: {
        price: 100,
        quantity: 2,
      },
    });

    // BEFORE FIX: capturedPrice will be a random number, and total will be random * 2
    // AFTER FIX: capturedPrice should be 100, and total should be 200
    expect(capturedPrice).toBe(100);
    expect(result.price).toBe(100);
    expect(result.quantity).toBe(2);
    expect(result.total).toBe(200);
  });

  it("should allow matchers to be overridden by options.overrides", () => {
    const Schema = z.object({
      value: z.number(),
    });

    const world = createWorld({ seed: 123 }).withSchema(Schema, {
      matchers: {
        value: () => 1,
      },
    });

    const result = world.generate(Schema, {
      overrides: {
        value: 99,
      },
    });

    // Override should win over matcher
    expect(result.value).toBe(99);
  });
});
