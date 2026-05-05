/**
 * @module generators/key-based
 * Generates semantically meaningful values based on field name patterns.
 *
 * Generation pipeline position: higher priority than schema-based, lower than matchers.
 * Returns `undefined` for unrecognised keys so the caller can fall back to schema-based.
 */

import type { ZodTypeAny } from "zod";
import type { GeneratorContext, Prng } from "../types.js";

// ---------------------------------------------------------------------------
// Data sets
// ---------------------------------------------------------------------------

const JOB_TITLES = [
  "Software Engineer",
  "Senior Engineer",
  "Staff Engineer",
  "Engineering Manager",
  "Product Manager",
  "Product Designer",
  "UX Designer",
  "Data Scientist",
  "Data Engineer",
  "DevOps Engineer",
  "Site Reliability Engineer",
  "QA Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full-Stack Developer",
  "Tech Lead",
  "Solutions Architect",
  "Cloud Architect",
  "Security Engineer",
  "Mobile Developer",
] as const;

const JOB_AREAS = [
  "Engineering",
  "Product",
  "Design",
  "Data",
  "Infrastructure",
  "Security",
  "Marketing",
  "Sales",
  "Finance",
  "Operations",
  "Customer Success",
  "Legal",
  "Human Resources",
  "Research",
] as const;

const ALNUM_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" as const;
const HEX_CHARS = "0123456789abcdef" as const;
const NANOID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" as const;

const FIRST_NAMES = [
  "Jan",
  "Piet",
  "Klaas",
  "Hans",
  "Dirk",
  "Erik",
  "Tom",
  "Sven",
  "Luc",
  "Bas",
  "Marie",
  "Anna",
  "Lisa",
  "Emma",
  "Sara",
  "Lena",
  "Nora",
  "Eva",
  "Julia",
  "Inge",
  "James",
  "John",
  "Paul",
  "Mark",
  "Luke",
  "Adam",
  "Noah",
  "Owen",
  "Ryan",
  "Sean",
  "Alice",
  "Grace",
  "Claire",
  "Mia",
  "Zoe",
  "Iris",
  "Laura",
  "Amy",
  "Kate",
  "Ruth",
] as const;

const LAST_NAMES = [
  "de Vries",
  "Janssen",
  "Bakker",
  "Visser",
  "Smit",
  "Meijer",
  "Peters",
  "van den Berg",
  "Dekker",
  "Vermeer",
  "Brouwer",
  "Hendriks",
  "Kuiper",
  "Willems",
  "van der Linden",
  "Smith",
  "Jones",
  "Taylor",
  "Brown",
  "Wilson",
  "Evans",
  "Thomas",
  "Roberts",
  "Walker",
] as const;

const CITIES = [
  "Amsterdam",
  "Rotterdam",
  "Den Haag",
  "Utrecht",
  "Eindhoven",
  "Groningen",
  "Almere",
  "Breda",
  "Nijmegen",
  "Tilburg",
  "London",
  "Berlin",
  "Paris",
  "Brussels",
  "Vienna",
] as const;

const STREETS = [
  "Keizersgracht",
  "Prinsengracht",
  "Herengracht",
  "Singel",
  "Overtoom",
  "Dorpsstraat",
  "Molenweg",
  "Kerkstraat",
  "Schoolstraat",
  "Parallelweg",
  "Main Street",
  "High Street",
  "Church Lane",
  "Park Road",
  "Station Road",
] as const;

const COUNTRIES = [
  "Netherlands",
  "Germany",
  "Belgium",
  "France",
  "United Kingdom",
  "Austria",
  "Switzerland",
  "Denmark",
  "Sweden",
  "Norway",
] as const;

export const DOMAINS = [
  "example.com",
  "test.org",
  "demo.nl",
  "sample.io",
  "mock.dev",
  "acme.com",
  "corp.nl",
  "enterprise.org",
  "startup.io",
  "labs.dev",
] as const;

const LOREM_WORDS = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "do",
  "eiusmod",
  "tempor",
  "incididunt",
  "ut",
  "labore",
  "dolore",
  "magna",
  "aliqua",
  "enim",
  "ad",
  "minim",
  "veniam",
  "quis",
  "nostrud",
  "exercitation",
  "ullamco",
  "laboris",
  "nisi",
  "aliquip",
  "ex",
  "ea",
  "commodo",
] as const;

// ---------------------------------------------------------------------------
// Primitive generators
// ---------------------------------------------------------------------------

export function firstName(prng: GeneratorContext["prng"]): string {
  return FIRST_NAMES[prng.int(0, FIRST_NAMES.length - 1)]!;
}

export function lastName(prng: GeneratorContext["prng"]): string {
  return LAST_NAMES[prng.int(0, LAST_NAMES.length - 1)]!;
}

export function email(prng: GeneratorContext["prng"]): string {
  const fn = firstName(prng).toLowerCase().replace(/\s/g, "");
  const ln = lastName(prng).toLowerCase().replace(/[\s']/g, "").replace(/\s/g, "");
  const n = prng.int(1, 99);
  const domain = DOMAINS[prng.int(0, DOMAINS.length - 1)]!;
  return `${fn}.${ln}${n}@${domain}`;
}

export function uuid(prng: GeneratorContext["prng"]): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = prng.int(0, 15);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function phone(prng: GeneratorContext["prng"]): string {
  const prefix = prng.pick(["+31", "+44", "+49", "+33", "+32"] as const);
  const number = Array.from({ length: 9 }, () => prng.int(0, 9)).join("");
  return `${prefix} ${number}`;
}

export function postalCode(prng: GeneratorContext["prng"]): string {
  return `${prng.int(1000, 9999)} ${String.fromCharCode(prng.int(65, 90))}${String.fromCharCode(prng.int(65, 90))}`;
}

export function url(prng: GeneratorContext["prng"]): string {
  const domain = DOMAINS[prng.int(0, DOMAINS.length - 1)]!;
  const path = LOREM_WORDS[prng.int(0, LOREM_WORDS.length - 1)]!;
  return `https://${domain}/${path}`;
}

export function date(prng: GeneratorContext["prng"]): Date {
  const start = new Date("2020-01-01").getTime();
  const end = new Date("2025-12-31").getTime();
  return new Date(start + prng.random() * (end - start));
}

export function loremText(prng: GeneratorContext["prng"], words: number): string {
  return Array.from(
    { length: words },
    () => LOREM_WORDS[prng.int(0, LOREM_WORDS.length - 1)]!,
  ).join(" ");
}

// ---------------------------------------------------------------------------
// person generators
// ---------------------------------------------------------------------------

export function fullName(prng: GeneratorContext["prng"]): string {
  return `${firstName(prng)} ${lastName(prng)}`;
}

export function jobTitle(prng: GeneratorContext["prng"]): string {
  return JOB_TITLES[prng.int(0, JOB_TITLES.length - 1)]!;
}

export function jobArea(prng: GeneratorContext["prng"]): string {
  return JOB_AREAS[prng.int(0, JOB_AREAS.length - 1)]!;
}

// ---------------------------------------------------------------------------
// internet generators
// ---------------------------------------------------------------------------

export function username(prng: GeneratorContext["prng"]): string {
  return `${firstName(prng).toLowerCase()}${prng.int(1, 999)}`;
}

export function domain(prng: GeneratorContext["prng"]): string {
  return DOMAINS[prng.int(0, DOMAINS.length - 1)]!;
}

export function ip(prng: GeneratorContext["prng"]): string {
  return `${prng.int(1, 255)}.${prng.int(0, 255)}.${prng.int(0, 255)}.${prng.int(1, 254)}`;
}

// ---------------------------------------------------------------------------
// location generators
// ---------------------------------------------------------------------------

export function city(prng: GeneratorContext["prng"]): string {
  return CITIES[prng.int(0, CITIES.length - 1)]!;
}

export function country(prng: GeneratorContext["prng"]): string {
  return COUNTRIES[prng.int(0, COUNTRIES.length - 1)]!;
}

export function streetAddress(prng: GeneratorContext["prng"]): string {
  return `${STREETS[prng.int(0, STREETS.length - 1)]!} ${prng.int(1, 200)}`;
}

export function latitude(prng: GeneratorContext["prng"]): number {
  return parseFloat((prng.random() * 180 - 90).toFixed(6));
}

export function longitude(prng: GeneratorContext["prng"]): number {
  return parseFloat((prng.random() * 360 - 180).toFixed(6));
}

// ---------------------------------------------------------------------------
// lorem generators
// ---------------------------------------------------------------------------

export function word(prng: GeneratorContext["prng"]): string {
  return LOREM_WORDS[prng.int(0, LOREM_WORDS.length - 1)]!;
}

export function sentence(prng: GeneratorContext["prng"]): string {
  const count = prng.int(6, 12);
  const words = Array.from({ length: count }, () => word(prng));
  words[0] = words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1);
  return words.join(" ") + ".";
}

export function paragraph(prng: GeneratorContext["prng"]): string {
  return Array.from({ length: prng.int(3, 5) }, () => sentence(prng)).join(" ");
}

// ---------------------------------------------------------------------------
// string generators
// ---------------------------------------------------------------------------

export function alphanumeric(prng: GeneratorContext["prng"], length = 8): string {
  return Array.from({ length }, () => ALNUM_CHARS[prng.int(0, ALNUM_CHARS.length - 1)]!).join("");
}

export function hexadecimal(prng: GeneratorContext["prng"], length = 8): string {
  return "0x" + Array.from({ length }, () => HEX_CHARS[prng.int(0, 15)]!).join("");
}

export function nanoid(prng: GeneratorContext["prng"]): string {
  return Array.from({ length: 21 }, () => NANOID_CHARS[prng.int(0, NANOID_CHARS.length - 1)]!).join(
    "",
  );
}

// ---------------------------------------------------------------------------
// Zod type helper
// ---------------------------------------------------------------------------

function getZodType(schema: ZodTypeAny): string {
  return (schema as unknown as { _zod: { def: { type: string } } })._zod.def.type;
}

// ---------------------------------------------------------------------------
// PrngGen — map value type
// ---------------------------------------------------------------------------

/** A generator that takes only a Prng. Matches the signature of all generators.* functions. */
export type PrngGen<T = unknown> = (prng: Prng) => T;

// ---------------------------------------------------------------------------
// DEFAULT_KEY_MAP — declarative exact-match map, organised by Zod schema type
// ---------------------------------------------------------------------------

const SKU_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Declarative map from lowercased field name to a `PrngGen` generator,
 * organised by Zod schema type.  The world consults the sub-map matching
 * the field's schema type before falling through to pattern rules and
 * schema-based generation.
 *
 * Entries are plain function references — `generators.*` functions can be
 * assigned here directly.
 */
export const DEFAULT_KEY_MAP: Record<string, Record<string, PrngGen> | undefined> = {
  string: {
    email: email,
    firstname: firstName,
    first_name: firstName,
    lastname: lastName,
    last_name: lastName,
    surname: lastName,
    fullname: fullName,
    full_name: fullName,
    name: fullName, // default: person name — override at subject level
    phone: phone,
    phonenumber: phone,
    phone_number: phone,
    city: city,
    country: country,
    street: streetAddress,
    streetname: streetAddress,
    street_name: streetAddress,
    postalcode: postalCode,
    zipcode: postalCode,
    postal_code: postalCode,
    url: url,
    website: url,
    homepage: url,
    title: sentence,
    description: paragraph,
    bio: paragraph,
    notes: paragraph,
    note: paragraph,
    comment: paragraph,
    content: paragraph,
    body: paragraph,
    text: sentence,
    message: paragraph,
    summary: paragraph,
    transcript: paragraph,
    sku: (prng) =>
      `${SKU_LETTERS[prng.int(0, SKU_LETTERS.length - 1)]!}${SKU_LETTERS[prng.int(0, SKU_LETTERS.length - 1)]!}-${prng.int(1000, 9999)}`,
    vatnumber: (prng) => `NL${prng.int(100000000, 999999999)}B${prng.int(10, 99)}`,
    vat_number: (prng) => `NL${prng.int(100000000, 999999999)}B${prng.int(10, 99)}`,
  },
  number: {
    wordcount: (prng) => prng.int(50, 5000),
    word_count: (prng) => prng.int(50, 5000),
    quantity: (prng) => prng.int(1, 100),
    position: (prng) => prng.int(0, 100),
    count: (prng) => prng.int(0, 50),
  },
};

// ---------------------------------------------------------------------------
// DEFAULT_KEY_PATTERNS — suffix/prefix rules, organised by Zod schema type
// ---------------------------------------------------------------------------

/** A pattern rule: a key test function + a PrngGen generator. */
export type KeyPattern = { test: (key: string) => boolean; generate: PrngGen };

/**
 * Pattern rules applied after `DEFAULT_KEY_MAP` exact lookup misses.
 * `string` rules only fire for string-typed fields; `any` fires for any type.
 */
export const DEFAULT_KEY_PATTERNS: { string: KeyPattern[]; any: KeyPattern[] } = {
  string: [{ test: (k) => k === "id" || k.endsWith("id") || k.endsWith("uuid"), generate: uuid }],
  any: [
    { test: (k) => k.endsWith("at") || k.endsWith("date") || k.startsWith("date"), generate: date },
  ],
};

// ---------------------------------------------------------------------------
// generateFromKey — thin lookup over DEFAULT_KEY_MAP + DEFAULT_KEY_PATTERNS
// ---------------------------------------------------------------------------

/**
 * Attempt to generate a semantically meaningful value based on the field name.
 *
 * Consults `DEFAULT_KEY_MAP` for exact matches, then `DEFAULT_KEY_PATTERNS`
 * for suffix/prefix rules.  Returns `undefined` when nothing matches.
 */
export function generateFromKey(key: string, schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const lk = key.toLowerCase();
  const schemaType = getZodType(schema);

  // 1. Exact match in the type-specific sub-map
  const fn = DEFAULT_KEY_MAP[schemaType]?.[lk];
  if (fn !== undefined) return fn(ctx.prng);

  // 2. Pattern rules for this schema type
  for (const p of (DEFAULT_KEY_PATTERNS as Record<string, KeyPattern[]>)[schemaType] ?? []) {
    if (p.test(lk)) return p.generate(ctx.prng);
  }

  // 3. Schema-agnostic pattern rules
  for (const p of DEFAULT_KEY_PATTERNS.any) {
    if (p.test(lk)) return p.generate(ctx.prng);
  }

  return undefined;
}
