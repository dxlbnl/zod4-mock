# Site Current State (2026-05-13)

> Sources: gen-bench design.md, 2026-05-13; code review 2026-05-13
> Raw: [Design Doc](../../raw/product/2026-05-13-design-doc.md); [Review Findings](../../raw/site/2026-05-13-review-findings.md)

## Overview

High-level snapshot of what exists in the repo today, written to stay useful even when the code drifts. Routes, data layer, two benchmark harnesses, the docs pipeline, and the test/check status. Detail on individual files is intentionally minimal — anyone working in the code can read the code; this article tells future Claude where to look.

## Routes

- **`/` — home.** Hero + summary cards + feature matrix. Built from `Surfaces/FeatureMatrix`, `Surfaces/SummaryCard`, `Primitives/Button`. Currently overclaims speed (see [known-issues](known-issues.md) #5).
- **`/bench` — live benchmark.** Schema selector (Flat/Nested/Array), log-scale range slider (10 → 10 000), Run button. Renders a horizontal grouped bar chart and per-library metric badges. Auto-runs on mount.
- **`/showcase` — relational demo.** Two-column layout: tabbed Shiki code panel on the left, collapsible JSON tree on the right with cross-entity IDs highlighted. `RelationCallout` makes explicit `review.userId = User#42 ✓` proofs.
- **`/table` — DOM stress test.** Row count segmented control (100/500/1k/5k), text filter, sortable plain `{#each}` table. Reports generation time and render time as separate `TimingBadge`s.
- **`/docs` → `/docs/getting-started`** (redirect). Sidebar nav + mdsvex-rendered article. Interactive playground for any code fence marked ` ```playground`.

## Data layer

- **Schemas** — `src/lib/schemas/`:
  - `flat.ts`, `nested.ts`, `array.ts` — each exports a Zod v4 schema and a **paired Zod v3 schema** (`flatSchema` + `flatSchema3`, etc.) for parity benchmarking against `@anatine/zod-mock`.
  - `ecommerce.ts` — the seven-entity relational graph (User, Category, Product, Variant, Review, Order, OrderItem), Zod v4 only.
- **Runners** — `src/lib/runners/`:
  - `zod4mock.ts`, `zodmock.ts`, `faker.ts` — thin wrappers exposing `{ flat, nested, array, batch(schema, n) }`.
  - `ecommerce.ts` — `generateWorld(seed?)` builds and wires the relational graph. Half-seeded today (see [known-issues](known-issues.md) #3).
- **Bench harness** — `src/lib/bench.ts`: `measure(fn, { warmup, runs })` returns `{ avg, min, max, opsPerSec, coldStart }`. See [benchmark-methodology](benchmark-methodology.md) for what these mean and where they mislead.

## Two benchmark harnesses

There are **two** parallel benchmark setups in the repo:

1. **CLI** — `bench/perf.test.ts` (`pnpm bench`). Statistically solid: WARMUP=1000, RUNS=5000. Measures single-record generation per library. Writes `bench/results/latest.json` and appends to `history.json`.
2. **Browser** — `/bench` page. Underpowered: warmup=5, runs=20. Measures batches of N records. Runs on user click (and on mount).

The two harnesses use **different schemas** (`simple/user/nested` vs `flat/nested/array`) and **different configs**. This is a documented divergence and a maintenance hazard — see [benchmark-methodology](benchmark-methodology.md) and [known-issues](known-issues.md) #6.

## Components

```
src/lib/components/
├── Foundations/    Storybook docs only (Color, Typography, Spacing)
├── Primitives/     Button, Input, RangeSlider (log-scale), SegmentedControl
├── Bench/          BenchChart (Chart.js bar), MetricBadge, WinnerCallout, LibraryLegend
├── Showcase/       CodePanel (Shiki+tabs), JsonTree (self-recursive), RelationCallout
├── Table/          DataTable (generic, sortable), TimingBadge
├── Surfaces/       FeatureMatrix, SummaryCard
└── Docs/           CodeBlock (copy button), Editor (CodeMirror 6), SchemaPlayground
```

Every component has a `.stories.svelte` sibling. Runes-only mode is enforced via `svelte.config.js`.

## Design system

- `src/lib/styles/tokens.css` — dark base by default, light theme via `html.light`. Library identity colors: `--lib-zod4mock: #a78bfa`, `--lib-zodmock: #fbbf24`, `--lib-faker: #34d399`. 8px spacing scale, Inter + JetBrains Mono.
- `src/lib/styles/app.css` — global resets, 7-level type scale (`.t-large` → `.t-micro`), `.btn` variants, `.seg`, `.kbd`.

## Docs pipeline

- **mdsvex** (`svelte.config.js` preprocess) handles `.md` extension.
- **Shiki** (`github-dark-dimmed` theme) syntax-highlights normal code fences.
- **Custom playground marker** — a fence tagged ` ```typescript playground` is base64-encoded into `<div data-playground="...">`. On `/docs/[slug]/+page.svelte` mount, those placeholders are scanned and replaced with `mount(SchemaPlayground, ...)` instances. Each playground has a CodeMirror 6 editor + a JSON output tree + a Randomize button that re-seeds.
- **Doc routes** — `/docs/+page.ts` redirects to `getting-started`; `/docs/[slug]/+page.ts` uses `import.meta.glob` to resolve from `/content/docs/*.md`. `entries()` makes them prerenderable.

## Tooling

- **Vitest** — `vitest.unit.config.ts` for `src/**/*.test.ts` in Node, and `vite.config.ts` for Storybook CSF tests in a Playwright-driven Chromium.
- **Storybook 10** — `@storybook/sveltekit`, with addons: svelte-csf, vitest, a11y, docs, themes.
- **oxlint + oxfmt** — fast Rust-based linter/formatter (replaces ESLint/Prettier).
- **Adapter** — `@sveltejs/adapter-vercel`, runtime `nodejs22.x`.

## Build & test status (snapshot 2026-05-16)

- `pnpm test:unit` — ✅ **26/26 passing** (bench.test.ts, schemas.test.ts, runners.test.ts).
- `pnpm test:component` — ✅ **46/46 passing** (Storybook CSF play functions, Chromium).
- `pnpm check` — ✅ **0 errors, 0 warnings** (was 8 errors / 1 warning as of 2026-05-13; closed by P0 pass).
- `pnpm lint` — ✅ **0 warnings** (was 2 `bind:this` false positives; closed by P1 pass).

## Dependencies of note

- `zod@^4.4.3` (the v4 schema runtime)
- `zod3@npm:zod@^3.24.4` (the v3 runtime, used solely for the parity benchmark)
- `zod4-mock@0.5.0` — **exact-pinned** as of P1 pass (was range `^0.2.3`).
- `@anatine/zod-mock@^3.14.0` (the v3 mocker, with a pnpm `overrides` block forcing it to use the v3 zod).
- `@faker-js/faker@^9.8.0`.

## See Also

- [vision](vision.md) — where the site is headed.
- [benchmark-methodology](benchmark-methodology.md) — how the two harnesses work and what they measure.
- [known-issues](known-issues.md) — what's broken or hazardous today.
- [roadmap](roadmap.md) — the prioritized path to the target.
