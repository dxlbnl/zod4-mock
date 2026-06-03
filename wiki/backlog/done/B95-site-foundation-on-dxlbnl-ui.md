---
id: B95
title: Phase 1 — site foundation on @dxlbnl/ui (tokens + layout + IA scaffold; delete /table)
type: feature
priority: high
flags: [review]
created: 2026-06-03
predecessor: B84
phase: 1
spec: wiki/specs/B95-site-foundation-on-dxlbnl-ui.md
---

## Description

First implementable Phase of B84's site architecture rebuild. Replaces the
gen-bench-inherited primitives, layout chrome, and design tokens with
`@dxlbnl/ui@^1.1.1`. Scaffolds the new IA (`/comparison` + `/explorer` route
stubs; deletes `/table`) so subsequent phases can fill in content. **No new
behaviour beyond visual + structural change** — the site keeps doing what it
does today, just on the new chrome.

### Scope (each requirement gets a B95-R<k> ID at spec-writing time)

1. **Add `@dxlbnl/ui@^1.1.1` to `site/package.json`** as an `npm` dep.
   Run `pnpm install`; lockfile updates committed.
2. **Token migration.** Import `@dxlbnl/ui/tokens/tokens.css` and
   `@dxlbnl/ui/tokens/typography.css` from `site/src/lib/styles/app.css`.
   Delete `site/src/lib/styles/tokens.css`. Move the three identity colours
   (`--lib-zod4mock`, `--lib-zodmock`, `--lib-faker`) into a new
   `site/src/lib/styles/identity.css` layered on top, plus the new
   resolution-rung tokens reserved for B90 (commented as future Explorer
   colours; not used yet).
3. **Light theme**: confirm `<html data-palette="paper">` toggle works
   across all routes. No toggle UI in `Nav` yet (deferred to a small chore
   later); default stays `phosphor` (dark). Closes B76.
4. **Layout chrome swap.** Replace `site/src/routes/+layout.svelte` with
   `@dxlbnl/ui` `Nav` + `Container` + `Stack`. Nav entries (in order, left
   to right): brand wordmark "zod4-mock" (links to `/`), `[Docs]`,
   `[Playground]`-→-`[Explorer]` (route stub), `[Showcase]`, `[Comparison]`
   (route stub), `[Bench]`, right-aligned `GitHub` + `npm`.
5. **Hero + landing.** Replace `site/src/routes/+page.svelte`'s hero block
   with `@dxlbnl/ui` `PageHero` + `CtaBlock` + `Button`. Keep the inline
   relational exhibit (Showcase preview) on tokens; restyle its
   surrounding chrome.
6. **Primitive replacement** — swap every callsite of:
   - `Primitives/Button` → `@dxlbnl/ui` `Button`
   - `Surfaces/SummaryCard` → `@dxlbnl/ui` `StatCard`
   - Tab-shaped surfaces (Showcase entity picker, Docs route tabs if any)
     → `@dxlbnl/ui` `Tabs`
   - `Surfaces/FeatureMatrix` chrome → `@dxlbnl/ui` `Table` (keep the
     custom ✓/✗/partial cell renderer as a domain widget)
     `RangeSlider`, `SegmentedControl`, `BenchChart`, `MetricBadge`,
     `WinnerCallout`, `LibraryLegend`, `JsonTree`, `RelationCallout`,
     `CodePanel`, `Editor`, `SchemaPlayground` stay as **domain widgets**
     under `site/src/lib/widgets/` (move them out of `components/` to mark
     the boundary; update imports).
7. **Route stubs.** Add `site/src/routes/comparison/+page.svelte` and
   `site/src/routes/explorer/+page.svelte` — minimal pages that render an
   `@dxlbnl/ui` `PageHero` "Coming in [Phase 3 / Phase 4]" + a link back
   to home. Both routes resolve cleanly in `pnpm site:check`.
8. **Delete `/table`.** Remove `site/src/routes/table/` entirely. Any link
   into `/table` (from `+layout.svelte`'s nav, or anywhere else) goes away
   in the same edit.
9. **Storybook trim.** Delete the `site/src/lib/components/Foundations/`
   stories (Color, Typography, Spacing) — superseded by `@dxlbnl/ui`'s
   upstream Storybook. Delete the `Primitives/Button.stories.svelte`,
   `Input.stories.svelte`, `SummaryCard.stories.svelte` stories for the
   primitives that are now `@dxlbnl/ui` re-exports. Domain widget stories
   stay. (B78 will audit the post-trim state in Phase 5.)
10. **No new behaviour.** Every route that worked before still works.
    `pnpm site:check` green; `pnpm site:test:unit` green; `pnpm
site:test:component` green; `pnpm site:dev` boots; the four surviving
    routes (`/`, `/bench`, `/showcase`, `/docs/getting-started`) plus the
    two new stubs (`/comparison`, `/explorer`) render with no console
    errors.

### Out of scope (filed as later phases)

- Docs system (Phase 2, gated on [B94](B94-docs-system-design.md)).
- `/comparison` content (Phase 3, consumes B83).
- `/explorer` route widgets (Phase 4b, gated on B85–B88).
- Bench rebuild (Phase 3 — B69, B70, B71, B72, B73).
- Theme toggle UI in `Nav` (small chore later).
- Vercel redeploy at `zod4-mock.vercel.app` ([B82](B82-vercel-deploy-from-site-subdir.md), after this card lands).

### Constraints

- **`@dxlbnl/ui` is the maintainer's package** (B84 §10 Q1/Q2). Gaps you
  hit during migration (a missing component, an off-token chip, a needed
  variant) get **filed as `@dxlbnl/ui` issues** for the maintainer to
  publish; do not fork or vendor the library inline. Note each gap in
  this card's `## Notes` as you go so we can roll them into the next
  `@dxlbnl/ui` version request.
- **Honesty rules (D17, D20)** continue to bind any copy that mentions
  speed — the hero copy on `/` cites the CLI baseline; no "fastest"
  framing without a cite.
- **D18** (mdsvex playground hydration) untouched — the docs route stays
  as-is at Phase 1; B94's design replaces it later.
- **Visual diff only** — no test re-pinning (no integration-test fixture
  changes); the library test suite is unaffected.

### Acceptance

- `pnpm install` clean.
- `pnpm validate` green at the root.
- `pnpm site:check` green.
- `pnpm site:test:unit` green.
- `pnpm site:test:component` green.
- `pnpm site:dev` boots; `/`, `/bench`, `/showcase`, `/docs/getting-started`,
  `/comparison`, `/explorer` render with no console errors.
- Visual confirmation in browser: site uses Phosphor (dark) tokens; switching
  `<html data-palette="paper">` flips to Paper (light) cleanly.
- `/table` route gone; no broken links.
- Storybook (`pnpm site:storybook`) boots; trimmed surface (no `Foundations/`,
  no primitive stories for things that are now `@dxlbnl/ui` re-exports).

### Notes

- Predecessor: [B84](../done/B84-site-architecture-rebuild.md) §8 + §9 Phase 1.
- Closes [B76](B76-site-light-theme-qa.md) (light theme via `@dxlbnl/ui`
  Paper palette), [B79](B79-site-design-system-scope.md) (already
  superseded), partially closes [B80](B80-playground-integration-decision.md)
  (the `/playground` nav slot rebrands to `/explorer`).
- Single-shot replacement is risky for a SvelteKit + Storybook + Vitest
  setup; the spec-writer should consider whether to chunk this into
  sub-cards (tokens-only first, then chrome, then primitive swap) — but the
  research recommends keeping Phase 1 as one shippable unit.
