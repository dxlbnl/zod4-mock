# @zod4-mock/locale-nl

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
