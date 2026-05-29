---
id: B24
title: Refactor — decompose `WorldImpl.generateSingleItem` into four named methods
type: chore
priority: medium
flags: [review]
created: 2026-05-29
---

## Description

`WorldImpl.generateSingleItem` ([src/world.ts:1030-1193](../../src/world.ts#L1030),
164 LOC, ~23 branches) glues four disjoint pipelines together via a mutable
`result` variable and a `transformApplied` flag:

1. `sourceOverride !== undefined` — B8 with-source upsert / hit-or-miss path (line 1110 stores derived).
2. `derivedRegs.length > 0` (no source) — auto-provision + pair-loop pick. **B20** fix lives here; **B21** asymmetry lives here (no derived store).
3. `primaryRegs.length > 0` — `generateAndStorePrimary`.
4. Ad-hoc (unregistered schema).

The trailing `if (options?.overrides) result = deepMerge(...)` +
`if (options?.transform && !transformApplied) result = ...` block exists only
to paper over the fact that one branch already applied them and the others
didn't.

Split into:

```ts
private generateWithSourceOverride(schema, regs, source, options): unknown
private generateDerivedAutoSource(schema, derivedRegs, options): unknown
private generatePrimary(schema, primaryReg, options): unknown
private generateAdHoc(schema, options): unknown
```

`generateSingleItem` becomes the ~20-line dispatcher that resolves the mode,
calls the matching method, and applies the trailing override/transform block
only for the branches that need it.

**Closes B21** along the way: the no-source-derived path's "doesn't store the
derived record" asymmetry is currently easy to miss because it's buried in
the cascade; pulling it into its own method makes the missing
`if (this.effectiveStore) this.registry.store(...)` obvious to add.

Flagged `review` — the user should approve the four method signatures and
the B21 resolution direction (store-by-default vs. document the asymmetry)
before tests/impl.

## Notes
- Source: [B22 research report](../../research/codebase-complexity.md), proposed item **#2**.
- Dimensions: 1 (164 LOC + 4 branches), 3 (long body, mode-flag mental load), 4 (single-item asymmetry).
- Size: **M**.
- Resolves: **B21** (no-source derived storage asymmetry — naturally falls out of the decomposition; user picks the direction during spec).
- Related: B25 (`resolveMode` extraction) could land first to simplify the dispatcher; not a hard prerequisite.
