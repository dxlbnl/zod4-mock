---
id: B25
title: Refactor — extract `resolveMode(schema): SchemaMode` and unify derived/primary/ad-hoc dispatch
type: chore
priority: medium
flags: []
created: 2026-05-29
---

## Description

The pattern

```ts
const derivedRegs = this.findDerivedRegs(schema);
const primaryRegs = this.findPrimaryRegs(schema);
// ... then if (derivedRegs.length > 0) ... else if (primaryRegs.length > 0) ... else ad-hoc
```

appears in `WorldImpl.generateSingleItem` ([src/world.ts:1030](../../src/world.ts#L1030)),
`generateArray` ([src/world.ts:917](../../src/world.ts#L917)), `populate`,
and implicitly in `populateFrom`. Same dispatch tree four times.

Extract:

```ts
type SchemaMode =
  | { kind: "derived";   regs: SchemaReg[] }
  | { kind: "primary";   reg:  SchemaReg }
  | { kind: "ad-hoc" };

private resolveMode(schema: ZodTypeAny): SchemaMode { ... }
```

Each caller becomes `const mode = this.resolveMode(schema); switch (mode.kind) { ... }`.
Removes ~80 LOC of structural code. Type-safe, identity-equality lookup, no
behaviour change.

## Notes
- Source: [B22 research report](../../research/reports/codebase-complexity.md), proposed item **#3**.
- Dimensions: 4 (registry interactions), 1 #7 (generateArray complexity).
- Size: **M**.
- Synergy: pairs well with B24 (`generateSingleItem` decomposition) — landing this first makes B24's dispatcher one line.
