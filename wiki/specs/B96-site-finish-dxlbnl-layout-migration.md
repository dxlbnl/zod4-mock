# B96: Finish the `@dxlbnl/ui` migration — replace remaining HTML/CSS layout + legacy tokens

## Context

[B95](B95-site-foundation-on-dxlbnl-ui.md) (Phase 1 of the [B84](../backlog/done/B84-site-architecture-rebuild.md)
site rebuild) brought `@dxlbnl/ui@^1.1.1` into `site/`, but its **R6** scope was
narrow: a primitive swap (`Button` / `StatCard` / `Tabs` / `Table`-as-`FeatureMatrix`)
plus a domain-widget relocation into `site/src/lib/widgets/`. Route **bodies** and
widget **internals** were left half-and-half: plain `<div>` containers with hand-rolled
`display: flex; flex-direction: column; gap: var(--space-N)` CSS, legacy typography
classes (`.t-title` / `.t-small` / `.t-caption` / `.t-label` / `.t-large` / `.t-base` /
`.t-micro` / `.t-mono` / `.t-num`), and gen-bench-inherited legacy token aliases
(`--space-*`, `--bg-base`, `--text-primary`, `--border`, `--accent`, `--syn-*`, …) that
`site/src/lib/styles/app.css` keeps alive as compat aliases pointing at the real
`@dxlbnl/ui` tokens.

This card closes that gap. It is the natural follow-up to B95 and, together with it,
completes Phase 1: every route's layout containers, typography, and spacing-token names
move to `@dxlbnl/ui` primitives/tokens, and the legacy compat-alias block in `app.css`
is deleted once nothing reads it. The change is **behaviour-neutral** — a visual +
structural refactor, not a feature change — so the contract below is built around
**objectively checkable invariants** (zero legacy-token / legacy-class hits, the deleted
alias block, type-check / component-test / e2e-smoke green) rather than new behaviour.

Backlog card:
[`wiki/backlog/doing/B96-site-finish-dxlbnl-layout-migration.md`](../backlog/doing/B96-site-finish-dxlbnl-layout-migration.md).

Related wiki pages and constraints:

- [`wiki/architecture.md`](../architecture.md) — binding **Rules**. This card touches and
  **MUST** comply with **D17** / **D20** (honest speed framing on `/` and any speed copy),
  **D18** (mdsvex playground fence base64 hydration — untouched), **D19** (`/` funnel —
  relational proof + Install CTA above the fold — preserved), **D21** (`@layer dxlbnl, site;`
  ordering in `app.css` — preserved), and **D22** (`SchemaPlayground` / docs editor SSR
  mounting — internals untouched, see Out of scope).
- [`wiki/specs/B75-site-playwright-smoke.md`](B75-site-playwright-smoke.md) — the live-route
  smoke suite (`site/e2e/smoke.spec.ts`, run via `pnpm site:test:e2e`) is this card's
  **behavioural regression anchor**: 7 routes, currently 7/7 green.
- [`wiki/decisions.md`](../decisions.md) — D17–D22 rationale.
- `@dxlbnl/ui` API/token canonical names: read
  `/home/dexter/Projects/Web/dxlb-ui/docs/` (`layout.md`, `primitives.md`, `cards.md`,
  `design-tokens.md`), **never** `node_modules` (per memory `reference-dxlb-ui-docs.md`).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

### Notes on UI verification

The site is browser-enabled. UI scenarios in this card are verified by:

1. The committed **B75 Playwright smoke suite** (`pnpm site:test:e2e`) over the live
   routes — the behavioural anchor for "every route still functions" (no `console.error`,
   no `pageerror`, no SSR 500 across the 7-route table).
2. **Storybook component tests** (`pnpm site:test:component`) — DOM assertions on the
   relocated widgets that already carry stories.
3. A reviewer **`pnpm site:dev` walk** of the in-scope routes (Chrome DevTools MCP) as a
   final visual confirmation.

This card deliberately does **not** add a heavy new test surface — the migration is
behaviour-neutral, so the existing smoke + component nets are the regression contract.

### Legacy → `@dxlbnl/ui` equivalence map (pinned; implementer follows, does not re-derive)

Pinned from `/home/dexter/Projects/Web/dxlb-ui/docs/`. The implementer uses these
mappings; nearest-variant judgement is allowed where a legacy size has no exact token
(the card mandates "pre-migration spirit", not pixel-identical output).

**Layout primitives** (`docs/layout.md`):

| Legacy pattern (hand-rolled CSS)                                  | `@dxlbnl/ui` primitive |
| ----------------------------------------------------------------- | ---------------------- |
| Column flex with gap (`display:flex; flex-direction:column; gap`) | `Stack` (`gap` prop)   |
| Wrapping row flex with gap (`display:flex; gap`)                  | `Inline` (`gap` prop)  |
| Row split to opposite ends (`justify-content:space-between`)      | `Spread`               |
| Card-like surface (border + `--bg-rail` + padding)                | `Card` (pad inside)    |
| Page-width centred wrapper (`max-width` + auto margins)           | `Container` (`size`)   |
| CSS grid of N columns / responsive auto-fill                      | `Grid` (`cols`, `gap`) |
| `<hr>` / 1px divider rule                                         | `Rule` (`variant`)     |

`Stack`/`Inline`/`Grid` `gap` token mapping (`docs/layout.md`): `none`=0, `xs`=`--u`
(8px), `sm`/`md`=`--u2` (16px), `lg`=`--u4` (32px), `xl`=`--u5` (40px). Pick the gap
keyword whose resolved pixel value is nearest the legacy `gap`.

**Typography** (`docs/primitives.md` `Text` / `Heading`; sizes in `docs/design-tokens.md`):

| Legacy class (def in `app.css`)       | `@dxlbnl/ui` component (nearest variant)                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `.t-large` (28px / 600)               | `Heading level={3} variant="h3"` (24px) or larger head                                              |
| `.t-title` (20px / 600)               | `Heading level={3}` (h3) or `Text variant="lede"` (19px)                                            |
| `.t-base` (15px / 400)                | `Text variant="body"` (16px)                                                                        |
| `.t-small` (13px / 400)               | `Text variant="body"` / `Text variant="mono"`                                                       |
| `.t-label` (12px / 500, tracked)      | `Text variant="eyebrow"` (uppercase mono) or `mono`                                                 |
| `.t-caption` (11px, `--ink-dim`)      | `Text variant="mono" color="dim"`                                                                   |
| `.t-micro` (10px, uppercase, tracked) | `Text variant="eyebrow"`                                                                            |
| `.t-mono` (mono 13px)                 | `Text variant="mono"`                                                                               |
| `.t-num` (mono, tabular-nums)         | `Text variant="mono"` (add `font-variant-numeric` via `style` if tabular alignment is load-bearing) |

`Text` colour prop values: `ink` / `dim` / `faint` / `amber` / `cyan` / `ok` / `danger`.

**Spacing / colour tokens** (`docs/design-tokens.md`). Replace the legacy alias on the
left with the canonical `@dxlbnl/ui` token on the right (the alias definitions in
`app.css` are the source of truth for the mapping):

| Legacy alias                                       | Canonical `@dxlbnl/ui` token                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `--space-1` (4px)                                  | `--u` halved → use `--u`/`4px` literal (no 4px token; keep literal `4px` if needed) |
| `--space-2`                                        | `--u` (8px)                                                                         |
| `--space-3` (12px)                                 | nearest `--u`/`--u2`; keep literal `12px` if exact                                  |
| `--space-4`                                        | `--u2` (16px)                                                                       |
| `--space-5`                                        | `--u3` (24px)                                                                       |
| `--space-6`                                        | `--u4` (32px)                                                                       |
| `--space-8`                                        | `--u6` (48px)                                                                       |
| `--bg-base`                                        | `--bg`                                                                              |
| `--bg-raised`                                      | `--bg-rail`                                                                         |
| `--bg-overlay`                                     | `--bg-elev`                                                                         |
| `--text-primary`                                   | `--ink`                                                                             |
| `--text-muted`                                     | `--ink-dim`                                                                         |
| `--border`                                         | `--rule`                                                                            |
| `--accent`                                         | `--amber`                                                                           |
| `--success`                                        | `--ok`                                                                              |
| `--warning`                                        | `--amber`                                                                           |
| `--font-sans`                                      | `--sans`                                                                            |
| `--font-mono`                                      | `--mono`                                                                            |
| `--t-quick`/`--t-normal`                           | `--transition` (0.15s)                                                              |
| `--syn-keyword` / `--syn-string` / `--syn-comment` | `--shiki-token-keyword` / `--shiki-token-string` / `--shiki-token-comment`          |

> **Not legacy — these stay.** `--rule`, `--bg-rail`, `--ink-dim`, `--bg-elev`,
> `--bg-sunken`, `--rule-strong`, `--amber`, `--cyan`, `--ok`, `--danger`, `--ink`,
> `--ink-faint`, `--bg`, the `--u*` scale, the `--t-*` **size** tokens
> (`--t-micro`/`--t-mono`/`--t-body`/`--t-title`/…), and the site identity colours
> (`--lib-zod4mock` / `--lib-zodmock` / `--lib-faker`, `--rung-*`) are all legitimate
> `@dxlbnl/ui` / identity tokens. They are **not** in the migration set and **MUST NOT**
> be removed. Only the gen-bench-inherited compat aliases listed above are deleted.

### Inventory (the implementer's worklist)

These are the files holding legacy layout CSS, legacy `.t-*` typography classes, or
legacy compat-alias tokens, found by Grep at spec time. The bench example in the card is
illustrative; this is the authoritative list. (`--bg-rail` / `--ink-dim` / `--rule`
hits are **not** counted here — those are canonical tokens that stay.)

**Route bodies** under `site/src/routes/**/+page.svelte` (+ the docs `+layout.svelte`):

- `site/src/routes/+page.svelte` — heaviest: 13 `var(--space-*)`, 11 `.t-*` usages.
- `site/src/routes/bench/+page.svelte` — 12 `var(--space-*)`, 6 `.t-*`.
- `site/src/routes/showcase/+page.svelte` — 5 `var(--space-*)`, 4 `.t-*`.
- `site/src/routes/comparison/+page.svelte` — 1 `.t-*` (B95 stub).
- `site/src/routes/explorer/+page.svelte` — 1 `.t-*` (B95 stub).
- `site/src/routes/docs/+page.svelte` — 4 `var(--space-*)`.
- `site/src/routes/docs/+layout.svelte` — 4 `var(--space-*)`, 1 `.t-label`.

**Shared widgets** under `site/src/lib/widgets/**`:

- `JsonTree.svelte`, `RelationCallout.svelte`, `CodePanel.svelte`, `CodeBlock.svelte`,
  `WinnerCallout.svelte`, `LibraryLegend.svelte`, `MetricBadge.svelte`,
  `SchemaPlayground.svelte`, `RangeSlider.svelte`, `SegmentedControl.svelte`,
  `FeatureMatrix.svelte` — each carries `var(--space-*)` and/or `.t-*` and/or hand-rolled
  flex/grid layout. (`BenchChart.svelte` is custom Chart.js drawing — its chrome migrates,
  its canvas logic stays.)

**Docs widgets** under `site/src/lib/docs/widgets/**` (visible chrome migrates; the
docs _system_ redesign is out of scope per below):

- `DocPage.svelte`, `InstallBlock.svelte`, `SignatureBlock.svelte`, `ParameterTable.svelte`,
  `SpeedClaim.svelte`, `RelatedShowcase.svelte`, `Prerequisites.svelte`, `Playground.svelte`
  — each carries `var(--space-*)` layout CSS.

**The alias source** `site/src/lib/styles/app.css` — the legacy compat-alias `:root`
block (lines ~36–67), the `.t-*` type-scale classes (lines ~70–118), and the
gen-bench-inherited component classes `.btn` / `.seg` / `.seg-item` / `.kbd` once
nothing references them.

## Requirements

### B96-R1: Zero `var(--space-*)` references remain in `site/src/`

The migrated tree **MUST NOT** contain any `var(--space-*)` reference under `site/src/`
(every legacy spacing token is replaced by a `@dxlbnl/ui` `--u*` token, a primitive's
`gap` prop, or a literal where no token matches exactly).

- Scenario: no legacy spacing token remains
  GIVEN the post-migration tree
  WHEN `git grep --count 'var(--space-'` is run over `site/src/`
  THEN it reports zero matches (no file, including `app.css`, references a `--space-*`
  token).

### B96-R2: Zero legacy `.t-*` typography classes remain in `site/src/`

The migrated tree **MUST NOT** apply any of the legacy typography classes (`t-title`,
`t-small`, `t-caption`, `t-label`, `t-large`, `t-base`, `t-micro`, `t-mono`, `t-num`) in
markup under `site/src/`; legacy typographic text is rendered through `@dxlbnl/ui`'s
`Heading` / `Text` components per the equivalence map.

- Scenario: no legacy type class in markup
  GIVEN the post-migration tree
  WHEN `git grep` searches `site/src/` for the attribute `class="t-` and for the
  word-boundary class names `t-title` / `t-small` / `t-caption` / `t-label` / `t-large` /
  `t-base` / `t-micro` / `t-mono` / `t-num` in `.svelte` markup
  THEN no markup match is found (the only place the names may still appear is the
  `app.css` class **definition**, which R5 then deletes).

### B96-R3: Layout containers compose `@dxlbnl/ui` primitives

Route bodies and shared widgets **MUST** express their structural layout (column/row
flex with gap, page-width wrappers, card surfaces, grids) through the `@dxlbnl/ui`
layout primitives (`Stack` / `Inline` / `Spread` / `Container` / `Card` / `Grid` /
`Rule`) per the pinned equivalence map, rather than hand-rolled `display:flex` /
`display:grid` `<style>` blocks — except for genuinely custom drawing surfaces
(Chart.js canvas in `BenchChart`, CodeMirror mount in `SchemaPlayground`/`Editor`, SVG)
whose internal drawing logic is preserved.

- Scenario: bench page imports layout primitives
  GIVEN `site/src/routes/bench/+page.svelte` post-migration
  WHEN the file is parsed
  THEN it imports at least `Stack` and `Inline` (and any other primitives it uses) from
  `@dxlbnl/ui`, and its `<style>` block no longer declares a rule whose body sets
  `display: flex` (or `display: grid`) together with a `gap` for a container that the
  equivalence map covers.

- Scenario: a representative widget composes a primitive
  GIVEN `site/src/lib/widgets/RelationCallout.svelte` post-migration
  WHEN the file is parsed
  THEN its outer column/row layout is rendered via a `@dxlbnl/ui` layout primitive
  imported from `@dxlbnl/ui` (not a hand-rolled `display:flex` container), and its
  custom content (the relational proof rows) is preserved.

### B96-R4: Legacy compat-alias tokens are no longer read in `site/src/`

The migrated tree **MUST NOT** read any of the gen-bench-inherited legacy alias tokens
(`--bg-base`, `--bg-raised`, `--bg-overlay`, `--text-primary`, `--text-muted`,
`--border`, `--accent`, `--accent-soft`, `--success`, `--warning`, `--font-sans`,
`--font-mono`, `--t-quick`, `--t-normal`, `--h-btn`, `--h-topbar`, `--h-input`,
`--h-row`, `--syn-keyword`, `--syn-string`, `--syn-number`, `--syn-comment`) anywhere
under `site/src/`; each is replaced by its canonical `@dxlbnl/ui` token per the map.

- Scenario: no legacy alias consumed
  GIVEN the post-migration tree
  WHEN `git grep` searches `site/src/` for `var(--bg-base)`, `var(--text-primary)`,
  `var(--border)`, `var(--accent)`, `var(--font-sans)`, `var(--font-mono)`,
  `var(--t-quick)`, `var(--t-normal)`, and `var(--syn-`
  THEN no match is found outside the `app.css` alias **definitions** that R5 deletes.

### B96-R5: Delete the legacy compat-alias block, `.t-*` classes, and dead component classes from `app.css`

`site/src/lib/styles/app.css` **MUST** delete the legacy compat-alias `:root` block
(the `--bg-base` … `--space-8` … `--syn-*` aliases), the `.t-large` / `.t-title` /
`.t-base` / `.t-small` / `.t-label` / `.t-caption` / `.t-micro` / `.t-mono` / `.t-num`
class definitions, and the gen-bench-inherited `.btn` / `.seg` / `.seg-item` / `.kbd`
component classes once nothing references them — while preserving the `@layer dxlbnl,
site;` declaration and the two `@dxlbnl/ui` token imports (D21).

- Scenario: alias block and legacy classes gone
  GIVEN `site/src/lib/styles/app.css` post-migration
  WHEN the file is parsed
  THEN it contains no `--space-`, no `--bg-base`, no `--text-primary`, no `--border:`
  alias, no `--syn-` declaration, and no `.t-large` / `.t-title` / `.t-base` /
  `.t-small` / `.t-label` / `.t-caption` / `.t-micro` / `.t-mono` / `.t-num` /
  `.btn` / `.seg` / `.kbd` selector.

- Scenario: layer convention and token imports preserved (D21)
  GIVEN `site/src/lib/styles/app.css` post-migration
  WHEN the file is parsed
  THEN it still declares `@layer dxlbnl, site;` as the first at-rule and still imports
  `@dxlbnl/ui/tokens/tokens.css` and `@dxlbnl/ui/tokens/typography.css` into the
  `dxlbnl` layer.

### B96-R6: The B75 route-smoke suite stays green (behavioural regression anchor)

After the migration, the B75 Playwright smoke suite **MUST** stay green across all 7
routes in its `ROUTE_TABLE` — every route loads with no `console.error`, no `pageerror`
/ unhandled rejection, and no SSR 500 — proving the refactor did not change route
behaviour.

- Scenario: smoke suite 7/7 green
  GIVEN the post-migration tree
  WHEN `pnpm site:test:e2e` runs (`site/e2e/smoke.spec.ts`, serving the built/preview app)
  THEN it exits 0 with all 7 route tests (`/`, `/bench`, `/showcase`, `/comparison`,
  `/explorer`, `/docs`, `/docs/getting-started`) passing.

### B96-R7: D19 funnel, D17/D20 honest framing, and D18/D22 editor mounting preserved

The migration **MUST** preserve the `/` funnel (D19 — relational proof exhibit + Install
CTA above the fold), the honest speed framing on `/` and any speed-citing copy (D17/D20 —
cite tier + CLI source, never "fastest"/"faster than the alternatives"), and the editor
mounting discipline (D18 mdsvex fence hydration and D22 `onMount`/`if (browser)`
guarding — `SchemaPlayground` / docs `Playground` internals untouched). Layout/token
swaps **MUST NOT** alter these.

- Scenario: relational exhibit and Install CTA still render on `/`
  GIVEN `/` is rendered post-migration
  WHEN the reviewer inspects the page above the fold
  THEN the inline relational exhibit (`JsonTree` panel labelled `Review (generated)`
  with at least one highlighted-ID proof row) is present and a primary CTA labelled
  `Install` linking to `/docs/getting-started` is present (D19 funnel intact).

- Scenario: no banned speed superlative introduced
  GIVEN the post-migration `site/src/` tree
  WHEN `git grep -i` searches for the strings `fastest` and `faster than the alternatives`
  THEN no new occurrence is introduced by this card in user-facing route/widget copy
  (D17/D20 honest framing preserved).

- Scenario: editor widgets still mount under a browser guard (D22)
  GIVEN `site/src/lib/widgets/SchemaPlayground.svelte` and
  `site/src/lib/docs/widgets/Playground.svelte` post-migration
  WHEN the files are parsed
  THEN their CodeMirror/editor construction is still deferred to `onMount` (or behind an
  `if (browser)` guard) — the migration only restyled chrome around them, it did not move
  editor construction to module load.

### B96-R8: Full validation and site checks stay green

After R1–R7 land, the full validation pipeline and site checks **MUST** be green — the
behaviour-neutral refactor breaks neither type-checking, the library suite, nor the site
component tests.

- Scenario: root validate passes
  GIVEN the post-migration tree
  WHEN `pnpm validate` runs at the repository root
  THEN it exits 0.

- Scenario: site type-check passes
  GIVEN the post-migration tree
  WHEN `pnpm site:check` runs
  THEN it exits 0 with no `svelte-check` errors.

- Scenario: site component tests pass
  GIVEN the post-migration tree
  WHEN `pnpm site:test:component` runs (Storybook play-tests over the relocated widgets)
  THEN it exits 0.

- Scenario: library integration suite untouched
  GIVEN the library's `tests/integration/` snapshots
  WHEN `pnpm test:all` runs
  THEN no integration snapshot is re-pinned by this card — the library test suite is
  unaffected (this is a `site/`-only change).

## Out of scope

- **Phase 3 bench rebuild** (B69 / B70 / B71 / B72 / B73 — worker, time-budget, schema
  unify, progress/abort, cold-start drop). This card migrates the **chrome** of `/bench`;
  the bench engine is rebuilt in Phase 3. The bench schemas under `site/src/lib/schemas/`
  (D23) and the worker protocol are untouched.
- **Phase 4b `/explorer` widgets** (B90). The `/explorer` stub's chrome migrates (its one
  `.t-*` and `--space-*` hit), but the rung-coloured trace widgets are Phase 4. The
  `--rung-*` reserved tokens are not consumed here.
- **Docs _system_ redesign** (B94 / Phase 2). The visible chrome of the docs routes and
  docs widgets (`site/src/lib/docs/widgets/`) migrates its tokens/typography/layout, but
  the docs content model, sidebar manifest (`SIDEBAR`), search priming (B104), and
  routing structure are not redesigned.
- **`SchemaPlayground` / `Editor` editor internals** (D18 / D22). Only the chrome around
  them migrates; the CodeMirror mount, mdsvex fence hydration, and `onMount`/`browser`
  guards stay exactly as they are.
- **`@dxlbnl/ui` forks or vendoring.** Any gap in `@dxlbnl/ui` discovered during
  implementation is composed around with `Stack`/`Inline` glue (B95 precedent) or filed
  as an upstream `@dxlbnl/ui` issue and noted in the card's `## Notes` — never vendored.
- **Pixel-perfect parity.** The card mandates "pre-migration spirit" (column gaps, card
  chrome), not byte-identical rendered pixels. Nearest-variant typography/gap choices are
  acceptable.
- **New behaviour or new routes.** No route gains or loses a feature; no route is added
  or removed.

## Open questions

### Non-blocking

1. **A required primitive is missing from `@dxlbnl/ui`.** `docs/layout.md`,
   `docs/primitives.md`, and `docs/cards.md` confirm `Stack`, `Inline`, `Spread`,
   `Grid`, `Container`, `Card`, `Rule`, `Text`, and `Heading` all exist — the full set
   this migration needs. **Non-blocking**: B95 already established the dispute-resolution
   path (compose around a gap with `Stack`/`Inline` glue, or file an upstream
   `@dxlbnl/ui` issue + note it in the card's `## Notes`), so a stray gap discovered
   mid-implementation does not change _what_ is built or block spec advancement — it is
   handled inline by the implementer, escalated to the reviewer only if it can't be
   composed around.

2. **Imperfect typography pixel match.** Several legacy `.t-*` sizes (28px / 20px / 15px /
   13px / 12px / 11px / 10px) have no exact `@dxlbnl/ui` `Heading`/`Text` variant; the
   equivalence map gives the nearest variant. **Non-blocking**: the card explicitly scopes
   this as "pre-migration spirit, not pixel-identical", so nearest-variant judgement is
   an accepted, recorded local choice — not a blocker. If `.t-num`'s tabular numerals are
   load-bearing for column alignment in `MetricBadge`/`BenchChart` legend, the implementer
   keeps `font-variant-numeric: tabular-nums` via the primitive's `style` prop.

3. **Residual non-`--space` literals (`4px` / `12px`).** `--space-1` (4px) and `--space-3`
   (12px) have no exact `--u*` token (the scale is 8px-based). **Non-blocking**: the
   implementer keeps the literal pixel value where no `--u*` is exact, or rounds to the
   nearest `--u*` when the gap is non-load-bearing — a recorded local scoping choice,
   consistent with R1 (which only forbids `var(--space-*)`, not all literals).

### Blocking

None at spec-writing time. Every needed `@dxlbnl/ui` primitive is documented and present;
the migration is behaviour-neutral with objectively checkable invariants; the B75 smoke
suite is the standing behavioural anchor. No question would change _what_ gets built.
