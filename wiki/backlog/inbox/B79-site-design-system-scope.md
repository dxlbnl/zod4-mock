---
id: B79
title: Scope a site design system (research)
type: research
priority: medium
flags: [review]
created: 2026-06-03
provenance: gen-bench DS
---

## Description

gen-bench's UI grew ad-hoc — primitives in `site/src/lib/components/Primitives/`,
surfaces in `Surfaces/`, page-specific composites in `Bench/`/`Showcase/`/
`Table/`. The DS card asks whether to invest in a proper design system layer
(tokens → primitives → composites with documented usage) or to keep the current
case-by-case approach and refactor opportunistically.

Outputs:

1. Inventory of current components by category and reuse count.
2. Two paths forward with cost estimates: (A) build a documented DS, (B)
   continue case-by-case.
3. Recommendation, surfaced for maintainer review.

Acceptance: research report at `wiki/research/reports/site-design-system-scope.md`;
review-flagged for the maintainer to pick A vs B.
