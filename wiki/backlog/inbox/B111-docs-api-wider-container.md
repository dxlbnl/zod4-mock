---
id: B111
title: Widen the /docs/api content container so long generic types don't break mid-identifier
type: feature
priority: low
mode: lite
created: 2026-06-06
provenance: B102 per-page designer pass
---

## Description

B102's `/docs/api` is design-cleared (no blocker) but the designer flagged one
discretionary polish: in the narrow (~420px) shared `DocPage` content column, long
generic types break mid-identifier in the ParameterTable TYPE column and inline in
descriptions — e.g. `GenerateOptions<z.infer<TSchema>>` wraps to
`GenerateOpt`/`ions<z.infer`/`<TSchema>>`. Legible but cramped; only affects symbols
with long generic types (mainly `generate`).

The `/docs/api` reference page is denser than the narrative docs and would read better
with **more middle-column width**. Give the API route a wider content container than the
prose pages (a wider `Container` size or a route-specific modifier on `DocPage`), so long
generic types sit on fewer lines without mid-token breaks — **without** regressing the
narrative docs pages (`/docs`, `/docs/getting-started`, `/docs/concepts`) that share
`DocPage`, and without reintroducing the TOC-overlap (the `docs-api.spec.ts` overlap guard
must stay green).

## Notes

- Source: B102 final designer review. The current wrap-in-place layout (table-layout:fixed
  - word-break) is the committed B102 state; this is a readability improvement on top.
- `mode: lite` candidate: cosmetic/layout, behaviour-neutral, but it touches the shared
  `DocPage` so the manager re-checks the lite gate (auto-promote to full if a route-specific
  layout variant turns out to be a non-trivial DocPage change). Keep the B102 overlap e2e
  guard green.
