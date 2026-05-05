import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import { firstName, prefix } from "../../../src/generators/data/person.js";
import { createPrng } from "../../../src/prng.js";

describe("Person Gender-Aware Generation", () => {
  const prng = createPrng(42);

  describe("Standalone Generators", () => {
    it("firstName picks male names for 'male' gender", () => {
      const name = firstName(prng, "male");
      // Check a few to be sure
      const names = Array.from({ length: 10 }, () => firstName(prng, "male"));
      names.forEach(n => {
        expect(["Jan", "Piet", "Klaas", "Hans", "Dirk", "Erik", "Tom", "Sven", "Luc", "Bas", "Thijs", "Bram", "Luuk", "Lars", "Stijn", "Gijs", "Sem", "Daan", "Finn", "Willem"]).toContain(n);
      });
    });

    it("firstName picks female names for 'female' gender", () => {
      const names = Array.from({ length: 10 }, () => firstName(prng, "female"));
      names.forEach(n => {
        expect(["Marie", "Anna", "Lisa", "Emma", "Sara", "Lena", "Nora", "Eva", "Julia", "Inge", "Lieke", "Noa", "Lotte", "Fleur", "Tess", "Mila", "Sanne", "Sophie", "Roos", "Isa"]).toContain(n);
      });
    });

    it("prefix matches gender", () => {
      expect(["Dhr.", "Dr.", "Prof.", "Ing."]).toContain(prefix(prng, "male"));
      expect(["Mevr.", "Dr.", "Prof.", "Ing."]).toContain(prefix(prng, "female"));
    });
  });

  describe("Cross-Field Inference (Object)", () => {
    it("infers gender from sibling 'gender' field", () => {
      const world = createWorld({ seed: 123 });
      const schema = z.object({
        gender: z.enum(["man", "vrouw"]),
        firstName: z.string(),
      });

      // Generate multiple times to ensure consistency
      for (let i = 0; i < 20; i++) {
        const result = world.generate(schema) as { gender: string; firstName: string };
        if (result.gender === "man") {
          expect(["Jan", "Piet", "Klaas", "Hans", "Dirk", "Erik", "Tom", "Sven", "Luc", "Bas", "Thijs", "Bram", "Luuk", "Lars", "Stijn", "Gijs", "Sem", "Daan", "Finn", "Willem"]).toContain(result.firstName);
        } else {
          expect(["Marie", "Anna", "Lisa", "Emma", "Sara", "Lena", "Nora", "Eva", "Julia", "Inge", "Lieke", "Noa", "Lotte", "Fleur", "Tess", "Mila", "Sanne", "Sophie", "Roos", "Isa"]).toContain(result.firstName);
        }
      }
    });

    it("infers gender from sibling 'geslacht' field (Dutch)", () => {
      const world = createWorld({ seed: 456 });
      const schema = z.object({
        geslacht: z.enum(["man", "vrouw"]),
        voornaam: z.string(),
      });

      const result = world.generate(schema) as { geslacht: string; voornaam: string };
      if (result.geslacht === "man") {
         expect(result.voornaam).toMatch(/^(Jan|Piet|Klaas|Hans|Dirk|Erik|Tom|Sven|Luc|Bas|Thijs|Bram|Luuk|Lars|Stijn|Gijs|Sem|Daan|Finn|Willem)$/);
      } else {
         expect(result.voornaam).toMatch(/^(Marie|Anna|Lisa|Emma|Sara|Lena|Nora|Eva|Julia|Inge|Lieke|Noa|Lotte|Fleur|Tess|Mila|Sanne|Sophie|Roos|Isa)$/);
      }
    });
  });
});
