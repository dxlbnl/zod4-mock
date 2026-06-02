---
id: B63
title: Engine micro-cleanups — stale comments, re-introduced any, wrapper-strip dup
type: chore
priority: low
created: 2026-06-01
report: wiki/research/reports/codebase-complexity-2026-06-01.md
---

## Description

Three XS, behaviour-neutral cleanups surfaced by the 2026-06-01 complexity re-analysis (§4,
proposed items 4–6). Each is independent and can land as its own commit, or be folded into
B60/B61 if those touch the same lines first.

1. **Stale `populate`-precedence comments (⚠ doc bug).** Two comment blocks still assert
   that `populate` inverts dispatch precedence — removed by B52 — and now contradict the
   code: [registration.ts:111–115](../../../src/world/registration.ts#L111) and the
   `resolveMode` JSDoc at [engine.ts:843–851](../../../src/world/engine.ts#L843). The
   `populate` body itself ([engine.ts:608–613](../../../src/world/engine.ts#L608)) correctly
   documents the removal. Update both stale comments to: all four dispatchers use
   `resolveMode` (derived-first) post-D12.

2. **Re-introduced `any` (⚠ D1 regression).** `generateArray`'s ad-hoc tail uses
   `options.overrides as any[]`, `deepMerge(item, ov) as any`, and `options.transform as any`
   ([engine.ts:1445–1453](../../../src/world/engine.ts#L1445)). B26/B36 purged `any` from the
   router and binder; this arm kept it. The derived arm ~10 lines up already does the same
   merge with `as unknown[]` + a typed map — copy that shape. Restores the no-`any` invariant.

3. **Outer wrapper-strip duplication.** The outer optional/nullable strip loop in `generate`
   ([engine.ts:714](../../../src/world/engine.ts#L714)) is duplicated in `explainSchema`
   ([explain.ts:53](../../../src/explain.ts#L53)); B31's lazy-chain extraction left this
   sibling loop un-extracted. Extract one shared helper. Lowest value of the three — do only
   if convenient.

## Notes

- Report: [codebase-complexity-2026-06-01.md](../../research/reports/codebase-complexity-2026-06-01.md) §4, proposed items 4–6.
- All behaviour-neutral; existing suite is the contract, no tests-first. Items 1 and 2 are
  flagged ⚠ as correctness-adjacent (a misleading dispatch comment; an `any` that weakens
  D1) but neither changes runtime behaviour.
- If B61 (decompose `generateArray`) lands first, item 2 folds naturally into it and item 3
  may too — close whichever lines are already being edited there and drop them from this card.
- Changeset: `patch` at most; manager decides at done time.
