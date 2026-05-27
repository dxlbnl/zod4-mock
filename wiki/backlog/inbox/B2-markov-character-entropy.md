---
id: B2
title: Markov character entropy for synthetic string fields
type: research
priority: low
flags: [review]
created: 2026-05-27
report: wiki/research/better-gen/algorithmic-entropy.md
---

## Description

The last open Data & Realism pillar in the better-gen plan: use character-level Markov
chains to generate plausible synthetic strings for fields **not** covered by key-name
heuristics, instead of random-looking filler. Validate the approach (model size, output
quality, where it should sit in the generation pipeline) before committing to an
implementation.

## Notes

- Design rationale: `wiki/research/better-gen/algorithmic-entropy.md`; status in
  `wiki/research/better-gen/tracking.md` (currently `[ ]`).
- `flags: [review]` — architecturally significant (new generation path); pause for
  approval before any implementation item is spun off.
