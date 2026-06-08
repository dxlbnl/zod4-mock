# B126: Code samples → Shiki + Twoslash (type-checked, clickable types link into the API reference)

## Context

B126 makes the docs **code samples** first-class: rendered through **Shiki + Twoslash**
so a sample is (1) syntax-highlighted, (2) **type-checked at build time** against the real
`zod4-mock` types — an invalid sample (undefined symbol, missing import, type error) **fails
the build** — and (3) carries **clickable type tokens that link into the TypeDoc `/docs/api`
reference** B125 shipped. This is plan item 2 of the maintainer-approved docs-UX rework
[wiki/research/reports/docs-ux-rework.md](../research/reports/docs-ux-rework.md) (§"Code
samples = Shiki + Twoslash" and §"Spike result"), the load-bearing seam of which was proven
against the real library. The item card:
[wiki/backlog/doing/B126-twoslash-code-samples.md](../backlog/doing/B126-twoslash-code-samples.md).

B126 **depends on B125** ([B125-typedoc-api-reference.md](B125-typedoc-api-reference.md)).
B125 produced the artifacts B126 joins against: the TypeDoc **JSON model** with member
`sources.{fileName,line}` resolving against `src/` (B125-R2), the `/docs/api` page with
`#<Symbol>` and `#<Symbol>.<member>` anchors (B125-R6, the link **target**), the
`site/src/lib/docs/api/api-model.generated.ts` render model carrying those anchors, the
**dangling-link guard** (`site/scripts/api-link-guard.ts`, B125-R8), and the dual-theme
(`github-light` / `github-dark-dimmed`) Shiki call in `site/svelte.config.js` (B125-R16
highlighted `/docs/api` code through the same theme config). B126 **reuses the existing Shiki
call** as the seam — the spike's mapping wraps a twoslash token in an `<a>` via
`@shikijs/twoslash`'s `rendererRich().nodeStaticInfo` hook, joining the token's declaration
`file:line` (from a TS language service `getDefinitionAtPosition`) to the TypeDoc JSON
`sources.{fileName,line}` index, deriving the `/docs/api#anchor` URL.

### The load-bearing integration fact (where samples live today)

Today the docs **guide** pages (`/docs/getting-started`, `/docs/concepts`, …) render code as
**hand-written `<pre><code>` blocks inside their `+page.svelte` routes** (see
`site/src/routes/docs/getting-started/+page.svelte` — `step1Code` string and the many literal
`<pre><code>…</code></pre>` blocks), **not** as mdsvex `.md` code fences. The mdsvex Shiki
highlighter in `site/svelte.config.js` (`highlight.highlighter` → `codeToHtml`) only runs over
`.md` fences. So those hand-written guide blocks currently reach **no** highlighter at all.
B126 must therefore define **how a guide sample reaches the Shiki+Twoslash transformer** — by
converting the relevant guide code to a mechanism that runs through Shiki/Twoslash, or by
providing a build-time-highlighted code component the routes use. This spec pins the
**observable contract** (a docs code sample renders through the Shiki+Twoslash transformer,
is type-checked, and its type tokens link to `/docs/api`) and leaves the **mechanism** to the
implementer (see Open questions Q1 — non-blocking).

### The src-vs-dist gotcha (must be encoded)

The TS language service that resolves each token's declaration `file:line` **MUST** agree with
TypeDoc on **src-vs-dist**. B125 resolved this by a TypeDoc-specific tsconfig `paths` entry
(`zod4-mock` → `src/index.ts`, see `site/typedoc.tsconfig.json`); the twoslash program must
resolve `zod4-mock` to the **same** `src/index.ts` view, or the `file:line` join silently
yields **0 links** and every "clickable type" requirement passes vacuously (highlighted, but
no links). The "no dead links AND ≥1 real link" form of B126-R3/R4 below is deliberate: it
fails both the dangling-link regression and the silent zero-link regression.

### Folds in / closes B109 and B112 item 2/3

Per the card and the plan's Keep/revert table: B126 **does** the B109 Shiki-highlighting work
(via the Twoslash transformer) and **closes B112 item 2 and item 3** (docs code rendering).
The manager closes/folds B109 and B112 item 2/3 at item-close.

### Build-time-only (D13-exempt)

`@shikijs/twoslash` and `twoslash` are **build-time** devDependencies (they run during the
site build, like `typedoc` / `pagefind` / `ts-morph` before it). Nothing from twoslash enters
the **shipped library** (`dist/`) or the **site client bundle** — the transformer runs at
build, the emitted HTML is plain serializable markup. This is a new standing constraint
(code samples are Twoslash-type-checked; build-time only) — its ADR rationale is recorded in
`wiki/decisions.md` and the manager promotes the one-line Rule at item-close (B126-R8); the
spec-writer/implementer **MUST NOT** edit the `architecture.md` Rules section directly.

### Binding standing constraints this card complies with

- **D1** — no `any` in the twoslash transformer wiring, the token→anchor join, the highlight
  call, the new code component, or any test; new relative imports use `.js` extensions.
- **D13** — `@shikijs/twoslash` + `twoslash` are build-time only; nothing twoslash ships in the
  library `dist/` or the site client bundle. Any data module the `/docs/api`-adjacent render
  imports stays plain runtime-agnostic data (no `node:*`).
- **D18 / D22** — the mdsvex `playground` code-fence branch (base64 placeholder, SSR-safe
  client mount) **MUST** stay intact; B126's transformer addition **MUST NOT** route a
  `playground`-meta fence through twoslash or break its hydration.
- **D21** — any new code-sample component composes `@dxlbnl/ui` primitives in `@layer site`.
- **D25** — the `/docs` subtree stays prerendered; the Pagefind index continues to index the
  prerendered guide HTML. B126's highlighted/linked samples are static HTML in that prerender.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B126-R1: `@shikijs/twoslash` + `twoslash` are build-time devDependencies, slotted into the existing Shiki call

The repo **MUST** add `@shikijs/twoslash` and `twoslash` as **build-time devDependencies** and
wire the twoslash transformer into the site's **existing** Shiki highlighting path (the
`site/svelte.config.js` mdsvex `highlight.highlighter` / `codeToHtml` seam, and/or the
build-time `codeToHtml` used to highlight committed docs samples) — a transformer addition,
not a new pipeline — with **nothing** from `twoslash` entering the shipped library `dist/` or
the site client bundle.

- Scenario: deps present and build-time only
  - GIVEN the working tree after B126
  - WHEN `package.json` dependency sections are inspected and the shipped library build runs
  - THEN `@shikijs/twoslash` and `twoslash` appear under `devDependencies` (not `dependencies`),
    they are referenced only from build-time site code (the Shiki highlighter / a build-time
    highlight step), and `Grep` finds no import of `@shikijs/twoslash` or `twoslash` from any
    `src/` library module or any client-bundled `+page.svelte`/`$lib` runtime module.
- Scenario: transformer extends the existing Shiki call, playground branch intact
  - GIVEN the existing `site/svelte.config.js` highlighter with its `meta?.includes("playground")`
    base64-placeholder branch and its `codeToHtml({ themes: { light: "github-light", dark:
"github-dark-dimmed" } })` branch
  - WHEN the highlighter is invoked with `meta` containing `playground`
  - THEN it still returns the `data-playground="<base64>"` placeholder (the twoslash transformer
    is NOT applied to a playground fence; D18 preserved), and a non-playground TypeScript sample
    is highlighted through the same dual-theme `codeToHtml`/`codeToHast` call now carrying the
    twoslash transformer.

### B126-R2: A docs code sample that does not type-check fails the build

A docs code sample run through the Twoslash transformer **MUST** be type-checked at build time
against the real `zod4-mock` types, and a sample that does not compile — an undefined symbol
(e.g. an undeclared `UserSchema`), a missing import, or a type error — **MUST** fail the build
(non-zero exit), naming the offending sample/diagnostic.

- Scenario: a broken sample fails the build
  - GIVEN the in-sync state where every committed docs sample type-checks and the build passes
  - WHEN a docs sample is mutated to reference an undefined symbol (or drop a required import, or
    introduce a type error) in a fixture or test mutation
  - THEN the build (the twoslash highlight step) exits non-zero and the failure names the
    sample and the twoslash/TS diagnostic, and reverting the mutation makes the build pass again
    (proving the type-check is load-bearing, not skipped).
- Scenario: a valid sample type-checks against the real types
  - GIVEN a docs sample that imports `generate` / `createWorld` from `zod4-mock` and uses them
    correctly against a schema declared in the same sample
  - WHEN the twoslash highlight step runs
  - THEN it completes with no diagnostic for that sample and emits highlighted output.

### B126-R3: Type tokens in a sample are clickable links into `/docs/api`, with no dead links and ≥1 real link

A documented type/symbol token in a rendered docs sample (e.g. `generate`, `createWorld`,
`GenerateOptions`, `World`) **MUST** render as a clickable `<a>` whose `href` resolves to that
symbol's `/docs/api` entry/anchor (`/docs/api#<Symbol>` or `/docs/api#<Symbol>.<member>`),
**and** the rendered output **MUST** contain at least one such resolved link (it is not enough
that there are zero dead links — the src-vs-dist join must actually yield links).

- Scenario (UI): a `generate` token links to its reference entry
  - GIVEN the prerendered build of a guide page whose lead sample imports and calls `generate`
    from `zod4-mock`
  - WHEN the page loads in a real browser and the `generate` token in that sample is located
  - THEN the token is an `<a>` whose `href` resolves to the `/docs/api` `generate` entry
    (`/docs/api#generate` or the model's equivalent anchor) and the target element exists on
    `/docs/api`, with no `console.error` / `pageerror` during load.
- Scenario: the join yields ≥1 link and zero dead links
  - GIVEN the twoslash token → `getDefinitionAtPosition` `file:line` → TypeDoc JSON
    `sources.{fileName,line}` → `/docs/api#anchor` mapping for a representative sample
  - WHEN the mapping runs at build time
  - THEN it produces **at least one** `<a>` type-link whose anchor exists in the B125 anchor set
    (`#<Symbol>` / `#<Symbol>.<member>`), and **every** emitted type-link's anchor exists in that
    set (zero dead links) — so the silent zero-link failure mode and the dangling-link failure
    mode are both excluded.

### B126-R4: The src-vs-dist join is `src`-aligned so the language service and TypeDoc agree

The TS language service used to resolve each token's declaration location **MUST** resolve
`zod4-mock` to the **same `src/index.ts` view** TypeDoc uses (via tsconfig `paths`, mirroring
`site/typedoc.tsconfig.json`'s `zod4-mock` → `./src/index.ts`), so a token's `file:line`
matches a TypeDoc `sources.fileName` under `src/` rather than under `node_modules`/`dist`.

- Scenario: a resolved token location points into `src/`
  - GIVEN the twoslash program / language service configured for the docs samples
  - WHEN a documented token's declaration location is resolved via `getDefinitionAtPosition`
  - THEN the resolved `fileName` points into the package's `src/` (not `node_modules` and not
    `dist`), matching the `fileName` shape in the TypeDoc JSON `sources`, so the join key aligns
    and the link is produced (a fixture asserting a `node_modules`/`dist` path here fails).

### B126-R5: A documented sample renders syntax-highlighted with the existing dual theme

A docs code sample routed through the transformer **MUST** render syntax-highlighted via Shiki
using the site's existing dual themes (`github-light` / `github-dark-dimmed`, palette-switched),
so the sample is colored token markup, not plain `<pre>` text, and toggling the palette switches
token colors.

- Scenario (UI): a guide sample is highlighted and palette-aware
  - GIVEN the prerendered build of a guide page with a transformer-routed TypeScript sample
  - WHEN a code region of that sample is inspected in a real browser
  - THEN at least one Shiki token `<span>` carrying a color style is present (the sample is not
    plain un-highlighted `<pre>` text), and toggling the palette switches the rendered token
    colors (the `--shiki-light` / `--shiki-dark` variables resolve per palette), with no
    `console.error` / `pageerror` during load.

### B126-R6: Twoslash type-links extend (don't regress) the build-time dangling-link guard

The build-time dangling-link guard (B125's `site/scripts/api-link-guard.ts`, or an extension of
it covering the sample type-links) **MUST** stay green for the standing tree and **MUST** fail
the build if a docs-sample type-link points at a `/docs/api` anchor that does not exist — so a
twoslash-emitted dead type-link cannot ship silently.

- Scenario: a deliberately broken sample type-link fails the guard
  - GIVEN the in-sync state where every emitted sample type-link resolves to a real `/docs/api`
    anchor and the guard passes
  - WHEN a sample type-link's target anchor is removed/renamed (in a fixture or test mutation) so
    the link points at a now-missing anchor
  - THEN the guard exits non-zero and names the offending link/anchor, and restoring the target
    makes it pass again.
- Scenario: clean tree passes the guard in the standing gate
  - GIVEN the in-sync tree
  - WHEN the guard runs as part of `pnpm build` (and/or `site:check`)
  - THEN it exits 0 and the build prerenders with no dangling-link failure.

### B126-R7: A warm twoslasher program is reused for build speed

The twoslash highlight step **SHOULD** reuse a single warm twoslasher program / language-service
instance across all docs samples in one build rather than constructing a fresh program per
sample, so highlighting many samples does not pay per-sample program-creation cost.

- Scenario: one program instance services all samples
  - GIVEN the build-time twoslash highlight step
  - WHEN it highlights more than one docs sample in a single build run
  - THEN it constructs the twoslasher/program once (e.g. a module-scope `createTwoslasher()` or a
    cached instance) and reuses it for every subsequent sample — assertable in unit-level test by
    observing a single construction across multiple highlight calls.

### B126-R8: The Twoslash standing constraint is recorded in decisions.md

This card **MUST** record an ADR in `wiki/decisions.md` capturing the standing constraint (docs
code samples are Shiki+Twoslash-rendered and **type-checked at build time**; `@shikijs/twoslash`

- `twoslash` are build-time/D13-exempt devDependencies; the type-link join is `src`-aligned),
  with a "Rule added/changed" field carrying the one-line wording the **manager** promotes into
  `architecture.md`'s Rules at item-close. The spec-writer/implementer **MUST NOT** edit the Rules
  section directly.

* Scenario: ADR present in decisions.md
  - GIVEN the working tree after B126
  - WHEN `Grep` is run over `wiki/decisions.md`
  - THEN a dated ADR entry exists naming Twoslash as the docs code-sample type-checker, recording
    `@shikijs/twoslash` + `twoslash` as build-time (D13-exempt) devDependencies and the
    `src`-aligned type-link join, and carrying a "Rule added/changed" field with the one-line
    Rule the manager will promote.

### B126-R9: Gates stay green and the build prerenders

The standing validation and site gates **MUST** stay green after B126: `pnpm build` prerenders
the `/docs` subtree (with the twoslash type-check + dangling-link guard passing), `pnpm validate`
and `site:check` pass, the existing `/docs` route smoke (B75) stays green, and Pagefind still
indexes the prerendered guide HTML (D25).

- Scenario: full gate is green
  - GIVEN the working tree after B126
  - WHEN `pnpm build`, `pnpm validate`, `pnpm site:check`, and the B75 `/docs` route smoke run
  - THEN each completes successfully — the build prerenders the guide pages and `/docs/api` with
    the twoslash type-check and dangling-link guard passing, `validate`/`site:check` exit 0, and
    the affected guide routes load with no `console.error`/`pageerror`.

## Out of scope

- **Getting Started content rewrite** (variations-not-steps, drop `SpeedClaim` + v3/v4 noise) —
  that is plan item 3 / **B127**. B126 makes the sample-rendering mechanism (highlight + type-check
  - type-links) work and applies it to the guide samples; it does **not** rewrite the guide prose
    or restructure Getting Started.
- **`/docs/api` signature highlighting** — already shipped in **B125-R16** (Shiki dual-theme on
  `/docs/api` signatures and `@example` code). B126 **MAY** reuse the same `sources`-join to make
  `/docs/api` `@example` tokens clickable if trivial, but its contract is the **prose-guide**
  samples; `/docs/api`'s own highlighting is not re-specified here.
- **The `<Playground>` / CodeMirror editor** — the interactive editor (D18/D22) is unrelated to
  the static highlighted sample path; B126 must not route playground fences through twoslash.
- **The manager's `architecture.md` Rules edit** — promoted by the manager at item-close
  (B126-R8 records the ADR; the manager edits the Rules).
- **Concepts / remaining guide pages content pass** — plan item 6 (later items); B126 establishes
  the mechanism, not a full content sweep beyond making the routed samples valid.

## Open questions

### Q1 — How does a guide sample reach the Shiki+Twoslash transformer? (Non-blocking)

Today the guide pages render code as hand-written `<pre><code>` in `+page.svelte` (e.g.
`site/src/routes/docs/getting-started/+page.svelte`), which reach **no** highlighter. There are
two viable mechanisms: (a) convert the relevant guide code to something that runs through
Shiki/Twoslash (a build-time highlight step over committed sample files / a markdown fence path),
or (b) provide a **build-time-highlighted code component** the routes use (a `<CodeSample>` that
takes the sample source and renders pre-highlighted, twoslash-linked HTML). **Classification:
non-blocking.** The card + plan fix the observable contract (B126-R2/R3/R5: samples render
through the transformer, type-check, and link into `/docs/api`); which mechanism delivers that
is an implementation choice that does not change _what_ is built, and the implementer can pick
either while satisfying the requirements. Recommendation for the implementer: a build-time
`<CodeSample>` component (option b) is the lower-risk fit — it keeps SSR-safety, doesn't require
moving guides to `.md`, and slots the transformer into a single build-time `codeToHtml` call.

### Q2 — Which guide samples are in scope for B126 vs deferred to B127? (Non-blocking)

B127 rewrites Getting Started's content. B126 establishes the mechanism and must apply it to at
least the samples needed to prove the contract (≥1 lead sample with a real `generate`/`createWorld`
type-link). Whether _every_ existing guide block is migrated now or some wait for B127's rewrite
is a sequencing choice. **Classification: non-blocking** — the contract is satisfied by the
mechanism plus ≥1 real linked, type-checked sample; full migration of all guide blocks can ride
B127's content pass. Recommendation: migrate Getting Started's lead sample(s) under B126 to prove
the seam; let B127 fold the remainder into the rewrite.

No blocking open questions.
