---
id: B128
title: Docs search — replace the button→modal with a visible, working, styled input
type: bug
priority: medium
created: 2026-06-07
predecessor: B104
plan: wiki/research/reports/docs-ux-rework.md
---

## Description

Maintainer review: the search "is left-aligned, not well styled, and doesn't work." The B104
Pagefind **engine** is fine; its **UI** (a small button opening a `@dxlbnl/ui` Modal overlay)
is the problem. Per the plan, re-scope the search UI to a **visible, prominent search input**
(in the docs sidebar header), keep the Pagefind engine.

### Scope

- **Diagnose "doesn't work"** first — reproduce in the prod build/preview (Pagefind index only
  exists in the built site). Is it the Modal overlay's known a11y/focus issues (B104 stopgaps),
  the index not loading, or results not rendering? Fix the actual failure.
- Replace the button→Modal with a **visible search input** at the top of the docs sidebar/nav
  (not a left-aligned modal): typing queries Pagefind, results render as a styled dropdown/list
  with `/docs/...` links + the concept-filter summary (B104-R7). Keep it keyboard-operable
  (the B104 focus/Escape fixes carry the lesson). Style it properly (`@dxlbnl/ui`).
- Keep the Pagefind build-time index (B104/D25) + the concept synonyms.

## Acceptance

- A visible, styled search input is present in the docs chrome; typing a docs term returns
  linked results that navigate; it actually works in the prod build.
- `pnpm site:test:e2e` (extend/keep the B104 search tests for the new input) + `pnpm validate` green.

## Notes

- Bug → regression test. Independent of B125/B126 (can interleave). Supersedes B104's modal UI.
- Upstream `@dxlbnl/ui` Modal gaps (noted in B104) become moot if we drop the modal.
