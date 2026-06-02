---
id: B62
title: Extract a RelationResolver collaborator out of the engine
type: chore
priority: low
created: 2026-06-01
report: wiki/research/reports/codebase-complexity-2026-06-01.md
---

## Description

`resolveRelationPool` ([engine.ts:1024–1125](../../../src/world/engine.ts#L1024)) is the
second-densest function in the engine (~101 LOC, ~29 branches) and, together with
`resolveRelated` / `resolveRelatedMany` / `ensurePrimaryRecord`, is self-contained behind a
small number of private-state touchpoints (`relationPools`, the registry, and a
store-primary callback). B32 extracted the _pure_ relation helpers into `world/relations.ts`
but left these stateful methods in the engine "per the B28 pragmatic split." Extract a
`RelationResolver` class constructed with the world's `registry` + `relationPools` + a
`generateAndStorePrimary` callback, moving all four methods into `world/relations.ts`.

Per the report's §3.4 analysis this is the **one** further split with real payoff — its
value is unit-testability and explicit state ownership, **not** line count. Treat it as a
deliberate testability investment, not a size fix. Lower priority than B60/B61; do only if
the testability is wanted (or skip — the report is explicit that splitting the cohesive core
purely to lower LOC would be a regression dressed as a cleanup).

## Notes

- Report: [codebase-complexity-2026-06-01.md](../../research/reports/codebase-complexity-2026-06-01.md) §3.2 (#2), §3.3, §3.4 (option 2).
- Behaviour-neutral: existing relation tests (B10/B11 store-off, where-filter, self-ref,
  single/many) are the contract. If the goal is testability, the implementer MAY add
  focused unit tests for the extracted `RelationResolver` — but that is the only case in
  this trio where new tests are in scope.
- Land **after B60/B61**; it's the largest and most state-entangled of the three.
- Changeset: `patch` at most; manager decides at done time.
