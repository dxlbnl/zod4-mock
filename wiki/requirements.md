# Requirements

## Who this is for

### Primary persona

A TypeScript developer — backend, full-stack, or full-stack-ish frontend with API
ownership — who:

- Already uses **Zod v4** (or is migrating to it) for runtime validation.
- Needs **mock data** for one of: test fixtures, seed data for dev/demo environments,
  Storybook stories, playground content, load testing, or API stubbing.
- Has hit one of these specific frictions: fixture factories drifted from schemas;
  faker generators producing data that doesn't pass their own Zod validators; a
  multi-entity demo whose cross-references don't resolve; tried `@anatine/zod-mock`
  and discovered it doesn't support Zod v4.

### Jobs to be done

In declining frequency:

1. **"Generate fixtures from my schemas so they stay in sync."** Solves the drift problem.
2. **"Give me a realistic relational dataset for my demo / Storybook / load test."**
   The differentiated job — relational consistency the wedge.
3. **"Replace my hand-rolled faker generators because I already write Zod schemas."**
   The migration job.

### Anti-personas

- **No schemas, just need random data.** Use `faker` directly.
- **Locked on Zod v3 with no upgrade path.** Use `@anatine/zod-mock`.
- **Need server-side mock APIs with full HTTP layer.** Use MSW or similar; zod4-mock
  is a data layer, not a network layer.
- **Need data that passes complex cross-field invariants.** zod4-mock can generate the
  fields but won't satisfy arbitrary business rules. Pair it with a post-generation
  fixer if needed.

### Secondary persona — the comparison shopper

Visitors comparing libraries for a team decision: they skim the feature matrix on the
homepage, click `/bench` for ops/sec, read `/docs/comparison` for per-competitor
framing, and check the npm version (pre-1.0 — handle honestly).

## Functional requirements

- R1: `generate(schema)` produces a value matching a Zod v4 schema with zero
  configuration (no seed, no imports beyond the schema).
- R2: Generation is **deterministic** — the same seed yields byte-identical output on
  every run and every machine; per-field seeding means adding/removing a field does not
  disturb other fields' values.
- R3: **Key-based heuristics** map field names (`email`, `firstName`, `createdAt`,
  `userId`, `iban`, `vin`, …) to realistic generators; see `docs/key-heuristics.md`.
- R4: **Schema-based generation** introspects Zod types and checks (string/number/enum/
  object/array/union/optional/discriminatedUnion, `.min`/`.max`/`.length`, formats) and
  generates constraint-valid data; see `docs/zod4-schema-coverage.md`.
- R5: A `World` (`createWorld({ seed })`) registers schemas/subjects and supports
  matchers, relations, overrides, and a final transform; resolution order is
  matchers → key-based → schema-based → overrides → transform.
- R6: **Relations** keep IDs consistent across multiple registered schemas/subjects via
  the registry (`ctx.registry.pick`, `ctx.related`).
- R7: **Localization** is pluggable — a minimal Markov-free English default ships in the
  main package; opt-in Markov-backed locales (`@zod4-mock/locale-en`,
  `@zod4-mock/locale-nl`) and shared name models (`@zod4-mock/locale-names`) are
  workspace packages, composed via `extend()` from `@zod4-mock/locale-core`.

## Constraints

- Targets **Zod v4** specifically (peer dependency `zod@^4`); relies on Zod v4 internals
  at `schema._zod.def` / `check._zod.def`, which have no stable public API.
- **ESM-only**, Node16 module resolution — all relative imports use `.js` extensions.
- TypeScript `strict` plus `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`;
  **no `any`**.
- Performance/size budget: the data-generation research aims to beat `faker-js` on runtime
  speed, bundle size, and data quality (benchmark-first; see `wiki/research/`).
- Monorepo: pnpm workspaces with the root library plus `packages/locale-*` and a
  `playground/` (Svelte) app.

## Assumptions

- Consumers are on Zod v4; the v4 internal layout (`_zod.def`) remains stable enough to
  introspect. If it changes, log the impact in `decisions.md`.
- Locale corpora and Markov models are built offline via the training scripts
  (`scripts/train-markov.ts`, `packages/*/scripts/train.ts`) and shipped pre-compiled.

## Open questions

- The two remaining data-generation pillars (Markov character entropy for synthetic strings,
  conjugation-based word compression) — priority and scope (tracked as backlog items).
- Self-referential relations (a schema relating to itself, e.g. category → parent) are
  not yet supported (tracked as a bug; see `docs/bugs.md`).
