---
id: B116
title: Getting Started "Where to go next" entries don't link
type: bug
priority: medium
created: 2026-06-07
provenance: maintainer site review
---

## Description

Maintainer site review (2026-06-07): on `/docs/getting-started`, the **"Where to go next"**
section entries are **not links** — they render as text but don't navigate to the pages they
name. They should be working links to the relevant docs routes (`/docs/concepts`,
`/docs/recipes`, `/docs/api`, etc.).

## Notes

- Bug → full track + a regression test (e.g. extend `site/e2e/docs-content.spec.ts` to assert
  the "where to go next" entries are `<a href="/docs/...">` and resolve).
- Source page: `site/src/routes/docs/getting-started/+page.svelte` (B101).
- Likely the markup renders the next-steps as plain text/headings instead of anchors, or the
  hrefs are missing/wrong.
