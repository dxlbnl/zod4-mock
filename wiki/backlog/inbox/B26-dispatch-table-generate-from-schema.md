---
id: B26
title: Refactor — replace `generateFromSchema`'s 38-case switch with a typed dispatch table
type: chore
priority: medium
flags: []
created: 2026-05-29
---

## Description

`generateFromSchema` ([src/generators/schema/router.ts:54-223](../../src/generators/schema/router.ts#L54),
170 LOC, 38 `case`s over `def.type`) is the engine's type-router. Long
switches with stable arms are fine to read top-down but resist scanning and
are a pain to extend safely — adding a new Zod type is silent if missed.

Replace with a typed dispatch table:

```ts
type GenFn = (schema: ZodTypeAny, ctx: GeneratorContext) => unknown;

const DISPATCH: Record<ZodDefType, GenFn> = {
  string: (s, ctx) => generateZodString(s, ctx),
  number: (s, ctx) => generateZodNumber(s, ctx),
  union:  (s, ctx) => generateZodUnion(s, ctx),
  // ...
};
```

The four cases that contain non-trivial branching (`union`, `pipe`, `xor`,
`intersection`) become their own named functions. `generateFromSchema` is then
a 2-line lookup. New Zod type → compile error if missed.

## Notes
- Source: [B22 research report](../../research/codebase-complexity.md), proposed item **#4**.
- Dimensions: 1 #1, 2 #7.
- Size: **M**.
- Synergy: helps the `explain.ts` story (it can iterate `Object.keys(DISPATCH)` to enumerate what it can introspect).
