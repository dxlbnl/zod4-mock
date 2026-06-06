# B103: Port the remaining docs pages to the new primitives

## Context

B103 is the **fourth implementation card** of the docs system designed in
[B94](../backlog/done/B94-docs-system-design.md) and elaborated in
[wiki/research/reports/docs-system-design.md](../research/reports/docs-system-design.md)
(§7 deferred table → first row: "`<DocPage>`-ify `key-heuristics`, `recipes`,
`zod4-schema-coverage`, `bugs`"). It is the **same shape as
[B101](B101-docs-rebuild-getting-started-concepts.md)** — replace thin B100 stub pages with
bespoke `+page.svelte` pages authored on B100's primitives, porting prose verbatim from the
matching `docs/*.md` — applied to the four remaining narrative routes.

The card: [wiki/backlog/doing/B103-docs-port-remaining-pages.md](../backlog/doing/B103-docs-port-remaining-pages.md).

### What ships today (ground-truthed for this spec)

The four routes are currently **B100-R13 stubs** — each a `<DocPage>` whose body is a single
paragraph linking to the canonical `docs/*.md` (verified by reading each file):

- `site/src/routes/docs/key-heuristics/+page.svelte` — `<DocPage title="Key Heuristics"
sidebarGroup="reference" order={2}>`, body links `docs/key-heuristics.md`.
- `site/src/routes/docs/recipes/+page.svelte` — `<DocPage title="Recipes"
sidebarGroup="how-to" order={1}>`, body links `docs/recipes.md`.
- `site/src/routes/docs/zod4-schema-coverage/+page.svelte` — `<DocPage title="Schema
Coverage" sidebarGroup="reference" order={3}>`, body links `docs/zod4-schema-coverage.md`.
- `site/src/routes/docs/bugs/+page.svelte` — `<DocPage title="Known Bugs"
sidebarGroup="reference" order={5}>`, body links `docs/bugs.md`.

Every primitive this card consumes already exists under `site/src/lib/docs/widgets/`
(verified by reading each file, B100):

- `DocPage.svelte` — `{ title, sidebarGroup, order, prerequisites?, related?, editPath?,
children? }`; renders `<h1>` (via `@dxlbnl/ui` `Heading level={1}`), a `data-pagefind-body`
  prose container, an auto-built "On this page" rail from the body's `<h2>`s.
- `Playground.svelte` — `{ initialCode?: string }`; SSR-safe (mounts `SchemaPlayground`
  only after `onMount`, D22).
- `DefRef.svelte` — `{ term, children? }`; renders a focusable `<button class="def-ref">`
  carrying `data-pagefind-meta="concept:<term>"` and `aria-label={term}`.
- `RelatedShowcase.svelte` — `{ entity: "review" | "order" | "user" | "product" }`; renders a
  `JsonTree` slice + a `see the full demo →` link to `/showcase#<entity>`.

Canonical prose lives in `docs/key-heuristics.md`, `docs/recipes.md`,
`docs/zod4-schema-coverage.md`, and `docs/bugs.md`. These **stay canonical** in `docs/` per
the §6 hand-authored convention; B103 ports their prose verbatim into the four
`+page.svelte` pages. Parity is **human-policed**, not script-guarded (the script-guarded
pair is the B102 API manifest ↔ `docs/api-reference.md`, out of scope here).

The sidebar manifest `site/src/lib/docs/sidebar.ts` **already** lists all four routes with
the labels/orders/groups above. As in B101, B103 **preserves** those entries rather than
adding them; the requirement below is a regression guard that they remain present after the
rebuild.

The B75 page-navigation smoke suite (`site/e2e/smoke.spec.ts`, `ROUTE_TABLE`) does **not**
yet cover these four routes. B103 adds all four so the rebuilt pages are guarded against
load-time `console.error` / `pageerror` / SSR-500 regressions.

The B100-R13 stub-guard in `site/src/lib/docs/B100-files.test.ts` currently lists all four
routes in its `stubs` array and asserts each route's `+page.svelte` `includes(canonical)`
its `docs/<file>.md` link. Once a route is rebuilt it is no longer a link-only stub, so
B103 **drops those four routes from the B100-R13 `stubs` array** — the same cross-spec touch
B101 (which left `getting-started`/`concepts` in the list — see Open question 1) and B102
(which dropped `api`) performed before it.

### Which primitives each page warrants (mirroring B101's "don't force a primitive" judgment)

The four pages differ in content shape, so — unlike B101's two prose pages — they do **not**
all warrant the same primitives. Judged from the ported prose:

- **Recipes** — built entirely of runnable `generate(...)` / `createWorld(...)` examples
  (ad-hoc generation, reproducible data, invoicing, document corpus, …). Warrants **≥1
  `<Playground>`** so a reader can run a recipe live. No `<DefRef>` (it references concepts
  defined on `/docs/concepts`, doesn't define them) and no `<RelatedShowcase>` is forced
  (the invoicing/corpus recipes map cleanly to no single showcase entity).
- **Key Heuristics** — a reference catalogue of key→generator rules plus a "`world.explain`"
  worked example and "overriding a built-in" snippets. Warrants **≥1 `<Playground>`** (the
  `world.explain` / override examples are runnable). No `<DefRef>` / `<RelatedShowcase>`
  forced.
- **Schema Coverage** — a static support-matrix of Zod types (tables of ✅/❌/⚠️). Pure
  tabular reference with no runnable example and no term it defines. Warrants **`<DocPage>`
  only** — forcing a `<Playground>` or `<DefRef>` here would be ceremony.
- **Known Bugs** — a short "no open issues / one resolved item" page. Warrants **`<DocPage>`
  only**.

`<RelatedShowcase>` is **not warranted** on any of the four (none is a single-entity walkthrough
the way Getting Started was); requiring it would force a primitive onto pages that don't earn
it, against B101's stated judgment. The author MAY add one where it genuinely helps, but the
spec does not require it.

### Binding standing constraints (`architecture.md` Rules) this card complies with

- **D1** — no `any`; new relative imports use `.js` extensions.
- **D13 / D22** — site code touches no `node:*`; `<Playground>`'s editor mounts only after
  `onMount` (B100's primitive already enforces this; B103 just imports it).
- **D17 / D20** — these four pages carry **no speed copy**; B103 introduces no `<SpeedClaim>`
  and no superlative ("fastest" / "faster than the alternatives") prose. If the author ports a
  sentence that references speed, it MUST use the honest framing (cite tier + `latest.json`
  source via `<SpeedClaim>`) — but the ported prose carries no such claim today, so the
  default outcome is zero speed claims (R7 asserts this).
- **D18** — not engaged: all four are `+page.svelte` (not `+page.md`), so the mdsvex
  base64-fence rule does not apply; the D22 successor governs, satisfied by importing
  `<Playground>`.
- **D19** — `/` homepage untouched; all four are prerendered SvelteKit `/docs/*` routes.
- **D21** — pages compose `@dxlbnl/ui` components via the primitives and the existing
  `@layer site` / `@layer dxlbnl` layering; no new CSS layer.
- **D5** — **not amended** by B103. The four `docs/*.md` files remain canonical; D5's
  automated parity stays the B102 API-manifest concern.

Package manager: **pnpm** (per `wiki/architecture.md`).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B103-R1: Key Heuristics rebuilt on `<DocPage>` with ported prose

The route `site/src/routes/docs/key-heuristics/+page.svelte` **MUST** render a bespoke page
wrapping its content in `<DocPage title="Key Heuristics" sidebarGroup="reference"
order={2}>` (the existing stub's link-only body removed) whose prose is ported verbatim from
`docs/key-heuristics.md` (how key resolution works, the exact-key/pattern tables, localised
aliases, `world.explain` debugging, overriding a built-in).

- Scenario (UI): page renders as a DocPage with ported prose, not the stub
  - GIVEN the served site and a navigation to `/docs/key-heuristics`
  - WHEN the page settles (per the B75 smoke settle point)
  - THEN `getByRole("heading", { level: 1, name: "Key Heuristics" })` is visible, the body
    contains no link whose text matches `/canonical reference/i` (it is no longer the stub),
    and at least one ported section heading from `docs/key-heuristics.md` is present (e.g.
    text matching `/How it works/i` or `/Pattern generators/i`).

### B103-R2: Recipes rebuilt on `<DocPage>` with ported prose

The route `site/src/routes/docs/recipes/+page.svelte` **MUST** render a bespoke page wrapping
its content in `<DocPage title="Recipes" sidebarGroup="how-to" order={1}>` (the existing
stub's link-only body removed) whose prose is ported verbatim from `docs/recipes.md` (ad-hoc
generation, reproducible test data, `ctx.gen`, invoicing, document corpus, multi-API entity,
forcing a field, fixing one array item, optional probability, opting out of numeric
distributions).

- Scenario (UI): page renders as a DocPage with ported prose, not the stub
  - GIVEN the served site and a navigation to `/docs/recipes`
  - WHEN the page settles
  - THEN `getByRole("heading", { level: 1, name: "Recipes" })` is visible, the body contains
    no link whose text matches `/canonical reference/i`, and at least one ported section
    heading from `docs/recipes.md` is present (e.g. text matching `/Ad-hoc generation/i` or
    `/Reproducible test data/i`).

### B103-R3: Schema Coverage rebuilt on `<DocPage>` with ported prose

The route `site/src/routes/docs/zod4-schema-coverage/+page.svelte` **MUST** render a bespoke
page wrapping its content in `<DocPage title="Schema Coverage" sidebarGroup="reference"
order={3}>` (the existing stub's link-only body removed) whose prose is ported verbatim from
`docs/zod4-schema-coverage.md` (the per-category support matrix — primitives, string/number
validators, collections, enums, unions, special types, universal methods).

- Scenario (UI): page renders as a DocPage with the ported support matrix, not the stub
  - GIVEN the served site and a navigation to `/docs/zod4-schema-coverage`
  - WHEN the page settles
  - THEN `getByRole("heading", { level: 1, name: "Schema Coverage" })` is visible, the body
    contains no link whose text matches `/canonical reference/i`, and at least one ported
    section heading from `docs/zod4-schema-coverage.md` is present (e.g. text matching
    `/Primitive types/i` or `/Collection types/i`).

### B103-R4: Known Bugs rebuilt on `<DocPage>` with ported prose

The route `site/src/routes/docs/bugs/+page.svelte` **MUST** render a bespoke page wrapping
its content in `<DocPage title="Known Bugs" sidebarGroup="reference" order={5}>` (the
existing stub's link-only body removed) whose prose is ported verbatim from `docs/bugs.md`
(the "no open known issues" statement and the "Resolved" section).

- Scenario (UI): page renders as a DocPage with ported prose, not the stub
  - GIVEN the served site and a navigation to `/docs/bugs`
  - WHEN the page settles
  - THEN `getByRole("heading", { level: 1, name: "Known Bugs" })` is visible, the body
    contains no link whose text matches `/canonical reference/i`, and at least one ported
    section heading from `docs/bugs.md` is present (e.g. text matching `/Resolved/i`).

### B103-R5: Recipes embeds at least one `<Playground>`

The Recipes page **MUST** render at least one `<Playground>` so a reader can run one of the
ported recipes live; the editor **MUST** mount only client-side (the page imports B100's
`<Playground>`, which defers CodeMirror to `onMount` per D22).

- Scenario (UI): a playground editor mounts after hydration on Recipes
  - GIVEN `/docs/recipes` rendered in a real browser
  - WHEN the page settles and hydration completes
  - THEN at least one `.cm-editor` element is present in the document (the Playground
    mounted) and `/docs/recipes` records no `console.error` / `pageerror` during load (its
    B75 smoke assertion stays green).

### B103-R6: Key Heuristics embeds at least one `<Playground>`

The Key Heuristics page **MUST** render at least one `<Playground>` so a reader can run the
`world.explain` / override examples live; the editor **MUST** mount only client-side (B100's
`<Playground>` defers CodeMirror to `onMount` per D22).

- Scenario (UI): a playground editor mounts after hydration on Key Heuristics
  - GIVEN `/docs/key-heuristics` rendered in a real browser
  - WHEN the page settles and hydration completes
  - THEN at least one `.cm-editor` element is present in the document and
    `/docs/key-heuristics` records no `console.error` / `pageerror` during load (its B75
    smoke assertion stays green).

### B103-R7: No un-cited speed claim is introduced (D17/D20)

None of the four rebuilt pages **MUST NOT** introduce an un-cited speed superlative: any
visible text matching `/\bfastest\b/i` or `/faster than the alternatives/i` is forbidden
unless it appears inside a `<SpeedClaim>` citation block (whose `source` is the CLI baseline
`"site/bench/results/latest.json"`). The ported prose carries no such claim, so the expected
outcome is zero matches.

- Scenario (UI): no undecorated superlative on any rebuilt page
  - GIVEN each of `/docs/key-heuristics`, `/docs/recipes`, `/docs/zod4-schema-coverage`,
    `/docs/bugs` rendered
  - WHEN the page settles
  - THEN the page contains no visible text matching `/\bfastest\b/i` or
    `/faster than the alternatives/i` that is not part of a `<SpeedClaim>` citation block; if
    any speed reference is present, the text `site/bench/results/latest.json` is visible as
    its citation.

### B103-R8: All four pages remain registered in the sidebar manifest

`site/src/lib/docs/sidebar.ts`'s `SIDEBAR` **MUST** continue to list all four rebuilt pages
with their existing group/label/order: `/docs/key-heuristics` (group `reference`, label "Key
Heuristics", order 2), `/docs/zod4-schema-coverage` (group `reference`, label "Schema
Coverage", order 3), `/docs/bugs` (group `reference`, label "Known Bugs", order 5), and
`/docs/recipes` (group `how-to`, label "Recipes", order 1). The rebuild **MUST NOT** remove
or re-group these entries.

- Scenario: sidebar still lists all four rebuilt routes
  - GIVEN a unit test importing `SIDEBAR` from `site/src/lib/docs/sidebar.ts`
  - WHEN `pnpm site:test:unit` runs
  - THEN `SIDEBAR` contains a link with `href === "/docs/key-heuristics"`, one with
    `href === "/docs/zod4-schema-coverage"`, one with `href === "/docs/bugs"` (all in the
    `reference` group), and one with `href === "/docs/recipes"` (in the `how-to` group), all
    present after B103.

- Scenario (UI): a rebuilt route appears in the rendered sidebar with active state
  - GIVEN the served site and a navigation to `/docs/recipes`
  - WHEN the page settles
  - THEN the sidebar `<aside>` exposes a link by accessible name "Recipes", and that link
    carries `aria-current="page"`.

### B103-R9: All four routes join the B75 smoke route table

The B75 smoke `ROUTE_TABLE` in `site/e2e/smoke.spec.ts` **MUST** include
`/docs/key-heuristics`, `/docs/recipes`, `/docs/zod4-schema-coverage`, and `/docs/bugs`, so
each rebuilt page is guarded against load-time `console.error` / `pageerror` / SSR-500
regressions.

- Scenario: the four rebuilt routes are smoke-covered and clean
  - GIVEN the built site served by the Playwright `webServer`
  - WHEN `pnpm site:test:e2e` runs
  - THEN `ROUTE_TABLE` contains all four of `/docs/key-heuristics`, `/docs/recipes`,
    `/docs/zod4-schema-coverage`, `/docs/bugs`; the test for each executes and passes with
    zero collected `console.error` / `pageerror` for that route.

### B103-R10: B100-R13 stub-guard reconciled to drop the four rebuilt routes

The B100-R13 stub-presence test in `site/src/lib/docs/B100-files.test.ts` **MUST** be updated
so its `stubs` array no longer lists `key-heuristics`, `recipes`, `zod4-schema-coverage`, or
`bugs` (each is now a rebuilt page, not a link-only stub pointing at a canonical
`docs/<file>.md`). Removing them keeps the guard asserting only genuine stubs and prevents it
from forcing a `docs/<file>.md` link back onto a rebuilt page.

- Scenario: B100-R13 no longer asserts the four rebuilt routes as stubs
  - GIVEN the updated `site/src/lib/docs/B100-files.test.ts`
  - WHEN `pnpm site:test:unit` runs
  - THEN the B100-R13 `stubs` array contains none of `key-heuristics`, `recipes`,
    `zod4-schema-coverage`, `bugs`, the B100-R13 test passes, and the test still asserts the
    remaining genuine stub routes (`relational`, `comparison`).

### B103-R11: Site type-check and validate gate stay green

After the rebuild, `pnpm site:check` (svelte-check) **MUST** report zero errors and
`pnpm validate` (the root `check:all` + `docs:check` + `test:all` + `lint:all` + `fmt:check`
gate) **MUST** pass, so the four new pages introduce no type, lint, format, or docs-parity
regression.

- Scenario: site:check and validate are clean
  - GIVEN the working tree after B103
  - WHEN `pnpm site:check` and then `pnpm validate` are run
  - THEN `pnpm site:check` exits 0 with no svelte-check errors and `pnpm validate` exits 0.

### B103-R12: All four pages read correctly in light and dark palettes

All four rebuilt pages **SHOULD** render coherently on the site's light (Paper) and dark
(Phosphor) palettes — prose and tables legible, and the embedded `<Playground>` (on Recipes
and Key Heuristics) visible and not visually broken (no clipped, invisible, or overlapping
content) in either palette.

- Scenario (UI): light + dark visual pass
  - GIVEN each of `/docs/key-heuristics`, `/docs/recipes`, `/docs/zod4-schema-coverage`,
    `/docs/bugs` rendered in a real browser under each palette (light/Paper and dark/Phosphor)
  - WHEN the reviewer/designer drives the running app (Playwright + Chrome DevTools MCP) and
    captures a screenshot of each page in each palette
  - THEN on each page in each palette the `<h1>` and the ported prose/tables are visible and
    legible, and the embedded `<Playground>` (Recipes, Key Heuristics) is visibly rendered
    with no clipped/overlapping/invisible content — evidenced by the screenshots.

## Out of scope

- **Canonical-prose parity guard.** `docs/key-heuristics.md`, `docs/recipes.md`,
  `docs/zod4-schema-coverage.md`, `docs/bugs.md` stay canonical and hand-edited; B103 ports
  their prose but does **not** add a generated parity check between `docs/*.md` and the site
  pages. Parity is human-policed (the script-guarded pair is the B102 API manifest ↔
  `docs/api-reference.md`).
- **Pagefind search box / index emission.** B103 inherits `data-pagefind-body` /
  `data-pagefind-ignore` from B100's chrome; it does not build the Pagefind index, the search
  UI, or the `concepts.ts` synonym manifest — that is **B104**.
- **Forcing `<DefRef>` / `<RelatedShowcase>` onto pages that don't warrant them.** Per the
  primitive-judgment above, Schema Coverage and Known Bugs warrant `<DocPage>` only; no page
  is required to carry `<RelatedShowcase>`. The author MAY add a `<DefRef>` term anchor or a
  `<RelatedShowcase>` where it genuinely helps, but this is additive, not required.
- **New `<DocPage>` / primitive props or behaviour.** B103 consumes the B100 primitives
  as-shipped; if a page needs a prop the primitive lacks, that is a B100 follow-up filed via
  `/intake`, not an inline change here.
- **Regenerating / re-auditing `docs/*.md` content.** B103 ports the prose as it stands today;
  it does not refresh the schema-coverage matrix, the key-heuristics tables, or the bugs list
  against current code. Any content drift is a separate docs item.
- **Sidebar reordering / new groups.** B103 preserves the four existing entries; it does not
  restructure the sidebar.
- **Re-reconciling B101's leftover stub entries.** B103 drops only its own four routes from
  the B100-R13 `stubs` array; the `getting-started` / `concepts` entries B101 left behind (see
  Open question 1) are noted but not B103's to remove.

## Open questions

1. **B101 left `getting-started` / `concepts` in the B100-R13 stub list (non-blocking).**
   Ground-truthing `site/src/lib/docs/B100-files.test.ts` shows the B100-R13 `stubs` array
   still lists `getting-started` and `concepts`, even though B101 rebuilt both pages. The
   guard keeps passing only because each rebuilt page's `+page.svelte` happens to mention its
   `docs/<file>.md` filename in a source comment, which satisfies the brittle
   `src.includes(canonical)` check. This is a pre-existing divergence, **out of B103's scope**
   (B103 drops only its own four routes per R10). Recorded so the maintainer can decide
   whether to file a cleanup item; **non-blocking** — B103 proceeds regardless.

2. **Whether to remove the canonical-filename mention from rebuilt pages (non-blocking).**
   For B103's own four routes, R1–R4 require the body to contain no `/canonical reference/i`
   link, and R10 drops them from the B100-R13 guard — so a stray `docs/<file>.md` mention in a
   source comment is harmless (it no longer gates anything). The author MAY keep a "prose
   ported from docs/<file>.md" comment for provenance (as B101 did) or omit it; the spec does
   not require either. Recorded; **non-blocking**.

3. **Which recipe / heuristics example to seed each `<Playground>` (non-blocking).** R5/R6
   require ≥1 `<Playground>` on Recipes and Key Heuristics but do not pin the exact
   `initialCode`. The author picks a representative runnable example from the ported prose
   (e.g. Recipes' "Ad-hoc generation" `generate(...)` snippet; Key Heuristics' `world.explain`
   snippet) at implementation time. Recorded; **non-blocking** — the requirement only needs a
   mounted editor and a clean load.

No blocking open questions. The card may advance to `test-writer`.
