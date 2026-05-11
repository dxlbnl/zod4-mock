import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/index.js";

describe("Nested Matcher Application", () => {
  it("applies matchers defined on a sub-schema when used as a nested field", () => {
    const AddressSchema = z.object({
      street: z.string(),
      city: z.string(),
      zip: z.number(),
    });

    const UserSchema = z.object({
      name: z.string(),
      address: AddressSchema,
    });

    const world = createWorld({ seed: 123 })
      .withSchema(AddressSchema, {
        matchers: {
          street: () => "MATCHED STREET",
          city: () => "MATCHED CITY",
          zip: () => 99999,
        },
      })
      .withSchema(UserSchema);

    const result = world.generate(UserSchema);

    expect(result.address.street).toBe("MATCHED STREET");
    expect(result.address.city).toBe("MATCHED CITY");
    expect(result.address.zip).toBe(99999);
  });

  it("applies matchers to nested objects within arrays", () => {
    const ItemSchema = z.object({
      id: z.string(),
      val: z.number(),
    });

    const ContainerSchema = z.object({
      items: z.array(ItemSchema),
    });

    const world = createWorld({ seed: 456 })
      .withSchema(ItemSchema, {
        matchers: {
          val: () => 12345,
        },
      })
      .withSchema(ContainerSchema);

    const result = world.generate(ContainerSchema);

    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.val).toBe(12345);
    }
  });
});
