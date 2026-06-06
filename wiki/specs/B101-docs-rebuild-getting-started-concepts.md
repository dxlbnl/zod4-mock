# B101: Rebuild /docs/getting-started + /docs/concepts on the new primitives

## Context

B101 is the **second implementation card** of the docs system designed in
[B94](../backlog/done/B94-docs-system-design.md) and elaborated in
[wiki/research/reports/docs-system-design.md](../research/reports/docs-system-design.md)
(§7 → "Card 2"). B100 shipped the v1 **doc-primitive vocabulary**, the typed sidebar
chrome, and the `/docs` landing (see [B100 spec](B100-docs-primitive-library-chrome-landing.md));
it left `/docs/getting-started` and `/docs/concepts` as thin **stub** pages that link to
the canonical `docs/*.md`. B101 replaces those two stubs with **bespoke `+page.svelte`
pages authored on the B100 primitives** — the first pages that earn the new vocabulary.

The card: [wiki/backlog/doing/B101-docs-rebuild-getting-started-concepts.md](../backlog/doing/B101-docs-rebuild-getting-started-concepts.md).

### What B100 actually shipped (ground-truthed for this spec)

Every primitive this card consumes exists today under `site/src/lib/docs/widgets/`
(verified by reading each file):

- `DocPage.svelte` — page shell; props
  `{ title, sidebarGroup, order, prerequisites?, related?, editPath?, children? }`;
  renders `<h1>`, the prose container with `data-pagefind-body`, an "On this page" rail
  from `<h2>`s, an "Edit on GitHub" link when `editPath` is set.
- `InstallBlock.svelte` — `{ pkg: string }`; PM switcher; renders `pnpm add <pkg>` etc.
- `SpeedClaim.svelte` — `{ tier, value, vs, source }`, **all four required** (D17/D20);
  renders a `StatCard` + visible `source:` citation line.
- `Playground.svelte` — `{ initialCode?: string }`; SSR-safe (mounts `SchemaPlayground`
  after `onMount`, D22).
- `RelatedShowcase.svelte` — `{ entity: "review" | "order" | "user" | "product" }`;
  renders a `JsonTree` slice + a `see the full demo →` link to `/showcase#<entity>`.
- `DefRef.svelte` — **exists** (this resolves the card's open concern). `{ term: string,
children? }`; renders a focusable `<button class="def-ref">` carrying
  `data-pagefind-meta="concept:<term>"`. This is the term-anchor mechanism the concept
  index relies on; **no new primitive is needed** in B101.
- `SignatureBlock.svelte`, `ParameterTable.svelte`, `Prerequisites.svelte` — also present
  (not required by this card's scope but available).

The sidebar manifest is `site/src/lib/docs/sidebar.ts` (a `SIDEBAR:
ReadonlyArray<SidebarGroup>`), consumed by `site/src/routes/docs/+layout.svelte`. It
**already** lists `/docs/getting-started` (group `concepts`, order 1) and `/docs/concepts`
(group `concepts`, order 2). B101 therefore **preserves** those two entries rather than
adding them; the requirement below is that they remain present after the rebuild (a
regression guard, not new wiring).

Canonical prose lives in `docs/getting-started.md` and `docs/concepts.md`; these **stay
canonical** in `docs/` per the §6 hand-authored convention. B101 ports their prose
verbatim into the two `+page.svelte` pages; parity is **human-policed**, not script-guarded
(the script-guarded pair is the B102 API manifest, out of scope here).

The bench data file the `<SpeedClaim source=…>` cites is
[`site/bench/results/latest.json`](../../site/bench/results/latest.json) (CLI baseline; it
carries `simple` / `user` / `nested` / `matcher` tiers — D17 requires this CLI path as the
citation, never browser ops/sec).

The B75 page-navigation smoke suite ([B75 spec](B75-site-playwright-smoke.md),
`site/e2e/smoke.spec.ts`) already covers `/docs/getting-started` in its `ROUTE_TABLE`; it
does **not** yet cover `/docs/concepts`. B101 adds `/docs/concepts` to that table so the
rebuilt page is smoke-guarded.

Binding standing constraints (`architecture.md` Rules) this card complies with:

- **D1** — no `any`; new relative imports use `.js` extensions.
- **D13 / D22** — site code touches no `node:*`; the `<Playground>` editor mounts only
  after `onMount` (B100's primitive already enforces this; B101 just imports it).
- **D17 / D20** — every speed reference uses `<SpeedClaim source=…>` citing the CLI
  baseline `latest.json`; no "fastest"/"faster than the alternatives" prose without a
  citation.
- **D18** — not engaged: both pages are `+page.svelte` (not `+page.md`), so the mdsvex
  base64-fence rule does not apply; the D22 successor (SSR-safe editor mounting) governs,
  satisfied by importing `<Playground>`.
- **D19** — `/` homepage is untouched; both `/docs/*` routes are prerendered SvelteKit
  pages.
- **D21** — pages compose `@dxlbnl/ui` components (via the primitives) and the existing
  `@layer site` / `@layer dxlbnl` layering; no new CSS layer.
- **D5** — **not amended** by B101. `docs/getting-started.md` / `docs/concepts.md` remain
  the canonical surfaces; the site pages reuse their prose. D5's automated parity stays the
  B102 API-manifest concern.

Package manager: **pnpm** (per `wiki/architecture.md`).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B101-R1: Getting Started rebuilt on `<DocPage>` with ported prose

The route `site/src/routes/docs/getting-started/+page.svelte` **MUST** render a bespoke
page wrapping its content in `<DocPage title="Getting Started" sidebarGroup="concepts"
order={1}>` (the existing stub's link-only body is removed) whose prose is ported from
`docs/getting-started.md` (the step-by-step narrative — generate without setup, pin a seed,
matchers, relations, derive, override/transform, localize).

- Scenario (UI): page renders as a DocPage with ported prose
  - GIVEN the served site and a navigation to `/docs/getting-started`
  - WHEN the page settles (per the B75 smoke settle point)
  - THEN `getByRole("heading", { level: 1, name: "Getting Started" })` is visible, the
    page is no longer the stub (the body contains no link whose text matches
    `/canonical reference/i`), and at least one ported narrative heading from
    `docs/getting-started.md` (e.g. text matching `/Generate without/i`) is present.

### B101-R2: Getting Started leads with `<InstallBlock>`

The Getting Started page **MUST** render an `<InstallBlock pkg="zod4-mock zod" />` near the
top of the page (before the first `<Playground>`), so the install command is the first
actionable element a newcomer meets.

- Scenario (UI): install block present with the package list
  - GIVEN `/docs/getting-started` rendered
  - WHEN the page settles
  - THEN an element whose text contains `zod4-mock zod` is visible inside an install block
    that exposes a `pnpm`/`npm`/`yarn`/`bun` tablist (`getByRole("tab", { name: "pnpm" })`
    resolves), and the default visible command starts with `pnpm add zod4-mock zod`.

### B101-R3: Getting Started carries a `<SpeedClaim>` citing the CLI baseline (D17/D20)

The Getting Started page **MUST** render exactly one `<SpeedClaim>` whose `source` prop is
the CLI baseline path `"site/bench/results/latest.json"` and whose `tier` is one of the
tiers present in that file (`"simple" | "user" | "nested" | "matcher"`), so every speed
reference on the page is cited per D17/D20.

- Scenario (UI): rendered claim shows a visible citation to the CLI baseline
  - GIVEN `/docs/getting-started` rendered
  - WHEN the page settles
  - THEN the text `site/bench/results/latest.json` is visible on the page (the SpeedClaim
    citation line), and the page contains no un-cited superlative — i.e. no visible text
    matching `/\bfastest\b/i` or `/faster than the alternatives/i` that is not part of a
    `<SpeedClaim>` citation block.

### B101-R4: Getting Started embeds at least one `<Playground>`

The Getting Started page **MUST** render at least one `<Playground>` so a reader can run a
`generate(...)` example live; the editor **MUST** mount only client-side (the page imports
B100's `<Playground>`, which defers CodeMirror to `onMount` per D22).

- Scenario (UI): a playground editor mounts after hydration
  - GIVEN `/docs/getting-started` rendered in a real browser
  - WHEN the page settles and hydration completes
  - THEN at least one `.cm-editor` element is present in the document (the Playground
    mounted) and `/docs/getting-started` records no `console.error` / `pageerror` during
    load (the B75 smoke assertion for this route stays green).

### B101-R5: Getting Started embeds at least one `<RelatedShowcase>`

The Getting Started page **MUST** render at least one `<RelatedShowcase entity=…>` linking
into the live `/showcase` demo for one of the four supported entities (`review` / `order` /
`user` / `product`).

- Scenario (UI): related-showcase slice + demo link present
  - GIVEN `/docs/getting-started` rendered
  - WHEN the page settles
  - THEN a link with accessible name matching `/see the full demo/i` is present whose
    `href` matches `^/showcase#(review|order|user|product)$`.

### B101-R6: Concepts rebuilt on `<DocPage>` with ported prose

The route `site/src/routes/docs/concepts/+page.svelte` **MUST** render a bespoke page
wrapping its content in `<DocPage title="Concepts" sidebarGroup="concepts" order={2}>` (the
existing stub's link-only body is removed) whose prose is ported from `docs/concepts.md`
(World, Schemas, the generation pipeline, `ctx`, registry, determinism, localization,
populate, optional/nullable).

- Scenario (UI): page renders as a DocPage with ported prose
  - GIVEN the served site and a navigation to `/docs/concepts`
  - WHEN the page settles
  - THEN `getByRole("heading", { level: 1, name: "Concepts" })` is visible, the body
    contains no link whose text matches `/canonical reference/i` (it is no longer the
    stub), and at least two ported concept section headings from `docs/concepts.md` (e.g.
    text matching `/Determinism/i` and `/registry/i`) are present.

### B101-R7: Concepts introduces each major concept via `<DefRef term=…>` (Pagefind concept index)

The Concepts page **MUST** introduce each of its major concepts with a `<DefRef term=…>`
anchor so the term enters the B104 Pagefind concept index. At minimum the four canonical
concepts **MUST** be tagged: `world`, `registry`, `matcher`, and `determinism`.

- Scenario (UI): concept terms emit the Pagefind concept meta attribute
  - GIVEN `/docs/concepts` rendered
  - WHEN the page settles
  - THEN the document contains at least one element with
    `data-pagefind-meta="concept:world"`, one with `data-pagefind-meta="concept:registry"`,
    one with `data-pagefind-meta="concept:matcher"`, and one with
    `data-pagefind-meta="concept:determinism"` (each emitted by a `<DefRef>`), and each
    such element is a focusable control (a `<button>` / element with a `role` and an
    accessible name including its term).

### B101-R8: Both pages remain registered in the sidebar manifest

`site/src/lib/docs/sidebar.ts`'s `SIDEBAR` **MUST** continue to list both rebuilt pages
under the `concepts` group: `/docs/getting-started` (order 1, label "Getting Started") and
`/docs/concepts` (order 2, label "Concepts"). The rebuild **MUST NOT** remove or
re-group these entries.

- Scenario: sidebar still lists both rebuilt routes
  - GIVEN a unit test importing `SIDEBAR` from `site/src/lib/docs/sidebar.ts`
  - WHEN `pnpm site:test:unit` runs
  - THEN the `concepts` group's `links` include a link with `href === "/docs/getting-started"`
    and a link with `href === "/docs/concepts"`, both present after B101.

- Scenario (UI): both routes appear in the rendered sidebar with active state
  - GIVEN the served site and a navigation to `/docs/concepts`
  - WHEN the page settles
  - THEN the sidebar `<aside>` exposes a link by accessible name "Getting Started" and a
    link by accessible name "Concepts", and the "Concepts" link carries
    `aria-current="page"`.

### B101-R9: `/docs/concepts` joins the B75 smoke route table

The B75 smoke `ROUTE_TABLE` in `site/e2e/smoke.spec.ts` **MUST** include `/docs/concepts`
(it already includes `/docs/getting-started`), so the rebuilt Concepts page is guarded
against load-time `console.error` / `pageerror` regressions.

- Scenario: concepts route is smoke-covered and clean
  - GIVEN the built site served by the Playwright `webServer`
  - WHEN `pnpm site:test:e2e` runs
  - THEN `ROUTE_TABLE` contains `/docs/concepts`, the test for `/docs/concepts` executes,
    and it passes with zero collected `console.error` / `pageerror` for that route (and the
    `/docs/getting-started` test stays green).

### B101-R10: Site type-check and validate gate stay green

After the rebuild, `pnpm site:check` (svelte-check) **MUST** report zero errors and
`pnpm validate` (the root typecheck + test + lint + fmt:check gate) **MUST** pass, so the
new pages introduce no type, lint, or format regression.

- Scenario: site:check and validate are clean
  - GIVEN the working tree after B101
  - WHEN `pnpm site:check` and then `pnpm validate` are run
  - THEN `pnpm site:check` exits 0 with no svelte-check errors and `pnpm validate` exits 0.

### B101-R11: Both pages read correctly in light and dark palettes

Both rebuilt pages **SHOULD** render coherently on the site's light (Paper) and dark
(Phosphor) palettes — prose legible, the `<InstallBlock>`, `<SpeedClaim>`, `<Playground>`,
and `<RelatedShowcase>` widgets visible and not visually broken (no clipped, invisible, or
overlapping content) in either palette.

- Scenario (UI): light + dark visual pass
  - GIVEN `/docs/getting-started` and `/docs/concepts` rendered in a real browser under
    each palette (light/Paper and dark/Phosphor)
  - WHEN the reviewer/designer drives the running app (Playwright + Chrome DevTools MCP)
    and captures a screenshot of each page in each palette
  - THEN on each page in each palette the `<h1>` and the ported prose are visible and
    legible, and the embedded widgets (install block, speed claim, playground, related
    showcase on Getting Started; DefRef anchors on Concepts) are visibly rendered with no
    clipped/overlapping/invisible content — evidenced by the four screenshots.

## Out of scope

- **Canonical-prose parity guard.** `docs/getting-started.md` / `docs/concepts.md` stay
  canonical and hand-edited; B101 ports their prose but does **not** add a generated parity
  check between `docs/*.md` and the site pages. Parity is human-policed (the script-guarded
  pair is the B102 API manifest ↔ `docs/api-reference.md`).
- **Pagefind search box / index emission.** B101 emits only the `data-pagefind-meta`
  concept attributes (via `<DefRef>`) and inherits `data-pagefind-body` /
  `data-pagefind-ignore` from B100's chrome. Building the Pagefind index, the search UI,
  and the `concepts.ts` synonym manifest is **B104**.
- **Rebuilding the other doc routes** (`key-heuristics`, `recipes`,
  `zod4-schema-coverage`, `bugs`, `relational`, `comparison`) — those remain B100 stubs
  until later cards (B99/B102/follow-ups).
- **Structured `/docs/api` + `docs:generate` + D5 rewrite** — B102.
- **New `<DocPage>` / primitive props or behaviour.** B101 consumes the B100 primitives
  as-shipped; if a page needs a prop the primitive lacks, that is a B100 follow-up filed via
  `/intake`, not an inline change here.
- **`<SpeedClaim>` `value` / `vs` exact numbers.** This spec requires the `source`
  citation (D17/D20) and a valid `tier`; the precise `value` (e.g. "3.2×") and `vs` label
  are chosen by the author from `latest.json` at implementation time. The spec does not
  pin a number (pinning a stale number would itself violate the honest-framing intent).
- **Sidebar reordering / new groups.** B101 preserves the two existing `concepts` entries;
  it does not restructure the sidebar.

## Open questions

1. **DefRef existence — RESOLVED (non-blocking).** The card flagged a risk that
   `<DefRef>` might not exist (it was not among the B96 widgets). Ground-truthing the
   repo confirms `site/src/lib/docs/widgets/DefRef.svelte` **exists** (shipped by B100,
   spec B100-R7) and already emits `data-pagefind-meta="concept:<term>"`. B101 therefore
   consumes it directly and creates no new primitive. **No blocking question here — the
   run can proceed.**

2. **DefRef tooltip body content (non-blocking).** B100-R7's "Out of scope" deferred the
   per-term **tooltip body** (the actual concept definition shown on hover/focus) to
   "alongside B101's first concept page." This spec requires the `<DefRef>` term **anchors**
   (R7) but does **not** require populated tooltip bodies — the `<DefRef>` primitive renders
   the inline term and the Pagefind meta with or without a body. If the maintainer wants
   real tooltip definitions wired in B101, that is an additive scope bump; recorded as a
   non-blocking choice, default = anchors only (the search-index contract is satisfied
   either way). Item proceeds.

3. **Which `<SpeedClaim>` tier to feature (non-blocking).** `latest.json` carries
   `simple` / `user` / `nested` / `matcher`. The `user` tier is the most representative
   "realistic record" comparison (zod4-mock vs `zod3_mock` / `faker`); the author picks
   the tier + `vs` label at implementation time. Recorded; not blocking — R3 only requires a
   valid tier and the CLI-baseline `source`.

No blocking open questions. The card may advance to `test-writer`.
