---
id: B70
title: Unify CLI + browser bench schema set
type: feature
priority: high
flags: [review]
created: 2026-06-03
provenance: gen-bench P2-schemas
---

## Description

`site/bench/` (CLI) and `site/src/lib/schemas/` (browser) define overlapping but
not-identical schema sets (simple / user / nested / array / ecommerce). Drift makes
the two benchmark tiers incomparable. Promote a single canonical schema set under
`site/src/lib/schemas/`, consumed by both harnesses.

Acceptance: removing a schema from `site/src/lib/schemas/` removes it from both
`pnpm site:bench` (CLI) and `/bench` (browser) without further edits.

## Notes

- Gates on B83 (ecosystem survey) — survey may name new schema shapes (e.g.
  discriminated-union-heavy, refine-heavy) the unified set should cover.
