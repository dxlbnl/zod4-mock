---
id: B100
title: Docs primitive library + chrome + landing (B94 follow-up #1)
type: feature
priority: high
created: 2026-06-04
predecessor: B94
phase: 2a
---

## Description

First implementation card of B94's docs system. Builds the v1 doc-primitive
library, the `/docs` landing page, and the typed sidebar layout under
`site/src/routes/docs/+layout.svelte`. Delete `site/content/docs/*.md` and
the `[slug]` glob page; stub all not-yet-rebuilt doc routes as placeholders
that link to the canonical `docs/*.md` file (preserves D5 until each route
is rebuilt in subsequent cards).

### Scope (v1 primitive set)

Each primitive in `site/src/lib/docs/widgets/` with a `.stories.svelte`:

- **`<DocPage>`** — page shell: title, sidebarGroup, order, prerequisites,
  related links, edit-on-GitHub, auto-generated "On this page" right rail.
  Wraps `@dxlbnl/ui` `Container` + `Stack` + `Prose`.
- **`<Playground>`** — rebadge of existing `SchemaPlayground` as a
  first-class import. SSR-safe (defers editor mount per D18 successor).
- **`<SignatureBlock>`** — TS signature + 1–2-line description + optional
  inline `<Playground>`. Renders as a `Card`.
- **`<ParameterTable>`** — typed parameter rows (name, type, default,
  description) from a TS data prop, not markdown table syntax.
- **`<InstallBlock>`** — install command with pnpm/npm/yarn/bun switcher;
  PM preference stored in `localStorage`. Clicking copies + toasts (folds
  in B77's intent).
- **`<SpeedClaim>`** — D17/D20 primitive. Required props: `tier`, `value`,
  `vs`, `source`. **TypeScript MUST reject a `<SpeedClaim>` without
  `source`.** Renders as a `StatCard` with citation line.
- **`<DefRef term=…>`** — concept tooltip; emits
  `data-pagefind-meta="concept:<term>"` for future Pagefind indexing.
- **`<RelatedShowcase entity=…>`** — embed a `/showcase` slice inline.
- **`<Prerequisites pages=…>`** — Prisma-style "what you need to have
  read" callout as a `@dxlbnl/ui` `Alert` (info variant).

### Chrome

- `site/src/routes/docs/+layout.svelte` — sidebar driven by a typed
  `site/src/lib/docs/sidebar.ts` manifest (Concepts / Reference / Guides /
  How-to groups). Replaces the current hand-rolled `nav` array.
- `site/src/routes/docs/+page.svelte` — `/docs` landing. Replaces the
  current 307-redirect with a card-grid of sections.
- Stub routes for `concepts`, `key-heuristics`, `recipes`,
  `zod4-schema-coverage`, `bugs` — each is a placeholder page that links
  to the canonical `docs/*.md`. Existing `/docs/getting-started`,
  `/docs/api`, `/docs/relational`, `/docs/comparison` either get rebuilt
  in B101/B102 or stay as-is at this card.
- `data-pagefind-*` attributes on chrome (ignore sidebar/nav, mark
  page body) to prime B104's search.

### Deletions / cleanups

- Delete `site/content/docs/*.md` (api.md, comparison.md,
  getting-started.md, relational.md).
- Delete `site/src/routes/docs/[slug]/` (the mdsvex-glob page).

### Rules

- **D18 successor rule** — log in `wiki/decisions.md` + add a one-line
  RFC-2119 rule to `wiki/architecture.md` Rules section:
  > Any docs primitive that mounts an editor or other `window`-touching
  > widget **MUST** defer construction to `onMount` (or behind an
  > `if (browser)` guard) and **MUST NOT** touch `window`/`document` at
  > module load. The `<Playground>` primitive is the reference
  > implementation.

  Note that mdsvex playground fences (D18 original) remain in effect for
  any `+page.md` routes the project keeps.

## Acceptance

- `/docs` renders the new landing (no more 307 redirect).
- `/docs/+layout.svelte` renders the typed-manifest sidebar; legacy
  `nav` array deleted.
- Each v1 primitive (`<DocPage>`, `<Playground>`, `<SignatureBlock>`,
  `<ParameterTable>`, `<InstallBlock>`, `<SpeedClaim>`, `<DefRef>`,
  `<RelatedShowcase>`, `<Prerequisites>`) has a `.stories.svelte`.
- A type-level test asserts `<SpeedClaim>` without `source` fails to
  type-check (proves D17/D20 by construction).
- `site/content/docs/` and `site/src/routes/docs/[slug]/` removed.
- D18 successor rule landed in `wiki/decisions.md` + `architecture.md`.
- `pnpm validate` green; `pnpm site:check` (svelte-check) green.

## Notes

- Source recommendation: `wiki/research/reports/docs-system-design.md`
  §4 (primitives), §7 (Phasing — Card 1).
- Gates B101 (rebuild Getting Started + Concepts) and B102 (structured
  API + parity guard).
- Coordinate with B96 (finish @dxlbnl/ui migration) — that card already
  swaps primitives; this card builds the *docs* primitives layered on top.
