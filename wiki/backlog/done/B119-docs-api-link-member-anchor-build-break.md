---
id: B119
title: Build break — {@link World.trace} member link prerenders to a missing #World.trace anchor
type: bug
priority: high
created: 2026-06-07
provenance: B114 test-writer (discovered the broken build)
---

## Description

`pnpm build` (site) fails to prerender:

```
Error: /docs/api ... links to /docs/api#World.trace, but no element with id="World.trace" exists on /docs/api
```

**Root cause (B85 regression):** B85's `WorldTrace` TSDoc says
`{@link World.trace}` (`src/trace.ts`), which the generator carries verbatim into
`site/src/lib/docs/api/manifest.generated.ts:423`. `renderInline`
(`site/src/lib/docs/widgets/inline.ts:23`) turns `{@link World.trace}` into
`<a href="#World.trace">`, but `/docs/api/+page.svelte:28` emits anchors only for
**top-level** symbol names (`<h2 id={sym.name}>` → `#World`, `#WorldTrace`, …) — there is
no `#World.trace` (member) anchor. SvelteKit's default `prerender` then **hard-fails the
whole build** on the dangling anchor. It slipped through B85 because `pnpm validate` does
**not** run the prod build/prerender and B85 (a library card) didn't run the site e2e.

### Fix (two parts)

1. **`renderInline`** — resolve a **member** `{@link X.y}` to the **top-level symbol
   anchor `#X`** (the symbol that actually has an on-page anchor), so `{@link World.trace}`
   → `#World`. Bare `{@link X}` keeps linking `#X`. (Optionally render the member as visible
   text `World.trace` while the href points at `#World`.)
2. **`site/svelte.config.js`** — set `prerender.handleMissingId` to `'warn'` (not the
   default hard error) as a safety net so a future dangling doc cross-reference warns
   instead of taking down the entire build/deploy.

### Regression guard

- A unit test on `renderInline`: `{@link World.trace}` (and any `{@link X.y}`) resolves to
  `href="#World"` (the base symbol), not `#World.trace`.
- The site build/prerender succeeds (the `pnpm site:test:e2e` harness builds the prod app —
  it going green is the integration guard).

## Notes

- Bug → regression test required (D6).
- Process gap surfaced: `pnpm validate` does not catch prod-build/prerender breakage (no
  `build` step). Consider (separately) adding a build/prerender check to the validate gate
  so library cards can't silently break the site build via docs cross-references.
