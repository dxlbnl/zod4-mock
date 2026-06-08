# B127: Rewrite Getting Started — one full example + self-contained variations, not steps

## Context

Getting Started today (`site/src/routes/docs/getting-started/+page.svelte`) is broken in
**concept**: it is framed as numbered "Step N" sections that don't build on each other, it
uses **undefined symbols** (`UserSchema`, `ProductSchema`, `PersonSchema`, `InvoiceSchema`
are referenced in `<pre><code>` blocks but never declared), most snippets show **no
imports** and are not self-contained, the code blocks are **plain `<pre><code>`** (no
highlighting, no type-check, no type-links), it leads with an unclear `<SpeedClaim>`
("user tier 3.2×") boast, carries "zod v4 — not v3" filler, and runs long (seven steps
incl. derive / transform / localize that belong in Recipes). This page **supersedes B101's**
getting-started page ([B101-docs-rebuild-getting-started-concepts.md](B101-docs-rebuild-getting-started-concepts.md)).

This is **plan item 3** of the maintainer-approved docs-UX rework
([wiki/research/reports/docs-ux-rework.md](../research/reports/docs-ux-rework.md) §"Guides"):

> lead with one complete, self-contained, twoslash'd `generate` example (imports + schema
> shown) → then **variations, not steps** ("another way to do it": seeded world = the options
> primer, matchers, relations) → concise. No `SpeedClaim` boast, no "zod v4 not v3" noise.

Item card: [wiki/backlog/doing/B127-getting-started-rewrite.md](../backlog/doing/B127-getting-started-rewrite.md).

### The mechanism is already established — B127 is content + sample authoring

B127 **does not build new tooling**. The `<CodeSample id="…" />` mechanism is established by
**B126** ([B126-twoslash-code-samples.md](B126-twoslash-code-samples.md)): a sample is
registered by `id` + TS `source` in `site/src/lib/docs/samples.ts`, the build step
(`site/scripts/build-samples.ts`) runs each `source` through Shiki + Twoslash — **type-checking
it against the real `zod4-mock` types** so an invalid sample (undefined symbol, missing import,
type error) **fails the build** (B126-R2) — and emits pre-highlighted, type-linked HTML that
`site/src/lib/docs/widgets/CodeSample.svelte` renders by `id`. Each rendered sample carries
Shiki token `<span>`s (`.shiki`, B126-R5) and clickable type tokens as
`<a class="twoslash-type-link" href="/docs/api#…">` into the **B125** TypeDoc `/docs/api`
reference (B126-R3/R4). The lead sample id `getting-started-lead` already exists in `samples.ts`.

So B127 = (1) **author** the lead sample + the variation samples in `samples.ts` (each must
type-check), and (2) **rewrite the page prose** to reference them by `id` and read as
"one full example + a few self-contained variations." The undefined-symbol problem is killed
**structurally**: because B126 type-checks each `<CodeSample>` sample, an undefined `UserSchema`
in a sample would fail the build — so "every symbol is defined" is enforced by the build, not
just by review.

### Binding standing constraints this card complies with

- **D17 / D20** — speed claims. The `<SpeedClaim>` primitive **stays in the codebase**; it is
  removed from _this page_ (D17/D20 remain constraints, just not surfaced on Getting Started).
  The rewrite introduces no new speed/superlative copy.
- **D18 / D22** — SSR-safety. `<CodeSample>` is build-time-highlighted, SSR-safe markup (no
  `window`/`document` at module load); any `<Playground>` retained mounts after hydration.
- **D21** — site CSS layers; any styling stays in `@layer site` on `@dxlbnl/ui` tokens.
- **D25** — the `/docs` subtree stays prerendered so the page type-checks its samples at build
  and Pagefind keeps indexing the prerendered HTML.
- **D30** — docs code samples are Shiki + Twoslash, type-checked at build (the rule B126 lands);
  every sample B127 authors goes through `<CodeSample>` and obeys it.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B127-R1: The page leads with one complete, self-contained `generate` example through `<CodeSample>`

The rewritten Getting Started page **MUST** lead its body with a single complete,
self-contained `generate` example rendered through `<CodeSample>` (not a plain `<pre><code>`):
the sample **MUST** show its imports, define its entire schema inline, and call `generate`, so a
reader can copy-run it. Being routed through `<CodeSample>` means it is Shiki-highlighted and
build-time type-checked (B126), so it cannot reference an undefined symbol.

- Scenario: the lead sample is a self-contained, type-checked `generate` example
  - GIVEN the rewritten `site/src/lib/docs/samples.ts` and Getting Started page
  - WHEN the lead `<CodeSample>`'s registered `source` is inspected
  - THEN it imports `generate` from `zod4-mock` and `z` from `zod`, declares its schema inline
    (e.g. a `const User = z.object({...})`), and calls `generate` — with no symbol used but
    undeclared — and the build (which type-checks every sample, B126-R2) passes with it present.

- Scenario (UI): the page leads with the rendered, highlighted lead sample
  - GIVEN the prerendered build of `/docs/getting-started`
  - WHEN the page loads in a real browser
  - THEN the first code block in the page body is a `<CodeSample>` (a `figure.code-sample`
    carrying at least one Shiki token `<span>`, i.e. `.shiki` highlighted markup — not a plain
    un-highlighted `<pre>`), and no `console.error` / `pageerror` fires during load.

### B127-R2: After the lead, the page presents self-contained variations — not numbered steps

After the lead example the page **MUST** present its remaining examples as self-contained
**variations** ("another way to do it"), each its own complete `<CodeSample>`, and **MUST NOT**
use "Step N" framing: no heading or body text on the page presents the examples as a numbered,
build-on-each-other sequence (`Step 1`, `Step 2`, …).

- Scenario: no "Step N" framing anywhere on the page
  - GIVEN the rendered `/docs/getting-started` page
  - WHEN its headings and visible text are scanned for the pattern `Step <number>`
    (e.g. `Step 1`, `Step 2`)
  - THEN no such "Step N" heading or label is present.

- Scenario: the variations are each a self-contained `<CodeSample>`
  - GIVEN the rewritten Getting Started page
  - WHEN the page body's code blocks are enumerated
  - THEN each variation example is rendered through `<CodeSample>` (a `figure.code-sample`),
    and the page contains **one lead sample plus at least three variation samples**, each
    referenced by a distinct sample `id` registered in `samples.ts`.

### B127-R3: The variations include a seeded world (the options primer), matchers, and relations

The variations **MUST** include, as self-contained `<CodeSample>` examples, at least: (a) a
**seeded world** — used as the primer that plainly explains the seed and the options you pass
(show what you pass, explain it), (b) **matchers**, and (c) **relations**. Each is a complete,
copy-runnable example with its schema(s) defined inline.

- Scenario: a seeded-world variation with prose explaining the seed/options
  - GIVEN the rewritten page
  - WHEN the seeded-world variation is inspected
  - THEN it is a `<CodeSample>` whose `source` calls `createWorld({ seed: … })` (imports
    `createWorld` from `zod4-mock`, defines its schema inline), and adjacent body prose
    explains the seed plainly (e.g. that the same seed yields the same data) — i.e. it reads as
    the options primer, not as "Step 2".

- Scenario: matchers and relations variations are present and type-checked
  - GIVEN the rewritten page and `samples.ts`
  - WHEN the variation samples are inspected
  - THEN there is a **matchers** `<CodeSample>` (a `withSchema(Schema, { matchers: { … } })`
    example) and a **relations** `<CodeSample>` (a `withSchema(…, { relations: { … } })` +
    `ctx.related(…)` example), each self-contained with its schema(s) defined inline, and the
    build type-checks all of them (B126-R2) — so neither can reference an undefined schema.

### B127-R4: Documented type tokens in the page's samples link into `/docs/api`

The page's samples, rendered through `<CodeSample>`, **MUST** carry at least one documented
type token rendered as a clickable `<a>` link into the `/docs/api` reference (B125 anchors),
with no dead link — i.e. the B126 type-link join actually yields links on this page (it is not
enough that highlighting is present; a documented token must resolve into the reference).

- Scenario (UI): a `generate` / `createWorld` token links to its `/docs/api` entry
  - GIVEN the prerendered build of `/docs/getting-started`
  - WHEN the page loads in a real browser and a documented type token (e.g. `generate` in the
    lead sample or `createWorld` in the seeded-world variation) is located inside a
    `<CodeSample>`
  - THEN that token is an `<a>` whose `href` resolves to its `/docs/api` entry (e.g.
    `/docs/api#generate` / `/docs/api#createWorld` or the model's equivalent anchor) and the
    target exists on `/docs/api` (no dead link), with at least one such resolved `/docs/api#…`
    type-link present on the page and no `console.error` / `pageerror` during load.

### B127-R5: The `<SpeedClaim>` boast and the v3/v4 noise are removed from the page

The rewritten page **MUST NOT** render a `<SpeedClaim>` (the "user tier 3.2×" boast) and
**MUST NOT** carry "zod v4 — not v3" / "not v3" copy (`zod@^4` alone is the dependency
statement). (The `<SpeedClaim>` primitive remains in the codebase for other surfaces; this
requirement is scoped to the Getting Started page.)

- Scenario: no SpeedClaim on the page
  - GIVEN the rewritten `site/src/routes/docs/getting-started/+page.svelte`
  - WHEN its imports and template are inspected, and the rendered page is loaded
  - THEN it neither imports nor renders `<SpeedClaim>`, and the rendered page contains no
    "3.2×" speed boast.

- Scenario: no v3-vs-v4 disclaimer copy
  - GIVEN the rendered `/docs/getting-started` page
  - WHEN its visible text is scanned
  - THEN it contains no "not v3" / "Zod v4 — not v3" disclaimer copy (a bare `zod@^4`
    dependency mention is allowed; the disparaging v3 framing is gone).

### B127-R6: Derive / transform / localize are not on Getting Started

The rewritten Getting Started page **MUST NOT** include the derive (`from:`), transform, and
localization sections that the old page carried as Steps 5–7 — those are out of Getting
Started's scope (their home is Recipes / the API reference). Getting Started stays concise:
one lead example plus the seeded-world / matchers / relations variations.

- Scenario: derive / transform / localize sections are absent from the page
  - GIVEN the rendered `/docs/getting-started` page
  - WHEN its headings and code samples are scanned
  - THEN there is no dedicated derive-from / transform / localize sample or section on the page
    (no `from:`-derived-schema example, no `transform:` example, no `locale:` /
    `@zod4-mock/locale-*` install/usage example as a Getting Started section).

### B127-R7: The e2e suite and validation gates stay green; the build prerenders

After B127 the standing site gates **MUST** stay green: `pnpm site:test:e2e` (the Getting
Started smoke + content assertions) passes, `pnpm validate` passes, and `pnpm build`
prerenders `/docs/getting-started` — which means every `<CodeSample>` it references
type-checks at build (B126-R2). The Getting Started route loads with no
`console.error` / `pageerror`.

- Scenario: gates green and page prerenders
  - GIVEN the working tree after B127
  - WHEN `pnpm site:test:e2e`, `pnpm validate`, and `pnpm build` run
  - THEN each completes successfully — the e2e suite's Getting Started smoke + content tests
    pass, `validate` exits 0, and `pnpm build` prerenders `/docs/getting-started` with all its
    samples type-checking (no twoslash diagnostic), the route loading clean.

### B127-R8: A designer visual pass in both palettes

The rewritten page **SHOULD** pass a designer visual review in **both palettes** (light /
Phosphor and dark / Paper) — readable hierarchy (one lead example, then variations),
highlighted samples legible, no overflow — verified by the reviewer/designer in a real browser
with a screenshot per palette as evidence.

- Scenario (UI): the page reads cleanly in light and dark
  - GIVEN the prerendered `/docs/getting-started` in a real browser at both palettes
  - WHEN the designer reviews each palette
  - THEN the page reads as "one full example + self-contained variations" with the
    `<CodeSample>` blocks highlighted and legible (token colors switch with the palette), no
    horizontal overflow of the code blocks, and no broken layout — captured as a light + dark
    screenshot pair.

## Out of scope

- **The `<CodeSample>` / Shiki + Twoslash mechanism itself** — owned by **B126** (the
  transformer, the type-check-fails-the-build behavior, the token→`/docs/api` join, the
  dangling-link guard). B127 only _authors samples_ into `samples.ts` and _references them_ in
  the page; it does not modify the transformer or the join.
- **The `/docs/api` reference target** — owned by **B125** (TypeDoc member-level render +
  anchors). B127 links into it but does not change it.
- **Derive / transform / localization content** — explicitly removed from Getting Started
  (B127-R6); relocating that material into **Recipes** is a separate content pass (plan item 6),
  not part of this card. B127 only ensures it is _absent_ from Getting Started.
- **Concepts and the remaining guide pages** — plan item 6, separate cards.
- **The `<SpeedClaim>` primitive's existence** — it stays in the codebase (other surfaces may
  use it under D17/D20); B127 only removes it from this page.
- **Removing or rewriting `docs/getting-started.md`** (the committed canonical markdown) — this
  card rewrites the in-site `/docs/getting-started` page; the markdown doc's disposition is not
  in scope here.

## Open questions

### Q1 — Exact set and order of the variations beyond the required three. (Non-blocking)

The contract is fixed as **one lead example + at least three self-contained variations
including seeded-world, matchers, and relations** (B127-R2/R3). Whether the page adds a fourth
small variation (e.g. arrays via `z.array(Schema).min(n)`, or overrides), and the precise order
of the three, is a content/authoring judgment for the implementer/maintainer that does not
change _what_ is built. **Classification: non-blocking** — the requirements pin the floor; the
implementer may add or order within it. Recommendation: order as lead → seeded world (options
primer) → matchers → relations, matching the plan's "seeded world = the options primer" framing.

### Q2 — Whether a live `<Playground>` editor stays on the page. (Non-blocking)

The current page embeds a `<Playground>` after the lead. B127's contract is about the _static_
`<CodeSample>` examples (highlighted, type-checked, type-linked) and reads-as-variations
structure; whether an interactive editor is also retained is an additive content choice that
doesn't affect any B127 requirement. **Classification: non-blocking** — retaining a `<Playground>`
is allowed (it must stay D18/D22 SSR-safe and mount after hydration) but not required by any
B127 requirement. Recommendation: keeping one live editor after the lead is fine and reinforces
"copy-runnable"; it is not mandated.

No blocking open questions — the mechanism (B126) and link target (B125) are established, so
B127's contract is fully specifiable from the wiki.
