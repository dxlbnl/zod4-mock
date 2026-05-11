import type { Prng } from "../../types.js";

// ---------------------------------------------------------------------------
// Dutch-flavored Syllables (Phonemes)
// ---------------------------------------------------------------------------

const ONSETS = [
  "b",
  "d",
  "f",
  "g",
  "h",
  "k",
  "l",
  "m",
  "n",
  "p",
  "r",
  "s",
  "t",
  "v",
  "w",
  "z",
  "sch",
  "st",
  "sp",
  "tr",
  "kr",
  "pl",
  "bl",
  "fl",
  "sl",
] as const;
const NUCLEI = [
  "a",
  "e",
  "i",
  "o",
  "u",
  "aa",
  "ee",
  "oo",
  "uu",
  "ie",
  "oe",
  "eu",
  "ui",
  "ou",
  "ei",
  "ij",
] as const;
const CODAS = [
  "k",
  "l",
  "m",
  "n",
  "p",
  "r",
  "s",
  "t",
  "ng",
  "nk",
  "nt",
  "rt",
  "st",
  "cht",
] as const;

// ---------------------------------------------------------------------------
// Glue Words (Structural)
// ---------------------------------------------------------------------------

const ARTICLES = ["de", "het", "een"] as const;
const PRONOUNS = ["hij", "zij", "wij", "ik"] as const;
const PREPOSITIONS = ["in", "op", "van", "voor", "met", "naar", "door", "uit"] as const;
const VERBS = ["is", "heeft", "gaat", "doet", "maakt", "zegt", "ziet", "komt", "wordt"] as const;
const VERBS_PLURAL = [
  "zijn",
  "hebben",
  "gaan",
  "doen",
  "maken",
  "zeggen",
  "zien",
  "komen",
  "worden",
] as const;
const CONJUNCTIONS = ["en", "of", "maar", "want", "omdat"] as const;
const INTERJECTIONS = ["hé", "oh", "ja", "nee", "wouw", "ah"] as const;
const ADVERBS = ["snel", "vaak", "altijd", "nooit", "nu", "dan", "hier", "daar"] as const;

// ---------------------------------------------------------------------------
// Single Word Generators
// ---------------------------------------------------------------------------

/** Generates a Dutch-sounding nonsense word. */
export function noun(prng: Prng): string {
  const syllables = prng.random() < 0.4 ? 1 : 2;
  return generatePseudoWord(prng, syllables);
}

/** Alias for noun. */
export const word = noun;

/** Generates a Dutch-sounding adjective (often ends in -e). */
export function adjective(prng: Prng): string {
  const word = generatePseudoWord(prng, 1);
  return prng.random() < 0.8 ? word + "e" : word;
}

export function verb(prng: Prng): string {
  return prng.pick(VERBS);
}

export function adverb(prng: Prng): string {
  return prng.pick(ADVERBS);
}

export function conjunction(prng: Prng): string {
  return prng.pick(CONJUNCTIONS);
}

export function interjection(prng: Prng): string {
  return prng.pick(INTERJECTIONS);
}

export function preposition(prng: Prng): string {
  return prng.pick(PREPOSITIONS);
}

// ---------------------------------------------------------------------------
// Multi-word / Structural Generators
// ---------------------------------------------------------------------------

/** Generates a list of random pseudo-words. */
export function words(prng: Prng, count = 3): string {
  return Array.from({ length: count }, () => noun(prng)).join(" ");
}

/** Generates a grammatically structured pseudo-sentence. */
export function sentence(prng: Prng): string {
  const templates: [() => string, ...(() => string)[]] = [
    // [Article] [Adjective] [Noun] [Verb] [Preposition] [Article] [Noun]
    () =>
      `${capitalize(prng.pick(ARTICLES))} ${adjective(prng)} ${noun(prng)} ${prng.pick(VERBS)} ${prng.pick(PREPOSITIONS)} ${prng.pick(ARTICLES)} ${noun(prng)}.`,
    // [Pronoun] [Verb] [Article] [Adjective] [Noun]
    () =>
      `${capitalize(prng.pick(PRONOUNS))} ${prng.pick(VERBS)} ${prng.pick(ARTICLES)} ${adjective(prng)} ${noun(prng)}.`,
    // [Preposition] [Article] [Noun] [Verb] [Pronoun] [Article] [Noun]
    () =>
      `${capitalize(prng.pick(PREPOSITIONS))} ${prng.pick(ARTICLES)} ${noun(prng)} ${prng.pick(VERBS)} ${prng.pick(PRONOUNS)} ${prng.pick(ARTICLES)} ${noun(prng)}.`,
    // [Article] [Noun] [Verb] [Adjective] [Preposition] [Noun]
    () =>
      `${capitalize(prng.pick(ARTICLES))} ${noun(prng)} ${prng.pick(VERBS)} ${adjective(prng)} ${prng.pick(PREPOSITIONS)} ${noun(prng)}.`,
    // [Article] [Noun] en [Article] [Noun] [VerbPlural] [Preposition] [Article] [Noun]
    () =>
      `${capitalize(prng.pick(ARTICLES))} ${noun(prng)} en ${prng.pick(ARTICLES)} ${noun(prng)} ${prng.pick(VERBS_PLURAL)} ${prng.pick(PREPOSITIONS)} ${prng.pick(ARTICLES)} ${noun(prng)}.`,
  ];

  let res = prng.pick(templates)();
  // Ensure a reasonable minimum length (e.g. 15 chars) to pass schema constraints like min(10)
  while (res.length < 15) {
    res = res.replace(".", ` ${prng.pick(CONJUNCTIONS)} ${noun(prng)}.`);
  }
  return res;
}

/** Generates a paragraph of structured pseudo-sentences. */
export function paragraph(prng: Prng, sentenceCount = 3): string {
  return Array.from({ length: sentenceCount }, () => sentence(prng)).join(" ");
}

/** Alias for sentence or short paragraph. */
export function sample(prng: Prng): string {
  return prng.random() < 0.5 ? sentence(prng) : paragraph(prng, 2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generatePseudoWord(prng: Prng, syllables: number): string {
  let word = "";
  for (let i = 0; i < syllables; i++) {
    const onset = prng.random() < 0.8 ? prng.pick(ONSETS) : "";
    const nucleus = prng.pick(NUCLEI);
    const coda = prng.random() < 0.6 ? prng.pick(CODAS) : "";
    word += onset + nucleus + coda;
  }
  return word;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
