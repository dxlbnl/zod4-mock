---
id: B131
title: Docs — Key-heuristics tables → DefinitionList (non-table, mobile-first)
type: feature
priority: medium
created: 2026-06-08
predecessor: B121
plan: pass 3 of the docs-tables rework (no tables in the docs site)
---

## Description

Pass of the maintainer-directed docs-tables rework ("no tables in a mobile-first docs site").
`site/src/routes/docs/key-heuristics/+page.svelte` has **18 `<table>`s**, all of the same
shape: `Key(s) → Generator identifier → Description` (e.g. `firstname, first_name` →
`person.firstName` → "First name"). These are clean key→value lookups — replace every one with
the **existing reusable `DefinitionList`** (`site/src/lib/docs/widgets/DefinitionList.svelte`,
built in B121): term = the key(s), value/type = the generator identifier, description = the
description prose. No `<table>` anywhere on the page.

## Acceptance

- `/docs/key-heuristics` contains **no `<table>`**; every former table row renders as a
  `DefinitionList` entry (`[data-deflist]` / `[data-term]`), preserving the key aliases,
  generator id, and description (incl. inline `<code>`).
- Mobile-first: no page-level horizontal overflow at 390px; readable.
- `pnpm site:test:e2e` (a key-heuristics assertion: no `<table>` + entries render + no overflow)
  - `pnpm validate` green; build prerenders.
- Designer pass (both palettes) before done.

## Notes

- Pure reuse of B121's `DefinitionList` (extend it only if a key-alias term needs special
  rendering). If a table maps multiple key aliases to one generator, keep all aliases in the term.
- Sibling of B132 (schema-coverage — different treatment). Lean track: the test contract is
  identical to B121's, so it MAY be folded into the implementer dispatch (manager's call).
