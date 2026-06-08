---
id: B121
title: Docs — replace the Concepts option/ctx tables with the non-table heading-per-member layout (mobile-first)
type: feature
priority: medium
created: 2026-06-07
rescoped: 2026-06-08
provenance: B114 designer pass → maintainer directive "no tables in a mobile-first docs site"
plan: pass 1 of the docs-tables rework (Concepts → Schema-coverage → Key-heuristics)
---

## Description

**Maintainer directive (emphatic):** the docs site must not use `<table>` for option/config/
parameter data — "it's a bad ux overall, it has no place in a mobile first docs site." The
original B121 premise ("keep the table, stack it on mobile") is **rejected**: no table at any
viewport. The proven replacement is the `/docs/api` **heading-per-member** layout (B125): each
entry = name + type/value on one line, description as full-width prose beneath, no grid.

This card is **pass 1** of a 3-pass rework (maintainer chose phased): **Concepts** now, then
Schema-coverage (18 tables), then Key-heuristics (18 tables) as follow-up items.

### Scope (this pass — Concepts only)

`site/src/routes/docs/concepts/+page.svelte` has two hand-written `<table>`s:

- the **"Options"** table under `<h3>Options</h3>` (~L33–34)
- the **`ctx` object** table under `## The ctx object` (~L199)

Replace both with the non-table heading-per-member presentation, mobile-first, readable at
390/768/1440 in both palettes. **Build a small reusable component** (e.g.
`site/src/lib/docs/widgets/DefinitionList.svelte` — entries of `{ term, type?, description }`)
styled to match the `/docs/api` entries, so passes 2–3 (and any future docs list) reuse it
rather than re-inlining. Compose `@dxlbnl/ui` in `@layer site` (D21), SSR-safe (D22).

## Acceptance

- The Concepts "Options" and `ctx` sections render via the non-table component — **no `<table>`**
  in those sections; each entry shows its name + type/value + description, readable on a 390px
  phone (no header-shredding, no horizontal overflow).
- `pnpm site:test:e2e` (a Concepts content/structure assertion: those sections are non-table +
  no page overflow) + `pnpm validate` green; build prerenders.
- Designer pass (both palettes) before done.

## Notes

- Reusable `DefinitionList` (or similarly named) component is the deliverable that makes passes
  2–3 cheap. Genuine 2-D matrices, if any, are out of scope — but the Concepts tables are
  key/type/desc lists, so heading-per-member fits.
- Standing preference recorded in memory (no tables in docs). Follow-ups: Schema-coverage,
  Key-heuristics conversion (file as B131/B132 when this lands).
