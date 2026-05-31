---
id: B45
title: Evaluate alternatives to char-level Markov for name/word generation
type: research
priority: medium
flags: [review]
created: 2026-05-29
report: wiki/research/text-generation/markov-alternatives.md
---

## Description

The maintainer is unhappy with the current character-level Markov approach for
**names and words** on two axes: **output quality** (char-Markov reads as
plausible-gibberish — "Risharoumas" — which is why `sample.ts` needs rejection
sampling, dead-end detection, and an `"x"` sentinel fallback) and **efficiency in
time and size**. The goal of this research is to evaluate alternative techniques for
generating _larger, more realistic_ name/word sets that are efficient in **both**
generation time and on-disk/bundle size, and to recommend a direction (with rough
sizing) before any implementation item is spun off.

The key reframing to validate: Markov's selling point is "tiny model, infinite
variety," but the current models are **not tiny** (~540 KB for `locale-en` word
models, ~3.5 MB across `locale-names` origins) and the variety is low-quality — so it
may be losing on its own terms for a _mock-data_ library that rarely needs infinite
distinct values.

## Scope — alternatives to compare

The researcher should weigh each against the three axes (quality / size / time) **plus
uniqueness** and determinism (everything must consume the SFC32 PRNG via `fork(key)`):

1. **Real wordlists + combinatorial product + a bijection** — store real first/last
   names, compose fields (5k × 5k = 25M unique full names from ~50–100 KB of real
   data), and enumerate the product space uniquely + shuffled via a **Feistel network /
   format-preserving permutation** seeded from the PRNG. Gives guaranteed non-repeating
   uniqueness that Markov cannot. Likely the strongest fit for names.
2. **Succinct storage for those lists** — DAWG/DAFSA (shared prefix+suffix merging,
   indexable k-th word), front-coding, or brotli/gzip'd newline lists loaded lazily per
   locale. Target: land **under** the current 3.5 MB while shipping _real_ data. Include
   rough sizing on the actual `locale-names` corpora.
3. **Syllable-level composition / n-grams** — onset/nucleus/coda or whole-syllable
   n-grams instead of character n-grams: fewer states, far less gibberish, no dead-end
   detection. (Note: distinguish from the abandoned "3-state phoneme combinatorics" —
   this is the smarter version.)
4. **Keep Markov but shrink it** — quantize `Float32Array` CDFs → int8/int16, prune
   low-probability transitions to sparse top-k. Lowest-effort size win (est. 4–8×) as a
   stopgap; pairs with #3 for quality.
5. **Neural (char-RNN / tiny transformer)** — evaluate and (expected) dismiss: bigger,
   slower, non-trivial determinism, runtime dependency. Document why it's the wrong
   direction so it's settled.
6. **Words specifically** — for nouns/adjectives, compare generated pseudo-words vs.
   real closed-vocabulary lists; for sentences, weighted PCFG/grammar templates over
   _real_ words vs. stitching Markov-invented words.

## Deliverable

`wiki/research/text-generation/markov-alternatives.md`: a comparison table (quality / size /
time / uniqueness / determinism / implementation cost) across the options above,
anchored to the measured baseline (540 KB EN, 3.5 MB names), with a recommended
direction and a suggested spike (e.g. wordlist+Feistel for names; DAWG/brotli sizing on
real corpora). Findings should be concrete enough for the manager to spin off a
follow-up implementation `feature`/`chore` (or a retrain) with user sign-off.

## Notes

- Anchor files: `src/generators/data/markov/sample.ts` (runtime sampler),
  `scripts/train-markov.ts` (training), `packages/locale-en/src/models/`,
  `packages/locale-names/src/groups/`, `src/prng.ts` (SFC32 + `fork(key)`).
- Related items — **complementary, not duplicate**:
  - **B2** (Markov character entropy for _unkeyed_ synthetic strings) — narrower;
    different surface (fields not covered by key heuristics).
  - **B42** (nl-locale Markov initial-letter distribution bias, issue #24) — a specific
    quality bug within the current Markov approach; a wholesale alternative here could
    subsume it, so coordinate findings.
- Broader track: `wiki/research/` (overview.md, `tracking.md`,
  `markov-training-pipeline.md`, `word-generation.md`, `algorithmic-entropy.md`,
  `name-origin-distribution.md`).
- `flags: [review]` — architecturally significant (potential replacement of a core
  generation path + possible corpus/data-shipping change); the manager pauses for user
  sign-off on the recommended direction before any implementation item is spun off.

## Resolution

User approved the recommended direction at review checkpoint #2 (2026-05-30), with one deliberate simplification of the report:

1. **Names → real wordlists sampled with `prng.pick`** (no Feistel / FPE walk). Compose composite names by independently picking each field (e.g. `prng.pick(firstNames)` + `prng.pick(lastNames)`). The natural list composition encodes realistic frequency ("some names are more common"); collisions are tolerated at the rate the list size dictates. Succinct storage (option 2 — front-coding / DAFSA / brotli) ships the lists compactly.
2. **Words → real lemma lists + weighted PCFG** (option 6) with syllable n-grams (option 3) as the pseudo-word fallback where invention is wanted.
3. **Quantize + prune (option 4)** as an interim stopgap if bundle size becomes pressing before #1 lands.
4. **Neural (option 5) dismissed.**

Decisions on the open questions:

- **Q1–Q3 (corpus / licensing / bundle budget)** — deferred to the spike's measurement deliverable. Spike must surface candidate corpora + licenses for sign-off before any retrain commits.
- **Q4 (uniqueness default)** — **dropped entirely.** No Feistel walk, no `{ unique: true }` opt-in. Independent `prng.pick` is the only sampling path. Keeps the API surface unchanged. Collisions occur at the natural rate of `1 / N` per draw, which the spike's measurements will bound per locale.
- **Q5 (determinism break)** — accepted under 0.x SemVer (minor bump, coordinated test re-pin, per B39 precedent).
- **Q6 (B42)** — folded into B45 direction. Subsumption still holds: `prng.pick` over a real wordlist makes the initial-letter distribution match the list's natural distribution (the real distribution of Dutch first letters), eliminating the Markov chain's pathological start-state skew. B42 stays in inbox flagged subsumed-by-B45 and will be cancelled-by-spike when the wordlist direction lands. Do NOT ship a B42 sampler patch in the meantime.

**Report deviation:** the report's §3.1 (Feistel-key derivation, slot wiring, D9-cache neutrality of the permutation) is moot under this resolution. The spike does not need a Feistel proof-of-concept, only the measurement deliverables.

Follow-up spike filed as **B46** (`research`/`chore`, [review]) — scope narrowed to measurement + corpus sourcing.
