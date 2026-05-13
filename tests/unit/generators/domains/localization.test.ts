import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generators, createPrng, createWorld, nl } from "../../../../src/index.js";

describe("Localization", () => {
  const prng = createPrng(123);

  describe("Person Generators (nl locale)", () => {
    it("generates first names with nl locale", () => {
      const world = createWorld({ seed: 123, locale: nl });
      const schema = z.object({ voornaam: z.string() });
      const names = Array.from({ length: 20 }, () => world.generate(schema).voornaam);
      expect(names.every((n) => typeof n === "string" && n.length >= 2)).toBe(true);
      expect(names.every((n) => /^[A-Z]/.test(n))).toBe(true);
    });

    it("generates last names with nl locale", () => {
      const world = createWorld({ seed: 123, locale: nl });
      const schema = z.object({ achternaam: z.string() });
      const names = Array.from({ length: 20 }, () => world.generate(schema).achternaam);
      expect(names.every((n) => typeof n === "string" && n.length >= 2)).toBe(true);
      expect(names.every((n) => /^[A-Z]/.test(n))).toBe(true);
    });
  });

  describe("Location Generators", () => {
    it("generates Dutch cities", () => {
      const cities = Array.from({ length: 20 }, () => generators.location.city(prng));
      const dutchCities = ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Eindhoven"];
      expect(cities.some((c) => dutchCities.includes(c))).toBe(true);
    });

    it("generates Dutch postal codes (1234 AB format)", () => {
      const pc = generators.location.postalCode(prng);
      expect(pc).toMatch(/^[1-9][0-9]{3} [A-Z]{2}$/);
    });
  });

  describe("Phone Generators", () => {
    it("generates Dutch phone numbers (06-... or 010-...)", () => {
      const phone = generators.phone.number(prng);
      expect(phone).toMatch(/^0[1-9][0-9]?-/);
    });
  });

  describe("Commerce & Finance Generators", () => {
    it("generates Dutch department names", () => {
      const ALL_DUTCH_DEPARTMENTS = [
        "Elektronica", "Kleding", "Huis", "Tuin", "Speelgoed", "Boeken", "Beauty",
        "Auto", "Sport", "Gezondheid", "Schoenen", "Sieraden", "Horloges", "Muziek",
        "Films", "Gereedschap", "Dierenbenodigdheden", "Baby", "Kantoorartikelen", "Levensmiddelen",
      ];
      const dept = generators.commerce.department(prng);
      expect(ALL_DUTCH_DEPARTMENTS).toContain(dept);
    });

    it("generates prices with Dutch comma decimal separator", () => {
      const p = generators.commerce.price(prng);
      expect(p).toMatch(/^[0-9]+,[0-9]{2}$/);
    });

    it("generates Dutch transaction types", () => {
      const tt = generators.finance.transactionType(prng);
      const dutchTTs = ["storting", "opname", "betaling", "factuur", "restitutie", "overschrijving", "incasso", "salaris", "rente", "dividend"];
      expect(dutchTTs).toContain(tt);
    });
  });

  describe("Locale Switching", () => {
    it("default world uses English locale for first names", () => {
      const schema = z.object({ firstName: z.string() });
      const names = Array.from({ length: 10 }, (_, seed) =>
        createWorld({ seed }).generate(schema).firstName,
      );
      expect(names.every((n) => typeof n === "string" && n.length >= 2)).toBe(true);
      expect(names.every((n) => /^[A-Z]/.test(n))).toBe(true);
    });

    it("nl locale produces different names than default en locale", () => {
      const schema = z.object({ voornaam: z.string() });
      const enNames = Array.from({ length: 10 }, (_, seed) =>
        createWorld({ seed }).generate(schema).voornaam,
      );
      const nlNames = Array.from({ length: 10 }, (_, seed) =>
        createWorld({ seed, locale: nl }).generate(schema).voornaam,
      );
      expect(enNames).not.toEqual(nlNames);
    });
  });
});
