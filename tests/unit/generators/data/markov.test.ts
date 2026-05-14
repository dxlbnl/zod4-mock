import { describe, it, expect } from "vitest";
import { sampleMarkov } from "../../../../src/generators/data/markov/sample.js";
import type { MarkovModel } from "@zod4-mock/locale-core";
import { enFirstNamesMaleModel, enFirstNamesFemaleModel, enLastNamesModel, enNounsModel } from "@zod4-mock/locale-en";
import { nlNounsModel } from "@zod4-mock/locale-nl";
import { dutchMaleModel } from "@zod4-mock/locale-names/groups/dutch";
import { createPrng } from "../../../../src/prng.js";

function prng(seed = 42) {
  return createPrng(seed);
}

describe("sampleMarkov", () => {
  describe("output format", () => {
    it("returns a non-empty string starting with a capital letter", () => {
      const result = sampleMarkov(prng(), enFirstNamesMaleModel);
      expect(result).toMatch(/^[A-Z]/);
      expect(result.length).toBeGreaterThan(0);
    });

    it("capitalizes only the first character", () => {
      for (let seed = 0; seed < 20; seed++) {
        const result = sampleMarkov(prng(seed), enNounsModel);
        expect(result.charAt(0)).toMatch(/[A-Z]/);
        expect(result.slice(1)).toMatch(/^[a-z]+$/);
      }
    });

    it("is deterministic: same prng + model → same output", () => {
      expect(sampleMarkov(prng(1), enFirstNamesMaleModel)).toBe(
        sampleMarkov(prng(1), enFirstNamesMaleModel),
      );
    });
  });

  describe("length constraints", () => {
    it("never returns a string shorter than minLen (100 seeds)", () => {
      for (let seed = 0; seed < 100; seed++) {
        const result = sampleMarkov(prng(seed), enNounsModel, 4, 12);
        expect(result.length).toBeGreaterThanOrEqual(4);
      }
    });

    it("never returns a string longer than maxLen (100 seeds)", () => {
      for (let seed = 0; seed < 100; seed++) {
        const result = sampleMarkov(prng(seed), enNounsModel, 3, 6);
        expect(result.length).toBeLessThanOrEqual(6);
      }
    });

    it("default minLen=3 is respected across all trained models", () => {
      const models = [enFirstNamesMaleModel, enFirstNamesFemaleModel, enLastNamesModel, enNounsModel];
      for (const model of models) {
        for (let seed = 0; seed < 50; seed++) {
          expect(sampleMarkov(prng(seed), model).length).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });

  describe("variety", () => {
    it("produces more than one unique output across 20 seeds", () => {
      const results = new Set(
        Array.from({ length: 20 }, (_, i) => sampleMarkov(prng(i), enNounsModel)),
      );
      expect(results.size).toBeGreaterThan(5);
    });

    it("en and nl noun models produce different words for the same seeds", () => {
      const en = Array.from({ length: 20 }, (_, i) => sampleMarkov(prng(i), enNounsModel));
      const nl = Array.from({ length: 20 }, (_, i) => sampleMarkov(prng(i), nlNounsModel));
      expect(en).not.toEqual(nl);
    });

    it("male and female first-name models produce different names for the same seeds", () => {
      const male = Array.from({ length: 20 }, (_, i) => sampleMarkov(prng(i), enFirstNamesMaleModel));
      const female = Array.from({ length: 20 }, (_, i) => sampleMarkov(prng(i), enFirstNamesFemaleModel));
      expect(male).not.toEqual(female);
    });

    it("en and nl male first-name models produce different names for the same seeds", () => {
      const en = Array.from({ length: 20 }, (_, i) => sampleMarkov(prng(i), enFirstNamesMaleModel));
      const nl = Array.from({ length: 20 }, (_, i) => sampleMarkov(prng(i), dutchMaleModel));
      expect(en).not.toEqual(nl);
    });
  });

  describe("edge cases", () => {
    it("returns fallback 'x' when the model table is empty", () => {
      const emptyModel: MarkovModel = {
        order: 2,
        prior: 0.01,
        chars: "ab$",
        table: {},
      };
      expect(sampleMarkov(prng(), emptyModel)).toBe("x");
    });

    it("handles order-1 models (single-char context)", () => {
      // Minimal valid model: always outputs 'a' then '$'
      const simpleModel: MarkovModel = {
        order: 1,
        prior: 0,
        chars: "a$",
        table: {
          "": [1.0, 1.0],  // always pick 'a' (CDF: 'a'=1.0, '$'=1.0 → 'a' wins at any r<1)
          "a": [0.0, 1.0], // always pick '$' after 'a'
        },
      };
      // With minLen=3 this will reset and try again — but 'a' then '$' always terminates at 1 char.
      // The model will loop until maxLen is hit, producing 'Aaa...'.
      // Just verify it terminates and returns something.
      const result = sampleMarkov(prng(), simpleModel, 1, 5);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});
