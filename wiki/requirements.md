# Requirements

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
