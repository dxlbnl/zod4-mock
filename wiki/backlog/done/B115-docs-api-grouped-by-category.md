---
id: B115
title: Group the /docs/api reference by category (World methods / matchers / types …)
type: feature
priority: medium
created: 2026-06-07
provenance: maintainer site review
predecessor: B102
spec: wiki/specs/B115-docs-api-grouped-by-category.md
---

## Description

Maintainer site review (2026-06-07): `/docs/api` renders as **one large flat list with no
mental model**. Group it so a reader can orient — e.g. **`World` methods**, **matchers /
generation helpers**, **types**, **World Explorer (trace) types**, etc.

### Scope

- The curation layer (`scripts/docs/curation.ts`) **already carries a `group` per symbol**
  (B102; B85 added a "World Explorer" group). Surface those groups in the `/docs/api` view
  (`site/src/routes/docs/api/+page.svelte`): render grouped sections with headings, and make
  the right-rail TOC reflect the grouping.
- Review/curate the group taxonomy so it reads as a sensible mental model (methods vs helpers
  vs types). Adjust `CURATION` group labels/assignments as needed.
- Keep the B102 parity guard green (the generated `docs/api-reference.md` should reflect the
  grouping too, or at least stay in sync via `docs:check`).

## Notes

- Builds on B102's structured API view; the data (groups) exists — this is mostly a render +
  taxonomy task.
- Pairs naturally with [[B111]] (wider `/docs/api` container) and [[B114]] (responsive) since
  they all touch the API page layout — manager may batch them.
