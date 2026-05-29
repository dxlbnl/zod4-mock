---
id: B30
title: Refactor — extract `unwrapOptionalChainForField` helper (removes 2 copies)
type: chore
priority: medium
flags: []
created: 2026-05-29
---

## Description

The optional/nullable/default unwrap loop appears in two places with the
same state machine (`isAbsent` roll, `default` capture, `fallbackValue`
carry, `skip` bailout):

- [src/world.ts:853-878](../../src/world.ts#L853) — inside `generateObjectFields`.
- [src/generators/schema/collection.ts:218-241](../../src/generators/schema/collection.ts#L218) — inside `generateZodObject`.

Extract a shared helper:

```ts
function unwrapOptionalChainForField(
  fieldSchema: ZodTypeAny,
  prng: Prng,
  optProb: number,
): { inner: ZodTypeAny; absent: { kind: "skip" | "default"; value?: unknown } | null }
```

Each call site shrinks to ~5 lines. Removes the drift risk between the two
"object-field generators" — the world's full-ladder version and the
collection.ts key-based-fallback version.

## Notes
- Source: [B22 research report](../../research/codebase-complexity.md), proposed item **#8**.
- Dimensions: 3 #6, 4 (key-based vs schema-based convergence).
- Size: **S**.
- Synergy: helps B23 (the `unwrapOptionalStep` of the `PIPELINE` list calls this helper). Can land independently.
