import type { ZodTypeAny } from "zod";
import type { GeneratorContext, Prng } from "../../types.js";
import { getLeafDef } from "../schema/zod-def.js";
import { resolveNumberBounds, generateNumberWithBounds } from "../schema/number.js";
import { resolveStringLength } from "../schema/string.js";
import * as data from "./index.js";
import { age as ageGen } from "./age.js";
import { year as yearGen } from "./year.js";
import { quantity as quantityGen, count as countGen } from "./discrete.js";

/**
 * Log-uniform integer draw on `[min, max]`. Falls back to uniform-int when
 * the range crosses zero or `min ≤ 0`. Used by `fileSize` / `bytes` / `views`
 * / `population` per B57-R1.
 */
function logUniformInt(prng: Prng, min: number, max: number): number {
  if (min > 0) {
    return Math.round(prng.logUniform(min, max));
  }
  return prng.int(Math.ceil(min), Math.floor(max));
}

/**
 * Log-uniform continuous draw on `[min, max]`. Falls back to uniform when
 * the range crosses zero or `min ≤ 0`. Used by `distance` per B57-R1.
 */
function logUniformFloat(prng: Prng, min: number, max: number): number {
  if (min > 0) return prng.logUniform(min, max);
  return prng.random() * (max - min) + min;
}

/**
 * Accumulates sentences until the result is at least `minLen` characters,
 * then clips to `maxLen`. Used by bio/description-type key generators so
 * they produce naturally fitting text rather than x-padded strings.
 */
function generateTextToLength(
  prng: Prng,
  ctx: GeneratorContext | undefined,
  minLen: number,
  maxLen: number,
): string {
  let result = data.word.sentence(prng, ctx);
  while (result.length < minLen) result += " " + data.word.sentence(prng, ctx);
  return result.length > maxLen ? result.slice(0, maxLen) : result;
}

// ---------------------------------------------------------------------------
// PrngGen — map value type
// ---------------------------------------------------------------------------

/** A generator that takes a Prng and an optional full context. */
export type PrngGen<T = unknown> = (prng: Prng, ctx?: GeneratorContext, schema?: ZodTypeAny) => T;

// ---------------------------------------------------------------------------
// DEFAULT_KEY_MAP
// ---------------------------------------------------------------------------

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as [string, ...string[]];

/**
 * Field-name aliases that all share the same length-aware text generator.
 * Built programmatically into DEFAULT_KEY_MAP below so the table reads as
 * data, not a literal copy per key.
 */
const TEXT_ALIASES = [
  "text",
  "description",
  "note",
  "summary",
  "comment",
  "body",
  "content",
  "message",
  // nl
  "omschrijving",
  "bericht",
] as const;

const textWithLength: PrngGen<string> = (p, ctx, schema) => {
  const { min, max } = resolveStringLength(schema, 0, Number.MAX_SAFE_INTEGER);
  return generateTextToLength(p, ctx, min, max);
};

export const DEFAULT_KEY_MAP: Record<string, Record<string, PrngGen> | undefined> = {
  string: {
    // Person
    firstname: data.person.firstName as PrngGen,
    first_name: data.person.firstName as PrngGen,
    lastname: data.person.lastName as PrngGen,
    last_name: data.person.lastName as PrngGen,
    surname: data.person.lastName as PrngGen,
    middlename: data.person.middleName as PrngGen,
    middle_name: data.person.middleName as PrngGen,
    fullname: data.person.fullName as PrngGen,
    full_name: data.person.fullName as PrngGen,
    name: data.person.fullName as PrngGen,
    prefix: data.person.prefix as PrngGen,
    suffix: data.person.suffix as PrngGen,
    bio: (p, ctx, schema) => {
      const { min, max } = resolveStringLength(schema, 0, Number.MAX_SAFE_INTEGER);
      let result = data.person.bio(p, ctx);
      while (result.length < min) result += " " + data.person.bio(p, ctx);
      return result.length > max ? result.slice(0, max) : result;
    },
    gender: data.person.gender as PrngGen,
    sex: data.person.sex as PrngGen,
    jobtitle: data.person.jobTitle as PrngGen,
    job_title: data.person.jobTitle as PrngGen,
    jobarea: data.person.jobArea as PrngGen,
    job_area: data.person.jobArea as PrngGen,
    jobtype: data.person.jobType as PrngGen,
    job_type: data.person.jobType as PrngGen,

    // Internet
    email: data.internet.email as PrngGen,
    example_email: data.internet.exampleEmail as PrngGen,
    username: data.internet.username as PrngGen,
    displayname: data.internet.displayName as PrngGen,
    display_name: data.internet.displayName as PrngGen,
    password: (p) => data.string.nanoid(p, 16),
    url: data.internet.url as PrngGen,
    website: data.internet.url as PrngGen,
    homepage: data.internet.url as PrngGen,
    ip: data.internet.ip as PrngGen,
    ipv4: data.internet.ipv4 as PrngGen,
    ipv6: data.internet.ipv6 as PrngGen,
    mac: data.internet.mac as PrngGen,
    useragent: data.internet.userAgent as PrngGen,
    user_agent: data.internet.userAgent as PrngGen,
    protocol: data.internet.protocol as PrngGen,
    domain: data.internet.domainName as PrngGen,
    domainname: data.internet.domainName as PrngGen,
    domain_name: data.internet.domainName as PrngGen,

    // Location
    city: data.location.city as PrngGen,
    country: data.location.country as PrngGen,
    countrycode: data.location.countryCode as PrngGen,
    country_code: data.location.countryCode as PrngGen,
    street: data.location.street as PrngGen,
    streetname: data.location.street as PrngGen,
    street_name: data.location.street as PrngGen,
    address: data.location.streetAddress as PrngGen,
    streetaddress: data.location.streetAddress as PrngGen,
    street_address: data.location.streetAddress as PrngGen,
    zipcode: data.location.zipCode as PrngGen,
    postalcode: data.location.zipCode as PrngGen,
    postal_code: data.location.zipCode as PrngGen,
    postcode: data.location.zipCode as PrngGen,
    state: data.location.state as PrngGen,
    county: data.location.county as PrngGen,
    timezone: data.location.timeZone as PrngGen,
    time_zone: data.location.timeZone as PrngGen,

    // Finance
    iban: data.finance.iban as PrngGen,
    bic: data.finance.bic as PrngGen,
    accountnumber: (p, _ctx, schema) => {
      const { min } = resolveStringLength(schema, 10, 10);
      return data.finance.accountNumber(p, min);
    },
    account_number: (p, _ctx, schema) => {
      const { min } = resolveStringLength(schema, 10, 10);
      return data.finance.accountNumber(p, min);
    },
    creditcard: (p, ctx) => data.finance.creditCardNumber(p, ctx),
    credit_card: (p, ctx) => data.finance.creditCardNumber(p, ctx),
    creditcardnumber: (p, ctx) => data.finance.creditCardNumber(p, ctx),
    credit_card_number: (p, ctx) => data.finance.creditCardNumber(p, ctx),
    currency: data.finance.currencyCode as PrngGen,
    currencycode: data.finance.currencyCode as PrngGen,
    currency_code: data.finance.currencyCode as PrngGen,
    bitcoin: data.finance.bitcoinAddress as PrngGen,
    ethereum: data.finance.ethereumAddress as PrngGen,

    // Commerce
    product: data.commerce.product as PrngGen,
    productname: data.commerce.productName as PrngGen,
    product_name: data.commerce.productName as PrngGen,
    isbn: data.commerce.isbn as PrngGen,
    upc: data.commerce.upc as PrngGen,
    department: data.commerce.department as PrngGen,
    material: data.commerce.productMaterial as PrngGen,
    price: (p, ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 500);
      return data.commerce.price(p, min, max, ctx);
    },
    prijs: (p, ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 500);
      return data.commerce.price(p, min, max, ctx);
    },
    sku: (p) => `${p.pick(LETTERS)}${p.pick(LETTERS)}-${p.int(1000, 9999)}`,

    // Company
    company: data.company.name as PrngGen,
    companyname: data.company.name as PrngGen,
    company_name: data.company.name as PrngGen,
    buzzword: data.company.buzzPhrase as PrngGen,
    catchphrase: data.company.catchPhrase as PrngGen,

    // Phone
    phone: data.phone.number as PrngGen,
    phonenumber: data.phone.number as PrngGen,
    phone_number: data.phone.number as PrngGen,
    telefoon: data.phone.number as PrngGen,
    imei: data.phone.imei as PrngGen,

    // Vehicle
    vin: data.vehicle.vin as PrngGen,
    vrm: data.vehicle.vrm as PrngGen,
    kenteken: data.vehicle.vrm as PrngGen,
    vehicle: data.vehicle.vehicle as PrngGen,
    manufacturer: data.vehicle.manufacturer as PrngGen,
    model: data.vehicle.model as PrngGen,
    vehiclecolor: data.vehicle.color as PrngGen,
    vehicle_color: data.vehicle.color as PrngGen,
    voertuigkleur: data.vehicle.color as PrngGen,
    fuel: data.vehicle.fuel as PrngGen,

    // Color (CSS/UI)
    color: data.color.colorName as PrngGen,
    colour: data.color.colorName as PrngGen,
    kleur: data.color.colorName as PrngGen,
    colorhex: data.color.colorHex as PrngGen,
    color_hex: data.color.colorHex as PrngGen,
    hexcolor: data.color.colorHex as PrngGen,
    hex_color: data.color.colorHex as PrngGen,
    backgroundcolor: data.color.colorHex as PrngGen,
    background_color: data.color.colorHex as PrngGen,
    textcolor: data.color.colorHex as PrngGen,
    text_color: data.color.colorHex as PrngGen,

    // System
    platform: data.system.platform as PrngGen,
    os: data.system.platform as PrngGen,
    operatingsystem: data.system.platform as PrngGen,
    operating_system: data.system.platform as PrngGen,
    browser: data.system.browser as PrngGen,
    semver: data.system.semver as PrngGen,
    version: data.system.semver as PrngGen,
    filename: data.system.fileName as PrngGen,
    file_name: data.system.fileName as PrngGen,
    filepath: data.system.filePath as PrngGen,
    file_path: data.system.filePath as PrngGen,
    extension: data.system.fileExtension as PrngGen,
    fileextension: data.system.fileExtension as PrngGen,
    file_extension: data.system.fileExtension as PrngGen,
    mimetype: data.system.mimeType as PrngGen,
    mime_type: data.system.mimeType as PrngGen,
    contenttype: data.system.mimeType as PrngGen,
    content_type: data.system.mimeType as PrngGen,

    // Word/Text
    word: data.word.noun as PrngGen,
    // text, description, note, summary, comment, body, content, message,
    // omschrijving, bericht — populated programmatically from TEXT_ALIASES
    // below (each shares the same length-aware closure).

    // Dutch names
    voornaam: data.person.firstName as PrngGen,
    achternaam: data.person.lastName as PrngGen,
    straat: data.location.street as PrngGen,
    stad: data.location.city as PrngGen,
    land: data.location.country as PrngGen,
  },
  number: {
    amount: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 10000);
      return data.finance.amount(p, min, max);
    },
    bedrag: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 10000);
      return data.finance.amount(p, min, max);
    },
    price: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 500);
      return data.finance.amount(p, min, max);
    },
    prijs: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 500);
      return data.finance.amount(p, min, max);
    },
    latitude: data.location.latitude as PrngGen,
    longitude: data.location.longitude as PrngGen,
    port: data.internet.port as PrngGen,
    quantity: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 100);
      return quantityGen(p, min, max);
    },
    count: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 0, 50);
      return countGen(p, min, max);
    },
    age: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 18, 80);
      return ageGen(p, min, max);
    },
    year: (p, _ctx, schema) => {
      const currentYear = new Date().getFullYear();
      const { min, max } = resolveNumberBounds(schema, currentYear - 50, currentYear);
      return yearGen(p, min, max);
    },

    // B57-R1: log-uniform money keys (Benford-conforming, 2-decimal).
    balance: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 100000);
      return data.finance.amount(p, min, max);
    },
    total: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 10000);
      return data.finance.amount(p, min, max);
    },
    subtotal: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 10000);
      return data.finance.amount(p, min, max);
    },
    revenue: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1000, 1e9);
      return data.finance.amount(p, min, max);
    },
    cost: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 1000);
      return data.finance.amount(p, min, max);
    },
    fee: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 1000);
      return data.finance.amount(p, min, max);
    },
    salary: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 20000, 500000);
      return data.finance.amount(p, min, max);
    },

    // B57-R1: log-uniform integer measurement keys (round after the draw).
    filesize: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 100, 1e9);
      return logUniformInt(p, min, max);
    },
    bytes: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 100, 1e9);
      return logUniformInt(p, min, max);
    },
    views: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 1e7);
      return logUniformInt(p, min, max);
    },
    population: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 1e7);
      return logUniformInt(p, min, max);
    },

    // B57-R1: log-uniform continuous measurement key.
    distance: (p, _ctx, schema) => {
      const { min, max } = resolveNumberBounds(schema, 1, 10000);
      return logUniformFloat(p, min, max);
    },

    // B57-R1: bounded-uniform shaped keys (semantic-meaningful default range).
    rating: (p, _ctx, schema) => {
      return generateNumberWithBounds(p, resolveNumberBounds(schema, 0, 5));
    },
    score: (p, _ctx, schema) => {
      return generateNumberWithBounds(p, resolveNumberBounds(schema, 0, 100));
    },
    percentage: (p, _ctx, schema) => {
      return generateNumberWithBounds(p, resolveNumberBounds(schema, 0, 100));
    },
  },
};

// Populate the length-aware text aliases programmatically — all share one
// closure, so listing them as data avoids ten near-identical literals.
{
  const stringMap = DEFAULT_KEY_MAP.string;
  if (stringMap !== undefined) {
    for (const k of TEXT_ALIASES) stringMap[k] = textWithLength;
  }
}

// ---------------------------------------------------------------------------
// DEFAULT_KEY_PATTERNS
// ---------------------------------------------------------------------------

export const DEFAULT_KEY_PATTERNS: Record<string, KeyPattern[]> = {
  string: [
    {
      test: (k) => k === "id" || k.endsWith("id") || k.endsWith("uuid") || k.endsWith("guid"),
      generate: data.string.uuid as PrngGen,
    },
    { test: (k) => k.endsWith("name"), generate: data.person.fullName as PrngGen },
    {
      test: (k) => k.endsWith("url") || k.endsWith("link") || k.startsWith("url"),
      generate: data.internet.url as PrngGen,
    },
    { test: (k) => k.endsWith("email"), generate: data.internet.email as PrngGen },
    {
      test: (k) =>
        k.endsWith("at") ||
        k.endsWith("date") ||
        k.startsWith("date") ||
        (k.endsWith("_on") && k !== "position"),
      generate: (p) => data.date.anytime(p).toISOString(),
    },
  ],
  date: [
    {
      test: (k) =>
        k.endsWith("at") ||
        k.endsWith("date") ||
        k.startsWith("date") ||
        (k.endsWith("_on") && k !== "position"),
      generate: data.date.anytime as PrngGen,
    },
  ],
  number: [
    {
      test: (k) =>
        k.endsWith("at") ||
        k.endsWith("date") ||
        k.startsWith("date") ||
        (k.endsWith("_on") && k !== "position"),
      generate: (p) => data.date.anytime(p).getTime(),
    },
  ],
};

/** A pattern rule: a key test function + a PrngGen generator. */
export type KeyPattern = { test: (key: string) => boolean; generate: PrngGen };

// ---------------------------------------------------------------------------
// generateFromKey
// ---------------------------------------------------------------------------

export function generateFromKey(key: string, schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const lk = key.toLowerCase();
  const schemaType = getLeafDef(schema).type;

  const fn = DEFAULT_KEY_MAP[schemaType]?.[lk];
  if (fn !== undefined) return fn(ctx.prng, ctx, schema);

  for (const p of DEFAULT_KEY_PATTERNS[schemaType] ?? []) {
    if (p.test(lk)) return p.generate(ctx.prng, ctx, schema);
  }

  return undefined;
}
