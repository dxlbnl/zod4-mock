# B95: Site foundation on `@dxlbnl/ui` — tokens, layout, IA scaffold, delete `/table`

## Context

This spec is the implementation contract for **Phase 1** of the site architecture
rebuild researched in [B84](../backlog/done/B84-site-architecture-rebuild.md). The
authoritative source is the research report at
[`wiki/research/reports/site-architecture-rebuild.md`](../research/reports/site-architecture-rebuild.md)
— §3 (`@dxlbnl/ui` findings), §4 (IA + routes), §8 (adoption plan), and §9 Phase 1.

The work replaces the gen-bench-inherited primitives, design tokens, and layout
chrome with `@dxlbnl/ui@^1.1.1` and scaffolds the new information architecture
(`/comparison` + `/explorer` stubs; `/table` deleted) so subsequent phases land on
a stable foundation. The phase is **visual + structural only** — every route that
worked before must continue to work the same way. It closes
[B76](../backlog/inbox/B76-site-light-theme-qa.md) (light theme via the library's
Paper palette), is already credited as superseding
[B79](../backlog/inbox/B79-site-design-system-scope.md), and partially closes
[B80](../backlog/inbox/B80-playground-integration-decision.md) (the `/playground`
nav slot rebrands to `/explorer`).

Related wiki pages:

- [`wiki/site/architecture.md`](../site/architecture.md) — site stack (SvelteKit 2,
  Svelte 5, Storybook 10, Playwright via `@vitest/browser-playwright`).
- [`wiki/site/vision.md`](../site/vision.md) — funnel D19 protects.
- [`wiki/product/{vision,differentiators,audience}.md`](../product/) — what `/` sells.
- [`wiki/architecture.md`](../architecture.md) — binding **Rules**. This card touches
  **D5** (docs sync), **D17** (CLI benchmark is the citable source), **D18** (mdsvex
  playground hydration pattern — preserved untouched), **D19** (`/` funnel for
  first-time evaluators), and **D20** (honest speed framing).
- Backlog card: [`wiki/backlog/doing/B95-site-foundation-on-dxlbnl-ui.md`](../backlog/doing/B95-site-foundation-on-dxlbnl-ui.md).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

### Notes on UI verification

The site is a browser-enabled surface (Playwright is wired via
`@vitest/browser-playwright` and `pnpm test:component` runs Storybook CSF
`play()` functions in a real browser — see `wiki/site/architecture.md` § Test
setup). UI scenarios in this spec are verified in two ways at this card's scope:

1. **Storybook component tests** (`pnpm site:test:component`) — assertions on
   rendered DOM (visible elements, text, ARIA roles, computed CSS custom-property
   values). One Storybook `play()` per UI requirement is sufficient.
2. **Manual `pnpm site:dev` walk** — the implementer/reviewer boots the dev
   server, opens each route, confirms it renders with no console errors, and
   verifies the Phosphor/Paper palette flip via `document.documentElement.dataset.palette`.

A committed end-to-end Playwright smoke suite over the live routes is **explicitly
deferred to B75** (Phase 5). Phase 1 does not block on it.

## Requirements

### B95-R1: Add `@dxlbnl/ui` as a site dependency

The site **MUST** declare `@dxlbnl/ui` at version `^1.1.1` as a runtime
dependency of the `@zod4-mock/site` package, install cleanly with `pnpm install`,
and resolve the library's exports at type-check time.

- Scenario: dependency declared
  GIVEN `site/package.json`
  WHEN the file is parsed
  THEN `dependencies["@dxlbnl/ui"]` equals `"^1.1.1"` (or a higher 1.x range that
  still satisfies `>=1.1.1 <2.0.0`).

- Scenario: lockfile reflects the new dependency
  GIVEN a clean working tree with `site/package.json` modified
  WHEN `pnpm install` runs from the repository root
  THEN it exits 0, `pnpm-lock.yaml` contains an entry for `@dxlbnl/ui@1.x.y` with
  `x.y >= 1.1`, and the lockfile change is committed alongside the manifest change.

- Scenario: type resolution
  GIVEN the dependency is installed
  WHEN `pnpm site:check` runs
  THEN it exits 0 and `svelte-check` reports no errors for any new
  `import { ... } from '@dxlbnl/ui'` statements introduced by this card.

### B95-R2: Migrate to `@dxlbnl/ui` tokens; preserve identity colours; reserve resolution-rung tokens

`site/src/lib/styles/app.css` **MUST** import the library's two token stylesheets
(`@dxlbnl/ui/tokens/tokens.css` and `@dxlbnl/ui/tokens/typography.css`) as the
sole token source, the legacy `site/src/lib/styles/tokens.css` **MUST** be
deleted, and the three library identity colours **MUST** move into a new
`site/src/lib/styles/identity.css` layered on top of the library tokens.

- Scenario: legacy token file is gone
  GIVEN the repository tree
  WHEN the implementer searches for `site/src/lib/styles/tokens.css`
  THEN the file does not exist and no source file imports it.

- Scenario: library tokens imported once
  GIVEN `site/src/lib/styles/app.css`
  WHEN the file is parsed
  THEN it contains exactly one `@import` of `@dxlbnl/ui/tokens/tokens.css` and
  exactly one `@import` of `@dxlbnl/ui/tokens/typography.css`, and it imports
  `./identity.css` after them.

- Scenario: identity colours preserved
  GIVEN `site/src/lib/styles/identity.css`
  WHEN the file is parsed
  THEN it defines `--lib-zod4mock`, `--lib-zodmock`, and `--lib-faker` on
  `:root` with the existing values (`#a78bfa`, `#fbbf24`, `#34d399`).

- Scenario: resolution-rung tokens reserved (dormant)
  GIVEN `site/src/lib/styles/identity.css`
  WHEN the file is parsed
  THEN it contains a `Resolution rungs` section commented as "future
  Explorer colours; reserved for B90; not consumed yet" that declares
  CSS custom properties named `--rung-matcher`, `--rung-keymap`,
  `--rung-key-based`, `--rung-schema-based`, `--rung-override`,
  `--rung-default`, and `--rung-absent` (values may be placeholders) and
  **no** file under `site/src/` references any `--rung-*` token.

- Scenario (UI): tokens resolve at runtime
  GIVEN `pnpm site:dev` is running and the browser has loaded `/`
  WHEN `getComputedStyle(document.documentElement).getPropertyValue('--u')`
  is evaluated
  THEN it returns a non-empty value (the library's 8px base spacing token),
  confirming `tokens.css` loaded.

### B95-R3: Phosphor default, Paper palette switchable across all routes

The site **MUST** default to the `@dxlbnl/ui` Phosphor (dark) palette, **MUST**
switch fully to the Paper (light) palette when `<html data-palette="paper">` is
set, and the switch **MUST** take effect on every surviving and newly-added
route without route-specific overrides. This closes B76.

- Scenario: default palette is Phosphor
  GIVEN a freshly-loaded route
  WHEN the document's `<html>` element is inspected
  THEN `document.documentElement.dataset.palette` is unset (or `"phosphor"`),
  and `getComputedStyle(document.body).backgroundColor` resolves to the
  Phosphor `--bg` value (a dark colour, not white).

- Scenario: Paper palette flip
  GIVEN a loaded route in Phosphor
  WHEN `document.documentElement.setAttribute('data-palette', 'paper')` is
  executed
  THEN `getComputedStyle(document.body).backgroundColor` resolves to the
  Paper `--bg` value (a light colour) and the change is observable without
  reload.

- Scenario (UI): no `html.light` legacy selector remains
  GIVEN the `site/src/lib/styles/` directory and any global style file
  WHEN the implementer greps for `html.light` selectors
  THEN no `.css` file under `site/src/` contains a `html.light` selector
  (the legacy theme hook is removed; the library's `data-palette` is the
  sole switch).

- Scenario (UI): palette switch works on every route
  GIVEN `pnpm site:dev` is running
  WHEN the reviewer walks `/`, `/bench`, `/showcase`, `/docs/getting-started`,
  `/comparison`, and `/explorer`, sets `data-palette="paper"` on `<html>`
  via DevTools on each, and re-checks the rendered colours
  THEN each route renders cleanly (no invisible text, no transparent
  backgrounds, no console errors).

> R3 does **not** add a theme-toggle UI button — that is a small follow-up
> chore (see Out of scope).

### B95-R4: Replace layout chrome with `@dxlbnl/ui` `Nav` + `Container` + `Stack`

`site/src/routes/+layout.svelte` **MUST** be replaced so that the top-level
chrome composes `@dxlbnl/ui`'s `Nav`, `Container`, and `Stack` primitives and
renders the new top-bar entries in the exact order specified, with the brand
text linking to `/`.

- Scenario: layout uses `@dxlbnl/ui` chrome
  GIVEN `site/src/routes/+layout.svelte`
  WHEN the file is parsed
  THEN it imports `Nav`, `Container`, and `Stack` from `@dxlbnl/ui`, no longer
  imports `$lib/components/Primitives/Button.svelte` for layout chrome, and the
  inline `<nav class="topbar">` block from the legacy layout is gone.

- Scenario (UI): nav entries render in the declared order
  GIVEN `/` is rendered in a browser
  WHEN the reviewer enumerates the visible top-bar links left-to-right
  THEN the visible labels appear in this exact order: `zod4-mock` (brand,
  `href="/"`), `Docs` (`/docs/getting-started` or `/docs`), `Explorer`
  (`/explorer`), `Showcase` (`/showcase`), `Comparison` (`/comparison`),
  `Bench` (`/bench`), then right-aligned `GitHub` (linking to
  `https://github.com/dxlbnl/zod4-mock`) and `npm` (linking to
  `https://www.npmjs.com/package/zod4-mock`).

- Scenario (UI): no `/table` link in the nav
  GIVEN any route is rendered
  WHEN the reviewer inspects the top-bar
  THEN no anchor element with `href="/table"` is present.

### B95-R5: Replace the `/` hero with `PageHero` + `CtaBlock` + `Button`

`site/src/routes/+page.svelte` **MUST** replace the legacy `<header class="hero">`
block with `@dxlbnl/ui`'s `PageHero`, render the install + relational-demo CTAs
via `CtaBlock` and `Button`, and keep the existing inline relational exhibit
(JSON + proof rows) — the chrome around it is restyled but the exhibit itself
stays on the existing `JsonTree` domain widget.

- Scenario: hero composed from `@dxlbnl/ui`
  GIVEN `site/src/routes/+page.svelte`
  WHEN the file is parsed
  THEN it imports `PageHero`, `CtaBlock`, and `Button` from `@dxlbnl/ui` and
  no longer imports `$lib/components/Primitives/Button.svelte`.

- Scenario (UI): hero copy and CTAs render
  GIVEN `/` is rendered
  WHEN the reviewer inspects the hero
  THEN the visible heading text contains `Schema-driven mocks` (honest framing
  per D20 — no "fastest" / "faster than the alternatives" phrasing), a primary
  CTA labelled `Install` links to `/docs/getting-started`, and a secondary CTA
  links to `/showcase`.

- Scenario (UI): inline relational exhibit still renders
  GIVEN `/` is rendered
  WHEN the reviewer scrolls below the hero
  THEN the inline relational exhibit is present: a JSON panel labelled
  `Review (generated)` and at least one proof row showing a highlighted ID
  resolving to a user or product. The `JsonTree` widget is the rendering
  source (not removed).

### B95-R6: Swap primitives to `@dxlbnl/ui`; relocate domain widgets to `site/src/lib/widgets/`

Every call site of the listed legacy primitives **MUST** import the
`@dxlbnl/ui` equivalent instead, and every retained domain widget **MUST**
move from `site/src/lib/components/` to `site/src/lib/widgets/` with all
imports updated accordingly.

| Legacy component (current path under `site/src/lib/components/`)                                                 | Replacement                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Primitives/Button.svelte`                                                                                       | `@dxlbnl/ui` `Button`                                                                            |
| `Surfaces/SummaryCard.svelte`                                                                                    | `@dxlbnl/ui` `StatCard`                                                                          |
| Tab-shaped surfaces — the Showcase entity picker in `site/src/routes/showcase/+page.svelte`, any docs route tabs | `@dxlbnl/ui` `Tabs`                                                                              |
| `Surfaces/FeatureMatrix.svelte` chrome (header + grid scaffolding)                                               | `@dxlbnl/ui` `Table` with the existing ✓/✗/partial/na cell renderer preserved as a domain widget |

The following widgets **MUST** move from `site/src/lib/components/`
into a new `site/src/lib/widgets/` directory (preserving their current
sub-categorisation as flat sibling folders or files): `Bench/BenchChart`,
`Bench/MetricBadge`, `Bench/WinnerCallout`, `Bench/LibraryLegend`,
`Showcase/JsonTree`, `Showcase/RelationCallout`, `Showcase/CodePanel`,
`Docs/Editor`, `Docs/SchemaPlayground`, `Docs/CodeBlock`,
`Primitives/RangeSlider`, `Primitives/SegmentedControl`, and the
`FeatureMatrix` cell renderer extracted in the bullet above.

- Scenario: no Svelte file under `site/src/` imports the legacy primitives
  GIVEN the post-migration tree
  WHEN the implementer searches for imports of
  `$lib/components/Primitives/Button.svelte`,
  `$lib/components/Surfaces/SummaryCard.svelte`, or
  `$lib/components/Surfaces/FeatureMatrix.svelte` (the whole file, not the
  cell renderer) outside their own files
  THEN no matches are found.

- Scenario: domain widgets live under `widgets/`
  GIVEN the post-migration tree
  WHEN the directory `site/src/lib/widgets/` is listed
  THEN it contains `BenchChart.svelte`, `MetricBadge.svelte`,
  `WinnerCallout.svelte`, `LibraryLegend.svelte`, `JsonTree.svelte`,
  `RelationCallout.svelte`, `CodePanel.svelte`, `Editor.svelte`,
  `SchemaPlayground.svelte`, `CodeBlock.svelte`, `RangeSlider.svelte`,
  `SegmentedControl.svelte`, and the extracted `FeatureMatrix` cell
  renderer (e.g. `FeatureMatrixCell.svelte`); the corresponding files
  no longer exist under `site/src/lib/components/`.

- Scenario: import paths updated
  GIVEN the post-migration tree
  WHEN the implementer searches for `$lib/components/Bench/`,
  `$lib/components/Showcase/`, `$lib/components/Docs/`,
  `$lib/components/Primitives/RangeSlider`,
  `$lib/components/Primitives/SegmentedControl`
  THEN no matches are found in `site/src/`; every former importer now reads
  from `$lib/widgets/`.

- Scenario (UI): bench page still renders the chart and metrics
  GIVEN `/bench` is rendered
  WHEN the reviewer triggers the benchmark via the page UI
  THEN the chart canvas (`BenchChart`) renders, three `MetricBadge` rows
  populate, the `WinnerCallout` resolves, and `LibraryLegend` is visible —
  all using the relocated widgets.

- Scenario (UI): showcase entity picker uses `Tabs`
  GIVEN `/showcase` is rendered
  WHEN the reviewer inspects the entity picker chrome
  THEN it is rendered via the `@dxlbnl/ui` `Tabs` component (tablist role
  present), not the legacy `SegmentedControl` tab affordance, and clicking
  a tab swaps the displayed entity panel.

- Scenario (UI): feature matrix is a `Table` with the custom cell renderer
  GIVEN `/` is rendered
  WHEN the reviewer inspects the feature comparison section
  THEN the table chrome is `@dxlbnl/ui` `Table` (a `<table>` whose
  generated class names trace to the library), and the ✓/✗/partial/na
  glyphs are rendered by the extracted `FeatureMatrixCell` domain widget
  in each value cell.

### B95-R7: Add `/comparison` and `/explorer` route stubs

The site **MUST** add `site/src/routes/comparison/+page.svelte` and
`site/src/routes/explorer/+page.svelte`, each rendering an `@dxlbnl/ui`
`PageHero` placeholder that names the phase the content lands in plus a
link back to `/`. Both routes **MUST** resolve cleanly under
`pnpm site:check`.

- Scenario: route files exist
  GIVEN the post-migration tree
  WHEN the implementer searches for the routes
  THEN `site/src/routes/comparison/+page.svelte` and
  `site/src/routes/explorer/+page.svelte` exist.

- Scenario: type-check passes
  GIVEN the two new route files
  WHEN `pnpm site:check` runs
  THEN it exits 0 with no errors mentioning either new route.

- Scenario (UI): `/comparison` placeholder copy
  GIVEN the route `/comparison` is rendered
  WHEN the reviewer inspects the page
  THEN a `PageHero` is rendered whose visible text contains the substring
  `Coming in Phase 3` and a visible link with `href="/"` is present.

- Scenario (UI): `/explorer` placeholder copy
  GIVEN the route `/explorer` is rendered
  WHEN the reviewer inspects the page
  THEN a `PageHero` is rendered whose visible text contains the substring
  `Coming in Phase 4` and a visible link with `href="/"` is present.

### B95-R8: Delete the `/table` route and every link to it

The site **MUST NOT** contain a `/table` route, **MUST NOT** contain any
anchor or programmatic navigation targeting `/table`, and **MUST NOT**
ship the `site/src/lib/components/Table/` directory (its widgets are not
part of the post-migration surface).

- Scenario: route directory deleted
  GIVEN the post-migration tree
  WHEN the implementer searches for `site/src/routes/table/`
  THEN the directory and all of its files (`+page.svelte`, etc.) do not exist.

- Scenario: no /table link in source
  GIVEN the post-migration tree of `site/src/` and `site/content/`
  WHEN the implementer searches for the substring `"/table"` (as an `href` or
  navigation target) in `.svelte`, `.ts`, `.md` files
  THEN no matches are found (only the predecessor card's mention of the
  deletion may exist, and that lives in `wiki/`, not `site/`).

- Scenario: Table widgets removed
  GIVEN the post-migration tree
  WHEN the implementer searches for `site/src/lib/components/Table/`
  and `site/src/lib/widgets/DataTable.svelte`
  THEN neither path exists.

- Scenario (UI): `/table` returns 404
  GIVEN `pnpm site:dev` is running
  WHEN the reviewer navigates to `/table`
  THEN SvelteKit renders the default 404 page (no console error other than
  the expected 404), confirming the route was removed and not merely
  re-styled.

### B95-R9: Trim Storybook stories superseded by `@dxlbnl/ui`

The site's Storybook surface **MUST** delete the foundations and primitive
re-export stories enumerated below; domain-widget stories **MUST** stay (they
move alongside their widgets per R6).

The following stories **MUST** be deleted (full enumeration):

- `site/src/lib/components/Foundations/Color.stories.svelte`
- `site/src/lib/components/Foundations/Spacing.stories.svelte`
- `site/src/lib/components/Foundations/Typography.stories.svelte`
- `site/src/lib/components/Primitives/Button.stories.svelte`
- `site/src/lib/components/Primitives/Input.stories.svelte`
- `site/src/lib/components/Surfaces/SummaryCard.stories.svelte`
- `site/src/lib/components/Surfaces/FeatureMatrix.stories.svelte` (the
  legacy chrome story; if the implementer adds a story for the new
  `FeatureMatrixCell` widget it lives under `widgets/` per R6)
- `site/src/lib/components/Table/DataTable.stories.svelte` and
  `site/src/lib/components/Table/TimingBadge.stories.svelte` (deleted with
  the `/table` removal in R8)

The following stories **MUST** be retained (they may be moved to a sibling
of their relocated widget under `site/src/lib/widgets/`): `BenchChart`,
`MetricBadge`, `WinnerCallout`, `LibraryLegend`, `JsonTree`, `RelationCallout`,
`CodePanel`, `Editor`, `SchemaPlayground`, `RangeSlider`, `SegmentedControl`.

- Scenario: foundations stories deleted
  GIVEN the post-migration tree
  WHEN the implementer searches for `site/src/lib/components/Foundations/`
  THEN the directory and its `*.stories.svelte` files do not exist.

- Scenario: primitive re-export stories deleted
  GIVEN the post-migration tree
  WHEN the implementer enumerates `*.stories.svelte` files
  THEN no story file exists for the legacy `Primitives/Button`, `Primitives/Input`,
  `Surfaces/SummaryCard`, the legacy `Surfaces/FeatureMatrix` chrome, or any
  `Table/` component.

- Scenario: domain widget stories retained
  GIVEN the post-migration tree
  WHEN the implementer enumerates `*.stories.svelte` files under
  `site/src/lib/widgets/`
  THEN stories for `BenchChart`, `MetricBadge`, `WinnerCallout`,
  `LibraryLegend`, `JsonTree`, `RelationCallout`, `CodePanel`, `Editor`,
  `SchemaPlayground`, `RangeSlider`, and `SegmentedControl` are present
  (file names match the widget files).

- Scenario: Storybook boots
  GIVEN the post-migration tree
  WHEN `pnpm site:storybook` is started
  THEN Storybook starts without an error and the trimmed sidebar contains
  no entries under a `Foundations/` or `Primitives/Button|Input|SummaryCard`
  group.

### B95-R10: No-new-behaviour invariant — full validation pipeline stays green

After R1–R9 land, the full validation pipeline **MUST** be green and the six
in-scope routes **MUST** render with no console errors. Phase 1 is a visual +
structural refactor, not a behaviour change.

- Scenario: root validate passes
  GIVEN the post-migration tree
  WHEN `pnpm validate` runs at the repository root
  THEN it exits 0.

- Scenario: site type-check passes
  GIVEN the post-migration tree
  WHEN `pnpm site:check` runs
  THEN it exits 0.

- Scenario: site unit tests pass
  GIVEN the post-migration tree
  WHEN the site's unit tests run (`pnpm --filter @zod4-mock/site test:unit`,
  exposed at the root as `pnpm site:test:unit` if the alias is added; see
  Open questions)
  THEN they exit 0.

- Scenario: site component tests pass
  GIVEN the post-migration tree
  WHEN the site's Storybook play-test suite runs
  (`pnpm --filter @zod4-mock/site test:component`, exposed at the root as
  `pnpm site:test:component` if the alias is added)
  THEN it exits 0.

- Scenario (UI): all six in-scope routes render cleanly
  GIVEN `pnpm site:dev` is running and the browser DevTools console is open
  WHEN the reviewer navigates to each of `/`, `/bench`, `/showcase`,
  `/docs/getting-started`, `/comparison`, and `/explorer`
  THEN each route renders its primary content, the DevTools console shows
  no `error`-level messages, and no unhandled promise rejection is logged.

- Scenario: integration test suite unaffected
  GIVEN the library's `tests/integration/` snapshots
  WHEN `pnpm test:all` runs
  THEN no integration snapshot is re-pinned by this card — the library
  test suite is untouched.

## Out of scope

- **Docs system rebuild.** The `/docs` route stays as-is at Phase 1.
  Replacement is gated on [B94](../backlog/inbox/B94-docs-system-design.md)
  (Phase 2).
- **`/comparison` content.** Phase 3 (consumes B83).
- **`/explorer` widgets and `world.trace()` library work.** Phase 4 (B85–B88, B90).
- **Bench rebuild** (worker, time-budget, progress/abort, schema unify):
  Phase 3 (B69, B70, B71, B72, B73).
- **Theme toggle UI in `Nav`.** Per the card's `Notes` and the research
  report §11 Q1 — a small follow-up chore, not part of B95. R3 only verifies
  the `data-palette` switch works; the visible toggle button is deferred.
- **Vercel redeploy** at `zod4-mock.vercel.app`. [B82](../backlog/inbox/B82-vercel-deploy-from-site-subdir.md),
  after this card lands.
- **Playwright end-to-end smoke suite over `/`, `/bench`, `/showcase`,
  `/docs/getting-started`, `/comparison`, `/explorer`.** Deferred to
  [B75](../backlog/inbox/B75-site-playwright-smoke.md) (Phase 5). UI
  verification at this card's scope is Storybook `play()` tests + manual
  `pnpm site:dev` walk.
- **Storybook audit of the post-migration surface.** [B78] (Phase 5).
- **mdsvex playground rewrite** (D18 stays untouched; `SchemaPlayground`
  relocates per R6 but its internals do not change).
- **`@dxlbnl/ui` library forks or vendoring.** Per the card's
  `Constraints` — gaps surface as `@dxlbnl/ui` issues filed against the
  maintainer's repo and tracked in the card's `## Notes`.

## Open questions

### Non-blocking (all answered by maintainer 2026-06-03)

1. **`@dxlbnl/ui` component prop signatures.** **ANSWERED**: the
   implementer **MUST** read prop signatures, token names, and palette
   inspiration from `/home/dexter/Projects/Web/dxlb-ui/docs/` (the local
   source documentation), **NOT** from `node_modules/@dxlbnl/ui/dist/`.
   Reading published `.d.ts` artifacts out of `node_modules` is forbidden
   for this dep — the local docs are the source of truth (rationale
   recorded in memory `reference-dxlb-ui-docs.md`: docs answer "what's
   intended" rather than "what was published"). If the prop signature
   for a needed affordance (e.g. right-aligned `Nav` CTA group) isn't in
   the docs, surface as a `@dxlbnl/ui` issue per the card's Constraints
   block and note in the card's `## Notes`.

2. **`pnpm site:test:unit` and `pnpm site:test:component` root aliases.**
   **ANSWERED**: yes, add them — the implementer adds the two missing
   aliases to root `package.json` as part of R10 (one or two lines,
   behaviour-neutral). Broader root-script cleanup is a "some day"
   chore that can be filed separately when the moment is right; not
   part of B95's scope.

3. **Resolution-rung token values.** **ANSWERED**: the implementer
   **MUST** take inspiration from `@dxlbnl/ui`'s existing colour palette
   (Phosphor + Paper, plus the named accents amber / cyan / danger /
   ok per the research report §3) — read
   `/home/dexter/Projects/Web/dxlb-ui/docs/` to find the right semantic
   colours. Map roughly: `--rung-matcher` and `--rung-keymap` to the
   "intentional / wired" semantic (likely cyan / ok-green family),
   `--rung-key-based` to a softer realism-cue, `--rung-override` and
   `--rung-default` to amber (pinned / wrapper), `--rung-schema-based`
   to a neutral grey, `--rung-absent` to a dashed/faded variant.
   Final colours go in `identity.css`'s `Resolution rungs` section.
   B90 may refine later but the values committed in B95 stand as
   defaults.

4. **Identity-colour layering convention in `@dxlbnl/ui`.** **ANSWERED**:
   `@dxlbnl/ui` does not have an `@layer` convention today. The
   implementer **MUST** introduce one in `site/src/lib/styles/app.css`
   by declaring CSS `@layer` order: `@layer dxlbnl, site;` (or
   equivalent), importing the library's `tokens.css` + `typography.css`
   into the `dxlbnl` layer and `identity.css` into the `site` layer.
   This makes the override order explicit rather than dependent on
   import order. If `@dxlbnl/ui` later adopts a layer convention, the
   site updates to match (a small follow-up chore).

5. **Domain-widget relocation atomic vs. follow-up.** R6 makes the
   `components/ → widgets/` move part of this card. **Decision baked in**:
   yes, in scope. Rationale: every former importer is changing in this
   card anyway (R6 swaps primitives, R8 deletes Table), so doing the
   rename in the same commit locks the boundary without an extra
   import-update pass.

### Blocking

None at spec-writing time. The card's Constraints block already names
the dispute-resolution path for any `@dxlbnl/ui` gap discovered during
implementation (file a `@dxlbnl/ui` issue + note in the card's
`## Notes`); none of the listed primitives (`Nav`, `Container`, `Stack`,
`PageHero`, `CtaBlock`, `Button`, `StatCard`, `Tabs`, `Table`) is
flagged absent in the research report's §3 inventory.
