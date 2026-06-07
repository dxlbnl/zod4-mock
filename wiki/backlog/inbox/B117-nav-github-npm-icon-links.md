---
id: B117
title: GitHub + npm nav entries should be icon links, not normal menu items
type: feature
priority: low
mode: lite
created: 2026-06-07
provenance: maintainer site review
---

## Description

Maintainer site review (2026-06-07): the **GitHub** and **npm** links in the site nav are
styled as normal menu items. They should be **icon links** (GitHub mark + npm mark), set
apart from the textual nav (Docs / Showcase / Bench / …) — the conventional pattern for
external/utility links in a site header.

## Notes

- Site nav lives in `site/src/routes/+layout.svelte` (the `@dxlbnl/ui` `<Nav>` + the adjacent
  header region where DocsSearch was mounted in B104). Check whether `@dxlbnl/ui`'s `<Nav>`
  supports an icon-link/utility slot, or whether these move adjacent to `<Nav>` like DocsSearch.
- `mode: lite` candidate (presentational), but manager re-checks the gate — if it needs an
  icon set or a `<Nav>` API change it may grow. Phosphor/icon source: check what icon set
  `@dxlbnl/ui` ships.
- Pairs with [[B114]] (nav responsive behaviour) — manager may batch.
