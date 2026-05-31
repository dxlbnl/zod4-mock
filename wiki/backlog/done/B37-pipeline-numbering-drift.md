---
id: B37
title: Chore — reconcile pipeline-numbering drift across docs/code/JSDoc
type: chore
priority: low
flags: []
created: 2026-05-29
---

## Description

The per-field generation pipeline (the engine's headline contract) is
documented in five places that **do not agree**:

- `docs/concepts.md` — lists steps 0-5 (6 rungs).
- `src/world.ts` module-level JSDoc at [src/world.ts:14-26](../../src/world.ts#L14) — lists steps 0-6 (7 rungs).
- `wiki/codebase-map.md` — names the pipeline conceptually without numbering.
- `CLAUDE.md` — lists 6 rungs.
- `src/explain.ts` — re-implements the ladder and labels the rungs differently ("Rule 3 — world-level custom generator" placed before the exact-key map).

Pick one canonical ordering (the code), document it in one place
(`docs/concepts.md`), and make every other doc point at that page.

**Blocked on B23** — the `PIPELINE` list from B23 becomes the literal source
of truth. Doc reconciliation then has a real source to point at. Filing now
as a tracking marker so the drift doesn't get forgotten when B23 lands;
unblock by removing `flags: [blocked]` once B23 is in `done/`.

## Notes
- Source: [B22 research report](../../research/reports/codebase-complexity.md), proposed item **#15**, also `## Dimension 4 → Drift between code and documentation`.
- Dimension: 4 (drift).
- Size: **XS** (post-unblock).
- Blocked on: **B23** (promote pipeline to list).
- Reviewer's 3 minor cosmetic findings from B22 (pipeline rung counts off by one, `email` LOC off by one, `types.ts` fan-in off by one) can be folded into this item's commit when it lands.
