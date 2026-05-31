---
id: B32
title: Refactor — extract `resolveRelationPool` shared between `resolveRelated` + `resolveRelatedMany`
type: chore
priority: low
flags: []
created: 2026-05-29
---

## Description

`WorldImpl.resolveRelated` and `WorldImpl.resolveRelatedMany`
([src/world.ts:541-679](../../src/world.ts#L541), 67 + 71 LOC) are ~80%
identical: cache key, pool snapshot, `where` filter, empty-pool throw, PRNG
fork. They diverge only in (a) the auto-provision logic (`ensurePrimaryRecord`
vs explicit loop in the `many` path) and (b) the final pick (`prng.pick(pool)`
vs `prng.sample(pool, count)`).

Extract:

```ts
private resolveRelationPool(
  reg: SchemaReg,
  recordId: string,
  relName: string,
  kind: "single" | "many",
  count?: number,
): { items: unknown[]; prng: Prng }
```

The two public methods become 6-line wrappers over `resolveRelationPool` +
`prng.pick` / `prng.sample`. No behaviour change.

## Notes

- Source: [B22 research report](../../research/reports/codebase-complexity.md), proposed item **#10**.
- Dimension: 1 #8.
- Size: **S**.
