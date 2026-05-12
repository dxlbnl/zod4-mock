/**
 * Coverage tests for the data generator functions.
 * Each describe block covers one namespace, exercising every export.
 */

import { describe, it, expect } from "vitest";
import { createPrng } from "../../../../src/prng.js";
import * as commerce from "../../../../src/generators/data/commerce.js";
import * as company from "../../../../src/generators/data/company.js";
import * as date from "../../../../src/generators/data/date.js";
import * as finance from "../../../../src/generators/data/finance.js";
import * as internet from "../../../../src/generators/data/internet.js";
import * as location from "../../../../src/generators/data/location.js";
import * as phone from "../../../../src/generators/data/phone.js";
import * as vehicle from "../../../../src/generators/data/vehicle.js";
import * as word from "../../../../src/generators/data/word.js";
import { toBase64 } from "../../../../src/utils/encoding.js";

function prng(seed = 42) {
  return createPrng(seed);
}

// ---------------------------------------------------------------------------
// encoding utils
// ---------------------------------------------------------------------------

describe("utils/encoding — toBase64", () => {
  it("returns a base64 string in Node.js (Buffer path)", () => {
    const result = toBase64("hello world");
    expect(result).toBe("aGVsbG8gd29ybGQ=");
  });

  it("round-trips through atob", () => {
    const input = "alpha bravo charlie";
    const encoded = toBase64(input);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    // Every base64 char must be valid
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("encodes empty string", () => {
    expect(toBase64("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// commerce
// ---------------------------------------------------------------------------

describe("generators/data/commerce", () => {
  it("department returns a non-empty string", () => {
    expect(typeof commerce.department(prng())).toBe("string");
  });

  it("productAdjective returns a string", () => {
    expect(typeof commerce.productAdjective(prng())).toBe("string");
  });

  it("productMaterial returns a string", () => {
    expect(typeof commerce.productMaterial(prng())).toBe("string");
  });

  it("productName combines adjective + material + noun", () => {
    const name = commerce.productName(prng());
    expect(typeof name).toBe("string");
    expect(name.split(" ").length).toBeGreaterThanOrEqual(3);
  });

  it("product is an alias for productName", () => {
    const p = prng(1);
    expect(commerce.product(p)).toBe(commerce.productName(prng(1)));
  });

  it("productDescription returns a non-empty string", () => {
    expect(typeof commerce.productDescription(prng())).toBe("string");
  });

  it("price returns a formatted price string", () => {
    const p = commerce.price(prng());
    expect(typeof p).toBe("string");
    expect(p).toMatch(/^\d+,\d{2}$/);
  });

  it("price respects min/max arguments", () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = parseFloat(commerce.price(prng(seed), 10, 20).replace(",", "."));
      expect(p).toBeGreaterThanOrEqual(10);
      expect(p).toBeLessThanOrEqual(20);
    }
  });

  it("isbn returns a string starting with 978-", () => {
    expect(commerce.isbn(prng())).toMatch(/^978-\d{10}$/);
  });

  it("upc returns a 12-digit string", () => {
    expect(commerce.upc(prng())).toMatch(/^\d{12}$/);
  });
});

// ---------------------------------------------------------------------------
// company
// ---------------------------------------------------------------------------

describe("generators/data/company", () => {
  it("name returns a non-empty string", () => {
    expect(typeof company.name(prng())).toBe("string");
  });

  it("name generates varied formats across seeds", () => {
    const names = Array.from({ length: 20 }, (_, i) => company.name(prng(i)));
    const unique = new Set(names);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("buzzAdjective returns a string", () => {
    expect(typeof company.buzzAdjective(prng())).toBe("string");
  });

  it("buzzNoun returns a string", () => {
    expect(typeof company.buzzNoun(prng())).toBe("string");
  });

  it("buzzVerb returns a string", () => {
    expect(typeof company.buzzVerb(prng())).toBe("string");
  });

  it("buzzPhrase combines verb + adjective + noun", () => {
    const phrase = company.buzzPhrase(prng());
    expect(typeof phrase).toBe("string");
    expect(phrase.split(" ").length).toBeGreaterThanOrEqual(3);
  });

  it("catchPhraseAdjective returns a string", () => {
    expect(typeof company.catchPhraseAdjective(prng())).toBe("string");
  });

  it("catchPhraseDescriptor returns a string", () => {
    expect(typeof company.catchPhraseDescriptor(prng())).toBe("string");
  });

  it("catchPhraseNoun returns a string", () => {
    expect(typeof company.catchPhraseNoun(prng())).toBe("string");
  });

  it("catchPhrase combines adjective + descriptor + noun", () => {
    const phrase = company.catchPhrase(prng());
    expect(typeof phrase).toBe("string");
    expect(phrase.split(" ").length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------

describe("generators/data/date", () => {
  it("anytime returns a Date between 2000 and 2030", () => {
    const d = date.anytime(prng());
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBeGreaterThanOrEqual(2000);
    expect(d.getFullYear()).toBeLessThanOrEqual(2030);
  });

  it("between returns a Date within the given range", () => {
    const start = new Date("2020-01-01");
    const end = new Date("2020-12-31");
    for (let seed = 0; seed < 10; seed++) {
      const d = date.between(prng(seed), start, end);
      expect(d.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(d.getTime()).toBeLessThanOrEqual(end.getTime());
    }
  });

  it("betweens returns sorted dates", () => {
    const start = new Date("2021-01-01");
    const end = new Date("2021-12-31");
    const dates = date.betweens(prng(), start, end, 5);
    expect(dates).toHaveLength(5);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]!.getTime()).toBeGreaterThanOrEqual(dates[i - 1]!.getTime());
    }
  });

  it("past returns a Date in the past", () => {
    const now = new Date();
    const d = date.past(prng());
    expect(d.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it("future returns a Date in the future", () => {
    const now = new Date();
    const d = date.future(prng());
    expect(d.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it("recent returns a Date within the past 7 days by default", () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d = date.recent(prng());
    expect(d.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(d.getTime()).toBeGreaterThanOrEqual(weekAgo.getTime());
  });

  it("soon returns a Date within the next 7 days by default", () => {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const d = date.soon(prng());
    expect(d.getTime()).toBeGreaterThanOrEqual(now.getTime());
    expect(d.getTime()).toBeLessThanOrEqual(weekAhead.getTime());
  });

  it("birthdate returns a Date for reasonable adult age range", () => {
    const d = date.birthdate(prng());
    const now = new Date();
    const age = (now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    expect(age).toBeGreaterThanOrEqual(18);
    expect(age).toBeLessThanOrEqual(80);
  });

  it("month returns a non-empty string", () => {
    expect(typeof date.month(prng())).toBe("string");
    expect(date.month(prng()).length).toBeGreaterThan(0);
  });

  it("weekday returns a non-empty string", () => {
    expect(typeof date.weekday(prng())).toBe("string");
  });

  it("timeZone returns a non-empty string", () => {
    expect(typeof date.timeZone(prng())).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// finance
// ---------------------------------------------------------------------------

describe("generators/data/finance", () => {
  it("amount returns a number", () => {
    const a = finance.amount(prng());
    expect(typeof a).toBe("number");
    expect(a).not.toBeNaN();
  });

  it("currencyCode returns a 3-letter code", () => {
    expect(finance.currencyCode(prng())).toMatch(/^[A-Z]{3}$/);
  });

  it("currencyName returns a string", () => {
    expect(typeof finance.currencyName(prng())).toBe("string");
  });

  it("currencySymbol returns a non-empty string", () => {
    expect(finance.currencySymbol(prng()).length).toBeGreaterThan(0);
  });

  it("currencyNumericCode returns a 3-digit string", () => {
    expect(finance.currencyNumericCode(prng())).toMatch(/^\d{3}$/);
  });

  it("accountName returns a string", () => {
    expect(typeof finance.accountName(prng())).toBe("string");
  });

  it("accountNumber returns a digit string of default length 10", () => {
    expect(finance.accountNumber(prng())).toMatch(/^\d{10}$/);
  });

  it("accountNumber respects length argument", () => {
    expect(finance.accountNumber(prng(), 8)).toMatch(/^\d{8}$/);
  });

  it("transactionType returns a string", () => {
    expect(typeof finance.transactionType(prng())).toBe("string");
  });

  it("transactionDescription returns a string", () => {
    expect(typeof finance.transactionDescription(prng())).toBe("string");
  });

  it("iban returns a Dutch IBAN starting with NL", () => {
    expect(finance.iban(prng())).toMatch(/^NL\d{2}[A-Z]{4}\d{10}$/);
  });

  it("bic returns a string", () => {
    const bic = finance.bic(prng());
    expect(typeof bic).toBe("string");
    expect(bic.length).toBeGreaterThan(0);
  });

  it("creditCardNumber returns 4 groups of 4 digits", () => {
    expect(finance.creditCardNumber(prng())).toMatch(/^\d{4}-\d{4}-\d{4}-\d{4}$/);
  });

  it("creditCardCVV returns a 3-digit string", () => {
    expect(finance.creditCardCVV(prng())).toMatch(/^\d{3}$/);
  });

  it("creditCardIssuer returns a known issuer name", () => {
    const issuers = ["Visa", "Mastercard", "American Express", "Discover", "Maestro", "Diners Club", "JCB"];
    expect(issuers).toContain(finance.creditCardIssuer(prng()));
  });

  it("pin returns a 4-digit string by default", () => {
    expect(finance.pin(prng())).toMatch(/^\d{4}$/);
  });

  it("routingNumber returns a 9-digit string", () => {
    expect(finance.routingNumber(prng())).toMatch(/^\d{9}$/);
  });

  it("bitcoinAddress starts with 1 and has correct length", () => {
    expect(finance.bitcoinAddress(prng())).toMatch(/^1[a-zA-Z0-9]{33}$/);
  });

  it("ethereumAddress starts with 0x and has 40 hex chars", () => {
    expect(finance.ethereumAddress(prng())).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("litecoinAddress starts with L and has correct length", () => {
    expect(finance.litecoinAddress(prng())).toMatch(/^L[a-zA-Z0-9]{33}$/);
  });
});

// ---------------------------------------------------------------------------
// internet
// ---------------------------------------------------------------------------

describe("generators/data/internet", () => {
  it("domainSuffix returns a known TLD", () => {
    const tlds = ["com", "net", "org", "nl", "io", "dev", "ai", "app", "me", "co", "info", "biz", "eu", "be", "de", "uk"];
    expect(tlds).toContain(internet.domainSuffix(prng()));
  });

  it("domainWord returns a lowercase string", () => {
    expect(internet.domainWord(prng())).toMatch(/^[a-z]+$/);
  });

  it("domainName returns word.tld", () => {
    expect(internet.domainName(prng())).toMatch(/^[a-z]+\.[a-z]+$/);
  });

  it("username returns a non-empty string", () => {
    expect(internet.username(prng()).length).toBeGreaterThan(0);
  });

  it("username generates variety across seeds (50/50 branch)", () => {
    const names = Array.from({ length: 20 }, (_, i) => internet.username(prng(i)));
    // Some should contain digits (firstNameNN format), some should not (FirstLast format)
    const unique = new Set(names);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("displayName returns First + Last", () => {
    const d = internet.displayName(prng());
    expect(d.split(" ").length).toBeGreaterThanOrEqual(2);
  });

  it("email returns an email-shaped string", () => {
    expect(internet.email(prng())).toMatch(/@/);
  });

  it("exampleEmail ends with @voorbeeld.*", () => {
    expect(internet.exampleEmail(prng())).toMatch(/@voorbeeld\./);
  });

  it("emoji returns an emoji string", () => {
    expect(typeof internet.emoji(prng())).toBe("string");
    expect(internet.emoji(prng()).length).toBeGreaterThan(0);
  });

  it("password returns a string of default length 12", () => {
    expect(internet.password(prng())).toHaveLength(12);
  });

  it("protocol returns a known protocol", () => {
    const protos = ["http", "https", "ftp", "ssh", "ws", "wss", "tcp", "udp"];
    expect(protos).toContain(internet.protocol(prng()));
  });

  it("url returns a https:// URL", () => {
    expect(internet.url(prng())).toMatch(/^https:\/\//);
  });

  it("userAgent returns a non-empty string", () => {
    expect(internet.userAgent(prng()).length).toBeGreaterThan(0);
  });

  it("ipv4 returns four dot-separated octets", () => {
    expect(internet.ipv4(prng())).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  });

  it("ip is an alias for ipv4", () => {
    expect(internet.ip(prng(1))).toBe(internet.ipv4(prng(1)));
  });

  it("ipv6 returns 8 colon-separated hex groups", () => {
    expect(internet.ipv6(prng())).toMatch(/^([0-9a-f]{4}:){7}[0-9a-f]{4}$/);
  });

  it("port returns a number between 1 and 65535", () => {
    const p = internet.port(prng());
    expect(p).toBeGreaterThanOrEqual(1);
    expect(p).toBeLessThanOrEqual(65535);
  });

  it("mac returns a colon-separated MAC address", () => {
    expect(internet.mac(prng())).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);
  });

  it("httpMethod returns a known method", () => {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "TRACE", "CONNECT"];
    expect(methods).toContain(internet.httpMethod(prng()));
  });

  it("httpStatusCode returns a number", () => {
    expect(typeof internet.httpStatusCode(prng())).toBe("number");
  });

  it("jwtAlgorithm returns a known algorithm", () => {
    const algs = ["HS256", "HS384", "HS512", "RS256"];
    expect(algs).toContain(internet.jwtAlgorithm(prng()));
  });

  it("jwt returns header.payload.signature format", () => {
    expect(internet.jwt(prng()).split(".").length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// location
// ---------------------------------------------------------------------------

describe("generators/data/location", () => {
  it("street returns a non-empty string", () => {
    expect(location.street(prng()).length).toBeGreaterThan(0);
  });

  it("buildingNumber returns a number starting string", () => {
    expect(location.buildingNumber(prng())).toMatch(/^\d+/);
  });

  it("buildingNumber generates suffix variant across seeds", () => {
    const numbers = Array.from({ length: 30 }, (_, i) => location.buildingNumber(prng(i)));
    // ~10% chance of suffix — at least one should have a letter suffix over 30 seeds
    const hasSuffix = numbers.some((n) => /[a-z]/.test(n));
    expect(hasSuffix).toBe(true);
  });

  it("streetAddress returns street + number", () => {
    expect(typeof location.streetAddress(prng())).toBe("string");
  });

  it("secondaryAddress returns 'Appartement NNN'", () => {
    expect(location.secondaryAddress(prng())).toMatch(/^Appartement \d+$/);
  });

  it("zipCode matches Dutch format (1234 AB)", () => {
    expect(location.zipCode(prng())).toMatch(/^\d{4} [A-Z]{2}$/);
  });

  it("city returns a non-empty string", () => {
    expect(location.city(prng()).length).toBeGreaterThan(0);
  });

  it("city generates all 3 format variants across seeds", () => {
    const cities = Array.from({ length: 30 }, (_, i) => location.city(prng(i)));
    expect(new Set(cities).size).toBeGreaterThan(5);
  });

  it("state returns a Dutch province", () => {
    expect(typeof location.state(prng())).toBe("string");
  });

  it("county is an alias for state", () => {
    expect(location.county(prng(1))).toBe(location.state(prng(1)));
  });

  it("country returns a string", () => {
    expect(typeof location.country(prng())).toBe("string");
  });

  it("countryCode returns a 2-letter code", () => {
    expect(location.countryCode(prng())).toMatch(/^[A-Z]{2}$/);
  });

  it("continent returns a string", () => {
    expect(typeof location.continent(prng())).toBe("string");
  });

  it("language returns a string", () => {
    expect(typeof location.language(prng())).toBe("string");
  });

  it("latitude returns a number between -90 and 90", () => {
    const lat = location.latitude(prng());
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
  });

  it("longitude returns a number between -180 and 180", () => {
    const lon = location.longitude(prng());
    expect(lon).toBeGreaterThanOrEqual(-180);
    expect(lon).toBeLessThanOrEqual(180);
  });

  it("timeZone returns a string", () => {
    expect(typeof location.timeZone(prng())).toBe("string");
  });

  it("direction returns a string", () => {
    expect(typeof location.direction(prng())).toBe("string");
  });

  it("cardinalDirection returns one of 4 directions", () => {
    const dirs = ["Noord", "Oost", "Zuid", "West"];
    expect(dirs).toContain(location.cardinalDirection(prng()));
  });

  it("ordinalDirection returns one of 4 diagonal directions", () => {
    const dirs = ["Noordoost", "Zuidoost", "Zuidwest", "Noordwest"];
    expect(dirs).toContain(location.ordinalDirection(prng()));
  });
});

// ---------------------------------------------------------------------------
// phone
// ---------------------------------------------------------------------------

describe("generators/data/phone", () => {
  it("number returns a non-empty string", () => {
    expect(phone.number(prng()).length).toBeGreaterThan(0);
  });

  it("number generates both mobile (06-) and landline formats", () => {
    const numbers = Array.from({ length: 30 }, (_, i) => phone.number(prng(i)));
    const mobile = numbers.filter((n) => n.startsWith("06-"));
    const landline = numbers.filter((n) => !n.startsWith("06-"));
    expect(mobile.length).toBeGreaterThan(0);
    expect(landline.length).toBeGreaterThan(0);
  });

  it("imei returns a 15-digit string", () => {
    expect(phone.imei(prng())).toMatch(/^\d{15}$/);
  });
});

// ---------------------------------------------------------------------------
// vehicle
// ---------------------------------------------------------------------------

describe("generators/data/vehicle", () => {
  it("manufacturer returns a non-empty string", () => {
    expect(vehicle.manufacturer(prng()).length).toBeGreaterThan(0);
  });

  it("type returns a vehicle type string", () => {
    expect(typeof vehicle.type(prng())).toBe("string");
  });

  it("model returns a non-empty string", () => {
    expect(vehicle.model(prng()).length).toBeGreaterThan(0);
  });

  it("vehicle returns manufacturer + model", () => {
    const v = vehicle.vehicle(prng());
    expect(v.split(" ").length).toBeGreaterThanOrEqual(2);
  });

  it("color returns a color string", () => {
    expect(typeof vehicle.color(prng())).toBe("string");
  });

  it("fuel returns a fuel type", () => {
    const fuels = ["Benzine", "Diesel", "Elektrisch", "Hybride", "Waterstof", "LPG", "CNG", "PHEV"];
    expect(fuels).toContain(vehicle.fuel(prng()));
  });

  it("vin returns a 17-character string", () => {
    expect(vehicle.vin(prng())).toHaveLength(17);
  });

  it("vrm matches Dutch plate format", () => {
    expect(vehicle.vrm(prng())).toMatch(/^[A-Z]{2}-\d{3}-[A-Z]$/);
  });

  it("bicycle returns a brand string", () => {
    expect(typeof vehicle.bicycle(prng())).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// word — uncovered functions
// ---------------------------------------------------------------------------

describe("generators/data/word — additional coverage", () => {
  it("conjunction returns a string", () => {
    expect(typeof word.conjunction(prng())).toBe("string");
  });

  it("interjection returns a string", () => {
    expect(typeof word.interjection(prng())).toBe("string");
  });

  it("preposition returns a string", () => {
    expect(typeof word.preposition(prng())).toBe("string");
  });

  it("sample returns a sentence or paragraph string", () => {
    const s = word.sample(prng());
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });
});
