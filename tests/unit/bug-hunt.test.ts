import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generate, createWorld } from "../../src/index.js";

describe("bug-hunt — Consolidated Library Failures", () => {
  // 1. Template Literal Bugs
  describe("z.templateLiteral()", () => {
    it("fails to generate a valid template literal (type mismatch & wrong parts field)", () => {
      const schema = z.templateLiteral([z.string(), z.literal(" world")]);
      const result = generate(schema);

      // Expected to end in " world", but usually returns a random 3-10 char string or ""
      expect(schema.safeParse(result).success).toBe(true);
    });
  });

  // 2. String Constraint Bugs
  describe("String constraints with formats", () => {
    it("ignores min length when startsWith is used", () => {
      const schema = z.string().min(50).startsWith("abc");
      const result = generate(schema);

      expect(result.length).toBeGreaterThanOrEqual(50);
      expect(schema.safeParse(result).success).toBe(true);
    });

    it("ignores max length when includes is used", () => {
      const schema = z.string().max(15).includes("hello-world");
      const result = generate(schema);

      expect(result.length).toBeLessThanOrEqual(15);
      expect(schema.safeParse(result).success).toBe(true);
    });
  });

  // 3. Set Size Bugs
  describe("z.set()", () => {
    it("fails to respect min_size when duplicate values are generated", () => {
      const schema = z.set(z.string()).min(3);
      const result = generate(schema);

      expect(result.size).toBeGreaterThanOrEqual(3);
      expect(schema.safeParse(result).success).toBe(true);
    });
  });

  // 4. Default Value Variety Bug
  describe("z.default()", () => {
    it("always returns the default value instead of generating variety (at root level)", () => {
      const schema = z.string().default("fixed");
      const world = createWorld({ seed: 42 });

      const results = new Set(Array.from({ length: 20 }, () => world.generate(schema)));

      // If the library always returns the default, size will be 1.
      // A good mock library should generate variety but satisfy the schema.
      expect(results.size).toBeGreaterThan(1);
    });
  });

  // 5. Record Key Bug
  describe("z.record()", () => {
    it("mangles non-string keys into '[object Object]'", () => {
      const keySchema = z.string().min(5);
      const schema = z.record(keySchema, z.number());
      const result = generate(schema);

      const keys = Object.keys(result);
      expect(keys.some((k) => k === "[object Object]")).toBe(false);
      expect(schema.safeParse(result).success).toBe(true);
    });
  });

  // 6. Intersection Bug
  describe("z.intersection()", () => {
    it("fails to merge primitive intersections (returns only left side)", () => {
      // Intersection of two literals that are the same should work
      const schema = z.intersection(z.literal("a"), z.literal("a"));
      const result = generate(schema);
      expect(result).toBe("a");

      // More complex: intersection of two objects where properties overlap but are compatible
      const s1 = z.object({ person: z.object({ name: z.string() }) });
      const s2 = z.object({ person: z.object({ age: z.number() }) });
      const intersection = z.intersection(s1, s2);
      const res = generate(intersection) as any;

      // Current implementation does shallow merge: { ...left, ...right }
      // So person.name will be missing because s2.person overwrites s1.person
      expect(res.person.name).toBeDefined();
      expect(res.person.age).toBeDefined();
    });
  });

  // 7. Pipeline Bug
  describe("z.pipe()", () => {
    it("fails when the output side has stricter constraints than the input side", () => {
      const schema = z.string().max(50).pipe(z.string().min(40));
      const result = generate(schema);

      expect(schema.safeParse(result).success).toBe(true);
    });
  });

  // 8. Effects Bug (preprocess, refine, transform)
  describe("z.effects()", () => {
    it("ignores preprocessors and returns raw generated data that might fail validation", () => {
      // Preprocessor that turns everything into a valid number string
      const schema = z.preprocess(() => "123", z.string().regex(/^\d+$/));
      const result = generate(schema);

      // If preprocessor is ignored, it generates a random string which likely fails the regex
      expect(schema.safeParse(result).success).toBe(true);
    });

    it("ignores transforms", () => {
      const schema = z.string().transform((v) => v.length);
      const result = generate(schema);

      // Result should be a number, but will be a string
      expect(typeof result).toBe("number");
    });
  });

  // 9. BigInt Variety Bug
  describe("z.bigint()", () => {
    it("caps variety to a hardcoded range of 1,000,000", () => {
      const min = 0n;
      const max = 10_000_000_000n;
      const schema = z.bigint().min(min).max(max);
      const world = createWorld({ seed: 42 });

      const results = Array.from({ length: 100 }, () => world.generate(schema));
      const maxVal = results.reduce((a, b) => (a > b ? a : b), 0n);

      // If capped at 1,000,000, no value will ever exceed 1,000,000.
      expect(maxVal).toBeGreaterThan(1_000_000n);
    });
  });
});
