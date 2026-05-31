---
id: B48
title: Replace Markov chains with real wordlists; drop `packages/locale-names/`; `LocaleData` cleanup
type: feature
priority: high
flags: [review]
created: 2026-05-31
spec: wiki/specs/B48-replace-markov-with-real-wordlists.md
---

## Description

Implementation of the direction established by **B45** ([research](../../research/text-generation/markov-alternatives.md)) and **B46** ([sourcing spike](../../research/text-generation/wordlist-sourcing-spike.md)), with all maintainer sign-off captured at B46's review checkpoint.

The library currently generates names + words via character-level Markov chains. The output is plausible-gibberish ("Risharoumas"), the runtime sampler is propped up by rejection sampling + a `"x"` sentinel fallback + dead-end detection, the trained models ship at ~2.86 MB total, and per-call PRNG consumption is data-dependent (variable; up to 8 attempts).

This item **replaces Markov with real wordlists sampled by `prng.pick`**. The existing `simple*` fallback arrays on `LocaleData` already plumb `string[]` end-to-end through `src/generators/data/word.ts` and `src/generators/data/person.ts` — the change collapses to populating those arrays from compressed-blob loaders and deleting the Markov code path.

### Headline numbers (per B46 spike)

| layer                                        |                     today (Markov) |                   after (real lists) | reduction |
| -------------------------------------------- | ---------------------------------: | -----------------------------------: | --------: |
| `locale-names` (all 5 origin groups)         |                            2.34 MB |           **0 KB** (package dropped) |         ∞ |
| `locale-en` first names + last names + words |                            ~530 KB |                           **~85 KB** |      6.2× |
| EN words (nouns + adjectives) alone          |                            ~201 KB | ~20 KB (lemma lists + existing PCFG) |       10× |
| per-call PRNG                                | variable (1 + N + up-to-8 retries) |                    constant (1 draw) |         — |

### Markov removal punch list

Everything below goes away:

- `src/generators/data/markov/sample.ts` — `sampleMarkov`, `sampleWeighted`, dead-end detection, rejection sampling, the `"x"` sentinel — **deleted**.
- `src/generators/data/markov/` directory — **deleted** in full.
- `scripts/train-markov.ts`, `scripts/verify-markov.ts` — **deleted**.
- `packages/locale-names/` — **whole package deleted** (`packages/locale-names/src/groups/{dutch,english,arabic,frisian,turkish,south-asian}/`, the classifier, the fetch script). Workspace, `pnpm-workspace.yaml`, root `package.json` updated accordingly.
- `packages/locale-en/data/training/` — model files (`*.ts` Markov outputs) deleted; `fetch-data.ts` rewritten to fetch sorted lists + compress.
- `LocaleData` interface in `packages/locale-core/src/types.ts` — Markov model fields removed: `firstNamesMale: NameOriginSet[]`, `firstNamesFemale: NameOriginSet[]`, `lastNames: NameOriginSet[]`, `nounModel: MarkovModel`, `adjectiveModel: MarkovModel`. The existing `simple*` arrays (`simpleFirstNamesMale`, `simpleFirstNamesFemale`, `simpleLastNames`, plus `nouns: string[]` / `adjectives: string[]`) are renamed to drop the `simple` prefix and become THE shape, not a fallback.
- `NameOriginSet`, `MarkovModel`, related types — **deleted**.
- `wiki/research/text-generation/markov-training-pipeline.md`, `wiki/research/text-generation/word-generation.md`, `wiki/research/text-generation/locale-names-package.md`, `wiki/research/text-generation/algorithmic-entropy.md` — kept as **historical context**, but headed with a "**Superseded by B48**" banner pointing at the B46 sourcing spike.

### What stays

- `cap()` capitalization helper.
- `locPick(prng, list)` — the locale-array picker; trivially adapts (already takes a `string[]`).
- The 5-template weighted PCFG in `src/generators/data/word.ts:126-156` for `sentence()`. The leaf generators (noun/adjective) swap from `sampleMarkov(model)` → `prng.pick(realList)`; the PCFG rule table itself is unchanged (B46 §5.2 sketched a weighted-rule extension; that's a follow-up, not in B48 scope).
- The existing `LocaleData` shape for everything non-Markov: key heuristics, lorem, dates, etc.

### New work

- **Surname refetch** — both English and Dutch surname sources refetched from official, public-domain channels:
  - English: US Census 2010 (already in `packages/locale-en/scripts/fetch-data.ts` — confirm and **filter to top-10K by frequency** per the user's Q-B1 direction).
  - Dutch: CBS (Statistics Netherlands) or Meertens. Spike's Q-S2 flagged the existing `digitalheir/family-names-in-the-netherlands` GitHub source as license-undeclared; refetch removes the ambiguity.
- **Dutch first names** — migrate from `packages/locale-names/groups/dutch/` to `packages/locale-nl/` (since `locale-names` is being deleted). Source: `open-nl-data/dutch-names-dataset` (MIT) confirmed at B46 Q-S1.
- **Compression pipeline** — a small build-time encoder that takes the fetched newline lists, front-codes + brotli-compresses them, and ships the result as a per-locale committed blob (e.g. `packages/locale-en/data/blobs/last-names.br` or similar). Decompression at locale load time uses Node's built-in `zlib`.
- **`pnpm-workspace.yaml`** and root `package.json` — remove `packages/locale-names` from the workspace + dependency list. `packages/locale-nl` keeps its workspace entry (it gains the Dutch first names).
- **`docs/api-reference.md`** — update the `LocaleData` shape documentation; note the breaking change in the changeset.

### Out of scope (defer to future items)

- **Syllable n-grams for pseudo-words** (B45 option 3). Dropped from B48 scope; if a user wants invented-but-plausible filler, they can use `prng.alphanumeric` or extend a locale with custom generators. Filed as a separate `feature` item only if user demand arises.
- **Weighted PCFG sentence rules** (B46 §5.2). The existing 5-template uniform-weight machinery stays; weighting the rules by corpus frequency is a separate refinement item.
- **Adding arabic / frisian / turkish / south-asian locale support** with native sources. The current regex-classified slices are dropped under B48; if a user wants those locales they're filed as separate `feature` items per locale (with proper native-language sources).
- **Per-locale extension API improvements**. The existing `extend()` in `locale-core` keeps working; UX improvements are separate.

## Acceptance (preliminary — spec-writer formalizes)

- B48-R1: After this item lands, `packages/locale-names/` MUST NOT exist in the workspace; the `pnpm-workspace.yaml` and root `package.json` MUST NOT reference it.
- B48-R2: `src/generators/data/markov/` MUST NOT exist. `sampleMarkov`, `sampleWeighted`, the `"x"` sentinel fallback, rejection-sampling loop, and dead-end detection MUST NOT exist anywhere in `src/`.
- B48-R3: `LocaleData` MUST NOT have `nounModel`, `adjectiveModel`, or Markov `NameOriginSet[]` fields. The fields that today are `simpleFirstNamesMale`/`simpleFirstNamesFemale`/`simpleLastNames` MUST be renamed to drop the `simple` prefix (or equivalent — spec-writer pins the final name shape). `nouns: string[]` and `adjectives: string[]` MUST be the canonical fields (no Markov-flavored alternative).
- B48-R4: `locale-en` MUST ship its name + word data via a compressed blob (front-coded + brotli) that decompresses to `string[]` arrays at load time. Total locale-en bundle MUST be ≤ ~100 KB (target: ~85 KB per B46 spike).
- B48-R5: `locale-nl` MUST ship Dutch first names migrated from the deleted `locale-names/groups/dutch/`. Surnames MUST be refetched from CBS / Meertens (license: public-domain or equivalent — spec-writer pins).
- B48-R6: `locale-en` English surnames MUST be filtered to top-10K by frequency from US Census 2010 (`packages/locale-en/scripts/fetch-data.ts` updated accordingly).
- B48-R7: Per-call PRNG consumption from any Markov-replacement call site MUST be constant (one `prng.pick` draw per call), preserving D4 / D10. The existing per-schema slot machinery is untouched.
- B48-R8: The 5-template weighted PCFG in `src/generators/data/word.ts:126-156` (`sentence()`) MUST keep its rule shape; only the leaf generators (noun, adjective) MUST swap their data source.
- B48-R9: `docs/api-reference.md` MUST document the new `LocaleData` shape (no Markov fields).
- B48-R10: A changeset MUST be added (`minor` bump per the 0.x SemVer precedent — same as B39).
- B48-R11 (B42 closure): `prng.pick` over the real Dutch wordlist MUST produce an A+B+C+D initial-letter mass in 21–24 % range (matching natural Dutch letter frequency). Empirically confirmed by B46 §6; B48 inherits the test obligation.

## Notes

- **B42 cancellation pairs with this commit.** B42 (issue #24 nl initial-letter skew) is closed by construction under `prng.pick(realList)`. The manager moves `wiki/backlog/inbox/B42-…md` to `wiki/backlog/done/` with `flags: [cancelled]` when B48 lands (or in B46's closing commit — either way before B48 ships).
- **Bump**: `minor`. Per B45 / B39 precedent, breaking changes under 0.x get a minor bump with a coordinated test re-pin. The seed-shifting risk is real (any test asserting a specific Markov-derived value will shift); the existing test suite is matcher-derived and structural so the impact should be limited, but the test-writer + reviewer must explicitly audit.
- **GitHub issue**: closes #24 (B42, latent — to be confirmed once Markov is gone).
- **Sign-off recorded at B46 review checkpoint #2 (2026-05-31)**. All blocking maintainer questions (Q-S1/S2/S3/S6/S7, O-A1/O-A5, Q-B1) answered; non-blocking questions (PCFG weighting, syllable n-grams) deferred to follow-up items.
- **Predecessor**: B46 ([wiki/backlog/done/B46-…md](../done/B46-wordlist-corpus-sourcing-and-sizing-spike.md)).
- Anchor reading for the spec-writer: B46 spike report, B45 report, `packages/locale-core/src/types.ts:62-65,139-141`, `src/generators/data/word.ts:75,87,126-156`, `src/generators/data/person.ts:58-66,76,77,85`, `packages/locale-en/scripts/fetch-data.ts`.
- **`flags: [review]`** — substantial scope (multi-package, type-shape break, data-shipping change). Spec page is needed before test-writer / implementer run; manager pauses at checkpoint #2 even though the _direction_ is pre-decided, because the _acceptance shape_ (file paths, exact LocaleData rename, changeset wording, dist size assertion approach) benefits from sign-off.
- Note on B48 id reuse: this id was previously consumed by a one-line fmt-sweep ticket I filed in error and cancelled inline (commit `b7630d3`). The card slot is empty at HEAD; this is the real B48.
