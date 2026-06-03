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
  world.ts subject.ts registry.ts prng.ts   # World, SubjectType, registry, PRNG
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
- When a public API changes, `docs/api-reference.md` **MUST** be updated in the same step
  (not deferred). (→ D5)
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
