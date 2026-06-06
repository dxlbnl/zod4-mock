# B104: Pagefind search UI in Nav

## Context

B104 is the search layer of the docs system designed in
[B94](../backlog/done/B94-docs-system-design.md) and elaborated in
[wiki/research/reports/docs-system-design.md](../research/reports/docs-system-design.md)
§5 (Search) + §7 (deferred table). The research report selected **Pagefind** — a
fully-static, ~50 kB-runtime search index over prerendered HTML, no external service,
no API key — and noted Pagefind's first-class support for excluding chrome via
`data-pagefind-ignore` and tagging concepts via `data-pagefind-meta`. B100 primed exactly
those attributes: [`DocPage.svelte`](../../site/src/lib/docs/widgets/DocPage.svelte) emits
the prose container with `data-pagefind-body`, the sidebar `<aside>` and on-this-page rail
carry `data-pagefind-ignore`, and [`DefRef.svelte`](../../site/src/lib/docs/widgets/DefRef.svelte)
emits `data-pagefind-meta="concept:<term>"`. B101/B102/B103 then filled the docs routes
with real indexable prose (`/docs/getting-started`, `/docs/concepts`, `/docs/api`,
`/docs/key-heuristics`, `/docs/recipes`, `/docs/zod4-schema-coverage`, `/docs/bugs`). B104
now (a) emits the Pagefind index at build time and (b) surfaces a search box in the site
nav.

The card: [wiki/backlog/doing/B104-docs-pagefind-search-ui.md](../backlog/doing/B104-docs-pagefind-search-ui.md).

### Build/deploy integration — ground-truthed against the repo (the crux)

The card's scope text guesses Pagefind should run against
`.svelte-kit/output/prerendered/pages`. **That path is wrong for the adapter actually in
use.** Ground truth from the repo:

- The site deploys via **`@sveltejs/adapter-vercel@6`**
  ([`site/svelte.config.js`](../../site/svelte.config.js): `adapter({ runtime: "nodejs22.x" })`),
  and [`site/vercel.json`](../../site/vercel.json) sets `framework: sveltekit`,
  `buildCommand: pnpm build`. There is **no** `.svelte-kit/output/prerendered/` directory.
- adapter-vercel writes its output to **`site/.vercel/output/`**: the static assets and any
  prerendered HTML land in **`site/.vercel/output/static/`** (verified — that directory holds
  `robots.txt` + `_app/immutable/`), and Vercel serves everything under
  `.vercel/output/static/` as static files (`{ "handle": "filesystem" }` in
  [`site/.vercel/output/config.json`](../../site/.vercel/output/config.json)).
- **No docs route is currently prerendered.** A grep for `prerender` over `site/src` returns
  nothing, and `.vercel/output/config.json` routes **every** path (`/`, `/docs`, `/docs/*`,
  `/showcase`, …) to a serverless function (no `*.html` files exist under
  `.vercel/output/static/`). Pagefind indexes **prerendered HTML on disk** — it cannot index
  an SSR function's runtime output. **Therefore the docs routes MUST be prerendered for
  Pagefind to see their prose.**

The resulting build/deploy contract this spec specifies:

1. The `/docs` route subtree opts into prerendering (`export const prerender = true`) so the
   build emits static `docs/**/*.html` under `site/.vercel/output/static/`.
2. A Pagefind index step runs **after** `vite build` (so the prerendered HTML exists) and is
   pointed at the adapter's real static output directory, emitting a `/pagefind/` asset dir
   **into that same static directory** so Vercel's `{ "handle": "filesystem" }` serves
   `/pagefind/*` as static assets in production.
3. The index step is wired into the site's `build` script so Vercel's `buildCommand`
   (`pnpm build`) produces the index automatically — no separate CI stage, no committed index.

This makes Pagefind a **build-time-only** tool — it is **D13-exempt** (D13 binds shipped
library/locale runtime code, not site build tooling), exactly as `ts-morph` is exempt under
D24. Pagefind (and any Pagefind UI package) is a **new devDependency of `site/`** — a standing
constraint (see Open question 1 / the D25 ADR note below), which is why the card is
`flags: [review]`.

> **Correction (B104 implementation, 2026-06-06).** The serving model above is partly wrong:
> SvelteKit's `vite preview` (which the e2e harness runs via `pnpm build && pnpm preview`) does
> **not** serve `.vercel/output/static` — it serves `.svelte-kit/output/client` plus the
> prerendered pages, and adapter-vercel _copies_ those into `.vercel/output/static` for
> production. A single directory therefore can't be both. The implemented index step builds the
> Pagefind bundle once (Node API, indexing the prerendered HTML at
> `.svelte-kit/output/prerendered/pages`) and **dual-writes `/pagefind/` into both served roots**
> — `.svelte-kit/output/client/pagefind` (so `vite preview`/e2e serve it) and
> `.vercel/output/static/pagefind` (so Vercel serves it). The R1/R2 scenarios below that name
> `.vercel/output/static/...` paths still hold for the Vercel side; the preview side is the
> `.svelte-kit/output/client` copy. This is the binding behaviour (→ D25).

### Nav integration — a real constraint surfaced

The card says "Add a `<DocsSearch>` widget to `Nav`". The site's nav is
**`@dxlbnl/ui`'s `<Nav>`** ([`site/src/routes/+layout.svelte`](../../site/src/routes/+layout.svelte)),
whose documented prop surface is `siteName` + `links` + `...rest` forwarded to the root
`<nav>` (see `/home/dexter/Projects/Web/dxlb-ui/docs/navigation.md`). **`<Nav>` exposes no
search slot.** So `<DocsSearch>` is mounted **adjacent to** `<Nav>` in the root layout
(a sibling element the layout owns), not injected into `<Nav>`'s internals — the card's
"(or wherever the site identity lives)" wording covers this. This is a local scoping choice,
recorded here (not in `decisions.md`).

### UI-verification posture

The site is a **browser-enabled** project (Playwright via the B75 `@playwright/test` harness,
`site/e2e/*.spec.ts`, served by `pnpm build && pnpm preview`). The interactive search UX is
written as `Scenario (UI):` and is verified in a real browser at review. **Test implication:**
Pagefind indexes the _built_ output, so any e2e asserting real search hits MUST run after a
full `pnpm build` that includes the Pagefind step (the B75 `webServer` already runs
`pnpm build && pnpm preview`). `vite dev` does not emit the index — a dev-only search test
would be meaningless.

Binding standing constraints this card complies with:

- **D1** — no `any`; new relative imports use `.js` extensions.
- **D13** — shipped library/locale code is untouched. Pagefind is a **build-time** tool
  (exempt). The `<DocsSearch>` widget is site code; per **D22** it MUST NOT touch
  `window`/`document` at module load (it loads the Pagefind JS bundle / runs queries only
  after `onMount`/`if (browser)`).
- **D21** — `<DocsSearch>` styles compose `@dxlbnl/ui` primitives and live in the existing
  `@layer site`; no new CSS layer is introduced.
- **D22** — the search widget is a `window`-touching client widget; construction and any
  Pagefind-bundle import defer to `onMount`/`if (browser)` (the `<Playground>` precedent).
- **D19** — the homepage `/` and its CTAs are untouched; the nav search box is additive.

Package manager: **pnpm** (per [architecture.md](../architecture.md)).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B104-R1: Docs routes prerender so their HTML is indexable

The `/docs` route subtree **MUST** be statically prerendered at build time so the adapter
emits one HTML file per docs route under the adapter's static output directory
(`site/.vercel/output/static/docs/**/*.html`), because Pagefind indexes prerendered HTML and
cannot read an SSR function's runtime output.

- Scenario: prerendered HTML exists after build
  - GIVEN a clean working tree with `prerender` enabled on the `/docs` subtree (e.g.
    `export const prerender = true` in `site/src/routes/docs/+layout.ts`)
  - WHEN `pnpm site:build` runs
  - THEN `site/.vercel/output/static/docs/index.html` and
    `site/.vercel/output/static/docs/concepts/index.html` (or the adapter's equivalent
    flat `docs/concepts.html`) exist on disk and contain the rendered docs prose (the
    `data-pagefind-body` container's text is present in the file).

### B104-R2: Pagefind index emitted post-`vite build` into the served static dir

The site's `build` script **MUST** run a Pagefind index step **after** `vite build` that
points Pagefind at the adapter's real static output directory and writes the `/pagefind/`
asset bundle **into that same directory**, so the index covers the just-prerendered docs HTML
and the assets are served by Vercel's filesystem handler in production.

- Scenario: build emits a /pagefind/ bundle in the static output
  - GIVEN the docs routes prerender (B104-R1)
  - WHEN `pnpm site:build` runs to completion
  - THEN `site/.vercel/output/static/pagefind/pagefind.js` exists and a
    `site/.vercel/output/static/pagefind/pagefind-entry.json` (the index manifest) exists,
    both produced by the Pagefind step and not by `vite build` alone.

### B104-R3: Index covers prose, ignores chrome, captures concepts

The Pagefind index **MUST** honour the B100-primed data attributes: prose inside
`data-pagefind-body` is indexed, elements under `data-pagefind-ignore` (the docs sidebar and
on-this-page rail) are excluded, and each `<DefRef>`'s `data-pagefind-meta="concept:<term>"`
is captured as a `concept` filter/meta value.

- Scenario: a prose term is indexed, a nav-only term is not
  - GIVEN the built index over `/docs/concepts` (whose prose mentions "world" inside the
    `data-pagefind-body` container, and whose sidebar `<aside data-pagefind-ignore>` lists
    link labels)
  - WHEN the Pagefind entry manifest / index is inspected after `pnpm site:build`
  - THEN the index contains a `concept` meta/filter entry whose value includes
    `"determinism"` (a `<DefRef term="determinism">` on `/docs/concepts`), and a query that
    matches **only** sidebar link text (text present in a `data-pagefind-ignore` region but
    absent from any `data-pagefind-body`) returns zero results.

### B104-R4: `<DocsSearch>` widget mounted in the site nav region

The site **MUST** expose a `<DocsSearch>` widget at
`site/src/lib/docs/widgets/DocsSearch.svelte`, rendered adjacent to `<Nav>` in the root
layout ([`site/src/routes/+layout.svelte`](../../site/src/routes/+layout.svelte)), that
exposes an accessible search trigger (a `<button>` or `role="searchbox"` input with an
accessible name matching `/search/i`). Per D22 it **MUST NOT** import the Pagefind bundle or
touch `window`/`document` at module load — the bundle loads behind `onMount`/`if (browser)`.

- Scenario: search trigger present in the nav region on every route
  - GIVEN the production build is served (`pnpm build && pnpm preview`)
  - WHEN Playwright navigates to `/` and to `/docs/concepts`
  - THEN on both routes an element with an accessible name matching `/search/i`
    (`getByRole("button", { name: /search/i })` or a search input) is present in the page
    header region.
- Scenario: SSR-safe (no `window` at module load)
  - GIVEN `<DocsSearch>` is imported into the root layout that prerenders/SSRs
  - WHEN `pnpm site:build` runs
  - THEN the build completes with no `ReferenceError: window is not defined` attributable to
    `DocsSearch.svelte`'s module-load phase.

### B104-R5: Search overlay queries the index and returns prose + concept hits

The `<DocsSearch>` widget **MUST** open a search overlay that queries the built Pagefind index
and renders result hits drawn from across the indexed docs (both narrative prose and
`<DefRef>` concept terms), each hit linking to the source docs route.

- Scenario (UI): typing a docs term returns a linked hit
  - GIVEN the production build (with the Pagefind index, B104-R2) is served and a docs page
    has loaded
  - WHEN the user activates the search trigger and types a term that appears in docs prose
    (e.g. `determinism`)
  - THEN the overlay shows at least one result whose visible text references that term and
    whose link `href` points at a `/docs/...` route, and activating the result navigates to
    that route.

### B104-R6: Typed concept synonym manifest emitted as a Pagefind synonym table

The build **MUST** read a typed concept synonym manifest at
`site/src/lib/docs/concepts.ts` and emit it into the Pagefind build so configured synonyms
(e.g. `matcher` / `ctx` / `field resolver`) resolve to a single canonical concept. The
manifest's shape **MUST** be statically typed (a readonly export, e.g.
`ReadonlyArray<{ concept: string; synonyms: ReadonlyArray<string> }>`).

- Scenario: manifest shape is statically typed
  - GIVEN a unit test (`site/src/lib/docs/concepts.test.ts`) imports the `concepts.ts`
    export and asserts at runtime that every entry has a non-empty `concept` and a non-empty
    `synonyms` array
  - WHEN `pnpm site:test:unit` runs
  - THEN the test passes (and a future shape break fails `pnpm site:check` at compile time).
- Scenario: a synonym routes to its canonical concept in search
  - GIVEN the manifest maps `field resolver` → the `matcher` concept and the build has wired
    it into Pagefind's synonym configuration
  - WHEN the served search overlay is queried for `field resolver`
  - THEN the results include the page(s) Pagefind associates with the `matcher` concept
    (i.e. the synonym query is not empty when the canonical-term query is non-empty for the
    same indexed page).

### B104-R7: Concept-filter result summary surfaced from a `<DefRef>` term

The search overlay **MUST** surface the Pagefind `concept` meta as a concept filter/summary
(e.g. a "Concepts: determinism (N pages)" affordance) so a `<DefRef>` term reachable from
search is shown as a concept hit distinct from a plain prose hit.

- Scenario (UI): concept summary for a tagged term
  - GIVEN the production build is served and `<DefRef term="determinism">` appears on at
    least one indexed docs page
  - WHEN the user searches for `determinism` in the overlay
  - THEN a concept affordance is visible whose text matches `/concepts?/i` and includes
    `determinism` together with a page count (e.g. text matching `/determinism/` near a
    numeric count), distinct from the plain prose result list.

### B104-R8: Validation gates stay green

`pnpm validate` and `pnpm site:check` **MUST** be green with B104's changes (no new
type/lint/format errors, no broken existing tests), and the B75 smoke suite
(`pnpm site:test:e2e`) **MUST** stay green for the existing routes (the additive
`<DocsSearch>` trigger introduces no load-time `console.error` / `pageerror`).

- Scenario: gates green
  - GIVEN the completed B104 working tree
  - WHEN `pnpm validate`, `pnpm site:check`, and `pnpm site:test:e2e` run
  - THEN all three complete with a zero exit status and no new errors.

## Out of scope

- **Command palette (⌘K)** — the Linear-style palette over the Pagefind index + API-symbol
  manifest is a separate card ([B105](../backlog/inbox/B105-docs-command-palette.md), the
  research report's deferred follow-up). B104 ships the search box, not the palette.
- **Indexing non-`/docs` routes** — `/`, `/bench`, `/showcase`, `/comparison`, `/explorer`
  are not part of the docs index. If a future card wants site-wide search, it widens the
  prerender + index scope; B104 indexes the docs subtree only.
- **Type-aware code blocks / Monaco** — unrelated deferred primitive.
- **`docs/*.md` ↔ site parity** — human-policed (B102 owns the API pair); search does not
  change it.
- **Committing the generated `/pagefind/` index to git** — the index is a build artifact
  produced on every `pnpm build` (and on Vercel via `buildCommand`); it is gitignored, not
  committed (subject to Open question 1's resolution).
- **A persisted "recent searches" / analytics surface** — not in v1.

## Open questions

1. **Pagefind build wiring + index-artifact policy on Vercel (RESOLVED BY CONSTRUCTION — non-blocking; review-checkpoint).**
   The card carries `flags: [review]` because adding `pagefind` (and a Pagefind UI surface) is
   a **new build-time devDependency** and a **build-pipeline change** — a standing constraint
   the manager must promote to a D25 ADR (`pagefind` is the docs search indexer; it runs
   post-`vite build` against `site/.vercel/output/static`, emits `/pagefind/` into that same
   served dir, and is D13-exempt as a build-time tool). The **integration mechanics are
   settleable from the repo** and are specified above (B104-R1..R3): adapter-vercel's static
   output is `site/.vercel/output/static/`, served via `{ "handle": "filesystem" }`; docs
   routes must prerender; the index step is wired into `site`'s `build` so Vercel's existing
   `buildCommand: pnpm build` produces it automatically — **no `vercel.json` change and no CI
   stage required.** So this does **not block** spec-writing or test-writing. It remains a
   **review checkpoint** for the maintainer to ratify (a) the new dependency and (b) the
   "index built every build, gitignored, never committed" policy. If the maintainer instead
   wants the index committed to git or built in a discrete CI step, that is a small follow-up
   adjustment to B104-R2's wiring, not a contract change. Recorded; not blocking.

2. **Pagefind UI surface: prebuilt `@pagefind/default-ui` vs a custom `@dxlbnl/ui` overlay
   over the Pagefind JS API (Non-blocking — recommendation given).** Pagefind ships a
   prebuilt `@pagefind/default-ui` (drop-in modal, its own CSS) and a low-level JS API
   (`pagefind.search(query)` returning results you render yourself). **Recommendation: build a
   thin custom overlay on `@dxlbnl/ui` primitives querying the Pagefind JS API**, because the
   card explicitly requires `@dxlbnl/ui` styling and D21 layer discipline, and because the
   concept-filter summary (B104-R7) and synonym routing (B104-R6) are cleaner to render from
   the JS API than to re-skin the default UI's shadow-DOM widget. B104-R4/R5/R7 are written
   against observable outcomes (accessible roles, visible text, link hrefs) so either surface
   can satisfy them; the recommendation is the expected path. Recorded; not blocking.

3. **e2e for real search hits requires the built index (Non-blocking — resolved by the B75
   harness).** The `Scenario (UI):` search-hit tests (B104-R5/R7) need the Pagefind index
   present, which only exists after a full `pnpm build`. The B75 Playwright `webServer` already
   runs `pnpm build && pnpm preview`, so the index is present when the e2e suite runs — no new
   harness is needed, provided the index step is part of `site`'s `build` (B104-R2). Recorded
   so the test-writer points the new search e2e at the B75-style production-served harness, not
   a `vite dev` server. Not blocking.

No blocking open questions: the build/deploy integration is settled from the repo
(adapter-vercel static dir + prerender + build-script wiring), so the spec advances; the new
dependency + pipeline change remains a maintainer **review checkpoint**, which the card's
existing `flags: [review]` already enforces.
