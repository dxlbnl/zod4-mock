import type { Prng } from "../../types.js";

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

export function creditCardNumber(prng: Prng): string {
  const segments = Array.from({ length: 4 }, () => prng.int(1000, 9999));
  return segments.join("-");
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
