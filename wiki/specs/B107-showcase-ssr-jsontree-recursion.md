# B107: `/showcase` 500s on SSR — `Tabs` `panel` is a renderer-dropping arrow, not a Snippet

## Context

The B75 Playwright smoke net ([`wiki/specs/B75-site-playwright-smoke.md`](B75-site-playwright-smoke.md),
`site/e2e/smoke.spec.ts`) caught a genuine pre-existing bug: **`/showcase` returns HTTP
500 on SSR**. The server log shows `TypeError: $$renderer.component is not a function`,
raised from the compiled showcase entity panel while the production server bundle renders.
The route works client-side and ships "green" today only because nothing navigated the
running app before B75 — the exact gap B75 closes.

**Corrected root cause (proven by the implementer with build-artifact evidence; the
original `JsonTree` self-recursion diagnosis was wrong and is not re-litigated here — see
the item card's Notes).** The defect is in the **`Tabs` usage** in
[`site/src/routes/showcase/+page.svelte`](../../site/src/routes/showcase/+page.svelte):

- `entityPanel` is a parameterized Svelte 5 snippet — `{#snippet entityPanel(key: EntityKey)}`
  (line 124) — whose **compiled** signature injects the renderer as argument 0:
  `entityPanel($$renderer, key)`.
- It is handed to `@dxlbnl/ui`'s `Tabs` as `panel: () => entityPanel(opt.key)` (line 155).
  `Tabs` declares `panel: Snippet` and renders each panel `{@render tab.panel()}`, which
  Svelte 5 compiles to `tab.panel($$renderer)`. The plain arrow **drops** that injected
  `$$renderer` and calls `entityPanel(opt.key)`, so `opt.key` (e.g. the string `"reviews"`)
  lands in `entityPanel`'s renderer slot. The first component it renders —
  `JsonTree($$renderer = "reviews", …)` — then evaluates `"reviews".component` →
  `not a function`.
- `JsonTree.svelte` is merely the **first component invoked inside the mis-called snippet**;
  it is **not** the cause and is **not** changed by this card. Any component in that slot
  would throw identically (proven: a `<svelte:self>` change to `JsonTree` had zero effect —
  same error, same line).
- **Prod-bundle-only.** Svelte's `vite dev` SSR transform tolerates the arrow-vs-`Snippet`
  shape; the production server bundle (`vite build` + preview) compiles the snippet to the
  strict `($$renderer, key)` form that exposes the dropped renderer. So it reproduces only
  under `pnpm site:test:e2e` (built/preview app), **not** `vite dev` or vitest dev-SSR.

### Pinned fix idiom (recommended mechanism — not asserted by R1)

The `@dxlbnl/ui` `Tabs` contract is the API source of truth here
([`/home/dexter/Projects/Web/dxlb-ui/docs/data.md`](file:///home/dexter/Projects/Web/dxlb-ui/docs/data.md),
the **Tabs** section, lines 82 + 94-116; per memory `reference-dxlb-ui-docs.md` the docs —
not `node_modules` — are authoritative):

- `tabs` is typed `{ id: string; label: string; panel: Snippet }[]`. `panel` is a Svelte 5
  **`Snippet`** rendered as `<div role="tabpanel">`, and the doc's canonical usage passes it
  **bare** — `panel: overview` — where `overview` is a **zero-argument** snippet
  (`{#snippet overview()}…{/snippet}`). A `Snippet` placed there receives the renderer Svelte
  injects as its first compiled argument; a plain arrow does not.

The showcase panel is parameterized by `key`, so it cannot be passed bare like the doc's
`overview`. The recommended fix is therefore to supply each tab's `panel` as a **real
zero-argument `Snippet`** that internally renders the parameterized body — e.g. a per-entity
`{#snippet usersPanel()}{@render entityPanel('users')}{/snippet}` (one wrapper per key, each
referenced bare as `panel: usersPanel`), or equivalently moving the panel into the
`{#each tabs as tab}` + `{@render tab.panel()}` form so the renderer reaches the snippet
body. The single fact the fix MUST honour: the value handed to `panel` is a `Snippet` (the
renderer Svelte 5 injects reaches the panel body), **not** a plain arrow that swallows it.
There is no other in-site `Tabs` usage to mirror (this is the only `<Tabs panel:>` call in
`site/src`); [`CodePanel`](../../site/src/lib/widgets/CodePanel.svelte) renders fine because
it takes a plain string-array `tabs` prop and never passes a snippet through a renderer.

R1 below constrains the **observable** outcome (the panel content reaches SSR and
`/showcase` renders without throwing), **not** this specific code shape — any mechanism that
delivers a proper `Snippet` to `Tabs` satisfies it.

This card is the **SSR-correctness fix only**. The D21 CSS-layer / `@dxlbnl/ui` token usage
in the route is **untouched** (this is not the B96/B95 token migration). D22
(`window`/`document` at `onMount`) is tangential — the route touches no `window`/`document`
at module load, so this fix neither engages nor changes it.

### Regression-test surface (finding)

The bug reproduces **only in the production `vite build` server bundle** — `vite dev` and
vitest dev-SSR tolerate the arrow-vs-`Snippet` shape (see root cause). A low-level
`svelte/server` `render(...)` unit test runs under the dev SSR transform and therefore
**cannot** reproduce this defect: the strict `($$renderer, key)` compiled form only appears
in the prod bundle. The regression anchor is consequently the **B75 `/showcase` smoke test**
(`site/e2e/smoke.spec.ts`), which exercises the built/preview app via `pnpm site:test:e2e` —
it is red on the unfixed tree (HTTP 500) and green once `Tabs` is given a proper `Snippet`.
This finding held in the original spec; it is here **re-attributed** to the `Tabs.panel`
snippet bug (not `JsonTree` self-recursion), and the conclusion is unchanged: the smoke test
is the correct, sufficient regression coverage and a component-level `svelte/server` test is
**not** a viable anchor for this prod-bundle-only failure.

Relevant wiki pages: [`wiki/architecture.md`](../architecture.md) (binding Rules — D21
CSS-layer / token usage untouched here, D22 tangential, the site test setup), the item card
[`wiki/backlog/doing/B107-showcase-ssr-jsontree-recursion.md`](../backlog/doing/B107-showcase-ssr-jsontree-recursion.md),
and [B75](B75-site-playwright-smoke.md) (the smoke net that surfaced this and stays parked
until this lands so it can be committed 7/7 green). Practice applied:
[`.claude/practices/debugging.md`](../../.claude/practices/debugging.md) (reproduce first;
keep the regression test).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B107-R1: the showcase entity panel is supplied to `Tabs` as a Snippet, so `/showcase` SSRs without throwing

The showcase entity-panel content **MUST** be supplied to `@dxlbnl/ui`'s `Tabs` as a proper
Svelte 5 `Snippet` — such that the renderer `Tabs` injects when it calls
`tab.panel($$renderer)` reaches the panel body — so the active tab's `JsonTree` content
renders server-side without throwing `$$renderer.component is not a function`. This
requirement constrains the **observable outcome** (the panel reaches SSR and renders), not
the exact code shape; the pinned idiom in Context is the recommended mechanism.

- Scenario: the active entity panel renders server-side
  GIVEN the built/preview showcase route served by the B75 Playwright `webServer`
  (`pnpm site:test:e2e`), with the `Tabs` `active="reviews"` tab selected
  WHEN the smoke suite navigates to `/showcase` and the page settles (`networkidle`)
  THEN no `pageerror` is emitted (in particular no `TypeError: $$renderer.component is not a
function`) and the served HTML contains the active panel's rendered `JsonTree` markup
  (e.g. a `Reviews` entity field such as the `"productId"` key), proving the panel body —
  not a dropped renderer — reached SSR.

### B107-R2: a regression test reproduces the prod-bundle SSR failure (B75 `/showcase` smoke)

A regression test **MUST** cover the failure — red on the unfixed tree, green once fixed —
and, because the defect manifests only in the production `vite build` server bundle, that
test **MUST** be the B75 `/showcase` smoke test (`site/e2e/smoke.spec.ts`, run via
`pnpm site:test:e2e`). A low-level `svelte/server` `render()` unit test runs under the dev
SSR transform that tolerates the bug, so it cannot reproduce this failure and is **not** the
anchor (finding recorded in Context). This is a `bug` item, so D6 ("when fixing a bug, a
regression test MUST be added") applies; the B75 smoke test satisfies it.

- Scenario: the regression test is red before the fix and green after
  GIVEN the B75 `/showcase` smoke test (`site/e2e/smoke.spec.ts`) run against the
  built/preview app via `pnpm site:test:e2e`
  WHEN it is run against the current (unfixed) `+page.svelte` and then against the fixed one
  THEN it **fails** against the unfixed route (the `/showcase` navigation surfaces the SSR
  500 / `pageerror`) and **passes** against the fixed route.

### B107-R3: `/showcase` returns 200 on SSR and the B75 smoke suite is 7/7 green

`/showcase` **MUST** render server-side without throwing — the served route **MUST** respond
`200` (not `500`) — and the B75 page-navigation smoke suite **MUST** pass for every route,
including `/showcase`. This is the card's headline acceptance: the route that 500s today must
serve, and the net that caught it must go green so B75 can be committed.

- Scenario: the served `/showcase` route responds 200
  GIVEN the built site served by the B75 Playwright `webServer` (`pnpm site:test:e2e`)
  WHEN the smoke suite navigates to `/showcase`
  THEN the response status is `200` (the route renders server-side without a 500) and the
  `/showcase` test reports no `console.error` and no `pageerror` during load.

- Scenario: the full smoke suite passes
  GIVEN the B75 smoke suite over its route table (`/`, `/bench`, `/showcase`,
  `/comparison`, `/explorer`, `/docs`, `/docs/getting-started`)
  WHEN `pnpm site:test:e2e` runs against the fixed tree
  THEN every route's test passes (7/7) and the process exits with status code 0.

### B107-R4: no behaviour change to the entity-panel content or the interactive `JsonTree`

The fix **MUST NOT** change the rendered entity-panel content or the client-side behaviour of
the interactive `JsonTree` it contains — the collapse/expand toggle button and the
ID-highlight rendering MUST behave exactly as before. The card scopes B107 to SSR-correctness
only ("No behaviour change to the entity-panel content or the interactive `JsonTree`
(collapse/expand, highlight)"). The existing
[`JsonTree.stories.svelte`](../../site/src/lib/widgets/JsonTree.stories.svelte) interactions
(run under the Storybook browser project via `pnpm site:test:component`) are the executable
contract: they assert the collapse button hides keys and that highlighted IDs render with the
`.value.highlight` class. `JsonTree.svelte` is not edited by this card, so these are
unaffected by the fix; the requirement guards against the `Tabs` change regressing them.

- Scenario: collapse/expand still hides and shows entries
  GIVEN the `JsonTree` "Simple object" story rendered in the browser-mode component suite
  (`pnpm site:test:component`)
  WHEN the story's play step clicks the collapse button
  THEN the entry keys (e.g. `"name"`) are no longer in the document and the collapsed
  summary (e.g. `… 8 keys`) is shown — i.e. the existing collapse/expand assertions still
  pass after the fix.

- Scenario: highlighted IDs still render highlighted
  GIVEN the `JsonTree` "With highlighted IDs" story rendered in the component suite
  WHEN the story renders with two IDs passed in `highlightIds`
  THEN exactly two elements carry the `.value.highlight` class — i.e. the existing
  highlight assertion still passes after the fix.

## Out of scope

- **`JsonTree.svelte` changes.** The disproven self-recursion theory is gone; `JsonTree` is
  not the cause and is **not** edited by this card. Its self-import + recursive render is
  correct and stays as-is.
- **B95/B96 token migration / styling.** D21 CSS-layer convention and `@dxlbnl/ui` token
  usage in the route are deliberately untouched; this card is the SSR-correctness fix, not the
  styling migration. The route's `<style>` block, classes, and token references stay as-is
  except as incidentally required by the chosen `Snippet` mechanism.
- **Library / locale / packages.** `site/` only; no `src/` (library) or `packages/*` change,
  no public API change (so the D5 docs rule does not apply). No `any` (D1).
- **D22 `window`-at-`onMount` deferral.** The route touches no `window`/`document` at module
  load; this fix does not engage D22 and must not add such a touch.
- **Other routes' SSR.** Only `/showcase` 500s from this defect; this card does not audit or
  change SSR of the other routes (B75 already smoke-covers them).
- **A component-level `svelte/server` regression test.** Considered and rejected: the defect
  is prod-bundle-only, so a dev-SSR `render()` unit test cannot reproduce it (see Context).
  R2 anchors the regression on the B75 smoke test instead.
- **Visual / pixel regression.** No screenshot diffs; client behaviour is asserted by the
  existing role/text-based `JsonTree` story interactions, not pixels.
- **`Tabs` keyboard / ARIA behaviour.** The fix restores correct panel rendering only; it does
  not add or change tab keyboard navigation, the `active` prop semantics, or the `variant`.

## Open questions

- **Exact `Snippet` shape for the parameterized panel (per-entity wrapper snippets vs.
  `{#each tabs}` + `{@render tab.panel()}`)?** — **Non-blocking (RESOLVED — pinned).** The
  `@dxlbnl/ui` docs pin the contract: `panel: Snippet`, passed bare as a zero-arg snippet
  (`/home/dexter/Projects/Web/dxlb-ui/docs/data.md`, Tabs §, lines 82 + 94-116). Because the
  showcase panel is parameterized by `key`, the recommended mechanism is a real per-entity
  zero-arg `Snippet` wrapping `{@render entityPanel(key)}` (or the equivalent `#each tab`
  render form). This is an implementation choice over how to deliver the `Snippet`; R1 fixes
  the observable (renderer reaches the panel body; `/showcase` SSRs), so it does not change
  _what_ gets built. The spec proceeds.
