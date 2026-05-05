import type { Prng } from "../../types.js";
import { lastName } from "./person.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

const BUZZ_ADJECTIVES = [
  "Synergetisch",
  "Robuust",
  "Schaalbaar",
  "Gedistribueerd",
  "Naadloos",
  "Intuïtief",
  "Zakelijk",
] as const;
const BUZZ_NOUNS = [
  "Oplossingen",
  "Infrastructuur",
  "Paradigma's",
  "Architecturen",
  "Netwerken",
  "Platformen",
  "Ecosystemen",
] as const;
const BUZZ_VERBS = [
  "Stroomlijnen",
  "Optimaliseren",
  "Versterken",
  "Ontwrichten",
  "Benutten",
  "Verzilveren",
  "Schalen",
] as const;

const CATCH_PHRASE_ADJECTIVES = [
  "Klantgericht",
  "Gelaagd",
  "Upgradebaar",
  "Compatibel",
  "Hoogwaardig",
] as const;
const CATCH_PHRASE_DESCRIPTORS = [
  "optimaal",
  "24/7",
  "modulair",
  "gemonitord",
  "logistiek",
  "directioneel",
] as const;
const CATCH_PHRASE_NOUNS = [
  "vermogen",
  "benutting",
  "interface",
  "onvoorzien",
  "projectie",
  "succes",
] as const;

const COMPANY_SUFFIXES = ["Groep", "BV", "NV", "VOF", "Oplossingen", "en Zonen"] as const;
const COMPANY_PREFIXES = ["Globaal", "Quantum", "Cyber", "Bio", "Eco", "Toekomst"] as const;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function name(prng: Prng): string {
  const formats: [() => string, ...(() => string)[]] = [
    () => `${lastName(prng)} ${prng.pick(COMPANY_SUFFIXES)}`,
    () => `${lastName(prng)} & ${lastName(prng)}`,
    () => `${prng.pick(COMPANY_PREFIXES)} ${lastName(prng)}`,
    () => `${lastName(prng)} Systemen`,
  ];
  return prng.pick(formats)();
}

export function buzzAdjective(prng: Prng): string {
  return prng.pick(BUZZ_ADJECTIVES);
}

export function buzzNoun(prng: Prng): string {
  return prng.pick(BUZZ_NOUNS);
}

export function buzzVerb(prng: Prng): string {
  return prng.pick(BUZZ_VERBS);
}

export function buzzPhrase(prng: Prng): string {
  return `${buzzVerb(prng)} ${buzzAdjective(prng).toLowerCase()} ${buzzNoun(prng).toLowerCase()}`;
}

export function catchPhraseAdjective(prng: Prng): string {
  return prng.pick(CATCH_PHRASE_ADJECTIVES);
}

export function catchPhraseDescriptor(prng: Prng): string {
  return prng.pick(CATCH_PHRASE_DESCRIPTORS);
}

export function catchPhraseNoun(prng: Prng): string {
  return prng.pick(CATCH_PHRASE_NOUNS);
}

export function catchPhrase(prng: Prng): string {
  return `${catchPhraseAdjective(prng)} ${catchPhraseDescriptor(prng)} ${catchPhraseNoun(prng)}`;
}
