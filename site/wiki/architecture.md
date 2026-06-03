# Architecture

> Sources: gen-bench codebase, 2026-05-16

## Stack

| Layer | Choice |
|-------|--------|
| Framework | SvelteKit + Svelte 5 (runes-only, `compilerOptions.runes` enforced) |
| Language | TypeScript |
| Runtime | Node 22 (`nodejs22.x`) |
| Deploy | `@sveltejs/adapter-vercel` |
| Bundler | Vite |
| Package manager | pnpm |

## Key libraries

| Purpose | Library |
|---------|---------|
| Schema runtime (v4) | `zod@^4.4.3` (aliased `zod`) |
| Schema runtime (v3, parity only) | `zod3@npm:zod@^3.24.4` |
| Mock generator under test | `zod4-mock@0.5.0` (pinned exact) |
| Zod v3 mock (parity) | `@anatine/zod-mock@^3.14.0` |
| Fixture baseline | `@faker-js/faker@^9.8.0` |
| Markdown + playgrounds | mdsvex |
| Syntax highlighting | Shiki (`github-dark-dimmed`) |
| Code editor | CodeMirror 6 |
| Chart rendering | Chart.js |

## Git conventions

- **No `Co-Authored-By: Claude` lines in commits.** Commits are authored by the developer. Do not add AI attribution trailers.
- Commit messages describe the *what and why* of the change, not the implementation steps.

## TypeScript conventions

- **No `any`** — ever. Use `unknown` + narrowing, precise generics, or `satisfies`. PRs with `any` are rejected at review.
- **No non-null assertions (`!`)** — if a value can be `null | undefined` at the type level, handle it explicitly. Assertions hide bugs; narrow instead.
- **No unsafe `as` casts** — `as SomeType` is only acceptable at external boundaries (e.g. deserializing an API response already validated by Zod). All other uses require an inline comment explaining why the cast is safe.
- **Prefer `satisfies`** over widening casts when you want to check a value against a type without losing the inferred literal type.
- **No `@ts-ignore` or `@ts-expect-error`** without a comment on the next line explaining why the error can't be fixed properly.
- TypeScript strict mode is on via `svelte-check` (`"strict": true` in `tsconfig.json`). Do not relax it.

## Test setup

### Unit tests
- **Runner:** Vitest
- **Config:** `vitest.unit.config.ts`
- **Pattern:** `src/**/*.test.ts`
- **Environment:** Node (no browser)
- **Run command:** `pnpm test:unit`

### Component tests (Storybook CSF)
- **Runner:** Vitest + Playwright (Chromium)
- **Config:** `vite.config.ts`
- **Pattern:** `src/**/*.stories.svelte` — each `play()` function becomes a test
- **Run command:** `pnpm test:component`

### Full suite
- **Run command:** `pnpm test` (`test:unit` + `test:component`)

### Performance / bench harness (not in CI)
- **Config:** `bench/vitest.config.ts`
- **Run command:** `pnpm bench`
- **Output:** `bench/results/latest.json` (committed); `history.json` (gitignored)

### Type checking
- **Command:** `pnpm check` (`svelte-kit sync && svelte-check`)

### Lint / format
- **Linter:** oxlint (`pnpm lint`)
- **Formatter:** oxfmt (`pnpm fmt`)

## Project structure

```
gen-bench/
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
│   └── perf.test.ts              CLI benchmark (pnpm bench)
├── content/docs/                 Markdown source files for /docs
├── wiki/                         Single source of truth (this directory)
└── .storybook/                   Storybook config
```

## Design system

Token-driven, CSS custom properties in `src/lib/styles/tokens.css`:
- Dark base by default; light theme via `html.light` class on `<html>`
- Library identity colors: `--lib-zod4mock: #a78bfa`, `--lib-zodmock: #fbbf24`, `--lib-faker: #34d399`
- 8px spacing scale; Inter (body) + JetBrains Mono (code)
- 7-level type scale: `.t-large` → `.t-micro`

## See Also

- [site/current-state](site/current-state.md) — detailed component and route inventory
- [site/benchmark-methodology](site/benchmark-methodology.md) — how measure() works
- [backlog](backlog.md) — current work queue
