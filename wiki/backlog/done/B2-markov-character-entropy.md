---
id: B2
title: Markov character entropy for synthetic string fields
type: research
priority: low
flags: [cancelled]
created: 2026-05-27
cancelled: 2026-06-01
report: wiki/research/text-generation/algorithmic-entropy.md
---

## Description

The last open Data & Realism pillar in the data-generation plan: use character-level Markov
chains to generate plausible synthetic strings for fields **not** covered by key-name
heuristics, instead of random-looking filler. Validate the approach (model size, output
quality, where it should sit in the generation pipeline) before committing to an
implementation.

## Resolution (2026-06-01)

**Cancelled. The Markov direction was evaluated, rejected, and the implementation removed
from the codebase before this card reached the pipeline.**

- [B45](../done/B45-markov-alternatives-evaluation.md) commissioned an evaluation of
  alternatives to char-level Markov; the report is
  [wiki/research/text-generation/markov-alternatives.md](../../research/text-generation/markov-alternatives.md).
- [B46](../done/B46-wordlist-sourcing-spike.md) confirmed real wordlists land under the
  per-locale size target with margin (locale-names 172 KB combined vs Markov's 2.34 MB) and
  showed the empty-state distribution skew the maintainer had observed against Markov was a
  rejection-sampling artefact, not a Markov-vs-real-list disagreement.
- [B48](../done/B48-replace-markov-with-real-wordlists.md) shipped the replacement: deleted
  `src/generators/data/markov/`, `packages/locale-en/src/models/`, `packages/locale-nl/src/models/`,
  `sampleMarkov`, the `*Model` fields on `LocaleData`, and the entire `packages/locale-names/`
  workspace; locale data now ships as plain `string[]` per [D13](../../decisions.md) (isomorphism).
- B2's premise — "use char-level Markov for synthetic strings not covered by key-name
  heuristics" — is moot: there is no Markov code to extend, and the strategic direction
  reversed to real wordlists + closed-form distributions (B51 Zipf-pick, B54 Benford-numerics)
  as the realism levers.

The original design rationale at
[wiki/research/text-generation/algorithmic-entropy.md](../../research/text-generation/algorithmic-entropy.md)
remains in the wiki as historical context for the pre-B45/B46 direction.

## Notes

- No GitHub issue filed; no `closes` reference for the cancellation commit.
- Cancelled inline by the manager per the trivial-chore gate; no spec, test, or
  implementation work was ever dispatched.
