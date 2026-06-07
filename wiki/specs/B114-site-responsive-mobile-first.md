# B114: Site responsive / mobile-first pass + fluid docs reading width

## Context

Maintainer site review (2026-06-07, item card
[`wiki/backlog/doing/B114-site-responsive-mobile-first.md`](../backlog/doing/B114-site-responsive-mobile-first.md))
found the site is **not mobile-first** and that on desktop the docs reading column is too
cramped. Both trace to one root cause: the shared docs shell
[`site/src/lib/docs/widgets/DocPage.svelte`](../../site/src/lib/docs/widgets/DocPage.svelte)
renders a three-column grid (left sidebar nav — owned by
[`site/src/routes/docs/+layout.svelte`](../../site/src/routes/docs/+layout.svelte) — +
content + right "On this page" rail) where the content track is a fixed
`minmax(0, 1fr) 200px` grid inside a `Container size="lg"`, squeezing the middle column so
the TOC entries wrap (Getting Started), the Concepts "Options" `<table>` wraps unreadably,
and long generic types break mid-identifier. The site is a public docs site, so
mobile-first is a fundamental UX requirement, not polish.

**Two nested grids carve the prose track twice.** The `+layout.svelte` `.docs-layout`
grid takes `220px 1fr` (the section sidebar), then inside it `DocPage`'s `.doc-grid`
takes `minmax(0, 1fr) 200px` (the right TOC rail). At a 1440 viewport the maintainer
measures the resulting prose track at **~420px** (per the B102 designer findings) — far
below a comfortable reading measure. At `--t-body` 16px, 420px is only ~40–45 characters
per line; comfortable prose wants **~65–75 characters**, and `@dxlbnl/ui`'s own `<Prose>`
primitive defaults its `maxWidth` to `72ch`. So the desktop fix is not merely "wide
enough that the TOC/tables don't wrap" — it is **widening the prose track to a
comfortable reading measure** (see B114-R5).

> **Decided at the review checkpoint (2026-06-07):** the maintainer approved the
> responsive strategy and folded in two refinements: (1) **strengthen the desktop reading
> width** to a comfortable prose measure rather than a bare anti-wrap floor (B114-R5
> below now pins a concrete `max-width: 720px` prose target — ~72–75ch at 16px, matching
> the `<Prose>` `72ch` default — and asserts the rendered prose width sits in the
> comfortable band, meaningfully wider than today's ~420px); (2) **the decided mobile
> sidebar + TOC patterns** — on mobile the docs section sidebar becomes a `<details>`
> disclosure at the top of the content, and the "On this page" TOC moves to a **collapsed
> `<details>` disclosure below** the content (collapsed-below, not hidden). These are
> folded into B114-R1 / B114-R2 / B114-R5; the corresponding open questions are removed.

This item is **cross-cutting and reframes the narrow-column pieces of
[[B111]]** (widen `/docs/api`) and **[[B112]] item 1** (static code-block / table overflow
on docs pages). See **Out of scope** for the explicit reconciliation — B114 subsumes the
shared-shell reading-width work; B112's other two items (Playground output contrast,
schema-coverage header spacing) are **not** absorbed.

Standing constraints that bind this spec:

- **D19** — the `/` route funnel (relational proof lead + Install CTA above the fold) must
  still hold on mobile and desktop.
- **D21** — site responsive CSS **MUST** live in the existing `@layer site` in
  [`site/src/lib/styles/app.css`](../../site/src/lib/styles/app.css) (and component scoped
  styles, which sit above the cascade layers); **no new `@layer`**.

Ground-truth of the current responsive state (read 2026-06-07):

- **`@dxlbnl/ui` `<Nav>`** (used in [`site/src/routes/+layout.svelte`](../../site/src/routes/+layout.svelte))
  **already ships a built-in mobile hamburger drawer**: above 767px the link list shows;
  at ≤767px the list is hidden and a hamburger button + drawer appear (per
  `dxlb-ui/docs/navigation.md`). So site-nav reflow is provided by the primitive — this
  spec **verifies** it, it does not re-build it.
- **`<Container>`** offers `size` (lg=1440 / md=960 / sm=640 — the only three sizes;
  there is no wider size), responsive horizontal padding (16px below 720px), and
  `container-type: inline-size`. The docs shell already uses `Container size="lg"`
  (1440), so the **outer width is not the bottleneck** — the prose narrowness is the two
  nested grids (220px sidebar + 200px TOC + gaps) carving the middle, not the container
  cap. Widening prose therefore comes from rebalancing the inner tracks (and pinning a
  prose `max-width`), **not** from a wider `Container` size (none exists past `lg`). There
  are **no exported breakpoint tokens, no hide/show-at-breakpoint helpers, and no
  asymmetric responsive Grid**. `<Grid cols="auto">` is auto-fill (symmetric) — wrong
  shape for the content+rail
  layout. Therefore the **docs-shell reflow and the desktop reading-width fix must be
  site-side media queries in `@layer site`** (DocPage already has a `@media (max-width:
720px)` block that collapses its grid to one column; the docs `+layout.svelte`
  `.docs-layout` sidebar grid does **not** reflow yet — that is the visible mobile gap).
  **No new dependency is required.**
- The `/` funnel already reflows its exhibit grid at `@media (max-width: 640px)`.
- The Concepts "Options" table is a **plain prose `<table>`** (styled by `.doc-prose-body
table` in `app.css`), not a `<ParameterTable>` — so its cramping is purely a function of
  the content-column width, fixed by the reading-width requirement below.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

### Breakpoints (named, used by every requirement below)

| Name    | Width    | Used in scenarios as                                    |
| ------- | -------- | ------------------------------------------------------- |
| mobile  | ≤ 767px  | viewport **390 × 844** (and the `<Nav>` 767px boundary) |
| tablet  | 768px    | viewport **768 × 1024**                                 |
| desktop | ≥ 1024px | viewport **1440 × 900**                                 |

768px is chosen to align with `@dxlbnl/ui` `<Nav>`'s own 767px hamburger boundary, so the
nav drawer and the **section-sidebar** reflow flip at the same threshold (no in-between
state where the nav has collapsed but the sidebar has not, or vice versa). The **right "On
this page" TOC rail** returns one step later, at **≥1024** (B114-R3 three-step reflow): a
768 viewport cannot host a 220px sidebar + a readable prose track + a 200px TOC rail, so the
TOC stays collapsed-below through the 768–1023 tablet band and only becomes a right column at
desktop.

## Requirements

### B114-R1: Docs shell reflows to a single readable column on mobile, TOC collapses below

On a **mobile** viewport, the `DocPage` three-column layout (sidebar nav + content + "On
this page" rail) **MUST** reflow so the content reads as a single full-width column: the
left docs sidebar collapses out of the inline flow (see B114-R2 for its disclosure form)
and the right "On this page" TOC moves to a **collapsed `<details>` disclosure positioned
below the prose content** (decided at the review checkpoint — collapsed-below, not hidden,
and never beside the content as a right column).

- Scenario (UI): docs page single-column on mobile
  GIVEN `/docs/getting-started` rendered at viewport 390 × 844
  WHEN the page has settled (`networkidle`)
  THEN the prose content body (`.doc-prose-body`) has a bounding-box width within 24px of
  the `Container`'s inner content width (i.e. it spans the full content width, not a ~1fr
  track beside a 200px rail)
  AND the docs sidebar `<aside aria-label="Documentation navigation">` is **not** laid out
  as a left column beside the content (its right edge is at or left of the content's left
  edge, or it is removed from the inline flow into the disclosure of B114-R2).

- Scenario (UI): TOC is a collapsed disclosure below the content on mobile
  GIVEN `/docs/getting-started` rendered at viewport 390 × 844
  WHEN the page has settled
  THEN the "On this page" TOC (`aside[aria-label="On this page"]`) is positioned **below**
  the prose content (its top edge is greater than the prose body's top edge), never beside
  it as a right column
  AND it is rendered as a collapsed `<details>` disclosure: a `<summary>` (e.g. labelled
  "On this page") is visible while the TOC link list is collapsed (the list has no visible
  bounding box / `details` is not `[open]`), and activating the `<summary>` reveals the TOC
  links (a link to a `#`-anchor on the page gains a non-zero bounding box).

### B114-R2: Docs sidebar becomes a `<details>` disclosure at the top of the content on mobile

On a **mobile** viewport, the docs section navigation (the
[`docs/+layout.svelte`](../../site/src/routes/docs/+layout.svelte) sidebar links) **MUST**
render as a **collapsed `<details>` disclosure at the top of the content** (decided at the
review checkpoint), keeping every `SIDEBAR` link present and navigable in the DOM (not
`display: none`'d away with no alternative) so a mobile reader can expand it and move
between docs pages.

- Scenario (UI): sidebar is a collapsed disclosure at the top of the content on mobile
  GIVEN `/docs/concepts` rendered at viewport 390 × 844
  WHEN the page has settled
  THEN the docs navigation region (`aside[aria-label="Documentation navigation"]`, or the
  `<details>` it is wrapped in) sits **above** the prose content (its top edge is at or
  above the prose body's top edge) and presents a visible `<summary>` control (e.g.
  labelled "Documentation"/"Menu") while the link list is collapsed
  AND activating that single `<summary>` reveals the links: a navigable link to
  `/docs/getting-started` then has a non-zero bounding box.

### B114-R3: Columns return in a three-step reflow (sidebar at tablet, TOC rail at desktop)

The docs shell **MUST** reflow in three steps (decided at the per-viewport designer pass,
2026-06-07): a 768 viewport cannot host a 220px sidebar **and** a 200px TOC rail beside a
readable prose track (the prose collapsed to ~165px with per-word wrapping), so the right
"On this page" rail returns one step later than the sidebar.

- **Mobile (≤767):** single column; sidebar `<details>` collapsed at top, TOC `<details>`
  collapsed below content (B114-R1 / B114-R2).
- **Tablet (768–1023):** **two columns — sidebar + prose only.** The left section sidebar
  returns as a column, but the "On this page" TOC **stays in its collapsed-below `<details>`
  form** (it is NOT yet a right rail) so the prose track stays readable.
- **Desktop (≥1024):** full three columns — sidebar (left) + prose + "On this page" rail
  (right).

The a11y invariant holds: a docs-nav/TOC `<details>` that is visually a column **MUST** be
genuinely `open` (links in the accessibility tree). The sidebar `<details>` is `open` at
≥768; the TOC `<details>` is `open` (column) only at ≥1024 and collapsed-below
(default-closed, user-toggleable) from 0–1023.

- Scenario (UI): three columns at desktop
  GIVEN `/docs/getting-started` rendered at viewport 1440 × 900
  WHEN the page has settled
  THEN the docs sidebar `<aside aria-label="Documentation navigation">` sits left of the
  prose content (sidebar right edge ≤ prose left edge)
  AND the "On this page" rail (`aside[aria-label="On this page"]`) sits right of the prose
  content (rail left edge ≥ prose right edge − 1px).

- Scenario (UI): sidebar is a column at tablet
  GIVEN `/docs/concepts` rendered at viewport 768 × 1024
  WHEN the page has settled
  THEN the docs sidebar is laid out as a left column beside the content (sidebar right edge
  ≤ prose left edge), i.e. the mobile single-column reflow is no longer in effect.

- Scenario (UI): tablet keeps the prose readable with the TOC collapsed-below (no right rail)
  GIVEN `/docs/concepts` rendered at viewport 768 × 1024
  WHEN the page has settled
  THEN the prose body (`.doc-prose-body`) bounding-box width is **≥ 480px** (readable, not
  crushed to a sliver by a second rail)
  AND the "On this page" TOC (`aside[aria-label="On this page"]`) sits **below** the prose
  content as its collapsed-below `<details>` (top edge greater than the prose's, `details`
  not `[open]`), NOT as a right-hand side rail.

- Scenario (UI): three columns return at the desktop threshold (1024)
  GIVEN `/docs/getting-started` rendered at viewport 1024 × 900
  WHEN the page has settled
  THEN the docs sidebar sits left of the prose, the "On this page" rail sits right of the
  prose (left edge ≥ prose right edge − 1px), and the TOC rail's links are role-exposed (a
  link in the rail is visible via `getByRole`).

### B114-R4: Site top nav is usable and does not overflow on mobile

On a **mobile** viewport the site top nav **MUST** be usable without horizontal overflow:
the navigation collapses to its `@dxlbnl/ui` `<Nav>` hamburger affordance and the
`.site-header` row (Nav + adjacent `<DocsSearch>`) does not push the document wider than
the viewport.

- Scenario (UI): nav collapses, no horizontal overflow on mobile
  GIVEN any route (e.g. `/`) rendered at viewport 390 × 844
  WHEN the page has settled
  THEN `document.documentElement.scrollWidth` is ≤ the viewport width + 1px (no horizontal
  scrollbar from the header)
  AND a hamburger / menu-toggle control is visible in the header (the `<Nav>` drawer
  trigger), while the full inline desktop link list is not laid out across the header row.

- Scenario (UI): desktop nav shows inline links
  GIVEN `/` rendered at viewport 1440 × 900
  WHEN the page has settled
  THEN the top nav presents its links inline (e.g. a link labelled "Docs" is visible in the
  header without opening a drawer).

> Coordination (non-normative): the GitHub/npm icon links are owned by **[[B117]]** and the
> adjacent search trigger by **[[B104]]**'s `<DocsSearch>`. This requirement only asserts
> the header does not overflow and the drawer engages on mobile; it does **not** re-spec the
> icon set or the search overlay.

### B114-R5: Comfortable desktop prose reading width (≈65–75ch), TOC and tables don't wrap

At **desktop** width the prose content column **MUST** present a comfortable prose reading
measure of roughly **65–75 characters per line** — the rendered prose body width sits in a
**comfortable band of ~640–720px**, meaningfully wider than today's ~420px — by pinning the
prose track to a concrete target `max-width: 720px` (≈72–75ch at `--t-body` 16px, matching
the `@dxlbnl/ui` `<Prose>` `72ch` default) rather than the bare anti-wrap floor; as a
consequence the "On this page" TOC entries do not wrap to multiple lines and the docs prose
`<table>` (the Concepts "Options" table) is readable rather than squeezed into mid-token
wrapping.

The widening **MUST NOT** be taken from the 200px TOC rail's space in a way that
re-introduces the B102 `/docs/api` table↔TOC overlap (B114-R8 keeps that guard green);
because the docs shell already sits in `Container size="lg"` (1440, the widest size),
the prose track is widened by rebalancing the two nested grids (the prose `max-width`
above plus, if needed, trimming the section-sidebar / shell gaps) — not by stealing the
TOC column. Prose `max-width` is also capped (~720px / ≤80ch) so lines do not run
full-bleed, which hurts readability past ~80 characters.

- Scenario (UI): prose reading width is in the comfortable band on desktop
  GIVEN `/docs/concepts` rendered at viewport 1440 × 900
  WHEN the page has settled
  THEN the rendered prose content body (`.doc-prose-body`) has a bounding-box width in the
  comfortable band — **between 600px and 760px** (i.e. ≈65–75ch at 16px, with the 720px
  target inside it), which is **at least 150px wider** than today's ~420px — and not
  full-bleed across the whole content track.

- Scenario (UI): TOC entries do not wrap on desktop
  GIVEN `/docs/getting-started` rendered at viewport 1440 × 900
  WHEN the page has settled
  THEN each "On this page" TOC link (`aside[aria-label="On this page"] a`) renders on a
  single line — its rendered bounding-box height is ≤ 1.6× its computed `font-size` /
  line-height for a single line (no entry occupies two or more text lines).

- Scenario (UI): Concepts Options table is readable on desktop
  GIVEN `/docs/concepts` rendered at viewport 1440 × 900
  WHEN the page has settled
  THEN the prose "Options" `<table>` fits within the content column without horizontal
  overflow of the page (`document.documentElement.scrollWidth` ≤ viewport width + 1px)
  AND the first body cell of the Options table (the option-name `<code>`) renders on a
  single line (no mid-identifier break of a short option name such as `seed`).

### B114-R6: No horizontal page overflow at any named breakpoint

Across the three named breakpoints, no docs route **MUST** introduce a horizontal page
scrollbar; wide, unbreakable content (a long signature, a wide code block, a wide table)
**MUST** be contained (its own bounded `overflow-x` scroll, or wrapping) rather than
widening the page.

- Scenario (UI): no page-level horizontal overflow across breakpoints
  GIVEN `/docs/concepts` and `/docs/api`, each rendered at 390 × 844, 768 × 1024, and
  1440 × 900
  WHEN each page has settled
  THEN for every (route × viewport) `document.documentElement.scrollWidth` ≤ that
  viewport's width + 1px (a wide block scrolls inside its own container, it never widens the
  document).

### B114-R7: The `/` funnel still holds above the fold on mobile and desktop (D19)

The responsive pass **MUST NOT** regress the D19 `/` funnel: the relational-proof exhibit
and the Install CTA remain present and usable on both mobile and desktop.

- Scenario (UI): funnel intact on mobile
  GIVEN `/` rendered at viewport 390 × 844
  WHEN the page has settled
  THEN the "Install" CTA link (to `/docs/getting-started`) is visible
  AND the relational-proof exhibit (the heading "Cross-entity consistency, out of the box"
  and at least one highlighted proof ID row) is visible
  AND there is no horizontal page overflow (`scrollWidth` ≤ 390 + 1px).

- Scenario (UI): funnel intact on desktop
  GIVEN `/` rendered at viewport 1440 × 900
  WHEN the page has settled
  THEN the "Install" CTA link and the relational-proof exhibit are both visible.

### B114-R8: Existing e2e suites stay green

The change **MUST NOT** break any existing committed e2e: the B75 smoke suite (all routes
load clean — currently 7/7 navigable plus the docs routes in `ROUTE_TABLE`), the
`docs-content` / `docs-remaining` / `docs-search` suites, and the **B102 `/docs/api` TOC
overlap guard** (`docs-api.spec.ts`).

- Scenario: full e2e suite green after the change
  GIVEN the responsive changes implemented
  WHEN `pnpm site:test:e2e` is run against the production build
  THEN every test in `site/e2e/` passes (smoke `ROUTE_TABLE` all green; `docs-api.spec.ts`
  TOC-overlap and clip guards green at their 1440 viewport).

## Out of scope

- **B111 / B112-item-1 reconciliation — B114 SUBSUMES them.** The shared-`DocPage`
  reading-width fix (B114-R5) and the page-level overflow containment (B114-R6) cover
  B111's "widen `/docs/api` so long generic types don't break mid-identifier" and B112
  item 1's "static code blocks / wide table cells overflow the content column" for the
  shared docs shell. **Recommendation to the manager: close [[B111]] and B112 item 1 as
  folded into B114** (B111 entirely; B112 item 1 only). A separately-tuned _wider_ prose
  track specifically for `/docs/api` (e.g. a larger prose `max-width` for the signature-heavy
  page) is **optional** under B114-R5 (a route may opt into a wider track) and is left as
  discretionary implementer latitude, not a separate build — there is no `Container` size
  past `lg`, so "wider" means a per-route prose `max-width`, not a new container size.
- **B112 items 2 and 3 are NOT absorbed**: the light/Paper Playground-output contrast and
  the `/docs/zod4-schema-coverage` STATUS/NOTES header spacing are palette/table-specific
  polish unrelated to responsive width — they remain B112's scope.
- **Re-speccing `<Nav>`'s internal hamburger drawer** — the drawer is a shipped `@dxlbnl/ui`
  behaviour; B114 verifies it (R4), it does not re-implement it.
- **The GitHub/npm header icon links** ([[B117]]) and the **DocsSearch overlay** ([[B104]])
  — coordinated with (R4) but owned by those items.
- **Per-component visual redesign** (new spacing scale, typography changes, hero rework)
  beyond what reflow/width require.
- **A new `@layer`, new breakpoint-token system, or new dependency** — explicitly excluded
  by D21 and by the "no new dep" determination above. If implementation reveals a genuine
  need for a responsive primitive `@dxlbnl/ui` lacks, that is a new review-checkpoint item,
  not in-scope here.

## Open questions

> The two review-checkpoint design choices that previously sat here — the mobile docs
> **sidebar** pattern (R2) and the mobile **"On this page" TOC** behaviour (R1) — were
> **decided by the maintainer at the 2026-06-07 review checkpoint** (sidebar → `<details>`
> disclosure at the top of the content; TOC → collapsed `<details>` disclosure below the
> content). They are folded into B114-R1 / B114-R2 and removed from this list.

- **(Non-blocking)** Whether `/docs/api` additionally adopts a **wider per-route prose
  `max-width`** than the narrative pages (the optional half of the B111 fold). R5/R6 are
  satisfied either way; this is implementer latitude recorded for the designer pass. (There
  is no `Container` size past `lg`, so "wider" is a prose `max-width`, not a container size.)
- **(Non-blocking)** Single-line TOC measurement tolerance in R5 (the "≤ 1.6× line-height"
  heuristic) and the exact comfortable-band bounds (600–760px) — the test-writer may refine
  the exact ratio / band edges against the rendered font metrics as long as the asserted
  outcomes hold: "no TOC entry wraps to a second line" and "prose width is meaningfully
  wider than ~420px, in the ≈65–75ch comfortable band, and not full-bleed".

No blocking questions. The headline responsive **strategy** (breakpoints at 767/768,
columns-return at tablet/desktop, nav via the built-in `<Nav>` drawer, site-side media
queries in `@layer site`, no new dep) is fixed in this spec; the two prior checkpoint
choices are now decided and folded into the requirements; the remaining non-blocking notes
are measurement-tolerance latitude that does not change what gets built.
