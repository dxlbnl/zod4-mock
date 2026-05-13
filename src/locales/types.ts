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

export interface LocaleData {
  id: string;

  person: {
    firstNamesMaleModel: MarkovModel;
    firstNamesFemaleModel: MarkovModel;
    lastNamesModel: MarkovModel;
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
