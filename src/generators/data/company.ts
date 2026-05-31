import type { Prng, GeneratorContext } from "../../types.js";
import { lastName } from "./person.js";
import { TECH_WORDS } from "./word.js";
import { defaultLocale } from "../../default-locale.js";

function pick<T extends string>(prng: Prng, arr: readonly T[]): T {
  return arr[Math.floor(prng.random() * arr.length)] as T;
}

export function name(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  const formats: [() => string, ...(() => string)[]] = [
    () => `${lastName(prng, ctx)} ${pick(prng, locale.company.suffixes)}`,
    () => `${lastName(prng, ctx)} & ${lastName(prng, ctx)}`,
    () => `${pick(prng, locale.company.prefixes)} ${lastName(prng, ctx)}`,
    () => {
      const w = prng.pick(TECH_WORDS);
      return `${w.charAt(0).toUpperCase() + w.slice(1)} ${pick(prng, locale.company.suffixes)}`;
    },
    () => `${pick(prng, locale.company.prefixes)}${pick(prng, locale.company.suffixes)}`,
  ];
  return prng.pick(formats)();
}

export function buzzAdjective(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).company.buzzAdjectives);
}

export function buzzNoun(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).company.buzzNouns);
}

export function buzzVerb(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).company.buzzVerbLemmas);
}

export function buzzPhrase(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  return locale.company.formatBuzzPhrase(
    buzzVerb(prng, ctx),
    buzzAdjective(prng, ctx),
    buzzNoun(prng, ctx),
  );
}

export function catchPhraseAdjective(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).company.catchPhraseAdjectives);
}

export function catchPhraseDescriptor(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).company.catchPhraseDescriptors);
}

export function catchPhraseNoun(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).company.catchPhraseNouns);
}

export function catchPhrase(prng: Prng, ctx?: GeneratorContext): string {
  return `${catchPhraseAdjective(prng, ctx)} ${catchPhraseDescriptor(prng, ctx)} ${catchPhraseNoun(prng, ctx)}`;
}
