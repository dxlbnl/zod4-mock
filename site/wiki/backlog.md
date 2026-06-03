# Backlog

> Pipeline currency: spec-writer → test-writer → implementer → reviewer
> Statuses: `todo` | `in-progress` | `done` | `review` (needs approval before implementation)

## Active queue — index

| #   | Item                                                        | Status   | Phase  |
| --- | ----------------------------------------------------------- | -------- | ------ |
| 1   | [P2-worker] Move /bench to Web Worker                       | `todo`   | P2     |
| 2   | [P2-schemas] Unify CLI + browser schema set                 | `todo`   | P2     |
| 3   | [P2-budget] Replace fixed runs with time-budget measurement | `todo`   | P2     |
| 4   | [P2-coldstart] Rename / remove cold-start metric on /bench  | `todo`   | P2     |
| 5   | [P2-ux] Add progress indicator + Abort button to /bench     | `todo`   | P2     |
| 6   | [DS] Implement design system                                | `review` | future |
| 7   | [wiki-vision] Update product/vision.md version note         | `todo`   | wiki   |

## Active queue — descriptions

---

### P2-worker — Move /bench to Web Worker

Move all benchmark computation off the main thread into a dedicated Web Worker. Currently `/bench` runs `runner.batch(schema, n)` synchronously on mount and on every Run click, which blocks the main thread for seconds and prevents any UI feedback. The fix: a Worker imports the schemas and runners, executes the `measure()` loop, and posts structured results back to the main thread. The page renders the chart and stays responsive throughout.

**Scope:**

- New file: `src/lib/workers/bench.worker.ts` — imports runners, receives a `{ schema, n, library }` message, runs `measure()`, posts back a `BenchResult`.
- `src/routes/bench/+page.svelte` — remove the direct `runner.batch()` call; instead `new Worker(...)`, send messages, receive results, update chart reactively.
- Remove the `onMount(() => run())` auto-run (see P2-ux for the replacement UX).

**Done when:**

- A full /bench run with default settings completes without any main-thread task > 50 ms (Chrome DevTools Performance panel).
- The page remains interactive (Run button, schema selector, range slider) during a run.

**Constraints:**

- Worker `import` must be guarded by a `browser` check — SSR must not attempt to instantiate a Worker.
- The Worker must be bundled by Vite's `?worker` import syntax or equivalent SvelteKit-compatible approach.
- `measure()` in the worker context runs on module import, not on page load — "cold start" distinction matters here. See [benchmark-methodology](site/benchmark-methodology.md) and P2-coldstart.

**Depends on:** nothing. Unblocks P2-ux.
**Closes:** known-issues #8 (sync main-thread block), #9 (auto-run on mount).

---

### P2-schemas — Unify CLI + browser schema set

The CLI harness (`bench/perf.test.ts`) and the browser harness (`/bench`) currently measure different schemas with different names. The CLI uses `simple / user / nested` defined inline in the test file; the browser uses `flat / nested / array` imported from `src/lib/schemas/`. The shapes overlap by name (`nested`) but are structurally different. This means the two harnesses produce incomparable numbers and can't cross-validate each other.

The fix: agree on one canonical set of schema definitions in `src/lib/schemas/`, import them in both harnesses.

**Scope:**

- Decide on the final schema names. Recommendation: keep `flat`, `nested`, `array` (already in `src/lib/schemas/`) and update the CLI to import them instead of its inline definitions. Alternatively rename them — but a name change in the browser harness is lower impact than a structural change to the CLI schemas.
- Update `bench/perf.test.ts` to import from `src/lib/schemas/` instead of defining inline shapes. The CLI's inline schemas have paired Zod v3 versions for parity benchmarking — the v3 versions can either be added to `src/lib/schemas/` (under a `schemas3/` or named `flatSchema3` etc.) or kept inline in the test file and matched to the canonical v4 shape.
- Verify that `pnpm bench` still produces a valid `bench/results/latest.json`.

**Done when:**

- CLI and browser both report ops/sec for the same set of schema names.
- Numbers on the same machine are within an order of magnitude of each other (they won't be equal — sample sizes differ — but the ratio should be plausible).
- `pnpm bench` and `pnpm test:unit` both green.

**Constraints:**

- Do not change the v3 parity schemas in a way that breaks the existing `@anatine/zod-mock` benchmark comparison.
- The `ecommerce` schema stays Zod v4 only and is not part of the unified set (it's for `/showcase`, not `/bench`).

**Depends on:** nothing. Independent of P2-worker.
**Closes:** known-issues #6 (schema divergence).

---

### P2-budget — Replace fixed runs with time-budget measurement

The browser harness currently uses fixed `warmup=5, runs=20`. At 5 warmup and 20 timed runs, a single GC pause can dominate the average — the numbers aren't stable enough to cite. The CLI uses 1k/5k which is solid but too long for interactive use. The fix: replace fixed sample counts with a time-budget approach — "run for N milliseconds, count how many iterations fit" — which adapts to schema complexity automatically and gives stable ops/sec regardless of how fast or slow the library is.

**Scope:**

- Update `src/lib/bench.ts` — add a `timeBudgetMs` option to `measure()`. When set, the timed loop runs until `performance.now() - start >= timeBudgetMs` instead of a fixed count. Warmup remains count-based (a small fixed number is fine, e.g. 10–50 calls, enough to JIT-warm without blocking). The return type stays `BenchResult`; `opsPerSec` is computed from total iterations ÷ total elapsed time.
- Update `src/routes/bench/+page.svelte` (or the Worker, after P2-worker) to pass e.g. `timeBudgetMs: 500` per library.
- Keep the existing `runs` parameter working — don't break the CLI harness or unit tests that call `measure()` with count-based config.

**Done when:**

- Running `/bench` twice in a row with the same settings produces `opsPerSec` values within ~10% of each other on a quiet machine.
- `pnpm test:unit` green (bench.test.ts exercises `measure()`).
- The CLI harness (`pnpm bench`) is unaffected.

**Constraints:**

- `measure()` is used by the CLI harness — any signature change must be backwards-compatible.
- The time-budget loop must yield to the Worker event loop periodically if the benchmark is in a Worker context (i.e. don't spin-lock for 500ms without checking for abort messages). Can be done with `await new Promise(r => setTimeout(r, 0))` between iterations if needed.

**Depends on:** nothing. Can land before or after P2-worker, though it will be exercised in the Worker context when P2-worker lands.
**Closes:** known-issues #7 (partial — stabilises the numbers; cold-start labelling handled by P2-coldstart).

---

### P2-coldstart — Rename / remove cold-start metric on /bench

`measure()` captures the duration of the very first call as `coldStart`. In the CLI context this is almost meaningful (fresh module state). In the browser context it is misleading: runner modules are imported at page load, long before the user clicks Run, so there is no module-level cold start to measure. For large `n`, the "cold start" call takes as long as any warm call — it's indistinguishable. The label promises first-time initialization overhead; the metric delivers "first batch duration".

**Decision to make before spec is written:** remove `coldStart` from `/bench` entirely, OR rename it "first-call latency" and measure it properly (a single dedicated call to an otherwise-unloaded module — only meaningful inside a Worker where modules can be freshly imported per measurement). The simpler path is to remove it from `/bench` display and leave the field in `BenchResult` for CLI use.

**Scope (removal path):**

- Remove the `coldStart` display from `/bench` — `MetricBadge` or wherever it renders.
- Leave `coldStart` in `BenchResult` and `measure()` return value so the CLI harness is unaffected.
- Update `src/lib/components/Bench/MetricBadge.svelte` or the bench route if it renders cold-start.

**Done when:**

- No metric on `/bench` is labelled "cold start".
- `pnpm test:unit` and `pnpm test:component` green.

**Constraints:**

- Do not remove `coldStart` from the `BenchResult` type — the CLI benchmark and `bench.test.ts` use it.

**Depends on:** P2-worker (the Worker context is where a real cold-start measurement could live, if we go the rename path rather than removal). Can proceed with removal path independently.
**Closes:** known-issues #7 (the labelling half).

---

### P2-ux — Add progress indicator + Abort button to /bench

Once the benchmark moves to a Worker (P2-worker), the main thread is free to show live feedback during a run. Currently there is no progress and no way to cancel. This item adds both.

**Scope:**

- Progress indicator: as the Worker posts each library's result back, update a progress bar or step indicator (e.g. "2 / 3 libraries complete"). The Worker should post partial results as they arrive so the chart can update progressively.
- Abort button: visible (and enabled) while a run is in progress. Clicking it terminates the Worker (`worker.terminate()`) and resets UI state to "ready". The Run button replaces the Abort button when idle.
- Remove the `onMount(() => run())` auto-run. Page loads with "Click Run" state. Previous result (if any) can be shown from last Worker response.

**Done when:**

- A progress indicator updates as each library finishes.
- An Abort button is visible during a run and cancels it cleanly.
- Page load does not auto-trigger a run.
- `pnpm test:component` green (Storybook story for the bench route or bench components updated).

**Constraints:**

- `worker.terminate()` is abrupt — the partial results already received should still render.
- UI state machine: `idle → running → idle` (or `idle → running → aborted → idle`). Must not get stuck in "running" state if the Worker errors.

**Depends on:** P2-worker (needs the Worker infrastructure to have progress events and an abort path).
**Closes:** known-issues #9 (auto-run on mount).

---

### DS — Implement design system

**Status: `review` — scope to be defined by user before this enters the pipeline.**

The token layer (`src/lib/styles/tokens.css`, `app.css`) exists and is in use. This item covers whatever additional design-system work the user wants: component library formalisation, a Figma token export, a Foundation stories audit, a theming system extension, etc.

See [architecture](architecture.md) §Design system for current token inventory.

**Before spec-writer is invoked:** user must define the scope of this item (or split it into sub-items). Add that definition here or replace this entry with specific sub-items.

---

### wiki-vision — Update product/vision.md version note

`product/vision.md` contains a versioning note that currently reads `0.2.3`. The actual pinned version is `0.5.0`. The version note is intentionally kept in the wiki (it signals when to re-evaluate performance claims), but it needs to stay current.

**Scope:**

- Update the version number in the versioning note from `0.2.3` to `0.5.0`.
- Check whether the benchmark numbers in that page (ops/sec table) still match `bench/results/latest.json`. If they've shifted materially, update them too.

**Done when:**

- `product/vision.md` version note matches the pinned version in `package.json`.
- Benchmark numbers in the page are consistent with `latest.json` (or the page explicitly notes the snapshot date they came from).

**Trigger:** run this item any time `zod4-mock` is bumped to a new exact version.
**Depends on:** nothing.

---

## Cross-cutting (no phase assignment)

| #   | Item                                                 | Status | Notes                                                                               |
| --- | ---------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| X1  | Playwright smoke tests                               | `todo` | Visit /, /bench, /showcase, /table, /docs/getting-started; assert no console errors |
| X2  | Light-theme verification                             | `todo` | `html.light` tokens are wired; no visual QA has been done across all routes         |
| X3  | Install command copy button on /docs/getting-started | `todo` | Copy-to-clipboard button next to the install snippet                                |
| X4  | Storybook coverage gaps audit                        | `todo` | Verify every component in `src/lib/components/` has a `.stories.svelte` sibling     |

## Completed

| #    | Item                                                                 | Phase | Commit  |
| ---- | -------------------------------------------------------------------- | ----- | ------- |
| P0-1 | Fix pnpm check (8 errors) — Storybook story type errors              | P0    | d31b96c |
| P0-2 | Delete orphaned DocsLayout.svelte                                    | P0    | d31b96c |
| P0-3 | Fix SchemaPlayground multi-line bare schema                          | P0    | d31b96c |
| P0-4 | Fix generateWorld seeding (mulberry32 PRNG)                          | P0    | d31b96c |
| P0-5 | Fix variant lookup in order construction                             | P0    | d31b96c |
| P0-6 | Rewrite homepage hero (honest speed claims)                          | P0    | d31b96c |
| P1-1 | Homepage positioning shift (Install CTA, relational exhibit, footer) | P1    | ef40ba4 |
| P1-2 | SegmentedControl + DataTable keyboard accessibility                  | P1    | ef40ba4 |
| P1-3 | Rewrite README                                                       | P1    | ef40ba4 |
| P1-4 | .gitignore bench/results/history.json                                | P1    | ef40ba4 |
| P1-5 | Pin zod4-mock to exact 0.5.0                                         | P1    | ef40ba4 |
| P1-6 | Add oxlint suppressions for bind:this false positives                | P1    | ef40ba4 |
| P1-7 | Fix BenchChart SSR crash + coldStart story args                      | P1    | f9eba46 |

## See Also

- [site/roadmap](site/roadmap.md) — phased narrative for P2 and P3
- [site/known-issues](site/known-issues.md) — full issue inventory (P0+P1 resolved; P2 open)
- [architecture](architecture.md) — stack and test setup for implementers
- [decisions](decisions.md) — why things are the way they are
