import type { ZodTypeAny } from "zod";
import type { GeneratorContext } from "../../types.js";
import { def, checks } from "./zod-def.js";
import { generateFromSchema } from "./router.js";
import { toBase64 } from "../../utils/encoding.js";
import { TECH_WORDS } from "../data/word.js";
import { DOMAINS, EMOJIS } from "../data/internet.js";
import { LOWERCASE_ALPHANUM, URL_SAFE, ULID_BASE32 } from "../data/string.js";

const WORDS = TECH_WORDS;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

function generateUuid(prng: GeneratorContext["prng"]): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = prng.int(0, 15);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function generateEmail(prng: GeneratorContext["prng"]): string {
  const w1 = WORDS[prng.int(0, WORDS.length - 1)]!;
  const w2 = WORDS[prng.int(0, WORDS.length - 1)]!;
  const n = prng.int(10, 99);
  const domain = DOMAINS[prng.int(0, DOMAINS.length - 1)]!;
  return `${w1}.${w2}${n}@${domain}`;
}

export function generateString(
  prng: GeneratorContext["prng"],
  minLen: number,
  maxLen: number,
): string {
  const wordCount = prng.int(1, Math.max(1, Math.floor(maxLen / 5)));
  const words = Array.from({ length: wordCount }, () => WORDS[prng.int(0, WORDS.length - 1)]!);
  let result = words.join(" ");
  if (result.length > maxLen) result = result.slice(0, maxLen);
  if (result.length < minLen) result = result.padEnd(minLen, "x");
  return result;
}

function randomFrom(chars: string, len: number, prng: GeneratorContext["prng"]): string {
  return Array.from({ length: len }, () => chars[prng.int(0, chars.length - 1)]!).join("");
}

function generateCuid(prng: GeneratorContext["prng"]): string {
  return "c" + randomFrom(LOWERCASE_ALPHANUM, 24, prng);
}

function generateCuid2(prng: GeneratorContext["prng"]): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  return letters[prng.int(0, letters.length - 1)]! + randomFrom(LOWERCASE_ALPHANUM, 23, prng);
}

function generateUlid(prng: GeneratorContext["prng"]): string {
  return randomFrom(ULID_BASE32, 26, prng);
}

function generateNanoid(prng: GeneratorContext["prng"]): string {
  return randomFrom(URL_SAFE, 21, prng);
}

function generateBase64(prng: GeneratorContext["prng"]): string {
  const wordCount = prng.int(2, 5);
  const words = Array.from({ length: wordCount }, () => WORDS[prng.int(0, WORDS.length - 1)]!);
  return toBase64(words.join(" "));
}

function generateBase64url(prng: GeneratorContext["prng"]): string {
  return generateBase64(prng).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateJwt(prng: GeneratorContext["prng"]): string {
  const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
  const payload = generateBase64url(prng.fork("jwt-p"));
  const sig = generateBase64url(prng.fork("jwt-s"));
  return `${header}.${payload}.${sig}`;
}

function generateEmoji(prng: GeneratorContext["prng"]): string {
  return EMOJIS[prng.int(0, EMOJIS.length - 1)]!;
}

function generateE164(prng: GeneratorContext["prng"]): string {
  const country = prng.int(1, 9);
  const number = randomFrom("0123456789", 10, prng);
  return `+${country}${number}`;
}

function generateCidrv4(prng: GeneratorContext["prng"]): string {
  const a = prng.int(1, 254);
  const b = prng.int(0, 255);
  const c = prng.int(0, 255);
  const prefix = prng.int(0, 32);
  return `${a}.${b}.${c}.0/${prefix}`;
}

function generateCidrv6(prng: GeneratorContext["prng"]): string {
  const hex = (): string => prng.int(0, 0xffff).toString(16).padStart(4, "0");
  const prefix = prng.int(0, 128);
  return `${hex()}:${hex()}::/${prefix}`;
}

function generateIsoDate(prng: GeneratorContext["prng"]): string {
  const year = prng.int(2020, 2025);
  const month = prng.int(1, 12);
  const day = prng.int(1, 28);
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

function generateIsoTime(prng: GeneratorContext["prng"]): string {
  return `${pad2(prng.int(0, 23))}:${pad2(prng.int(0, 59))}:${pad2(prng.int(0, 59))}`;
}

function generateIsoDatetime(prng: GeneratorContext["prng"]): string {
  return `${generateIsoDate(prng)}T${generateIsoTime(prng)}Z`;
}

function generateIsoDuration(prng: GeneratorContext["prng"]): string {
  return `P${prng.int(0, 5)}Y${prng.int(0, 11)}M${prng.int(1, 28)}D`;
}

function generateHostname(prng: GeneratorContext["prng"]): string {
  const w = WORDS[prng.int(0, WORDS.length - 1)]!;
  const tld = ["com", "org", "net", "io", "dev"][prng.int(0, 4)]!;
  return `${w}.${tld}`;
}

function generateStringMatchingRegex(
  prng: GeneratorContext["prng"],
  pattern: RegExp | undefined,
): string {
  if (!pattern) return generateString(prng, 3, 10);
  const digitMatch = pattern.source.match(/^\^\\d\{(\d+)\}\$$/);
  if (digitMatch) return randomFrom("0123456789", parseInt(digitMatch[1]!, 10), prng);
  const literalMatch = pattern.source.match(/^\^([a-zA-Z0-9_-]{1,20})/);
  if (literalMatch) {
    const candidate = literalMatch[1]!;
    if (pattern.test(candidate)) return candidate;
  }
  for (const word of WORDS) {
    if (pattern.test(word)) return word;
  }
  return generateString(prng, 3, 10);
}

function resolveStringFormat(schema: ZodTypeAny): string | undefined {
  const d = def(schema);
  if (d.check === "string_format" && d.format) return d.format;
  for (const c of checks(schema)) {
    if (c.check === "string_format" && c.format) return c.format;
  }
  return undefined;
}

export function resolveStringLength(
  schema: ZodTypeAny | undefined,
  defaultMin = 3,
  defaultMax = 40,
): { min: number; max: number } {
  if (!schema) return { min: defaultMin, max: defaultMax };
  let min = defaultMin;
  let max = defaultMax;
  for (const c of checks(schema)) {
    if (c.check === "min_length") min = Math.max(min, c.minimum!);
    if (c.check === "max_length") max = Math.min(max, c.maximum!);
  }
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

export function generateZodString(schema: ZodTypeAny, ctx: GeneratorContext): string {
  const prng = ctx.prng;
  const format = resolveStringFormat(schema);

  let result = "";

  if (format === "email") result = generateEmail(prng);
  else if (format === "uuid") result = generateUuid(prng);
  else if (format === "url")
    result = `https://${generateHostname(prng)}/${generateString(prng, 3, 10).replace(/ /g, "-")}`;
  else if (format === "cuid") result = generateCuid(prng);
  else if (format === "cuid2") result = generateCuid2(prng);
  else if (format === "ulid") result = generateUlid(prng);
  else if (format === "nanoid") result = generateNanoid(prng);
  else if (format === "base64") result = generateBase64(prng);
  else if (format === "base64url") result = generateBase64url(prng);
  else if (format === "jwt") result = generateJwt(prng);
  else if (format === "emoji") result = generateEmoji(prng);
  else if (format === "e164") result = generateE164(prng);
  else if (format === "cidrv4") result = generateCidrv4(prng);
  else if (format === "cidrv6") result = generateCidrv6(prng);
  else if (format === "date") result = generateIsoDate(prng);
  else if (format === "time") result = generateIsoTime(prng);
  else if (format === "datetime") result = generateIsoDatetime(prng);
  else if (format === "duration") result = generateIsoDuration(prng);
  else if (format === "hostname") result = generateHostname(prng);
  else {
    let handled = false;
    for (const c of checks(schema)) {
      if (c.check !== "string_format") continue;
      if (c.format === "starts_with") {
        result = (c.prefix ?? "") + generateString(prng, 0, 8);
        handled = true;
        break;
      }
      if (c.format === "ends_with") {
        result = generateString(prng, 0, 8) + (c.suffix ?? "");
        handled = true;
        break;
      }
      if (c.format === "includes") {
        result = generateString(prng, 0, 4) + (c.includes ?? "") + generateString(prng, 0, 4);
        handled = true;
        break;
      }
      if (c.format === "regex") {
        result = generateStringMatchingRegex(prng, c.pattern);
        handled = true;
        break;
      }
    }
    if (!handled) {
      const { min, max } = resolveStringLength(schema);
      result = generateString(prng, min, max);
    }
  }

  for (const c of checks(schema)) {
    if (c.check === "toLowerCase") result = result.toLowerCase();
    if (c.check === "toUpperCase") result = result.toUpperCase();
    if (c.check === "trim") result = result.trim();
    if (c.check === "overwrite") {
      const tx = (c as unknown as { tx?: (v: string) => string }).tx;
      if (typeof tx === "function") result = tx(result);
    }
  }

  return result;
}

export function generateTemplateLiteral(schema: ZodTypeAny, ctx: GeneratorContext): string {
  // In Zod 4, z.templateLiteral is an array of types or strings?
  // It's often represented recursively, but since we don't know the exact def structure yet,
  // we'll try to guess based on schema._zod.def.items or .types
  const d = def(schema) as unknown as {
    types?: Array<ZodTypeAny | string>;
    items?: Array<ZodTypeAny | string>;
  };
  const parts = d.types ?? d.items ?? [];
  let result = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (typeof part === "string") {
      result += part;
    } else if (part !== undefined) {
      result += generateFromSchema(part, { ...ctx, prng: ctx.prng.fork(`tl-${i}`) });
    }
  }
  return result;
}
