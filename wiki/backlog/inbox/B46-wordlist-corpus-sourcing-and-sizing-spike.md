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
