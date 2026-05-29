---
id: B29
title: Refactor — split `applyModifiers` into string + number pipelines of named passes
type: chore
priority: medium
flags: []
created: 2026-05-29
---

## Description

`applyModifiers` ([src/generators/schema/zod-def.ts:76-180](../../src/generators/schema/zod-def.ts#L76),
105 LOC, ~34 branches) is a 5-pass string-post-fixer (overwrites → format
adds → length bounds → format re-fix → overwrites re-apply) that also
contains the number-modifiers in parallel. Two unrelated concerns share one
function; it iterates `checks` three times.

Split into:

```ts
function applyStringModifiers(value: string, checks: Check[], prng: Prng): string {
  return STRING_PASSES.reduce((acc, pass) => pass(acc, checks, prng), value);
}

function applyNumberModifiers(value: number, checks: Check[], prng: Prng): number {
  return NUMBER_PASSES.reduce((acc, pass) => pass(acc, checks, prng), value);
}
```

Each pass becomes a named function (`overwritePass`, `formatAddPass`,
`lengthBoundsPass`, `formatRefixPass`, `overwriteRefixPass`). The order is
then the only thing the caller has to read.

## Notes
- Source: [B22 research report](../../research/codebase-complexity.md), proposed item **#7**.
- Dimensions: 1 #2, 3 #4.
- Size: **S**.
