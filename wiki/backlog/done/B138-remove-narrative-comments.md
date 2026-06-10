---
id: B138
title: chore — remove narrative explanatory comments from internal src/ (keep non-obvious "why" + public-API TSDoc)
type: chore
priority: medium
flags: []
created: 2026-06-10
---

## Description

Follow-up to B137. B137 only stripped the `B`/`D` ID tokens but **kept the explanatory prose**;
the maintainer actually wants the transient *comments themselves* gone. Example: the whole
`@module` block in `src/generators/data/discrete.ts` (the closed-form-math narration) should be
removed, tag or not.

**Decided level (maintainer):** "**Keep only non-obvious why.**" Remove narrative "what/how" prose;
keep terse one-liners that flag a genuinely non-obvious decision or gotcha. Public-API TSDoc stays.

## Rules (executable definition)

**REMOVE** (across all of `src/`, internal code):
- `@module` / file-header blocks that narrate what the module does or how (e.g. `discrete.ts`'s
  closed-form derivation, "Pure-Math.* only — isomorphic", etc.).
- Comments that **restate or narrate** what the code plainly does or how the mechanism works
  (step-by-step descriptions, algorithm walkthroughs, "this does X then Y").
- Section-divider / banner comments (`// ----- Foo -----`, `// === Bar ===`).
- Narrative TSDoc prose on **internal** (non-public-surface) functions/types.

**KEEP:**
- **Curated public-API TSDoc** — the TSDoc on what `src/index.ts` exports and the member docs
  TypeDoc renders into `/docs/api` (D5/D27): `generate`, `createWorld`, `createPrng`, `generators`,
  `DEFAULT_KEY_MAP`, `DEFAULT_KEY_PATTERNS`, the public `World`/`Registry`/options/locale types
  (incl. `GenerationDefaults`), and the `world.trace()` types (`WorldTrace`/`TraceNode`/
  `TraceField`/`TraceEdge`/`TraceResolution`, D26). Leave these blocks intact.
- **`@internal` and tooling JSDoc tags** — `@internal` (D29; on `GenerateOptions.source`/
  `fieldPath`/`prng`/`recordIndex` and `GeneratorContext.overrideArrayLength`), plus `@param`/
  `@returns`/`@example`/`@deprecated`/`@module` where the block itself is kept. Never drop an
  `@internal` tag (it controls TypeDoc exclusion — dropping it leaks the symbol into `/docs/api`).
  If an internal symbol's only doc is narrative, the block may go *with* its `@internal` IF the
  symbol is not exported/reachable from a public type; if in doubt, keep `@internal` and remove the
  narrative sentences around it.
- **Terse non-obvious "why" one-liners** — a comment that warns about something a reader would
  plausibly get wrong: a gotcha, a counter-intuitive invariant, a perf-critical structure that
  looks refactorable but isn't, a workaround for an external quirk. Keep these (tighten to one
  line if needed). Examples to KEEP: `// Ensure key is a string and not "[object Object]"`;
  a one-liner noting Zod v4 stores defs at `_zod.def`. Reduce, don't delete, the why.

**Heuristic for the judgment call:** if deleting the comment would lose information that prevents a
future bug or explains a counter-intuitive choice → keep it (terse). If it just describes what the
code already says → delete it.

**ZERO code changes.** Comments only; strictly behaviour-neutral.

## Acceptance

- Internal `src/` modules carry no narrative `@module`/explainer blocks or section dividers; only
  terse non-obvious "why" comments remain.
- `discrete.ts` is reduced to imports + code (its `@module` block removed) — the maintainer's
  reference case.
- Public-API TSDoc (the `/docs/api` surface) intact; all `@internal` tags intact.
- `pnpm validate` green; full suite unchanged (the 3 pre-existing `B126-twoslash-samples` ENOENT
  failures remain). `git diff` shows comment-only changes (no executable-line edits).

## Out of scope

- `tests/`, `site/`, `docs/`, `packages/`, `wiki/` — `src/` only.
- `site/src/lib/docs/api/api-model.generated.ts` — generated; regenerates from TSDoc at site build.
- Changing the public-API TSDoc itself (kept as-is) or the D5/D27 doc rule.

## Notes

- Behaviour-neutral chore → `implementer` → `reviewer`.
- Builds on B137 (which removed the IDs). After B138, internal code is comment-light: code + the
  occasional terse gotcha.
- No changeset (comments only). GitHub issue: none.
