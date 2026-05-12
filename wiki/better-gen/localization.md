# Localization Architecture

## The Problem: Structural Locale Leaks

Currently, `zod4-mock` hardcodes Dutch data directly into the generator files. The leak goes beyond string arrays — locale bleeds into combinatorial logic and formatting:

| Location | Leak |
|----------|------|
| `commerce.ts` | `productName` appends `"en"` to pluralize materials (Dutch grammar rule) |
| `commerce.ts` | `price` replaces `.` with `,` (European decimal format) |
| `company.ts` | `buzzPhrase` hardcodes Verb → Adjective → Noun word order |
| `person.ts` | `fullName` assumes First Last ordering |
| `finance.ts` | `iban` hardcodes `"NL"` country prefix |
| `phone.ts` | Hardcodes Dutch mobile/landline prefixes |
| `word.ts` | Phoneme arrays (`onsets`, `nuclei`, `codas`) are Dutch phonology |
| `location.ts` | 387 lines of Dutch-only streets, cities, and postal codes |

The fix must be structural, not cosmetic — replacing individual strings isn't enough.

## The Proposal: Pluggable Locale Modules

The `LocaleData` interface contains two kinds of things:

- **Data** — arrays and strings (name corpora, word lists, currency symbols)
- **Formatters** — functions that apply locale-specific grammar and formatting rules

Grammar and formatting logic moves out of the core generators and into the locale. Core generators become locale-agnostic shells.

```typescript
// src/generators/data/commerce.ts — after refactor
export function productName(prng: Prng, ctx: GeneratorContext): string {
  const loc = ctx.locale.commerce;
  const adj  = prng.pick(loc.adjectives);
  const mat  = prng.pick(loc.materials);
  const noun = prng.pick(ctx.locale.word.nouns);
  return loc.formatProductName(prng, adj, mat, noun);  // locale decides grammar
}
```

```typescript
// locales/en.ts
export const en: LocaleData = {
  commerce: {
    adjectives: ["Small", "Ergonomic", "Rustic", "Intelligent", "Gorgeous"],
    materials:  ["Steel", "Wooden", "Concrete", "Plastic", "Granite"],
    formatProductName: (_prng, adj, mat, noun) => `${adj} ${mat} ${noun}`,
    formatPrice: (amount) => `$${amount.toFixed(2)}`,
  },
}

// locales/nl.ts
export const nl: LocaleData = {
  commerce: {
    adjectives: ["Klein", "Ergonomisch", "Rustiek", "Intelligent", "Prachtig"],
    materials:  ["Hout", "Metaal", "Plastic", "Glas", "Stof"],
    formatProductName: (_prng, adj, mat, noun) =>
      `${adj} ${mat.toLowerCase()}en ${noun}`,      // Dutch adjectivization
    formatPrice: (amount) =>
      `€${amount.toFixed(2).replace(".", ",")}`,    // European decimal
  },
}
```

## Full `LocaleData` Interface Scope

The interface must cover every domain where locale-specific logic exists. A minimal first pass:

```typescript
interface LocaleData {
  person: {
    firstNames:     string[];
    lastNames:      string[];
    prefixes:       string[];
    suffixes:       string[];
    genders:        string[];
    formatFullName: (prng: Prng, first: string, last: string) => string;
    formatPrefix:   (prefix: string, name: string) => string;
  };
  address: {
    streetFormats:  Array<(number: number, name: string) => string>;
    cities:         string[];
    states:         string[];
    zipFormats:     Array<(prng: Prng) => string>;
    countryCode:    string;   // e.g. "NL", "US"
    phonePrefix:    string;   // e.g. "+31", "+1"
    ibanPrefix:     string;   // e.g. "NL", "GB"
  };
  commerce: {
    adjectives:          string[];
    materials:           string[];
    departments:         string[];
    formatProductName:   (prng: Prng, adj: string, mat: string, noun: string) => string;
    formatPrice:         (amount: number) => string;
    currencyCode:        string;
  };
  company: {
    prefixes:       string[];
    suffixes:       string[];
    buzzAdjectives: string[];
    buzzNouns:      string[];
    buzzVerbs:      string[];
    formatBuzzPhrase: (prng: Prng, verb: string, adj: string, noun: string) => string;
  };
  word: {
    // Markov models for open-class words (see word-generation.md)
    nounModel:      MarkovModel;
    adjectiveModel: MarkovModel;
    verbModel:      MarkovModel;
    // Real word lists for closed-class words
    articles:       string[];
    prepositions:   string[];
    conjunctions:   string[];
    pronouns:       string[];
  };
  finance: {
    currencies:     Array<{ code: string; symbol: string }>;
    bankCodes:      string[];
    ibanFormat:     (prng: Prng, prefix: string) => string;
  };
}
```

## Locale Inheritance

Many locales share most of their data (e.g., `nl-BE` differs from `nl` only in `address.phonePrefix` and `address.ibanPrefix`). An `extend` helper avoids duplication:

```typescript
// locales/nl-be.ts
import { nl } from './nl.js';
import { extend } from './extend.js';

export const nlBE = extend(nl, {
  address: {
    phonePrefix: "+32",
    ibanPrefix:  "BE",
    countryCode: "BE",
  },
});
```

`extend` is a shallow-per-section deep merge — it replaces individual keys within a section without requiring the full section to be redefined.

## Default Locale: English

**Decision:** `en` (English) is the new default. The current Dutch behavior becomes opt-in.

```typescript
// Before (implicit Dutch)
const world = createWorld();

// After (explicit Dutch)
import { nl } from 'zod4-mock/locales/nl';
const world = createWorld({ locale: nl });
```

This is a breaking change requiring a major version bump. Existing Dutch-first users must add the `locale: nl` option.

## User API

Users import only the locales they need — unused locales are tree-shaken automatically:

```typescript
import { createWorld } from 'zod4-mock';
import { nl } from 'zod4-mock/locales/nl';

const world = createWorld({ locale: nl });
```

---

See also: [Word Generation](word-generation.md) · [Markov Training Pipeline](markov-training-pipeline.md) · [Back to Index](index.md)
