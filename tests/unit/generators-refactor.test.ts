import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld, generators } from "../../src/index.js";

describe("Comprehensive Heuristic Constraints & Modifiers", () => {
  describe("String Heuristics (e.g. lastName, email, city)", () => {
    it("should respect .min()", () => {
      const Schema = z.object({ lastName: z.string().min(50) });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.lastName.length).toBeGreaterThanOrEqual(50);
    });

    it("should respect .max()", () => {
      const Schema = z.object({ firstName: z.string().max(2) });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.firstName.length).toBeLessThanOrEqual(2);
    });

    it("should respect .length()", () => {
      const Schema = z.object({ city: z.string().length(15) });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.city.length).toBe(15);
    });

    it("should respect .toLowerCase()", () => {
      const Schema = z.object({ country: z.string().toLowerCase() });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.country).toBe(result.country.toLowerCase());
    });

    it("should respect .toUpperCase()", () => {
      const Schema = z.object({ email: z.string().email().toUpperCase() });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.email).toBe(result.email.toUpperCase());
      expect(result.email).toContain("@");
    });

    it("should respect .trim()", () => {
      // We'll use 'name' which might have spaces in some generators
      const Schema = z.object({ name: z.string().trim() });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.name).toBe(result.name.trim());
    });

    it("should respect combinations (trim + toUpperCase + min)", () => {
      const Schema = z.object({
        lastName: z.string().trim().toUpperCase().min(30),
      });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.lastName).toBe(result.lastName.trim());
      expect(result.lastName).toBe(result.lastName.toUpperCase());
      expect(result.lastName.length).toBeGreaterThanOrEqual(30);
    });

    it("should respect .startsWith()", () => {
      const Schema = z.object({ lastName: z.string().startsWith("Mc") });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.lastName.startsWith("Mc")).toBe(true);
    });

    it("should respect .endsWith()", () => {
      const Schema = z.object({ email: z.string().email().endsWith(".edu") });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.email.endsWith(".edu")).toBe(true);
    });

    it("should respect .includes()", () => {
      const Schema = z.object({ city: z.string().includes("-city") });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.city.includes("-city")).toBe(true);
    });

    it("should respect .length()", () => {
      const Schema = z.object({ city: z.string().length(10) });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.city.length).toBe(10);
    });
  });

  describe("Number Heuristics (e.g. age, price, amount)", () => {
    it("should respect .min()", () => {
      const Schema = z.object({ age: z.number().min(150) });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.age).toBeGreaterThanOrEqual(150);
    });

    it("should respect .max()", () => {
      const Schema = z.object({ count: z.number().max(5) });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.count).toBeLessThanOrEqual(5);
    });

    it("should respect .int()", () => {
      const Schema = z.object({ price: z.number().int() });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(Number.isInteger(result.price)).toBe(true);
    });

    it("should respect .multipleOf()", () => {
      const Schema = z.object({ quantity: z.number().multipleOf(7) });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.quantity % 7).toBe(0);
    });

    it("should respect combinations (min + max + multipleOf)", () => {
      const Schema = z.object({
        age: z.number().min(21).max(25).multipleOf(2),
      });
      const result = createWorld({ seed: 1 }).generate(Schema);
      expect(result.age).toBeGreaterThanOrEqual(21);
      expect(result.age).toBeLessThanOrEqual(25);
      expect(result.age % 2).toBe(0);
      expect([22, 24]).toContain(result.age);
    });
  });

  describe("Data Centralization (Regressions)", () => {
    it("should have TECH_WORDS in generators.word", () => {
      expect(generators.word.TECH_WORDS).toBeDefined();
    });
    it("should have DOMAINS in generators.internet", () => {
      expect(generators.internet.DOMAINS).toBeDefined();
    });
  });
});
