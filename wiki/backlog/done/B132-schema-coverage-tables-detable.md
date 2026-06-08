---
id: B132
title: Docs — Schema-coverage tables → dense non-table status layout (mobile-first)
type: feature
priority: medium
created: 2026-06-08
predecessor: B121
plan: pass 2 of the docs-tables rework (no tables in the docs site)
flags: [review]
---

## Description

Pass of the docs-tables rework ("no tables in a mobile-first docs site").
`site/src/routes/docs/zod4-schema-coverage/+page.svelte` has **18 `<table>`s** of
`Schema → Status (✅/⚠️/❌) → Notes`. Unlike the other docs tables, this is a **status matrix**
and most rows are just "✅" — so a naive per-type `DefinitionList` entry would be a sparse,
endless vertical scroll (worse than the table). This page needs a **denser** non-table layout.

### Design direction (to confirm at the review checkpoint)

Proposed: within each section (the existing `<h2>`/`<h3>` groups), render the schemas as a
compact **flowing row of status chips/badges** (e.g. `z.string() ✅`, `z.number() ✅`, …) so the
reader scans support at a glance, and pull any schema that has a **note/caveat** out into a
`DefinitionList`-style entry (term + note) beneath. Mobile-first, no `<table>`. This keeps
density for the all-supported majority while surfacing the caveats.

## Acceptance

- `/docs/zod4-schema-coverage` contains **no `<table>`**; support status is scannable (chips/
  badges) and every caveat/note is preserved as a readable entry.
- Mobile-first: no page-level horizontal overflow at 390px; the chip layout wraps cleanly.
- `pnpm site:test:e2e` + `pnpm validate` green; build prerenders. Designer pass both palettes.

## Notes

- `flags: [review]` — the chip-vs-list design is a real choice; the manager pauses for maintainer
  approval of the layout before building (or the maintainer pre-approves the proposed direction).
- May add a small `StatusChip` / chip-grid component alongside the B121 `DefinitionList`.
- Sibling of B131 (key-heuristics — straight DefinitionList).
