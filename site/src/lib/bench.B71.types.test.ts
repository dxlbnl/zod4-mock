/**
 * B71-R1 — type-level test that `measure()` accepts the new
 * `{ warmup, budgetMs, maxRuns }` options and rejects the old
 * `{ runs }` shape.
 *
 * Maps to wiki/specs/B71-site-time-budget-bench.md (B71-R1).
 *
 * Run command: `pnpm site:check` (svelte-check picks up `.ts` files
 * in the SvelteKit project). This file has no runtime describe/it —
 * it's excluded from vitest by `vitest.unit.config.ts`'s
 * `**\/*.types.test.ts` exclude pattern.
 *
 * Red signal (today, no implementation):
 *   - `measure()` accepts `{ warmup, runs }` and does NOT accept
 *     `budgetMs` / `maxRuns`, so the `_newOpts` assignment errors
 *     ("Object literal may only specify known properties") and the
 *     `@ts-expect-error` on the legacy `{ runs }` assignment is
 *     unused.
 *   - The `result.runs` property does not exist on `BenchResult`.
 *
 * Green signal (after implementation):
 *   - The new options literal type-checks cleanly.
 *   - The `@ts-expect-error` on the legacy `{ runs }` line is
 *     consumed (the option is no longer accepted).
 *   - `BenchResult.runs` is `number`.
 */

import { measure, type BenchResult } from "./bench";

// New options shape MUST type-check.
const _newOpts: BenchResult = measure(() => {}, {
  warmup: 5,
  budgetMs: 50,
  maxRuns: 1000,
});

// `maxRuns` is optional — the two-key form MUST also type-check.
const _twoKey: BenchResult = measure(() => {}, {
  warmup: 5,
  budgetMs: 50,
});

// The legacy `{ runs }` option MUST be a compile-time error.
// @ts-expect-error — B71-R1: `runs` is no longer an option on `measure()`
const _legacyOpts: BenchResult = measure(() => {}, { warmup: 5, runs: 20 });

// The result MUST expose a `runs: number` field.
const _result = measure(() => {}, { warmup: 0, budgetMs: 1 });
type RunsIsNumber = BenchResult["runs"] extends number ? true : never;
const _runsIsNumber: RunsIsNumber = true;
// Sanity: also enforce structurally.
const _runs: number = _result.runs;

// Mark the test artefacts as intentionally used so unused-locals
// checks don't drown out the real signal.
void _newOpts;
void _twoKey;
void _legacyOpts;
void _runsIsNumber;
void _runs;
