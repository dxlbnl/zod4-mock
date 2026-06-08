---
id: B129
title: Curate the public API surface — drop internal exports, move `extend` to the locale packages
type: feature
priority: medium
created: 2026-06-07
flags: [review]
---

## Description

Reviewing the rebuilt `/docs/api` (B125, which faithfully renders whatever `src/index.ts`
exports) surfaced that the public barrel exports several **internal / non-user-facing**
symbols and one **thematically-misplaced** one. They clutter the reference and imply a
support contract the library doesn't intend. This item curates the public surface so the
reference lists only what a user actually uses.

This is a **breaking** change (removing/relocating exports), so it ships as a **major** bump
with a clear migration note. Each decision below was confirmed with the maintainer.

### Drop from the public surface (internal — no user path)

Mark `@internal` and/or stop exporting from `src/index.ts`:

- **`generateFromSchema`, `generateFromKey`** — the pipeline "rungs." Called only internally
  (`src/pipeline.ts`, `src/generators/**`) and in unit tests; to call them a user must
  hand-construct a `GeneratorContext` (no public path produces one). Users generate via
  `generate()` / `world.generate()`.
- **`fieldSeed`** — internal per-field seed plumbing (`src/world/engine.ts`); the documented
  example reconstructs an engine-internal seed by hand, which no user does.

### Relocate `extend` to the locale packages (thematic + ergonomic)

`extend` is defined in `@zod4-mock/locale-core` and merely re-exported by the main barrel. A
user only reaches for it with a base locale in hand (`extend(en, …)`), importing that base
from `@zod4-mock/locale-en`. **Decision: re-export `extend` from each locale package
(`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`) — they already depend on locale-core — and
drop it from the `zod4-mock` barrel**, so a user writes:

```ts
import { en, extend } from "@zod4-mock/locale-en";
const enGB = extend(en, {
  /* … */
});
```

`locale-core` stays the canonical definition (and the home of `LocaleData` / `Currency` /
`LastNamePrefix`); the whole locale surface then lives together.

### Decide: the standalone-namespace path (`createPrng` + `data`)

- **`data`** is a near-duplicate of **`generators`** (both are `= dataNs` in `src/index.ts`).
  `generators.*` is the documented matcher form (`generators.person.fullName(ctx.prng)`);
  `data.*` only appears in the standalone example `data.person.fullName(createPrng(1))`.
- **`createPrng`** is only needed by a user to feed that standalone path; inside matchers they
  already have `ctx.prng`.
- **Open decision for the implementer's spec:** keep the standalone-namespace path
  (`data` + `createPrng`) as a supported public API, or cut it and make the matcher path
  (`generators.*` with `ctx.prng`) the only supported one. Maintainer to confirm at spec time
  (see Open questions).

### Keep public (no change)

`generate`, `createWorld`, `generators`, `DEFAULT_KEY_MAP`, `DEFAULT_KEY_PATTERNS`, and the
`World` / `Registry` / options / locale **types** (the supporting types — `LocaleData`,
`Currency`, `LastNamePrefix`, `Prng`, `Explain*`, `Trace*` — remain exported as link targets
for the reference even where they aren't headline entries).

## Acceptance

- The dropped symbols (`generateFromSchema`, `generateFromKey`, `fieldSeed`, plus whatever the
  `createPrng`/`data` decision removes) are no longer importable from `zod4-mock` (or are
  `@internal` and absent from the TypeDoc model), so `/docs/api` no longer lists them.
- `extend` is importable from `@zod4-mock/locale-en` and `@zod4-mock/locale-nl` and is no longer
  exported from `zod4-mock`; the locale docs/examples use the new import.
- TSDoc / `docs/` examples and the in-source `@example` blocks are updated to the new surface
  (no example imports a dropped symbol). `/docs/api` reflects the curated surface.
- A **major** changeset documents the removals/relocation with a migration note.
- `pnpm validate` + `pnpm site:test:e2e` green; the B125 dangling-link guard stays green
  (dropping a symbol must not orphan a cross-link — fix or drop any `{@link}` to a removed
  symbol).

## Notes

- Predecessor: B125 (the curated surface renders through B125's TypeDoc reference). Independent
  of the B125 entry-display rework (signature-line render) — they touch different layers.
- `flags: [review]` — public-contract + breaking change; the manager pauses for plan approval.
- Migration note must list each removed/moved symbol and its replacement (e.g.
  `import { extend } from "zod4-mock"` → `import { extend } from "@zod4-mock/locale-en"`).

## Resolved decisions (maintainer, 2026-06-07 — "immediately fix it")

1. **Standalone-namespace path:** **drop `data`** (literal duplicate of `generators`) but
   **keep `createPrng`** + `generators`. The standalone path stays supported via
   `generators.person.fullName(createPrng(1))`; the redundant `data` alias goes.
2. **Hard-remove, not `@internal`:** `generateFromSchema`, `generateFromKey`, `fieldSeed`, and
   `data` are **removed** from `src/index.ts`; `extend` relocated. This is a **major** bump.

### Final removal/relocation list

- Remove from `zod4-mock` barrel: `generateFromSchema`, `generateFromKey`, `fieldSeed`, `data`.
- Relocate `extend`: add `export { extend } from "@zod4-mock/locale-core"` to
  `@zod4-mock/locale-en` and `@zod4-mock/locale-nl`; remove the `extend` re-export from
  `src/index.ts`. (`@zod4-mock/locale-core` keeps the canonical definition.)
- Keep: `generate`, `createWorld`, `createPrng`, `generators`, `DEFAULT_KEY_MAP`,
  `DEFAULT_KEY_PATTERNS`, and all the `World`/`Registry`/options/locale **types**.
