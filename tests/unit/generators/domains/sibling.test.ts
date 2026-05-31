import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld, createPrng, generators } from "../../../../src/index.js";

describe("Sibling-aware internet generators", () => {
  describe("username", () => {
    it("incorporates firstName sibling", () => {
      const S = z.object({ firstName: z.string(), lastName: z.string(), username: z.string() });
      const result = createWorld({ seed: 1 }).generate(S);
      const f = result.firstName
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      const l = result.lastName
        .split(" ")
        .at(-1)!
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      expect(result.username.toLowerCase()).toMatch(new RegExp(f.length >= 2 ? f : l));
    });

    it("uses nickname sibling when present (takes priority over firstName)", () => {
      const S = z.object({
        firstName: z.string(),
        nickname: z.literal("jankie"),
        username: z.string(),
      });
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
      const f = result.firstName
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      expect(result.email).toContain(f);
      expect(result.email).toContain("@");
    });

    it("uses nickname when present (takes priority over firstName)", () => {
      const S = z.object({
        firstName: z.string(),
        nickname: z.literal("speedy"),
        email: z.string(),
      });
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

describe("bio with job siblings", () => {
  it("bio incorporates jobTitle and jobArea when available", () => {
    const S = z.object({ jobTitle: z.string(), jobArea: z.string(), bio: z.string() });
    const result = createWorld({ seed: 1 }).generate(S);
    const t = result.jobTitle.toLowerCase().replace(/[^a-z]/g, "");
    const a = result.jobArea.toLowerCase().replace(/[^a-z]/g, "");
    expect(result.bio.toLowerCase().replace(/[^a-z]/g, "")).toContain(t);
    expect(result.bio.toLowerCase().replace(/[^a-z]/g, "")).toContain(a);
  });

  it("bio ends with a period when no siblings", () => {
    const S = z.object({ bio: z.string() });
    const bio = createWorld({ seed: 1 }).generate(S).bio;
    expect(bio.length).toBeGreaterThan(10);
    expect(bio).toMatch(/\.$/);
  });
});

describe("creditCardNumber with issuer sibling", () => {
  it("Visa card starts with 4", () => {
    const S = z.object({ creditCardIssuer: z.literal("Visa"), creditCardNumber: z.string() });
    expect(createWorld({ seed: 1 }).generate(S).creditCardNumber).toMatch(/^4/);
  });

  it("Mastercard starts with 5[1-5]", () => {
    const S = z.object({ creditCardIssuer: z.literal("Mastercard"), creditCardNumber: z.string() });
    expect(createWorld({ seed: 1 }).generate(S).creditCardNumber).toMatch(/^5[1-5]/);
  });

  it("American Express is formatted 4-6-5", () => {
    const S = z.object({
      creditCardIssuer: z.literal("American Express"),
      creditCardNumber: z.string(),
    });
    const n = createWorld({ seed: 1 }).generate(S).creditCardNumber;
    expect(n).toMatch(/^3[47]\d{2}-\d{6}-\d{5}$/);
  });

  it("fallback produces a Visa-style 16-digit card when no issuer sibling", () => {
    const S = z.object({ creditCardNumber: z.string() });
    expect(createWorld({ seed: 1 }).generate(S).creditCardNumber).toMatch(
      /^4\d{3}-\d{4}-\d{4}-\d{4}$/,
    );
  });
});

describe("jwt encoding", () => {
  it("jwt segments use base64url characters only", () => {
    const j = generators.internet.jwt(createPrng(1));
    for (const seg of j.split(".")) {
      expect(seg).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
  });
});
