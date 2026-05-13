import type { Prng, GeneratorContext } from "../../types.js";
import { siblingString } from "./sibling.js";
import { sampleWeighted } from "./markov/sample.js";
import { en } from "../../locales/en.js";

// ---------------------------------------------------------------------------
// Datasets (static, not locale-dependent)
// ---------------------------------------------------------------------------

const JOB_TITLES = [
  "Developer", "Engineer", "Manager", "Designer", "Architect", "Consultant", "Specialist", "Analyst", "Coordinator",
  "Director", "Executive", "Advisor", "Researcher", "Administrator", "Inspector", "Instructor", "Editor", "Associate",
] as const;
const JOB_AREAS = [
  "Engineering", "Product", "Design", "Data", "Security", "Marketing", "Sales", "Finance", "Operations", "Legal", "HR",
  "Customer Service", "Logistics", "Communications", "R&D", "Quality Assurance", "Procurement", "Administration",
] as const;
const JOB_TYPES = ["Lead", "Senior", "Junior", "Head", "Assistant", "Director", "Intern", "Interim", "Freelance", "Trainee"] as const;
const JOB_DESCRIPTORS = ["Innovative", "Global", "Central", "Direct", "Strategic", "Operational", "Dynamic", "Regional", "International", "Corporate"] as const;

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
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

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function firstName(prng: Prng, genderOrCtx?: Gender | GeneratorContext): string {
  const ctx = typeof genderOrCtx === "object" ? genderOrCtx : undefined;
  const g = extractGender(genderOrCtx);
  const locale = ctx?.locale ?? en;
  if (g === "male")   return sampleWeighted(prng, locale.person.firstNamesMale);
  if (g === "female") return sampleWeighted(prng, locale.person.firstNamesFemale);
  return prng.random() < 0.5
    ? sampleWeighted(prng, locale.person.firstNamesMale)
    : sampleWeighted(prng, locale.person.firstNamesFemale);
}

export function lastName(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? en;
  const stem = sampleWeighted(prng, locale.person.lastNames);
  const pfxList = locale.person.lastNamePrefixes;
  if (!pfxList || pfxList.length === 0) return stem;
  // Weight "no prefix" at 100, then select proportionally
  const prefixTotal = pfxList.reduce((s, p) => s + p.weight, 0);
  const r = prng.random() * (prefixTotal + 100);
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
  const locale = ctx?.locale ?? en;
  if (g === "male")   return pick(prng, locale.person.prefixes.male);
  if (g === "female") return pick(prng, locale.person.prefixes.female);
  return pick(prng, locale.person.prefixes.neutral);
}

export function suffix(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? en).person.suffixes);
}

export function jobTitle(prng: Prng): string {
  return prng.pick(JOB_TITLES);
}

export function jobArea(prng: Prng): string {
  return prng.pick(JOB_AREAS);
}

export function jobType(prng: Prng): string {
  return prng.pick(JOB_TYPES);
}

export function jobDescriptor(prng: Prng): string {
  return prng.pick(JOB_DESCRIPTORS);
}

export function gender(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? en).person.genders);
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
  const title = siblingString(ctx, "jobTitle", "job_title", "jobtitle", "functie");
  const area  = siblingString(ctx, "jobArea",  "job_area",  "jobarea",  "afdeling");
  const type  = siblingString(ctx, "jobType",  "job_type",  "jobtype");

  const t  = (title ?? jobTitle(prng)).toLowerCase();
  const a  = (area  ?? jobArea(prng)).toLowerCase();
  const ty = type?.toLowerCase() ?? "";

  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

  const templates: [() => string, ...Array<() => string>] = [
    () => cap(`${ty ? ty + " " : ""}${t} specializing in ${a}.`),
    () => `Working as ${ty ? ty + " " : ""}${t} in ${a}.`,
    () => cap(`${ty ? ty + " " : ""}${t} with a passion for ${a}.`),
  ];
  return prng.pick(templates)();
}
