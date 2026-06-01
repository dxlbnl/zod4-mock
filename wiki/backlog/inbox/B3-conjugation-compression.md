---
id: B3
title: On-the-fly inflection for greater word variety
type: research
priority: low
flags: [review]
created: 2026-05-27
rescoped: 2026-06-01
report: wiki/research/text-generation/conjugation-compression.md
---

## Description

Derive inflected forms (plurals, verb conjugations, adjective agreement) **algorithmically
at generation time** from lemma corpora, so a small lemma list yields a much larger
effective surface form. Currently the locale word corpora ship the surface forms they
need (e.g. `verbs` 32 entries, `adverbs` 16 — see B51's inventory) and have no path to
generate `runs / ran / running` from `run`. On-the-fly inflection is the missing variety
lever for verb/noun/adjective fields once B51's size targets are set.

## Scope reassessment — 2026-06-01

The original card (2026-05-27) was framed as a **bundle-size reduction** (30–50% smaller
locale corpora by storing only lemmas). That motivation is **moot**:

- B48 deleted the Markov-era 2.34 MB `packages/locale-names/` corpus entirely; locale data
  now ships as plain `string[]` per [D13](../../decisions.md) (isomorphism).
- Real wordlists post-B48 are already small: locale-en ships ~70 KB brotli OTW, locale-nl
  ~41 KB. B50 (encoding research) confirmed `string[]` is the right wire format. There is
  no live "shrink the bundle" lever for inflection to pull.

The **variety lever** remains, and that's what this rescoped card targets:

- B51 sets target sizes per list. For `verbs` (32 today) / `adverbs` (16) / `nouns`
  (5K en / 5K nl), inflection lets variety scale beyond what the source corpora natively
  carry — particularly conjugated/agreeing forms used by `sentence()` / `productName` /
  similar composers.
- Composition with B51's Zipf-pick (frequency-weighted lemma draws) + B54's bounded-string
  generators stays clean — inflection is a post-pick transform on the chosen lemma.

## Questions to answer (research-track scope)

1. **Which fields actually want inflected variety today?** Inventory of corpus consumers
   (`generators/data/word.ts`, `sentence`, `productName`, `companyName`, etc.) — where would
   a conjugated/plural form actually appear in output, and how often?
2. **Locale rule complexity.** English regular-verb conjugation + plural-`s` is small;
   Dutch verb conjugation (`werk` → `werkt` / `werkten` / `gewerkt`) + adjective `-e`
   agreement is heavier. Quantify the rule + irregular-list footprint per locale.
3. **Where in the pipeline.** Inflection should sit one layer deep in the locale generators
   (post-pick transform), not in the engine/PIPELINE — confirm against the post-B48 layout
   ([src/generators/data/word.ts](../../../src/generators/data/word.ts) is the touch point).
4. **Determinism / isomorphism.** Inflection rules + irregular-form maps run in pure JS
   (no `node:*`, no async) — D4/D10/D13 clean by construction; confirm the closed-form
   composition with `prng.pick`.
5. **Faker comparison.** Does faker expose conjugated/inflected lemma forms anywhere? Likely
   no (their `lorem.words()` and `word.verb()` are flat lookup). Document inflection as a
   deliberate variety divergence; no faker dependency.

## Deliverable

`wiki/research/text-generation/conjugation-compression.md` (the existing design page —
rewrite header + reframe as variety-focused, drop the 30–50% bundle-size framing): the
field-by-field inventory of where inflection would appear, per-locale rule + irregular-list
footprints, the pipeline placement decision, the determinism note, and the faker comparison.
Spin implementation off as its own `feature` card once signed off.

## Notes

- **Title change**: was "Conjugation-based word compression"; now framed around the variety
  lever, not bundle size.
- **Predecessor**: B51 (size targets — inflection is the post-pick lever once base lemma
  sizes are set). B54 is the sibling realism axis (numeric Benford) but doesn't touch words.
- **Touches**: `packages/locale-*/src/data/` (lemma lists if separated from surface lists)
  and `packages/locale-*/src/generators/` (per-locale inflection rules). The library engine
  is untouched (inflection sits one layer deep in the locale generators per D13).
- `flags: [review]` — pre-v1 behavioural change to word/sentence output; maintainer signs
  off the field inventory + rule footprint before an implementation card is filed.
