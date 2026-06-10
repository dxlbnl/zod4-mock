import type { Prng, GeneratorContext } from "../../types.js";
import { defaultLocale } from "../../default-locale.js";

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

function locPick(prng: Prng, arr: readonly string[]): string {
  return arr.length > 0 ? arr[Math.floor(prng.random() * arr.length)]! : "";
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function noun(prng: Prng, ctx?: GeneratorContext): string {
  const w = (ctx?.locale ?? defaultLocale).word;
  return cap(locPick(prng, w.nouns ?? []));
}

/** Alias for noun. */
export const word = noun;

export function adjective(prng: Prng, ctx?: GeneratorContext): string {
  const w = (ctx?.locale ?? defaultLocale).word;
  return cap(locPick(prng, w.adjectives ?? []));
}

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

/** Generates a list of space-separated nouns. */
export function words(prng: Prng, count = 3, ctx?: GeneratorContext): string {
  return Array.from({ length: count }, () => noun(prng, ctx)).join(" ");
}

// English object-form pronouns, inlined rather than a LocaleData field that
// every locale would have to populate for zero downstream gain.
const OBJECT_PRONOUNS = ["him", "her", "it", "them", "us", "me"] as const;

// Delegates to loc.formatSentence when present (locale-en owns the templates +
// inflection); otherwise the surface-form fallback below (for custom locales).
// The library MUST NOT import a locale package — delegation flows via the callback.
export function sentence(prng: Prng, ctx?: GeneratorContext): string {
  const loc = (ctx?.locale ?? defaultLocale).word;
  if (loc.formatSentence) {
    return loc.formatSentence(prng, ctx);
  }

  // Pick directly from the locale arrays (NOT the public adjective()/noun()
  // helpers, which capitalize) so mid-sentence words stay lowercase.
  const art = (): string => locPick(prng, loc.articles);
  const pron = (): string => locPick(prng, loc.pronouns);
  const pronObj = (): string => OBJECT_PRONOUNS[prng.int(0, OBJECT_PRONOUNS.length - 1)]!;
  const pre = (): string => locPick(prng, loc.prepositions);
  const vrb = (): string => locPick(prng, loc.verbs);
  const vrbp = (): string => locPick(prng, loc.verbsPlural);
  const conj = (): string => locPick(prng, loc.conjunctions);
  const adj = (): string => locPick(prng, loc.adjectives ?? []);
  const n = (): string => locPick(prng, loc.nouns ?? []);

  const templates: [() => string, ...(() => string)[]] = [
    () => `${cap(art())} ${adj()} ${n()} ${vrb()} ${pre()} ${art()} ${n()}.`,
    () => `${cap(pron())} ${vrb()} ${art()} ${adj()} ${n()}.`,
    () => `${cap(pre())} ${art()} ${n()} ${vrb()} ${pronObj()} ${art()} ${n()}.`,
    () => `${cap(art())} ${n()} ${vrb()} ${adj()} ${pre()} ${n()}.`,
    () => `${cap(art())} ${n()} ${conj()} ${art()} ${n()} ${vrbp()} ${pre()} ${art()} ${n()}.`,
  ];

  let res = prng.pick(templates)();
  // Minimum length so schema constraints like min(10) pass.
  while (res.length < 15) {
    res = res.replace(".", ` ${conj()} ${n()}.`);
  }
  return fixArticleAgreement(res);
}

// Templates pick the article independently of the following word, so fix a/an
// agreement here. First-letter heuristic only (sound-based "an honor" not handled).
function fixArticleAgreement(s: string): string {
  return s
    .replace(/\b([Aa])\s+([aeiouAEIOU])/g, "$1n $2") // add `n` before vowel
    .replace(/\b([Aa])n\s+([^aeiouAEIOU\s])/g, "$1 $2"); // drop `n` before consonant
}

/** Generates a paragraph of structured sentences. */
export function paragraph(prng: Prng, sentenceCount = 3, ctx?: GeneratorContext): string {
  return Array.from({ length: sentenceCount }, () => sentence(prng, ctx)).join(" ");
}

/** Alias for sentence or short paragraph. */
export function sample(prng: Prng, ctx?: GeneratorContext): string {
  return prng.random() < 0.5 ? sentence(prng, ctx) : paragraph(prng, 2, ctx);
}
