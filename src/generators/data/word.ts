import type { Prng, GeneratorContext } from "../../types.js";
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
// Open-class word generators (locale-aware)
// ---------------------------------------------------------------------------

/**
 * Samples a noun from the active locale by picking uniformly at random from
 * the locale's `nouns` array. Output is always capitalized.
 */
export function noun(prng: Prng, ctx?: GeneratorContext): string {
  const w = (ctx?.locale ?? defaultLocale).word;
  return cap(locPick(prng, w.nouns ?? []));
}

/** Alias for noun. */
export const word = noun;

/**
 * Samples an adjective from the active locale by picking uniformly at random
 * from the locale's `adjectives` array. Output is always capitalized.
 */
export function adjective(prng: Prng, ctx?: GeneratorContext): string {
  const w = (ctx?.locale ?? defaultLocale).word;
  return cap(locPick(prng, w.adjectives ?? []));
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

/**
 * Generates a grammatically structured sentence using the active locale.
 *
 * Delegates to `loc.formatSentence` when the active locale defines it
 * (locale-en's implementation owns the 5 English templates + 3ps inflection
 * + Template 2 pronoun constraint). When absent, falls back to the
 * back-compat 5-template surface-form path against `loc.verbs` /
 * `loc.verbsPlural` (kept for custom `LocaleData` literals and tests).
 *
 * The library MUST NOT import from any locale package — delegation flows
 * solely through the typed callback.
 */
export function sentence(prng: Prng, ctx?: GeneratorContext): string {
  const loc = (ctx?.locale ?? defaultLocale).word;
  if (loc.formatSentence) {
    return loc.formatSentence(prng, ctx);
  }

  // Back-compat fallback: surface-form templates against `verbs` /
  // `verbsPlural`. No inflection applied here — that's the locale callback's
  // responsibility.
  //
  // Pick adjectives/nouns directly from the locale arrays (NOT via the
  // public `adjective()`/`noun()` helpers, which always capitalize their
  // output for top-level callers). Mid-sentence words stay lowercase; only
  // the leading template token gets `cap(...)` applied below.
  const art = (): string => locPick(prng, loc.articles);
  const pron = (): string => locPick(prng, loc.pronouns);
  const pre = (): string => locPick(prng, loc.prepositions);
  const vrb = (): string => locPick(prng, loc.verbs);
  const vrbp = (): string => locPick(prng, loc.verbsPlural);
  const conj = (): string => locPick(prng, loc.conjunctions);
  const adj = (): string => locPick(prng, loc.adjectives ?? []);
  const n = (): string => locPick(prng, loc.nouns ?? []);

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
  return fixArticleAgreement(res);
}

/**
 * Post-pass repair for English `a` / `an` agreement. Templates pick the
 * article independently of the noun/adjective that follows, so the choice is
 * wrong half the time ("An result" / "A item"). This regex pass corrects both
 * directions and works on either case (`A` / `a`). Sound-based exceptions
 * like "an honor" / "a university" are rare in mock-data output and are not
 * handled — first-letter heuristic is a 90%-good approximation.
 */
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
