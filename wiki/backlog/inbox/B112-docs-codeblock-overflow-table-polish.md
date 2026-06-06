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
three non-blocking rendering-polish items across the docs pages:

1. **Static code blocks clip at the right edge with no visible scrollbar** (both themes,
   on the code-heavy pages — key-heuristics, recipes). Wide non-wrapping lines like
   `const world = createWorld({…}).withSche[ma…` and wide table cells get cut with no
   affordance to scroll. Fix: give static `<pre><code>` blocks (and wide table cells)
   `overflow-x: auto` with a visible scrollbar, or wrap. (Same overflow family as B102's
   `/docs/api`, but for static code blocks rather than the signature/param-table.)
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
