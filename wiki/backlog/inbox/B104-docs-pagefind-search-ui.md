---
id: B104
title: Pagefind search UI in Nav (B94 follow-up #5)
type: feature
priority: medium
created: 2026-06-04
predecessor: B100
---

## Description

Wire **Pagefind** over the prerendered docs routes and surface a search
box in the site nav.

### Scope

- Add Pagefind as a build-time index step (post-`vite build`,
  `pagefind --site .svelte-kit/output/prerendered/pages`).
- Add a `<DocsSearch>` widget to `Nav` (or wherever the site identity
  lives) that opens an overlay on `/` / hits the Pagefind UI. Style
  with `@dxlbnl/ui` primitives.
- Respect the `data-pagefind-*` attributes B100 emitted (ignore
  chrome, mark prose body).
- Add a typed `site/src/lib/docs/concepts.ts` synonym manifest;
  build step reads it and emits a Pagefind synonym table so
  "matcher" / "ctx" / "field resolver" route to the same concept.

## Acceptance

- `/docs/*` routes are indexed by Pagefind at build time.
- Search box in `Nav` returns hits across prose and concepts.
- A `<DefRef>` term reachable from the search overlay shows the
  concept filter ("Concepts: determinism (3 pages)").
- `pnpm validate` + `pnpm site:check` green.

## Notes

- Source: `wiki/research/reports/docs-system-design.md` §5 + §7
  (deferred table).
- Gated on B100 (data attributes) and at least B101 (some pages to
  index).
