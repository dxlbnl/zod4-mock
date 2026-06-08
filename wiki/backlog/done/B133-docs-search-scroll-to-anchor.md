---
id: B133
title: Docs search — clicking a hit must scroll to the matched section (not page top)
type: bug
priority: medium
created: 2026-06-08
predecessor: B128
---

## Description

Maintainer-reported on the live deploy: docs search works, but clicking a result navigates to
the page **top** instead of scrolling to the matched section. Root cause (deeper than the search
component): the narrative docs pages assign heading `id`s **client-side in `DocPage.svelte`'s
`onMount`**, so the **prerendered HTML Pagefind indexes carries no heading anchors** — Pagefind
returns no anchored `sub_results`, and `#fragment` deep-links also fail on initial load. Only
`/docs/api` worked (it renders ids at build time).

## Fix

- **Heading ids at build time:** extract the slug fn to `site/src/lib/docs/slug.ts`; a build-time
  step `site/scripts/inject-heading-ids.ts` (`node-html-parser`) injects slug ids into `<h2>/<h3>`
  in the prerendered docs HTML, run after `vite build` and before the Pagefind index. So the index
  gets the anchors and served-HTML deep-links resolve.
- **Search uses the anchor:** `DocsSearchInput` links hits to `sub_results[0].url` (anchored);
  `strip()` preserves the `#fragment`.
- Regression e2e: typing `determinism` → clicking the top hit → URL gains `#determinism` and the
  heading is scrolled into view.

## Resolution

Done — reviewer PASS, e2e 76 green. Standing constraint **D31** (prerendered `/docs` heading ids
present at build time) logged + promoted to `architecture.md`. Site-only, no changeset.
