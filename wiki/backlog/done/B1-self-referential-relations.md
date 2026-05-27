---
id: B1
title: Support self-referential relations
type: bug
priority: medium
flags: []
created: 2026-05-27
---

## Description

A schema can't currently relate to itself. For example a `category` with a
`parentId` that points at another `category` fails when wired via
`relations: { parent: categorySchema }` + `matchers: { parentId: (ctx) => ctx.related("parent").id }`.
Self-referential relations should resolve without infinite recursion, producing a
consistent parent id (and supporting a nullable root, e.g. top-level categories with
`parentId: null`).

## Notes

- Reproduction captured from the old `wiki/bugs.md`, now at `docs/bugs.md`.
- Per D6, this is a full-track bug: it needs a regression test reproducing the failure.
- Relevant code: `src/world.ts`, `src/registry.ts` (relation resolution).

## Resolution (2026-05-27)

- **Root cause**: `WorldImpl.resolveRelated` auto-provisioned a related record when the
  registry was empty. For a self-referential relation (`relSchema === reg.schema`) that
  re-entered the same matcher with the registry still empty → unbounded recursion →
  `RangeError: Maximum call stack size exceeded`.
- **Fix**: `resolveRelated` now detects the self-referential case and does **not**
  auto-provision — the first record's relation resolves to `undefined` (so the matcher
  can yield `null`), and later records reference earlier ones. Also returns `undefined`
  for any empty pool rather than indexing into it.
- **Regression test**: `tests/unit/core/relations.test.ts` → "self-referential relations
  (B1)" (4 cases: no recursion, root parentId null, batch FKs valid, no self-parent).
- **Docs**: `docs/api-reference.md` (`related()` self-ref note) + `docs/bugs.md` (moved to
  Resolved). Full suite green: 795 tests.
