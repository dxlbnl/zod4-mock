---
id: B85
title: world.trace() API + WorldTrace types (public contract)
type: feature
priority: high
flags: [review]
created: 2026-06-03
predecessor: B84
phase: 4a
spec: wiki/specs/B85-world-trace-api-and-types.md
---

> **B113 spike resolved (2026-06-07):** the trace-capture research
> ([report](../../research/engine/trace-capture-architecture.md)) **validated this card's
> contract unchanged** — keep `createWorld({ trace: true })` (it gates retained memory, not
> an off-path regression, which the spike measured as zero). Capture-during is the chosen
> mechanism for B86/B87 (re-derive rejected — `ctx.related` edges aren't re-derivable).
> Unblocked; resuming the implementer against the existing spec + RED tests
> (`tests/unit/core/world-trace.test.ts`).

## Description

First library card of B84's Phase 4a (World Explorer foundation). Establishes the
public surface that B86/B87/B88 fill in and B90 consumes from the site.

### Scope (v1)

- New public method on `World`: `world.trace(): WorldTrace`. Returns the full
  provenance structure for everything generated so far in the world's lifetime.
  Empty / stub implementation: returns nodes from the registry with stable IDs
  (B88) + the record value. **No field-level capture (B86) or edge capture
  (B87) at this card** — those land in their own cards.
- New public types in `src/trace.ts` (preferred over expanding `src/types.ts`):
  - `WorldTrace { seed: number; nodes: TraceNode[]; edges: TraceEdge[] }`
  - `TraceNode { id: string; type: string; index: number; value: unknown; derivedFrom?: string; store: boolean; fields: TraceField[] }`
  - `TraceField { path: string; value: unknown; resolution: FieldResolution["kind"]; generator: string; reason: string; forkKey: string; overridden: boolean; dependsOn: string[] }`
  - `TraceEdge { from: string; fromField: string; to: string; relation: string; kind: "one" | "many"; poolSize: number; pickedIndex: number }`
- JSON-serializable end-to-end (no class instances, no functions, no symbols).
- Exported from `src/index.ts` as part of the public API.

### Constraints

- **Opt-in capture** per B84 §10 Q4: trace fills out only when the world was
  built with `createWorld({ trace: true })`. Default behaviour returns an empty
  `WorldTrace` skeleton (the registry projection only — no provenance).
- **Friendly IDs** per B84 §10 Q3 — `TraceNode.id` shape is `<typeName>#<index>`
  (see B88 for the ID generation card).
- **Stable contract**: once shipped, `WorldTrace` is part of the public API.
  Any breaking change is a major bump (zod4-mock is pre-1.0; this just means a
  minor bump under the 0.x SemVer convention until 1.0).
- D5: `docs/api-reference.md` updated in the same step.
- D13 (isomorphism): no `node:*` imports; pure types + plain object construction.

### Acceptance

- `world.trace()` exists on `World` and returns a `WorldTrace`.
- All four public types are exported.
- With `createWorld({ seed: 1 })` (no trace flag): `world.generate(S); world.trace()` returns `{ seed: 1, nodes: [...], edges: [] }` where every node has `fields: []` (no provenance — opt-in defaults off).
- With `createWorld({ seed: 1, trace: true })`: same shape returned but the empty arrays remain pending B86/B87.
- `docs/api-reference.md` documents the new method + types.

### Notes

- Establishes the contract; B86 (field capture sink), B87 (edge capture sink),
  B88 (friendly IDs) fill in the substance.
- ADR + Rule are recommended at close: the trace shape becomes a binding contract.
- Predecessor: [B84](../done/B84-site-architecture-rebuild.md) §6.
- Brainstorm: [world-explorer.md](../../research/world-explorer.md).
