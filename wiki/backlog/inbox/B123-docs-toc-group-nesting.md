---
id: B123
title: Docs "On this page" TOC — visually nest/differentiate group headings from symbol links
type: feature
priority: low
mode: lite
created: 2026-06-07
provenance: B115 designer pass
---

## Description

B115 grouped `/docs/api` into 8 categories with in-page group headings (which read well).
But the right-rail "On this page" TOC renders **group labels identically to symbol links** —
because both the group `<h2>` and per-symbol `<h2 id>` flow through `DocPage`'s auto-`<h2>`
anchor-harvest as the same `<li><a>`. So in the rail, "Getting started" looks identical to
"generate" sitting below it: a long flat list of ~44 entries with no visual cue which are
categories and which are symbols. The grouping is present in order but **invisible as
structure** in the TOC.

### Ask

Visually distinguish (preferably **nest**) the TOC so it reads group → symbols:

- Minimum: style group rows distinctly (the rail already has a `.rail-heading` uppercase/dim
  treatment used for "Related" — reuse it for TOC group rows).
- Better: indent the per-symbol links one level under their group label.

This is a `DocPage`-level TOC enhancement (the TOC is auto-derived from `<h2>`s in
`DocPage.svelte`), so it needs a way to mark which `<h2>`s are group headings vs symbol
headings (e.g. a class/data-attr the harvest reads) — keep the B102 `#generate` TOC-link +
the B114 responsive behaviour green.

## Notes

- Source: B115 designer review (the one polish call; the in-page grouping itself is good).
- Touches `site/src/lib/docs/widgets/DocPage.svelte` (shared) → manager re-checks the lite
  gate (could promote if the harvest change is non-trivial). Keep B102 overlap + B114
  responsive guards green.
