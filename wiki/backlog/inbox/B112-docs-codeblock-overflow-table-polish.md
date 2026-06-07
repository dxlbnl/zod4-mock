---
id: B112
title: Docs polish — static code-block right-edge clipping, light Playground-output contrast, schema-coverage table headers
type: feature
priority: low
mode: lite
created: 2026-06-06
provenance: B103 per-page designer pass
---

## Description

The B103 designer pass (light + dark, all 4 rebuilt pages) found **no blockers** but
non-blocking rendering-polish items across the docs pages:

> **Item 1 folded into B114 (2026-06-07)** — "static code blocks clip with no scrollbar":
> B114's responsive rework bounded the `<pre>` scroll containers (R6, no page overflow) and
> widened the prose track, addressing the code-block overflow. If clipping persists on
> specific code-heavy pages after B114, re-file. The remaining B112 items below stand.

2. **Light/Paper Playground _output_ text is dim** — the generated-JSON output sits on the
   dark sunken code surface in Paper mode and reads low-contrast (faint keys/braces).
   Lift the output ink/punctuation contrast in the Paper palette. (Relates to [[B109]]'s
   Playground-palette item.)
3. **`/docs/zod4-schema-coverage` table headers run together** — STATUS and NOTES render
   as "STATUSNOTES" on the narrower matrix tables, and the NOTES column wraps cramped
   while horizontal space sits empty to the right. Fix: min-width/padding on the status
   column or widen the table/notes column.

## Notes

- Source: B103 final designer review. Screenshots were in gitignored
  `site/test-results/designer-b103/` (ephemeral).
- Overlaps [[B109]] (docs code-highlight + Playground palette) — consider doing them
  together. Item 1 also relates to [[B111]] (wider /docs/api container). `mode: lite`
  candidate (CSS-only, behaviour-neutral); manager re-checks the gate.
