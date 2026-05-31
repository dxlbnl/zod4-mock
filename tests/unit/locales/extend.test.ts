import { describe, it, expect } from "vitest";
import { extend } from "@zod4-mock/locale-core";
import { en } from "@zod4-mock/locale-en";
import { nl } from "@zod4-mock/locale-nl";

describe("extend()", () => {
  it("returns a locale with the new id", () => {
    const custom = extend(en, { id: "en-AU" });
    expect(custom.id).toBe("en-AU");
  });

  it("does not mutate the base locale", () => {
    const originalId = en.id;
    const originalGenders = en.person.genders;
    extend(en, { id: "x", person: { genders: ["X"] } });
    expect(en.id).toBe(originalId);
    expect(en.person.genders).toBe(originalGenders);
  });

  it("overriding one person field preserves all other person fields", () => {
    const custom = extend(en, { person: { genders: ["Male", "Female", "Robot"] } });
    expect(custom.person.genders).toEqual(["Male", "Female", "Robot"]);
    expect(custom.person.prefixes).toBe(en.person.prefixes);
    expect(custom.person.firstNamesMale).toBe(en.person.firstNamesMale);
    expect(custom.person.lastNames).toBe(en.person.lastNames);
    expect(custom.person.suffixes).toBe(en.person.suffixes);
  });

  it("overriding one word field preserves all other word fields", () => {
    const custom = extend(en, { word: { articles: ["the", "a"] } });
    expect(custom.word.articles).toEqual(["the", "a"]);
    expect(custom.word.nouns).toBe(en.word.nouns);
    expect(custom.word.verbs).toBe(en.word.verbs);
    expect(custom.word.conjunctions).toBe(en.word.conjunctions);
  });

  it("overriding one finance field preserves other finance fields", () => {
    const myBankCodes = ["MYBA", "MYBB"] as const;
    const custom = extend(en, { finance: { bankCodes: myBankCodes } });
    expect(custom.finance.bankCodes).toEqual(myBankCodes);
    expect(custom.finance.formatIban).toBe(en.finance.formatIban);
  });

  it("replacing the address section with nl address preserves other sections", () => {
    const custom = extend(en, { address: nl.address });
    expect(custom.address).toEqual(nl.address);
    expect(custom.person).toEqual(en.person);
    expect(custom.commerce).toEqual(en.commerce);
    expect(custom.word).toEqual(en.word);
  });

  it("unoverridden sections are identical references to the base", () => {
    const custom = extend(en, { id: "en-variant" });
    expect(custom.person).toEqual(en.person);
    expect(custom.address).toEqual(en.address);
    expect(custom.commerce).toEqual(en.commerce);
    expect(custom.company).toEqual(en.company);
    expect(custom.word).toEqual(en.word);
    expect(custom.finance).toEqual(en.finance);
  });

  it("can build a locale that combines en structure with nl names", () => {
    const mixed = extend(en, {
      id: "en-nl-names",
      person: {
        firstNamesMale: nl.person.firstNamesMale!,
        firstNamesFemale: nl.person.firstNamesFemale!,
        lastNames: nl.person.lastNames!,
      },
    });
    expect(mixed.id).toBe("en-nl-names");
    expect(mixed.person.firstNamesMale).toBe(nl.person.firstNamesMale);
    expect(mixed.person.genders).toBe(en.person.genders); // en genders preserved
    expect(mixed.word).toEqual(en.word); // en words preserved
  });
});
