// playground.ts — edit freely, run with: pnpm play  (watch: pnpm play:watch)
import { describe, it } from "vitest";
import { z } from "zod";
import { generate, createWorld } from "./src/index.js";

const print = (label: string, data: unknown) => {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
};

const nestedThing = z.object({
  age: z.number(),
  name: z.string(),
  number: z.number(),
});

const schema = z.object({
  name: z.string(),
  nested: nestedThing.array(),
});

describe("failing overrides", () => {
  const world = createWorld().withSchema(nestedThing).withSchema(schema);

  it("generates an object", () => {
    print("object", world.generate(schema));
  });
  it("uses overrides", () => {
    print(
      "overrides",
      world.generate(schema, {
        defaultArrayLength: [4, 4],
        overrides: {
          nested: Array.from({ length: 4 }, (_, number) => ({ number })),
        },
        store: false,
      }),
    );
  });
});
