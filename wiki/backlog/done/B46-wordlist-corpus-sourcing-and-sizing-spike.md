---
id: B46
title: Spike — source wordlist corpora and measure shipped sizes for the B45 direction
type: research
priority: medium
flags: [review]
created: 2026-05-30
report: wiki/research/text-generation/wordlist-sourcing-spike.md
---

## Description

Follow-up to **B45** (research report:
[wiki/research/text-generation/markov-alternatives.md](../../research/text-generation/markov-alternatives.md)).
B45 recommended replacing today's char-level Markov models with **real wordlists
sampled by `prng.pick`** — composed independently for composite values
(`firstName × lastName`), no Feistel walk, no `{ unique: true }` opt-in. Today's
shipped name+word corpora measure **2.34 MB names + 0.53 MB EN words = 2.86 MB**;
the report estimated a real-wordlist direction lands under ~250 KB per locale, but
that estimate is unverified.

This spike does the **measurement work** B45 deferred so the implementation item can
be scoped with real numbers and a corpus + licensing plan the user has signed off.

## Scope

For each of the five locale groups in `packages/locale-names/src/groups/`
(`dutch`, `english`, `arabic`, `frisian`, `turkish`) and for `packages/locale-en/src/models/`
(words: nouns/adjectives):

1. **Identify the source corpora.** The existing Markov models were trained on
   specific source lists (SSA US baby names, US Census surnames, Meertens/CBS Dutch
   names, etc. — see `scripts/train-markov.ts` + `wiki/research/text-generation/markov-training-pipeline.md`).
   For each locale, document: source dataset, original entry count, current
   shipped model size, license. If the original sources are no longer accessible,
   surface that and propose equivalent open-licensed alternatives.

2. **Measure compressed sizes on the real lists.** Build three encodings per list:
   front-coded, DAFSA (build-time-only tooling — can use an existing JS DAFSA
   library or a simple builder), and brotli on a newline-sorted file. Report
   bytes-per-encoding per locale, and compare against today's per-locale Markov
   model size. Target: confirm or refute the report's <250 KB per-locale claim.

3. **Sanity-check the sampling shape against today's matchers.** Walk the call
   sites that consume the Markov sampler today (`src/generators/data/markov/sample.ts`
   → who calls it? — see `src/generators/data/key-map.ts` text aliases via the
   `bindGenerators` machinery from B36/B40). Confirm that swapping in
   `prng.pick(realList)` requires no API change and no new ctx surface — just a
   different data-source loader behind the existing helpers. Note any matcher
   that does need adjustment.

4. **Words / PCFG sketch.** For the EN word models specifically, recommend either
   real lemma lists alone or real lemma lists + a small weighted PCFG (per B45 §2.6).
   Size both options. No implementation, just a sized recommendation.

5. **B42 (#24) confirmation.** Verify that uniform `prng.pick` over a real Dutch
   wordlist produces an initial-letter distribution matching natural Dutch letter
   frequency (no special start-state handling needed). A small empirical check
   (sample N from the real list, tabulate first letters, compare to a published
   Dutch letter-frequency distribution) closes the question of whether B42 can be
   cancelled outright when this lands.

## Deliverable

`wiki/research/text-generation/wordlist-sourcing-spike.md`: per-locale corpus
recommendation (source + license + entry count), measured size table across all
three encodings + the Markov baseline, the sampler-shape note from step 3, a sized
PCFG recommendation from step 4, the B42 confirmation, and a sign-off block listing
the corpora/licenses the maintainer needs to greenlight.

The deliverable is **explicitly not** a Feistel proof-of-concept (dropped per the
B45 Resolution) and **not** a full implementation. It is the measurement-and-sourcing
gate that has to pass before a `feature`/`chore` implementation item can be filed
with concrete bytes and licenses pinned.

## Notes

- Out of scope: the implementation rewrite itself; that becomes a follow-up
  `feature`/`chore` once this spike's corpora are signed off.
- Out of scope: the quantize+prune stopgap (B45 option 4). If bundle size becomes
  pressing before this spike's wordlist direction lands, a separate `chore` item
  ships that stopgap. The two paths don't conflict.
- `flags: [review]` — the corpus + licensing recommendation needs maintainer
  sign-off before any retrain / data-shipping commits. The spike surfaces it; the
  manager pauses at checkpoint #2.
- Anchor reading: `wiki/research/text-generation/markov-alternatives.md` (B45
  report), `wiki/research/text-generation/markov-training-pipeline.md`,
  `packages/locale-names/src/groups/`, `packages/locale-en/src/models/`,
  `scripts/train-markov.ts`, `src/generators/data/markov/sample.ts`.
- B45 Resolution is the binding contract for this spike's scope.

## Resolution

Spike landed at [wiki/research/text-generation/wordlist-sourcing-spike.md](../../research/text-generation/wordlist-sourcing-spike.md) with the measurement script at [scripts/b46-measure-corpus-sizes.ts](../../../scripts/b46-measure-corpus-sizes.ts). Reviewer PASSed: script reproduces report numbers cell-for-cell; sampler-shape claim verified at `packages/locale-core/src/types.ts:62-65` + `src/generators/data/word.ts:75,87` + `person.ts:58-66`; B42 cancellation rationale verified (Markov empty-state A+B+C+D = 21.66% / 22.94% essentially matches real-list 22.0% / 23.1%).

**Headline measurements:**
- `locale-names` corpora compress to **172 KB** combined front-coded+brotli vs **2.34 MB** shipped Markov today — **13.5× reduction**.
- EN words (nouns + adjectives): **~20 KB** real lists + PCFG vs **~201 KB** Markov today — **10× reduction**.
- EN first names: ~55–65 KB vs ~215 KB today.
- Per-call PRNG: variable (1+N+up-to-8-retries) → constant (1 draw). Strictly stronger D4/D10 fit.

User decisions at review checkpoint #2 (2026-05-31):

- **Q-S2 / Q-S3 (no-declared-license surname sources)** — **refetch from official sources**: US Census 2010 surnames (public domain) for English (already in `packages/locale-en/scripts/fetch-data.ts`); CBS / Meertens for Dutch. Removes the licensing ambiguity entirely.
- **Q-S6 (arabic / frisian / turkish slices) + Q-S7 (south-asian)** — **drop**. Plus **drop `packages/locale-names/` entirely**. Dutch first names migrate to `packages/locale-nl/` under the implementation item. Arabic / frisian / turkish / south-asian out-of-the-box locales removed; users can extend via locale-core if they bring their own corpora.
- **Q-B1 (locale-en surname bundle size)** — **top-10K by frequency**. Locale-en lands at ~85 KB total. Common surnames are what users see in mock data; rare names add long-tail bytes for little realism gain.
- **O-A1 / O-A5 (`LocaleData` type-shape break)** — **accept under 0.x** (minor bump per B45 SemVer precedent). Drop `nounModel`/`adjectiveModel`/Markov `NameOriginSet[]` fields from `LocaleData`; the existing `simple*` fallback arrays become THE source (not a fallback). `packages/locale-nl` is workspace-coordinated in the same commit.

**Markov goes away entirely** under the recommended direction: `src/generators/data/markov/sample.ts` deleted, `sampleMarkov` / `sampleWeighted` / dead-end detection / `"x"` sentinel / rejection sampling all removed, `scripts/train-markov.ts` + `scripts/verify-markov.ts` deleted, `packages/locale-en/data/training/` model files replaced by fetched-then-compressed wordlist blobs.

**B42 ([#24](https://github.com/dxlbnl/zod4-mock/issues/24))** — confirmed cancellable by construction. The user-observed A/B/C/D skew is rejection-sampling + `"x"` fallback compounding, not a start-state distribution issue. Under `prng.pick(realList)` the natural Dutch first-letter distribution shows through (~22 %); the issue closes without any sampler patch. Cancel B42 (move to done/ with `flags: [cancelled]`) as part of this commit.

Follow-up implementation item filed as **B48** (`feature`, `flags: [review]`, minor bump). Scope baked in from this Resolution; spec-writer pins acceptance + the Markov-removal punch list. (The B48 id was previously consumed by a fmt-sweep ticket I shouldn't have filed; cancelled inline in commit `b7630d3` — the slot was empty at HEAD when this item was filed.)
