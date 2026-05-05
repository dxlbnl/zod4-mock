import { describe, it, expect } from "vitest";
import { generators, createPrng } from "../../../src/index.js";

describe("Dutch Localization Verification", () => {
  const prng = createPrng(123);

  describe("Person Generators", () => {
    it("generates Dutch first names", () => {
      const names = Array.from({ length: 50 }, () => generators.person.firstName(prng));
      const dutchFirstNames = ["Jan", "Piet", "Klaas", "Hans", "Dirk", "Marie", "Anna", "Lisa"];
      expect(names.some(n => dutchFirstNames.includes(n))).toBe(true);
    });

    it("generates Dutch last names (including 'van de' etc.)", () => {
      const names = Array.from({ length: 50 }, () => generators.person.lastName(prng));
      expect(names.some(n => n.includes("van") || n.includes("de") || n.includes("den"))).toBe(true);
    });
  });

  describe("Location Generators", () => {
    it("generates Dutch cities", () => {
      const cities = Array.from({ length: 20 }, () => generators.location.city(prng));
      const dutchCities = ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Eindhoven"];
      expect(cities.some(c => dutchCities.includes(c))).toBe(true);
    });

    it("generates Dutch postal codes (1234 AB format)", () => {
      const pc = generators.location.postalCode(prng);
      expect(pc).toMatch(/^[1-9][0-9]{3} [A-Z]{2}$/);
    });
  });

  describe("Phone Generators", () => {
    it("generates Dutch phone numbers (06-... or 010-...)", () => {
      const phone = generators.phone.number(prng);
      // Matches 06-... or 0xx-...
      expect(phone).toMatch(/^0[1-9][0-9]?-/);
    });
  });

  describe("Commerce & Finance Generators", () => {
    it("generates Dutch department names", () => {
      const dept = generators.commerce.department(prng);
      const dutchDepts = ["Elektronica", "Kleding", "Huis", "Tuin", "Speelgoed", "Boeken", "Beauty", "Auto", "Sport", "Gezondheid"];
      expect(dutchDepts).toContain(dept);
    });

    it("generates prices with Dutch comma decimal separator", () => {
      const p = generators.commerce.price(prng);
      expect(p).toMatch(/^[0-9]+,[0-9]{2}$/);
    });

    it("generates Dutch transaction types", () => {
      const tt = generators.finance.transactionType(prng);
      const dutchTTs = ["storting", "opname", "betaling", "factuur", "restitutie"];
      expect(dutchTTs).toContain(tt);
    });
  });
});
