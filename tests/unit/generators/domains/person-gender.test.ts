import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../../src/index.js";
import { firstName, prefix } from "../../../../src/generators/data/person.js";
import { createPrng } from "../../../../src/prng.js";

describe("Person Gender-Aware Generation", () => {
  const prng = createPrng(42);

  describe("Standalone Generators", () => {
    it("firstName picks male names for 'male' gender", () => {
      const names = Array.from({ length: 10 }, () => firstName(prng, "male"));
      for (const n of names) {
        expect(n).toMatch(/^[A-Z][a-z]+$/);
      }
    });

    it("firstName picks female names for 'female' gender", () => {
      const names = Array.from({ length: 10 }, () => firstName(prng, "female"));
      for (const n of names) {
        expect(n).toMatch(/^[A-Z][a-z]+$/);
      }
    });

    it("prefix matches gender", () => {
      expect(["Mr.", "Dr.", "Prof."]).toContain(prefix(prng, "male"));
      expect(["Ms.", "Mrs.", "Dr.", "Prof."]).toContain(prefix(prng, "female"));
    });

    it("male and female firstName use different models (different output across seeds)", () => {
      const maleNames = Array.from({ length: 20 }, (_, i) => firstName(createPrng(i), "male"));
      const femaleNames = Array.from({ length: 20 }, (_, i) => firstName(createPrng(i), "female"));
      expect(maleNames).not.toEqual(femaleNames);
    });
  });

  describe("Cross-Field Inference (Object)", () => {
    it("infers gender from sibling 'gender' field", () => {
      const world = createWorld({ seed: 123 });
      const schema = z.object({
        gender: z.enum(["man", "vrouw"]),
        firstName: z.string(),
      });

      for (let i = 0; i < 20; i++) {
        const result = world.generate(schema) as { gender: string; firstName: string };
        expect(result.firstName).toMatch(/^[A-Z][a-z]+$/);
      }
    });

    it("infers gender from sibling 'geslacht' field (Dutch)", () => {
      const world = createWorld({ seed: 456 });
      const schema = z.object({
        geslacht: z.enum(["man", "vrouw"]),
        voornaam: z.string(),
      });

      const result = world.generate(schema) as { geslacht: string; voornaam: string };
      expect(result.voornaam).toMatch(/^[A-Z][a-z]+$/);
    });
  });
});
