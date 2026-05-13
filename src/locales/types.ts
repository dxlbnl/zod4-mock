import type { Prng } from "../types.js";

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

export interface LocaleData {
  id: string;

  person: {
    /** Weighted list of cultural-origin models for male first names. */
    firstNamesMale: readonly NameOriginSet[];
    /** Weighted list of cultural-origin models for female first names. */
    firstNamesFemale: readonly NameOriginSet[];
    /** Weighted list of cultural-origin models for last names. */
    lastNames: readonly NameOriginSet[];
    /**
     * Optional surname prefixes (e.g. Dutch tussenvoegsels like "de", "van der").
     * When present, a prefix is prepended with probability proportional to the
     * sum of weights vs. a "no prefix" weight of 100.
     */
    lastNamePrefixes?: readonly LastNamePrefix[];
    prefixes: { male: readonly string[]; female: readonly string[]; neutral: readonly string[] };
    suffixes: readonly string[];
    genders: readonly string[];
    formatFullName: (first: string, last: string) => string;
  };

  address: {
    cities: readonly string[];
    states: readonly string[];
    countries: readonly string[];
    streetFormats: ReadonlyArray<(number: string, name: string) => string>;
    zipFormat: (prng: Prng) => string;
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
  };

  company: {
    prefixes: readonly string[];
    suffixes: readonly string[];
    buzzAdjectives: readonly string[];
    buzzNouns: readonly string[];
    buzzVerbLemmas: readonly string[];
    formatBuzzPhrase: (verb: string, adj: string, noun: string) => string;
  };

  word: {
    nounModel: MarkovModel;
    adjectiveModel: MarkovModel;
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
    formatIban: (prng: Prng, bankCode: string) => string;
  };
}
