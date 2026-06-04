---
id: B105
title: Command palette (⌘K) over Pagefind + API manifest (B94 follow-up #6)
type: feature
priority: low
created: 2026-06-04
predecessor: B104
---

## Description

Linear-style ⌘K palette: a thin shell over the Pagefind index plus a
list of API-symbol entries pulled from `site/src/lib/docs/api/manifest.ts`.

### Scope

- `<CommandPalette>` widget mounted in the site root layout.
- Cmd/Ctrl+K opens the palette; arrows + enter navigate.
- Hits come from two sources:
  - Pagefind search results (B104's index).
  - API symbols enumerated from `manifest.ts` (B102's manifest).
- Each hit shows kind (heading / page / API symbol) and routes on
  Enter.

## Acceptance

- ⌘K (or Ctrl+K) opens the palette anywhere on the site.
- Typing `gen` matches both the Getting Started page and the
  `generate` API symbol.
- Palette closes on Esc / outside-click.
- `pnpm validate` + `pnpm site:check` green.

## Notes

- Source: `wiki/research/reports/docs-system-design.md` §1 (Linear
  benchmark) + §7 (deferred table).
- Gated on B102 (manifest) and B104 (Pagefind index).
