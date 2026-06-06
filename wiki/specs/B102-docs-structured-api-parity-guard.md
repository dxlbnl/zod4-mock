# B102: Structured /docs/api + docs:generate parity guard + D5 rewrite (HYBRID — TSDoc → manifest)

## Context

B102 is the third implementation card of the docs system designed in
[B94](../backlog/done/B94-docs-system-design.md) and elaborated in
[wiki/research/reports/docs-system-design.md](../research/reports/docs-system-design.md)
§6 (Sync with `docs/`) and §7 (Phasing → Card 3). It builds the structured API
reference view on the B100 primitives, then closes the dual-source-of-truth gap
B100 left open: `docs/api-reference.md` becomes a **regenerated artifact** with a
build-time parity guard wired into `pnpm validate`.

The card itself:
[wiki/backlog/doing/B102-docs-structured-api-parity-guard.md](../backlog/doing/B102-docs-structured-api-parity-guard.md).

### Design changed at the review checkpoint (2026-06-06) — HYBRID, not hand-manifest

> **This spec is a rewrite.** The earlier draft of B102 designed a hand-written
> `site/src/lib/docs/api/manifest.ts` carrying a hand-typed `signature` string per
> symbol (the research §6 (β) shape). At the 2026-06-06 review checkpoint the
> maintainer rejected that model: a hand-typed signature string is a duplicate of
> the real type and reintroduces exactly the drift the parity guard is meant to
> kill, and the existing api-reference prose is unsatisfactory. The card's
> "Design decision" callout and rewritten "Scope (hybrid model)" supersede the
> hand-manifest design. This spec is rewritten around the **HYBRID — TSDoc prose →
> generated manifest** model:
>
> 1. **TSDoc on the real `src/` exports is the prose source of truth.** Each public
>    symbol gets a `/** … */` block with a fresh description, `@example`(s), and
>    curation tags. Prose is authored **fresh** — the current `docs/api-reference.md`
>    prose is **not** preserved.
> 2. **A build-time extractor reads the TSDoc _and the real compiler signatures_** and
>    produces a **generated** manifest. The signature is **extracted from the types,
>    never hand-typed** — this is the core correctness property.
> 3. **One extraction, two render targets**: the generated manifest drives both the
>    `/docs/api` site view and `scripts/docs-generate.ts`'s `docs/api-reference.md`.

### The D5 amendment (standing-constraint change — flagged)

This card **changes a binding standing constraint**. The current D5 rule in
`wiki/architecture.md` reads:

> When a public API changes, `docs/api-reference.md` **MUST** be updated in the same
> step (not deferred). (→ D5)

B102 reframes it for the hybrid model: the **TSDoc on the exported symbol** is now
the same-step obligation; the manifest and `docs/api-reference.md` regenerate from it
(see **B102-R9**). Per the Vibin workflow, the **manager owns** the `architecture.md`
Rules-section edit: this spec-writer records the ADR rationale in `wiki/decisions.md`
(B102-R9) and syncs `CLAUDE.md`, and flags the change; the **reviewer must confirm**
the Rules-section change landed; the **manager promotes/updates** the D5 rule when the
item reaches Done. The spec-writer/implementer **MUST NOT** edit the Rules section.

### Export-surface ground truth (read before authoring TSDoc)

The coverage target is the public export surface of
[src/index.ts](../../src/index.ts), **not** the prose "Exports overview" table in
`docs/api-reference.md` (which has drifted). The actual runtime + type exports are:

- **Value exports**: `generate`, `createWorld`, `createPrng`, `fieldSeed`,
  `generateFromSchema`, `generateFromKey`, `data`, `DEFAULT_KEY_MAP`,
  `DEFAULT_KEY_PATTERNS`, `extend`, and the `generators` namespace
  (`export * as generators`).
- **Type-only exports**: `PrngGen`, `KeyPattern`, `World`, `WorldOptions`, `Registry`,
  `GeneratorContext`, `BoundGenerators`, `Prng`, `KeyGenerator`, `SchemaOpts`,
  `MatcherCtx`, `DeepPartial`, `GenerateOptions`, `SchemaKeyMap`, `ExplainResult`,
  `FieldExplanation`, `RelationExplanation`, `LocaleData`, `LastNamePrefix`, `Currency`.

That is ~31 symbols (11 value, 20 type) — and roughly the ~25 the research §7 Card 3
estimate referenced, ground-truthed up against `src/index.ts`. Note the
`docs/api-reference.md` overview table lists `PrimarySchemaOpts` and
`DerivedSchemaOpts`, which `src/index.ts` does **not** export (the real exports are
`SchemaOpts` and `MatcherCtx`); and the table omits `data`. Because the generated
manifest is **extracted from `src/index.ts`'s real exports**, this drift is corrected
by construction: the regenerated overview drops the phantom symbols and adds `data`.
Reconciling that table lands in the review-checkpoint baseline diff (see Open
questions).

### Binding standing constraints this card complies with

- **D1** — no `any` in the extractor, `scripts/docs-generate.ts`, the generated
  manifest module it emits, the `+page.svelte`, or any test; new relative imports use
  `.js` extensions (Node16 ESM). The generator/extractor is build-time-only and **may**
  use `node:*` and the TypeScript compiler API (D13 exemption for build scripts).
- **D13** — any generated-manifest module that ships in the **site bundle** (consumed by
  `+page.svelte`) **MUST** remain runtime-agnostic (no `node:*`): it is plain data
  emitted at build time. Only the build-time extractor / `scripts/docs-generate.ts`
  touch the filesystem and the compiler API.
- **D5** — **amended by this card** (see B102-R9). Until the manager promotes the new
  rule at item-close, the old D5 still binds; B102's own commit is the step that brings
  the TSDoc, the generated manifest, and `docs/api-reference.md` into their new shape.
- **D22 / D18** — the `/docs/api` view composes B100 primitives; if it embeds any
  `<Playground>`, that primitive already carries the SSR-safe mounting contract. This
  card adds no new `window`-touching widget.

### Tooling: the extractor (a new dev dependency — flagged for the review checkpoint)

The signature is extracted from the real types via a TypeScript-AST tool. Neither
`ts-morph` nor `typedoc` is present in the repo today (root `package.json`, site
`package.json`, or `pnpm-lock.yaml`); `typescript@^6` is already a devDependency in
both workspaces, so the raw compiler API adds no dependency.

- **`ts-morph` (recommended)** — an ergonomic wrapper over the compiler API. It reads
  JSDoc directly (`getJsDocs()`, `.getDescription()`, `.getTags()` for `@example` /
  `@group` / `@since` / `@see`) and the real type text (`getType().getText(...)`,
  declaration signatures) without hand-rolling the compiler-API boilerplate. **Almost
  certainly a new dev dependency** (root `devDependencies`) → standing-constraint
  candidate; see Open question 1 and B102-R9's ADR note.
- **TypeDoc** — emits a full JSON model. Heavier and opinionated toward whole-site doc
  generation; we only need per-symbol signature + JSDoc, so its model is overkill.
- **Raw TypeScript compiler API** — zero new dependency (uses the installed
  `typescript`), but verbose for JSDoc reading and signature-text rendering.

This spec keeps the extractor tool an **Open question for the review checkpoint** (it
is the likely standing constraint), but writes the requirements tool-agnostically: the
contract is "signature extracted from the real types, never hand-typed", satisfiable by
any of the three. The recommendation is `ts-morph`.

Package manager: **pnpm** (per `wiki/architecture.md`). The script runtime is `tsx`,
already a root devDependency (`tsx@^4.21.0`). `pnpm validate` is composed (root
`package.json`) as `pnpm check:all && pnpm test:all && pnpm lint:all && pnpm fmt:check`.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B102-R1: Fresh TSDoc on every public export in `src/`

Every public symbol of the `zod4-mock` package (the ~31 in the "Export-surface ground
truth" above, as exported from `src/index.ts` and the files it re-exports) **MUST**
carry a TSDoc (`/** … */`) block authored fresh for this card, with a one-to-two-line
description and, for every value export and the `generators` namespace, at least one
`@example` fenced ` ```ts ` block. The current `docs/api-reference.md` prose is **not**
preserved; descriptions are rewritten.

- Scenario: every public symbol has a TSDoc description
  - GIVEN the working tree after B102
  - WHEN a vitest test (or the extractor's own coverage assertion) extracts the TSDoc
    of each name in the "Export-surface ground truth" list from `src/`
  - THEN every listed symbol has a non-empty TSDoc description, and every **value**
    export (plus the `generators` namespace) has at least one `@example` block.
- Scenario: a public export missing TSDoc is detectable
  - GIVEN one public export's `/** … */` block is removed
  - WHEN the same extraction/coverage check runs
  - THEN it reports that symbol as missing documentation (a named, non-zero failure),
    proving the check is load-bearing rather than vacuous.

### B102-R2: Build-time extractor reads TSDoc + real compiler signatures into a generated manifest

The repo **MUST** add a build-time extractor (a helper module under `scripts/`, used by
`scripts/docs-generate.ts`) that, for each public export of `src/index.ts`, produces a
`ManifestSymbol` carrying at minimum `name: string`, `kind` (one of `"function" |
"type" | "namespace" | "object"`), `signature: string`, `description: string`,
`examples: ReadonlyArray<string>`, `since: string`, and `seeAlso: ReadonlyArray<string>`,
where `signature` is **extracted from the symbol's real TypeScript type / declaration,
never hand-typed**, and `description` / `examples` / `since` / `seeAlso` are read from
the symbol's TSDoc. The extractor is build-time-only (D13-exempt) and uses no `any`
(D1).

- Scenario: manifest covers the real export surface, extracted from `src/index.ts`
  - GIVEN the extractor runs against `src/index.ts`
  - WHEN the produced manifest's `name` set is compared to the public export names of
    `src/index.ts`
  - THEN the two sets are equal — every value/type export listed in "Export-surface
    ground truth" appears exactly once, the phantom `PrimarySchemaOpts` /
    `DerivedSchemaOpts` are absent, and `data` is present.
- Scenario: signature is the real type, not a hand-typed string
  - GIVEN `generate`'s `ManifestSymbol`
  - WHEN its `signature` is inspected
  - THEN the signature reflects the actual declared type of `generate` from `src/`
    (it names `generate`, its `schema` parameter, and an `options` parameter), and no
    hand-authored signature string for any symbol exists in a committed source file
    (the only signature source is the extractor's read of the types).

### B102-R3: A hand-maintained curation layer orders/groups/filters symbols by name

The extractor **MUST** apply a thin, hand-maintained curation layer (a single typed
module under `scripts/` or `site/src/lib/docs/api/`, keyed by symbol **name**) that
controls render ordering, optional grouping, and an include/exclude list, leaving the
per-symbol prose and signature entirely to the TSDoc+types of B102-R1/R2. The curation
layer carries **no** signature strings and **no** descriptions — only ordering/grouping
metadata keyed by name.

- Scenario: curation controls order without owning prose
  - GIVEN the curation layer lists symbol names in a chosen order (e.g. `generate`
    before `createWorld`)
  - WHEN the manifest is produced
  - THEN the manifest's symbols appear in the curated order, and a unit test asserts
    the curation layer contains no `signature` or `description` field for any symbol
    (prose stays in the TSDoc).
- Scenario: a name in neither the curation list nor an explicit exclude is surfaced
  - GIVEN a public export exists in `src/index.ts` but is absent from the curation
    layer's order list and its exclude list
  - WHEN the manifest is produced
  - THEN the build fails (or the symbol is appended in a deterministic default position
    and a coverage check flags it) — an un-curated public symbol cannot silently vanish
    from the docs.

### B102-R4: Structured `/docs/api` view driven by the generated manifest

The site **MUST** replace the B100 stub at
`site/src/routes/docs/api/+page.svelte` with a structured view that, for each symbol in
the generated manifest, renders a per-symbol `<SignatureBlock>` (B100-R3) showing the
symbol's extracted `signature` and TSDoc `description`, inside a `<DocPage>` (B100-R1)
whose right-rail TOC lists every symbol, in manifest (curated) order.

- Scenario: every manifest symbol renders a signature block
  - GIVEN `/docs/api` renders against the non-empty generated manifest
  - WHEN a storybook component test (or Playwright route check) queries the page
  - THEN for a representative symbol (`generate`) the page contains its extracted
    `signature` text inside a `<code>` element and its `description` text, and the
    right-rail TOC contains a navigable link whose target anchor matches that symbol's
    `name`.
- Scenario (UI): /docs/api is a structured per-symbol view
  - GIVEN the prerendered SvelteKit build of `/docs/api`
  - WHEN the page loads in a real browser (B75 smoke / Playwright)
  - THEN the page exposes `getByRole("heading", { level: 1 })` for the API reference
    title and renders at least one `<SignatureBlock>` `@dxlbnl/ui` `Card` per manifest
    symbol, with no `console.error` / `pageerror` during load.

### B102-R5: `<ParameterTable>` for parameterised symbols

For each manifest symbol that declares parameters, the `/docs/api` view **MUST** render
a `<ParameterTable>` (B100-R4) populated from typed parameter rows carried on that
symbol (a `parameters: ReadonlyArray<ParameterRow>` field, itself extracted from the
real parameter types); symbols without parameters render no table.

- Scenario: parameterised symbol renders a parameter table
  - GIVEN the manifest contains `generate` with a non-empty `parameters` array (rows
    for `schema` and `options`, extracted from the real signature)
  - WHEN `/docs/api` renders and a component test queries the `generate` section
  - THEN `getByRole("table")` is present within that symbol's block and its body rows
    include the declared parameter names ("schema", "options") in declared order.
- Scenario: non-parameterised symbol renders no table
  - GIVEN the manifest contains a type-only symbol (e.g. `Currency`) with no
    `parameters`
  - WHEN `/docs/api` renders that symbol's block
  - THEN no `<table>` (`getByRole("table")`) appears within that symbol's block.

### B102-R6: `scripts/docs-generate.ts` emits `docs/api-reference.md` from the same manifest

The repo **MUST** add `scripts/docs-generate.ts` that produces the generated manifest
(via the B102-R2 extractor) and writes `docs/api-reference.md` from a fixed template (an
"Exports overview" table row per symbol plus a per-symbol section carrying its extracted
signature, TSDoc description, and examples). The script is build-time-only (D13-exempt),
runs under `tsx`, and uses no `any` (D1).

- Scenario: generated file covers every manifest symbol from the real surface
  - GIVEN `pnpm docs:generate` runs
  - WHEN the resulting `docs/api-reference.md` is read
  - THEN its "Exports overview" table contains exactly one row per manifest symbol
    name (no extra rows, no missing rows), matching the real export surface of
    `src/index.ts` (including `data`, excluding `PrimarySchemaOpts` /
    `DerivedSchemaOpts`).

### B102-R7: `pnpm docs:generate` is idempotent

The generator **MUST** be idempotent: running `pnpm docs:generate` against an
already-generated tree (the `docs/api-reference.md` and any committed generated-manifest
artifact) produces no change to the generated files' bytes.

- Scenario: second run is a no-op
  - GIVEN `pnpm docs:generate` has been run once and its outputs committed
  - WHEN `pnpm docs:generate` is run a second time with no TSDoc/type/curation change
  - THEN the generated files are byte-identical to the committed versions (a
    `git diff --exit-code` style check, or the in-suite parity test of B102-R9 §guard,
    reports no difference).

### B102-R8: `docs:generate` / `docs:check` root scripts, with `docs:check` in `pnpm validate`

The root `package.json` **MUST** add a `docs:generate` script (runs the
extractor+generator in write mode via `tsx`) and a `docs:check` script (runs it in
`--check` no-write mode, exiting non-zero on drift), and **MUST** include `docs:check`
in the `pnpm validate` aggregate so a docs/manifest mismatch fails the standing
validation gate.

- Scenario: docs:check joins the validate gate
  - GIVEN the generated tree is in sync with the current TSDoc + types
  - WHEN `pnpm validate` runs
  - THEN the run invokes `docs:check`, `docs:check` exits 0, and `pnpm validate`
    completes green.
- Scenario: docs:check is a no-write check
  - GIVEN the generated tree is in sync
  - WHEN `pnpm docs:check` runs
  - THEN it exits 0 and leaves `docs/api-reference.md` (and any committed generated
    artifact) unmodified — no write side-effect, confirmable by an unchanged
    mtime/byte check.

### B102-R9: Parity guard fails on un-regenerated TSDoc/curation drift (the negative/parity test)

`pnpm docs:check` **MUST** fail with a non-zero exit code and a human-readable diff when
a public symbol's **TSDoc (or the curation layer)** is changed without regenerating —
the case the guard exists to catch.

- Scenario: TSDoc change without regeneration fails docs:check
  - GIVEN a committed, in-sync generated tree, and a public export's TSDoc
    `description` (or `@example`) is edited — or a curation-layer ordering entry is
    changed — without running `pnpm docs:generate`
  - WHEN `pnpm docs:check` runs (driven by an automated test that performs the mutation
    in a temp copy / fixture)
  - THEN the command exits non-zero and emits output that names the drifted symbol and
    shows the differing lines (a useful diff), and running `pnpm docs:generate` followed
    by `pnpm docs:check` then exits 0.

### B102-R10: D5 amendment — ADR rationale + CLAUDE.md sync (architecture Rule promoted by the manager)

This card **MUST** record the D5 amendment as ADR rationale in `wiki/decisions.md`
(amending/superseding the existing D5 entry to the **TSDoc-as-source-of-truth** model)
and **MUST** sync the `CLAUDE.md` "Documentation rule" section to match. The spec-writer
and implementer **MUST NOT** edit the `wiki/architecture.md` Rules section directly — the
**manager** promotes the new one-line D5 rule there at item-close; the **reviewer**
confirms the Rules-section change is present at Done. The amended D5 rule text (the
wording the manager promotes) is:

> When a public API changes, the exported symbol's **TSDoc** in `src/` **MUST** be
> updated in the same step; the API manifest and `docs/api-reference.md` are regenerated
> by `pnpm docs:generate` and parity is verified by `pnpm docs:check`. (→ D5)

The ADR **MUST** also record whether the chosen extractor adds a new dev dependency (per
Open question 1) so the manager can promote a dependency rule if warranted.

- Scenario: D5 ADR amendment landed in decisions.md
  - GIVEN the working tree after B102
  - WHEN `Grep` is run over `wiki/decisions.md` for the literal text
    `the exported symbol's TSDoc`
  - THEN the match is present inside an ADR-formatted D5 amendment (a dated entry
    referencing TSDoc-on-`src/`-exports as the new D5 entry point, with a "Rule
    added/changed" field carrying the amended rule wording above), and the entry notes
    the manager promotes the one-line rule to `wiki/architecture.md`.
- Scenario: CLAUDE.md documentation rule synced
  - GIVEN the working tree after B102
  - WHEN the `### Documentation rule` section of `CLAUDE.md` is read
  - THEN it instructs updating the exported symbol's **TSDoc** in `src/` in the same
    step as a public API change and regenerating `docs/api-reference.md` via
    `pnpm docs:generate` (no longer instructing a direct hand-edit of
    `docs/api-reference.md` as the entry point).

## Out of scope

- **Other `docs/*.md` files** — `concepts.md`, `getting-started.md`,
  `key-heuristics.md`, `recipes.md`, `zod4-schema-coverage.md`, `bugs.md`, `index.md`
  stay hand-edited and human-policed (research §6); B102's automated parity guard covers
  **only** the TSDoc/types ↔ generated-manifest ↔ `docs/api-reference.md` chain for the
  exported API surface.
- **Pagefind search box / concept index** — owned by B104; B102 reuses any
  `data-pagefind-*` attributes B100 primed but adds no search UI.
- **Command palette (⌘K)** and **type-aware code blocks** — deferred per research §4.
- **Branding `<SpeedClaim>`'s `source` prop** — B100's open question; not part of this
  card.
- **`/docs/relational` and `/docs/comparison`** placement — B101+ decision; B102 only
  rebuilds `/docs/api`.
- **Full TypeDoc-style auto-site generation** — rejected (research §6 δ): B102 extracts
  only per-symbol signature + the **author-written** TSDoc prose; it does not generate a
  whole doc site from the type tree.
- **The manager's `architecture.md` Rules-section edit** — by design done by the manager
  at item-close, not by this card's implementer (B102-R10).

## Open questions

1. **Extractor tool + new dev dependency (Non-blocking; surfaces at the review
   checkpoint).** The spec recommends **`ts-morph`** for ergonomic JSDoc + type-text
   reading; the alternatives are **TypeDoc** (heavier JSON model, overkill) and the
   **raw TypeScript compiler API** (zero new dependency, verbose). `ts-morph` and
   TypeDoc are each **almost certainly a new root dev dependency** (neither is in
   `package.json` or `pnpm-lock.yaml` today; `typescript@^6` is already present, so the
   raw compiler API adds nothing). Adding a build-time extraction dependency is a
   **standing constraint** → it wants an ADR note (B102-R10) and the manager may promote
   a one-line rule. The card is already `flags: [review]`, and the tool/dependency choice
   is the headline review-checkpoint item. Recorded; not blocking — the requirements are
   written tool-agnostically (the contract is "signature extracted from the real types"),
   so the user/reviewer can ratify `ts-morph` vs compiler-API at the checkpoint without
   reshaping the contract.

2. **Curation-layer shape (Non-blocking; minor review-checkpoint item).** B102-R3 pins
   the curation layer to ordering/grouping/include-exclude keyed by **name**, carrying no
   prose or signatures. Whether grouping is a flat ordered name list, a `{ group, order }`
   record, or reuses B100's `SidebarGroup` ids is an implementation detail provided the
   observable holds (curated order renders; no un-curated public symbol vanishes
   silently; the layer owns no prose). Recorded; not blocking.

3. **Regenerated `docs/api-reference.md` canonical shape (Non-blocking; surfaces at the
   review checkpoint).** Running `pnpm docs:generate` establishes a _new_ canonical shape
   for `docs/api-reference.md` from fresh TSDoc — it will not be byte-identical to today's
   ~1237-line hand-written file, and it reconciles the "Exports overview" table to the
   real `src/index.ts` surface (dropping `PrimarySchemaOpts`/`DerivedSchemaOpts`, adding
   `data`). The card designates this first generated output as the new committed baseline,
   so this is resolved-by-construction; it is flagged because the regenerated-file diff —
   and the fresh TSDoc prose quality (description richness, worked examples) — is exactly
   what the user reviews at the existing `review` checkpoint. Recorded; not blocking (the
   reviewer/user adjudicates the diff and prose at the checkpoint).

No blocking open questions.
