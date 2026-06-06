---
id: B107
title: /showcase returns HTTP 500 on SSR — Tabs `panel` is a renderer-dropping arrow, not a Snippet
type: bug
priority: high
flags: []
created: 2026-06-06
spec: wiki/specs/B107-showcase-ssr-jsontree-recursion.md
---

## Description

The B75 Playwright smoke suite caught a genuine pre-existing bug: navigating to
**`/showcase` returns HTTP 500 on SSR**. Server log:

```
[500] GET /showcase
TypeError: $$renderer.component is not a function
    at JsonTree_1 (.../server/chunks/ecommerce.js:6:13)
    at entityPanel (.../server/entries/pages/showcase/_page.svelte.js:245:4)
```

**Corrected root cause (the original `JsonTree` self-recursion diagnosis was wrong —
disproven by the implementer with build-artifact evidence; see Notes).** The defect is in
[`site/src/routes/showcase/+page.svelte`](../../../site/src/routes/showcase/+page.svelte):

- `entityPanel` is a Svelte 5 snippet (`{#snippet entityPanel(key)}`, line 124) whose
  compiled signature is `entityPanel($$renderer, key)` (renderer injected as arg 0).
- It is handed to `@dxlbnl/ui`'s `Tabs` as `panel: () => entityPanel(opt.key)` (line 155).
  `Tabs` declares `panel: Snippet` and renders it `{@render tab.panel()}` → compiled to
  `tab.panel($$renderer)`. The arrow **drops** that injected `$$renderer` and calls
  `entityPanel(opt.key)`, so `opt.key` (e.g. the string `"reviews"`) lands in
  `entityPanel`'s renderer slot. The first child it renders — `JsonTree($$renderer=…)` —
  then hits `"reviews".component` → `not a function`.
- `JsonTree` is merely the **first component invoked inside the mis-called snippet**; it is
  not the cause. Any component there would throw identically (proven: a `<svelte:self>`
  change to `JsonTree` had zero effect — same error, same line).
- Prod-only: Svelte's `vite dev` SSR transform tolerates the arrow-vs-Snippet shape; the
  production server bundle compiles the snippet to the strict `(renderer, key)` form that
  exposes the dropped renderer. So it reproduces only under `vite build` + preview (i.e.
  `pnpm site:test:e2e`), not `vite dev` / vitest dev-SSR.

## Reproduction

- `pnpm site:test:e2e` → `/showcase` smoke test fails (HTTP 500); the other 6 routes pass.
- Or `pnpm --filter @zod4-mock/site build && pnpm --filter @zod4-mock/site preview`, then
  load `/showcase` → 500.

## Acceptance

- `/showcase` renders server-side without throwing (HTTP 200); the entity-panel tabs
  (`Reviews`/`Orders`/etc.) render their `JsonTree` content under SSR.
- The B75 smoke suite goes **7/7 green** (`pnpm site:test:e2e`).
- A regression test covers the failure: per spec B107-R2 this is the B75 `/showcase` smoke
  test (the bug reproduces only in the production bundle, so a low-level `svelte/server`
  unit test cannot — finding recorded in the spec).
- No behaviour change to the entity-panel content or the interactive `JsonTree`
  (collapse/expand, highlight).
- `pnpm validate` green; `pnpm site:check` 0 errors; the two vitest site suites green.

## Constraints

- **Fix surface is `site/src/routes/showcase/+page.svelte`** — pass `Tabs`' `panel` as a
  proper Svelte 5 `Snippet` so the renderer `Tabs` injects reaches the panel body (mirror
  the correct `@dxlbnl/ui` `Tabs` usage). `JsonTree.svelte` itself is **not** changed by
  this card. Determine the correct idiom from the `@dxlbnl/ui` docs
  (`/home/dexter/Projects/Web/dxlb-ui/docs/`, per memory `reference-dxlb-ui-docs.md`) and a
  working `Tabs`/`CodePanel` usage in the site — the spec pins it.
- `site/` only; no `src/` (library) or `packages/*` change; no new dependency; no `any`.
- D21 layer convention + `@dxlbnl/ui` token usage untouched (this is the SSR-correctness
  fix, not the B96 token migration).

## Notes

- Discovered by B75 (the Playwright smoke net) on 2026-06-06 — the net working as intended
  before the B96 migration. B75 stays parked in `doing/` until this lands so B75 can be
  reviewed/committed with a green 7/7 net.
- **Diagnosis history:** this card originally blamed `JsonTree.svelte` self-recursion. The
  implementer disproved that (build artifact `_page.svelte.js` shows `entityPanel($$renderer,
key)` called as `panel: () => entityPanel(opt.key)`; `Tabs` calls `tab.panel($$renderer)`;
  a `<svelte:self>` change to `JsonTree` did not fix it). Filename retains the original
  `-jsontree-recursion` slug to avoid rename churn; the real cause is the `Tabs.panel`
  snippet call. Same symptom (`/showcase` SSR 500), same item.
