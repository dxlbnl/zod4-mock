---
id: B121
title: Mobile — stack/card the docs Options (ParameterTable) instead of a cramped 4-col table
type: feature
priority: low
mode: lite
created: 2026-06-07
provenance: B114 per-viewport designer pass
---

## Description

B114's per-viewport designer pass (mobile 390) found one non-blocking nit: the Concepts
"Options" `<ParameterTable>` is a 4-column table (OPTION / TYPE / DEFAULT / DESCRIPTION)
squeezed into a 390px phone — the "DESCRIPTION" header wraps to "DESCRIPTI/ON" and cells
wrap tightly. Readable but cramped (inherent to a 4-col table on a phone).

Consider a **stacked / card layout** for `ParameterTable` at mobile (≤767): each parameter
becomes a labeled block (label + value pairs) instead of a 4-col row, so it reads cleanly on
a narrow screen. Desktop keeps the table.

## Notes

- Source: B114 designer review (mobile). Left out of B114 scope (B114 fixed the
  reflow/width; this is a per-component mobile rendering nicety).
- `ParameterTable.svelte` (`site/src/lib/docs/widgets/`). `mode: lite` candidate (CSS /
  small markup, behaviour-neutral); manager re-checks the gate.
