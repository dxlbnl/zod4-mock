---
id: B52
title: BUG — `generateArray` + `populate` dispatch paths diverge across modes (bounds, overrides, transform)
type: bug
priority: high
flags: [review]
created: 2026-06-01
spec: wiki/specs/B52-generate-array-dispatch-inconsistencies.md
---

## Description

User-reported:

> `schema.array().min(6).max(6)` does not always return 6 items, when `store: false` it doesn't check.
> Why does these things don't follow a common path. Go deeper, and find other inconsistencies across the different codepaths. I thought we have unified it by now.

The user is right — **B25** unified the _classifier_ (`resolveMode`) but each branch still hand-rolls its own bound logic, override application, and transform handling. Eight concrete inconsistencies across `generateArray` (three modes) and `populate` (two paths) follow.

The bug the user hit: `generateArray` primary mode under `{ store: false }` returns `target` items via the B44 early-return path, **bypassing** the B43 `callerMax` slice that the store-on path applies. When `existingCount > maxAllowed` (e.g. `world.populate(Person, 10)` then `world.generate(Person.array().min(6).max(6), { store: false })`), you get 10 items instead of 6.

## Inconsistency inventory

Reading [src/world/engine.ts](../../../src/world/engine.ts) post-B28 split:

| #   | Path                                      | Issue                                                                                                                                                                                          | File:line                                       |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | `generateArray` **derived**               | Returns one element per source pair — `.max()` not honored, `defMax` not honored. 50 sources → 50 elements regardless of `.max(6)`.                                                            | engine.ts:1290-1317                             |
| 2   | `generateArray` **primary + store:false** | B44 early-return skips B43 `callerMax` slice. Returns `target` items, not `min(target, callerMax)`. **The user's reported bug.**                                                               | engine.ts:1350-1372                             |
| 3   | `generateArray` **primary**               | Returns at line 1372/1353 **before** the trailing `transform` at 1412-1414. `world.generate(Persons.array(), { transform: hide })` doesn't apply transform if `Persons` is primary-registered. | engine.ts:1322-1373                             |
| 4   | `generateArray` **derived**               | Calls `generateDerivedRecord(...)` with **no options** — silently drops per-record overrides AND transform.                                                                                    | engine.ts:1314-1316                             |
| 5   | `populate` **derived**                    | `const N = Math.min(count, sources.length)` — asks for 10 but only 5 sources → silently returns 5. `generateArray` derived auto-provisions for `minRequired`; populate doesn't.                | engine.ts:625-636                               |
| 6   | `populate` precedence (residual)          | Still primary-first (explicit `findPrimaryRegs` check), then `resolveMode`. D12 makes the dual-registration trigger unreachable, but the dispatcher remains a special case. Dead code?         | engine.ts:614-621                               |
| 7   | `generateArray` **ad-hoc**                | Lines 1384-1392 **duplicate** the `resolveMinRequired` / `resolveMaxAllowed` helper logic inline.                                                                                              | engine.ts:1384-1392                             |
| 8   | `defaultArrayLength` interpretation       | Primary: uses defMin+defMax via helpers. Derived: uses defMin only (auto-provision floor); **ignores defMax entirely**. Ad-hoc: uses both as initial bounds.                                   | engine.ts:1283, 1290-1317, 1322-1373, 1384-1392 |

## Acceptance

Each as a real bug:

- **B52-R1** — `generateArray` derived mode MUST honor `.max()` / `.length()` and the library-side `defMax` fallback. Returned array length MUST be `≤ callerMax` (when set) or `≤ defMax` (when no caller bound). Auto-provisioned sources still respect `.min()`.
- **B52-R2** — `generateArray` primary mode under `{ store: false }` MUST honor `.max()` / `.length()` (the B43 slice MUST apply on both store-on and store-off paths). When `existingCount > callerMax`, the returned array MUST be `existingCount`-slice-to-callerMax. The B44 fix (no-infinite-loop) MUST be preserved.
- **B52-R3** — `generateArray` primary mode MUST apply `options.transform` (lines 1412-1414's trailing pass MUST run on the primary branch's return value).
- **B52-R4** — `generateArray` derived mode MUST apply `options.overrides` (per-record deep-merge) AND `options.transform` (trailing pass on each element).
- **B52-R5** — `populate` derived branch MUST auto-provision sources up to `count` when `count > sources.length` (matching `generateArray` derived's `resolveMinRequired` auto-provision behavior). Silent truncation is a bug.
- **B52-R6** — `populate`'s primary-first explicit check MUST be removed if D12 (dual-registration throw) makes it unreachable. Confirm dead-code status; if reachable in any edge case, document why; otherwise delete.
- **B52-R7** — `generateArray` ad-hoc branch MUST share the `resolveMinRequired` / `resolveMaxAllowed` helpers; the inline duplicated loop at 1384-1392 MUST be replaced.
- **B52-R8** — `generateArray` derived mode MUST consult `defMax` as the upper bound when no caller bound is set, matching the contract documented for `defaultArrayLength`.

## Refactor direction (implementer hint, not binding)

Real unification target:

1. **`resolveTargetCount(mode, arraySchema, defMin, defMax, existingCount?)`** — one function that knows: derived → `min(pairs.length+autoProvision, callerMax ?? defMax)` floored at `minRequired`; primary → `clamp(max(existingCount, prng.int(minRequired, maxAllowed)), 0, callerMax ?? Infinity)`; ad-hoc → `prng.int(minRequired, maxAllowed)`.
2. **Mode-specific generation of N items** — kept separate (derived has the pair mapping, primary uses `generateAndStorePrimary`, ad-hoc uses `this.generate`).
3. **Shared trailing pass** — slice to `callerMax`, apply per-index overrides (or throw per B38 on primary-registered), apply transform.

That collapses bugs 1, 2, 3, 4, 7, 8 into a coherent shape. Bugs 5, 6 are populate-side and can either fold in here or split to a follow-up.

## Tests — all permutations

User direction: **"file tests (if not there) for all permutations"**. The test matrix per [feedback-minimal-tests] is one test per asserted invariant, but the matrix has real combinatorial structure to cover.

Per-mode × per-store × per-bound × per-options grid:

| dimension     | values                                                            |
| ------------- | ----------------------------------------------------------------- |
| mode          | derived / primary / ad-hoc                                        |
| store         | default (true) / `{ store: false }`                               |
| bounds        | `.min(N)` / `.max(N)` / `.length(N)` / `.min(M).max(N)` / neither |
| existing data | none / less-than-bounds / more-than-bounds                        |
| options       | none / overrides / transform / both                               |

Test-writer MUST cover at least:

- **One test per R-ID** (8 tests minimum).
- **Bound-honor regressions for each mode**: derived + `.max(6)` + 50 sources → 6 elements. Primary + `.max(6)` + store:false + existing=10 → 6 elements (the user's repro). Ad-hoc still honors min+max (positive guard).
- **`options.transform` regressions for each mode**: primary array + transform → transform applied. Derived array + transform → transform applied. Ad-hoc (positive guard).
- **`options.overrides` regressions for each mode**: derived array + per-record overrides → applied. Ad-hoc (positive guard). Primary + per-index overrides → still throws per B38.
- **`populate` derived auto-provision**: populate(Schema, 10) with 5 existing sources → 10 stored. Positive guard for `populate` primary + count.

Test-writer SHOULD NOT add: every single (mode × store × bound) cell — only the cells that pin a specific R-ID. Combinatorial explosion is not the goal; the R-IDs are.

## Notes

- **B25** (`resolveMode` extraction) unified the classifier. **This item finishes the job** for the dispatch arms.
- **B38** added the primary-array overrides throw; **B43** added the caller-max slice; **B44** fixed the store:false infinite-loop. Each landed independently and the trailing-pass logic was never re-unified across them.
- **B41 / D12** removed the dual-registration trigger, so `populate`'s primary-first explicit check (lines 614-621) MAY be dead code; R6 confirms.
- Bump: `patch` (no API change, only correctness fixes).
- GitHub issue: none yet — user reported conversationally.
- `flags: [review]` — architecturally significant (refactor of all three array-mode arms + populate); manager pauses for spec sign-off before tests/impl runs.
- Predecessor: **B25** (resolve-mode extraction), **B41 → B47** (dispatch precedence + D12).
- Composes with: D8 (registry storage = generate return value), B10 (effectiveStore transitive suppression), D11 (PIPELINE — untouched, this is array-level not field-level).
- Anchor reading for the spec-writer: src/world/engine.ts lines 140-192 (bound helpers), 600-649 (populate), 1266-1417 (generateArray).
