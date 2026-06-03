# Site architecture rebuild — research report

> Backlog item: [B84](../../backlog/doing/B84-site-architecture-rebuild.md)
> Status: research revision #2 + maintainer addenda. Phase 2 (docs) is REJECTED
> as designed and gated on [B94](../../backlog/inbox/B94-docs-system-design.md)
> — "docs/\* is a terrible shape for superb docs." `@dxlbnl/ui` ownership
> clarified: maintainer is the vendor; license + repo Qs moot. Other §10
> Qs await answers.
> Date: 2026-06-03.

## 1. TL;DR

- **Promote `site/` to the single public surface** for zod4-mock — homepage, docs, comparison/bench, World Explorer — all on one SvelteKit deployment, served from `zod4-mock.vercel.app` (or successor URL per B82).
- **`@dxlbnl/ui@1.1.1`** is published, Svelte 5 + SvelteKit 2 peer-typed, ESM-only, with **~50 components** in 8 categories (primitives / layout / cards / navigation / forms / feedback / patterns / data) plus a `toast` store and `Phosphor` (dark) / `Paper` (light) palette tokens. It covers ~80% of what the current site hand-rolls; the gaps are domain-specific (`CodeMirror Editor`, `JsonTree`, `BenchChart`, `FeatureMatrix`, `RelationCallout`, plus the Explorer view widgets — see below).
- **Docs system: REJECTED; gated on [B94](../../backlog/inbox/B94-docs-system-design.md).** `docs/*` is the wrong shape for a docs *site*. Phase 2 stays a route stub until B94's design lands.
- **"Play with data" surface = World Explorer, not a schema-builder UI.** The brainstorm in `wiki/research/world-explorer.md` redirects the playground-shaped slot to a **World Explorer** fed by a new library API (`world.trace(): WorldTrace` + provenance capture sink + stable record IDs). The site mounts an `/explorer` route that renders the three view metaphors — **Constellation** (graph of records and relations), **Record Inspector** (field-by-field provenance chips colored by resolution rung), **Provenance Heatmap** (records × fields realism grid). The existing `playground/` workspace is **deprecated**, not absorbed; salvage value is narrow (the field-type catalogue may inform Inspector field rendering; `codegen.ts`'s string-build pattern *may inform* `writeExplorer` *when it lands in Phase 4 v2*) and is called out where it applies.
- **Comparison surface: keep `/bench` as the qualitative "live demo" (D17, D20)**, add a new `/comparison` page that renders the feature matrix + per-library narrative from a single `comparison.ts` data module that the ecosystem matrix (B83) writes into. The CLI `pnpm site:bench` remains the citable source; `/bench` reads `bench/results/latest.json` plus runs an interactive in-browser benchmark for vibes.
- **Phasing in 5 chunks** (re-ordered per redirect: docs first, comparison second, Explorer third): (Phase 1) `@dxlbnl/ui` foundation + IA scaffold + delete `/table`; (Phase 2) docs system (gated on B94); (Phase 3) `/comparison` + worker bench rebuild; (Phase 4) **World Explorer** — library-side `world.trace()` + provenance capture + IDs (v1); `writeExplorer` deferred to Phase 4 v2; (Phase 5) polish (smoke, Storybook audit, copy buttons, version baseline).

---

## 2. Current state

### `site/` (the gen-bench merge)

Routes (`site/src/routes/`):

- `/` — hero + inline relational exhibit (1 review record + 2 proof rows) + feature matrix + 3 summary cards + bench link + footer. Single Svelte file, 226 lines, references `Surfaces/FeatureMatrix`, `Surfaces/SummaryCard`, `Primitives/Button`, `Showcase/JsonTree`, and `runners/ecommerce.generateWorld()`.
- `/bench` — `SegmentedControl` + log-scale `RangeSlider` + `BenchChart` (Chart.js bar) + `MetricBadge` × 3 × 2 (ops/s + cold-start) + `WinnerCallout` + `LibraryLegend`. Auto-runs on mount (B73 closes this).
- `/showcase` — entity tabs + `CodePanel` (Shiki tabs) + `JsonTree` + `RelationCallout`. The current relational proof surface.
- `/table` — DOM stress test (`DataTable` + `TimingBadge`). Documented as "either reframe or de-emphasize".
- `/docs/+page.ts` redirects to `/docs/getting-started`. `/docs/[slug]/+page.ts` uses `import.meta.glob('/content/docs/*.md', { eager: true })` to load mdsvex modules. `/docs/[slug]/+page.svelte` hydrates ` ```typescript playground` fences into `SchemaPlayground` instances via `mount()` (D18).

Docs content (`site/content/docs/`): 4 files, total ~10 kB:

- `getting-started.md` (1.4 kB) — install + 1 playground fence.
- `api.md` (3.4 kB) — `generate(schema, options?)` + supported-type table + 1 playground fence.
- `relational.md` (2.7 kB) — faker-vs-zod4-mock pattern + e-commerce graph + 1 playground fence.
- `comparison.md` (2.9 kB) — feature matrix + per-library example + "when to use each" table.

The end-user `docs/` directory (7 files, ~133 kB) is dramatically more comprehensive and is the published canonical reference — but **none of it is rendered on the site**. Site docs are a tiny rewrite stub.

Component library (`site/src/lib/components/`): 7 categories, ~28 components, every component has a `.stories.svelte` sibling (B78 audits this). Designed dark-first with token-driven CSS (`tokens.css`, `html.light` override; B76 QAs).

Data layer:

- `src/lib/schemas/{flat,nested,array,ecommerce}.ts` — Zod v4 + paired Zod v3 (`"zod3": "npm:zod@^3.x"`, gated by D16) for `@anatine/zod-mock` parity.
- `src/lib/runners/{zod4mock,zodmock,faker,ecommerce}.ts` — wrappers exposing `{flat, nested, array, batch(schema, n)}`. `ecommerce.ts:generateWorld(seed)` builds the 7-entity world (mulberry32-seeded after the P0 pass).
- `src/lib/bench.ts` — `measure(fn, {warmup, runs})`. Two harnesses (CLI `bench/perf.test.ts`, browser `/bench`) use different defaults and (until B70) different schemas.

Tokens: `tokens.css` declares 8px scale + Inter/JetBrains-Mono + accent `#a78bfa` (zod4-mock identity color). `html.light` override exists, not visually QA'd.

### `playground/` (the older workspace) — inventory only

Top-level pnpm workspace, `private: true`, Svelte 5 + SvelteKit 2 + Storybook 10 + Playwright + vitest. Inventoried here for completeness; **per the redirect, this workspace is deprecated** (see §6) and is not absorbed.

- `lib/codegen.ts` (16 kB) — generates `world.ts` TypeScript source from playground state. The string-build pattern (inlined template emitting a self-contained `.ts` file) is **analogous to** what `world.writeExplorer(path)` will need for the HTML artifact — possible reference, not reuse.
- `lib/state.svelte.ts` (15 kB) — central reactive store (seed, zod version, schemas, output tabs). **Not salvageable** — Explorer state is trace-driven, not editor-driven.
- `lib/schema-builder.ts` (8 kB) — builds Zod schemas at runtime from a field-tree representation. **Not salvageable** — Explorer reads real schemas via the user's existing `world.ts`, no UI builder.
- `lib/field-types.ts` (11 kB) — UI-facing field-type catalogue (Zod type → label, controls, default constraints). **Possible reference** for the Record Inspector's per-Zod-type field rendering (chip labels, formatting hints), even though Explorer reads `TraceField.resolution` not field-type metadata.
- `lib/output.svelte.ts` (3 kB) — derives JSON/typed-output panes. **Not salvageable**.
- `lib/utils/relations.ts` — `ctx.related` shape helpers. **Not salvageable** — Explorer consumes `TraceEdge`, not the matcher-side helper.
- Components (`Playground.svelte`, `LeftRail`, `SchemaEditor`, `OutputPane`, `ExportSheet`, `MobileTabBar`, plus primitives `FancySelect`, `NumberInput`, `Kbd`, `TypeChip`, `Select`): **discarded**. The Explorer's chrome is `@dxlbnl/ui` + the three custom view widgets.
- `playground/docs/` 4 pillar specs (Relations, Logic, Experimentation, Workflow): superseded by the World Explorer brainstorm.

The workspace is wired with vitest unit + component tests, Storybook 10, and dev-time Vercel adapter. **No production deploy** — playground/ is currently a private vitest/Storybook sandbox. After Phase 4 ships, the workspace is removed from `pnpm-workspace.yaml` and the directory deleted.

### What works

- The `/showcase` page with `JsonTree` highlighting and `RelationCallout` is the strongest existing exhibit; nothing else in the ecosystem demonstrates relational fidelity visually.
- mdsvex + the base64-hydrated `playground` fence (D18) is unique to this site and worth keeping — but it now feeds **doc examples only**, not a full builder.
- The CLI bench (`bench/perf.test.ts`) is statistically sound and produces `latest.json` that survives D17 cite-ability.
- The library's existing `FieldResolution` tagged union (`src/pipeline.ts`) and `world.explain(schema)` (`src/explain.ts`) **already name the resolution rungs** that the Explorer's chips colour by — the work is *capturing* per-record what `explain` reports per-schema, not inventing a vocabulary.

### What is structurally weak

- **Two source-of-truth docs**: `docs/*.md` (canonical, ~133 kB) vs `site/content/docs/*.md` (rewrites, ~10 kB). They will drift; the wiki rule D5 is enforced for `docs/api-reference.md` but the site copy gets no such treatment.
- **Two divergent component libraries**: `site/src/lib/components/` (~28 components, dark-first) vs `playground/src/lib/components/` (~25 components). Resolved by adopting `@dxlbnl/ui` and deleting `playground/`.
- **Two bench harnesses with different schemas** (B70).
- **No `/comparison` surface beyond `comparison.md` and the feature matrix on `/`**; B83's ecosystem inventory has no destination.
- The current `/table` route has no clear story — **delete** (confirmed by the maintainer).
- **No way to introspect a generated world**: today `.generate()` returns JSON; users can't see *why* a field got its value, *which* record an FK points at, or *how much* of the data is realistic vs raw fallback. The Explorer closes this gap.

---

## 3. `@dxlbnl/ui` findings

### Package facts

- **Name**: `@dxlbnl/ui` on npm (scoped to `dexternl` aka `code@dxlb.nl`).
- **Latest version**: **1.1.1** (published 2026-05-21). Version history: 0.1.0 → 1.0.0 → 1.1.0 → 1.1.1.
- **Description**: "Design system for dexterlabs.nl. SvelteKit component library with Phosphor (dark) and Paper (light) palettes, built with Svelte 5 and documented in Storybook."
- **Module type**: ESM-only (`"type": "module"`).
- **Peer dependencies**: `svelte ^5.0.0`, `@sveltejs/kit ^2.0.0` — matches site's Svelte 5.55 / SvelteKit 2.59.
- **Runtime dependencies**: `@fontsource/inter-tight 5.2.7`, `@fontsource/jetbrains-mono 5.2.8` (exact pins).
- **Dev tooling**: Storybook 10.4, Vitest 4.1, SvelteKit 2.60, TypeScript 6, Vite 8 — all aligned with the site's stack.
- **Exports**:
  - svelte → `./dist/index.js` (consumers resolve via the `svelte` condition; types via `./dist/index.d.ts`)
  - `./tokens/tokens.css`
  - `./tokens/typography.css`
- **Repository URL**: **not declared in package.json**. No GitHub link in the npm metadata. This is a blocking question (§10).
- **License**: not surfaced in the npm registry response we could fetch. Likely the maintainer's own; needs confirmation.
- **README**: published with the package; describes Phosphor/Paper palettes (`data-palette` attribute on `<html>`), terminal-green/amber accents, 40+ components, `pnpm storybook` at localhost:6006 for the local component explorer.

### Component inventory (47 named exports)

| Category    | Components                                                                       | Count |
| ----------- | -------------------------------------------------------------------------------- | ----- |
| Primitives  | `Button`, `Led`, `TagPill`, `Text`, `Heading`                                    | 5     |
| Layout      | `Stack`, `Inline`, `Spread`, `Grid`, `Container`, `Rule`, `Prose`                | 7     |
| Cards       | `Card`, `ProductCard`, `ProjectCard`, `NoteCard`                                 | 4     |
| Navigation  | `Nav`, `Breadcrumb`                                                              | 2     |
| Forms       | `Input`, `Textarea`, `Select`, `InputWrap`, `Field`, `Checkbox`, `Radio`, `RadioGroup`, `Switch` | 9     |
| Feedback    | `Alert`, `Modal`, `Toast`, `ToastRegion`, `toast()` function (+ `ToastItem` / `ToastVariant` / `ToastOptions` types) | 4     |
| Patterns    | `CtaBlock`, `StatCard`, `KvList`, `ProgressBar`, `ActivityRow`, `SectionHead`, `SectionFoot`, `PageHero` | 8     |
| Data        | `Accordion`, `AccordionItem`, `Tabs`, `Table`                                    | 4     |

### Tokens

`tokens.css` defines:

- **Two palettes**: `Phosphor` (dark, default at `:root`) and `Paper` (light, activated via `<html data-palette="paper">`). Same custom-property names across both — components are palette-agnostic.
- **Surface scale**: `--bg`, `--bg-rail`, `--bg-elev`, `--bg-sunken`.
- **Ink scale**: `--ink`, `--ink-dim`, `--ink-faint`.
- **Accents**: amber (#ffb347, primary CTA), cyan (#7cc7d1, code/labels), danger (#ff7a6b), ok (#8fd48a).
- **Spacing**: 8px base — `--u` through `--u10` (8, 16, 24, 32, 40, 48, … 80).
- **Radius**: `--radius` (2 px), `--radius-card` (4 px).
- Typography via `@fontsource/inter-tight` and `@fontsource/jetbrains-mono`.

This is a **superset** of the site's current `tokens.css` semantics: 2 palettes vs 1.5, finer spacing scale, named accent roles instead of a single `--accent`.

### Gaps relative to what the site needs

The `@dxlbnl/ui` exports do **not** include domain-specific surfaces. The following stay in `site/src/lib/components/`:

- **`SchemaPlayground`** (CodeMirror editor + IIFE/`new Function()` evaluator + live JSON output). Library only ships generic `Input`/`Textarea`. The `Editor.svelte` (CodeMirror 6 host) is unique.
- **`JsonTree`** (recursive collapsible tree + ID highlighting). No library equivalent.
- **`BenchChart`** (Chart.js bar) and `MetricBadge` / `LibraryLegend` / `WinnerCallout`. The library has `StatCard` and `ProgressBar` but no charting.
- **`FeatureMatrix`** (custom check/cross/partial/na grid). `Table` is too generic.
- **`RelationCallout`** (proof rows). `KvList` is close but not the same affordance.
- **`CodePanel`** (Shiki tabs). `Tabs` exists but the Shiki integration is custom.

Layout & chrome that **map cleanly**:

- `Container` (page width), `Stack`/`Inline`/`Spread`/`Grid` (replaces ad-hoc flex/grid in `+page.svelte`), `Nav` (replaces `+layout.svelte`'s topbar), `PageHero` (replaces the `+page.svelte` hero block), `CtaBlock` (replaces the inline relational exhibit's framing), `SectionHead`/`SectionFoot` (replaces `<h2 class="t-title">` patterns), `Prose` (could wrap `/docs` mdsvex output).
- `Button` (replaces the site's Button), `Input` / `Textarea` / `Select` / `Field` (replace `Primitives/Input`, no current select), `Toast` + `toast()` for copy-to-clipboard feedback (B77).
- `StatCard` (replaces `Surfaces/SummaryCard`), `KvList` (could render the proof rows), `Tabs` (replaces both the showcase entity tabs and the docs sidebar/tabs if we shift to tabbed layout), `Accordion` (FAQ / collapsible sections on `/comparison`), `Alert` (warning banners e.g. "honest framing" disclaimers per D20).

---

## 4. IA + routes

Proposed route map. The funnel honours D19 — first-time evaluator lands on `/`, relational proof is above the fold, install CTA is the most prominent action.

```
/                            Home — hero (relational pitch + Install CTA) +
                             inline RelationalExhibit + FeatureMatrix +
                             StatCard row (perf summary) + footer.
                             [primary funnel — D19]

/docs                        Doc index (redirects to /docs/getting-started).
/docs/getting-started        Install + first `generate(schema)` + inline playground.
/docs/concepts               World / SubjectType / pipeline / registry overview.
/docs/api                    `generate` + `createWorld` + `defineSubjectType` reference.
/docs/key-heuristics         Field-name → generator table.
/docs/recipes                Copy-pasteable patterns.
/docs/coverage               Zod v4 schema coverage table.
                             [sourced from /docs/*.md — see §5]

/comparison                  Ecosystem matrix + per-library narrative + bench
                             summary card (cites CLI numbers per D17).
                             Sourced from a single `comparison.ts` data module that
                             B83's findings write into.

/bench                       Live in-browser benchmark — qualitative (D17).
                             Worker-based (B69) + time-budget (B71) + progress/abort
                             (B73). Schema selector unified with CLI (B70).
                             Header card cites `latest.json` ops/sec as the truth.

/explorer                    World Explorer — fed by the library's `world.trace()`
                             API. Three view metaphors (Constellation / Record
                             Inspector / Provenance Heatmap) over a single WorldTrace.
                             Lives in nav alongside Docs/Comparison/Bench/Showcase.
                             [see §6 — replaces what /playground would have been]

/showcase                    Relational data demo (current `/showcase` reworked on
                             `@dxlbnl/ui` chrome; `JsonTree` + `RelationCallout`
                             kept as the domain widgets).

/table                       DELETED — confirmed by maintainer.
```

### Navigation (top bar via `@dxlbnl/ui` `Nav`)

```
zod4-mock  [Docs] [Explorer] [Showcase] [Comparison] [Bench]    GitHub | npm
```

The current site's `Table` link drops; `Explorer`, `Showcase`, and `Comparison` are new top-level entries instead of being buried.

> Route-name candidates considered for the Explorer surface: `/explorer` (recommended — matches the brainstorm's vocabulary, matches the API name `world.writeExplorer`), `/world` (shorter but ambiguous), `/browse` (too generic — could be confused for a docs listing). The recommendation is `/explorer`.

### Funnel (D19)

1. `/` hero — "Schema-driven mocks, done right for Zod 4" + "the only library with relational consistency across entities" + `Install` button (primary) + `See the relational demo` (secondary).
2. Inline relational exhibit — one entity (Review) with FK rows resolving live; `See all 7 entities →` link.
3. `FeatureMatrix` — competitor scan.
4. `StatCard` row — perf summary citing the CLI baseline (D17/D20 honest framing).
5. Secondary CTAs to `/explorer` ("See the universe your schemas build") and `/comparison` ("Versus the field").

A first-time visitor's path to install: hero CTA → `/docs/getting-started`. A first-time visitor's path to evaluate: hero → inline exhibit → matrix → `/comparison` → `/bench`. A first-time visitor's path to *see the why*: hero → `/explorer`.

---

## 5. Docs system

> **REJECTED 2026-06-03.** Maintainer rejected the hybrid `import.meta.glob('/docs/*.md')`
> recommendation: "docs/\* is a terrible shape for superb docs. we need to be better."
> The published `docs/*.md` is the shipped reference (dense, list-shaped); a docs *site*
> needs richer authoring, structured navigation, interactive content. Filed as
> [B94](../../backlog/inbox/B94-docs-system-design.md) — a research item to design the
> docs system properly (reference benchmarks, authoring path options, content model,
> interactive content surfaces, search, sync with `docs/`, phasing recommendation).
>
> The §5 content below is preserved as the rejected baseline, not the recommendation.
>
> ### REJECTED baseline (preserved for context)

**Recommendation: option (c) hybrid — `docs/*.md` is the source of truth, the site renders it via mdsvex.**

### Options weighed

**(a) Keep mdsvex in `site/content/docs/`** (status quo).
- Pros: trivial; already in production.
- Cons: drift. `docs/api-reference.md` is the canonical reference per architecture rule D5; the site's `api.md` is a thin rewrite. The site lies in two places about what zod4-mock supports.

**(b) Generate site docs from `docs/*.md`** (full single-source-of-truth).
- Pros: kills the drift; every `docs/` edit lands on the deployed site at next build; D5 propagates for free.
- Cons: `docs/api-reference.md` is 58 kB — too dense for a first-time visitor; it's a reference, not a tutorial. Loses the bite-size site-first surfaces (`getting-started.md` on the site is 1.4 kB, intentionally welcoming).

**(c) Hybrid** — site authors a small set of "site-only" intros, but every reference page reads from `docs/`. **Recommended.**

### Hybrid layout

```
docs/                        # source of truth (D5, unchanged)
├── api-reference.md         → site renders at /docs/api
├── concepts.md              → site renders at /docs/concepts
├── getting-started.md       → site renders at /docs/getting-started
├── key-heuristics.md        → site renders at /docs/key-heuristics
├── recipes.md               → site renders at /docs/recipes
├── zod4-schema-coverage.md  → site renders at /docs/coverage
├── bugs.md                  → not rendered (project-internal)
└── index.md                 → not rendered (replaced by /docs landing card)

site/src/routes/docs/
├── +page.svelte             /docs landing — card-grid into the above
├── [slug]/+page.ts          import.meta.glob('/docs/*.md')  ← reads root docs/
└── [slug]/+page.svelte      mdsvex output + SchemaPlayground hydration
```

The `import.meta.glob('/docs/*.md')` path in `+page.ts` changes from `/content/docs/*.md` to `/docs/*.md` (Vite resolves the workspace root). `site/content/docs/` is deleted.

### Authoring rules

- Every `docs/*.md` page **MUST** be valid mdsvex (no Svelte syntax that requires hand authoring). Playground fences continue to use the existing ` ```typescript playground` marker.
- The architecture rule **D5** ("public API changes update `docs/api-reference.md` in the same step") now self-propagates to the site. No new rule needed.
- `docs/` keeps a small site-only frontmatter convention if needed (e.g. `nav-order: 1`, `nav-group: reference`) — mdsvex strips it.

### Search & discovery

- **Local search** (no external service) via a build-time index. Use `pagefind` (works with prerendered SvelteKit + adapter-vercel; ~50 kB runtime, fully static, no API). Alternative: `flexsearch` with a hand-built `search-index.json` from the mdsvex modules.
- **Navigation**: `@dxlbnl/ui` `Nav` for top bar; the docs sidebar uses `Accordion` for grouped sections (Concepts / Reference / Guides). One canonical sidebar replaces the current per-layout `nav = [...]` array.
- **Cross-links**: every doc page emits an "Edit on GitHub" link pointing at `https://github.com/dxlbnl/zod4-mock/blob/main/docs/<slug>.md` (mdsvex frontmatter can carry `editPath`).

### Code-block-with-live-preview

- Keep the existing `playground` fence (`typescript playground`) for inline editable examples — it's a documented advantage (D18).
- Replace `SchemaPlayground.svelte` internals with the playground workspace's `Playground.svelte` (or a stripped "embed mode" of it). Same component drives the in-doc fence component (`SchemaPlayground`).
- Static (non-playground) code blocks continue with Shiki via mdsvex preprocess.

---

## 6. World Explorer

**Recommendation: replace what `/playground` would have been with a `/explorer` route fed by a new library-side API (`world.trace()` + `world.writeExplorer(path)`). The `playground/` workspace is deprecated, not absorbed.**

The redirect: per `wiki/research/world-explorer.md`, the "play with data" surface should not be a schema-builder UI. The user already has their schemas — they have a `world.ts` setup, they call `.generate()`, they get JSON. What's missing is **visibility into the universe that came out**: the records, the field-by-field provenance (which of the 7 resolution rungs fired), and the relation edges that wire records together. The Explorer makes the universe walkable.

### The trace-fed model

One foundational concept unlocks every view: have the world **record provenance as it generates**, then expose it as a plain, serializable structure (`WorldTrace`). The Explorer is a viewer over that structure — three view metaphors over one trace:

1. **Constellation** — graph view. Records are nodes, clustered by SubjectType into labelled galaxies; relation picks (`ctx.related`) are directed edges with their own provenance (`picked 5 of 8 via fork('rel:post')`). Derived records draw a faint lineage edge to their source. `store:false` ephemerals appear as ghost nodes.
2. **Record Inspector** — select a node → field-by-field card. Each field gets a **provenance chip** coloured by its `resolution` rung (`matcher` / `keymap` / `key-based` / `schema-based` / `override` / `default` / `absent`). Hover reveals the seed trail. Sibling causality drawn as small arrows.
3. **Provenance Heatmap** — grid: rows = records, columns = fields, cells coloured by resolution rung. Read the **realism ratio** at a glance — a wall of `key-based` green = rich data; lots of `schema-based` grey = fields falling through to raw fallback (a prompt to add a matcher).

### Two surfaces, one trace

The brainstorm recommends **a library-native `world.trace()` data API + a zero-dependency self-contained HTML artifact writer** (`world.writeExplorer("world.html")`). This gives the project two equally first-class viewer hosts:

- **Site `/explorer` route** — runs the user's schemas in-browser (via the existing mdsvex playground evaluation pattern, or via a paste-your-trace-JSON box for users who'd rather generate locally), produces a `WorldTrace`, and renders the three views. The site is the **canonical interactive viewer**.
- **Standalone `world.html` artifact** — `world.writeExplorer(path)` serialises a `WorldTrace` and inlines a minimal viewer (Constellation + Inspector at v1; Heatmap deferred to v2) into one shareable file. No dev server, no build, no deps. Useful for attaching to a PR, sharing in a bug report, or running in CI.

The site and the standalone artifact share the **view widgets** (Constellation graph, Record Inspector cards, Provenance Heatmap grid) — they're authored as framework-agnostic Svelte components in `site/src/lib/explorer/widgets/`, and the `writeExplorer` writer inlines a pre-built bundle of them. The trace JSON shape (`WorldTrace`) is the contract between producer and consumer.

> **Per §10 Q5: site `/explorer` is v1; `world.writeExplorer(path)` deferred to Phase 4 v2.**

### Salvage from `playground/`

Most of the playground workspace is **not salvageable** (see §2 inventory). The narrow exceptions:

- **`playground/src/lib/field-types.ts`** (11 kB) — UI-facing field-type catalogue. The Inspector's per-field rendering may want similar "if Zod type is `string` show as inline text; if `Date` show as ISO with tooltip; if `enum` show the chosen member with the available pool on hover" rules. The catalogue is a starting point, not a copy-paste.
- **`playground/src/lib/codegen.ts`** (16 kB) — string-build pattern for emitting a self-contained TypeScript file from app state. The shape (a writer that inlines templates and produces a complete artifact) is analogous to `world.writeExplorer(path)`'s job of emitting a complete HTML file. **Reference only** — `writeExplorer` builds HTML, not TypeScript, and the inlined viewer bundle is built once at library-publish time, not regenerated per call.

Everything else (state, schema-builder, output, the playground components) is discarded.

### Library-side work

The Explorer requires significant new library API surface. This work **must precede** the site exposing it. The work below should be filed as separate backlog cards (see §9 — Recommended library-side cards).

#### v1 (Phase 4a)

- **`world.trace(): WorldTrace`** — a new public method on `World` that returns the full provenance structure for everything generated so far. Reuses the existing `FieldResolution` tagged union (`src/pipeline.ts`) and `explain` strings (`src/explain.ts`) — the vocabulary already exists; the work is *capturing* it per-record instead of discarding it after each generation.
- **`WorldTrace` / `TraceNode` / `TraceField` / `TraceEdge` types** — new public types in `src/types.ts` (or a new `src/trace.ts`). Plain JSON-serializable. Stable surface — once shipped, the shape is part of the public contract because the standalone HTML artifact embeds it.
- **Provenance capture sink** — wired into `generateObjectFields` (per-field resolution) / `walkPipeline` (sibling reads via `ctx.current`) / `ctx.related` (relation pick records). Per §10 Q4: opt-in at v1 via `createWorld({ trace: true })`. Always-on flip becomes a v2 ADR once a regression-free hot-path benchmark exists.
- **Stable record IDs exposed via `TraceNode.id`** — the internal `reg0#3` / `dreg1#2` IDs are computed for PRNG seeding (`src/world/engine.ts`) but never exposed. The Explorer needs them stable and friendly. Per §10 Q3: friendly `person#1` IDs. Per-registration display name from `defineSubjectType(name, ...)`.

#### v2 (Phase 4 v2)

- **`world.writeExplorer(path)` HTML artifact writer** — serialises a `WorldTrace` + inlines a pre-built viewer bundle (the same Constellation/Inspector widgets the site uses, built once at library-publish time) into one HTML file. Zero runtime deps. Requires a build pipeline change: the library's published tarball now ships a `dist/explorer-viewer.html.tpl` (or similar) that `writeExplorer` reads and templates the trace JSON into.

### Site-side work

- **`/explorer` route** — `+page.svelte` mounts the three view widgets. Chrome composed from `@dxlbnl/ui`: `Container` (page width), `Nav` (top bar — already there from Phase 1), `Tabs` (view switcher: Constellation / Inspector / Heatmap), `Card` (per-view chrome), `Stack`/`Inline` for layout, `Alert` for the "paste your schema or import your `world.ts`" entry-point banner.
- **Domain widgets in `site/src/lib/explorer/widgets/`** (stay custom, not absorbed into `@dxlbnl/ui` — see §8):
  - `ConstellationGraph.svelte` — graph render. Likely uses a small graph library (`d3-force` or hand-rolled SVG); the exact choice is a non-blocking question (§11).
  - `RecordInspector.svelte` — JSON-ish field cards with provenance chips.
  - `ProvenanceHeatmap.svelte` — grid render. Plain CSS grid + colour-coded cells.
  - `ProvenanceChip.svelte` — the chip primitive, reused across Inspector and Heatmap.
- **Trace ingestion** — `/explorer` needs a way to get a `WorldTrace`. Two modes:
  1. **Inline mode** — user pastes schemas / imports their `world.ts` source, the page evaluates it via the same mdsvex playground pattern (`new Function`/IIFE), and calls `world.trace()` to produce the trace. Stays in-browser.
  2. **Upload mode** — user pastes a `WorldTrace` JSON they generated locally (`writeExplorer` already produces this in the standalone HTML; we expose `world.trace()` for direct JSON access). For users with private schemas they don't want to evaluate in a hosted page.
  Both modes are recommended; the entry-point banner offers both.
- **No persistence** — the Explorer is a viewer, not a builder. No save state, no seed history, no exports beyond "download this trace as JSON" and "open in standalone `world.html`".

### Out of scope for v1

These are flagged in the brainstorm but explicitly deferred:

- **Seed diff** (two seeds side by side, highlight changed records/fields).
- **Replay scrubber** (walk birth order; press play and watch the universe assemble).
- **Invariant/graph plugin** (post-hoc relational checks, Cypher/GraphML bridge to Neo4j).
- **Shape-profile plugin** (anonymised real-data → statistical bias).

All four are excellent v2/v3 directions; none block v1.

---

## 7. Comparison surface

The site needs **two** comparison touchpoints, both rendering content that B83 generates:

### `/comparison` (new)

A page-length comparison narrative:

- **Feature matrix** — replaces the matrices currently duplicated in `/+page.svelte`, `site/content/docs/comparison.md`, and `wiki/product/differentiators.md`. Driven by `site/src/lib/comparison/matrix.ts` — a single canonical data module B83's report can extend. Rendered with `@dxlbnl/ui`'s `Table` (or a custom component built on it that supports tri-state cells: ✓ / ✗ / partial / na).
- **Per-library narrative** — one card per competitor (`@anatine/zod-mock`, `@faker-js/faker`, `zod-fixture`, `zod-mock`, etc. as B83 fills in). Each card has install command, last-publish badge, link out, "when to use this instead" copy. Rendered with `@dxlbnl/ui`'s `Card` + `KvList` + `TagPill` (for status: active / unmaintained / Zod v4 / Zod v3 / no-schema).
- **Speed summary** — cites `bench/results/latest.json` per D17. Three `StatCard`s: "vs `@anatine/zod-mock`: 2.7–5.2× faster", "vs hand-coded faker: competitive (faker wins on user/nested tiers)", "vs <new B83 entrant>: TBD". Honest framing per D20 — no "fastest", no "faster than the alternatives".
- **Honest framing `Alert`** — a banner-form `@dxlbnl/ui` `Alert` at the top of the comparison page reads: "Benchmark numbers below cite the CLI baseline at `bench/results/latest.json` (snapshot date X, zod4-mock@Y). Browser numbers on `/bench` are qualitative."

### `/bench`

Stays the live in-browser benchmark, but rebuilt:

- **Worker-based** (B69) — `Worker` imports the runner libs + schemas, posts `BenchResult` messages back. Main thread renders `@dxlbnl/ui` `ProgressBar`s per (lib × schema) cell.
- **Time-budget** (B71) — replaces `runs=20` with "run each cell for ~500 ms; report ops/sec from the count".
- **Unified schemas** (B70) — same `simple`/`user`/`nested` (or B83's extended set) as the CLI. Removes the "browser nested ≠ CLI nested" hazard.
- **Progress + Abort** (B73) — `ProgressBar` + `Button("Abort")` that calls `worker.terminate()`. Partial results stay rendered.
- **Cold-start metric** (B72) — recommend **(b) remove from browser**, keep only on the CLI tier where 1k warmup makes it meaningful. Display nothing on `/bench`. Honest framing per D20.
- **Header card** cites the CLI baseline (one `StatCard`) so any visitor immediately sees the citable numbers without scrolling.

### Data flow from B83

B83 produces `wiki/research/reports/zod-mock-ecosystem-survey.md` plus a recommended runner list. Three artefacts feed the rebuild:

1. `site/src/lib/comparison/matrix.ts` — the canonical feature matrix data, edited to add B83's libraries.
2. `site/src/lib/comparison/libraries.ts` — per-library metadata (`name`, `npm`, `repo`, `lastPublished`, `zodVersion`, `deterministic`, `schemaDriven`, `narrative`).
3. `site/src/lib/runners/<lib>.ts` — one new runner stub per B83-recommended addition. Each implements `{ flat, nested, array, batch(schema, n) }`. CLI `bench/perf.test.ts` and browser worker both consume them.

The B83 report is treated as a **black box input**: this design doesn't presume which libraries it will recommend. It does presume that B83 supplies *(a)* the matrix rows, *(b)* per-library copy, and *(c)* a yes/no on benching for each.

---

## 8. `@dxlbnl/ui` adoption plan

### Inventory map

| Current site component (`site/src/lib/components/`) | `@dxlbnl/ui` equivalent | Verdict |
| --- | --- | --- |
| `Foundations/Color.stories.svelte` | `tokens/tokens.css` (Phosphor/Paper) | **Replace** — delete the foundations stories; rely on the library's Storybook for token docs. |
| `Foundations/Typography.stories.svelte` | `tokens/typography.css` + `Heading`/`Text` | **Replace**. |
| `Foundations/Spacing.stories.svelte` | `--u`/`--u2`/… scale from library tokens | **Replace**. |
| `Primitives/Button.svelte` | `Button` | **Replace**. |
| `Primitives/Input.svelte` | `Input` / `InputWrap` / `Field` | **Replace**. |
| `Primitives/RangeSlider.svelte` (log-scale) | **gap** — no equivalent | **Keep**, restyle on tokens. |
| `Primitives/SegmentedControl.svelte` | **gap** — `Tabs` is close but not identical | **Keep** or merge into `Tabs`. Decision: replace with `Tabs` where the use is tab-like (showcase entity picker); keep `SegmentedControl` only where it's a true grouped-radio (bench schema picker). |
| `Bench/BenchChart.svelte` (Chart.js) | **gap** | **Keep**, restyle. |
| `Bench/MetricBadge.svelte` | `StatCard` (close) or `TagPill` | **Replace with StatCard** for ops/sec + numeric value; `TagPill` for cold-start label. |
| `Bench/WinnerCallout.svelte` | `Alert` (success variant) | **Replace**. |
| `Bench/LibraryLegend.svelte` | `KvList` with colour swatches | **Replace** (custom render of `KvList`). |
| `Showcase/CodePanel.svelte` (Shiki tabs) | `Tabs` (chrome) + Shiki body | **Replace tab chrome with `Tabs`**; keep Shiki render layer. |
| `Showcase/JsonTree.svelte` (recursive + ID highlight) | **gap** | **Keep** — domain widget. |
| `Showcase/RelationCallout.svelte` (proof rows) | `KvList` close, but proof rows want their own affordance | **Keep** as a thin wrapper around `KvList`, or build natively on `KvList`. |
| `Table/DataTable.svelte` | `Table` | **Replace**. |
| `Table/TimingBadge.svelte` | `StatCard` (compact) | **Replace**. |
| `Surfaces/FeatureMatrix.svelte` | `Table` (with custom cell renderer for ✓/✗/partial) | **Replace, customise cell**. |
| `Surfaces/SummaryCard.svelte` | `StatCard` | **Replace**. |
| `Docs/CodeBlock.svelte` (copy button) | `Card` + `Button` + `toast()` | **Replace** (wraps Shiki output in `Card`; `Button` calls `toast()`). |
| `Docs/Editor.svelte` (CodeMirror 6 host) | **gap** | **Keep** — domain widget. Used by doc-fence `SchemaPlayground` and by Explorer's inline-mode entry-point. |
| `Docs/SchemaPlayground.svelte` | **gap** | **Keep** — small in-doc fence component for `getting-started.md` / `api.md` examples. Stays at its current scope (155 lines, `new Function` evaluator). **No longer** replaced by an absorbed playground workspace — that direction is dropped. |
| `+layout.svelte` topbar | `Nav` | **Replace**. |
| `+page.svelte` hero | `PageHero` + `CtaBlock` + `Button` | **Replace**. |
| `/docs` sidebar layout | `Accordion` + `Stack` | **Replace**. |
| **Explorer widgets** (new — `site/src/lib/explorer/widgets/{ConstellationGraph,RecordInspector,ProvenanceHeatmap,ProvenanceChip}.svelte`) | **gap** | **Keep as domain widgets** — these stay in `site/`, not absorbed into `@dxlbnl/ui`. The library's `writeExplorer` HTML artifact inlines the same widgets (built once at library-publish time). |

### Migration order

1. **Token migration first.** Import `@dxlbnl/ui/tokens/tokens.css` + `tokens/typography.css` in `site/src/lib/styles/app.css`; delete `site/src/lib/styles/tokens.css`. Map the few site-specific tokens that aren't in the library (`--lib-zod4mock`, `--lib-zodmock`, `--lib-faker`) into `app.css` as identity-color extensions. This unlocks Phosphor (dark, default) and Paper (light, B76 closes by default).
2. **Layout chrome.** Replace `+layout.svelte` with `Nav` + `Container` + `Stack`. Replace `+page.svelte`'s hero block with `PageHero` + `CtaBlock`.
3. **Primitive replacement.** `Button` (every callsite), `Input` (none on the site today, but lands when forms appear), `Card`, `StatCard` (replaces `SummaryCard`), `Tabs` (replaces tab chromes).
4. **Patterns & surfaces.** `Alert` for the honest-framing banner on `/comparison` and the deprecation banner on `/table` until it goes away. `KvList` for proof rows. `Toast` + `toast()` for copy-confirmation (closes B77 via primitive).
5. **Domain widgets stay.** `JsonTree`, `Editor`, `BenchChart`, `RangeSlider`, `SchemaPlayground` (kept at current scope — the in-doc fence component, not a full builder). These live in `site/src/lib/widgets/` (new directory replacing `site/src/lib/components/`). The **Explorer widgets** — `ConstellationGraph`, `RecordInspector`, `ProvenanceHeatmap`, `ProvenanceChip` — live alongside in `site/src/lib/explorer/widgets/` and are explicitly **not** candidates for `@dxlbnl/ui` absorption (they're zod4-mock-domain; the library's `writeExplorer` inlines them).
6. **Storybook collapse.** `site/.storybook` keeps stories only for the **domain widgets** (including the Explorer widgets); primitives/foundations stories delete in favour of `@dxlbnl/ui`'s upstream Storybook. Closes B78 by reducing the footprint.

---

## 9. Phasing

### Classification of inbox cards

| Card | Classification | One-line reasoning |
| --- | --- | --- |
| **B58-B** Dutch inflection | **Independent** | Library/locale work, unrelated to site rebuild. |
| **B69** /bench Web Worker | **Lands as Phase 3** | Bench rebuild lands with the comparison surface; worker is its core. |
| **B70** Unify CLI+browser schemas | **Lands as Phase 3** | Same — paired with worker. |
| **B71** Time-budget bench | **Lands as Phase 3** | Same — paired with worker. |
| **B72** Cold-start metric | **Obsoleted** | Rebuild removes cold-start from `/bench` (option b); closed by the design itself. |
| **B73** Progress + Abort on /bench | **Lands as Phase 3** | Part of the worker rebuild — `ProgressBar` per cell, `Abort` calls `worker.terminate()`. |
| **B74** Sync vision version + bench baseline | **Lands as Phase 5** | A copy refresh + bench re-run; pairs naturally with polish. |
| **B75** Playwright smoke tests | **Lands as Phase 5** | Wires after the routes settle so the assertion set is stable. |
| **B76** Light theme QA | **Obsoleted by Phase 1** | `@dxlbnl/ui` ships Phosphor + Paper as a tested pair; site adopts both via tokens. Theme-toggle plumbing is a thin follow-up (could be a small chore card if maintainer wants a toggle in `Nav`). Closes via Phase 1. |
| **B77** Install copy button | **Lands as Phase 5** | `@dxlbnl/ui`'s `Toast` + `Button` makes this trivial after the primitive swap. |
| **B78** Storybook coverage audit | **Lands as Phase 5** | After primitives migrate to `@dxlbnl/ui`, the site's Storybook is much smaller; the audit lands against the *post-migration* surface (including the new Explorer widgets). |
| **B79** DS scope | **Obsoleted by Phase 1 (already marked superseded by B84)** | Answered by adopting `@dxlbnl/ui`. Closes via Phase 1. |
| **B80** Playground integration (A/B/C) | **Obsoleted by Phase 4 (already marked absorbed by B84)** | Answered by redirect: option C (deprecate) — Explorer replaces what schema-builder gave. Closes when Phase 4 ships and the `playground/` workspace is deleted. |
| **B81** Link sweep | **Lands as Phase 2** | Naturally absorbed when docs are re-routed via `import.meta.glob('/docs/*.md')`; any surviving links get swept then. |
| **B82** Vercel deploy from `site/` | **Independent (maintainer task)** | Out-of-tree action; not blocked by the rebuild, but should be done **before** Phase 1 ships to make iteration visible. |
| **B83** Ecosystem survey | **Consumed as Phase 3 input** | Feeds `/comparison`. Status now: B83 has returned (per redirect); content is ready to flow into Phase 3. |

### Implementation order (5 phases, each shippable)

**Phase 1 — Foundation (`@dxlbnl/ui` adoption + IA scaffold + delete `/table`)**
- Add `@dxlbnl/ui@^1.1.1` to `site/package.json` (npm dep — confirmed by maintainer).
- Import `tokens.css` + `typography.css` in `app.css`; delete `site/src/lib/styles/tokens.css` (keep identity color extensions).
- Swap layout chrome (`+layout.svelte` → `Nav` + `Container`), `+page.svelte` hero (`PageHero` + `CtaBlock`), primitives (`Button`, `Card`, `StatCard`, `Tabs` where applicable).
- Add nav entries for `/comparison`, `/explorer` (route stub, content lands in Phase 4), `/showcase` (kept), `/bench` (kept); **delete the `/table` route** (confirmed).
- Verify Phosphor/Paper switch via `data-palette` works across all routes — defaults to Phosphor; toggle deferred.
- Ship: site visually transitions to `@dxlbnl/ui`; functional content unchanged. (closes B76; closes B79; closes B80 partially — full close at Phase 4.)

**Phase 2 — Docs system (gated on B94)**

The hybrid recommendation in §5 was rejected. Phase 2 is gated on
[B94 (docs system design)](../../backlog/inbox/B94-docs-system-design.md) landing.

When B94's recommendation is approved:

- The route stub from Phase 1 (`/docs`) gets replaced by whatever authoring path B94 picks.
- B81 (link sweep) folds in naturally when docs own their URLs.
- D5, D17, D18, D19 honoured per B94's authoring-path-specific successor rules.

Phase 1 can ship without Phase 2 landing — the `/docs` route stays a stub until B94's
implementation cards complete. **Phase 1 → Phase 3 → Phase 4 → Phase 5 do not block on
Phase 2** under this gating; the manager runs B94 in parallel with the implementation
sequence and slots Phase 2 in when ready.

**Phase 3 — Comparison surface + Bench rebuild**
- Add `site/src/lib/comparison/{matrix,libraries}.ts` data modules; populate from B83's report. Render at `/comparison` using `Table` + `Card` + `KvList` + `Alert` for the honest framing.
- Add new runner stubs `site/src/lib/runners/<lib>.ts` for any B83-recommended additions; implements `{ flat, nested, array, batch(schema, n) }`. CLI and browser worker both consume.
- Rebuild `/bench`: Web Worker (B69), unify schemas with CLI (B70), switch `measure()` to time-budget (B71), add `ProgressBar` + `Abort` (B73). Remove cold-start from browser surface (B72 closed).
- Ship: `/comparison` and the rebuilt `/bench` are both live; the comparison surface has a destination; bench is honest and responsive. (closes B69, B70, B71, B72, B73; consumes B83.)

**Phase 4 — World Explorer**

> **Phase 4 has two sub-phases. The library-side work must complete before the site-side work begins.**

**Phase 4a — Library-side API v1 (`world.trace()` + capture sinks + stable IDs; `writeExplorer` deferred to v2)**
Filed as separate backlog cards (see "Recommended library-side cards" below). These ship as library work in `src/`, get their own changesets, and update `docs/api-reference.md` per D5. The site does not depend on them until 4b.

**Phase 4b — Site-side `/explorer` route**
- Build `site/src/lib/explorer/widgets/{ConstellationGraph,RecordInspector,ProvenanceHeatmap,ProvenanceChip}.svelte`. Stories alongside.
- Wire `/explorer` route to mount the three widgets behind a `Tabs` view switcher. Inline-mode entry-point (paste schema or import `world.ts`) + upload-mode entry-point (paste `WorldTrace` JSON).
- Standalone HTML artifact deferred to Phase 4 v2 per §10 Q5; widgets stay site-only at v1.
- **Delete the `playground/` workspace** from the monorepo (its `package.json`, `.storybook`, `vite.config.ts` etc.); remove from `pnpm-workspace.yaml`. The Explorer replaces what schema-builder gave the user, plus more.
- Ship: `/explorer` is live; users can see the universe their schemas build. (closes B80.)

**Phase 5 — Polish**
- Playwright smoke suite hitting `/`, `/docs/getting-started`, `/explorer`, `/comparison`, `/showcase`, `/bench` (B75).
- Storybook coverage audit on the post-migration component set, including the Explorer widgets (B78); most foundations/primitives stories were deleted in Phase 1.
- Copy-to-clipboard buttons on install snippets in `docs/getting-started.md` via `@dxlbnl/ui` `Button` + `toast()` (B77).
- B74 (version baseline refresh) lands here — re-run `pnpm site:bench` against the live workspace and update copy.
- Ship: site is full, tested, and quality-polished. (closes B74, B75, B77, B78.)

**Independent tracks (do not gate the phases above)**
- B82 — Maintainer reconfigures Vercel to deploy `site/`. Should land before Phase 1 visibility is needed.
- B58-B — Library work, parallel.

### Recommended library-side cards (to file before Phase 4 begins)

The manager should `/intake` these into the backlog ahead of Phase 4. Sizes are rough; titles are starting points; B-numbers are illustrative (the manager assigns final numbers at filing time).

- **B85: `world.trace()` API + `WorldTrace` types** — `feature`, full-track. Add `world.trace(): WorldTrace` public method. Define `WorldTrace`/`TraceNode`/`TraceField`/`TraceEdge` types in `src/types.ts` (or new `src/trace.ts`). JSON-serializable. Update `docs/api-reference.md` per D5. No provenance capture yet — empty trace stub that returns nodes from the registry with stable IDs and value, no field/edge data. Establishes the public surface so 4b can start sketching against it. Includes ADR + Rule (the trace shape is a stable contract).
- **B86: Provenance capture sink (per-field resolution + sibling reads)** — `feature`, full-track. Thread a capture sink through `generateObjectFields` and `walkPipeline` so the `FieldResolution` already produced per field is recorded into a `TraceField` (with `resolution.kind`, `generator`, `reason`, `forkKey`, `overridden`, `dependsOn`). Behind an opt-in flag at v1 (`createWorld({ trace: true })` or similar). Hot-path benchmark must show no regression when flag is off.
- **B87: Relation edge capture sink (`ctx.related` picks)** — `feature`, full-track. Record relation picks (`from`/`fromField`/`to`/`relation`/`kind`/`poolSize`/`pickedIndex`) into `TraceEdge` as `ctx.related` runs. Same opt-in flag as B86.
- **B88: Stable record IDs exposed via `TraceNode.id`** — `feature`, full-track. Surface the internal `reg0#3` IDs as friendly `person#1` via a per-registration display-name source (`defineSubjectType(name, schema)` already has the name). Resolves the brainstorm's open Q1.
- **B90: Explorer view widgets (Constellation / Inspector / Heatmap)** — `feature`, full-track, **site-side card** but listed here because its dependency on B85–B88 makes it the gating site-side card for Phase 4b. Builds `ConstellationGraph`, `RecordInspector`, `ProvenanceHeatmap`, `ProvenanceChip` in `site/src/lib/explorer/widgets/` and the `/explorer` route. The widgets stay site-only at v1 (per §10 Q5 answer).
- **B89: `world.writeExplorer(path)` HTML artifact writer** — `feature`, **deferred to Phase 4 v2**. Per §10 Q5 answer: site `/explorer` is sufficient at v1; the standalone HTML artifact (with a viewer bundle inlined by the library build) lands after the site widgets stabilise.

Optional / out-of-scope-but-named for the manager's awareness:

- **B91: Seed diff + replay scrubber (Explorer v2)** — `feature`. Deferred per §6.
- **B92: Invariant/graph plugin** — `feature`, plugin-track. Deferred per §6 and the brainstorm.
- **B93: Shape-profile plugin** — `research`-then-`feature`. Deferred per §6 and the brainstorm.

---

## 10. Blocking questions

These need maintainer answers before implementation cards can be filed.

1. **`@dxlbnl/ui` license.** **ANSWERED 2026-06-03**: maintainer is the vendor. License question is moot for the dep relationship; site README credits the maintainer's own package. License field in the package's `package.json` can be set whenever the maintainer next publishes.
2. **Should `@dxlbnl/ui` move into this monorepo as a workspace?** **ANSWERED 2026-06-03**: npm dep, confirmed. Maintainer-as-vendor means gap iterations (tri-state `FeatureMatrix` cell, log-scale `RangeSlider`, Constellation graph primitives if shareable) publish from the maintainer's `@dxlbnl/ui` workspace; site consumes the next version.
3. **Stable record ID display scheme.** **ANSWERED 2026-06-03**: friendly (`person#1`). Per-registration display name from `defineSubjectType(name, ...)`. Bind into B88's public API contract.
4. **Provenance capture: always-on vs opt-in flag?** **ANSWERED 2026-06-03**: opt-in at v1 (`createWorld({ trace: true })`). Flip to always-on becomes a v2 ADR once we have a regression-free hot-path benchmark.
5. **Standalone `world.html` artifact — v1 deliverable or v2 of the Explorer?** **ANSWERED 2026-06-03**: site `/explorer` only at v1. `writeExplorer` deferred to Phase 4 v2. Removes B89 from the v1 library card stack — the library tarball stays unchanged shape.
6. **B83 (ecosystem survey) — confirm content is ready.** **ANSWERED 2026-06-03**: closed at commit `1b3c816`. `wiki/research/reports/zod-mock-ecosystem-survey.md` is final.
7. **Vercel deploy (B82) order.** **ANSWERED 2026-06-03**: after Phase 1 ships. Deploy URL is **`zod4-mock.vercel.app`** (not `gen-bench.vercel.app` — site rebrands with the merge).

## 11. Non-blocking questions (recommended answer baked in)

1. **Theme toggle in the `Nav`?** Recommended: yes — small `Button` in `Nav` that toggles `<html data-palette="phosphor|paper">`, persisted to `localStorage`. Adds ~20 lines. (Default remains Phosphor.)
2. **Search engine?** Recommended: `pagefind` — fully static, works with adapter-vercel prerender, no JS runtime auth, ~50 kB. Alternative `flexsearch` is fine but requires a hand-built index.
3. **`SchemaPlayground` evaluator** — the in-doc fence component keeps its current `new Function(...)` IIFE approach. The Explorer's inline-mode entry-point uses the same pattern (paste schema, evaluate, call `world.trace()`). One evaluator, two consumers.
4. **Default Storybook target.** Recommended: keep the site's Storybook only for **domain widgets** (`JsonTree`, `BenchChart`, `RelationCallout`, `Editor`, `FeatureMatrix`, plus the Explorer widgets `ConstellationGraph`, `RecordInspector`, `ProvenanceHeatmap`, `ProvenanceChip`). All primitives/patterns stories delegate upstream to `@dxlbnl/ui`'s Storybook.
5. **`html.light` cleanup.** Recommended: remove `html.light { … }` from `app.css` after token migration — it's superseded by `data-palette="paper"` from `@dxlbnl/ui`.
6. **Identity colours.** Recommended: keep `--lib-zod4mock`, `--lib-zodmock`, `--lib-faker` (+ any B83 additions) in `site/src/lib/styles/identity.css`, layered on top of the library's `tokens.css`. They're domain identity, not theme. The Explorer needs its own resolution-rung colour palette (`--rung-matcher`, `--rung-key-based`, `--rung-schema-based`, `--rung-override`, `--rung-default`, `--rung-absent`) layered the same way; recommended: extend `identity.css` with a `Resolution rungs` section.
7. **Comparison page caching.** Recommended: prerender (`export const prerender = true`) — the matrix + library data is build-time; only `/bench` and `/explorer` need runtime JS heavy lifting.
8. **Honest-framing banner on `/bench`.** Recommended: top-of-page `Alert` (info variant) saying "Browser numbers are qualitative. The citable baseline is `bench/results/latest.json` (snapshot YYYY-MM-DD, zod4-mock@X.Y.Z)." Honours D17/D20.
9. **Constellation graph library.** Recommended: start with `d3-force` (lightweight, well-known, force-directed layout matches the "galaxies of records" mental model). Alternative: hand-rolled SVG with a simple grid-by-SubjectType layout for v1 to avoid the dep, switch to `d3-force` if/when force layout is needed. Decide at the B90 spec-writing stage.
10. **Trace JSON download from `/explorer`.** Recommended: a `Button` in the inline-mode entry-point that calls `world.trace()` and downloads the JSON via a Blob URL. Trivially useful for "share this with someone." Adds maybe 20 lines.
11. **Resolution-rung colour scheme.** Recommended: green = `matcher`/`keymap` (intentional), teal = `key-based` (realistic heuristic), amber = `override`/`default` (pinned or wrapper-default), grey = `schema-based` (raw fallback), dashed/faded = `absent`. Maps directly to the brainstorm's "realism ratio" mental model.
12. **Trace size cap.** Recommended: no hard cap at v1; document the rough cost ("traces ~scale with `count × avg-fields-per-record`; expect ~1 kB/record for typical schemas"). If traces over some threshold (say 10 MB) become common, add a `world.trace({ maxNodes })` knob at v2.

---

## See also

- [B84 — Site architecture rebuild](../../backlog/doing/B84-site-architecture-rebuild.md) — the card this report answers.
- [B83 — Zod mock ecosystem survey](../../backlog/doing/B83-zod-mock-ecosystem-survey.md) — feeds `/comparison`.
- [wiki/research/world-explorer.md](../world-explorer.md) — the brainstorm that drives §6.
- [wiki/site/vision.md](../../site/vision.md) — the positioning the rebuild must protect.
- [wiki/site/benchmark-methodology.md](../../site/benchmark-methodology.md) — what `/bench` honours per D17/D20.
- [wiki/site/architecture.md](../../site/architecture.md) — site-specific stack (SvelteKit 2 + mdsvex + Shiki + Chart.js + CodeMirror).
- [wiki/architecture.md](../../architecture.md) — Rules D5, D17, D18, D19, D20 bind the surfaces.
- [wiki/product/{vision,differentiators,audience}.md](../../product/) — what the homepage funnel sells.
