---
id: B114
title: Site responsive / mobile-first pass + fluid docs reading width
type: feature
priority: high
flags: [review] # auto-flagged: site-wide responsive strategy + shared DocPage shell rework
spec: wiki/specs/B114-site-responsive-mobile-first.md
created: 2026-06-07
provenance: maintainer site review
---

## Description

Maintainer site review (2026-06-07): the site is **not mobile-first**, and on desktop the
docs reading column is too cramped, producing several readability symptoms. Treat the
site's responsive strategy holistically rather than patching each symptom.

### Observed symptoms (all trace to non-fluid / fixed-width layout)

- **Not mobile-first.** The site doesn't read as designed for small screens first. The
  three-column docs shell (left nav + content + right "On this page" rail) almost certainly
  doesn't reflow on narrow viewports.
- **"On this page" TOC entries always wrap** (Getting Started) — the right-rail TOC column
  is too narrow for the heading text, so every entry wraps. (Either widen the rail, shorten
  the headings the TOC pulls from, or reflow.)
- **Concepts "Options" table wraps → unreadable** — the `<ParameterTable>` on `/docs/concepts`
  (World options) is squeezed into the narrow content column and wraps to the point of being
  unreadable. Same root cause as the `/docs/api` table cramping ([[B111]], [[B112]]).
- Cramped desktop **reading width** generally — content sits in a narrow middle track while
  horizontal space is wasted (see [[B111]] for the `/docs/api` version).

### Scope direction (for the spec-writer)

- Define the responsive/mobile-first strategy for the site shell + the `DocPage` three-column
  layout: how nav + content + TOC reflow at breakpoints (e.g. TOC collapses/moves, nav becomes
  a drawer, content goes full-width on mobile).
- Fix the desktop reading width so the content column is comfortably wide and tables/TOC don't
  wrap unreadably.
- Verify on real viewport sizes (Playwright at mobile + tablet + desktop widths; designer pass).

## Notes

- **`@dxlbnl/ui` `<Nav>` 767px boundary is not configurable (gap, 2026-06-07).** At a 768
  viewport the `<Nav>` primitive shows its full inline link list (its hamburger drawer is
  hidden above 767px per `dxlb-ui/docs/navigation.md`), and with seven links (Docs / Explorer
  / Showcase / Comparison / Bench / GitHub / npm) the inline list is cramped and can crowd the
  brand wordmark. `<Nav>` exposes no breakpoint/`collapseBelow` prop, so the site cannot ask
  it to stay in hamburger mode up to a wider width — the link list and drawer threshold are
  internal to the component. Mitigation applied site-side: the `.site-header` keeps `<Nav>` on
  its own flex row with a right gutter and lets the nav flex/shrink rather than overflow; the
  three-step docs reflow (768–1023 = sidebar + prose, no TOC rail) means the cramped-nav band
  is a thin top-bar nit, not a layout breaker. **Upstream fix wanted:** a configurable
  `<Nav>` collapse breakpoint (or a wider hamburger threshold). Tracked here as a `@dxlbnl/ui`
  gap; not in B114 scope to re-implement the drawer.
- Cross-cutting; likely **reframes/absorbs** the narrow-column pieces of [[B111]] (widen
  `/docs/api`) and the table issues in [[B112]] — the manager should reconcile scope when this
  is picked up (don't double-build). The `DocPage` grid (`site/src/lib/docs/widgets/DocPage.svelte`)
  is the shared root.
- High priority: "not mobile-first" is a fundamental UX gap for a public docs site.
- Honors D21 (`@dxlbnl/ui` layer) + D19 (`/` funnel) — the homepage funnel must still hold on mobile.
