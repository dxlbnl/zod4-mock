# Localization Architecture

> ✅ **Implemented.** The locale system described here is live. `src/locales/*` no longer exists — locale types and the `extend()` helper live in [`@zod4-mock/locale-core`](locale-names-package.md), `en` ships in `@zod4-mock/locale-en`, `nl` in `@zod4-mock/locale-nl`, and shared name models in `@zod4-mock/locale-names`. The canonical `LocaleData` interface is in [api-reference.md](../api-reference.md#localedata). This page is preserved as design rationale; the snippets below have been updated to the as-built API.

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
// packages/locale-en/src/locale.ts
export const en: LocaleData = {
  commerce: {
    productAdjectives: ["Small", "Ergonomic", "Rustic", "Intelligent", "Gorgeous"],
    materials:         ["Steel", "Wood", "Concrete", "Plastic", "Granite"],
    formatProductName: (adj, mat, noun) => `${adj} ${mat.toLowerCase()} ${noun}`,
    formatPrice:       (amount) => `$${amount.toFixed(2)}`,
    // ...
  },
};

// packages/locale-nl/src/locale.ts
export const nl: LocaleData = {
  commerce: {
    productAdjectives: ["Klein", "Ergonomisch", "Rustiek", "Intelligent", "Prachtig"],
    materials:         ["Hout", "Metaal", "Plastic", "Glas", "Stof"],
    formatProductName: (adj, mat, noun) =>
      `${adj} ${mat.toLowerCase()}en ${noun}`,         // Dutch adjectivization
    formatPrice: (amount) =>
      `€${amount.toFixed(2).replace(".", ",")}`,       // European decimal
    // ...
  },
};
```

## Full `LocaleData` Interface Scope

The interface covers every domain where locale-specific logic exists. The as-built shape spans nine sections:

```typescript
// Canonical definition: packages/locale-core/src/types.ts
interface LocaleData {
  id: string;
  person:   { /* Markov names OR simple* arrays · prefixes · suffixes · jobs · formatFullName · formatBio · lastNamePrefixes · genders */ };
  address:  { /* cities · states · countries · countryCodes · streetNames · streetFormats · zipFormat · phonePrefix · ibanPrefix · countryCode · etc. */ };
  commerce: { /* departments · materials · productAdjectives · formatPrice · formatProductName · formatProductDescription · currencyCode */ };
  company:  { /* prefixes · suffixes · buzzAdjectives · buzzNouns · buzzVerbLemmas · catchPhrase* · formatBuzzPhrase */ };
  word:     { /* nounModel? / adjectiveModel? OR nouns / adjectives · articles · prepositions · ... */ };
  finance:  { /* bankCodes · bicLocations · currencies (Currency[]) · accountNames · transactionTypes · formatIban */ };
  date:     { /* months · monthsShort · weekdays · weekdaysShort · timeZones */ };
  color:    { /* names */ };
  phone:    { /* mobilePrefix · landlinePrefixes · formatMobile · formatLandline */ };
}
```

A locale may supply either Markov models (`firstNamesMale: NameOriginSet[]`, `nounModel: MarkovModel`) or plain string arrays (`simpleFirstNamesMale: string[]`, `nouns: string[]`); generators prefer the Markov model when present and fall back to the array otherwise. The built-in default locale (`src/default-locale.ts`) ships only the simple arrays; `@zod4-mock/locale-en` and `@zod4-mock/locale-nl` ship Markov-backed models.

For the full, type-accurate interface (every field, every signature), see **[api-reference.md → LocaleData](../api-reference.md#localedata)**.

## Locale Inheritance

Many locales share most of their data (e.g., `nl-BE` differs from `nl` only in `address.phonePrefix` and `address.ibanPrefix`). An `extend` helper avoids duplication:

```typescript
// e.g. a user-defined nl-BE locale
import { extend } from "zod4-mock";                  // re-exported from @zod4-mock/locale-core
import { nl } from "@zod4-mock/locale-nl";

export const nlBE = extend(nl, {
  address: {
    ...nl.address,
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

// After (explicit Dutch — install @zod4-mock/locale-nl)
import { nl } from "@zod4-mock/locale-nl";
const world = createWorld({ locale: nl });
```

This was a breaking change shipped with the major version bump. Existing Dutch-first users must install `@zod4-mock/locale-nl` and add the `locale: nl` option.

## User API

Users install only the locales they need — each is its own package, so unused locales are never downloaded:

```typescript
import { createWorld } from "zod4-mock";
import { nl } from "@zod4-mock/locale-nl";

const world = createWorld({ locale: nl });
```

---

See also: [Word Generation](word-generation.md) · [Markov Training Pipeline](markov-training-pipeline.md) · [Back to Index](index.md)
