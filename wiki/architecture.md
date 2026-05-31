# Architecture

## Tech stack

- **Language**: TypeScript (`typescript@^6`), `strict` + `exactOptionalPropertyTypes` +
  `noUncheckedIndexedAccess`; ESM with Node16 module resolution (`.js` import extensions).
- **Runtime / platform**: Node (`@types/node@^25`); published as an ESM library
  (`dist/index.js`, `dist/index.d.ts`). The `playground/` is a Svelte app.
- **Key frameworks / libraries**: `zod@^4` (peer dependency — the schemas it mocks),
  `vitest` (tests), `oxlint`/`oxfmt` (lint/format), `tsup` (package builds), `changesets`
  (versioning/release).
- **Workspaces** (pnpm): root library `zod4-mock`, `packages/locale-core`,
  `packages/locale-en`, `packages/locale-nl`, `packages/locale-names`, and `playground/`.

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
  locale-en/  locale-nl/  locale-names/      # locales + shared Markov name models
scripts/             # train-markov.ts, verify-markov.ts (offline model tooling)
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
