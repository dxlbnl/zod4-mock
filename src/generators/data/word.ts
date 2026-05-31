import type { Prng, GeneratorContext } from "../../types.js";
import { sampleMarkov } from "./markov/sample.js";
import { defaultLocale } from "../../default-locale.js";

// ---------------------------------------------------------------------------
// English/Technical Wordlist — kept for internet.ts and company.ts
// ---------------------------------------------------------------------------

export const TECH_WORDS = [
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
  "india",
  "juliet",
  "kilo",
  "lima",
  "mike",
  "november",
  "oscar",
  "papa",
  "quebec",
  "romeo",
  "sierra",
  "tango",
  "uniform",
  "victor",
  "whiskey",
  "xray",
  "yankee",
  "zulu",
  "apple",
  "banana",
  "cherry",
  "data",
  "engine",
  "frame",
  "graph",
  "handle",
  "image",
  "journey",
  "kernel",
  "layer",
  "module",
  "network",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function locPick(prng: Prng, arr: readonly string[]): string {
  return arr.length > 0 ? arr[Math.floor(prng.random() * arr.length)]! : "";
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Open-class word generators (Markov-sampled, locale-aware)
// ---------------------------------------------------------------------------

/**
 * Samples a noun from the active locale — uses the Markov model when present,
 * otherwise falls back to the locale's plain `nouns` array. Output is always
 * capitalized for consistency between Markov and array-based locales.
 */
export function noun(prng: Prng, ctx?: GeneratorContext): string {
  const w = (ctx?.locale ?? defaultLocale).word;
  return w.nounModel ? sampleMarkov(prng, w.nounModel) : cap(locPick(prng, w.nouns ?? []));
}

/** Alias for noun. */
export const word = noun;

/**
 * Samples an adjective from the active locale — Markov model when present,
 * otherwise the locale's plain `adjectives` array. Output is always capitalized.
 */
export function adjective(prng: Prng, ctx?: GeneratorContext): string {
  const w = (ctx?.locale ?? defaultLocale).word;
  return w.adjectiveModel
    ? sampleMarkov(prng, w.adjectiveModel)
    : cap(locPick(prng, w.adjectives ?? []));
}

// ---------------------------------------------------------------------------
// Closed-class word generators (locale arrays)
// ---------------------------------------------------------------------------

export function verb(prng: Prng, ctx?: GeneratorContext): string {
  return locPick(prng, (ctx?.locale ?? defaultLocale).word.verbs);
}

export function adverb(prng: Prng, ctx?: GeneratorContext): string {
  return locPick(prng, (ctx?.locale ?? defaultLocale).word.adverbs);
}

export function conjunction(prng: Prng, ctx?: GeneratorContext): string {
  return locPick(prng, (ctx?.locale ?? defaultLocale).word.conjunctions);
}

export function interjection(prng: Prng, ctx?: GeneratorContext): string {
  return locPick(prng, (ctx?.locale ?? defaultLocale).word.interjections);
}

export function preposition(prng: Prng, ctx?: GeneratorContext): string {
  return locPick(prng, (ctx?.locale ?? defaultLocale).word.prepositions);
}

// ---------------------------------------------------------------------------
// Multi-word / Structural Generators
// ---------------------------------------------------------------------------

/** Generates a list of space-separated nouns. */
export function words(prng: Prng, count = 3, ctx?: GeneratorContext): string {
  return Array.from({ length: count }, () => noun(prng, ctx)).join(" ");
}

/** Generates a grammatically structured sentence using the active locale. */
export function sentence(prng: Prng, ctx?: GeneratorContext): string {
  const loc = (ctx?.locale ?? defaultLocale).word;
  const art = (): string => locPick(prng, loc.articles);
  const pron = (): string => locPick(prng, loc.pronouns);
  const pre = (): string => locPick(prng, loc.prepositions);
  const vrb = (): string => locPick(prng, loc.verbs);
  const vrbp = (): string => locPick(prng, loc.verbsPlural);
  const conj = (): string => locPick(prng, loc.conjunctions);
  const adj = (): string => adjective(prng, ctx);
  const n = (): string => noun(prng, ctx);

  const templates: [() => string, ...(() => string)[]] = [
    // [Article] [Adjective] [Noun] [Verb] [Preposition] [Article] [Noun]
    () => `${cap(art())} ${adj()} ${n()} ${vrb()} ${pre()} ${art()} ${n()}.`,
    // [Pronoun] [Verb] [Article] [Adjective] [Noun]
    () => `${cap(pron())} ${vrb()} ${art()} ${adj()} ${n()}.`,
    // [Preposition] [Article] [Noun] [Verb] [Pronoun] [Article] [Noun]
    () => `${cap(pre())} ${art()} ${n()} ${vrb()} ${pron()} ${art()} ${n()}.`,
    // [Article] [Noun] [Verb] [Adjective] [Preposition] [Noun]
    () => `${cap(art())} ${n()} ${vrb()} ${adj()} ${pre()} ${n()}.`,
    // [Article] [Noun] [Conj] [Article] [Noun] [VerbPlural] [Preposition] [Article] [Noun]
    () => `${cap(art())} ${n()} ${conj()} ${art()} ${n()} ${vrbp()} ${pre()} ${art()} ${n()}.`,
  ];

  let res = prng.pick(templates)();
  // Ensure a reasonable minimum length (e.g. 15 chars) to pass schema constraints like min(10)
  while (res.length < 15) {
    res = res.replace(".", ` ${conj()} ${n()}.`);
  }
  return res;
}

/** Generates a paragraph of structured sentences. */
export function paragraph(prng: Prng, sentenceCount = 3, ctx?: GeneratorContext): string {
  return Array.from({ length: sentenceCount }, () => sentence(prng, ctx)).join(" ");
}

/** Alias for sentence or short paragraph. */
export function sample(prng: Prng, ctx?: GeneratorContext): string {
  return prng.random() < 0.5 ? sentence(prng, ctx) : paragraph(prng, 2, ctx);
}
