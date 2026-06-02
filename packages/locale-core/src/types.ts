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
  /**
   * Zipf-distributed pick from a freq-sorted array via a closed-form inverse-CDF
   * draw — one `random()`, no rejection loop. `s = 0` reproduces `pick`; `s = 1`
   * is classic Zipf. See B51 report §3 for the formula.
   */
  pickZipf<T>(items: readonly T[], s: number): T;
  shuffle<T>(items: readonly T[]): T[];
  sample<T>(items: readonly T[], count: number): T[];
  fork(key: string): Prng;
  bytes(n: number): Uint8Array;
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

/**
 * Minimal context shape consumed by per-locale `formatSentence` callbacks
 * (and any future cross-cutting callbacks added to `LocaleData`). Captures
 * only the field the locale needs — the active `locale` — without coupling
 * locale-core to the library's full `GeneratorContext` (which carries
 * registry, related, generate, etc.). The library's `GeneratorContext`
 * structurally satisfies this shape, so it can be passed through directly.
 */
export interface LocaleSentenceContext {
  readonly locale?: LocaleData;
}

export interface LocaleData {
  id: string;

  /**
   * Locale-level Zipf exponent applied at open-corpus `pickZipf` call sites
   * when no per-corpus override is present. Resolved at the data-generator
   * call site as `overrides[corpusName] ?? frequencyExponent ?? 1.0`, so
   * locales authored without this field continue to behave unchanged.
   */
  frequencyExponent?: number;
  /**
   * Per-corpus Zipf exponent overrides (keyed by data-generator corpus name,
   * e.g. `lastNames`, `firstNamesMale`). Wins over `frequencyExponent` for
   * the matching corpus; closed/enumerable lists ignore this map entirely.
   */
  frequencyExponentOverrides?: Readonly<Partial<Record<string, number>>>;

  person: {
    /** Pool of male first names sampled uniformly by `prng.pick`. */
    firstNamesMale?: readonly string[];
    /** Pool of female first names sampled uniformly by `prng.pick`. */
    firstNamesFemale?: readonly string[];
    /** Pool of surnames sampled uniformly by `prng.pick`. */
    lastNames?: readonly string[];
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
    formatBio: (
      prng: Prng,
      parts: { jobTitle: string; jobArea: string; jobType: string },
    ) => string;
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
    formatProductDescription: (parts: {
      productName: string;
      adjective: string;
      noun: string;
      department: string;
    }) => string;
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
    /** Pool of open-class nouns sampled uniformly by `prng.pick`. */
    nouns?: readonly string[];
    /** Pool of open-class adjectives sampled uniformly by `prng.pick`. */
    adjectives?: readonly string[];
    articles: readonly string[];
    prepositions: readonly string[];
    conjunctions: readonly string[];
    pronouns: readonly string[];
    verbs: readonly string[];
    /**
     * @deprecated Migrate to `formatSentence`, which owns sentence assembly
     * (including plural-subject verb agreement) inside the locale package.
     * The surface-form `verbsPlural` field is preserved for back-compat and
     * will be removed in a future major.
     */
    verbsPlural: readonly string[];
    adverbs: readonly string[];
    interjections: readonly string[];
    /**
     * Optional per-locale sentence formatter. When present, the library's
     * `sentence()` generator delegates wholesale to this callback —
     * locales own template selection, lemma picking, and any
     * grammar-specific composition (inflection, pronoun agreement, etc.)
     * internally. When absent, the library falls back to its default
     * 5-template English shape against `verbs` / `verbsPlural` /
     * `pronouns` / `articles` / `nouns` / `adjectives`.
     *
     * Mirrors `person.formatBio`, `commerce.formatProductName`, and
     * `company.formatBuzzPhrase` in shape.
     *
     * Declared in method-shorthand form so callers may pass the library's
     * richer `GeneratorContext` without a contravariance mismatch.
     */
    formatSentence?(prng: Prng, ctx?: LocaleSentenceContext): string;
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

  internet?: {
    /**
     * Locale-appropriate prefixes for `<prefix>@<company-domain>` style
     * emails (e.g. `info` / `contact` / `hello` / `support` in English,
     * `info` / `contact` / `hallo` / `klantenservice` in Dutch).
     * Whimsical fallback handles are composed at runtime from the locale's
     * existing `word.adjectives` + `word.nouns` arrays — no hardcoded list.
     */
    emailCompanyPrefixes?: readonly string[];
  };
}
