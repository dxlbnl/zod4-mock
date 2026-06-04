---
id: B96
title: Finish the @dxlbnl/ui migration — replace remaining HTML/CSS layout + legacy tokens
type: feature
priority: high
flags: [review]
created: 2026-06-04
predecessor: B95
phase: 1
---

## Description

B95 (Phase 1 of B84) brought `@dxlbnl/ui` into `site/` but its R6 scope was
narrow: primitive swap (`Button` / `StatCard` / `Tabs` / `Table`-as-
`FeatureMatrix`) + domain-widget relocation. **Route bodies are still
half-and-half**: plain `<div>` containers with hand-rolled `display: flex;
flex-direction: column; gap: var(--space-N);` CSS, legacy typography
classes (`.t-title` / `.t-small` / `.t-caption` / `.t-label`), and legacy
token names (`--space-*` / `--rule` / `--bg-rail` / `--ink-dim`) that
`app.css` kept alive as compat aliases.

Example: `site/src/routes/bench/+page.svelte` imports only `Button` from
`@dxlbnl/ui` despite having 14 plain `<div>` containers + a 65-line `<style>`
block of hand-rolled flex/gap CSS. `Card` / `Stack` / `Inline` / `Container`
/ `Heading` / `Text` are nowhere.

This card closes the gap: every route's layout containers, typography, and
spacing token names move to `@dxlbnl/ui`, and the legacy-token compat aliases
in `app.css` (`--space-*`, `--rule`, `--bg-rail`, etc.) are deleted once
nothing reads them.

### Scope (each requirement gets a B96-R<k> ID at spec-writing time)

1. **Inventory** — list every route body + every shared widget under
   `site/src/lib/widgets/` that still uses plain HTML/CSS layout or legacy
   token names. Spec-writer enumerates; implementer follows.
2. **Layout container swap** — replace `<div class="page">` (column flex w/
   gap), `.controls` (row flex), `.slider-wrap`, `.results`, `.chart-section`,
   `.legend-row`, `.badges`, `.badge-group`, `.note`, and analogues across
   routes with `@dxlbnl/ui` primitives:
   - Column flex w/ gap → `Stack`
   - Row flex w/ gap → `Inline`
   - Card-like surface (border + bg + padding) → `Card`
   - Page-width wrapper → `Container`
   - Grid layouts → `Grid`
3. **Typography classes → components** — replace `.t-title` / `.t-small` /
   `.t-caption` / `.t-label` / `.t-large` / `.t-base` / `.t-micro` /
   `.t-mono` / `.t-num` usages with `@dxlbnl/ui`'s `Heading` and `Text`
   components (with the right size/weight props).
4. **Legacy-token name migration** — replace every `var(--space-N)`,
   `var(--rule)`, `var(--bg-rail)`, `var(--ink-dim)`, etc. with the
   `@dxlbnl/ui` token equivalents (`--u<N>`, `--bg-elev`, `--ink-dim`,
   etc.). Read `/home/dexter/Projects/Web/dxlb-ui/docs/` for the canonical
   names (per memory `reference-dxlb-ui-docs.md`).
5. **Delete legacy compat aliases** — once nothing reads `--space-*` /
   `--rule` / `--bg-rail` / `--ink-dim` / `.t-*` classes, remove them from
   `site/src/lib/styles/app.css`. The site relies on `@dxlbnl/ui` tokens
   directly.
6. **Domain widgets** — widgets under `site/src/lib/widgets/` that have
   internal layout (`BenchChart`, `JsonTree`, `RelationCallout`,
   `FeatureMatrix`, `RangeSlider`, `SegmentedControl`, etc.) follow the
   same migration. Custom drawing logic stays (Chart.js, SVG, etc.);
   chrome around it goes to `@dxlbnl/ui`.
7. **No behaviour change** — every route still functions identically;
   visual layout matches the pre-migration spirit (column gaps, card
   chrome, etc.). Storybook stories continue to pass; `pnpm site:dev`
   walks across all routes show no regressions; `pnpm validate` green.

### Out of scope

- Phase 3 bench rebuild (B69 / B70 / B71 / B72 / B73 — worker + schemas +
  budget + progress/abort + cold-start drop). This card migrates the
  **chrome** of `/bench`; the bench itself is rebuilt in Phase 3.
- Phase 4b `/explorer` widgets (B90). Stub stays as is until Phase 4.
- Docs system (B94 / Phase 2). The `/docs/[slug]` route migrates its
  visible chrome; the docs **system** redesign is separate.

### Constraints

- **`@dxlbnl/ui` API references**: read `/home/dexter/Projects/Web/dxlb-ui/docs/`,
  NEVER `node_modules` (per memory `reference-dxlb-ui-docs.md`).
- D17 / D20 honest-framing copy preserved on `/` and any speed-citing copy.
- D18 `SchemaPlayground` internals untouched.
- D19 `/` funnel preserved (relational proof + Install CTA above the fold).
- D21 layer convention (`@layer dxlbnl, site;`) preserved.
- Gaps in `@dxlbnl/ui` surfaced during implementation — file as upstream
  issues; note in card `## Notes`; compose around them with `Stack`/`Inline`
  glue or escalate to the reviewer per B95's precedent.

### Acceptance

- `pnpm validate` green.
- `pnpm site:check` 0 errors.
- `pnpm site:test:unit` + `pnpm site:test:component` green.
- `pnpm site:dev` boots; visual walk of `/`, `/bench`, `/showcase`,
  `/docs/getting-started`, `/comparison`, `/explorer` shows no
  regression from B95's state (modulo the deliberate token / layout
  primitive swap).
- `git grep` for `var(--space-` / `var(--rule)` / `class="t-` returns
  zero hits in `site/src/`.
- `site/src/lib/styles/app.css` no longer carries the legacy compat
  aliases.

### Notes

- This card is the natural follow-up to [B95](B95-site-foundation-on-dxlbnl-ui.md);
  it closes the spec gap B95's R6 scoped narrowly to primitive swaps.
- Spec-writer enumerates the full file inventory; the bench example above
  is illustrative, not exhaustive.
- B95's manager-time framing was "Phase 1 ships when chrome migrates"; B96
  is "Phase 1 is _actually_ done when route bodies migrate too". Together
  they complete Phase 1.
- Could conceivably be chunked (one card per route) but recommendation is
  one card: every file the migration touches shares the same patterns,
  and a piecemeal migration leaves a half-and-half state for longer.
