import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/world.js";

describe("Inline Schema Tests", () => {
  it("should apply generators to fields", () => {
    const schema = z.object({
      custom: z.string(),
      value: z.number(),
    });

    const world = createWorld({
      generators: {
        custom: () => "custom",
        value: () => 1,
      },
    });
    const result = world.generate(schema);

    expect(result).toMatchObject({
      custom: "custom",
      value: 1,
    });
  });

  it("should apply nested schema", () => {
    const User = z.object({
      name: z.string(),
      age: z.number(),
    });

    const world = createWorld({
      generators: {
        custom: () => "custom",
        value: () => 1,
      },
    }).withSchema(User, {
      matchers: {
        name: () => "My user",
        age: () => 42,
      },
    });

    const schema = z.object({
      custom: z.string(),
      value: z.number(),
      user: User,
    });

    const result = world.generate(schema);

    expect(result).toMatchObject({
      custom: "custom",
      value: 1,
      user: {
        name: "My user",
        age: 42,
      },
    });
  });
});
