# B125: API reference → TypeDoc (member-level), render in-site; delete the bespoke pipeline

## Context

B125 replaces the bespoke `ts-morph` API-docs pipeline (B102, refined by B115 grouping
and B123 TOC nesting) with **TypeDoc**, per the maintainer-approved docs-UX plan
[wiki/research/reports/docs-ux-rework.md](../research/reports/docs-ux-rework.md). The plan
is binding: API reference = TypeDoc, reading `src/index.ts` + the in-source TSDoc, producing
**member-level** documentation natively — functions with their parameters and **each option
expanded** (not the opaque `GenerateOptions<z.infer<TSchema>>`), option/config types
(`GenerateOptions`/`WorldOptions`) with **every field**, interfaces (`World`/`Registry`) with
**every method**, all cross-linked. The card:
[wiki/backlog/doing/B125-typedoc-api-reference.md](../backlog/doing/B125-typedoc-api-reference.md).

### Render shape and option surface, as actually shipped (maintainer-directed, mid-B125)

The reference was built and reviewed live under maintainer direction, which changed two
things this spec now reflects (see `wiki/progress.md` → the B125 / B125-cont. entries):

- **Render shape: heading-per-member, not a table.** Four CSS loops proved a fixed
  4-column options **table** could not read well for this content (long types _and_ long
  prose → column starvation or multi-thousand-pixel rows; unusable at 390px). The
  maintainer pivoted to a **heading-per-member** render (React.dev / TanStack style):
  the symbol is an `h2`, each member (function option, config-type field, interface
  method) is an `h3` whose **name + type sit on one line**, the description as prose
  beneath, deep-linkable per member and nested in the "On this page" rail (DocPage gained
  a gated 2-level `memberToc`). R4/R5/R6 below assert the member-level **entries** rather
  than table rows; the observable intent (every field/option/method listed with type +
  description + a resolvable anchor) is unchanged.

- **Option surface curated (maintainer decision).** Three `GenerateOptions` fields the
  engine threads internally (`source`, `fieldPath`, `prng`) are now `@internal` and
  **excluded** from the reference (TypeDoc `excludeInternal: true`); they keep working by
  structural identity (non-breaking). The **5 fields shared** by `GenerateOptions` and
  `WorldOptions` (`seed`, `optionalProbability`, `defaultArrayLength`, `recursionLimit`,
  `locale`) were extracted into a new exported base interface **`GenerationDefaults`**;
  `WorldOptions extends GenerationDefaults` (own fields: `generators`, `trace`) and
  `GenerateOptions<T> extends GenerationDefaults` (own fields: `overrides`, `transform`,
  `store`, `unique`). The reference renders each type's **own** fields plus a compact
  "Inherited from GenerationDefaults" link row, and documents `GenerationDefaults` once as
  its own symbol. R5/R11 below reflect this curated surface.

### Static `docs/api-reference.md` and the barrel (cross-ref B129)

The static `docs/api-reference.md` is no longer regenerated (it is a committed reference;
`/docs/api` is the canonical living surface). **B129** (run inline under the same
maintainer direction) curated the public barrel: `extend`, `data`, `generateFromSchema`,
`generateFromKey`, and `fieldSeed` **left the `zod4-mock` barrel** (`extend` relocated to
the locale packages; the rest were internal-only). B129 updated `docs/api-reference.md` to
drop the removed symbols and fixed the `{@link}`s that would otherwise dangle. See the
B129 entry in `wiki/progress.md`.

This supersedes the predecessor spec
[B102](B102-docs-structured-api-parity-guard.md) (the `ts-morph` extractor +
`manifest.generated.ts` + `docs/api-reference.md` parity guard) and the two cards that
extended it: **B115** (curated grouping of `/docs/api`) and **B123** (TOC group nesting).
Their machinery (the hand-curated taxonomy, the grouped flat-list render, the per-symbol
`SignatureBlock`/`ParameterTable` widgets, the symbol-localised markdown parity diff) is
deleted: the member-level structure TypeDoc emits natively replaces it. The plan's spike
(report §"Spike result") proved the load-bearing seams against the real library: TypeDoc runs
clean (TS 6, ESM, Zod v4 internals, workspace dep), the **real `src/index.ts` entry resolves
152 nodes vs only 5 via the `node_modules` symlink**, member-level coverage is confirmed
(`GenerateOptions` 12 fields, `WorldOptions` 7, `Registry` 6 methods), and the src-vs-dist join
must agree (map `zod4-mock` → `src/index.ts` via tsconfig `paths`, or point TypeDoc at `dist`)
or the join silently yields 0.

### Why a content gap is in scope (per-field TSDoc)

The plan's "Content gap to close" notes that the option **fields** lacked per-field TSDoc,
so their descriptions rendered blank. As shipped, the documented option surface is the
curated one (above): the 5 shared fields live on **`GenerationDefaults`** (`seed`,
`optionalProbability`, `defaultArrayLength`, `recursionLimit`, `locale`), `GenerateOptions`
adds its own `overrides`, `transform`, `store`, `unique` (with `source`/`fieldPath`/`prng`
`@internal` and out of the documented surface), and `WorldOptions` adds its own `generators`,
`trace`. Every **documented** field (GenerationDefaults' 5 + each type's own) carries a
one-line TSDoc description so no rendered entry is blank. Closing this is authored content,
not tooling.

### Standing-constraint change (flagged for the manager to promote at Done)

This card **amends/supersedes D5 and D24**. Current Rules (`wiki/architecture.md`):

- **D5** (current text): "When a public API changes, the exported symbol's **TSDoc** in `src/`
  **MUST** be updated in the same step; the API manifest and `docs/api-reference.md` are
  regenerated by `pnpm docs:generate` and parity is verified by `pnpm docs:check` … `docs/api-reference.md`
  and `site/src/lib/docs/api/manifest.generated.ts` are generated artifacts and **MUST NOT** be
  hand-edited."
- **D24** (current text): "API-docs signature/JSDoc extraction (the `scripts/docs/` extractor +
  `scripts/docs-generate.ts`) **MUST** use `ts-morph` … not TypeDoc."

After B125: **TSDoc on the exported `src/` symbol stays the prose source of truth** (the D5
same-step obligation survives), but **TypeDoc replaces the `ts-morph` generator and the
`docs:check` parity guard**, so D24 is **superseded** (it now mandates the opposite tool) and
D5's references to `pnpm docs:generate` / `pnpm docs:check` / `manifest.generated.ts` no longer
hold. Per the Vibin workflow the **manager owns** the `architecture.md` Rules edit: the
**implementer** records the ADR rationale in `wiki/decisions.md` and syncs `CLAUDE.md`'s
Documentation rule (B125-R12); the **reviewer** confirms the decision landed; the **manager**
promotes the amended D5 + retires D24 at item-close. The spec-writer and implementer **MUST NOT**
edit the Rules section directly.

### Binding standing constraints this card complies with

- **D1** — no `any` in the TypeDoc config, the in-site render code, the dangling-link guard, the
  per-field TSDoc, or any test; new relative imports use `.js` extensions (Node16 ESM).
- **D13** — `typedoc` is a **build-time** dependency (it runs during the site build, never in the
  shipped library/locale runtime), so it is D13-exempt, exactly as `ts-morph`/`pagefind` are
  today. Any TypeDoc-JSON-derived data module that ships in the **site bundle** (consumed by the
  `/docs/api` `+page.svelte`) **MUST** remain plain, runtime-agnostic data — no `node:*`.
- **D21 / D22** — the in-site render composes `@dxlbnl/ui` primitives in `@layer site`; any
  `window`-touching widget defers to `onMount`. This card adds no new editor widget.
- **D25** — the `/docs` subtree stays prerendered (`export const prerender = true`) and Pagefind
  re-indexes the prerendered `/docs/api` HTML post-`vite build`; B125 must not break that.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B125-R1: TypeDoc is a build-time devDependency and generates against the real `src/index.ts`

The repo **MUST** add `typedoc` as a build-time devDependency and configure it to read the
**real `src/index.ts` entry point of the `zod4-mock` package source** (not the `node_modules`
symlink), emitting a generation that resolves the full public surface.

- Scenario: TypeDoc resolves the real surface, not the symlink stub
  - GIVEN `typedoc` is installed and configured (a committed TypeDoc config — `typedoc.json`,
    or a config file the site build invokes) whose entry point resolves to the package's own
    `src/index.ts`
  - WHEN the TypeDoc generation step runs
  - THEN it completes with zero errors and the produced model contains a top-level project
    node with documented members for the public surface — at minimum `generate`, `createWorld`,
    `GenerateOptions`, `WorldOptions`, `World`, `Registry` — i.e. far more than the ~5 nodes the
    `node_modules` symlink resolves (the spike's symlink-vs-real-path failure mode is absent).

### B125-R2: TypeDoc emits JSON (render data) plus an HTML link target, with locations aligned

TypeDoc **MUST** emit both a **JSON** model (the data the in-site render consumes) and an HTML
output (the stable link target), with member `sources.{fileName,line}` resolving against the
same `src` (not `dist`) view as the in-site render — aligned via tsconfig `paths`
(`zod4-mock` → `src/index.ts`) or by pointing TypeDoc at `dist`, so locations join rather than
silently yielding zero.

- Scenario: JSON model is emitted and parseable
  - GIVEN the configured TypeDoc generation step
  - WHEN it runs as part of the site build
  - THEN a JSON model file is written to a committed/derived path the `/docs/api` render reads,
    and parsing it yields a tree whose member nodes carry `name`, `kind`, and `sources` with a
    `fileName` that points into `src/` (not into `node_modules`), confirming the src-vs-dist
    alignment holds.

### B125-R3: TypeDoc generation runs in the site build before/with `vite build`

The site `build` script **MUST** run the TypeDoc generation as part of `pnpm build` /
`pnpm site:build`, ordered before (or alongside) `vite build` so the JSON model exists when the
`/docs/api` route prerenders, and before the post-build Pagefind index step (D25).

- Scenario: a full site build produces the model and prerenders /docs/api
  - GIVEN a clean working tree
  - WHEN `pnpm site:build` runs
  - THEN the build completes successfully, the TypeDoc JSON model is present, the `/docs/api`
    route prerenders to HTML, and the Pagefind index step still runs afterward (D25 preserved).

### B125-R4: Functions render signature + parameters + each option as its own member entry

The `/docs/api` page **MUST**, for each documented **function** in the model, render its
signature and a parameter list, and where a parameter is an options/config object type, render
that object's fields as **per-member entries** (each option a heading-per-member entry with its
name + type on one line and a description beneath) rather than the opaque type alias name.

- Scenario (UI): `generate` shows expanded option entries, not `GenerateOptions<…>`
  - GIVEN the prerendered build of `/docs/api`
  - WHEN the page loads in a real browser and the `generate` function block is located
  - THEN the block shows `generate`'s signature and its `schema` and `options` parameters, and
    the named option fields of `GenerateOptions` (`overrides`, `transform`, `store`, `unique`,
    and the inherited `seed`) appear as their own member entries (name + type, description
    beneath) — the opaque text `GenerateOptions<z.infer<TSchema>>` is NOT the only rendering of
    the options parameter — with no `console.error` / `pageerror` during load.

### B125-R5: Option/config types list their own fields + an inherited-defaults link; internals excluded

The `/docs/api` page **MUST**, for each documented **option/config type** (`GenerateOptions`,
`WorldOptions`, `GenerationDefaults`, and the other option/config types), render each **own**
field as a member entry (name + type + optionality + TSDoc description), render a compact
"Inherited from `GenerationDefaults`" link row for the 5 shared defaults, and **MUST NOT**
render the `@internal` fields `source`, `fieldPath`, `prng`.

- Scenario: WorldOptions shows its 2 own fields + the inherited-defaults link
  - GIVEN the TypeDoc JSON model and the rendered `/docs/api`
  - WHEN the `WorldOptions` section is queried (component test or Playwright)
  - THEN it enumerates its two own fields — `generators` and `trace` — each with its type and a
    non-empty description and marked optional, plus a "Inherited from `GenerationDefaults`" row
    linking the 5 shared fields (it does NOT re-render all 5 defaults inline as own members).
- Scenario: GenerateOptions shows its 4 own fields + the inherited-defaults link, no internals
  - GIVEN the same model and page
  - WHEN the `GenerateOptions` section is queried
  - THEN it enumerates exactly its four own fields — `overrides`, `transform`, `store`, `unique`
    — each with its type, plus the "Inherited from `GenerationDefaults`" link row; and the
    `@internal` fields `source`, `fieldPath`, and `prng` do NOT appear anywhere in the section.
- Scenario: GenerationDefaults documents the 5 shared fields once
  - GIVEN the same model and page
  - WHEN the `GenerationDefaults` section is queried
  - THEN it enumerates all five shared fields — `seed`, `optionalProbability`,
    `defaultArrayLength`, `recursionLimit`, `locale` — each with its type and a non-empty
    description and marked optional, and the inherited-link rows on `WorldOptions` /
    `GenerateOptions` resolve to these member anchors.

### B125-R6: Interfaces list every method with signature, description, and a working member anchor

The `/docs/api` page **MUST**, for each documented **interface** (`World`, `Registry`), list
**every** declared method with its signature and TSDoc description, and give each method a
resolvable in-page member anchor of the form `#<Symbol>.<member>` (or the model's stable member
anchor scheme) so a deep link to a single method works.

- Scenario (UI): Registry shows its 6 methods with resolvable member links
  - GIVEN the prerendered build of `/docs/api`
  - WHEN the page loads in a real browser and the `Registry` interface block is located
  - THEN all six methods — `store`, `all`, `pick`, `filter`, `find`, `count` — are listed each
    with its signature, and navigating to a member anchor (e.g. `#Registry.pick` or the model's
    equivalent) resolves to that method's entry on the page (the element exists and is scrolled
    into view), with no `console.error` / `pageerror` during load.
- Scenario: World lists every method
  - GIVEN the TypeDoc JSON model and the rendered `/docs/api`
  - WHEN the `World` interface section is queried
  - THEN it lists each declared `World` method (`withSchema`, `withGenerators`, `withKeyMap`,
    `generate`, `get`, `populate`, `populateFrom`, `explain`, `trace`) each carrying a member
    anchor that resolves on the page.

### B125-R7: Every cross-link / `{@link}` resolves to an on-page or on-site anchor

Every type reference and `{@link}` reference rendered on `/docs/api` **MUST** resolve to an
existing anchor (an on-page member anchor or another `/docs/api` / site anchor) — no rendered
cross-reference points at a missing target.

- Scenario: a representative `{@link}` resolves
  - GIVEN the rendered `/docs/api` (e.g. `MatcherCtx`'s description links `{@link GeneratorContext}`,
    or `World.trace` links `{@link WorldTrace}` / `{@link TraceNode}`)
  - WHEN the page is loaded and each rendered cross-reference link's `href` anchor is checked
    against the page's element ids (and site routes)
  - THEN every such link's target anchor exists on the page (or resolves to a real site route) —
    zero dead targets.

### B125-R8: A build-time dangling-link guard fails the build on a dead anchor

The build **MUST** include a dangling-link guard that fails (non-zero exit / failed build) when
any `/docs/api` cross-reference resolves to a missing anchor — so the B119 dead-anchor class of
defect cannot ship silently.

- Scenario: a deliberately broken anchor fails the guard
  - GIVEN the in-sync, all-links-resolve state where the guard passes
  - WHEN a cross-reference target is removed/renamed (in a fixture or test mutation) so a rendered
    link points at a now-missing anchor
  - THEN the guard exits non-zero and names the offending link/anchor, and restoring the target
    makes the guard pass again — proving the guard is load-bearing, not vacuous.
- Scenario: a clean tree passes the guard in the standing gate
  - GIVEN the in-sync tree
  - WHEN the guard runs as part of `pnpm build` (and/or `pnpm validate` / `site:check`)
  - THEN it exits 0 and the build prerenders with no dangling-link failure.

### B125-R9: The bespoke ts-morph pipeline is deleted

The repo **MUST** delete the bespoke API-docs pipeline and its dependencies: the
`scripts/docs/extract.ts` extractor, `scripts/docs/curation.ts`, `scripts/docs-generate.ts`,
`site/src/lib/docs/api/manifest.generated.ts`, the `SignatureBlock.svelte` and
`ParameterTable.svelte` widgets, the old custom `/docs/api/+page.svelte` renderer, the root
`docs:generate` / `docs:check` scripts (and `docs:check` from the `pnpm validate` aggregate),
and the `ts-morph` root devDependency.

- Scenario: the bespoke pipeline is gone
  - GIVEN the working tree after B125
  - WHEN the repo is inspected
  - THEN `scripts/docs/extract.ts`, `scripts/docs/curation.ts`, `scripts/docs-generate.ts`, and
    `site/src/lib/docs/api/manifest.generated.ts` do not exist; the root `package.json` has no
    `docs:generate` / `docs:check` script, `pnpm validate` no longer invokes `docs:check`, and
    `ts-morph` is absent from `devDependencies`; and `Grep` for `ts-morph`, `manifest.generated`,
    `SignatureBlock`, or `ParameterTable` finds no remaining import/usage in shipped site or
    library code.

### B125-R10: B115 grouping and B123 TOC nesting are reverted, and their tests replaced

The repo **MUST** revert the B115 curated grouping render and the B123 TOC group-nesting
(`data-toc-group`) on the `/docs/api` surface, and **MUST** delete or replace the tests that pin
the deleted renderer — `tests/unit/docs/B115-docs-api-grouped.test.ts`,
`site/e2e/docs-api-grouped.spec.ts`, and the B102 `site/e2e/docs-api.spec.ts` assertions that
target `SignatureBlock`/`ParameterTable`/the manifest — so the suite asserts the new
TypeDoc-driven render instead.

- Scenario: grouping/nesting tests no longer pin the dead renderer
  - GIVEN the working tree after B125
  - WHEN the test suite is inspected and run
  - THEN no test imports `scripts/docs/extract.ts`, `scripts/docs/curation.ts`, or
    `manifest.generated.ts`; the B115 grouped-manifest unit test and the B115/B123 grouped e2e
    spec are removed (or rewritten to the new render), the B102 `docs-api.spec.ts` no longer
    asserts `.sig` / `.param-table` / manifest-specific structure, and `pnpm validate` +
    `site:check` are green.

### B125-R11: Per-field TSDoc on every documented option/config field in `src/types.ts`

Every **documented** field of the option/config types in `src/types.ts` — the five
`GenerationDefaults` fields plus the own fields of `GenerateOptions` and `WorldOptions` (and the
other option/config types) — **MUST** carry a one-line TSDoc description, so each rendered
member entry shows a non-empty description rather than a blank one. The `@internal` fields
(`source`, `fieldPath`, `prng`) are out of the documented surface and are not covered by this
obligation.

- Scenario: no documented option field renders a blank description
  - GIVEN the working tree after B125 and the TypeDoc JSON model
  - WHEN the model's `GenerationDefaults`, `GenerateOptions`, and `WorldOptions` members are
    inspected
  - THEN every documented field carries a non-empty `comment`/description — the five
    `GenerationDefaults` fields (`seed`, `optionalProbability`, `defaultArrayLength`,
    `recursionLimit`, `locale`), `GenerateOptions`' own `overrides`/`transform`/`store`/`unique`,
    and `WorldOptions`' own `generators`/`trace` — and the rendered `/docs/api` member entries
    show a description for each; the excluded `@internal` fields are absent from the model.

### B125-R12: D5/D24 amendment recorded in decisions.md + CLAUDE.md synced

This card **MUST** record the D5/D24 amendment as ADR rationale in `wiki/decisions.md` (TSDoc on
`src/` stays the source of truth; TypeDoc replaces the `ts-morph` generator and the `docs:check`
parity guard; D24 is superseded) and **MUST** sync `CLAUDE.md`'s Documentation rule to match. The
spec-writer/implementer **MUST NOT** edit the `wiki/architecture.md` Rules section — the manager
promotes the amended D5 / retires D24 at item-close; the reviewer confirms the decision landed.

- Scenario: ADR amendment present in decisions.md
  - GIVEN the working tree after B125
  - WHEN `Grep` is run over `wiki/decisions.md`
  - THEN a dated ADR entry exists that amends D5 and supersedes D24 — naming TypeDoc as the API
    reference generator, recording `typedoc` as a build-time (D13-exempt) dependency, and carrying
    a "Rule added/changed" field with the wording the manager promotes (TSDoc stays the same-step
    source; the API reference is TypeDoc-generated; the `ts-morph`/`docs:check` machinery is
    retired).
- Scenario: CLAUDE.md Documentation rule synced
  - GIVEN the working tree after B125
  - WHEN `CLAUDE.md`'s `### Documentation rule` section is read
  - THEN it instructs updating the exported symbol's TSDoc in `src/` in the same step as a public
    API change and no longer instructs regenerating via `pnpm docs:generate` / `pnpm docs:check`
    or hand-editing `docs/api-reference.md` as the entry point.

### B125-R13: `/docs/api` nav is usable and scrollable (drop the B114 single-line ellipsis)

The `/docs/api` "On this page" navigation **MUST** be usable on this member-dense surface — it
**MUST NOT** truncate entries with the B114 single-line ellipsis on this page; long member lists
wrap and/or scroll so every entry is readable and reachable. As shipped, the rail is a 2-level
"On this page" structure (symbols → their members), fed by DocPage's gated `memberToc` harvest.

- Scenario (UI): the 2-level API nav shows full, reachable member entries
  - GIVEN the prerendered build of `/docs/api` at a desktop viewport (≥1024)
  - WHEN the "On this page" rail is inspected in a real browser
  - THEN its entries are not clipped by a single-line `text-overflow: ellipsis` (entries wrap or
    the rail scrolls), member entries appear nested under their parent symbol, and a
    representative member entry is fully readable and its link resolves to that member's anchor on
    the page.

### B125-R14: The reference reads as a useful member-level reference (designer pass)

The rebuilt `/docs/api` **SHOULD** read as a coherent, useful member-level reference — the
compact **heading-per-member** layout (name + type on one line, prose beneath) reads cleanly,
the `@dxlbnl/ui` look is preserved, code is dual-theme syntax-highlighted, Pagefind search and
the B114 responsive shell stay intact, and a reader can scan a function's options, a config
type's fields, and an interface's methods without hitting a dead link or an opaque type alias.

- Scenario (UI): a compact, highlighted, member-level reference, visually coherent
  - GIVEN the prerendered `/docs/api` loaded in a real browser at mobile (390), tablet (768), and
    desktop (1440) widths, in both the phosphor (default) and paper palettes (Playwright + a
    Chrome DevTools MCP screenshot at the review pass)
  - WHEN a reviewer/designer scans the page
  - THEN the page presents `generate` with its expanded option entries, `WorldOptions` with its
    own fields + the inherited-defaults link row, and `Registry` with its methods under the
    `@dxlbnl/ui` styling in the compact heading-per-member layout, code (signatures/examples) is
    syntax-highlighted readably in both palettes, the Pagefind search box is present and
    functional, there is no page-level horizontal overflow at any of the three widths, and no
    `console.error` / `pageerror` occurs during load.

### B125-R15: Gates stay green

The standing validation and site gates **MUST** stay green after B125: `pnpm build` prerenders
with no dangling links, `pnpm validate` and `site:check` pass, and the B114 responsive behaviour
and Pagefind search remain working (the B75 route smoke for `/docs/api` stays green).

- Scenario: full gate is green
  - GIVEN the working tree after B125
  - WHEN `pnpm build`, `pnpm validate`, `pnpm site:check`, and the B75 e2e route smoke run
  - THEN each completes successfully — the build prerenders `/docs/api` with the dangling-link
    guard passing, `validate`/`site:check` exit 0, and the `/docs/api` route smoke (no
    `console.error`/`pageerror`) passes.

### B125-R16: `/docs/api` code is dual-theme syntax-highlighted and wraps

All code rendered on `/docs/api` — symbol signatures, method signatures, and `@example` code —
**MUST** be syntax-highlighted with Shiki using the site's dual themes (`github-light` /
`github-dark-dimmed`, switched by palette) and **MUST** wrap rather than horizontally scroll, so
no code block forces page-level horizontal overflow.

- Scenario (UI): code is highlighted and wraps, no horizontal overflow
  - GIVEN the prerendered build of `/docs/api` loaded in a real browser
  - WHEN a code region (a symbol signature or an `@example` block) is inspected
  - THEN it is rendered through Shiki — at least one `.shiki` token `<span>` carrying a color
    style is present (the code is not plain white `<pre>` text) — the block wraps
    (`white-space: pre-wrap`, no per-block horizontal scrollbar), the page has no page-level
    horizontal overflow, and toggling the palette switches the token colors (the
    `--shiki-light` / `--shiki-dark` variables resolve per palette) with no `console.error` /
    `pageerror` during load.

## Out of scope

- **Twoslash clickable type-token links** — the plan's item 2 and the card's B126 (the spike's
  offset→`getDefinitionAtPosition`→`sources.{fileName,line}`→URL mapping). B125 produces the
  TypeDoc reference + the HTML link **target** B126 will point at, and B125 **does** Shiki-highlight
  `/docs/api` code (R16); it does **not** build the Twoslash type-checking or the clickable
  type-token link injection. (Guide-page code blocks — getting-started / concepts — are also not
  Shiki-highlighted by B125; only `/docs/api`. That is B126/B127 scope.)
- **Getting Started / Concepts / remaining guides rewrite** — plan items 3 and 6 (B127+).
- **Pagefind search UI rework** (button→modal→visible input) — plan item 4; B125 only keeps the
  existing search working.
- **The manager's `architecture.md` Rules-section edit** — promoted by the manager at item-close,
  not by this card's implementer (B125-R12 records the ADR; the manager edits the Rules).
- **TypeDoc theme styling beyond the in-site render** — if the implementation renders TypeDoc JSON
  in-site (the plan's recommended integration), the emitted TypeDoc HTML is a link target only; its
  own theme is not the `/docs/api` surface.

## Open questions

All three open questions were non-blocking and have been **resolved by the shipped
implementation** (this spec now reconciles to that reality):

1. **Does TypeDoc emit `docs/api-reference.md`, or is it dropped? (Non-blocking — resolved.)**
   Resolution: `docs/api-reference.md` is **kept as a now-static committed file** (no longer
   regenerated); `/docs/api` is the canonical living surface. B129 updated it to drop the symbols
   removed from the barrel. The reviewer flagged the resulting drift-risk (no parity guard) as a
   track-it note, not a blocker.

2. **src-vs-dist alignment: tsconfig `paths` → `src` vs point TypeDoc at `dist`. (Non-blocking —
   resolved.)** Resolution: a TypeDoc-specific tsconfig `paths` entry (`zod4-mock` → `src/index.ts`)
   was used — TypeDoc resolved the real surface (36 members, not the 5-node symlink stub) and
   `sources.fileName` points into `src/`, satisfying R1/R2.

3. **Member anchor scheme: literal `#<Symbol>.<member>` vs TypeDoc's own anchor format.
   (Non-blocking — resolved.)** Resolution: `#<Symbol>.<member>` anchors are emitted (e.g.
   `#Registry.pick`, `#GenerationDefaults.seed`) and verified to resolve/scroll on the page, with
   0 dangling anchors under the build-time guard.

No blocking open questions.
