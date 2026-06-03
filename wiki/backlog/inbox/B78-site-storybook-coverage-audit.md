---
id: B78
title: Audit Storybook coverage gaps in site/src/lib/components
type: chore
priority: low
created: 2026-06-03
provenance: gen-bench X4
---

## Description

Verify every component in `site/src/lib/components/` has a `.stories.svelte`
sibling. List missing stories, write them, or document a deliberate skip.

Acceptance: a Storybook coverage report (`pnpm site:storybook` build) shows
either a story for every component or a documented skip.
