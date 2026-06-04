# B71: Replace fixed runs with time-budget bench measurement

## Context

The `measure()` harness in [`site/src/lib/bench.ts`](../../site/src/lib/bench.ts)
runs a **fixed iteration count** per cell: the browser harness defaults to `runs=20`,
and the CLI bench ([`site/bench/perf.test.ts`](../../site/bench/perf.test.ts) /
[`site/bench/regression.bench.ts`](../../site/bench/regression.bench.ts)) hardcodes
`WARMUP=1000` + `RUNS=5000` for simple/user/nested and a separate
`MATCHER_WARMUP=10` + `MATCHER_RUNS=100` for the matcher tier.

Fixed-runs has two failure modes:

- **Slow schemas blow the wall-clock budget.** The matcher tier runs
  `populate(UserSchema, 100)` per call; at ~1.2 ms per call × `RUNS=100` ≈ 120 ms,
  but a 2 ms-per-call regression silently doubles that to 240 ms. The user-schema
  tier at avg ≈ 20 µs × `RUNS=5000` = 100 ms per cell; on a regression this can
  drift to multi-second wall time. Most of the CLI bench's wall time is the matcher
  tier and the browser-tier batches.
- **Fast schemas under-measure.** The browser default `runs=20` produces an avg
  built from 20 samples; a single GC pause skews it.

A **time-budget loop** — "run iterations until the cumulative wall time crosses
`budgetMs`, then report avg from the actual iteration count" — bounds the wall
time per cell while letting precision scale with how fast the schema actually is.
**Critically, the metric does not change**: both models compute
`avg = total_time / iteration_count`, so `latest.json` per-cell `avg` should
remain statistically equivalent under the switch. Only the precision (variance)
shifts; the bias does not.

Coordinates with [B69](https://example.invalid/B69) (the worker harness — the
budget loop is what runs inside the worker) and [B72](https://example.invalid/B72)
(cold-start framing — the budget loop preserves the existing single-call
cold-start measurement so B72 owns any rename/removal decision).

Backlog item: [`wiki/backlog/doing/B71-site-time-budget-bench.md`](../backlog/doing/B71-site-time-budget-bench.md).

Binding rules this spec must obey: **D1** (no `any`), **D13** (no `node:*` in
`site/src/lib/bench.ts` — it runs in both Node and browser; `performance.now()` is
universal), **D17/D20** (speed claims continue to cite `latest.json`), **D23**
(bench schemas stay under `site/src/lib/schemas/` — out of scope for this item).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B71-R1: `measure()` switches from fixed runs to time budget

The `measure()` function in `site/src/lib/bench.ts` **MUST** accept
`{ warmup, budgetMs, maxRuns? }` and return `{ avg, min, max, opsPerSec, coldStart, runs }`,
where the loop calls `fn` repeatedly until `cumulative elapsed >= budgetMs` and
then computes `avg = totalElapsedMs / runs`. The returned `runs` field is the
actual iteration count consumed by the budget loop.

Rationale: bounded wall time per cell for slow schemas (no 10-second matcher
cells on regression); higher sample count for fast schemas (better precision).
The avg metric is unchanged — both the fixed-runs and budget loops compute
`avg = totalTime / count`, so per-cell `avg` numbers remain statistically
equivalent (variance shifts, bias does not).

- Scenario: budget-bounded loop
  GIVEN `measure(() => sleepSync(10), { warmup: 0, budgetMs: 100, maxRuns: 10_000 })`
  where `sleepSync(10)` busy-waits ~10 ms per call
  WHEN the call returns
  THEN the returned `runs` is in `[8, 14]` (≈ `budgetMs / per-call`, with one
  loop-overshoot tolerated) AND `runs * avg` (in ms) is within ±15 % of
  the wall time the call took to return.

- Scenario: avg / opsPerSec relationship preserved
  GIVEN any callable `fn`
  WHEN `measure(fn, { warmup: W, budgetMs: B })` returns `{ avg, opsPerSec }`
  THEN `Math.abs(opsPerSec - 1000 / avg) < 1e-9` (the relationship the
  existing CLI / browser surfaces already rely on is preserved bit-for-bit).

- Scenario: return shape extension
  GIVEN any successful `measure(...)` call
  WHEN the result is destructured
  THEN it has exactly the keys `avg`, `min`, `max`, `opsPerSec`, `coldStart`,
  `runs` (the existing five plus the new `runs`), all as `number`.

### B71-R2: `maxRuns` safety cap

`measure()` **MUST** apply a `maxRuns` cap (default `1_000_000`) that bounds the
iteration loop regardless of how much time `budgetMs` allows.

Rationale: a pathologically fast `fn` (e.g. no-op `() => {}`) combined with a
low-resolution `performance.now()` (some browsers round to 100 µs for Spectre
mitigation) could otherwise run for billions of iterations before the cumulative
time crosses `budgetMs`. The cap is **not** a return to fixed-runs — it only
prevents runaway loops. Typical CLI tiers stay well below the cap (the simple
tier at avg ≈ 10 µs reaches ~50 000 runs in a 500 ms budget, two orders of
magnitude below the cap).

- Scenario: cap honoured for no-op `fn`
  GIVEN `measure(() => {}, { warmup: 0, budgetMs: 10_000, maxRuns: 1000 })`
  WHEN the call returns
  THEN the returned `runs` equals `1000` (the cap, not the budget — `1000` < `10_000 ms` worth of no-ops).

- Scenario: default cap is `1_000_000`
  GIVEN `measure(() => {}, { warmup: 0, budgetMs: 10_000 })` with no explicit `maxRuns`
  WHEN the call returns
  THEN the returned `runs` is `<= 1_000_000`.

### B71-R3: CLI bench uses a per-tier budget

[`site/bench/perf.test.ts`](../../site/bench/perf.test.ts) and
[`site/bench/regression.bench.ts`](../../site/bench/regression.bench.ts) **MUST**
replace the `WARMUP/RUNS` / `MATCHER_WARMUP/MATCHER_RUNS` constants with
`BUDGET_MS = 500` for the simple/user/nested tiers and `MATCHER_BUDGET_MS = 1000`
for the matcher tier, keeping `WARMUP = 1000` (resp. `MATCHER_WARMUP = 10`)
unchanged.

Rationale: `BUDGET_MS = 500` produces ~50 000 runs for `simple` (avg ≈ 10 µs),
~25 000 runs for `user` (avg ≈ 20 µs), and ~10 000 runs for `nested` (avg ≈ 50 µs)
on the current baseline — all ≥ 2× the previous `RUNS=5000` sample, so per-call
precision is at least as good as today. `MATCHER_BUDGET_MS = 1000` produces ~830
runs on the current 1.2 ms-per-call baseline — > 8× today's `MATCHER_RUNS=100`,
materially better precision while still bounding the matcher cell at ~1 s.
Total CLI bench wall time is approximately:
3 libraries × 3 tiers × 500 ms (4.5 s) + 1 × 1 s matcher + 3 locales × 500 ms
(1.5 s) ≈ **7 s** — well under the spec's 60 s wall-clock cap (today the matcher
tier alone is the dominant cost). Implementers MAY adjust `BUDGET_MS` /
`MATCHER_BUDGET_MS` to keep total wall time ≤ 60 s on the reviewer's host while
preserving the ≥ 1000-runs precision floor for non-matcher tiers; record the
final picks in the spec's first commit message.

- Scenario: CLI bench uses budget API
  GIVEN `site/bench/perf.test.ts` after the migration
  WHEN the file is grepped for `runs:` as a `measure(...)` option
  THEN no `runs:` literal appears as a `measure()` option key in either CLI file
  (`perf.test.ts` and `regression.bench.ts`) — the `RUNS` / `MATCHER_RUNS`
  constants are gone and every `measure(...)` call passes
  `{ warmup, budgetMs }` (or `{ warmup, budgetMs, maxRuns }`).

- Scenario: per-tier budget reaches the precision floor
  GIVEN `pnpm site:bench` is run on the implementer's host
  WHEN the simple / user / nested cells finish
  THEN every `latest.json` `results.<tier>.zod4_mock.runs` value is `>= 1000`,
  AND the matcher `latest.json.results.matcher.zod4_mock.runs` is `>= 100`.

### B71-R4: Browser bench uses a smaller budget

[`site/src/routes/bench/+page.svelte`](../../site/src/routes/bench/+page.svelte)
**MUST** call `measure(...)` with `budgetMs = 200` per cell (no fixed `runs`).

Rationale: 200 ms is a UI-responsiveness ceiling — between cells the page yields
to `setTimeout(0)` (today's pattern at lines 39/42/44), so a 200 ms cell × 3
libraries × `await` gap ≈ 700-900 ms total per "Run" press, which the user
perceives as snappy. The browser tier cannot rely on `--expose-gc` (no GC
pinning); a smaller budget reduces the chance a single GC pause swings the avg.
Browser numbers are qualitative per D17 (CLI is the citable source), so a
slightly noisier browser measurement is acceptable.

- Scenario: browser bench passes budget
  GIVEN `site/src/routes/bench/+page.svelte` after the migration
  WHEN the file is read
  THEN every `measure(...)` call in the file passes `{ budgetMs: 200 }`
  (optionally with `warmup`), and there is no `runs:` literal anywhere
  in the file's `measure(...)` arguments.

### B71-R5: `latest.json` records the budget

The CLI bench output (`site/bench/results/latest.json`) **MUST** record the
budget used per tier in its `config` block (the top-level header object today
carrying `{ warmup, runs }`).

Format: `config: { warmup, budgetMs, maxRuns, matcherWarmup, matcherBudgetMs }`
(the matcher-tier override is recorded explicitly). The pre-existing
`{ warmup, runs }` keys are replaced — no dual-write — because the comparator
and threshold files (`regression-compare.ts`, `perf-thresholds.test.ts`,
`regression-vs-baseline.test.ts`) read `results.<tier>.<lib>.avg` only and never
read `config.runs`. Per-cell `BenchResult` JSON gains a `runs` field as a
side-effect of R1's return-shape change; the comparator already ignores unknown
fields on `BenchResult` (see `BenchResultLike { avg: number }` in
`regression-compare.ts`), so no comparator change is required.

- Scenario: budget recorded in header
  GIVEN `pnpm site:bench` is run after the migration
  WHEN `site/bench/results/latest.json` is read
  THEN `config.budgetMs` equals the CLI tier budget (R3's `BUDGET_MS`),
  `config.matcherBudgetMs` equals R3's `MATCHER_BUDGET_MS`,
  `config.warmup` equals `1000`, `config.maxRuns` equals `1_000_000`
  (the R2 default), and `config.runs` is **absent**.

- Scenario: per-cell `runs` written
  GIVEN `pnpm site:bench` after the migration
  WHEN `latest.json` is read
  THEN for every present `results.<tier>.<lib>` cell, `cell.runs` is a finite
  positive integer.

- Scenario: comparator tolerates new header
  GIVEN a `baseline.json` written with the new `config` shape and a `latest.json`
  with the same shape
  WHEN `pnpm site:bench` runs the in-memory regression check
  THEN the comparator returns a verdict (no exception thrown) and reads only
  `results.<tier>.zod4_mock.avg` and `memory.<tier>.heapUsedDeltaBytes`
  (the same fields it reads today).

### B71-R6: Cold-start semantics unchanged

`measure()` **MUST** continue to compute `coldStart` as the wall time of the
single first call to `fn` made before warmup, byte-equivalent to today's
implementation. The budget loop only replaces the **timed-runs** loop, not the
cold-start measurement.

Rationale: B72 (separate item) owns any decision to rename / remove / repurpose
`coldStart`; this item must not pre-empt that. Keeping the cold-start step as
written means B72 can land on top of B71 without re-baselining cold-start
numbers in `latest.json`.

- Scenario: cold-start unchanged
  GIVEN a deterministic `fn` whose first call takes ≈ X ms and subsequent calls
  take < X ms
  WHEN `measure(fn, { warmup: 0, budgetMs: 1 })` returns
  THEN the returned `coldStart` is `>= 0` and is within ±25 % of the wall time
  of a freshly-measured single `fn()` call (i.e. the cold-start step is
  still a single-call measurement, not a budgeted loop).

### B71-R7: Perf-baseline byte-equivalence with a ±5 % tolerance

After the migration, the per-tier `latest.json.results.<tier>.zod4_mock.avg`
**MUST** match the equivalent number from the pre-migration `baseline.json`
within ±5 % on the implementer's host, with **no re-baseline of
`baseline.json`** unless the tolerance is violated.

Rationale: both models compute `avg = totalTime / count`, so the per-cell `avg`
is statistically equivalent under the switch (precision shifts, bias does not).
A ±5 % tolerance absorbs measurement noise plus the new budget's slightly
different sample distribution (longer-tail samples included because the loop
runs longer). The CI WARN threshold is 10 % and FAIL is 25 % (`regression-compare.ts`
defaults), so ±5 % keeps the post-migration comparator verdict at `OK`.

Verification command (the reviewer / implementer runs this):

```
pnpm --filter=@zod4-mock/site test bench/perf.test.ts
```

The terminal output prints the per-tier `verdict` and a `compareToBaseline`
table. If the per-tier `deltaPct` is within ±5 % the migration commit lands
without touching `baseline.json`.

Fallback if violated (deltaPct > ±5 % on any tier on the implementer's host
even after re-running 3× to rule out noise): the implementer **MUST** re-baseline
`baseline.json` to the new run **in the same commit**, append a one-line entry to
`site/bench/results/versions.json` recording the rebaseline event with the
budget config, and add a one-line note to `wiki/progress.md` explaining the
shift (e.g. "B71 migration shifted simple +7 %; re-baselined"). Re-baseline is
the carved-out fallback, not the default path.

- Scenario: in-tolerance migration (the expected path)
  GIVEN the pre-migration `baseline.json` (the file currently committed at
  `site/bench/results/baseline.json`) and a post-migration
  `pnpm site:bench` run
  WHEN the in-memory regression check runs
  THEN `report.verdict` is `"OK"` (no tier exceeds the 10 % WARN threshold) and
  `baseline.json` is unmodified in the commit diff.

- Scenario: re-baseline fallback
  GIVEN a post-migration `pnpm site:bench` run on a host where one tier's
  `deltaPct` exceeds 25 % across three consecutive runs
  WHEN the implementer re-baselines as the fallback
  THEN the same commit updates `site/bench/results/baseline.json` to the new
  run, appends a one-line entry to `site/bench/results/versions.json`
  recording the rebaseline + budget config, and adds a one-line entry to
  `wiki/progress.md` naming B71 as the cause.

### B71-R8: Browser `/bench` surfaces the budget

The `/bench` route **MUST** display the active budget in the page chrome — a
visible label next to the controls reading `budget: <budgetMs>ms per cell`
(where `<budgetMs>` is the R4 value, today `200`). The badge is the user-facing
parallel of R5's JSON-header record: a reader of the chart can see the
measurement floor without opening DevTools.

D17/D20 still binds: the badge is descriptive ("budget: 200 ms per cell"), not a
speed claim, and does not cite ops/sec. The CLI baseline remains the citable
source.

- Scenario (UI): budget badge visible
  GIVEN the `/bench` page is loaded
  WHEN the user inspects the page above the chart
  THEN a visible element containing the literal text `budget: 200ms per cell`
  (or the configured budget) is rendered next to the run controls (the
  `SegmentedControl` / `RangeSlider` / `Button` row).

## Out of scope

- **Worker harness (B69)** — moving the budget loop into a Web Worker is a
  separate item. This spec only changes the loop shape; B69 changes where it
  runs.
- **Cold-start rename / removal (B72)** — R6 freezes cold-start semantics so B72
  can land on top of B71 without re-baselining.
- **Per-cell statistical-significance gating in `regression-compare.ts`** — the
  comparator continues to gate on per-cell `avg` only (today's behaviour). A
  follow-up could gate on `avg ± tolerance derived from runs`, but not in this
  item.
- **Bench schemas under `site/src/lib/schemas/`** — frozen per D23; this item
  does not move, add, or rename schemas.
- **Library `src/`** — the budget loop is bench infrastructure; no library code
  changes.
- **CSS / chart visual redesign** — R8 adds a text badge only; the chart shape,
  colours, and legend are unchanged.

## Open questions

- **Budget pick for CLI tiers (`BUDGET_MS` = 500 vs another value;
  `MATCHER_BUDGET_MS` = 1000 vs another value).** — **Non-blocking**. R3
  proposes 500 / 1000 ms with a precision-floor rationale; the implementer may
  adjust upward (e.g. 750 ms simple, 2 s matcher) to keep total CLI bench
  wall-clock ≤ 60 s on the reviewer's host while keeping the ≥ 1000-runs
  precision floor for non-matcher tiers. Record the final picks in the
  migration commit message.

- **Browser surface for the budget — UI badge vs JSON-header-only.** —
  **Non-blocking**. R8 mandates a UI badge per the acceptance line in the item
  card ("the budget recorded in the JSON header") + transparency for browser
  readers. If the reviewer judges the badge clutters the controls row, it can
  be demoted to the chart caption in a follow-up.

- **Should `regression-compare.ts` gate on `avg ± tolerance derived from runs`
  (statistical-significance gate) rather than raw avg?** — **Non-blocking,
  Deferred**. Out of scope (see Out of scope §3); this item keeps the existing
  gate semantics. A follow-up item can revisit once budget-measured `runs`
  numbers are flowing through `latest.json`.

- **What happens to `min` and `max` when the iteration count varies between
  runs?** — **Non-blocking**. They remain the min / max of the per-call samples
  the loop actually took, exactly as today; the only change is the sample-set
  size. The R1 scenario "return shape extension" covers their presence.
  Document inline at the call-sites that interpret them.
