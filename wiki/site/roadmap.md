# Site Roadmap

> Sources: gen-bench design.md, 2026-05-13; code review 2026-05-13; user direction, 2026-05-13
> Raw: [Design Doc](../../raw/product/2026-05-13-design-doc.md); [Review Findings](../../raw/site/2026-05-13-review-findings.md); [Bench Results](../../raw/site/2026-05-13-bench-latest-results.md)

## Overview

Phased plan from the current state to the target: `gen-bench` as the zod4-mock homepage. Four phases, P0 → P3. P0 unblocks credibility (green build + honest claims). P1 does the positioning shift. P2 rebuilds the benchmark on solid foundations. P3 plans the eventual merge into the `zod4-mock` repo. Each phase lists scope, exit criteria, and the [known-issues](known-issues.md) items it closes.

## P0 — Correctness & honesty pass

**Goal:** green `pnpm check`, no overclaim in any user-facing copy, no broken-by-default features.

**Scope:**

- Fix the four Storybook story type errors. See [known-issues](known-issues.md) #1. Touch: `Button.stories.svelte`, `Input.stories.svelte`, `SegmentedControl.stories.svelte`.
- Delete `src/lib/docs/DocsLayout.svelte` (orphaned, deprecated `<slot/>`). Remove the stale comment in `app.css:247`. See [known-issues](known-issues.md) #1.
- Rewrite `SchemaPlayground.buildExecutable` so multi-line bare schema expressions work. See [known-issues](known-issues.md) #2.
- Rewrite the homepage hero on `/` to match the bench data. See [known-issues](known-issues.md) #5 and [product/differentiators](../product/differentiators.md) §"The framing to use on the homepage".
- Fix `generateWorld` — either properly seed via a PRNG, or drop the `seed` parameter and document non-determinism. See [known-issues](known-issues.md) #3.
- Fix the variant lookup in order construction. See [known-issues](known-issues.md) #4.

**Exit criteria:**

- `pnpm check` exits 0.
- `pnpm test:unit` still green (≥ 26/26).
- The homepage hero text matches [benchmark-methodology](benchmark-methodology.md) §"Honesty guardrails".
- Typing a bare `z.object({...})` into a doc playground renders generated output instead of an error.
- `generateWorld(42)` called twice in a row produces deep-equal outputs, OR the `seed` parameter is removed.

**Closes:** #1, #2, #3, #4, #5.

## P1 — Positioning shift (the homepage becomes the homepage)

**Goal:** restructure `/` so it reads as the zod4-mock project landing page. The shift documented in [vision](vision.md).

**Scope:**

- New `/` layout (top-to-bottom):
  1. Hero with the corrected pitch + two primary CTAs ("Install" → `/docs/getting-started`, "See the relational demo" → `/showcase`).
  2. **Relational proof exhibit inline** — a condensed `/showcase` preview: one entity (e.g. Reviews) with cross-entity IDs highlighted, with a "see all 7 entities" link.
  3. Feature matrix (existing component).
  4. Speed summary card linking to `/bench`.
  5. Footer with repo / npm / docs links.
- Rewrite `README.md` to introduce the project (purpose, install one-liner, link to deployed site, contributing pointer). See [known-issues](known-issues.md) #12.
- Add `aria-pressed` / `role="tab"` to `SegmentedControl`. Replace `<th onclick>` with `<th><button>` in `DataTable`. See [known-issues](known-issues.md) #13.
- Cap or `.gitignore` `bench/results/history.json`. See [known-issues](known-issues.md) #10.
- Pin `zod4-mock` exactly in `package.json`. See [known-issues](known-issues.md) #11.
- Add the two oxlint suppressions for `bind:this` false positives. See [known-issues](known-issues.md) #14.

**Exit criteria:**

- A first-time visitor to `/` sees the relational pitch above the fold without scrolling on a 1080p viewport.
- "Install" CTA is the most visually prominent action on `/`.
- README opens with a one-sentence pitch and an install command in the first 10 lines.
- DataTable headers can be activated with keyboard.
- `pnpm lint` exits with 0 warnings.

**Closes:** #10, #11, #12, #13, #14. Touches: #6, #7 (preview only).

## P2 — Bench rebuild (Web Worker + time-budget + unified schemas)

**Goal:** an honest, non-blocking, statistically defensible browser benchmark whose numbers can be quoted on the site.

**Scope:**

- Move the in-browser benchmark to a **Web Worker**. The Worker imports the schemas + runners, runs `measure()` calls, and posts results back. Main thread renders the chart and stays responsive. Closes [known-issues](known-issues.md) #8 and #9 (Worker can run on-demand; main thread can show "Click Run" instead of blocking on mount).
- **Unify the schema set** between CLI (`perf.test.ts`) and Browser (`/bench`). Move `simple/user/nested` (or the chosen final triplet) into `src/lib/schemas/` so both harnesses import the same shapes. Closes [known-issues](known-issues.md) #6.
- **Time-budget runs** — replace fixed `warmup=5, runs=20` with "run for N ms, count iterations". A 500 ms budget per library gives stable ops/sec without requiring the user to choose run counts.
- **Rename or remove cold-start.** If kept, measure it as a separate "first-call latency" trace with a single dedicated cold call per fresh import (only possible inside the Worker, where modules can be re-imported per measurement). Closes [known-issues](known-issues.md) #7.
- Add a progress indicator and an Abort button to `/bench`.

**Exit criteria:**

- A `/bench` run with default settings completes without dropping any frames (Performance panel shows no main-thread tasks > 50 ms during the run).
- CLI and Browser harnesses both report ops/sec for the same set of schema names; numbers are within an order of magnitude of each other on the same machine.
- No metric on `/bench` is labeled "cold start" unless it actually represents one.

**Closes:** #6, #7, #8, #9.

## P3 — Merge with the `zod4-mock` repo

**Goal:** retire `gen-bench` as a standalone repo; its content lives inside the `zod4-mock` repo as the project's official site.

`design.md` already states this is the intent. The wiki's `product/` topic (vision, differentiators, audience) is the part that should travel with the merge — it's about the library, not the site. `site/*` may travel too (as design notes for the merged repo's `docs/` or `site/` dir) or be archived; decision deferred to merge time.

**Scope (sketch — full plan deferred to a separate session):**

- Reconcile dependencies between the two repos (avoid two copies of Storybook, etc.).
- Decide directory layout in the merged repo (`site/`, `playground/`, `bench/` as siblings of `src/`).
- Preserve `bench/results/history.json` continuity if it's worth keeping.
- Decide whether `zod4-mock` releases trigger automatic benchmark re-runs (CI flow).
- Move this wiki to `zod4-mock/wiki/` so it's the source of truth for both library and site.

**Exit criteria:** `gen-bench` repo is archived (or aliased). `zod4-mock`'s package homepage URL points to the merged site.

## Cross-cutting backlog (not assigned to a phase)

- Light-theme verification across all routes (tokens are wired but never visually QA'd in the review).
- Storybook coverage gaps audit — every component supposedly has a story; verify on the next sweep.
- Add an "install command" copy button next to the install snippet on `/docs/getting-started`.
- A `playwright`-driven smoke test that visits `/`, `/bench`, `/showcase`, `/table`, `/docs/getting-started` and asserts no console errors.

## See Also

- [vision](vision.md) — the target the roadmap is converging on.
- [known-issues](known-issues.md) — the inventory each phase closes.
- [benchmark-methodology](benchmark-methodology.md) — the constraints P2 is built around.
- [product/vision](../product/vision.md), [product/differentiators](../product/differentiators.md) — the messaging this roadmap protects.
