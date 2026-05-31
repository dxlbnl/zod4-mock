---
id: B31
title: Refactor — extract `resolveLazyChain(schema, cache)` helper (removes 4 copies)
type: chore
priority: low
flags: []
created: 2026-05-29
---

## Description

The `while (d.type === "lazy")` loop that unwraps `z.lazy(...)` schemas
appears in four near-identical places:

- [src/world.ts:350](../../src/world.ts#L350) — inside `generate`.
- [src/world.ts:780](../../src/world.ts#L780) — inside `generateObjectFields`.
- [src/world.ts:1040](../../src/world.ts#L1040) — inside `generateSingleItem`.
- [src/explain.ts:251](../../src/explain.ts#L251) — inside `explainSchema`.

Extract:

```ts
function resolveLazyChain(schema: ZodTypeAny, cache: WeakMap<ZodTypeAny, ZodTypeAny>): ZodTypeAny {
  let s = schema;
  while (def(s).type === "lazy") {
    const cached = cache.get(s);
    if (cached) {
      s = cached;
      continue;
    }
    const resolved = def(s).getter();
    cache.set(s, resolved);
    s = resolved;
  }
  return s;
}
```

Cuts ~30 LOC and one drift risk. XS, mechanical.

## Notes

- Source: [B22 research report](../../research/reports/codebase-complexity.md), proposed item **#9**.
- Dimension: 3 #5.
- Size: **XS**.
- Cross-cutting observation #1 in the research report.
