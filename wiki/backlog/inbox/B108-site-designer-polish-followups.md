---
id: B108
title: Designer polish — docs H1 top spacing + showcase Regenerate button affordance
type: feature
priority: low
mode: lite
created: 2026-06-06
provenance: B96 per-page designer pass
---

## Description

The B96 per-page designer pass (all 7 routes, post-`@dxlbnl/ui` migration) found
**no blockers** but surfaced two non-blocking polish items. They are arguably
pre-existing design choices rather than migration regressions, so they were filed
here rather than folded into B96.

1. **Docs H1 hugs the nav.** On `/docs` and `/docs/getting-started` the page leads
   with a bare large `<Heading>` and no eyebrow, so the H1 sits tight against the
   (non-sticky) `Nav` — its cap looks marginally clipped. Sibling routes (`/`,
   `/bench`, `/comparison`) lead with an eyebrow that absorbs that space. Add a small
   top offset (`--u`/`--u2`) or an eyebrow to the docs page heading so the H1 doesn't
   kiss the nav.
2. **`/showcase` "Regenerate" affordance.** The Regenerate control is a
   `Button variant="ghost"`, so isolated on its own line under the H1 it reads as a
   stray amber text link rather than an action. Optionally wrap it in an `Inline`
   beside a label, or use a bordered/secondary variant.

The home page's airy vertical rhythm (nit) was judged acceptable — pre-migration
spirit preserved — and is **not** in scope here.

## Notes

- `mode: lite` candidate: cosmetic, behaviour-neutral, ≤2 files, no new dep, no
  contract change. Manager re-checks the lite gate before honoring it. Item 1 may
  also intersect the B94 docs-system work (B101/B103) — if those land first they may
  absorb it; revisit ordering at planning time.
- Screenshots from the B96 designer pass were captured to the gitignored
  `site/test-results/designer/` (ephemeral).
