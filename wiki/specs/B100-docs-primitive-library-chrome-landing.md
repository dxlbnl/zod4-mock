# B100: Docs primitive library + chrome + landing

## Context

B100 is the first implementation card of the docs system designed in
[B94](../backlog/done/B94-docs-system-design.md) and elaborated in
[wiki/research/reports/docs-system-design.md](../research/reports/docs-system-design.md).
That report rejected both a flat `mdsvex` render of `docs/*.md` and Astro Starlight,
and recommended building the docs site as a **bespoke SvelteKit `/docs/*` route tree**
backed by a small **vocabulary of doc primitives** layered on `@dxlbnl/ui`. B100 ships
that v1 vocabulary, the typed sidebar chrome, the `/docs` landing, and replaces the
existing `import.meta.glob('/content/docs/*.md')` route with placeholder pages that
defer their structured content to subsequent cards (B101 rebuilds Getting Started +
Concepts; B102 ships the structured API + parity guard; B104 wires Pagefind search).

The card itself: [wiki/backlog/doing/B100-docs-primitive-library-chrome-landing.md](../backlog/doing/B100-docs-primitive-library-chrome-landing.md).

Source material:

- `wiki/research/reports/docs-system-design.md` §4 (Interactive content surfaces)
  enumerates each v1 primitive and the D18 successor rule text.
- §7 (Phasing recommendation → Card 1) lists the scope and acceptance criteria.
- §6 (Sync with `docs/`) explains the rebuild boundary B100 hits and B102 closes:
  B100 stubs the not-yet-rebuilt routes back to `docs/*.md` so D5 is preserved until
  each route earns its structured replacement.
- `wiki/site/architecture.md` pins the site stack (SvelteKit 2 + Svelte 5 runes + mdsvex
  - Storybook 10 + Playwright via `@vitest/browser-playwright`).
- `@dxlbnl/ui` (`/home/dexter/Projects/Web/dxlb-ui/docs/`) exposes `Container`,
  `Stack`, `Prose`, `Card`, `StatCard`, `Alert`, `PageHero`, `Tabs`, `Button`,
  `Inline`, `Grid` — the doc primitives compose these.

Binding standing constraints this card complies with:

- **D1** — no `any` in any new code; new relative imports use `.js` extensions.
- **D13** — site code does not import `node:*` modules or rely on Node-only globals;
  `<Playground>` and any other primitive that touches `window`/`document` is mounted
  client-side only (covered by the new D18 successor rule below).
- **D17 / D20** — honest framing for speed claims is enforced by the `<SpeedClaim>`
  primitive's required `source` prop (TypeScript rejects an undecorated claim).
- **D18 (original)** — mdsvex `playground` code fences remain base64-encoded; any
  `+page.md` doc route the project keeps continues to use the encode-and-hydrate
  pattern in `site/svelte.config.js`. The successor rule introduced by this card
  (B100-R12) generalises the same SSR-safety contract to `+page.svelte`-imported
  editor primitives — it does not replace D18 for the mdsvex path.
- **D19** — `/docs` becomes a real prerendered landing page; the homepage `/` and its
  CTAs are untouched.
- **D21** — all new doc primitives live in the existing `@layer site` (or compose
  `@dxlbnl/ui` components that own their `@layer dxlbnl` styles); no new layer is
  introduced.
- **D5** — B100 does **not** change D5. Stub routes for `concepts`, `key-heuristics`,
  `recipes`, `zod4-schema-coverage`, and `bugs` link to the canonical `docs/<file>.md`
  so the published reference remains the source of truth for those surfaces until
  B102 lands. The existing `/docs/getting-started`, `/docs/api`, `/docs/relational`,
  `/docs/comparison` routes (which today render via the mdsvex glob) lose their
  glob page in B100 and are replaced with the same `<DocPage>` placeholder pattern
  pointing at `docs/getting-started.md` / `docs/api-reference.md` (B101/B102 rebuild
  them on the new primitives; `relational` and `comparison` fold into the rebuilt
  pages in B101+). D5 enforcement remains "update `docs/api-reference.md` in the
  same step as a public API change" until B102 amends it.

Package manager: **pnpm** (per `wiki/architecture.md`).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

Requirements are grouped by area. Each primitive lives in
`site/src/lib/docs/widgets/<Name>.svelte` and ships a co-located
`<Name>.stories.svelte` following the existing `defineMeta` + `Story` + `play()`
pattern in `site/src/lib/widgets/*.stories.svelte` (e.g.
`SchemaPlayground.stories.svelte`, `WinnerCallout.stories.svelte`).

### B100-R1: `<DocPage>` page shell

The site **MUST** expose a `<DocPage>` primitive at
`site/src/lib/docs/widgets/DocPage.svelte` that wraps page content in
`@dxlbnl/ui`'s `Container` + `Stack` + `Prose`, renders the title as an `<h1>`,
exposes a navigable "On this page" right-rail derived from `<h2>` headings inside
its slot, and emits the prose container with `data-pagefind-body` for B104 search
indexing. The component accepts a typed `Props` object with at minimum:
`title: string`, `sidebarGroup: "concepts" | "reference" | "guides" | "how-to"`,
`order: number`, `prerequisites?: string[]`, `related?: string[]`,
`editPath?: string`.

- Scenario: shell renders title + prose + on-this-page rail
  - GIVEN a route renders `<DocPage title="Getting Started" sidebarGroup="concepts"
order={1}>` with two `<h2>` headings ("Install", "Generate") inside its slot
  - WHEN the page is mounted in a storybook browser test
  - THEN the canvas exposes `getByRole("heading", { level: 1, name: "Getting
Started" })`, the prose container carries the `data-pagefind-body` attribute, and
    `getAllByRole("link")` includes one link per `<h2>` in the right rail with
    `href="#install"` and `href="#generate"` respectively.
- Scenario: edit-on-GitHub link
  - GIVEN `<DocPage editPath="docs/getting-started.md" …>` renders
  - WHEN the storybook play function queries the page
  - THEN `getByRole("link", { name: /edit on github/i })` is present and its
    `href` ends with `docs/getting-started.md`.
- Scenario (UI): page shell ships a Storybook story
  - GIVEN `site/src/lib/docs/widgets/DocPage.stories.svelte` exists
  - WHEN `pnpm site:test:component` (storybook project) runs
  - THEN at least one `Story` for `DocPage` executes its `play()` function
    successfully and asserts both the `<h1>` and the `[data-pagefind-body]`
    attribute on the rendered prose container.

### B100-R2: `<Playground>` rebadge

The site **MUST** expose a `<Playground>` primitive at
`site/src/lib/docs/widgets/Playground.svelte` that re-exports the props contract of
the existing `SchemaPlayground` widget (`{ initialCode?: string }`) and renders
identical output (editor, randomize button, JSON output panel). Construction of
CodeMirror **MUST** be deferred to `onMount`/`if (browser)` so SSR does not
crash (it carries the D18 successor contract codified in B100-R12).

- Scenario: re-exports SchemaPlayground behavior
  - GIVEN `<Playground initialCode="z.string().email()" />` renders
  - WHEN the storybook play function clicks
    `getByRole("button", { name: /randomize/i })`
  - THEN a `.cm-editor` element is in the document and a `.output` element appears
    with a value.
- Scenario: SSR safe (no `window` at module load)
  - GIVEN `Playground.svelte` is imported into a `+page.svelte` that prerenders
  - WHEN `pnpm site:build` runs against a route that imports `<Playground>`
  - THEN the build succeeds (no `ReferenceError: window is not defined` from the
    primitive's module-load phase).
- Scenario (UI): Playground story present
  - GIVEN `site/src/lib/docs/widgets/Playground.stories.svelte` exists with a
    "Default" story
  - WHEN `pnpm site:test:component` runs
  - THEN the story's `play()` asserts the editor element is present after mount.

### B100-R3: `<SignatureBlock>` — TS signature card

The site **MUST** expose a `<SignatureBlock>` primitive at
`site/src/lib/docs/widgets/SignatureBlock.svelte` that renders, as a `@dxlbnl/ui`
`Card`, a syntax-highlighted TypeScript signature (via the existing Shiki
pipeline already used in `CodeBlock.svelte`), a 1–2-line description, and an
optional inline `<Playground>`. Typed props: `signature: string`,
`description: string`, `playground?: { initialCode: string }`.

- Scenario: signature + description render
  - GIVEN `<SignatureBlock signature="generate(schema: ZodType): unknown"
description="Zero-config entry point." />` renders
  - WHEN the storybook play function queries the canvas
  - THEN the signature text "generate(schema: ZodType): unknown" is in the
    document inside a `<code>` element, and the description text "Zero-config
    entry point." is present.
- Scenario: inline playground when provided
  - GIVEN `<SignatureBlock signature="…" description="…" playground={{
initialCode: "z.string()" }} />` renders
  - WHEN the storybook play function inspects the canvas
  - THEN a `.cm-editor` element is present inside the block.
- Scenario (UI): SignatureBlock story present
  - GIVEN `site/src/lib/docs/widgets/SignatureBlock.stories.svelte` exists
  - WHEN `pnpm site:test:component` runs
  - THEN at least one story's `play()` asserts the signature text and the
    description text.

### B100-R4: `<ParameterTable>` — typed parameter rows

The site **MUST** expose a `<ParameterTable>` primitive at
`site/src/lib/docs/widgets/ParameterTable.svelte` that renders a typed data
prop (no markdown table). Typed shape:

```ts
type ParameterRow = {
  name: string;
  type: string;
  default?: string;
  description: string;
};
type Props = { rows: ReadonlyArray<ParameterRow> };
```

Renders an accessible `<table>` with column headers Name, Type, Default,
Description.

- Scenario: rows render in declared order
  - GIVEN `<ParameterTable rows={[{ name: "seed", type: "number", default:
"undefined", description: "Deterministic seed." }, { name: "store", type:
"boolean", default: "true", description: "Store in registry." }]} />` renders
  - WHEN the storybook play function reads the table
  - THEN `getByRole("table")` is present, `getAllByRole("columnheader")` returns
    four headers with accessible names matching "Name", "Type", "Default",
    "Description", and the first body row's cells include "seed" and the second
    body row's cells include "store" (in that order).
- Scenario: missing default renders an em-dash
  - GIVEN a row with `default` omitted
  - WHEN the table renders
  - THEN the corresponding "Default" cell renders "—" (so screen readers don't
    skip an empty `<td>`).
- Scenario (UI): ParameterTable story present
  - GIVEN `site/src/lib/docs/widgets/ParameterTable.stories.svelte` exists
  - WHEN `pnpm site:test:component` runs
  - THEN a story's `play()` asserts the four column headers by accessible name.

### B100-R5: `<InstallBlock>` — install command with PM switcher

The site **MUST** expose an `<InstallBlock>` primitive at
`site/src/lib/docs/widgets/InstallBlock.svelte` that renders an install command
with a `pnpm` / `npm` / `yarn` / `bun` segmented switcher, persists the selected
PM in `localStorage` under the key `zod4-mock:install-pm`, and exposes a copy
button that copies the active command and triggers a transient toast. Typed prop:
`pkg: string` (the package list, e.g. `"zod4-mock zod"`). The switcher buttons
**MUST** be real `<button>` elements (or `role="tab"` on a `role="tablist"`) with
visible focus and accessible names — never click-handled `<div>`s.

- Scenario: PM switcher swaps the command
  - GIVEN `<InstallBlock pkg="zod4-mock zod" />` renders with `pnpm` initially
    active
  - WHEN the storybook play function clicks the tab with accessible name "npm"
  - THEN the visible command text changes from `pnpm add zod4-mock zod` to
    `npm install zod4-mock zod`.
- Scenario: PM preference persists across mounts
  - GIVEN the user has clicked the "yarn" tab in a previous mount
  - WHEN a fresh `<InstallBlock>` mounts in the same browser context
  - THEN the visible command starts on `yarn add zod4-mock zod` (the
    `localStorage` value `zod4-mock:install-pm` reads `"yarn"`).
- Scenario: keyboard activates the switcher
  - GIVEN `<InstallBlock pkg="zod4-mock zod" />` has rendered and a tab has
    keyboard focus
  - WHEN the play function presses `ArrowRight` then `Enter` (or `Space`) on the
    next tab
  - THEN the focused tab activates, the visible command swaps, and the active
    tab's `aria-selected` (or focused state) is observably set.
- Scenario: copy + toast
  - GIVEN `<InstallBlock pkg="zod4-mock zod" />` renders
  - WHEN the play function clicks `getByRole("button", { name: /copy/i })`
  - THEN a transient element with text matching `/copied/i` appears in the
    document (the toast).
- Scenario (UI): InstallBlock story present
  - GIVEN `site/src/lib/docs/widgets/InstallBlock.stories.svelte` exists
  - WHEN `pnpm site:test:component` runs
  - THEN a story's `play()` asserts the four PM tabs by accessible name and
    asserts the copy-button accessible name.

### B100-R6: `<SpeedClaim>` — honest framing primitive (D17/D20)

The site **MUST** expose a `<SpeedClaim>` primitive at
`site/src/lib/docs/widgets/SpeedClaim.svelte` with a typed `Props` interface
**requiring** all four of `tier`, `value`, `vs`, `source`:

```ts
type SpeedClaimProps = {
  tier: "simple" | "user" | "nested" | "matcher";
  value: string; // e.g. "2.7×"
  vs: string; // e.g. "@anatine/zod-mock"
  source: string; // citation; e.g. "site/bench/results/latest.json"
};
```

The primitive renders as a `@dxlbnl/ui` `StatCard` (or composes one) with the
`value` as the headline number, the `vs` label, and a visible citation line
showing `source`. The `source` prop's type **MUST** be a required (non-optional)
property — TypeScript reports a compile-time error when `<SpeedClaim>` is used
without it.

- Scenario: TypeScript rejects a missing `source` prop
  - GIVEN a test module imports `<SpeedClaim>` and renders it without `source`
    (the test marks the line with `// @ts-expect-error: source is required
(D17/D20)`)
  - WHEN `pnpm site:check` (svelte-check) runs
  - THEN the run completes with zero errors (the `@ts-expect-error` is
    consumed — i.e., the line WOULD have errored without the suppression). A
    parallel scenario WITHOUT `@ts-expect-error` on a `<SpeedClaim>` missing
    `source` **MUST** report a type error from `pnpm site:check`.
- Scenario: rendered value + citation
  - GIVEN `<SpeedClaim tier="user" value="2.7×" vs="@anatine/zod-mock"
source="site/bench/results/latest.json" />` renders
  - WHEN the storybook play function queries the canvas
  - THEN the text "2.7×" is in the document, the text "@anatine/zod-mock" is in
    the document, and the text "site/bench/results/latest.json" is in the
    document (visible citation line satisfying D17).
- Scenario (UI): SpeedClaim story present
  - GIVEN `site/src/lib/docs/widgets/SpeedClaim.stories.svelte` exists
  - WHEN `pnpm site:test:component` runs
  - THEN a story's `play()` asserts the citation line is visible.

### B100-R7: `<DefRef>` — concept tooltip / inline glossary

The site **MUST** expose a `<DefRef>` primitive at
`site/src/lib/docs/widgets/DefRef.svelte` that wraps inline text and emits
`data-pagefind-meta="concept:<term>"` on its rendered element so B104 (Pagefind)
can surface concept hits. Typed props:
`term: string` (also the value used in the data attribute); the slot is the
visible inline text. The element **MUST** be a focusable inline element (e.g.
`<button>` with `aria-describedby` pointing at the tooltip body) so keyboard
users can reach the tooltip.

- Scenario: emits the Pagefind concept meta attribute
  - GIVEN `<DefRef term="determinism">determinism</DefRef>` renders
  - WHEN the storybook play function queries the canvas
  - THEN the visible "determinism" text is wrapped in an element whose
    `data-pagefind-meta` attribute equals `"concept:determinism"`.
- Scenario: keyboard-reachable + accessible name
  - GIVEN the rendered `<DefRef>`
  - WHEN the play function tabs to it
  - THEN the element has an accessible role (`button` or equivalent) and an
    accessible name that includes the `term`.
- Scenario (UI): DefRef story present
  - GIVEN `site/src/lib/docs/widgets/DefRef.stories.svelte` exists
  - WHEN `pnpm site:test:component` runs
  - THEN a story's `play()` asserts the `data-pagefind-meta` attribute on the
    rendered element.

### B100-R8: `<RelatedShowcase>` — embed a `/showcase` slice inline

The site **MUST** expose a `<RelatedShowcase>` primitive at
`site/src/lib/docs/widgets/RelatedShowcase.svelte` that takes a typed
`entity: "review" | "order" | "user" | "product"` prop (the four showcase
entities the existing `/showcase` widgets cover) and renders the `JsonTree` +
`RelationCallout` slice for one entity inline, with a "see the full demo →"
link to `/showcase` carrying that entity's anchor (`/showcase#<entity>`).

- Scenario: renders the entity slice + link
  - GIVEN `<RelatedShowcase entity="review" />` renders
  - WHEN the storybook play function queries the canvas
  - THEN a JSON-tree element is present (DOM contains `.json-tree` or the
    accessible role chosen by the existing widget) and a link with accessible
    name matching `/see the full demo/i` is present with `href="/showcase#review"`.
- Scenario (UI): RelatedShowcase story present
  - GIVEN `site/src/lib/docs/widgets/RelatedShowcase.stories.svelte` exists
  - WHEN `pnpm site:test:component` runs
  - THEN a story's `play()` asserts the "see the full demo" link and its
    `href`.

### B100-R9: `<Prerequisites>` — "what you need to have read" callout

The site **MUST** expose a `<Prerequisites>` primitive at
`site/src/lib/docs/widgets/Prerequisites.svelte` that renders as a `@dxlbnl/ui`
`Alert` of variant `info`, taking a typed `pages: ReadonlyArray<{ href: string;
label: string }>` prop and rendering one accessible link per entry. When `pages`
is empty, the primitive **MUST NOT** render any DOM (the alert is suppressed).

- Scenario: renders one link per page
  - GIVEN `<Prerequisites pages={[{ href: "/docs/concepts", label: "Concepts"
}, { href: "/docs/getting-started", label: "Getting Started" }]} />` renders
  - WHEN the storybook play function queries the canvas
  - THEN `getByRole("link", { name: "Concepts" })` resolves with
    `href="/docs/concepts"` and `getByRole("link", { name: "Getting Started"
})` resolves with `href="/docs/getting-started"`.
- Scenario: empty pages suppresses the alert
  - GIVEN `<Prerequisites pages={[]} />` renders
  - WHEN the storybook play function queries the canvas
  - THEN no element with `role="status"` / `role="note"` (the alert role used by
    `@dxlbnl/ui` `Alert`) is present and no prerequisite-link text is present.
- Scenario (UI): Prerequisites story present
  - GIVEN `site/src/lib/docs/widgets/Prerequisites.stories.svelte` exists
  - WHEN `pnpm site:test:component` runs
  - THEN a story's `play()` asserts at least one prerequisite link by
    accessible name.

### B100-R10: Typed sidebar manifest + layout

The site **MUST** introduce a typed manifest at
`site/src/lib/docs/sidebar.ts` exporting a single readonly `SIDEBAR` constant
of type `ReadonlyArray<SidebarGroup>` where

```ts
type SidebarLink = {
  href: string;
  label: string;
  order: number;
};
type SidebarGroup = {
  id: "concepts" | "reference" | "guides" | "how-to";
  label: string;
  links: ReadonlyArray<SidebarLink>;
};
```

and the route at `site/src/routes/docs/+layout.svelte` **MUST** consume that
manifest (the legacy hand-rolled local `nav` array is removed). The sidebar
**MUST** group entries under their `label`, render each link in `order` order
inside its group, apply an `aria-current="page"` to the link matching the
current pathname, and carry `data-pagefind-ignore` on the `<aside>` chrome so
B104 search does not index the nav.

- Scenario: sidebar.ts shape is statically typed
  - GIVEN a vitest unit test in `site/src/lib/docs/sidebar.test.ts` imports
    `SIDEBAR` and asserts at runtime that every `links` array is sorted by
    `order` and that each `id` is one of the four allowed group ids
  - WHEN `pnpm site:test:unit` runs
  - THEN the test passes (and any future addition that breaks the shape fails
    `pnpm site:check` at compile time).
- Scenario: layout consumes the manifest
  - GIVEN the layout renders at `/docs/getting-started`
  - WHEN a storybook component test (or Playwright smoke) opens the layout
  - THEN the sidebar `<aside>` carries `data-pagefind-ignore`, every link
    listed in `SIDEBAR` is present in the DOM by accessible name, and the
    link whose `href` matches `/docs/getting-started` has
    `aria-current="page"`.
- Scenario: legacy `nav` array is gone
  - GIVEN the working tree after B100
  - WHEN `Grep` is run for the literal token `const nav = [` over
    `site/src/routes/docs/+layout.svelte`
  - THEN it returns zero matches.

### B100-R11: `/docs` landing replaces the 307 redirect

The site **MUST** replace `site/src/routes/docs/+page.ts` (the current
`redirect(307, "/docs/getting-started")`) with a real
`site/src/routes/docs/+page.svelte` that renders a card-grid of the four
`SIDEBAR` groups, each card linking into its first entry. The landing route is
itself a `<DocPage>` (with `sidebarGroup: "concepts"`, `order: 0`, no
prerequisites) so the chrome is consistent.

- Scenario: `/docs` is a 200 (not a 307)
  - GIVEN the prerendered SvelteKit build
  - WHEN a Playwright (or component-test) request is made for `/docs`
  - THEN the response is rendered (no redirect chain) and the page exposes
    `getByRole("heading", { level: 1 })` with the docs landing title.
- Scenario: card-grid links into each section
  - GIVEN `/docs` renders
  - WHEN the storybook play function queries the canvas
  - THEN four cards are present (one per `SIDEBAR` group), each card's primary
    link's `href` equals the first link inside that group, and each card's
    accessible name includes that group's `label`.
- Scenario: the old `+page.ts` is removed
  - GIVEN the working tree after B100
  - WHEN `Glob` is run for `site/src/routes/docs/+page.ts`
  - THEN no file is returned.

### B100-R12: D18 successor rule — SSR-safe editor mounting (architecture Rule)

The site **MUST** log a successor rule to D18 as a new ADR in
`wiki/decisions.md` with the following normative text:

> Any docs primitive that mounts an editor or other `window`-touching widget
> **MUST** defer construction to `onMount` (or behind an `if (browser)` guard)
> and **MUST NOT** touch `window`/`document` at module load. The `<Playground>`
> primitive is the reference implementation.

The ADR **MUST** name `<Playground>` as the reference implementation, note that
D18 (the original mdsvex playground-fence rule) remains in effect for any
`+page.md` routes the project keeps, and indicate it is the manager's job to
promote a one-line RFC-2119 rule to `wiki/architecture.md` Rules at item-close
time (per the Vibin workflow).

- Scenario: ADR landed in `wiki/decisions.md`
  - GIVEN the working tree after B100
  - WHEN `Grep` is run for the literal text `Any docs primitive that mounts an
editor` over `wiki/decisions.md`
  - THEN the match is present inside an ADR-formatted entry (a `## D<n>:`
    heading, a "Decision", and a "Rule added/changed" field), and the entry
    references `<Playground>` as the reference implementation.
- Scenario: D18 original still applies to mdsvex routes
  - GIVEN the ADR is read by the reviewer
  - WHEN the reviewer searches the ADR for the phrase "mdsvex" or
    "`+page.md`"
  - THEN the entry contains a sentence noting that D18 (original) remains in
    effect for those routes (B100 does not supersede it).

### B100-R13: Stub routes preserve D5 for not-yet-rebuilt pages

The site **MUST** provide a `+page.svelte` at each of the following routes,
each rendering a `<DocPage>` with a placeholder body containing exactly one
visible "canonical reference" link to the listed `docs/<file>.md` (so D5 is
preserved until each page is rebuilt in a follow-up card):

| Route                        | `<DocPage>` group | Links to                          |
| ---------------------------- | ----------------- | --------------------------------- |
| `/docs/concepts`             | `concepts`        | `docs/concepts.md`                |
| `/docs/key-heuristics`       | `reference`       | `docs/key-heuristics.md`          |
| `/docs/recipes`              | `guides`          | `docs/recipes.md`                 |
| `/docs/zod4-schema-coverage` | `reference`       | `docs/zod4-schema-coverage.md`    |
| `/docs/bugs`                 | `reference`       | `docs/bugs.md`                    |
| `/docs/getting-started`      | `concepts`        | `docs/getting-started.md`         |
| `/docs/api`                  | `reference`       | `docs/api-reference.md`           |
| `/docs/relational`           | `guides`          | `docs/api-reference.md#relations` |
| `/docs/comparison`           | `reference`       | `docs/api-reference.md`           |

(Rationale: the existing `/docs/getting-started`, `/docs/api`, `/docs/relational`,
`/docs/comparison` routes today render `site/content/docs/*.md` via the
mdsvex glob. That glob page is deleted in B100-R14, so the four routes
**MUST** be stubbed at this card and rebuilt structurally in B101 (Getting
Started + Concepts) and B102 (API + parity guard). `relational` and
`comparison` either merge into the rebuilt pages or get their own follow-up;
see "Out of scope".)

- Scenario: each stub renders a canonical link
  - GIVEN the working tree after B100
  - WHEN a storybook component test (or Playwright route check) navigates to,
    e.g., `/docs/concepts`
  - THEN the page renders, `getByRole("heading", { level: 1 })` resolves, and
    `getByRole("link", { name: /canonical reference/i })` resolves with `href`
    ending in `docs/concepts.md`.
- Scenario: every stubbed route exists
  - GIVEN the working tree after B100
  - WHEN `Glob` is run for `site/src/routes/docs/*/+page.svelte`
  - THEN the result includes one entry for each of the nine listed routes.

### B100-R14: Deletions

The site **MUST** delete the following files (the mdsvex-glob page and the
markdown sources it consumed):

- `site/src/routes/docs/[slug]/+page.svelte`
- `site/src/routes/docs/[slug]/+page.ts`
- `site/content/docs/api.md`
- `site/content/docs/comparison.md`
- `site/content/docs/getting-started.md`
- `site/content/docs/relational.md`

(Per the research report and the card, the `site/content/docs/` directory
itself becomes empty and is removed.)

- Scenario: deletions land
  - GIVEN the working tree after B100
  - WHEN `Glob` is run for `site/content/docs/*` and for
    `site/src/routes/docs/[slug]/*`
  - THEN both globs return zero files.

### B100-R15: Pagefind data attributes primed

The site **MUST** carry `data-pagefind-ignore` on the `<aside>` (sidebar) and
on the layout's top-bar nav chrome (whatever element the
`+layout.svelte` exposes as the nav region), and **MUST** carry
`data-pagefind-body` on the prose container rendered by `<DocPage>`. No
Pagefind index emission or search UI is part of B100 (that ships in B104) —
only the attributes that B104 will rely on.

- Scenario: chrome ignored, prose marked
  - GIVEN a `<DocPage>` renders inside the `+layout.svelte`
  - WHEN a component test (or Playwright DOM query) inspects the rendered HTML
  - THEN the document contains exactly one element with `data-pagefind-body`
    (the prose container), and every `<aside>` element with role
    `complementary` (or the layout-owned sidebar element) carries
    `data-pagefind-ignore`.

## Out of scope

- **Structured Getting Started + Concepts content** — those pages are stubbed
  at B100 and rebuilt on the new primitives in **B101**. Visual fidelity of the
  stubs (beyond "renders, has the link") is not part of B100.
- **Structured API reference + `docs:generate` parity guard** — built in **B102**.
  D5 is **not** amended by B100; it stays "update `docs/api-reference.md` in the
  same step as a public API change" until B102 lands.
- **Pagefind index emission and search UI** — `data-pagefind-ignore` /
  `data-pagefind-body` attributes are primed here, but the Pagefind build step,
  the search box, and the concept-index manifest ship in **B104**.
- **Command palette (⌘K)** — deferred to a post-Pagefind card.
- **Type-aware code blocks** (Monaco / Volar) — deferred per research report §4.
- **Version selector** — deferred per research report §3 ("punt until 1.x").
- **Re-styling `<DocPage>` chrome on the Paper palette** — visual tweaks beyond
  "Storybook smoke test passes on the default Phosphor palette" are out of scope
  for B100; B101 ships Paper-palette visual checks for the first rebuilt pages.
- **Tooltip body content for `<DefRef>`** — B100 ships the structural primitive
  and Pagefind meta; the per-term concept definitions and a stable tooltip body
  pattern can land alongside B101's first concept page.
- **The `<RelatedShowcase>` v2 entities** — only the four entities the existing
  `/showcase` widgets already render are in scope. Adding new ones is a separate
  card.

## Open questions

1. **`<SpeedClaim>` source as a branded type vs plain string (Non-blocking)** —
   the research report §4 floats restricting `source` to "`site/bench/results/latest.json`
   path OR snapshot date+version triple". B100 accepts **any non-empty string** for
   `source` and B102 (when the parity guard lands) is the place to brand it as a
   `Brand<"BenchSnapshotCitation">` that only accepts a path under
   `site/bench/results/` or a `{ date, version }` shape. Recorded; not blocking.

2. **Storybook pattern (Non-blocking)** — B100 follows the existing
   `B95-home.stories.svelte` / `SchemaPlayground.stories.svelte` shape (`defineMeta`
   - `Story` + `play({ canvasElement })` with `within` / `expect` / `userEvent`).
     No updated convention was found; if one lands before B100 implements, the
     primitives match it. Recorded; not blocking.

3. **Pagefind emission timing (Non-blocking, already answered on the card)** —
   B100 emits the data attributes only; the Pagefind index build and search UI
   ship in B104. The card states this explicitly; recording for transparency.

4. **`/docs/relational` and `/docs/comparison` placement post-rebuild
   (Non-blocking)** — B100 stubs both routes as placeholders pointing at
   `docs/api-reference.md` (the closest published reference). Whether they become
   standalone pages on the new primitives, or fold into `/docs/api` / a new
   recipes section, is a B101+ decision. Recorded; not blocking.

5. **Stub of `/docs/getting-started`, `/docs/api`, `/docs/comparison`,
   `/docs/relational` vs leaving them on the old glob renderer (Non-blocking)** —
   the card text reads: "Existing `/docs/getting-started`, `/docs/api`,
   `/docs/relational`, `/docs/comparison` either get rebuilt in B101/B102 or stay
   as-is at this card." Since B100-R14 deletes the `[slug]` glob page and the
   `site/content/docs/*.md` sources those routes read from, "stay as-is" is not
   actually available — the old renderer is gone the moment the glob page is
   deleted. The spec therefore stubs all four under B100-R13, leaving the
   structural rebuild to B101 (Getting Started) and B102 (API). Recorded as a
   resolved-by-construction question.

No blocking open questions.

## Acceptance (concrete pass/fail signals)

The reviewer **MUST** verify all of the following on the working tree:

1. **`pnpm site:check`** (svelte-check) is green and includes the
   `// @ts-expect-error` line in the `<SpeedClaim>` type-level test (B100-R6
   scenario 1). The reviewer adds a temporary local mutation to confirm the
   line errors when the suppression is removed; reverts before completing
   review.
2. **`pnpm site:test:unit`** is green — the `sidebar.ts` shape test (B100-R10
   scenario 1) and any other unit tests added pass.
3. **`pnpm site:test:component`** is green — every primitive's
   `.stories.svelte` `play()` function passes in the headless Chromium browser.
4. **`pnpm site:storybook`** build completes — Storybook indexes all nine new
   stories under `site/src/lib/docs/widgets/`.
5. **`pnpm validate`** (root cross-workspace gate: typecheck + test + lint +
   fmt:check) is green.
6. **`/docs`** renders the landing card-grid (no 307); `/docs/+page.ts` is
   absent (B100-R11).
7. **`site/src/routes/docs/+layout.svelte`** consumes `SIDEBAR` from
   `site/src/lib/docs/sidebar.ts`; no `const nav = [` literal remains in the
   layout (B100-R10).
8. **`site/content/docs/`** and **`site/src/routes/docs/[slug]/`** are gone
   (B100-R14).
9. Each of the nine stub routes in B100-R13 renders and exposes the canonical
   link to its `docs/*.md`.
10. `wiki/decisions.md` carries the D18 successor ADR (B100-R12). The reviewer
    confirms the ADR exists and is well-formed; the **manager** promotes the
    one-line rule to `wiki/architecture.md` Rules at item-close time per the
    Vibin workflow (the spec-writer does **not** edit the Rules section here).
11. The `<Playground>`-on-`/docs/api`-style SSR check (B100-R2 scenario 2)
    succeeds: a `pnpm site:build` against any route that imports `<Playground>`
    completes without a Node-side `window is not defined`.
