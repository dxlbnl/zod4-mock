# Decision Log

> Append-only, ADR-style rationale archive. Newest at the bottom. Never edit a past
> entry — supersede it with a new one and link both.
>
> **What belongs here.** Only a decision that establishes or changes a **standing
> constraint** — a choice future work must obey beyond the current item: a dependency or
> tool to use (or a ban on an alternative), a pattern code must follow, or an
> architectural boundary. Test: *would an agent building an unrelated future item need to
> know this?* If yes, it belongs here **and** as a one-line rule in `architecture.md`'s
> Rules section (the manager adds the rule). If it is local to one item (how a single
> function is shaped, a one-off value), it does **not** belong here — note it in
> `progress.md` instead. This bar keeps the log tight and guarantees every entry has a
> binding rule pointing back at it.

## Format

```
## D<n>: <title>
- **Date**: <YYYY-MM-DD>
- **By**: <agent or user>
- **Context**: <what prompted the decision>
- **Decision**: <what was decided>
- **Consequences**: <trade-offs, follow-ups>
- **Rule added/changed**: <the architecture.md Rules line this produced, or "none" if it only supersedes an earlier rule>
- **Supersedes**: <D<n> or "none">
```

---

<!-- entries start here -->

## D1: TypeScript stack with strict typing and ESM

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo)
- **Context**: The library is published for TypeScript consumers of Zod v4; the existing
  `CLAUDE.md`/`tsconfig.json` already mandate strict typing and ESM.
- **Decision**: TypeScript with `strict` + `exactOptionalPropertyTypes` +
  `noUncheckedIndexedAccess`, ESM with Node16 resolution (`.js` import extensions), and a
  ban on `any`.
- **Consequences**: Array indexing returns `T | undefined` (needs `!`/null checks); all
  imports carry `.js`. Type-safety is high; some boilerplate.
- **Rule added/changed**: "Code MUST NOT use `any`." and "All relative imports MUST use
  `.js` extensions (Node16 ESM resolution)."
- **Supersedes**: none

## D2: pnpm as the package manager

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo)
- **Context**: The repo is a pnpm workspace (`pnpm-workspace.yaml`, `pnpm-lock.yaml`)
  with the root library plus `packages/locale-*` and `playground/`.
- **Decision**: pnpm is the only package manager.
- **Consequences**: Deterministic installs and workspace ergonomics; npm/yarn must not be
  used.
- **Rule added/changed**: "The package manager MUST be pnpm."
- **Supersedes**: none

## D3: Read Zod v4 internals via `_zod.def`

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo)
- **Context**: Zod v4 stores schema definitions at `schema._zod.def` (not `_def` as in
  v3) and checks at `check._zod.def`; there is no stable public introspection API.
- **Decision**: Access Zod v4 internals directly via type-casting at `_zod.def`,
  accepting the coupling to v4's internal layout.
- **Consequences**: Schema-based generation works against v4; a future v4 internal change
  could break introspection and must be re-logged here if so.
- **Rule added/changed**: "Zod v4 internals MUST be read via `schema._zod.def` /
  `check._zod.def` (not `_def`)."
- **Supersedes**: none

## D4: Deterministic per-field PRNG

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo)
- **Context**: Reproducible fixtures are the core value proposition; values must be
  stable when schemas evolve.
- **Decision**: Seed a per-world PRNG and derive per-field generators via `Prng.fork(key)`
  (hash-based child PRNG that does not consume parent state). One world = one seed = one
  dataset.
- **Consequences**: Adding/removing a field does not disturb other fields' values; output
  is identical across runs/machines. (The PRNG algorithm itself — Mulberry32 → SFC32 — is
  an implementation detail tracked in the better-gen research, not a standing rule.)
- **Rule added/changed**: "Generation MUST stay deterministic: per-field PRNG `fork(key)`."
- **Supersedes**: none

## D5: Documentation lives in `docs/`; update on API change

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo + this integration)
- **Context**: End-user documentation moved from `wiki/` to `docs/` when this repo
  adopted the Vibin workflow (which claims `wiki/` as the build source of truth). The
  standing rule to keep the API reference current must follow the new location.
- **Decision**: End-user documentation lives under `docs/`; any public API change updates
  `docs/api-reference.md` in the same step.
- **Consequences**: `wiki/` is now the workflow spec, not the published docs; links from
  `README.md`/code point at `docs/`.
- **Rule added/changed**: "When a public API changes, `docs/api-reference.md` MUST be
  updated in the same step."
- **Supersedes**: none

## D6: Regression test required for bug fixes

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo)
- **Context**: Existing `CLAUDE.md` rule of engagement; aligns with the Vibin bug track.
- **Decision**: Every bug fix adds a regression test reproducing the reported failure.
- **Consequences**: Bugs are always handled on the full track (spec → tests-first →
  implement → review), never `mode: lite`.
- **Rule added/changed**: "When fixing a bug, a regression test MUST be added."
- **Supersedes**: none
