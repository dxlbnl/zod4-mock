# B69: Move `/bench` to a Web Worker

## Context

The live `/bench` route ([`site/src/routes/bench/+page.svelte`](../../site/src/routes/bench/+page.svelte))
runs the time-budget benchmark loop **on the main thread**: a `run()` handler
calls [`measure()`](../../site/src/lib/bench.ts) three times in series — once per
runner — with a `setTimeout(0)` yield between cells (today's lines 42, 48, 50).
Each `measure()` call blocks the main thread for the full `budgetMs` window
(200 ms today, set in B71-R4). That has two failure modes:

- **UI freezes.** During the 200 ms × 3 = ~600 ms run, the segmented-control,
  range slider, and scroll all stall. The `setTimeout(0)` yields only let
  Svelte's reactivity flush once between cells; they do not make the page
  responsive during a cell.
- **The measurement includes UI work.** Rendering, hover events, and Svelte's
  microtask queue all share the event loop with the bench loop, biasing
  `performance.now()` upward on a busy tab.

Moving the budget loop into a `Worker` isolates measurement from rendering and
keeps the page interactive. The card frames the acceptance as: "clicking Run
reports progress while the UI remains interactive (scrolling, segmented-control
changes work). The worker posts back incremental `BenchResult` messages; the
chart updates as each library finishes."

This spec is the implementation contract for that acceptance. It coordinates
with:

- [B71](B71-site-time-budget-bench.md) — the time-budget loop (`measure(fn, { warmup, budgetMs, maxRuns? })`)
  that runs **inside** the worker. The worker imports `measure()` from
  `site/src/lib/bench.ts` unchanged; B71's `BenchResult` shape (including the
  `runs` field) flows through the message protocol.
- [B70](B70-site-unify-cli-browser-schemas.md) — canonical schema barrel under
  `site/src/lib/schemas/`. The worker imports the runners
  (`site/src/lib/runners/*.ts`) which import schemas from there. D23 stays in
  force: the worker MUST NOT re-define schemas inline.
- B73 (future) — a proper Abort button. This item picks the simplest
  re-run policy (disable Run while in flight) and explicitly defers a
  user-driven abort.

Backlog item: [`wiki/backlog/doing/B69-site-bench-web-worker.md`](../backlog/doing/B69-site-bench-web-worker.md).

Binding rules this spec must obey:

- **D1** — no `any` in the worker, the protocol module, or the page.
- **D13** — the worker file's imports MUST be browser-runnable. The worker
  entry script is only loaded by the page in the browser, but every module it
  transitively imports (`bench.ts`, the three runners, the schemas they pull
  in, and the libraries those runners use — `zod4-mock`, `@anatine/zod-mock`,
  `@faker-js/faker`) is already on the existing main-thread import graph, so
  D13 is already satisfied for them. Adding new `node:*` imports under the
  worker entry would violate D13.
- **D22** (analogous principle) — D22 governs docs primitives that touch
  `window`/`document` at module load; the same principle applies here for
  `Worker` construction. The page MUST construct the worker inside `onMount`
  (or behind `if (browser)`) so SSR does not touch `Worker`. The successor
  rule for this case is captured as R8 below.
- **D23** — schemas stay under `site/src/lib/schemas/`. The worker reaches
  them via the runners; no inline `z.object(...)` in the worker.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined
> in RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B69-R1: Worker entry module

A new module **MUST** exist at `site/src/lib/bench.worker.ts` that, when
instantiated as a module-type `Worker`, listens for typed requests on
`self.onmessage` and executes the time-budget loop **without involving the
main thread**. The worker module **MUST** import `measure()` from
[`site/src/lib/bench.ts`](../../site/src/lib/bench.ts), `runZod4Mock` from
[`site/src/lib/runners/zod4mock.ts`](../../site/src/lib/runners/zod4mock.ts),
`runZodMock` from
[`site/src/lib/runners/zodmock.ts`](../../site/src/lib/runners/zodmock.ts),
and `runFaker` from
[`site/src/lib/runners/faker.ts`](../../site/src/lib/runners/faker.ts), and
**MUST NOT** import any `node:*` module.

Rationale: a single worker entry keeps the protocol surface small and the
import graph auditable for D13.

- Scenario: worker entry exists and is module-type compatible
  GIVEN the repository after the migration
  WHEN `site/src/lib/bench.worker.ts` is read
  THEN it exports nothing as a default value (it is a side-effecting worker
  entry), it sets `self.onmessage`, and a regex grep over the file for
  `from\s+['"]node:` returns zero matches.

- Scenario: worker depends only on browser-safe modules
  GIVEN the worker entry module
  WHEN its imports are walked one level deep
  THEN every import is one of: `./bench.js`, `./runners/zod4mock.js`,
  `./runners/zodmock.js`, `./runners/faker.js`, `./bench-worker-protocol.js`
  (no `$app/*`, no `$env/*`, no `node:*`).

### B69-R2: Typed message protocol

The message contract between the page and the worker **MUST** be expressed as
two exported TypeScript types in a shared module `site/src/lib/bench-worker-protocol.ts`:

```ts
export type SchemaKey = "simple" | "nestedOrder" | "array";

export interface BenchWorkerRequest {
  kind: "run";
  schema: SchemaKey;
  n: number;
  budgetMs: number;
}

export type BenchLib = "zod4mock" | "zodmock" | "faker";

export type BenchWorkerResponse =
  | { kind: "result"; lib: BenchLib; result: BenchResult }
  | { kind: "error"; lib: BenchLib; message: string }
  | { kind: "done" };
```

Both sides (page and worker) **MUST** import these types and **MUST NOT** use
`any` in the message handling code path.

Rationale: a typed contract makes the worker testable as a pure handler
(R7-scenario) and aligns with D1.

- Scenario: protocol module exports the named types
  GIVEN `site/src/lib/bench-worker-protocol.ts` after the migration
  WHEN the file is read
  THEN it exports `BenchWorkerRequest`, `BenchWorkerResponse`, `BenchLib`,
  and `SchemaKey` as the names above, and re-exports or re-imports
  `BenchResult` from `./bench.js` so consumers refer to one canonical
  shape.

- Scenario: no `any` in worker or page handling code
  GIVEN the worker module and the bench page after the migration
  WHEN both files are read
  THEN neither file contains the token `: any` or `<any>` in a type position,
  and the page's `onmessage` handler typing resolves through
  `BenchWorkerResponse`.

### B69-R3: Page delegates measurement to the worker

`site/src/routes/bench/+page.svelte` **MUST NOT** call `measure()` directly
after the migration. The Run button **MUST** instead post a
`BenchWorkerRequest` of kind `"run"` to the worker and update `results`
reactively from incoming `BenchWorkerResponse` messages of kind `"result"`.

Rationale: collapses the acceptance line "the chart updates as each library
finishes" into a single normative rule, and removes the main-thread cost the
worker was introduced to eliminate.

- Scenario: page no longer imports `measure`
  GIVEN `site/src/routes/bench/+page.svelte` after the migration
  WHEN the file is read
  THEN the import line `import { measure ... } from '$lib/bench'` is gone
  (the page may still import the `BenchResult` type), and no call to
  `measure(` appears in the file.

- Scenario: page no longer yields with `setTimeout(0)`
  GIVEN `site/src/routes/bench/+page.svelte` after the migration
  WHEN the file is grepped for `setTimeout(r, 0)` or `setTimeout(r,0)`
  THEN no match is found (the per-cell yields are obsolete — the worker
  does not block the main thread).

- Scenario: clicking Run posts a request to the worker
  GIVEN a Storybook play test mounting the page with a stubbed worker
  factory and the Run button enabled
  WHEN the user clicks Run
  THEN the stubbed worker receives exactly one `postMessage` call with a
  payload matching `{ kind: 'run', schema: <selected>, n: <slider>, budgetMs: 200 }`.

### B69-R4: Incremental result messages

For each completed library cell, the worker **MUST** post exactly one
`BenchWorkerResponse` of kind `"result"` carrying the library identifier and
the `BenchResult` returned by `measure()`. After all three libraries finish
the worker **MUST** post one `BenchWorkerResponse` of kind `"done"`. The
order of `"result"` messages **MUST** be `zod4mock`, then `zodmock`, then
`faker` (matches today's main-thread call order so the chart legend stays
stable).

Rationale: incremental posts are how "the chart updates as each library
finishes" becomes observable; a single batched post would defer the chart
update to the end of the run.

- Scenario: three result messages plus one done
  GIVEN the worker handler called directly (R7 factoring) with a fake
  `postMessage` collector and the request
  `{ kind: 'run', schema: 'simple', n: 1, budgetMs: 1 }`
  WHEN the handler returns
  THEN the collector recorded exactly four messages, in order:
  `{ kind: 'result', lib: 'zod4mock', result: <BenchResult> }`,
  `{ kind: 'result', lib: 'zodmock', result: <BenchResult> }`,
  `{ kind: 'result', lib: 'faker', result: <BenchResult> }`,
  `{ kind: 'done' }`,
  and every `result` payload has the six numeric fields B71-R1 mandates
  (`avg`, `min`, `max`, `opsPerSec`, `coldStart`, `runs`).

- Scenario: page renders each cell as its message arrives
  GIVEN a Storybook play test with a controllable fake worker that emits
  the three `result` messages one at a time
  WHEN the test emits the first `result` for `zod4mock`
  THEN the `MetricBadge` for `zod4-mock` shows a non-null ops/sec value
  AND the `MetricBadge` for `zod-mock` still shows the empty state,
  before any further messages are emitted.

### B69-R5: UI responsiveness during a run

While the worker is running, the page's main-thread input handlers
(specifically `SegmentedControl` and `RangeSlider`) **MUST** continue to
respond to user events. A `SegmentedControl` change event dispatched during
the run **MUST** be observed by the page's `onchange` binding before the
worker reports its first result.

Rationale: this is the user-visible acceptance line ("the UI remains
interactive"). The worker delegation in R3 makes it true; this requirement
nails it down as observable.

- Scenario (UI): segmented-control change registered during a run
  GIVEN the `/bench` page is mounted, the Run button has been clicked, and
  the worker has not yet posted any `result`
  WHEN the user clicks a different schema option in the segmented control
  THEN the segmented control's `value` updates (the new option carries the
  `active` class) within 50 ms of the click, before any `result` message
  has been processed.

### B69-R6: Re-run policy while in flight

Clicking Run while a previous run is still in flight **MUST** be a no-op:
the second click is **MUST** be ignored, the worker **MUST NOT** be
terminated, and no new `BenchWorkerRequest` **MUST** be posted. The Run
button's `disabled` binding (`disabled={running}`, already present at the
template's line 88) is the surfacing mechanism.

Rationale: simplest correct policy. Terminating the worker mid-run would
lose the in-flight measurement; queueing the second request adds state the
user cannot observe. The card explicitly defers a user-driven Abort to B73,
so the page does not need an abort affordance here.

- Scenario: Run button disabled while running
  GIVEN the `/bench` page is mounted and the Run button has just been
  clicked (a worker request is in flight)
  WHEN a Storybook play test reads the Run button's `disabled` attribute
  THEN it is `true` (Svelte renders the attribute), and the button text is
  `"Running…"`.

- Scenario: a click on a disabled button posts no second request
  GIVEN a Storybook play test mounting the page with a controllable fake
  worker, the Run button clicked once, no results yet emitted
  WHEN the test calls `userEvent.click(runButton)` a second time
  THEN the fake worker still recorded exactly one `postMessage` call total
  (the second click was suppressed by the `disabled` attribute).

### B69-R7: Testable handler factoring

The worker's `onmessage` handler **MUST** be factored into an exported
function that takes a `postMessage` callback as a dependency, so it can be
called directly from a unit test without instantiating a real `Worker`.

Suggested shape (non-normative):

```ts
// site/src/lib/bench.worker.ts
export async function handleBenchRequest(
  req: BenchWorkerRequest,
  post: (msg: BenchWorkerResponse) => void,
): Promise<void> {
  /* … */
}

self.onmessage = (e: MessageEvent<BenchWorkerRequest>) => {
  void handleBenchRequest(e.data, (msg) => self.postMessage(msg));
};
```

Rationale: jsdom's `Worker` polyfill is unreliable and Vitest workers are
heavyweight; a pure-function handler is testable with a fake collector
(R4-scenario), and the `self.onmessage` wiring is the thin uncovered shim.

- Scenario: handler is importable from a unit test
  GIVEN a Vitest unit test under `site/src/lib/` (or `site/tests/`)
  WHEN the test imports `handleBenchRequest` from `$lib/bench.worker`
  THEN the import resolves at test time without the test having to
  instantiate `new Worker(...)`, and the handler is callable with a
  synchronously-collecting `post` argument.

### B69-R8: SSR-safe worker construction

The page **MUST NOT** evaluate `new Worker(...)` at module load. Worker
construction **MUST** happen inside `onMount` (or behind an `if (browser)`
guard), and the worker **MUST** be terminated when the component is
destroyed.

Rationale: SvelteKit prerenders `/bench` on the server, where `Worker` is
not a global. Constructing it at module load crashes SSR. This is the
direct analogue of D22's principle for docs primitives, applied to bench
worker construction.

- Scenario: no top-level `new Worker(` in the page
  GIVEN `site/src/routes/bench/+page.svelte` after the migration
  WHEN the `<script>` block is read
  THEN any `new Worker(` token appears inside an `onMount(` callback (or
  inside an `if (browser)` block), never at the top level of the script.

- Scenario: worker terminated on unmount
  GIVEN a Storybook play test that mounts the page and then unmounts it
  while a run is in flight
  WHEN the unmount completes
  THEN the page called `worker.terminate()` exactly once (observable via a
  fake worker whose `terminate` is a spy).

## Out of scope

- **User-driven abort.** A visible Abort button (cancel a run in progress) is
  deferred to B73. R6's no-op-on-second-click policy is the placeholder.
- **Concurrent runs / queueing.** Only one in-flight run at a time per page;
  no work queue, no cancellation, no superseding.
- **Schema changes.** D23 stays in force: the canonical schemas under
  `site/src/lib/schemas/` are not touched. The runners decide which schemas
  they generate against.
- **`measure()` semantics.** B71 owns the budget loop. This item does not
  change `measure()` or `BenchResult`.
- **CLI bench (`site/bench/`).** The CLI runs under Node, not a browser
  Worker; this migration is browser-only.
- **Library code (`src/`).** No `zod4-mock` library changes.
- **Chart redesign.** `BenchChart` already re-renders reactively from
  `results`; no visual changes here. The incremental updates fall out of R4
  for free.
- **Bundle-size impact.** Vite emits the worker as a separate chunk
  (`new Worker(new URL(...), { type: 'module' })`); the page's main bundle
  shrinks slightly. Not tracked as a normative requirement.

## Open questions

- **Worker file location: `site/src/lib/bench.worker.ts` vs
  `site/src/lib/workers/bench.ts`?** — **Non-blocking**. R1 picks
  `site/src/lib/bench.worker.ts` so the filename's `.worker.ts` suffix
  signals the file is a `Worker` entry without needing a `workers/`
  directory yet. A second worker would justify the directory; until then,
  flat keeps the lib tree shallow.

- **Use `Comlink` or hand-rolled protocol?** — **Non-blocking**. R2 picks
  the hand-rolled typed protocol (`BenchWorkerRequest` /
  `BenchWorkerResponse`). The protocol has three message shapes and one
  direction of work; `Comlink` adds a dependency and a proxy layer for no
  benefit at this size. Revisit if a future worker grows a real RPC
  surface.

- **Test approach for worker functionality.** — **Non-blocking**. R7 picks
  factoring the `onmessage` handler into an exported `handleBenchRequest`
  that accepts a `post` callback, so the unit test calls it directly with
  a synchronous collector. The thin `self.onmessage = e => handleBenchRequest(e.data, post)`
  shim is uncovered by the unit test; the Storybook play test in R5
  exercises the real `Worker` (the browser-provider Storybook runs in
  Chromium, where `Worker` is real).
