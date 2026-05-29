---
id: B23
title: Refactor — promote the per-field pipeline to a `PIPELINE` list of named steps
type: chore
priority: medium
flags: [review]
created: 2026-05-29
spec: wiki/specs/B23-promote-per-field-pipeline-to-list.md
---

## Description

The 0-through-6 per-field pipeline (the engine's headline contract,
documented in `docs/concepts.md`, `wiki/codebase-map.md`, `CLAUDE.md`, and the
module-level JSDoc at [src/world.ts:14](../../src/world.ts#L14)) is implemented
as a flat `for` body with `continue` between rungs inside
`WorldImpl.generateObjectFields` ([src/world.ts:765-911](../../src/world.ts#L765))
— **and re-implemented** in [src/explain.ts](../../src/explain.ts) and
partially in [src/generators/schema/collection.ts:generateZodObject](../../src/generators/schema/collection.ts).
Three copies, guaranteed to drift.

Promote the pipeline to a list:

```ts
const PIPELINE: ReadonlyArray<PipelineStep> = [
  overrideEagerStep, matcherStep, schemaKeyMapStep,
  unwrapOptionalStep, customKeyGenStep, keyHeuristicStep,
  schemaBasedStep,
];
```

Each step is a pure function returning a `FieldResolution` tagged union
(`{ kind: "override" | "matcher" | "fallback" | "absent" | "value"; ... }`).
`generateObjectFields` becomes `for (key) { for (step of pipeline) { if hit return } }`.
`explain.ts` calls the same list with a `dryRun: true` flag (no PRNG consumption).
`generateZodObject` walks a `PIPELINE_NO_REGISTRATION` subset.

Removes ~150 LOC of mirrored logic in `explain.ts`, removes the drift, and
makes the contract scannable (you can `console.log(PIPELINE.map(s => s.name))`).

Flagged `review` — this is the headline architectural lever from B22 and
touches all four dimensions; user should see the shape (the `PipelineStep`
type, the `FieldResolution` union) before tests/impl.

## Notes
- Source: [B22 research report](../../research/codebase-complexity.md), proposed item **#1**.
- Dimensions: 1 (per-function complexity of `generateObjectFields`), 3 (147 LOC + nested `while`), 4 (pipeline structure + cross-axis convergence), and indirectly 2 (eliminates `explain.ts` re-implementation).
- Size: **L**.
- Companion: B37 (pipeline-numbering doc reconciliation) blocks on this.
- Related: B24 (decompose `generateSingleItem`) is the other headline lever and is independent of this one.
