---
id: B90
title: /explorer route + Constellation/Inspector/Heatmap widgets
type: feature
priority: medium
flags: [review, blocked]
created: 2026-06-03
predecessor: B85
gated-on: [B85, B86, B87, B88]
phase: 4b
---

## Description

Site-side card of B84's Phase 4b. Mounts the World Explorer at `/explorer` on
the site, consuming the library API B85–B88 ship. Phase 4 v1 ends here; the
standalone HTML artifact (`world.writeExplorer`) is deferred to v2 (B89,
filed when v1 is on `main`).

### Scope (v1)

- New site route: `site/src/routes/explorer/+page.svelte`.
- Three domain widgets in `site/src/lib/explorer/widgets/`:
  - `ConstellationGraph.svelte` — records as nodes clustered by SubjectType,
    relation picks as directed edges. Lineage edges drawn in a different visual
    channel from relation picks. Ghost nodes (dashed) for `store:false`
    ephemerals.
  - `RecordInspector.svelte` — select a node → field-by-field cards. Each
    field gets a **provenance chip** colored by its `resolution` rung. Hover
    reveals the seed trail (`worldSeed → person#1 → fork("firstName")`).
    Sibling causality arrows (`suffix ← firstName`).
  - `ProvenanceHeatmap.svelte` — grid: rows = records, columns = fields, cells
    colored by resolution rung. Reads the realism ratio at a glance.
  - `ProvenanceChip.svelte` — chip primitive reused across Inspector + Heatmap.
- View switcher: `@dxlbnl/ui` `Tabs` chrome.
- Two trace ingestion modes (entry-point banner — `@dxlbnl/ui` `Alert`):
  - **Inline mode** — user pastes schema source (or imports their `world.ts`);
    the page evaluates it via the existing D18 playground pattern (`new
Function` / IIFE) and calls `world.trace()` to produce the trace. Stays
    in-browser.
  - **Upload mode** — user pastes a `WorldTrace` JSON they generated locally
    (downloaded from `world.trace()` directly).
- No persistence — Explorer is a viewer, not a builder. Trace download
  (`Button` → Blob URL) is the only export.
- Storybook stories alongside each widget.
- `@dxlbnl/ui` covers all chrome (`Container`, `Stack`, `Inline`, `Tabs`,
  `Card`, `Alert`, `Button`, `KvList`). The four widgets above stay custom.

### Constraints

- D17 / D20: honest framing in any copy that references performance.
- D18: mdsvex playground evaluator pattern continues (the inline mode uses
  the same pattern; same evaluator, two consumers).
- Resolution-rung colour palette: green (`matcher`/`keymap`), teal
  (`key-based`), amber (`override`/`default`), grey (`schema-based`), dashed
  (`absent`). Maps to brainstorm's realism mental model.
- Identity tokens live in `site/src/lib/styles/identity.css`, layered on
  `@dxlbnl/ui`'s `tokens.css`.

### Acceptance

- `/explorer` renders without console errors.
- Pasting a small schema into inline mode produces a non-empty trace + all
  three views populate.
- Pasting a `WorldTrace` JSON into upload mode renders the same views.
- `worker.terminate()`-equivalent on schema-eval errors is graceful — page
  shows a clear error, doesn't crash.
- Constellation edges click → Inspector opens the target node.
- Heatmap cells click → Inspector opens the (record, field) pair.
- Storybook coverage for each widget.
- Playwright smoke test for `/explorer` lands in B75 (Phase 5).

### Notes

- Gated on B85 + B86 + B87 + B88 — cannot start before the library API +
  capture sinks ship. Card sits `flags: [blocked]` until then.
- Closes [B80](B80-playground-integration-decision.md) (per redirect:
  option C — deprecate playground; Explorer replaces what schema-builder
  gave the user, plus more).
- Phase 4b deletes the `playground/` workspace from `pnpm-workspace.yaml`
  and the directory.
- Phase 4 v2 (B89) — `world.writeExplorer(path)` HTML artifact — is filed
  separately when v1 ships.
