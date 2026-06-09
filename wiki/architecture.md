# Architecture

## Tech stack

- **Language**: TypeScript (`typescript@^6`), `strict` + `exactOptionalPropertyTypes` +
  `noUncheckedIndexedAccess`; ESM with Node16 module resolution (`.js` import extensions).
- **Runtime / platform**: **isomorphic / universal** — the published ESM library
  (`dist/index.js`, `dist/index.d.ts`) and the locale packages **MUST** run unmodified
  in browsers, MSW, service workers, and edge runtimes as well as Node; shipped code
  uses no `node:*` imports or Node-only globals (→ D13). `@types/node@^25` is a
  build/test devDependency only. The `playground/` is a Svelte app.
- **Key frameworks / libraries**: `zod@^4` (peer dependency — the schemas it mocks),
  `vitest` (tests), `oxlint`/`oxfmt` (lint/format), `tsup` (package builds), `changesets`
  (versioning/release).
- **Workspaces** (pnpm): root library `zod4-mock`, `packages/locale-core`,
  `packages/locale-en`, `packages/locale-nl`, and `playground/`.

## Package manager (binding)

> Agents must use **only** this package manager. Do not substitute another even if
> tutorials, generated configs, or model priors suggest one.

- **Package manager**: pnpm (use only this — not npm, not yarn)

## Test setup

- **Test runner**: vitest
- **Test command**: `pnpm test` (full suite: `vitest run`). Repo-wide incl. workspaces:
  `pnpm test:all`. Playground suites: `pnpm play` / `pnpm check`.
- **Test file location / naming**: `tests/unit/` (per-module) and `tests/integration/`
  (full-scenario: document-corpus, invoicing, media-library). Playground has its own
  unit/component tests.

## Project structure

```
src/                 # library source (index.ts is the public API)
  generators/        # key-based.ts (field-name heuristics) + schema-based.ts (Zod introspection)
  world/ world.ts registry.ts prng.ts       # World (engine.ts + relations.ts + …), registry, PRNG
tests/
  unit/              # isolated per-module tests
  integration/       # full-scenario tests, each with schemas.ts + world.ts
packages/
  locale-core/       # LocaleData types + extend()
  locale-en/  locale-nl/        # locales (real wordlists, no Markov)
scripts/             # offline build tooling (data fetchers, measurement scripts)
docs/                # end-user documentation (API reference, concepts, recipes, …)
wiki/                # Vibin workflow source of truth (this directory)
  research/             # generator-overhaul research: overview, tracking, text-generation/, engine/, field-resolution/, reports/
```

## Rules (binding)

- Code **MUST NOT** use `any`. (→ D1)
- All relative imports **MUST** use `.js` extensions (Node16 ESM resolution). (→ D1)
- Zod v4 internals **MUST** be read via `schema._zod.def` / `check._zod.def` (not `_def`);
  access is type-cast and intentional. (→ D3)
- Generation **MUST** be deterministic per `(seed + schema reference + per-schema call slot)`;
  call order across distinct schemas **MUST NOT** affect any value. Determinism is keyed on
  schema _reference_ identity (a module-global `WeakMap<ZodTypeAny, number>`), not structural
  equality — two separately-constructed `z.object(...)`s produce independent fork keys. Within
  a single record, per-field PRNG `fork(fieldName)` ensures field-name order doesn't disturb
  other fields. Construct schemas once at module scope and reuse them for stable mock data
  across refactors and `createWorld` calls. (→ D4, D10)
- When a public API changes, the exported symbol's **TSDoc** in `src/` **MUST** be updated
  in the same step; the in-site `/docs/api` reference is generated from that TSDoc by **TypeDoc**
  (build-time `site/` devDependency, D13-exempt) via `site/typedoc.json` → JSON model →
  `site/scripts/build-api-model.ts` → `site/src/lib/docs/api/api-model.generated.ts` (which
  **MUST NOT** be hand-edited), and a build-time dangling-link guard
  (`site/scripts/api-link-guard.ts`, run in the site `build`) fails the build on a dead
  `/docs/api` cross-reference anchor. `docs/api-reference.md` is a committed static reference
  (no longer auto-regenerated). (→ D5, D27)
- When fixing a bug, a regression test **MUST** be added. (→ D6)
- The package manager **MUST** be pnpm. (→ D2)
- Every publishable workspace package **MUST** have a `prepublishOnly` script that rebuilds its `dist/` (typically `pnpm build`). (→ D7)
- For schemas registered via `withSchema`, the value stored in the registry **MUST** equal the value returned by `world.generate`, including any `options.transform`. (→ D8)
- Generation cache short-circuits **MUST** be PRNG- and counter-neutral: a cache hit consumes zero PRNG state and advances no counter the generation pipeline reads from (roll back any increments the bypassed path made). (→ D9)
- The per-field generation pipeline **MUST** be expressed as the canonical `PIPELINE` list in `src/pipeline.ts`; new rungs are added by editing the list, never by open-coding the ladder at a call site. `PIPELINE_NO_REGISTRATION` is the registration-less subset for non-`withSchema` paths. (→ D11)
- A schema reference **MUST NOT** be registered as both primary and derived on the same world; `withSchema` **MUST** throw at registration time when an incoming registration's polarity (`opts?.from !== undefined` ⇒ derived; otherwise primary) conflicts with the polarity of an existing registration of the same schema reference. (→ D12)
- Shipped (published) library and locale-package code **MUST** be runtime-agnostic: no `node:*` imports and no reliance on Node-only globals (`fs`, `zlib`, `Buffer`, `process`, `__dirname`); it **MUST** run unmodified in browsers, MSW, service workers, and edge runtimes. Build-time scripts (`packages/*/scripts/`), tests, and config are exempt. (→ D13)
- All `generateArray` mode arms (derived, primary, ad-hoc) **MUST** apply the same trailing pass in the same order: cap to `callerMax ?? defMax`, apply per-index `options.overrides` (deepMerge per record), then apply `options.transform`. New behaviour added to one arm **MUST** be added to all three. (→ D14)
- Library code in `src/` **MUST NOT** import from any locale package (`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`, …); the only library↔locale boundary is the set of optional locale callbacks (`formatBio`, `formatBuzzPhrase`, `formatProductName`, `formatSentence`, …) typed in `@zod4-mock/locale-core` and implemented per locale. `@zod4-mock/locale-core` itself **MUST** contain types only — no locale-specific rule implementations. (→ D15)
- Within `site/`, code that imports from `"zod3"` **MUST** be parity-only benchmark code; production schemas **MUST** import from `"zod"`. Outside `site/`, `"zod3"` **MUST NOT** be imported. (→ D16)
- Speed claims in any user-facing surface (README, `docs/`, `site/`) **MUST** cite the CLI baseline (`site/bench/results/latest.json`); browser benchmark numbers **MUST NOT** be quoted as ops/sec. (→ D17)
- mdsvex `playground` code fences **MUST** be base64-encoded into placeholder elements and hydrated client-side; SSR **MUST NOT** mount CodeMirror directly. (→ D18)
- The site's `/` route **SHOULD** present zod4-mock to first-time evaluators (relational proof lead, install CTA above the fold). (→ D19)
- Copy referencing speed **MUST** use the honest framing: cite tier + source; never use "fastest" or "faster than the alternatives" without a citation. (→ D20)
- The site **MUST** declare CSS `@layer dxlbnl, site;` in `site/src/lib/styles/app.css` and import `@dxlbnl/ui` tokens into the `dxlbnl` layer + site identity into the `site` layer. (→ D21)
- Any docs primitive in `site/src/lib/docs/widgets/` that mounts an editor or other `window`-touching widget **MUST** defer construction to `onMount` (or behind an `if (browser)` guard) and **MUST NOT** touch `window`/`document` at module load. `<Playground>` is the reference implementation. D18 (mdsvex `playground` fence base64-encoding) remains in effect for any `+page.md` routes. (→ D22)
- Site bench schemas (the `simple` / `user` / `nested` / `matcher` / `nestedOrder` / `array` / `ecommerce` set) **MUST** live under `site/src/lib/schemas/` as module-scope `const` exports; consumers in `site/bench/`, `site/src/lib/runners/`, and `site/src/routes/` **MUST** import from there (no inline `z.object` schema definitions for benchmarked tiers). Each canonical zod4 schema benchmarked against a zod3-only library **MUST** ship a paired `*3` zod3 parity export. (→ D23)
- The site docs-search index **MUST** be built by `pagefind` (build-time `site/` devDependency, D13-exempt) run post-`vite build`, indexing the prerendered `/docs` HTML and writing the `/pagefind/` bundle into both `vite preview`'s served root (`.svelte-kit/output/client`) and Vercel's (`.vercel/output/static`); the `/docs` subtree **MUST** stay prerendered (`export const prerender = true`) so the HTML is indexable. (→ D25)
- `world.trace()` and the `WorldTrace` / `TraceNode` / `TraceField` / `TraceEdge` / `TraceResolution` types are a **binding, JSON-serializable public contract** (no class instances, functions, or symbols); `TraceResolution` is its own public union mapped from `FieldResolution["kind"]` at the capture boundary, and `TraceField` **MUST** extend `FieldExplanation`. A breaking shape change is a SemVer bump (minor pre-1.0). (→ D26)
- Trace provenance **MUST** be captured during generation under the opt-in `createWorld({ trace: true })` gate, never re-derived after the fact; `ctx.related` relation edges **MUST** be captured at the `resolveRelationPool` pick site and **MUST NOT** be re-derived (pool size is path-dependent). (→ D26)
- The `zod4-mock` barrel (`src/index.ts`) **MUST** export only the user-facing public surface (`generate`, `createWorld`, `createPrng`, `generators`, `DEFAULT_KEY_MAP`, `DEFAULT_KEY_PATTERNS`, and the `World`/`Registry`/options/locale types incl. `GenerationDefaults`); engine-internal helpers (`generateFromSchema`, `generateFromKey`, `fieldSeed`) **MUST NOT** be re-exported from the barrel, and `extend` is exported from the locale packages (`@zod4-mock/locale-en`/`-nl`), not the main barrel. (→ D28)
- Engine-threaded option fields with no user-facing call path (e.g. `GenerateOptions.source`/`fieldPath`/`prng`) **MUST** be tagged `@internal` so TypeDoc's `excludeInternal: true` keeps them out of the `/docs/api` reference; they stay in the type for structural-identity plumbing (non-breaking). (→ D29)
- Docs code samples **MUST** be rendered through Shiki + `@shikijs/twoslash` and **type-checked at build time** (a sample that does not compile fails the build); `@shikijs/twoslash` + `twoslash` are build-time (D13-exempt) devDependencies that never enter the shipped library or client bundle; the token → `/docs/api#<anchor>` type-link join **MUST** be `src`-aligned (the language-service `paths` map `zod4-mock` → `src/index.ts`, matching `site/typedoc.tsconfig.json`). Use a **minimal renderer** (linked tokens only), not `rendererRich()`'s hover popups. (→ D30)
- Prerendered `/docs` `<h2>`/`<h3>` heading ids **MUST** be present at build time — produced by the build-time id-injection step (`site/scripts/inject-heading-ids.ts`) using the shared `slugify` (`site/src/lib/docs/slug.ts`) so Pagefind anchors them and `#fragment` deep-links resolve on initial load; the HTML **MUST** be mutated with a real parser (`node-html-parser`, a build-time/D13-exempt `site/` devDependency), never regex, and the step runs after `vite build` and before the Pagefind index. (→ D31)
- `TraceNode.id` **MUST** be the friendly `<typeName>#<index>` string (1-based index; `typeName` = the schema's `.description` else the `schema<id>` fallback; derived nodes use the derived schema's name and set `derivedFrom` to the friendly source id; same-polarity display-name collisions auto-disambiguate by registration order `-N`, never throwing) — a binding public contract under D26; the friendly id is a `trace()`-projection only and the internal PRNG seed keys **MUST** stay byte-identical. (→ D32)
