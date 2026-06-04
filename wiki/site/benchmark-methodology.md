# Benchmark Methodology

> Sources: gen-bench bench.ts, perf.test.ts, /bench page, 2026-05-13; bench/results/latest.json, 2026-05-13; code review 2026-05-13
> Raw: [Bench Results](../../raw/site/2026-05-13-bench-latest-results.md); [Review Findings](../../raw/site/2026-05-13-review-findings.md); [Design Doc](../../raw/product/2026-05-13-design-doc.md)

## Overview

The site runs two benchmark harnesses — a CLI (`bench/perf.test.ts`) and an in-browser one (`/bench`). They share a `measure()` primitive but differ in sample size, schema set, and what each "run" measures. This article documents how each works, what the numbers mean, and where they mislead — so any speed claim on the site can be tied back to data that supports it without overreach.

## The `measure` primitive

Defined in `src/lib/bench.ts` (B71 — time-budget loop):

```ts
export interface MeasureOpts {
  warmup?: number;
  budgetMs: number;
  maxRuns?: number;
}
export interface BenchResult {
  avg: number;
  min: number;
  max: number;
  opsPerSec: number;
  coldStart: number;
  runs: number;
}

export function measure(fn: () => void, opts: MeasureOpts): BenchResult {
  const warmup = opts.warmup ?? 5;
  const maxRuns = opts.maxRuns ?? 1_000_000;

  const t0 = performance.now();
  fn(); // (1) cold call
  const coldStart = performance.now() - t0;

  for (let i = 0; i < warmup; i++) fn(); // (2) warmup

  const times: number[] = [];
  const start = performance.now();
  let iters = 0;
  while (iters < maxRuns) {
    // (3) budget-bounded timed runs
    const s = performance.now();
    fn();
    times.push(performance.now() - s);
    iters++;
    if (performance.now() - start >= opts.budgetMs) break;
  }
  // … avg / min / max / opsPerSec / runs computed from `times`.
}
```

Three phases per measurement: a single cold call, `warmup` unrecorded calls to let the engine settle, then **a time-budget loop** that keeps calling `fn` until cumulative elapsed wall time crosses `budgetMs` (bounded by `maxRuns`, default 1 000 000). The returned `runs` field is the actual iteration count consumed.

## CLI harness — `bench/perf.test.ts`

- Run with `pnpm bench` (Vitest, `bench/vitest.config.ts`, `pool: 'forks'`, `testTimeout: 120_000`).
- Config: `WARMUP = 1000`, `BUDGET_MS = 500` for simple/user/nested/locale tiers; `MATCHER_WARMUP = 10`, `MATCHER_BUDGET_MS = 1000` for the matcher tier (B71-R3). Produces ~50 000 samples for `simple`, ~25 000 for `user`, ~10 000 for `nested`, ~830 for `matcher` on the current baseline — at least 2× the previous fixed-runs sample on every tier.
- Three schema tiers, hand-coded in the test file with paired Zod v3, Zod v4, and faker variants:
  - `simple` — 4 primitive fields.
  - `user` — 8 fields with uuid/email/enum/optional.
  - `nested` — uuid/email + nested address + optional billing + array of strings + record.
- Outputs to `bench/results/latest.json` (overwritten) and appends to `history.json`.
- Prints a summary table with per-library avg-ms-per-call across tiers.

This is the harness whose numbers we trust for claims. The snapshot at [Bench Results](../../raw/site/2026-05-13-bench-latest-results.md) is the current baseline.

## Browser harness — `/bench`

- `src/routes/bench/+page.svelte`.
- Default config: `budgetMs = 200` per cell (B71-R4). 200 ms is a UI-responsiveness ceiling — between cells the page yields to `setTimeout(0)`, so a Run press completes in ~700–900 ms total which the user perceives as snappy. The active budget is surfaced on the page as a "budget: 200ms per cell" badge next to the run controls (B71-R8).
- Each "run" is `runner.batch(schema, n)` — generates `n` records of the selected schema (`flat | nested | array`). For `n=10000 × array`, one iteration is 500 000 underlying generations.
- Three libraries measured sequentially with `await new Promise((r) => setTimeout(r, 0))` between them (a single-tick yield — not nearly enough to let the browser repaint reliably under load).
- Runs **on mount** (`onMount(() => run())`) and on every click of the Run button.

The browser numbers are useful for _qualitative_ comparison and feel ("zod4-mock's bar is taller than zod-mock's bar"). They are not useful for citation.

## Schema divergence between harnesses

| Harness              | Schemas measured                                             |
| -------------------- | ------------------------------------------------------------ |
| CLI (`perf.test.ts`) | `simple`, `user`, `nested` — defined inline in the test file |
| Browser (`/bench`)   | `flat`, `nested`, `array` — imported from `src/lib/schemas/` |

The names `nested` overlap but the _shapes_ differ. The CLI's `nested` has uuid, email, address, optional billing, tags array, and a record. The browser's `nested` has only id/total/status/customer/address. These are not the same benchmark.

## Cold-start metric — what it actually measures, and why it misleads

`coldStart` in `measure()` is the duration of the **single first call**.

In **CLI** context, that's almost honest. Each tier runs in a fresh-ish module state (though Vitest does cache imports), and 1 ms cold-start values plausibly represent first-touch initialization cost.

In **browser** context (`/bench`), cold-start is misleading on three counts:

1. **Modules are warm before `run()` fires.** All three runners are imported at the top of `+page.svelte`. By the time `onMount(() => run())` runs, the runner modules have already been initialized. The libraries' internal caches haven't been touched yet, but they will be touched on the cold call of any earlier library — so the second and third libraries' "cold start" is really "first call after another library warmed shared state".
2. **For large `n`, cold-start ≈ batch duration.** With `n=10000`, the cold call generates 10 000 records. That takes ~10–100 ms depending on library and schema. The "warm" calls do exactly the same amount of work and take roughly the same time. There's no meaningful cold-vs-warm distinction.
3. **The label promises something the metric doesn't deliver.** "Cold start" suggests one-time library initialization overhead. The current metric measures "first call's duration including all work the call does".

Either rename it ("first-call latency", measured separately) or remove it from `/bench` entirely. See [known-issues](known-issues.md) #7 and [roadmap](roadmap.md) P2.

## Honesty guardrails for speed claims

From the 2026-05-13 CLI baseline ([Bench Results](../../raw/site/2026-05-13-bench-latest-results.md)):

| Tier   | zod4-mock ops/s | zod3-mock ops/s | faker ops/s | zod4 vs zod3    | zod4 vs faker    |
| ------ | --------------- | --------------- | ----------- | --------------- | ---------------- |
| simple | 166 136         | 31 877          | 123 230     | **5.2× faster** | **1.35× faster** |
| user   | 99 516          | 19 945          | 140 406     | **5.0× faster** | 0.71× (slower)   |
| nested | ~28 333         | 10 339          | 56 871      | **2.7× faster** | 0.50× (slower)   |

**Safe claims:**

- "Faster than `@anatine/zod-mock` by 2.7×–5.2× across tested schemas."
- "Faster than hand-coded faker on simple schemas; competitive on realistic ones with zero shape maintenance."

**Unsafe claims (don't use):**

- "Faster than the alternatives." (Contradicted on user + nested by faker.)
- "The fastest mock library." (Same.)
- Anything quoting `coldStart` from `/bench` as a meaningful number.

## Future direction

A worker-based browser bench (B69), unified on one schema set (B70 — landed). Time-budget runs landed in B71 — the budget loop is what will run inside the worker. See [roadmap](roadmap.md) P2.

## Regression guardrail (B98)

The CLI bench now also gates against a release-pinned baseline. Each run writes
`bench/results/latest.json` (with a new top-level `memory` block — `heapUsedDeltaBytes`,
`v8HeapUsedBytes`, `gcForced` per tier) and compares it against
`bench/results/baseline.json`. The comparator (`bench/regression-compare.ts`) fails
the test when a tier's `zod4_mock.avg` regresses **> +25 %** (B98-R5) or memory
delta regresses **> +50 %** (B98-R7). Refresh workflow + manual merge gate are
documented in [`site/bench/baseline.md`](../../site/bench/baseline.md).

## See Also

- [current-state](current-state.md) §"Two benchmark harnesses".
- [known-issues](known-issues.md) #6 (divergence), #7 (cold-start), #8 (sync block), #9 (auto-run).
- [roadmap](roadmap.md) P2 (bench rebuild).
- [product/vision](../product/vision.md) §"Honest framing of fast".
- [product/differentiators](../product/differentiators.md) §"Per-competitor framing".
