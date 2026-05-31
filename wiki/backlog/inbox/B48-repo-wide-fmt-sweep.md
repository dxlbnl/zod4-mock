---
id: B48
title: Chore — run `pnpm fmt` repo-wide to clear pre-existing format drift
type: chore
priority: low
flags: []
mode: lite
created: 2026-05-31
---

## Description

Surfaced by **B47**'s reviewer: `pnpm validate` now exits non-zero on the `fmt:check` stage. `oxfmt --check` reports **203 files** needing reformatting — spanning files completely untouched by B47 (entire `.changeset/`, `.claude/`, `docs/`, `packages/locale-*/src/**`, `playground.ts`, `scripts/`, almost all of `src/**`, most of `tests/`, all of `wiki/**`). The new B47 file (`tests/unit/core/withSchema-polarity.test.ts`) is **NOT** in the report — B47's new code is fmt-clean.

The drift is pre-existing: no recent item dispatched `pnpm validate` (each ran `pnpm test` + `pnpm typecheck` + `pnpm lint` separately, none ran `pnpm fmt:check`), so the format gate has not been enforced for many sessions. Files were edited without `pnpm fmt`.

## Resolution

Run **`pnpm fmt`** at the repo root to apply oxfmt to all 203 files. No behavioural change; pure whitespace/formatting normalization. After this lands, `pnpm validate` will be clean and every future reviewer can use it as the one-shot gate (per [[feedback-pnpm-validate]]).

## Acceptance

- B48-R1: `pnpm fmt:check` MUST exit 0 (0 files need reformatting).
- B48-R2: `pnpm validate` MUST exit 0 (typecheck + test + lint + fmt:check all green together).

## Notes

- **Lite track gate**:
  - ≤ a handful of files? **No** — 203 files. **But** the change is mechanical (`pnpm fmt`), purely whitespace, no logic touched. The gate's "≤ a handful" rule exists to prevent silent behaviour drift, not to forbid mass-mechanical reformats. The reviewer should re-judge: if the entire diff is `oxfmt` output verifiable by re-running `oxfmt --check`, the change is behaviour-neutral by construction and lite still fits. Otherwise auto-promote to full.
  - New dependency? **No**.
  - Schema/API/contract change? **No**.
  - New observable behaviour? **No** (whitespace).
  - Security-sensitive? **No**.
- Implementer: run `pnpm fmt` at the repo root. Confirm with `pnpm validate` exits 0. Add `.changeset/b48-repo-wide-fmt-sweep.md` (patch, "internal — repo-wide format normalization, no behavioural change"). No source code reviewed line-by-line — the implementer trusts the formatter's output.
- Reviewer (lite): run `pnpm validate` and confirm exit 0. Spot-check 2-3 changed files of different types (`.ts`, `.md`, `.json`) to confirm the changes are formatting-only (no logic edits leaked in).
- Bump: `patch`.
- No GitHub issue.
- Predecessor: surfaced by B47's reviewer; B47 itself passed all 4 R-IDs and contributed clean code — the drift is independent.
