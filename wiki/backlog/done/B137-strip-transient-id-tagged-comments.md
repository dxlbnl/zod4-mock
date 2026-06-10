---
id: B137
title: chore — strip transient backlog/decision-ID-tagged comments from src/
type: chore
priority: medium
flags: []
created: 2026-06-10
---

## Description

Maintainer: the codebase carries a lot of transient comments anchored to backlog/decision
identifiers (`B12`, `B23`, `B53-R2`, `B97-R15`, `D14`, …). They are build-time bookkeeping, not
durable documentation. Remove them.

**Decided scope (maintainer):** delete ID-tagged comments **wholesale** (prose and all),
across **all of `src/`**. ~330 ID-ref lines across 26 files (concentrated in
`src/world/engine.ts` ~175 and `src/pipeline.ts` ~39).

## Rules (executable definition)

**DELETE wholesale** — any **implementation comment** (`//` line comments and `/* … */` block
comments that are NOT JSDoc) that references a backlog/decision identifier:
`B<n>`, `D<n>`, `B<n>-R<k>` (e.g. `B23`, `B97-R15`, `D14`, `B134-R3`). If the comment is entirely
such rationale, remove the whole comment (and its now-empty leading blank line). The maintainer
accepts the loss of the embedded "why".

**PROTECT (do NOT delete) — strip the IDs from inside, keep the prose + tags:**

- **TSDoc/JSDoc blocks (`/** … */`) on PUBLIC exports** — the TSDoc on `src/` public exports is
  the prose source of truth for `/docs/api` (TypeDoc; D5/D27). Do NOT delete these blocks. Remove
  only the inline `B`/`D` ID tokens / ID-prefixes (e.g. `B23 — walks…` → `Walks…`), keeping the
  description timeless and intact.
- **Any JSDoc tag that drives tooling** — `@internal` (D29 — TypeDoc exclusion), `@param`,
  `@returns`, `@example`, `@deprecated`, etc. MUST be preserved. Never delete a block that carries
  these; only strip the ID references from its prose.

**ZERO code changes.** Only comments are touched. No identifier rename, no logic edit, no
formatting churn beyond removing the comment lines (+ running `pnpm fmt` if needed). This is
strictly behaviour-neutral.

## Acceptance

- No `//` or non-JSDoc `/* */` implementation comment in `src/` references a `B`/`D` identifier.
- Public-export TSDoc blocks remain (prose preserved, ID tokens removed); all `@internal`/`@param`/
  `@returns` tags intact.
- `pnpm validate` (typecheck + test + lint + fmt:check) is green; the full test suite passes
  unchanged (the 3 pre-existing `B126-twoslash-samples` ENOENT failures remain, unrelated).
- `git diff` shows only comment removals / ID-token strips — no executable-line changes.

## Out of scope

- Non-ID-anchored comments (e.g. `// unchanged byte-for-byte`, `// Ensure key is a string`) — the
  maintainer scoped this to **ID-tagged** comments only. A broader "transient prose" sweep, if
  wanted, is a separate item.
- `tests/`, `site/`, `wiki/`, `docs/`, `packages/` — `src/` only.
- `site/src/lib/docs/api/api-model.generated.ts` — generated, never hand-edited; it regenerates
  from the (now-cleaner) TSDoc at the next site build.

## Notes

- Behaviour-neutral chore → `implementer` → `reviewer` (no spec, no tests-first).
- The `@internal` preservation matters: `GenerateOptions.source/fieldPath/prng/recordIndex` and
  `GeneratorContext.overrideArrayLength` rely on `@internal` for TypeDoc exclusion (D29) — stripping
  the tag would leak them into `/docs/api`.
- No changeset needed (no shipped behaviour/API change — comments only). If the repo's convention
  requires a changeset for every commit, add a `patch` "chore: …" note; otherwise omit.
- GitHub issue: none.
