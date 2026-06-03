# Site architecture

Site-specific architectural concerns. The library + workspace-wide rules live in the
root [`architecture.md`](../architecture.md). Anything here applies only to `site/`.

## Stack

| Layer      | Choice                                          |
| ---------- | ----------------------------------------------- |
| Framework  | SvelteKit 2.59.1                                |
| UI         | Svelte 5.55.5 (runes mode)                      |
| Build      | Vite 8                                          |
| Markdown   | mdsvex 0.12 with Shiki syntax highlighting      |
| Charting   | Chart.js 4 + svelte-chartjs                     |
| Editor     | CodeMirror 6 (deferred / client-only — see D18) |
| Storybook  | Storybook 10 (CSF + addon-vitest)               |
| Browser QA | Playwright via `@vitest/browser-playwright`     |
| Deploy     | Vercel via `@sveltejs/adapter-vercel`           |

## Key libraries

| Package                        | Role                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| `zod`                          | Runtime schema validation (v4); production schemas import from here |
| `zod3` (`npm:zod@^3.x`)        | Parity-only Zod v3 for `@anatine/zod-mock` benchmarks (D16)         |
| `zod4-mock` (`workspace:*`)    | The library this site exists to demonstrate                         |
| `@zod4-mock/locale-en` / `-nl` | Localised data corpora                                              |
| `@anatine/zod-mock` `^3.14`    | Bench competitor (Zod v3 schema-driven generator)                   |
| `@faker-js/faker` `^10`        | Bench competitor (hand-coded generators)                            |
| `chart.js` + `svelte-chartjs`  | `/bench` bar charts                                                 |
| `shiki`                        | Syntax highlighting in mdsvex `playground` fences                   |
| `@codemirror/*`                | Live editor in `SchemaPlayground` (client-only — D18)               |
| `mdsvex`                       | Markdown → Svelte for `/docs/[slug]` routes                         |

## Test setup

### Unit tests

`pnpm site:test:unit` — vitest, node environment, `vitest.unit.config.ts`, picks up
`src/**/*.test.ts`. Fast (< 1s typical).

### Component tests (Storybook CSF)

`pnpm test:component` (within `site/`) — vitest browser provider via Playwright,
`vite.config.ts`. Runs `*.stories.svelte` `play()` functions in a real browser.
`maxWorkers=1`, `fileParallelism=false` — heavy setup, slow but accurate.

### Full suite

`pnpm site:test:unit && pnpm test:component`. CI runs both.

### Performance / bench harness (not in CI)

`pnpm site:bench` — runs `bench/perf.test.ts` via vitest with `warmup=1000`,
`runs=5000`, forks pool. Writes `bench/results/latest.json` (committed) and
`bench/results/history.json` (gitignored — grows unbounded). The browser-tier
benchmark on `/bench` is qualitative; the CLI is citable (D17).

### Type checking

`pnpm site:check` — `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json`.
Verifies Svelte template type-correctness against `.svelte-kit/`-generated route
types.

### Lint / format

`pnpm --filter @zod4-mock/site lint` (oxlint) and `pnpm fmt` from root (oxfmt
walks the workspace). Site has its own `oxlint.json` for Svelte-specific rule
overrides.

## Project structure

```
site/
├── src/
│   ├── lib/
│   │   ├── bench.ts              measure() harness
│   │   ├── schemas/              flat.ts, nested.ts, array.ts, ecommerce.ts
│   │   ├── runners/              zod4mock.ts, zodmock.ts, faker.ts, ecommerce.ts
│   │   ├── components/
│   │   │   ├── Foundations/      Storybook docs (Color, Typography, Spacing)
│   │   │   ├── Primitives/       Button, Input, RangeSlider, SegmentedControl
│   │   │   ├── Bench/            BenchChart, MetricBadge, WinnerCallout, LibraryLegend
│   │   │   ├── Showcase/         CodePanel, JsonTree, RelationCallout
│   │   │   ├── Table/            DataTable, TimingBadge
│   │   │   ├── Surfaces/         FeatureMatrix, SummaryCard
│   │   │   └── Docs/             CodeBlock, Editor, SchemaPlayground
│   │   └── styles/
│   │       ├── tokens.css        CSS custom properties (dark default, html.light override)
│   │       └── app.css           Global resets, type scale, utility classes
│   └── routes/
│       ├── +page.svelte          / — zod4-mock homepage
│       ├── bench/                /bench — live benchmark
│       ├── showcase/             /showcase — relational demo
│       ├── table/                /table — DOM stress test
│       └── docs/                 /docs/[slug] — mdsvex docs
├── bench/
│   └── perf.test.ts              CLI benchmark (pnpm site:bench)
├── content/docs/                 Markdown source files for /docs/[slug]
└── .storybook/                   Storybook config
```

## Design system

Token-driven, CSS custom properties in `src/lib/styles/tokens.css`:

- Dark base by default; light theme via `html.light` class on `<html>` (QA pending — B76).
- Library identity colors: `--lib-zod4mock: #a78bfa`, `--lib-zodmock: #fbbf24`, `--lib-faker: #34d399`.
- 8px spacing scale; Inter (body) + JetBrains Mono (code).
- 7-level type scale: `.t-large` → `.t-micro`.

Whether to invest in a documented design system layer is open — see
[B79](../backlog/inbox/B79-site-design-system-scope.md).

## See also

- [vision.md](vision.md) — how the site sells zod4-mock.
- [benchmark-methodology.md](benchmark-methodology.md) — how the speed numbers are produced.
- [showcase-redesign.md](showcase-redesign.md) — design notes for `/showcase`.
- Root [architecture.md](../architecture.md) — Rules D16–D20 bind site-specific behaviour.
