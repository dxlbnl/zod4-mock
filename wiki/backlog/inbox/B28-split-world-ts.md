---
id: B28
title: Refactor — split `src/world.ts` into `world/{engine,relations,derived,registration}.ts`
type: chore
priority: medium
flags: [review]
created: 2026-05-29
---

## Description

`src/world.ts` at **1202 LOC** owns seven distinct concerns:

1. Registration storage (`SchemaReg`, `withSchema`, `withSubject`, `findPrimaryRegs` / `findDerivedRegs`).
2. Pipeline orchestration (`generate`, `generateSingleItem`, `generateArray`, `generateObjectFields`).
3. Primary / derived / relational generation paths.
4. Relation resolution + auto-provisioning (`resolveRelated`, `resolveRelatedMany`, `relationPools`).
5. `effectiveStore` state machine + B10 transitive suppression.
6. B8 derived-upsert map identity-preserving derivation.
7. Lazy-schema cache + PRNG binding (`bindGenerators` Proxy).

Split into:

```
src/world/
  engine.ts        # generate, generateSingleItem (or its replacements after B24), generateArray, generateObjectFields
  relations.ts     # resolveRelated, resolveRelatedMany, relationPools, auto-provisioning
  derived.ts       # B8 upsert map, derived identity (sourceKey, sourceOf)
  registration.ts  # SchemaReg, normalizeRelationEntry, withSchema, withSubject, findPrimaryRegs / findDerivedRegs
  index.ts         # barrel re-exporting WorldImpl + createWorld
```

Each file < 400 LOC. Public API surface unchanged — `src/index.ts` still
imports from `src/world/index.ts` (or rename to `src/world.ts` if a flat barrel
is preferred). No behaviour change.

Flagged `review` because it's an **L-sized mechanical refactor** that touches
~all engine internals. User should approve the module boundary before
implementer runs. Best landed after the function-level refactors above
(especially B23 + B24) so each new file is already smaller.

## Notes
- Source: [B22 research report](../../research/reports/codebase-complexity.md), proposed item **#6**.
- Dimension: 2 #1.
- Size: **L**, mechanical.
- Order: prefer **after** B23 + B24 (each function-level refactor cleans up its eventual home file).
- Cross-cutting observation #2 in the research report.
