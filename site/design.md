# gen-bench — Design Document

## Overview

`gen-bench` is a benchmark and showcase SvelteKit application for
[`zod4-mock`](https://github.com/dxlbnl/zod4-mock), comparing mock data
generation across:

| Library           | Description                                       |
| ----------------- | ------------------------------------------------- |
| `zod4-mock`       | Schema-driven generation for Zod v4 _(subject)_   |
| `@faker-js/faker` | Pure, schema-less random data                     |
| `zod-mock`        | Schema-driven generation for Zod v3 (predecessor) |

This project is designed to eventually merge with the zod4-mock playground.
All design and tooling decisions mirror that codebase.

### Claims under test

1. **Speed** — zod4-mock generates data faster than zod-mock per operation
2. **Relational fidelity** — zod4-mock produces referentially consistent data
   (IDs that cross-reference real entities); faker requires manual wiring

---

## Tech Stack

| Role             | Choice                                          |
| ---------------- | ----------------------------------------------- |
| Framework        | SvelteKit 2                                     |
| Language         | TypeScript 6 (strict)                           |
| UI               | Svelte 5 (runes)                                |
| Styling          | CSS custom properties — no utility framework    |
| Charts           | Chart.js + svelte-chartjs                       |
| Syntax highlight | Shiki                                           |
| Component docs   | Storybook 10 + `@storybook/addon-svelte-csf`    |
| Testing          | Vitest 4 (unit + Storybook CSF component tests) |
| Linting/fmt      | oxlint + oxfmt                                  |
| Deployment       | Vercel adapter                                  |
| Package manager  | pnpm                                            |

---

## Design System

Plain CSS custom properties, no utility framework. Palette matches the
zod4-mock playground for future merge compatibility.

### `src/lib/styles/tokens.css`

```css
/* Color */
--bg-base: #0a0a0f;
--bg-raised: #14141c;
--bg-overlay: #1f1f2c;
--text-primary: #e8e8f0;
--text-muted: #8888a0;
--border: #252533;
--accent: #a78bfa;
--accent-soft: rgba(167, 139, 250, 0.2);
--success: #2dd4bf;
--warning: #fbbf24;
--danger: #f87171;

/* Library identity colors (charts + legend) */
--lib-zod4mock: #a78bfa;
--lib-zodmock: #fbbf24;
--lib-faker: #34d399;

/* Spacing — 8px base */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-8: 48px;

/* Component heights */
--h-btn: 26px;
--h-topbar: 40px;
--h-input: 22px;
--h-row: 28px;

/* Typography */
--font-sans: "Inter", system-ui, sans-serif;
--font-mono: "JetBrains Mono", monospace;

/* Motion */
--t-quick: 120ms;
--t-normal: 150ms;

/* Shadows */
--shadow-popover: 0 8px 32px rgba(0, 0, 0, 0.5);
```

Light theme via `html.light { ... }`.

### `src/lib/styles/app.css`

Global resets, 7-level type scale (`.t-large` → `.t-micro`), `.btn` variants
(`primary`, `ghost`, `danger`), `.seg`, `.kbd`, custom scrollbars.

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

| Layer                           | Tool                                  | Pattern                    |
| ------------------------------- | ------------------------------------- | -------------------------- |
| Unit — stores, runners, harness | Vitest                                | `*.test.ts` next to source |
| Component                       | Storybook + `@storybook/addon-vitest` | `*.stories.svelte`         |

---

## Pages and Component Requirements

### `/` — Home

Feature matrix across libraries, headline stats, nav CTAs.

**Components:**

- `FeatureMatrix` — library × feature grid, cells show ✓ / ✗ / partial
- `SummaryCard` — single headline stat (e.g. "3.2× faster")
- `Button` — nav CTAs

### `/bench` — Live Benchmarks

All timing in the browser (`performance.now`). Warm path separated from cold start.

**Controls (top bar):**

- `SegmentedControl` — schema: Flat | Nested | Array
- `RangeSlider` — N records, log scale 10 → 10 000, labeled stops
- `Button` — Run

**Results:**

- `BenchChart` — horizontal grouped bar chart: warm ops/sec, then cold-start row
- `WinnerCallout` — auto-computed ratio, shown after run
- `LibraryLegend` — color dot + library name × 3
- `MetricBadge` — ops/sec + ms/1k, one per library

**Schema scenarios:**

| Label  | Shape                                                     |
| ------ | --------------------------------------------------------- |
| Flat   | 10 primitives: string, number, boolean, date, enum, email |
| Nested | 3-level: order → customer → address                       |
| Array  | Schema returning `Variant[]` of 50 items                  |

zod-mock uses equivalent Zod v3 schemas.
Relational scenario: zod4-mock only (others show N/A).

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

**Components:**

- `CodePanel` — tabbed Shiki code viewer, one tab per entity
- `JsonTree` — collapsible JSON, cross-entity IDs highlighted in accent color
- `Button` — Regenerate
- `RelationCallout` — explicit evidence list: "review.userId = User#42 ✓"

**Layout:** two equal columns — code left, output right.

### `/table` — Raw DOM Stress Test

No virtual scrolling. The page is intentionally honest: you see both
generation time and render time, and at high row counts the browser
will slow down. That's the point.

**Row counts:** 100 / 500 / 1k / 5k

**Components:**

- `SegmentedControl` — row count selector
- `TimingBadge` — one for generation time, one for render time
- `Input` — text filter (client-side, filters visible rows)
- `DataTable` — plain Svelte `{#each}` table with sortable column headers

**What to display:** User schema (name, email, address fields).
All N rows rendered in the DOM — no windowing.

---

## Component Inventory

Derived from view requirements above. Primitives that share an API with the
playground are merge candidates; the relationship is a consequence, not the
starting point.

```
src/lib/components/
├── Foundations/              # Storybook docs only — no runtime components
│   ├── Color.stories.svelte
│   ├── Typography.stories.svelte
│   └── Spacing.stories.svelte
├── Primitives/
│   ├── Button.svelte + .stories.svelte
│   ├── Input.svelte + .stories.svelte
│   ├── RangeSlider.svelte + .stories.svelte   # log-scale, labeled stops
│   └── SegmentedControl.svelte + .stories.svelte
├── Bench/
│   ├── BenchChart.svelte + .stories.svelte    # Chart.js grouped bars
│   ├── MetricBadge.svelte + .stories.svelte   # single stat + unit + label
│   ├── WinnerCallout.svelte + .stories.svelte # "X× faster" highlight
│   └── LibraryLegend.svelte + .stories.svelte # color + name × 3
├── Showcase/
│   ├── CodePanel.svelte + .stories.svelte     # Shiki + entity tabs
│   ├── JsonTree.svelte + .stories.svelte      # recursive collapsible
│   └── RelationCallout.svelte + .stories.svelte
├── Table/
│   ├── DataTable.svelte + .stories.svelte     # plain {#each}, sortable
│   └── TimingBadge.svelte + .stories.svelte
└── Surfaces/
    ├── FeatureMatrix.svelte + .stories.svelte
    └── SummaryCard.svelte + .stories.svelte
```

---

## Data Layer

### `src/lib/schemas/`

```
flat.ts       — zod4 schema + equivalent zod3 schema for zod-mock timing
nested.ts     — 3-level nested object
array.ts      — schema returning an array of 50 items
ecommerce.ts  — full relational graph (zod4-mock only)
```

### `src/lib/runners/`

```
zod4mock.ts   — uses zod4-mock
zodmock.ts    — uses zod-mock with zod3 schemas
faker.ts      — manual faker construction, same output shape
```

### `src/lib/bench.ts`

```ts
export interface BenchResult {
  avg: number;
  min: number;
  max: number;
  opsPerSec: number;
  coldStart: number;
}

export function measure(fn: () => void, { warmup = 5, runs = 20 } = {}): BenchResult {
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
  return {
    avg,
    min: Math.min(...times),
    max: Math.max(...times),
    opsPerSec: 1000 / avg,
    coldStart,
  };
}
```

---

## Implementation Order

1. Scaffold SvelteKit (TypeScript strict)
2. Install dependencies
3. Design tokens + app.css + Storybook config
4. Foundations stories (docs-only)
5. Primitive components + stories (Button, Input, RangeSlider, SegmentedControl)
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
