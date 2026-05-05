import type { ZodTypeAny } from "zod";
import type { GeneratorContext, Prng } from "../../types.js";
import { def } from "../schema/zod-def.js";
import * as data from "./index.js";

// ---------------------------------------------------------------------------
// PrngGen — map value type
// ---------------------------------------------------------------------------

/** A generator that takes a Prng and an optional full context. */
export type PrngGen<T = unknown> = (prng: Prng, ctx?: GeneratorContext) => T;

// ---------------------------------------------------------------------------
// DEFAULT_KEY_MAP
// ---------------------------------------------------------------------------

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as [string, ...string[]];

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
    bio: data.person.bio as PrngGen,
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
    accountnumber: (p) => data.finance.accountNumber(p),
    account_number: (p) => data.finance.accountNumber(p),
    creditcard: data.finance.creditCardNumber as PrngGen,
    credit_card: data.finance.creditCardNumber as PrngGen,
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
    price: (p) => data.commerce.price(p),
    prijs: (p) => data.commerce.price(p),
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
    color: data.vehicle.color as PrngGen,
    fuel: data.vehicle.fuel as PrngGen,

    // Word/Text
    word: data.word.noun as PrngGen,
    text: data.word.sentence as PrngGen,
    description: (p) => data.word.paragraph(p),
    note: (p) => data.word.paragraph(p),
    summary: (p) => data.word.paragraph(p),
    comment: (p) => data.word.paragraph(p),
    body: (p) => data.word.paragraph(p),
    content: (p) => data.word.paragraph(p),
    message: (p) => data.word.paragraph(p),
    omschrijving: data.word.sentence as PrngGen,
    bericht: (p) => data.word.paragraph(p),

    // Dutch names
    voornaam: data.person.firstName as PrngGen,
    achternaam: data.person.lastName as PrngGen,
    straat: data.location.street as PrngGen,
    stad: data.location.city as PrngGen,
    land: data.location.country as PrngGen,
  },
  number: {
    amount: (p) => data.finance.amount(p, 1, 10000),
    bedrag: (p) => data.finance.amount(p, 1, 10000),
    price: (p) => data.finance.amount(p, 1, 500),
    prijs: (p) => data.finance.amount(p, 1, 500),
    latitude: data.location.latitude as PrngGen,
    longitude: data.location.longitude as PrngGen,
    port: data.internet.port as PrngGen,
    quantity: (p) => p.int(1, 100),
    count: (p) => p.int(0, 50),
    age: (p) => p.int(18, 90),
    year: (p) => p.int(1970, 2030),
  },
};

// ---------------------------------------------------------------------------
// DEFAULT_KEY_PATTERNS
// ---------------------------------------------------------------------------

export const DEFAULT_KEY_PATTERNS: { string: KeyPattern[]; any: KeyPattern[] } = {
  string: [
    { 
      test: (k) => k === "id" || k.endsWith("id") || k.endsWith("uuid") || k.endsWith("guid"), 
      generate: data.string.uuid as PrngGen
    },
    { test: (k) => k.endsWith("name"), generate: data.person.fullName as PrngGen },
    { test: (k) => k.endsWith("url") || k.endsWith("link") || k.startsWith("url"), generate: data.internet.url as PrngGen },
    { test: (k) => k.endsWith("email"), generate: data.internet.email as PrngGen },
  ],
  any: [
    { 
      // Only match 'on' if it's prefixed by something indicating a date (like 'at_on' or 'created_on')
      // and exclude common non-date 'on' suffixes like 'position'.
      test: (k) => k.endsWith("at") || k.endsWith("date") || k.startsWith("date") || (k.endsWith("_on") && k !== "position"), 
      generate: data.date.anytime as PrngGen 
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
  const schemaType = def(schema).type;

  const fn = DEFAULT_KEY_MAP[schemaType]?.[lk];
  if (fn !== undefined) return fn(ctx.prng, ctx);

  for (const p of (DEFAULT_KEY_PATTERNS as Record<string, KeyPattern[]>)[schemaType] ?? []) {
    if (p.test(lk)) return p.generate(ctx.prng, ctx);
  }

  for (const p of DEFAULT_KEY_PATTERNS.any) {
    if (p.test(lk)) return p.generate(ctx.prng, ctx);
  }

  return undefined;
}
