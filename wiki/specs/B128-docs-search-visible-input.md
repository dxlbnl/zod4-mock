# B128: Docs search — visible, working, styled input (supersedes B104's modal UI)

## Context

B128 fixes the docs search reported broken in the maintainer review: it "is left-aligned,
not well styled, and doesn't work." The fix is directed by the maintainer-approved
docs-UX plan
[wiki/research/reports/docs-ux-rework.md](../research/reports/docs-ux-rework.md) §"Keep /
revert / re-scope" — the B104 Pagefind **engine** (build-time index + concept synonyms)
is **KEEP**, its button→modal **UI** is **re-scoped** to "a visible, working, styled
input." The card:
[wiki/backlog/doing/B128-docs-search-visible-input.md](../backlog/doing/B128-docs-search-visible-input.md).

### What stays from B104, what this supersedes

[B104](B104-docs-pagefind-search-ui.md) shipped the search layer end-to-end. B128 keeps
B104's **engine** unchanged and **supersedes only its UI**:

- **KEEP (B104, untouched):** the build-time Pagefind index over the prerendered `/docs`
  HTML (B104-R1/R2/R3 + D25), the `data-pagefind-body` / `-ignore` / `-meta="concept:<term>"`
  attributes B100 primed, the typed concept-synonym manifest
  [`site/src/lib/docs/concepts.ts`](../../site/src/lib/docs/concepts.ts) emitted as a
  Pagefind synonym table (B104-R6), and the `<DefRef>` concept-filter summary behavior
  (B104-R7). These are the engine — the report says it works.
- **SUPERSEDE (B104-R4/R5):** the current
  [`DocsSearch.svelte`](../../site/src/lib/docs/widgets/DocsSearch.svelte) renders a
  `@dxlbnl/ui` `Button variant="ghost"` ("Search") that opens a `@dxlbnl/ui` `Modal`
  overlay, mounted in the **root layout's** `.header-tools`
  ([`site/src/routes/+layout.svelte`](../../site/src/routes/+layout.svelte)). The widget
  already carries two site-side workarounds for the Modal it wraps — manual focus-into-panel
  on open (the Modal "does not move focus into the panel") and a manual Escape handler (the
  Modal's "native cancel/Escape is not dismissing"). Those workarounds are evidence the
  modal surface is the source of the brokenness. B128 **replaces the button→modal with a
  visible search input** at the **top of the docs sidebar**
  ([`site/src/routes/docs/+layout.svelte`](../../site/src/routes/docs/+layout.svelte)),
  results rendering as a styled dropdown/list beneath the input.

Because the modal is dropped, any upstream `@dxlbnl/ui` `Modal` focus/Escape gaps noted in
B104 become **moot** for this surface — they are no longer in the search path.

### "Doesn't work" — diagnose against the prod build, pin the observable

The Pagefind index exists **only in the built site** — `vite dev` never emits it, and the
B75 Playwright `webServer` serves `pnpm build && pnpm preview` (the production build),
which is where the search must be diagnosed and verified. The report's "doesn't work" has
several plausible root causes — the Modal a11y/focus stopgaps not actually firing, the
`/pagefind/pagefind.js` bundle not loading (wrong path / not served), results not rendering,
a wrong/normalized result URL that doesn't navigate, or the index not covering the prose.
The exact root cause is **only determinable by reproducing in the prod build at
implementation time** (see Open question 1), so this spec does not pre-name it: it pins the
**observable end-state** — in the prod build, typing a real docs term into the visible input
returns ≥1 linked result that navigates to a `/docs/...` route — and requires the
implementer to diagnose and fix whatever currently prevents it (B128-R5, the regression
requirement).

### Binding standing constraints this card complies with

- **D25** — the build-time Pagefind index over the prerendered `/docs` subtree stays in
  place; B128 changes only the query UI, not the index build. `/docs` stays prerendered and
  Pagefind keeps re-indexing it; the gates re-verify both (B128-R7).
- **D22** — the search widget is a `window`/Pagefind-touching client widget; it **MUST NOT**
  import the Pagefind bundle or touch `window`/`document` at module load — the bundle loads
  behind `onMount` / `if (browser)` (the existing widget's pattern, preserved).
- **D21** — the input + results dropdown style with `@dxlbnl/ui` tokens in the existing
  `@layer site`; no new CSS layer.
- **D18** — the "no `window`/Pagefind at module load" lesson carries from the playground
  fence precedent; D22 is its docs-widget successor and binds here.
- **D1** — no `any`; new relative imports use `.js` extensions.

The site is a **browser-enabled** project (Playwright via the B75 `@playwright/test`
harness, `site/e2e/*.spec.ts`, served by `pnpm build && pnpm preview`), so the interactive
search scenarios are `Scenario (UI):` and verified in a real browser at review. The search
e2e (`site/e2e/docs-search.spec.ts`) **MUST** run against the **prod-build** `webServer` so
the Pagefind index exists when assertions run — a `vite dev` search test would be
meaningless.

Package manager: **pnpm** (per [architecture.md](../architecture.md)).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B128-R1: Visible, styled search input replaces the button→modal

The docs search **MUST** present a **visible search input** at the top of the docs sidebar
([`site/src/routes/docs/+layout.svelte`](../../site/src/routes/docs/+layout.svelte)) — an
always-visible `role="searchbox"` (or `type="search"`) input with an accessible name
matching `/search/i` — and **MUST NOT** require activating a "Search" button to open a
modal overlay before a query can be typed.

- Scenario (UI): visible searchbox present without opening a modal
  - GIVEN the production build is served (`pnpm build && pnpm preview`)
  - WHEN Playwright navigates to `/docs/concepts`
  - THEN a `getByRole("searchbox", { name: /search/i })` is visible on the page **without**
    any prior click, AND no `getByRole("button", { name: /search/i })` is required to reveal
    it (the input is the trigger, not a modal opener).

### B128-R2: Typing queries Pagefind and renders a styled results dropdown/list

The search input **MUST** query the built Pagefind index as the user types and render the
matching hits as a styled results dropdown/list beneath the input (not a centered/left-aligned
modal overlay), each hit linking to its source `/docs/...` route.

- Scenario (UI): typing surfaces linked results in a list under the input
  - GIVEN the production build (with the Pagefind index) is served and `/docs/concepts` has
    loaded
  - WHEN the user types a term that appears in docs prose (e.g. `determinism`) into the
    visible search input
  - THEN a results region appears beneath the input containing at least one
    `a[href^="/docs/"]` whose visible text references the term, and the results region is not
    a full-screen/centered modal dialog.

### B128-R3: Concept-synonym and concept-summary behavior preserved (B104-R6/R7)

The new UI **MUST** preserve B104's concept behavior: a query for a configured synonym
(e.g. `field resolver`) resolves to its canonical concept's pages via the
[`concepts.ts`](../../site/src/lib/docs/concepts.ts) synonym table, and a query for a
`<DefRef>`-tagged concept term surfaces a concept-filter summary (text matching
`/concepts?/i` referencing the term with a page count) distinct from the plain prose
results.

- Scenario (UI): concept summary for a tagged term
  - GIVEN the production build is served and `<DefRef term="determinism">` appears on at
    least one indexed docs page
  - WHEN the user types `determinism` into the search input
  - THEN a concept affordance is visible whose text matches `/concepts?/i` and includes
    `determinism` together with a numeric page count (e.g. text matching `/determinism/`
    near `/\(\d+\s*pages?\)/`), distinct from the plain prose result list.

### B128-R4: Keyboard-operable and SSR-safe

The search widget **MUST** be keyboard-operable — the visible input is reachable and
typeable by keyboard, and `Escape` (when results are showing) clears/dismisses the results
list while leaving the input in a sane focus state — **and MUST NOT** import the Pagefind
bundle or touch `window`/`document` at module load (D22): the bundle loads only behind
`onMount` / `if (browser)`.

- Scenario (UI): Escape dismisses the open results, input stays usable
  - GIVEN the production build is served, `/docs/concepts` loaded, and the user has typed a
    term that produced a visible results list
  - WHEN the user presses `Escape`
  - THEN the results list is no longer visible and the search input is still present and
    focusable (a subsequent type re-opens results).
- Scenario: SSR-safe (no `window`/Pagefind at module load)
  - GIVEN the search widget is imported into the prerendered/SSR'd docs layout
  - WHEN `pnpm site:build` runs
  - THEN the build completes with no `ReferenceError: window is not defined` (or analogous
    document/Pagefind module-load error) attributable to the search widget's module-load
    phase.

### B128-R5: Regression — in the prod build, typing a real docs term returns a navigable linked result

In the **production build** (where the Pagefind index exists), typing a term that appears
in the docs prose into the visible search input **MUST** return at least one result whose
link points at a `/docs/...` route, and activating that result **MUST** navigate to that
route. This is the regression anchor for the reported "doesn't work": the implementer must
reproduce the failure against the prod build and fix whatever currently prevents this
outcome.

- Scenario (UI): typing a real docs term returns a result that navigates
  - GIVEN the production build (with the Pagefind index, B104-R2 / D25) is served via the
    B75-style `pnpm build && pnpm preview` `webServer`, and `/docs/concepts` has loaded
  - WHEN the user types `determinism` (a term present in `/docs/concepts` prose inside its
    `data-pagefind-body`) into the visible search input
  - THEN at least one result whose link `href` matches `^/docs/` is visible, AND activating
    that result navigates the page to a URL matching `/\/docs\//`.

### B128-R6: Styled with `@dxlbnl/ui` tokens in `@layer site` (designer pass both palettes)

The search input and results dropdown/list **SHOULD** be styled with `@dxlbnl/ui` tokens in
the existing `@layer site` (D21) so the surface reads as a deliberate, prominent docs
control in **both** palettes (Phosphor/dark and Paper/light) — not a left-aligned,
unstyled box — verified by a designer pass at review.

- Scenario (UI): input + results read as a styled docs control in both palettes
  - GIVEN the production build is served and the search input has produced a visible
    results list
  - WHEN the reviewer inspects the surface in the Paper (light) palette
    (`data-palette="paper"` on `<html>`) and the Phosphor (dark) palette
  - THEN in each palette the input and results region render with `@dxlbnl/ui`-token
    surface/text colors (no transparent/unstyled box, no left-aligned overlay), captured as
    a screenshot per palette at the designer pass.

### B128-R7: Validation + e2e gates stay green; index/prerender preserved

`pnpm validate` and `pnpm site:check` **MUST** be green with B128's changes, and the docs
search e2e suite (`site/e2e/docs-search.spec.ts`, run via `pnpm site:test:e2e` against the
**prod-build** `webServer`) **MUST** be green against the new visible-input UI while the
`/docs` subtree stays prerendered and Pagefind re-indexes it (D25 — `/pagefind/pagefind.js`
is still served from the built site).

- Scenario: gates green and index/prerender intact
  - GIVEN the completed B128 working tree
  - WHEN `pnpm validate`, `pnpm site:check`, and `pnpm site:test:e2e` run
  - THEN all three complete with a zero exit status, the served build still returns 200 for
    `GET /pagefind/pagefind.js`, and the docs-search e2e (rewritten/extended for the visible
    input) passes.

## Out of scope

- **The Pagefind engine itself** — the build-time index step, the prerendered `/docs`
  subtree, the synonym-table emission, and the `data-pagefind-*` attributes are B104's
  contract (B104-R1/R2/R3/R6) and are **kept unchanged**. B128 re-scopes only the query UI.
- **Command palette (⌘K)** — still a separate deferred card (B105); B128 ships a visible
  input, not a palette.
- **Site-wide search** — indexing non-`/docs` routes is still out (B104's Out-of-scope
  carries).
- **Removing the `<DefRef>` concept summary or synonym manifest** — B104-R6/R7 behavior is
  preserved, not redesigned.
- **Exact arrow-key result navigation semantics** — full up/down-arrow traversal of the
  results list is a nice-to-have; the binding keyboard contract is "typeable input + Escape
  dismiss + Enter/click navigates a linked result" (B128-R4/R5). Richer arrow traversal MAY
  be added but is not required.

## Open questions

1. **Root cause of "doesn't work" is only determinable in the prod build at implementation
   time (Non-blocking — framed into the observable, not pre-named).** The report says search
   "doesn't work," but the Pagefind index exists only in the built site, so the precise
   failure (Modal focus stopgaps misfiring, `/pagefind/pagefind.js` not loading, results not
   rendering, a normalized result URL that doesn't navigate, or the index missing the prose)
   **cannot be diagnosed from the wiki alone** — it needs prod-build reproduction. This does
   **not block** spec- or test-writing: B128-R5 is written around the observable end-state
   ("typing a real docs term in the prod build returns a navigable linked result"), so the
   implementer diagnoses and fixes whatever breaks that, and the e2e asserts the fix. Recorded;
   not blocking. (Were the failure instead a missing-index/build-pipeline regression, that
   would be a D25 engine concern outside B128's UI re-scope — but the engine is reported
   working, so this is treated as a UI/integration defect.)

2. **Exact input placement: docs sidebar header vs site nav header (Non-blocking —
   recommendation given).** The card and plan say "the docs sidebar/nav header"; the current
   widget sits in the **root layout** header (`.header-tools`, visible site-wide), while the
   docs sidebar lives in `site/src/routes/docs/+layout.svelte`. **Recommendation: place the
   visible input at the top of the docs sidebar** (it is a docs-scoped control and the sidebar
   already carries `data-pagefind-ignore` chrome), removing the root-layout button→modal
   mount. B128-R1's scenario asserts the input is visible on a `/docs/*` route without a modal,
   which either placement (sidebar header or a visible docs-nav input) satisfies; the
   implementer picks within that contract. Recorded; not blocking.

3. **Results presentation: dropdown-under-input vs an inline results panel (Non-blocking —
   implementer's call within the contract).** Whether results render as an absolutely-positioned
   dropdown beneath the input or as an inline panel in the sidebar is a presentation choice.
   B128-R2 requires only "a styled results region beneath the input, not a centered/left-aligned
   modal, with `/docs/...` links"; either presentation satisfies it. Recorded; not blocking.

No blocking open questions: the contract is pinned to observable prod-build outcomes
(visible input, results that navigate, concept summary, gates + index preserved), so the
spec advances. The "doesn't work" root cause is deliberately framed into B128-R5's
observable rather than pre-named, because it is only knowable at implementation time against
the prod build.
