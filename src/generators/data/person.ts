import type { Prng, GeneratorContext } from "../../types.js";
import { sentence } from "./word.js";
import { siblingString } from "./sibling.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

const FIRST_NAMES_MALE = [
  "Jan", "Piet", "Klaas", "Hans", "Dirk", "Erik", "Tom", "Sven", "Luc", "Bas", "Thijs", "Bram", "Luuk", "Lars", "Stijn", "Gijs", "Sem", "Daan", "Finn", "Willem",
  "Milan", "Levi", "Lucas", "Noah", "Jesse", "Max", "Ruben", "Mees", "Sam", "Guus", "Julian", "Tim", "Koen", "Teun", "Jens", "Hugo", "Roel", "Floris", "Joris", "Mark"
] as const;

const FIRST_NAMES_FEMALE = [
  "Marie", "Anna", "Lisa", "Emma", "Sara", "Lena", "Nora", "Eva", "Julia", "Inge", "Lieke", "Noa", "Lotte", "Fleur", "Tess", "Mila", "Sanne", "Sophie", "Roos", "Isa",
  "Zoë", "Evi", "Maud", "Lynn", "Yara", "Liv", "Sarah", "Nina", "Suze", "Fenny", "Sofie", "Fenna", "Bo", "Luna", "Feline", "Milou", "Lauren", "Vera", "Anne", "Laura"
] as const;

const FIRST_NAMES_ALL = [...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE] as const;

const LAST_NAMES = [
  "de Vries", "Janssen", "Bakker", "Visser", "Smit", "Meijer", "Peters", "van den Berg", "Dekker", "Vermeer", "Brouwer", "Hendriks", "Kuiper", "Willems", "van der Linden", "Mulder", "de Jong", "de Groot", "Bos", "Vos", "van Dijk", "Postma", "Dijkstra",
  "Veenstra", "Zijlstra", "Hoekstra", "Jansen", "Peeters", "Jacobs", "Maas", "Hermans", "Willemse", "Gerritsen", "Smits", "van de Ven", "van der Heijden", "Evers", "Kuipers", "Prins", "Timmermans", "Verhoeven", "van Dongen", "Schouten"
] as const;

const JOB_TITLES = [
  "Ontwikkelaar", "Ingenieur", "Manager", "Ontwerper", "Architect", "Consultant", "Specialist", "Analist", "Coördinator",
  "Directeur", "Uitvoerder", "Adviseur", "Onderzoeker", "Beheerder", "Inspecteur", "Docent", "Redacteur", "Medewerker"
] as const;
const JOB_AREAS = [
  "Techniek", "Product", "Ontwerp", "Data", "Beveiliging", "Marketing", "Verkoop", "Financiën", "Operations", "Juridisch", "HR",
  "Klantenservice", "Logistiek", "Communicatie", "R&D", "Kwaliteitszorg", "Inkoop", "Administratie"
] as const;
const JOB_TYPES = ["Lead", "Senior", "Junior", "Hoofd", "Assistent", "Directeur", "Stagiair", "Interim", "Freelance", "Trainee"] as const;
const JOB_DESCRIPTORS = ["Innovatief", "Globaal", "Centraal", "Direct", "Strategisch", "Operationeel", "Dynamisch", "Regionaal", "Internationaal", "Corporate"] as const;

const PREFIXES_MALE = ["Dhr.", "Dr.", "Prof."] as const;
const PREFIXES_FEMALE = ["Mevr.", "Dr.", "Prof."] as const;
const SUFFIXES = ["Jr.", "Sr.", "III"] as const;

const GENDERS = ["Man", "Vrouw", "Non-binair", "Anders"] as const;
const SEX_TYPES = ["Man", "Vrouw"] as const;

const ZODIAC_SIGNS = [
  "Ram",
  "Stier",
  "Tweelingen",
  "Kreeft",
  "Leeuw",
  "Maagd",
  "Weegschaal",
  "Schorpioen",
  "Boogschutter",
  "Steenbok",
  "Waterman",
  "Vissen",
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

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function firstName(prng: Prng, genderOrCtx?: Gender | GeneratorContext): string {
  const g = extractGender(genderOrCtx);
  if (g === "male") return prng.pick(FIRST_NAMES_MALE);
  if (g === "female") return prng.pick(FIRST_NAMES_FEMALE);
  return prng.pick(FIRST_NAMES_ALL);
}

export function lastName(prng: Prng): string {
  return prng.pick(LAST_NAMES);
}

export function middleName(prng: Prng, genderOrCtx?: Gender | GeneratorContext): string {
  return firstName(prng, genderOrCtx);
}

export function fullName(prng: Prng, genderOrCtx?: Gender | GeneratorContext): string {
  return `${firstName(prng, genderOrCtx)} ${lastName(prng)}`;
}

const PREFIXES_ALL = [...PREFIXES_MALE, ...PREFIXES_FEMALE] as const;

export function prefix(prng: Prng, genderOrCtx?: Gender | GeneratorContext): string {
  const g = extractGender(genderOrCtx);
  if (g === "male") return prng.pick(PREFIXES_MALE);
  if (g === "female") return prng.pick(PREFIXES_FEMALE);
  return prng.pick(PREFIXES_ALL);
}

export function suffix(prng: Prng): string {
  return prng.pick(SUFFIXES);
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

export function gender(prng: Prng): string {
  return prng.pick(GENDERS);
}

export function sex(prng: Prng): string {
  return prng.pick(SEX_TYPES);
}

export function sexType(prng: Prng): string {
  return prng.pick(SEX_TYPES);
}

export function zodiacSign(prng: Prng): string {
  return prng.pick(ZODIAC_SIGNS);
}

export function bio(prng: Prng): string {
  return sentence(prng);
}
