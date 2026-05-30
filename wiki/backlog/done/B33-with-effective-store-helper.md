---
id: B33
title: Refactor — encapsulate `effectiveStore` state machine as `withEffectiveStore(value, fn)`
type: chore
priority: low
flags: []
created: 2026-05-29
---

## Description

The `effectiveStore` flag (B10 transitive store-suppression contract) is a
small state machine open-coded inside `WorldImpl.generate`:

```ts
const previousEffectiveStore = this.effectiveStore;
if (options?.store !== undefined) this.effectiveStore = options.store;
try {
  // ... single-item or array generation, which re-enters generate
} finally {
  this.effectiveStore = previousEffectiveStore;
}
```

There is no named state, no method called something like
`withEphemeralStorage(fn)`. The contract is part of B10 but invisible in code.

Extract:

```ts
private withEffectiveStore<R>(value: boolean | undefined, fn: () => R): R {
  if (value === undefined) return fn();
  const previous = this.effectiveStore;
  this.effectiveStore = value;
  try { return fn(); } finally { this.effectiveStore = previous; }
}
```

Then `generate` reads `return this.withEffectiveStore(options?.store, () => { ... })`.
The contract is named, the try/finally is encapsulated, and the next person
who needs to suppress storage for a new code path has somewhere to call.

## Notes
- Source: [B22 research report](../../research/reports/codebase-complexity.md), proposed item **#11**.
- Dimension: 4 (state machine).
- Size: **XS**.
