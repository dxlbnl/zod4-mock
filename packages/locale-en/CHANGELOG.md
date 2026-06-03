# @zod4-mock/locale-en

## 0.6.0

### Minor Changes

- 9a586d5: - Add `Prng.pickZipf(items, s)` — single-draw closed-form inverse-CDF Zipf pick.
  - Add `LocaleData.frequencyExponent` + `frequencyExponentOverrides` for per-locale / per-corpus Zipf tuning.
  - Open-corpus generators (`person.firstName`, `person.lastName`) now draw via `pickZipf`; closed/enumerable lists stay uniform.
  - `world.generate(..., { unique: true })` auto-flattens `s` to `0` for the loop's duration.
  - Locale-en + locale-nl first-name corpora re-emitted in descending-frequency order (freq-sort retrofit on the fetch scripts; `lastNames` order unchanged).
  - Seed → value mapping shifts on every open-corpus field; integration fixtures re-pinned in the same release.
- 25f8412: - `@zod4-mock/locale-core`: new `LocaleData.word.formatSentence?(prng, ctx?)` callback + `LocaleSentenceContext` type; `LocaleData.word.verbsPlural` `@deprecated`.
  - `@zod4-mock/locale-en`: new public `inflect` namespace — `pluralize(noun)`, `conjugate(verb, "3ps" | "past" | "gerund" | "participle")`, `adverbFromAdjective(adj)`.
  - `@zod4-mock/locale-en`: `word.formatSentence` ships 5 English templates with subject–verb 3ps agreement (pronoun slot pinned to `{he, she, it}`).
  - `@zod4-mock/locale-en`: `word.adverbs` expanded from 8 to ~3000 entries via `inflect.adverbFromAdjective`.
  - `@zod4-mock/locale-en`: `company.formatBuzzPhrase` conjugates verbs to 3ps (`"Streamlines synergistic solutions"`).
  - `zod4-mock`: `word.sentence()` delegates to `loc.formatSentence` when present.
- f33b567: - Email generator now picks a random local-part format (first.last / flast / f.last / lastonly / firstname42 / etc) based on which siblings are present.
  - Multi-word company names use ALL tokens with a random `.` / `_` / `''` joiner, not just the first token.
  - `fullName` / `full_name` / `fullname` / `volledigeNaam` siblings split into first + last for the local-part.
  - Whimsical fallback handles compose at runtime from `loc.word.adjectives` + `loc.word.nouns` (no hardcoded handle list).
  - New optional `LocaleData.internet.emailCompanyPrefixes?: readonly string[]` field for locale-specific `info@…` / `contact@…` / `hallo@…` prefixes.
  - `firstName` / `lastName` always emit per-word title-cased proper nouns regardless of locale data file casing.
  - `sentence()` no longer capitalises mid-sentence adjectives/nouns — only the leading template token.
  - `sentence()` `a` / `an` article agreement repaired by a post-template regex pass.

### Patch Changes

- be7ab6d: - `address.cities` expanded to 60 (top-population, head-frequency-ordered for B55 Zipf).
  - `address.streetNames` (en) expanded to 50; nl unchanged at 85.
  - `address.timeZones` expanded to 24 curated IANA regional representatives.
  - `address.countries` / `countryCodes` now ship full ISO 3166-1 — codes hardcoded, localised names derived at module init via `Intl.DisplayNames` (D13-isomorphic).
  - `commerce.departments` / `productAdjectives` expanded to ~30 each.
  - `company.buzzAdjectives` / `buzzNouns` / `buzzVerbLemmas` / `catchPhraseAdjectives` / `catchPhraseDescriptors` / `catchPhraseNouns` expanded to ~30 each.
  - `color.names` expanded to 50 (xkcd-derived, head-frequency-ordered).
  - `finance.transactionDescriptions` expanded to ~30.
  - `person.jobTitles` expanded to 40.
- 8dafc59: - `sentence()` Template 3 now emits object-form pronouns (`him` / `her` / `it` / `them` / `us` / `me`) in the object slot, fixing "sees they" / "sees we" in both the library fallback and locale-en's `formatSentence`.
- 07035c6: - `address.languages` now derived from a hardcoded ISO 639-1 code list via `Intl.DisplayNames` at module init in both `locale-en` and `locale-nl` (ECMA-402, D13-isomorphic).
  - `finance.currencies` now derived from `Intl.supportedValuesOf('currency')` + `Intl.DisplayNames` + `Intl.NumberFormat` at module init; numeric codes via a new `ISO_4217_NUMERIC` map in `@zod4-mock/locale-core`.
  - `@zod4-mock/locale-core` exports the new `ISO_4217_NUMERIC` map for consumers that need ISO 4217 numeric codes (Intl does not expose them).
- Updated dependencies [9a586d5]
- Updated dependencies [6d1f3ff]
- Updated dependencies [25f8412]
- Updated dependencies [f33b567]
- Updated dependencies [07035c6]
  - @zod4-mock/locale-core@0.5.0

## 0.5.1

### Patch Changes

- 7b21c1f: Fix: ship locale data as plain TypeScript constants instead of a brotli blob decompressed at module load. The previous shape (introduced in 0.9.0) used `node:fs` + `node:zlib` and could not run in browsers, MSW, service workers, or edge runtimes. It also shipped the brotli blob outside the package `files` allowlist, causing "blob not found" errors at runtime. Universal-runtime fix: the data layer is now a barrel of TypeScript `string[]` exports the consumer's bundler can compress as it sees fit. No public API change; the `LocaleData` shape pinned in 0.9.0 is preserved.
- Updated dependencies [7b21c1f]
  - @zod4-mock/locale-core@0.4.1

## 0.5.0

### Minor Changes

- 617d8f5: Replace character-level Markov chains with real wordlists.

  **`LocaleData` shape change** — `person.firstNamesMale`, `person.firstNamesFemale`, and `person.lastNames` are now `readonly string[]` (the `simple` prefix that previously distinguished real-list arrays from `NameOriginSet[]` Markov models is dropped); `word.nounModel` and `word.adjectiveModel` are removed (`word.nouns` and `word.adjectives` remain as `readonly string[]`). The exported types `MarkovModel` and `NameOriginSet` no longer exist.

  **Runtime cleanup** — the entire Markov runtime is gone: `sampleMarkov`, `sampleWeighted`, the 4-consonant-run rejection regex, the up-to-8 retry loop, and the `"x"` sentinel fallback are all deleted. Leaf name/word generators now dispatch through `prng.pick(realList)`, so per-call PRNG consumption from name and open-class-word generators becomes **exactly one draw per call** (constant, was data-dependent up to 1+N+8 retries) — strictly stronger determinism under D4 / D10.

  **Workspace change** — `packages/locale-names/` is deleted; Dutch first names + surnames now live in `@zod4-mock/locale-nl`. The 5 origin-classified slices (`dutch`, `english`, `arabic`, `frisian`, `turkish`, `south-asian`) are replaced by per-locale packages with proper native-language sources; restoring `arabic` / `frisian` / `turkish` / `south-asian` is a separate per-locale follow-up.

  **Data sourcing** — English surnames are filtered to the top-10K by US Census 2010 frequency (B48-R6). Names and open-class words now ship as brotli-compressed JSON blobs under `packages/locale-{en,nl}/src/data/blobs/*.br`, decompressed eagerly at module load. Bundle weight: `locale-en` ≈ 71 KB, `locale-nl` ≈ 42 KB (well under the 100 KB-per-locale budget set in B48-R4).

  **Migration**: code reading `locale.person.simpleFirstNamesMale` / `simpleFirstNamesFemale` / `simpleLastNames` should drop the `simple` prefix. Code reading `locale.word.nounModel` / `adjectiveModel` should switch to `locale.word.nouns` / `adjectives` (both already exist as `readonly string[]`). Seed→value mappings shift (a value previously "Risharoumas" becomes a real name); accepted under 0.x SemVer per the B45 / B39 precedent.

  Closes #24 (B42, Dutch initial-letter A/B/C/D skew — closed by construction: under `prng.pick(realList)` the first-letter distribution IS the natural distribution of the source corpus).

### Patch Changes

- Updated dependencies [617d8f5]
  - @zod4-mock/locale-core@0.4.0

## 0.4.1

### Patch Changes

- Updated dependencies
  - @zod4-mock/locale-core@0.3.0
  - @zod4-mock/locale-names@0.2.1

## 0.4.0

### Minor Changes

- Setup extensible locales

### Patch Changes

- Updated dependencies
  - @zod4-mock/locale-names@0.2.0
  - @zod4-mock/locale-core@0.2.0
