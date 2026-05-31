import type { Prng, GeneratorContext } from "../../types.js";
import { siblingString } from "./sibling.js";
import { defaultLocale } from "../../default-locale.js";

// Universal — not locale-dependent
const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Gender = "male" | "female" | "neutral" | string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractGender(gOrCtx?: Gender | GeneratorContext): "male" | "female" | "neutral" {
  if (!gOrCtx) return "neutral";
  if (typeof gOrCtx === "object") {
    const ctx: GeneratorContext = gOrCtx;
    return normalizeGender(siblingString(ctx, "gender", "geslacht", "sex", "sekse"));
  }
  return normalizeGender(gOrCtx);
}

function normalizeGender(g?: string): "male" | "female" | "neutral" {
  if (!g) return "neutral";
  const l = g.toLowerCase();
  if (l === "male" || l === "man" || l === "m") return "male";
  if (l === "female" || l === "vrouw" || l === "f" || l === "w") return "female";
  return "neutral";
}

function pick<T extends string>(prng: Prng, arr: readonly T[]): T {
  return arr[Math.floor(prng.random() * arr.length)] as T;
}

/**
 * Samples one entry from a name pool with `prng.pick`. Empty / missing pool
 * returns the "Unknown" sentinel; this preserves a structured fallback for
 * locales that do not populate the relevant pool.
 */
function sampleName(prng: Prng, pool: readonly string[] | undefined): string {
  if (pool && pool.length > 0) return pick(prng, pool);
  return "Unknown";
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function firstName(prng: Prng, genderOrCtx?: Gender | GeneratorContext): string {
  const ctx = typeof genderOrCtx === "object" ? genderOrCtx : undefined;
  const g = extractGender(genderOrCtx);
  const p = (ctx?.locale ?? defaultLocale).person;
  const male = (): string => sampleName(prng, p.firstNamesMale);
  const female = (): string => sampleName(prng, p.firstNamesFemale);
  if (g === "male") return male();
  if (g === "female") return female();
  return prng.random() < 0.5 ? male() : female();
}

export function lastName(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  const stem = sampleName(prng, locale.person.lastNames);
  const pfxList = locale.person.lastNamePrefixes;
  if (!pfxList || pfxList.length === 0) return stem;
  // Decide the prefix on an independent fork so the leaf `lastName` call
  // consumes exactly one draw from the caller's PRNG (B48-R7). Forking does
  // not consume parent state (see src/prng.ts:112-116), so the prefix
  // decision stays deterministic per (seed, "lastNamePrefix") without
  // disturbing sibling generators that share the parent counter.
  const prefixPrng = prng.fork("lastNamePrefix");
  // Weight "no prefix" at 100, then select proportionally
  const prefixTotal = pfxList.reduce((s: number, p) => s + p.weight, 0);
  const r = prefixPrng.random() * (prefixTotal + 100);
  if (r >= prefixTotal) return stem;
  let cum = 0;
  for (const { prefix: pfx, weight } of pfxList) {
    cum += weight;
    // Capitalize prefix for standalone use ("De Jong"); formatFullName can
    // lowercase it for full-name context ("Jan de Jong").
    if (r < cum) return `${pfx.charAt(0).toUpperCase() + pfx.slice(1)} ${stem}`;
  }
  return stem;
}

export function middleName(prng: Prng, genderOrCtx?: Gender | GeneratorContext): string {
  return firstName(prng, genderOrCtx);
}

export function fullName(prng: Prng, genderOrCtx?: Gender | GeneratorContext): string {
  const ctx = typeof genderOrCtx === "object" ? genderOrCtx : undefined;
  return `${firstName(prng, genderOrCtx)} ${lastName(prng, ctx)}`;
}

export function prefix(prng: Prng, genderOrCtx?: Gender | GeneratorContext): string {
  const ctx = typeof genderOrCtx === "object" ? genderOrCtx : undefined;
  const g = extractGender(genderOrCtx);
  const locale = ctx?.locale ?? defaultLocale;
  if (g === "male") return pick(prng, locale.person.prefixes.male);
  if (g === "female") return pick(prng, locale.person.prefixes.female);
  return pick(prng, locale.person.prefixes.neutral);
}

export function suffix(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).person.suffixes);
}

export function jobTitle(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).person.jobTitles);
}

export function jobArea(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).person.jobAreas);
}

export function jobType(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).person.jobTypes);
}

export function jobDescriptor(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).person.jobDescriptors);
}

export function gender(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).person.genders);
}

const SEX_TYPES = ["Male", "Female"] as const;

export function sex(prng: Prng): string {
  return prng.pick(SEX_TYPES);
}

export function sexType(prng: Prng): string {
  return prng.pick(SEX_TYPES);
}

export function zodiacSign(prng: Prng): string {
  return prng.pick(ZODIAC_SIGNS);
}

export function bio(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  const title =
    siblingString(ctx, "jobTitle", "job_title", "jobtitle", "functie") ?? jobTitle(prng, ctx);
  const area =
    siblingString(ctx, "jobArea", "job_area", "jobarea", "afdeling") ?? jobArea(prng, ctx);
  const type = siblingString(ctx, "jobType", "job_type", "jobtype") ?? "";
  return locale.person.formatBio(prng, { jobTitle: title, jobArea: area, jobType: type });
}
