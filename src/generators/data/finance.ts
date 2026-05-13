import type { Prng, GeneratorContext } from "../../types.js";
import { siblingString } from "./sibling.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

interface Currency {
  code: string;
  name: string;
  symbol: string;
  numeric: string;
}
const CURRENCIES: [Currency, ...Currency[]] = [
  { code: "EUR", name: "Euro", symbol: "€", numeric: "978" },
  { code: "USD", name: "Amerikaanse Dollar", symbol: "$", numeric: "840" },
  { code: "GBP", name: "Britse Pond", symbol: "£", numeric: "826" },
  { code: "JPY", name: "Japanse Yen", symbol: "¥", numeric: "392" },
  { code: "CHF", name: "Zwitserse Frank", symbol: "CHF", numeric: "756" },
  { code: "CAD", name: "Canadese Dollar", symbol: "C$", numeric: "124" },
  { code: "AUD", name: "Australische Dollar", symbol: "A$", numeric: "036" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", numeric: "156" },
  { code: "SEK", name: "Zweedse Kroon", symbol: "kr", numeric: "752" },
  { code: "NZD", name: "Nieuw-Zeelandse Dollar", symbol: "NZ$", numeric: "554" },
];

const TRANSACTION_TYPES = ["storting", "opname", "betaling", "factuur", "restitutie", "overschrijving", "incasso", "salaris", "rente", "dividend"] as const;

const ACCOUNT_NAMES = [
  "Spaarrekening",
  "Betaalrekening",
  "Zakelijke Rekening",
  "Creditcard",
  "Beleggingsportefeuille",
  "Gezamenlijke Rekening",
  "Pensioenrekening",
  "Kinderrekening",
  "Lopend Krediet",
  "Hypotheek"
] as const;

const TRANSACTION_DESCRIPTIONS = [
  "Supermarkt",
  "Maandelijkse huur",
  "Salaris",
  "Online winkelen",
  "Tankstation",
  "Restaurant rekening",
  "Abonnement",
  "Koffiebar",
  "Verzekeringspremie",
  "Energiebelasting",
  "Kledingwinkel",
  "Sportschool",
  "Streamingdienst",
  "Apotheek",
  "Boekwinkel"
] as const;

const BANK_CODES = ["ABNA", "INGB", "RABO", "SNSB", "TRIO", "KNAB", "BUNQ", "ASNB", "AEGO", "NNBA"] as const;

const BIC_LOCATIONS = ["2U", "33", "88", "2A", "9A", "21"] as const;

const CARD_ISSUERS = ["Visa", "Mastercard", "American Express", "Discover", "Maestro", "Diners Club", "JCB"] as const;

const HEX_CHARS = "0123456789abcdef".split("") as [string, ...string[]];
const ALNUM_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789".split("") as [string, ...string[]];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function amount(prng: Prng, min = 0, max = 1000): number {
  return parseFloat((prng.random() * (max - min) + min).toFixed(2));
}

export function currencyCode(prng: Prng): string {
  return prng.pick(CURRENCIES).code;
}

export function currencyName(prng: Prng): string {
  return prng.pick(CURRENCIES).name;
}

export function currencySymbol(prng: Prng): string {
  return prng.pick(CURRENCIES).symbol;
}

export function currencyNumericCode(prng: Prng): string {
  return prng.pick(CURRENCIES).numeric;
}

export function accountName(prng: Prng): string {
  return prng.pick(ACCOUNT_NAMES);
}

export function accountNumber(prng: Prng, length = 10): string {
  return Array.from({ length }, () => prng.int(0, 9)).join("");
}

export function transactionType(prng: Prng): string {
  return prng.pick(TRANSACTION_TYPES);
}

export function transactionDescription(prng: Prng): string {
  return prng.pick(TRANSACTION_DESCRIPTIONS);
}

export function iban(prng: Prng): string {
  const country = "NL";
  const checksum = prng.int(10, 99);
  const bank = prng.pick(BANK_CODES);
  const account = accountNumber(prng, 10);
  return `${country}${checksum}${bank}${account}`;
}

export function bic(prng: Prng): string {
  const bank = prng.pick(BANK_CODES);
  const country = "NL";
  const location = prng.pick(BIC_LOCATIONS);
  return `${bank}${country}${location}XXX`;
}

type BinSpec = { prefixes: readonly [string, ...string[]]; digits: number };

const CARD_BINS: Readonly<Record<string, BinSpec>> = {
  "Visa":             { prefixes: ["4"],                           digits: 16 },
  "Mastercard":       { prefixes: ["51","52","53","54","55"],      digits: 16 },
  "American Express": { prefixes: ["34","37"],                     digits: 15 },
  "Discover":         { prefixes: ["6011"],                        digits: 16 },
  "Maestro":          { prefixes: ["5018","6304","6759","6761"],   digits: 16 },
  "Diners Club":      { prefixes: ["36"],                          digits: 14 },
  "JCB":              { prefixes: ["3528","3540","3560","3589"],   digits: 16 },
};

function formatCardDigits(digits: string): string {
  if (digits.length === 15) return `${digits.slice(0,4)}-${digits.slice(4,10)}-${digits.slice(10)}`;
  if (digits.length === 14) return `${digits.slice(0,4)}-${digits.slice(4,10)}-${digits.slice(10)}`;
  return `${digits.slice(0,4)}-${digits.slice(4,8)}-${digits.slice(8,12)}-${digits.slice(12)}`;
}

export function creditCardNumber(prng: Prng, ctx?: GeneratorContext): string {
  const issuer = siblingString(ctx, "creditCardIssuer", "credit_card_issuer", "cardIssuer", "issuer", "kaarttype");
  const spec = issuer !== undefined ? CARD_BINS[issuer] : undefined;
  if (spec) {
    const prefix = prng.pick(spec.prefixes);
    const rest = Array.from({ length: spec.digits - prefix.length }, () => prng.int(0, 9)).join("");
    return formatCardDigits(prefix + rest);
  }
  const digits = "4" + Array.from({ length: 15 }, () => prng.int(0, 9)).join("");
  return formatCardDigits(digits);
}

export function creditCardCVV(prng: Prng): string {
  return prng.int(100, 999).toString();
}

export function creditCardIssuer(prng: Prng): string {
  return prng.pick(CARD_ISSUERS);
}

export function pin(prng: Prng, length = 4): string {
  return Array.from({ length }, () => prng.int(0, 9)).join("");
}

export function routingNumber(prng: Prng): string {
  return Array.from({ length: 9 }, () => prng.int(0, 9)).join("");
}

export function bitcoinAddress(prng: Prng): string {
  return "1" + Array.from({ length: 33 }, () => prng.pick(ALNUM_CHARS)).join("");
}

export function ethereumAddress(prng: Prng): string {
  return "0x" + Array.from({ length: 40 }, () => prng.pick(HEX_CHARS)).join("");
}

export function litecoinAddress(prng: Prng): string {
  return "L" + Array.from({ length: 33 }, () => prng.pick(ALNUM_CHARS)).join("");
}
