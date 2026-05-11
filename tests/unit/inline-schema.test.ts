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
                custom: ()=>"custom",
                value: ()=>1,
            }
        })
        const result = world.generate(schema);
        
        expect(result).toMatchObject({
            name: "custom",
            age: 1,
        });
    });
});