---
id: B109
title: Docs polish — syntax-highlight static code blocks + Playground editor honors light/Paper palette
type: feature
priority: low
mode: lite
created: 2026-06-06
provenance: B101 per-page designer pass
---

## Description

The B101 designer pass (light + dark) on `/docs/getting-started` + `/docs/concepts`
found two non-blocking visual-consistency items:

1. **Static code blocks are unhighlighted.** The prose `<pre><code>` blocks (Steps 2–7
   on Getting Started, the `createWorld(...)` / `matchers:` blocks on Concepts) render as
   flat monochrome `--ink`, while the embedded `<Playground>` editor is fully
   Shiki-highlighted. The inconsistency reads as "some blocks are styled, some aren't."
   Apply the site's Shiki highlighting to the static docs code blocks (or a shared
   CodeBlock primitive) so all code on a page is colored consistently.
2. **Playground editor ignores the Paper (light) palette.** The CodeMirror surface in
   `<Playground>` stays a dark `#1a1a1a`-ish surface in light/Paper while the page is
   cream; the static code blocks below do follow the palette. Decide intentionally:
   theme CodeMirror to Paper, or accept dark-always and make the static blocks match the
   editor instead. Either way, make the two code surfaces consistent within a theme.

Both are legible in both themes (no contrast failure) — this is consistency polish, not
a defect.

## Notes

- Source: B101 designer review. Screenshots were in the gitignored
  `site/test-results/designer-b101/` (ephemeral).
- May intersect the B94 docs-system work and the B102 structured-API view; revisit
  ordering at planning time. The CodeMirror-palette decision is a small design choice —
  manager re-checks the lite gate (could promote to full if it turns into a shared-widget
  theming change touching `SchemaPlayground`).
