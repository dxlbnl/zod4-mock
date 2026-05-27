import type { Prng, GeneratorContext } from "../../types.js";
import { siblingString } from "./sibling.js";
import { defaultLocale } from "../../default-locale.js";

// Universal — not locale-dependent
const CARD_ISSUERS = ["Visa", "Mastercard", "American Express", "Discover", "Maestro", "Diners Club", "JCB"] as const;
const HEX_CHARS = "0123456789abcdef".split("") as [string, ...string[]];
const ALNUM_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789".split("") as [string, ...string[]];

function pick<T>(prng: Prng, arr: readonly T[]): T {
  return arr[Math.floor(prng.random() * arr.length)] as T;
}

export function amount(prng: Prng, min = 0, max = 1000): number {
  return parseFloat((prng.random() * (max - min) + min).toFixed(2));
}

export function currencyCode(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).finance.currencies).code;
}

export function currencyName(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).finance.currencies).name;
}

export function currencySymbol(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).finance.currencies).symbol;
}

export function currencyNumericCode(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).finance.currencies).numeric;
}

export function accountName(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).finance.accountNames);
}

export function accountNumber(prng: Prng, length = 10): string {
  return Array.from({ length }, () => prng.int(0, 9)).join("");
}

export function transactionType(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).finance.transactionTypes);
}

export function transactionDescription(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).finance.transactionDescriptions);
}

export function iban(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  const bank = pick(prng, locale.finance.bankCodes);
  return locale.finance.formatIban(prng, bank);
}

export function bic(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  const bank = pick(prng, locale.finance.bankCodes);
  const location = pick(prng, locale.finance.bicLocations);
  return `${bank}${locale.address.countryCode}${location}XXX`;
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
