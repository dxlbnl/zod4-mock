---
id: B60
title: Evict the generator-binding layer out of engine.ts into world/bind-generators.ts
type: chore
priority: low
created: 2026-06-01
report: wiki/research/reports/codebase-complexity-2026-06-01.md
---

## Description

`src/world/engine.ts` is 1748 LOC — the largest file in the repo — but ~235 LOC of it
(≈20%) is **not engine logic at all**: the `CtxSlot` type, the `CTX_SLOTS` arity table,
`bindNamespace`, `CtxAwareFn`, and the string-length check helpers (engine.ts:130–460).
None of it touches `WorldImpl` state — it's the generator-binding concern squatting in the
engine file for historical reasons. Move it verbatim into a new `src/world/bind-generators.ts`
and import it back. Pure lift: zero `this`, zero state, zero behaviour change — confirmable
in a single read. This is the highest payoff-to-risk item from the 2026-06-01 complexity
re-analysis (its §3.3 / §3.4 and proposed item #1) and the recommended first move.

## Notes

- Report: [codebase-complexity-2026-06-01.md](../../research/reports/codebase-complexity-2026-06-01.md) §3.3, §3.4.
- Behaviour-neutral: the existing test suite is the contract; no new tests. `pnpm validate`
  must stay green and the public API is untouched.
- Changeset: internal refactor, no shipped behaviour change — `patch` if anything, or none
  if it's purely a file move with no export change. Manager decides at done time.
- Do **first** of the engine-residual-mass trio (B60 → B61 → B62); it's the lowest-risk and
  makes the file's true scope visible before the two stateful refactors land.
