---
id: B61
title: Decompose generateArray into per-mode helpers (mirror B24)
type: chore
priority: low
created: 2026-06-01
report: wiki/research/reports/codebase-complexity-2026-06-01.md
---

## Description

`generateArray` ([engine.ts:1272–1457](../../../src/world/engine.ts#L1272)) is now the
single largest function in the engine (~186 LOC, ~26 branch tokens) with three full
mode-pipelines inlined (derived / primary / ad-hoc), each grown by B38/B43/B44/B52/B53
with its own override / transform / store-off / caller-max handling. Decompose it into
`generateArrayDerived` / `generateArrayPrimary` / `generateArrayAdHoc` so the
`switch (mode.kind)` becomes a thin dispatcher + a shared trailing override/transform tail —
exactly mirroring what B24 did for `generateSingleItem`. Behaviour-neutral restructuring;
the array path's contract is already pinned by existing tests.

While here, fold in the one genuine duplication the report found: the derived array arm
([engine.ts:1296–1357](../../../src/world/engine.ts#L1296)) and `generateDerivedAutoSource`
([engine.ts:1655–1666](../../../src/world/engine.ts#L1655)) build the same
`SourcePair = { source, reg, sourceIndex }` list with the same nested loop — extract a
shared `collectSourcePairs` helper.

## Notes

- Report: [codebase-complexity-2026-06-01.md](../../research/reports/codebase-complexity-2026-06-01.md) §3.2 (#1, #5), §3.3.
- Behaviour-neutral: rely on the existing array tests (B38/B43/B44/B52/B53 regression tests
  already cover overrides, transform, store-off, caller-max, per-index overrides). No new
  tests-first; `pnpm validate` must stay green.
- Depends on nothing, but cleaner to land **after B60** so it edits a smaller file.
- Changeset: `patch` (internal refactor) at most; manager decides at done time.
