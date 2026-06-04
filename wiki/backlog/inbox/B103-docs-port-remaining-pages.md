---
id: B103
title: Port remaining docs pages to the new primitives (B94 follow-up #4)
type: feature
priority: medium
created: 2026-06-04
predecessor: B101
---

## Description

Port the remaining narrative docs pages onto B100's primitives.

### Scope

Build `+page.svelte` versions of:

- `site/src/routes/docs/key-heuristics/`
- `site/src/routes/docs/recipes/`
- `site/src/routes/docs/zod4-schema-coverage/`
- `site/src/routes/docs/bugs/`

Each page uses `<DocPage>`, embeds the relevant `<Playground>` /
`<DefRef>` / `<RelatedShowcase>` primitives, and gets a row in
`sidebar.ts`. Prose ports verbatim from the matching `docs/*.md`. The
`docs/*.md` files stay canonical (human-policed parity).

## Acceptance

- Each route renders.
- All four pages appear in the sidebar.
- `pnpm validate` + `pnpm site:check` green.

## Notes

- Source: `wiki/research/reports/docs-system-design.md` §7 (deferred
  table) — first row.
- Gated on B100; coordinates with B101 (sidebar shape).
