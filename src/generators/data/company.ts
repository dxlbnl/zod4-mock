import type { Prng } from "../../types.js";
import { lastName } from "./person.js";
import { TECH_WORDS } from "./word.js";

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
  "Agile",
  "Dynamisch",
  "Innovatief",
  "Proactief",
  "Interactief",
  "Responsief",
  "Flexibel",
  "Toekomstbestendig",
  "Datagedreven",
  "Holistisch",
  "Visionair",
  "Adaptief",
  "Geïntegreerd",
] as const;
const BUZZ_NOUNS = [
  "Oplossingen",
  "Infrastructuur",
  "Paradigma's",
  "Architecturen",
  "Netwerken",
  "Platformen",
  "Ecosystemen",
  "Strategieën",
  "Synergieën",
  "Initiatieven",
  "Methodologieën",
  "Kanalen",
  "Modellen",
  "Processen",
  "Applicaties",
  "Diensten",
  "Technologieën",
  "Frameworks",
  "Interfaces",
  "Concepten",
] as const;
const BUZZ_VERBS = [
  "Stroomlijnen",
  "Optimaliseren",
  "Versterken",
  "Ontwrichten",
  "Benutten",
  "Verzilveren",
  "Schalen",
  "Innoveren",
  "Transformeren",
  "Implementeren",
  "Maximaliseren",
  "Faciliteren",
  "Automatiseren",
  "Integreren",
  "Synchroniseren",
  "Versnellen",
  "Visualiseren",
  "Pionieren",
  "Katalyseren",
] as const;

const CATCH_PHRASE_ADJECTIVES = [
  "Klantgericht",
  "Gelaagd",
  "Upgradebaar",
  "Compatibel",
  "Hoogwaardig",
  "Vooruitstrevend",
  "Veelzijdig",
  "Betrouwbaar",
  "Veilig",
  "Toegankelijk",
  "Baanbrekend",
  "Exclusief",
  "Superieur",
  "Essentieel",
  "Fundamenteel",
  "Onmisbaar",
] as const;
const CATCH_PHRASE_DESCRIPTORS = [
  "optimaal",
  "24/7",
  "modulair",
  "gemonitord",
  "logistiek",
  "directioneel",
  "gestroomlijnd",
  "geautomatiseerd",
  "gepersonaliseerd",
  "transparant",
  "flexibel",
  "schaalbaar",
  "foutloos",
  "geïntegreerd",
  "gedecentraliseerd",
  "virtueel",
] as const;
const CATCH_PHRASE_NOUNS = [
  "vermogen",
  "benutting",
  "interface",
  "onvoorzien",
  "projectie",
  "succes",
  "efficiëntie",
  "kwaliteit",
  "zekerheid",
  "capaciteit",
  "groei",
  "prestatie",
  "ROI",
  "betrokkenheid",
  "productiviteit",
  "flexibiliteit",
  "innovatie",
] as const;

const COMPANY_SUFFIXES = [
  "Groep",
  "BV",
  "NV",
  "VOF",
  "Oplossingen",
  "en Zonen",
  "Partners",
  "Associates",
  "Holdings",
  "Consultancy",
  "Tech",
  "Services",
  "Enterprises",
  "Logistics",
  "Digital",
] as const;
export const COMPANY_PREFIXES = [
  "Globaal",
  "Quantum",
  "Cyber",
  "Bio",
  "Eco",
  "Toekomst",
  "Alpha",
  "Omega",
  "Nexus",
  "Aura",
  "Nova",
  "Apex",
  "Vanguard",
  "Pinnacle",
  "Summit",
] as const;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function name(prng: Prng): string {
  const formats: [() => string, ...(() => string)[]] = [
    () => `${lastName(prng)} ${prng.pick(COMPANY_SUFFIXES)}`,
    () => `${lastName(prng)} & ${lastName(prng)}`,
    () => `${prng.pick(COMPANY_PREFIXES)} ${lastName(prng)}`,
    () => `${lastName(prng)} Systemen`,
    () => {
      const w = prng.pick(TECH_WORDS);
      return `${w.charAt(0).toUpperCase() + w.slice(1)} ${prng.pick(COMPANY_SUFFIXES)}`;
    },
    () => `${prng.pick(COMPANY_PREFIXES)}${prng.pick(COMPANY_SUFFIXES)}`,
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
