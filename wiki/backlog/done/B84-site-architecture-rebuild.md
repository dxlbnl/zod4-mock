---
id: B84
title: Site architecture rebuild — docs + playground + comparison on @dxlbnl/ui
type: research
priority: high
flags: [review]
created: 2026-06-03
---

## Description

Maintainer reframe at the Phase B work-plan checkpoint (2026-06-03): instead of
running individual restructure items in isolation, scope the entire site rebuild
as one research effort. The target is **one cohesive site** that does three
things well, on a shared component-library foundation.

### Three surfaces

1. **Solid docs** — getting-started, concepts, API reference, key heuristics,
   recipes, schema coverage. Authoring model, navigation, search/discovery,
   how content stays in sync with the library.
2. **A way to check / play with data** — interactive surface(s) for trying
   `generate(schema)` APIs end-to-end. Subsumes B80 (playground integration)
   and absorbs the current `playground/` workspace's role.
3. **Comparison to other Zod fixture / mock frameworks** — the ecosystem
   matrix + the bench. Consumes B83's survey output as input.

### Cross-cutting

- **Adopt `@dxlbnl/ui`** (the maintainer's component library) as the
  design-system foundation. Supersedes B79 (DS scope).
- Honor D17 (CLI bench citable, browser qualitative), D18 (mdsvex
  playground hydration), D19 (`/` audience), D20 (honest speed framing).

### Outputs

A research report at `wiki/research/reports/site-architecture-rebuild.md`
covering:

- **IA + routes** — which surfaces exist, which routes, navigation model,
  what the homepage funnel looks like.
- **Docs system** — authoring path (mdsvex variant? generated from `docs/`?),
  search, navigation, version/sync story.
- **Playground** — interactive `generate(schema)` surface(s); how the current
  `vitest`-based `playground/` workspace is absorbed or deprecated.
- **Comparison surface** — how the matrix + bench numbers render; how B83's
  ecosystem list flows in.
- **`@dxlbnl/ui` adoption** — inventory current `site/src/lib/components/`,
  map to `@dxlbnl/ui` equivalents, list gaps (components that don't yet
  exist in `@dxlbnl/ui`), propose migration order.
- **Phasing** — which existing inbox cards land _as part of_ this rebuild
  vs. become obsolete vs. stay independent. Tentative classification:
  - Land as part of rebuild: B69 (worker), B70 (unify schemas),
    B71 (budget), B73 (progress UI), B75 (Playwright smoke),
    B77 (install copy), B78 (Storybook coverage).
  - Obsoleted: B79 (DS scope — answered by `@dxlbnl/ui`),
    B80 (playground integration — sub-question here),
    B76 (light theme — `@dxlbnl/ui` defines), possibly B72 (coldstart),
    B81 (link sweep — included naturally).
  - Independent: B58-B (library work), B82 (Vercel out-of-tree).

Review-flagged: the rebuild plan needs maintainer approval before any
implementation cards are filed against it.

## Notes

- Supersedes B79 (DS scope).
- Absorbs B80 (playground integration — now a sub-question).
- Consumes B83 (ecosystem survey — output feeds the comparison surface).
- Independent of B82 (Vercel out-of-tree maintainer task) and B58-B (library).
- `@dxlbnl/ui` — confirm npm name, version, public component inventory at
  research time; component-library access TBD by maintainer.
