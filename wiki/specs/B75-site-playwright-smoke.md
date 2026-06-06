# B75: Playwright smoke tests for site routes

## Context

The site ([`site/`](../../site/)) is a SvelteKit app deployed to Vercel. Its routes
pull in real runtime code — `@dxlbnl/ui` primitives, CodeMirror editors, Chart.js, a
bench Web Worker (B69), mdsvex-rendered docs — any of which can throw at load time
without breaking the build. A route that emits a console error or an unhandled promise
rejection on first paint ships green today: nothing in CI navigates the running app. B75
closes that gap with a **page-navigation smoke suite** that loads each shipped route in a
real browser and fails the build when a route logs a console error or rejects a promise
during load.

The backlog item is [`wiki/backlog/doing/B75-site-playwright-smoke.md`](../backlog/doing/B75-site-playwright-smoke.md).
It traces to the gen-bench merge (provenance `gen-bench X1`). Relevant wiki pages:
[`wiki/site/`](../site/) (site roadmap), and the existing site specs this suite guards —
[B69](B69-site-bench-web-worker.md) (bench worker, an obvious console-error source if SSR
or worker wiring regresses), [B95](B95-site-foundation-on-dxlbnl-ui.md) (the
`@dxlbnl/ui` rebuild that deleted `/table` and added `/comparison` + `/explorer`),
[B100](B100-docs-primitive-library-chrome-landing.md) (the docs primitive library and the
`/docs` landing + stub routes whose `window`-touching widgets must defer to `onMount` per
D22).

### Investigation — current state (this spec refines the card's wording where it is wrong)

The card has three inaccuracies that this spec corrects; each is grounded in a file read:

1. **Route set.** The card lists `/`, `/bench`, `/showcase`, `/table`,
   `/docs/getting-started`. **`/table` no longer exists** — B95 deleted it
   (`wiki/specs/README.md` B95 row: "`/table` route + links + widgets deleted"). The real
   route set under [`site/src/routes/`](../../site/src/routes/) is:
   - `/` — [`+page.svelte`](../../site/src/routes/+page.svelte)
   - `/bench` — [`bench/+page.svelte`](../../site/src/routes/bench/+page.svelte)
   - `/showcase` — [`showcase/+page.svelte`](../../site/src/routes/showcase/+page.svelte)
   - `/comparison` — [`comparison/+page.svelte`](../../site/src/routes/comparison/+page.svelte) (the route that replaced `/table`)
   - `/explorer` — [`explorer/+page.svelte`](../../site/src/routes/explorer/+page.svelte)
   - `/docs` — [`docs/+page.svelte`](../../site/src/routes/docs/+page.svelte)
   - `/docs/getting-started`, `/docs/concepts`, `/docs/key-heuristics`, `/docs/recipes`,
     `/docs/zod4-schema-coverage`, `/docs/bugs`, `/docs/api`, `/docs/relational`,
     `/docs/comparison` — the B100 docs stubs under [`docs/`](../../site/src/routes/docs/).

   The root nav ([`+layout.svelte`](../../site/src/routes/+layout.svelte) lines 8–16)
   links `/docs/getting-started`, `/explorer`, `/showcase`, `/comparison`, `/bench`. The
   smoke suite is specified over the **real** route set (R1 enumerates it); R8 keeps the
   list honest against drift.

2. **Test runner.** The card says "wire into `pnpm site:test:component` (existing
   Playwright runner under `site/vite.config.ts`)". That is **factually wrong**:
   [`site/vite.config.ts`](../../site/vite.config.ts) is a **vitest browser-mode
   Storybook** config (`storybookTest(...)` project, `browser: { provider: playwright() }`
   — line 36–54), and `test:component` runs `vitest --run`
   ([`site/package.json`](../../site/package.json) line 21) against that Storybook project.
   `@vitest/browser-playwright` only uses Playwright as the **browser launcher for
   vitest**; it is **not** the `@playwright/test` runner and cannot navigate a served
   SvelteKit app across full page loads. A full-page navigation smoke test that loads a
   route end-to-end (SSR + hydration + worker boot) needs a **served app** plus
   `@playwright/test`'s `webServer` + `page.goto`. This spec therefore wires the suite as a
   **dedicated `@playwright/test` project**, not into `test:component`. See R2/R3 and Open
   questions (resolved, non-blocking).

3. **No new dependency.** `@playwright/test@^1.60.0` and `playwright@^1.60.0` are already
   devDependencies of `site` ([`site/package.json`](../../site/package.json) lines 54, 69).
   There is **no** `playwright.config.ts` and **no** `*.spec.ts` in the repo yet (glob:
   zero matches), so the `@playwright/test` runner is unused today — B75 adds the config +
   tests + script, **not a dependency**.

D17/D20 (honest speed-claim framing) are **not engaged**: the smoke suite asserts on
console/error signals and a settled DOM, not on speed copy. No `node:*` rules apply — this
is site test tooling (D13 exempts tests/config). The governing practice is
[`.claude/practices/browser-testing.md`](../../.claude/practices/browser-testing.md):
console errors and failed requests on the path are failures, assert by role/text not
pixels.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B75-R1: Smoke suite covers every shipped route

A committed `@playwright/test` smoke suite **MUST** navigate to every route listed in a
single, explicit route table and, for each route, assert the page reached a loaded state
without a console error or an unhandled promise rejection. The route table **MUST**
include at minimum: `/`, `/bench`, `/showcase`, `/comparison`, `/explorer`, `/docs`, and
`/docs/getting-started`.

The route table is the contract for "which routes are smoke-tested" and is read by R8
(drift guard). Each route is one test case so a failure names the offending path.

- Scenario: every listed route is visited
  GIVEN the built site served by the Playwright `webServer`
  WHEN the smoke suite runs to completion against a tree with no runtime errors
  THEN it reports one passing test per route in the table, the set of visited paths
  equals the table, and the run exits with status code 0.

- Scenario (UI): a representative route reaches a settled, non-empty DOM
  GIVEN the smoke suite navigating to `/`
  WHEN the page load settles (network idle / `domcontentloaded` per R5)
  THEN the page's `<body>` contains at least one visible element with non-empty text
  (the route rendered content, it did not blank-screen) and the test for `/` passes.

### B75-R2: A console error during load fails that route's test

The smoke suite **MUST** fail the test for a route when that route emits a
`console.error` (or a page `pageerror`, i.e. an uncaught exception) at any point between
navigation start and the route's settled state.

This is the card's core acceptance ("fails when any of those routes throws a runtime
error"). Each route test attaches a listener before `goto` and asserts the collected
error list for that route is empty.

- Scenario: clean route collects no console errors
  GIVEN the smoke test for `/showcase` with a `console`-message listener attached before
  navigation
  WHEN the route loads and settles with no runtime fault
  THEN the listener collected zero `error`-level console messages and zero `pageerror`
  events, and the test passes.

- Scenario: a route that throws at load fails its test
  GIVEN a route whose component throws or calls `console.error('boom')` during load (e.g.
  a temporary fault injected for verification per R7)
  WHEN the smoke test for that route runs
  THEN the test fails with an assertion that the collected error list for that route is
  non-empty (the failure message includes the offending route path and the captured error
  text).

### B75-R3: An unhandled promise rejection during load fails that route's test

The smoke suite **MUST** fail the test for a route when an unhandled promise rejection
occurs in the page during that route's load. The suite treats a `pageerror` originating
from an unhandled rejection identically to a synchronous console error (R2).

Rejections from async route code (a failed `fetch`, a rejected dynamic `import`, a worker
boot failure) do not surface as console errors in every browser, so they are asserted
explicitly. In `@playwright/test`, an unhandled rejection surfaces as a `pageerror`; the
route test fails when the rejection list for that route is non-empty.

- Scenario: clean route has no unhandled rejections
  GIVEN the smoke test for `/bench` (which boots the B69 bench Web Worker on mount) with a
  `pageerror` listener attached before navigation
  WHEN the route loads and the worker initialises without faulting
  THEN the rejection list for `/bench` is empty and the test passes.

- Scenario: an unhandled rejection at load fails its test
  GIVEN a route whose load triggers an unhandled promise rejection (e.g. `Promise.reject`
  in a top-level `onMount`, injected for verification per R7)
  WHEN the smoke test for that route runs
  THEN the test fails because the rejection list for that route is non-empty, and the
  failure names the route path.

### B75-R4: One documented pnpm command runs the suite against a served app

The suite **MUST** be runnable via a single documented pnpm script that serves the
SvelteKit app and runs the `@playwright/test` smoke project against it, with **no manual
server-start step**. The script **MUST** be exposed both inside `site`
(`site/package.json`) and from the repo root (root `package.json`, alongside the existing
`site:*` scripts), and the served app **MUST** be configured via the Playwright config's
`webServer` so the runner starts and stops it automatically.

The card requires "a CI-runnable Playwright test". "CI-runnable" here means a clean,
documented, self-contained command (start server → run → exit), not a change to any CI
workflow (no `.github/workflows/*` exists yet). Reuses the project's `pnpm` + the existing
`site:test:*` naming convention.

- Scenario: a single command runs the whole suite
  GIVEN a clean checkout with site dependencies installed and no dev server running
  WHEN the documented root pnpm script for the smoke suite is invoked
  THEN the Playwright `webServer` starts the app, the smoke project runs all routes, the
  server is torn down, and the process exits with status 0 on a clean tree — without the
  operator starting a server by hand.

- Scenario: the script exists in both manifests
  GIVEN `site/package.json` and the root `package.json` after the change
  WHEN their `scripts` blocks are read
  THEN `site/package.json` defines a script that runs the `@playwright/test` smoke project
  (e.g. `test:e2e`), and the root `package.json` exposes it under the `site:` prefix (e.g.
  `site:test:e2e`) by filtering to `@zod4-mock/site`.

### B75-R5: Wait for a load-settled state before asserting

Each route test **MUST** wait for an explicit page-settled state (a defined Playwright
wait such as `waitForLoadState('networkidle')`, or an assertion that a known
above-the-fold element for that route is visible) **before** evaluating the collected
error/rejection lists, so transient load-time messages are captured and a still-loading
page is not asserted as clean.

Asserting before the page settles produces both false negatives (errors that fire after
the assertion are missed) and flakiness (the DOM check races hydration). A defined settle
point makes each test deterministic.

- Scenario: assertion happens after settle
  GIVEN the smoke test for any route in the table
  WHEN the test executes
  THEN it reaches its defined settle point (network idle or a visible landmark element)
  before it reads the error/rejection collectors, and a route that only logs its error
  midway through hydration is still caught (the error fires before the settle point).

### B75-R6: The suite is isolated from non-smoke test runs

Running the existing `pnpm site:test:component` and `pnpm site:test:unit` commands
**MUST NOT** execute the new `@playwright/test` smoke suite, and running the smoke suite
**MUST NOT** execute the Storybook browser-mode component tests. The smoke specs **MUST**
live where the `@playwright/test` runner discovers them (its own `testDir`) and where the
existing vitest configs do not include them.

The two runners are different tools (vitest-browser vs `@playwright/test`) and the card's
"existing Playwright runner under `site/vite.config.ts`" conflation must not leak into
overlapping test discovery. `vitest.unit.config.ts` includes only `src/**/*.test.ts`
(line 9); the Storybook project globs `*.stories.*`. The smoke specs sit outside both.

- Scenario: component run skips smoke specs
  GIVEN the smoke specs committed under the Playwright `testDir`
  WHEN `pnpm site:test:component` runs
  THEN no smoke spec file is collected or executed by that vitest run (its file count is
  unchanged by the presence of the smoke specs).

- Scenario: smoke run skips component tests
  GIVEN the `@playwright/test` config with its `testDir`
  WHEN the smoke suite runs
  THEN no `*.stories.*` Storybook test is executed by the Playwright runner (only the
  smoke specs in `testDir` run).

### B75-R7: A deliberate route fault makes the suite exit non-zero

The smoke mechanism **MUST** demonstrably fail (process exit code ≠ 0) when a route
under test emits a runtime error during load, proving the suite is not a no-op that
passes regardless. This MAY be verified with a temporary fault injection that is **not**
committed, or with a committed self-test that asserts the error-collection path flags a
seeded error.

A green smoke suite is only meaningful if it can go red. This requirement makes the
fail-mode observable and is the test-writer's red-state anchor.

- Scenario: injected error turns the suite red
  GIVEN one route temporarily modified to `console.error(...)` or to throw during load
  WHEN the smoke suite runs against it
  THEN the Playwright process exits with a non-zero status and the report attributes the
  failure to that route; reverting the fault returns the suite to exit 0.

### B75-R8: Route-table drift guard

The route table the smoke suite iterates **SHOULD** be kept honest against the routes
that actually exist under `site/src/routes/`, so a newly added top-level route is not
silently left un-smoke-tested. The suite **SHOULD** surface (via a comment policy or an
assertion) the requirement that a new shipped route is added to the table.

The site gains routes over time (B100 added the `/docs` stubs; `/comparison`, `/explorer`
were B95 additions). A drift guard keeps the smoke coverage from rotting. This is a
`SHOULD` because the exact mechanism (a filesystem-derived list vs. a maintained constant
with a documented "add new routes here" policy) is an implementation choice, but the
intent is testable.

- Scenario: a new route is required to be in the table
  GIVEN a new top-level route directory added under `site/src/routes/` with a `+page.svelte`
  WHEN the maintainer follows the suite's drift-guard policy (or runs its drift assertion)
  THEN the new route's path is present in the smoke route table (a derived-list
  implementation includes it automatically; a maintained-constant implementation fails or
  warns until it is added), so the route is not omitted from smoke coverage.

## Out of scope

- **Per-route functional assertions.** This is a smoke suite: it asserts "loads without
  runtime errors", not feature behaviour (e.g. it does not click Run on `/bench` and
  verify chart output — B69's own tests own that).
- **Accessibility / axe audits.** No a11y-tree assertions here; Storybook's `addon-a11y`
  and per-route specs cover that.
- **Visual / screenshot regression.** No pixel diffs. Per the browser-testing practice,
  assertions are by signal (console/error) and role/text, not screenshots.
- **CI workflow wiring.** No `.github/workflows/*` exists; B75 delivers a CI-_runnable_
  command, not a CI pipeline edit. Adding the command to CI is a separate concern.
- **Non-page (`+server.ts` / API) routes.** Only navigable `+page.svelte` routes are
  smoke-tested.
- **Cross-browser matrix.** A single Chromium project is sufficient for a smoke suite;
  Firefox/WebKit projects are out of scope.
- **Mobile viewports / responsive breakpoints.** A single default viewport.
- **Library / locale packages.** This item touches `site/` only; no `src/` or
  `packages/*` change, no public API change (so the D5 docs rule does not apply).
- **Warnings policy.** Only `console.error` / `pageerror` / unhandled rejections fail the
  suite. `console.warn` is not treated as a failure (a noisy third-party warning should
  not redden the build); narrowing the warning policy later is a follow-up.

## Open questions

- **Runner wiring: dedicated `@playwright/test` e2e project vs. folding into
  `test:component`?** — **Non-blocking (resolved).** **Recommendation: a dedicated
  `@playwright/test` project** with its own `playwright.config.ts` (a `webServer` that
  runs `pnpm --filter @zod4-mock/site preview` against the built app, `testDir` for the
  smoke specs) and a new `test:e2e` script surfaced at root as `site:test:e2e`. Rationale:
  `site/vite.config.ts` is a **vitest browser-mode Storybook** runner, not the
  `@playwright/test` runner; a full-page navigation smoke test that loads SSR + hydration +
  the bench worker needs a **served** app via `page.goto`, which `@vitest/browser-playwright`
  does not provide. The dependency is already present (`@playwright/test`), so this adds no
  package. The card's "wire into `pnpm site:test:component`" wording is corrected here
  (see Context → Investigation #2). No design ambiguity remains; recorded for visibility.

- **Serve the built `preview` app vs. `vite dev`?** — **Non-blocking (resolved).**
  **Recommendation: serve the built app** (`vite build` then `vite preview`, or
  Playwright's `webServer` running `preview`) so the smoke suite exercises the same
  prerendered/SSR output that ships, catching SSR-only faults (e.g. a `window`-at-module-load
  regression that D22 guards against). `vite dev` would mask SSR errors. The build adds time
  but is the honest target; recorded, not blocking.

- **`console.warn` policy.** — **Non-blocking.** Resolved in-spec for now: warnings do
  **not** fail the suite (only `error` / `pageerror` / unhandled rejection do — see Out of
  scope). Tightening to fail on specific warnings is a future refinement, recorded here so
  the choice is explicit rather than accidental.
