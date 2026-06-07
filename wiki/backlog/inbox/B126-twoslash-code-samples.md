---
id: B126
title: Code samples → Shiki + Twoslash (type-checked, clickable types link into the API reference)
type: feature
priority: high
created: 2026-06-07
predecessor: B125
plan: wiki/research/reports/docs-ux-rework.md
---

## Description

Per the approved plan: render docs code samples with **Shiki + Twoslash** — real syntax
highlighting, **build-time type-checking** (a sample that doesn't compile is a build error →
kills the undefined-`UserSchema`/missing-import class of bug), and **clickable type tokens
that link into the TypeDoc API reference** (B125). The spike proved the seam works.

### Scope

- Add `@shikijs/twoslash` + `twoslash` (build-time devDeps). Slot the **twoslash transformer**
  into the site's existing Shiki call (mdsvex `highlight.highlighter` / the `codeToHtml`
  path) — a transformer add, not a new pipeline. Reuse a warm `createTwoslasher` program for
  build speed.
- **Type-check every docs sample** against the real `zod4-mock` types (resolve the workspace
  package). Invalid samples fail the build.
- **Clickable type-links → reference (the spike's mapping):** per twoslash token, get its
  declaration `file:line` (TS language service `getDefinitionAtPosition`), join to the TypeDoc
  JSON `sources.{fileName,line}` index (from B125), derive the reference URL, and wrap the
  token in an `<a href>` via `@shikijs/twoslash`'s `rendererRich().nodeStaticInfo` hook. Verify
  no dead links (e.g. `seed` resolves to GenerateOptions vs WorldOptions by location).
  **CRITICAL:** the language service + TypeDoc must agree on src-vs-dist (tsconfig `paths`→src,
  or both on dist) or the join silently yields 0 links.

## Acceptance

- A docs code sample renders highlighted with type-aware hover info; an intentionally-broken
  sample (undefined symbol / missing import) fails the build.
- A type token in a sample (e.g. `generate`, `GenerateOptions`, `World`) is a clickable link
  resolving to its `/docs/api` entry; no dangling type-links (build guard green).
- `pnpm site:test:e2e` + `pnpm validate` green; build prerenders.

## Notes

- Depends on B125 (the TypeDoc reference is the link target + the JSON join source).
- Replaces/closes B109 (Shiki highlighting) and B112 item 2/3 (code rendering) — fold/close them.
- Build-time only (D13-exempt). Add a rule (with B125): code samples are Twoslash-type-checked.
