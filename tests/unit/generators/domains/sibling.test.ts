import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../../src/index.js";

describe("Sibling-aware internet generators", () => {
  describe("username", () => {
    it("incorporates firstName sibling", () => {
      const S = z.object({ firstName: z.string(), lastName: z.string(), username: z.string() });
      const result = createWorld({ seed: 1 }).generate(S);
      const f = result.firstName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
      const l = result.lastName.split(" ").at(-1)!.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
      expect(result.username.toLowerCase()).toMatch(new RegExp(f.length >= 2 ? f : l));
    });

    it("uses nickname sibling when present (takes priority over firstName)", () => {
      const S = z.object({ firstName: z.string(), nickname: z.literal("jankie"), username: z.string() });
      const result = createWorld({ seed: 1 }).generate(S);
      expect(result.username).toMatch(/^jankie(\d{2})?$/);
    });

    it("falls back to random when no name siblings", () => {
      const S = z.object({ username: z.string() });
      const u = createWorld({ seed: 1 }).generate(S).username;
      expect(u.length).toBeGreaterThan(0);
    });
  });

  describe("email", () => {
    it("uses firstName + lastName when available", () => {
      const S = z.object({ firstName: z.string(), lastName: z.string(), email: z.string() });
      const result = createWorld({ seed: 1 }).generate(S);
      const f = result.firstName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
      expect(result.email).toContain(f);
      expect(result.email).toContain("@");
    });

    it("uses nickname when present (takes priority over firstName)", () => {
      const S = z.object({ firstName: z.string(), nickname: z.literal("speedy"), email: z.string() });
      const result = createWorld({ seed: 1 }).generate(S);
      expect(result.email).toMatch(/^speedy@/);
    });

    it("uses company sibling when no person name is present", () => {
      const S = z.object({ company: z.literal("Acme Corp"), email: z.string() });
      const result = createWorld({ seed: 1 }).generate(S);
      expect(result.email).toMatch(/^(info|contact|hello|support)@/);
    });

    it("falls back to random when no siblings", () => {
      const S = z.object({ email: z.string() });
      expect(createWorld({ seed: 1 }).generate(S).email).toContain("@");
    });

    it("person name takes priority over company when both present", () => {
      const S = z.object({
        firstName: z.literal("lisa"),
        company: z.literal("Acme"),
        email: z.string(),
      });
      const result = createWorld({ seed: 1 }).generate(S);
      expect(result.email).toMatch(/^lisa@/);
    });
  });

  describe("displayName", () => {
    it("returns firstName + lastName when both available", () => {
      const S = z.object({ firstName: z.string(), lastName: z.string(), displayName: z.string() });
      const result = createWorld({ seed: 1 }).generate(S);
      expect(result.displayName).toBe(`${result.firstName} ${result.lastName}`);
    });

    it("returns just firstName when lastName is absent", () => {
      const S = z.object({ firstName: z.literal("Robin"), displayName: z.string() });
      const result = createWorld({ seed: 1 }).generate(S);
      expect(result.displayName).toBe("Robin");
    });

    it("falls back to generated name when no siblings", () => {
      const S = z.object({ displayName: z.string() });
      const d = createWorld({ seed: 1 }).generate(S).displayName;
      expect(d.split(" ").length).toBeGreaterThanOrEqual(2);
    });
  });
});
