---
id: B101
title: Rebuild /docs/getting-started + /docs/concepts on the new primitives (B94 follow-up #2)
type: feature
priority: high
created: 2026-06-04
predecessor: B100
phase: 2b
spec: wiki/specs/B101-docs-rebuild-getting-started-concepts.md
---

## Description

Second implementation card of B94's docs system. Author the first two
narrative pages on top of B100's primitives.

### Scope

- `site/src/routes/docs/getting-started/+page.svelte` — bespoke page using
  `<DocPage>` shell. Leads with `<InstallBlock pkg="zod4-mock zod" />` and
  a `<SpeedClaim ... source="site/bench/results/latest.json" />` callout
  (D17/D20). Emits ≥1 `<Playground>` and ≥1 `<RelatedShowcase>`. Prose
  ported verbatim from `docs/getting-started.md`.
- `site/src/routes/docs/concepts/+page.svelte` — bespoke page using
  `<DocPage>` shell. Prose ported from `docs/concepts.md`. Each major
  concept introduced via a `<DefRef term=…>` so they enter the Pagefind
  concept index (B104).
- Both pages registered in `site/src/lib/docs/sidebar.ts` (Concepts +
  Guides groups).

### Out of scope

- `docs/getting-started.md` and `docs/concepts.md` **stay canonical**
  in `docs/` per the §6 hand-authored convention. Parity here is
  human-policed.
- Pagefind index emission lands in B104. This card emits the
  `data-pagefind-meta` attributes but doesn't ship a search box yet.

## Acceptance

- `/docs/getting-started` renders with prose, `<InstallBlock>`,
  `<SpeedClaim>`, ≥1 `<Playground>`, ≥1 `<RelatedShowcase>`.
- `/docs/concepts` renders with prose and `<DefRef>` term anchors.
- Both pages appear in the sidebar.
- `pnpm validate` + `pnpm site:check` green.
- Visual smoke check on light + dark palettes.

## Notes

- Source: `wiki/research/reports/docs-system-design.md` §7 Card 2.
- Gates: requires B100 primitives to exist.
