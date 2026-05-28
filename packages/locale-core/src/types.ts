/**
 * @module @zod4-mock/locale-core
 * Shared locale types and the `extend()` utility. Consumed by the main
 * `zod4-mock` package and every `@zod4-mock/locale-*` package.
 */

/** Seeded pseudo-random number generator. Implemented in the main `zod4-mock` package. */
export interface Prng {
  readonly seed: number;
  random(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly [T, ...T[]]): T;
  pick<T>(items: readonly T[]): T | undefined;
  shuffle<T>(items: readonly T[]): T[];
  sample<T>(items: readonly T[], count: number): T[];
  fork(key: string): Prng;
  bytes(n: number): Uint8Array;
}

export interface MarkovModel {
  /** n-gram order (2 = bigram context). */
  order: number;
  /** Dirichlet smoothing weight (e.g. 0.01). */
  prior: number;
  /** Alphabet used by this model, including the "$" end-of-word sentinel. */
  chars: string;
  /** n-gram state → cumulative distribution function (length === chars.length). */
  table: Record<string, number[]>;
}

/** A cultural-origin model paired with its relative sampling weight. */
export interface NameOriginSet {
  model: MarkovModel;
  /** Relative probability weight — does not need to sum to 100. */
  weight: number;
}

/** A surname prefix (tussenvoegsel) with its relative sampling weight. */
export interface LastNamePrefix {
  prefix: string;
  weight: number;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  numeric: string;
}

export interface LocaleData {
  id: string;

  person: {
    /**
     * Weighted cultural-origin Markov models for male first names.
     * When present, takes priority over `simpleFirstNamesMale`.
     */
    firstNamesMale?: readonly NameOriginSet[];
    firstNamesFemale?: readonly NameOriginSet[];
    lastNames?: readonly NameOriginSet[];
    /** Plain array fallback for first/last names — used when no Markov model is supplied. */
    simpleFirstNamesMale?: readonly string[];
    simpleFirstNamesFemale?: readonly string[];
    simpleLastNames?: readonly string[];
    /** Optional surname prefixes (e.g. Dutch tussenvoegsels like "de", "van der"). */
    lastNamePrefixes?: readonly LastNamePrefix[];
    prefixes: { male: readonly string[]; female: readonly string[]; neutral: readonly string[] };
    suffixes: readonly string[];
    genders: readonly string[];
    jobTitles: readonly string[];
    jobAreas: readonly string[];
    jobTypes: readonly string[];
    jobDescriptors: readonly string[];
    formatFullName: (first: string, last: string) => string;
    /** Returns a bio sentence using a locale-specific template. */
    formatBio: (prng: Prng, parts: { jobTitle: string; jobArea: string; jobType: string }) => string;
  };

  address: {
    cities: readonly string[];
    states: readonly string[];
    countries: readonly string[];
    countryCodes: readonly string[];
    continents: readonly string[];
    languages: readonly string[];
    streetNames: readonly string[];
    streetSuffixes: readonly string[];
    cityPrefixes: readonly string[];
    cityCores: readonly string[];
    buildingNumberSuffixes: readonly string[];
    timeZones: readonly string[];
    directions: readonly string[];
    cardinalDirections: readonly string[];
    ordinalDirections: readonly string[];
    streetFormats: ReadonlyArray<(number: string, name: string) => string>;
    zipFormat: (prng: Prng) => string;
    /** Returns a secondary-address line (e.g. "Apt 5", "Appartement 5"). */
    secondaryAddressFormat: (n: number) => string;
    phonePrefix: string;
    ibanPrefix: string;
    countryCode: string;
  };

  commerce: {
    departments: readonly string[];
    materials: readonly string[];
    productAdjectives: readonly string[];
    currencyCode: string;
    formatPrice: (amount: number) => string;
    formatProductName: (adjective: string, material: string, noun: string) => string;
    formatProductDescription: (parts: { productName: string; adjective: string; noun: string; department: string }) => string;
  };

  company: {
    prefixes: readonly string[];
    suffixes: readonly string[];
    buzzAdjectives: readonly string[];
    buzzNouns: readonly string[];
    buzzVerbLemmas: readonly string[];
    catchPhraseAdjectives: readonly string[];
    catchPhraseDescriptors: readonly string[];
    catchPhraseNouns: readonly string[];
    formatBuzzPhrase: (verb: string, adj: string, noun: string) => string;
  };

  word: {
    /** Markov model for open-class nouns. When present, takes priority over `nouns`. */
    nounModel?: MarkovModel;
    adjectiveModel?: MarkovModel;
    /** Plain array fallback — used when no Markov model is supplied. */
    nouns?: readonly string[];
    adjectives?: readonly string[];
    articles: readonly string[];
    prepositions: readonly string[];
    conjunctions: readonly string[];
    pronouns: readonly string[];
    verbs: readonly string[];
    verbsPlural: readonly string[];
    adverbs: readonly string[];
    interjections: readonly string[];
  };

  finance: {
    bankCodes: readonly string[];
    bicLocations: readonly string[];
    currencies: readonly Currency[];
    accountNames: readonly string[];
    transactionTypes: readonly string[];
    transactionDescriptions: readonly string[];
    formatIban: (prng: Prng, bankCode: string) => string;
  };

  date: {
    months: readonly string[];
    monthsShort: readonly string[];
    weekdays: readonly string[];
    weekdaysShort: readonly string[];
    timeZones: readonly string[];
  };

  color: {
    names: readonly string[];
  };

  phone: {
    mobilePrefix: string;
    landlinePrefixes: readonly string[];
    formatMobile: (prng: Prng) => string;
    formatLandline: (prng: Prng) => string;
  };
}
