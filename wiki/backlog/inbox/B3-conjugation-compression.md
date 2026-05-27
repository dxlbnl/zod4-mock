---
id: B3
title: Conjugation-based word compression
type: feature
priority: low
flags: [review]
created: 2026-05-27
---

## Description

Reduce locale word-corpus size 30–50% by storing only lemmas and deriving inflected
forms (plurals, conjugations) algorithmically at generation time, rather than shipping
every inflected form. Increases variety while shrinking bundle size — one of the two
remaining open better-gen pillars.

## Notes

- Design: `wiki/research/better-gen/conjugation-compression.md`; status in
  `wiki/research/better-gen/tracking.md` (currently `[ ]`).
- Touches the locale packages (`packages/locale-*`) and their training scripts.
- `flags: [review]` — sizeable, affects bundle size and locale data; approve scope
  before implementation.
