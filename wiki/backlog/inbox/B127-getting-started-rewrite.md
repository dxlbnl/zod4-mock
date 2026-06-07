---
id: B127
title: Rewrite Getting Started — variations, not steps (concise, self-contained, twoslash'd)
type: feature
priority: high
created: 2026-06-07
predecessor: B126
plan: wiki/research/reports/docs-ux-rework.md
---

## Description

Per the approved plan, the maintainer wants Getting Started **reworked entirely** — it's
currently broken in concept: framed as "steps" that don't build on each other, with undefined
schemas, no imports, no highlighting, an unclear speed-boast, and verbose filler.

### Scope (the new shape)

- **Lead with one complete, self-contained `generate` example** — imports shown, the **whole
  schema** defined inline, Shiki+Twoslash highlighted + type-checked (B126). The reader can
  copy-run it.
- **Then variations, NOT steps** — "another way to do it," each self-contained: a **seeded
  world** (and use it as the **primer to explain the seed + the options** simply — show what
  you pass, explain it plainly), **matchers**, **relations**. Each its own complete example.
- **Cut the verbosity:** drop the `<SpeedClaim>` ("user tier 3.2×") boast, drop the
  "zod v4 NOT v3" copy (`zod@^4` is enough), move derive/transform/localize to Recipes.
- Every schema used is defined; every snippet self-contained; code color-coded; type tokens
  clickable into the reference (via B126).

## Acceptance

- Getting Started reads as a concise overview: one full example + a few self-contained
  variations, no "step N" framing, no undefined `UserSchema`, no SpeedClaim, no v3/v4 noise.
- All code samples compile (Twoslash) and are highlighted; type tokens link to `/docs/api`.
- `pnpm site:test:e2e` (smoke + content) + `pnpm validate` green.

## Notes

- Depends on B126 (twoslash samples) + B125 (reference link target).
- Supersedes B101's getting-started page. Designer pass at the end (per-page, both palettes).
- `<SpeedClaim>` primitive stays in the codebase; just removed from this page (D17/D20 unchanged
  as constraints).
