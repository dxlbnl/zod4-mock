# gen-bench Design Document

> Source: gen-bench/design.md (in-repo)
> Collected: 2026-05-13
> Published: 2026-05-13

## Overview

`gen-bench` is a benchmark and showcase SvelteKit application for
[`zod4-mock`](https://github.com/dxlbnl/zod4-mock), comparing mock data
generation across:

| Library | Description |
|---------|-------------|
| `zod4-mock` | Schema-driven generation for Zod v4 *(subject)* |
| `@faker-js/faker` | Pure, schema-less random data |
| `zod-mock` | Schema-driven generation for Zod v3 (predecessor) |

This project is designed to eventually merge with the zod4-mock playground.
All design and tooling decisions mirror that codebase.

### Claims under test

1. **Speed** — zod4-mock generates data faster than zod-mock per operation
2. **Relational fidelity** — zod4-mock produces referentially consistent data
   (IDs that cross-reference real entities); faker requires manual wiring

---

## Tech Stack

| Role | Choice |
|------|--------|
| Framework | SvelteKit 2 |
| Language | TypeScript 6 (strict) |
| UI | Svelte 5 (runes) |
| Styling | CSS custom properties — no utility framework |
| Charts | Chart.js + svelte-chartjs |
| Syntax highlight | Shiki |
| Component docs | Storybook 10 + `@storybook/addon-svelte-csf` |
| Testing | Vitest 4 (unit + Storybook CSF component tests) |
| Linting/fmt | oxlint + oxfmt |
| Deployment | Vercel adapter |
| Package manager | pnpm |

---

## Design System

Plain CSS custom properties, no utility framework. Palette matches the
zod4-mock playground for future merge compatibility.

Tokens defined in `src/lib/styles/tokens.css` cover color (dark base with light
override), library identity colors for charts, 8px-base spacing scale,
component heights, Inter + JetBrains Mono typography, motion (120ms quick,
150ms normal), and popover shadow. Global app.css adds resets, a 7-level type
scale (`.t-large` → `.t-micro`), `.btn` variants, `.seg`, `.kbd`, custom
scrollbars.

---

## Storybook

`.storybook/` mirrors playground setup:
- **`main.ts`** — `@storybook/sveltekit`, addons: svelte-csf, vitest, a11y, docs, themes
- **`theme.ts`** — dark base, `#0a0a0f` bg, `#a78bfa` accent, Inter + JetBrains Mono
- **`preview.ts`** — dark/light bg presets, className theme switcher, sort:
  `Foundations → Primitives → Bench → Showcase → Table → Surfaces`

Every component in `src/lib/components/**` gets a `.stories.svelte` sibling.

---

## Testing

TDD: write test first, implement second.

| Layer | Tool | Pattern |
|-------|------|---------|
| Unit — stores, runners, harness | Vitest | `*.test.ts` next to source |
| Component | Storybook + `@storybook/addon-vitest` | `*.stories.svelte` |

---

## Pages and Component Requirements

### `/` — Home

Feature matrix across libraries, headline stats, nav CTAs.

**Components:** `FeatureMatrix`, `SummaryCard`, `Button`.

### `/bench` — Live Benchmarks

All timing in the browser (`performance.now`). Warm path separated from cold start.

**Controls (top bar):** schema (Flat | Nested | Array), N records log-scale 10–10 000, Run.

**Results:** horizontal grouped bar chart, winner callout, legend, metric badges.

**Schema scenarios:**

| Label | Shape |
|-------|-------|
| Flat | 10 primitives: string, number, boolean, date, enum, email |
| Nested | 3-level: order → customer → address |
| Array | Schema returning `Variant[]` of 50 items |

zod-mock uses equivalent Zod v3 schemas. Relational scenario: zod4-mock only.

### `/showcase` — Relational Data Demo

**E-commerce entity graph:**

```
User        { id, name, email, address }
Category    { id, name, slug, parentId? → Category }
Product     { id, name, categoryId → Category, price, rating }
Variant     { id, productId → Product, sku, stock, color, size }
Review      { id, productId → Product, userId → User, rating, body, createdAt }
Order       { id, userId → User, items: OrderItem[], total, status }
OrderItem   { orderId, productId → Product, variantId → Variant, qty, price }
```

**Components:** `CodePanel` (tabbed Shiki viewer), `JsonTree` (cross-entity IDs highlighted),
`Button` (Regenerate), `RelationCallout` (explicit `review.userId = User#42 ✓` proofs).

**Layout:** two equal columns — code left, output right.

### `/table` — Raw DOM Stress Test

No virtual scrolling. The page is intentionally honest: you see both
generation time and render time, and at high row counts the browser
will slow down. That's the point.

**Row counts:** 100 / 500 / 1k / 5k

**Components:** `SegmentedControl` (row count), `TimingBadge` (gen + render), `Input` (filter), `DataTable` (plain `{#each}`, sortable).

---

## Component Inventory

```
src/lib/components/
├── Foundations/              # Storybook docs only — no runtime components
├── Primitives/               # Button, Input, RangeSlider, SegmentedControl
├── Bench/                    # BenchChart, MetricBadge, WinnerCallout, LibraryLegend
├── Showcase/                 # CodePanel, JsonTree, RelationCallout
├── Table/                    # DataTable, TimingBadge
└── Surfaces/                 # FeatureMatrix, SummaryCard
```

---

## Data Layer

`src/lib/schemas/`: `flat.ts`, `nested.ts`, `array.ts`, `ecommerce.ts` (the full
relational graph, zod4-mock only).

`src/lib/runners/`: `zod4mock.ts`, `zodmock.ts`, `faker.ts` — thin wrappers
exposing `{ flat, nested, array, batch(schema, n) }`.

`src/lib/bench.ts`:

```ts
export interface BenchResult {
  avg: number;
  min: number;
  max: number;
  opsPerSec: number;
  coldStart: number;
}

export function measure(
  fn: () => void,
  { warmup = 5, runs = 20 } = {}
): BenchResult {
  const t0 = performance.now();
  fn();
  const coldStart = performance.now() - t0;
  for (let i = 0; i < warmup; i++) fn();
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const s = performance.now();
    fn();
    times.push(performance.now() - s);
  }
  const avg = times.reduce((a, b) => a + b) / times.length;
  return { avg, min: Math.min(...times), max: Math.max(...times),
           opsPerSec: 1000 / avg, coldStart };
}
```

---

## Implementation Order

1. Scaffold SvelteKit (TypeScript strict)
2. Install dependencies
3. Design tokens + app.css + Storybook config
4. Foundations stories (docs-only)
5. Primitive components + stories
6. **TDD**: schemas.test.ts → flat / nested / array / ecommerce schemas
7. **TDD**: bench.test.ts → bench.ts harness
8. **TDD**: runners.test.ts → zod4mock / zodmock / faker runners
9. Bench components + stories → /bench page
10. Showcase components + stories → /showcase page
11. Table components + stories → /table page
12. Surfaces + home page

---

## Verification

- `pnpm storybook` — all sections visible, dark theme default
- `pnpm test:unit` — schema, harness, runner unit tests green
- `pnpm test:component` — all story tests green
- `/bench` — distinct ops/sec bars per library after Run
- `/showcase` — Regenerate produces consistent cross-entity IDs
- `/table` at 5k — browser renders (slowly is fine, that's the point)
- `pnpm build` — TypeScript strict, no errors
