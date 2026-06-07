---
id: B87
title: Provenance capture sink — relation edges (ctx.related)
type: feature
priority: high
flags: [review]
created: 2026-06-03
predecessor: B85
phase: 4a
---

## Description

Third library card of B84's Phase 4a. Records each `ctx.related(name)` pick
as a `TraceEdge` in the `WorldTrace`. Without this, the Constellation view in
B90 has nodes but no edges.

### Scope (v1)

- Modify `ctx.related` (and `ctx.related.many`) in the engine to push a
  `TraceEdge` onto the world's trace when `trace: true`:
  - `from` — the producing record's stable ID (e.g. `order#2`)
  - `fromField` — the field path being resolved (e.g. `userId`)
  - `to` — the picked record's stable ID (e.g. `user#5`)
  - `relation` — the relation name from `withSchema(..., { relations: { … } })`
  - `kind` — `"one"` for `related()`, `"many"` for `related.many()`
  - `poolSize` — number of candidates the pick considered
  - `pickedIndex` — the index within the pool that was chosen
- For `related.many(count)` — one `TraceEdge` per picked record (so the
  Constellation can fan out edges from one field).
- Derived records (`withSchema(S, { from: T })`) emit a separate
  **lineage edge** (`kind: "one"`, `relation: "<derived-from>"`) when the
  derived record is constructed. The brainstorm calls this a "faint lineage
  edge"; the differentiation happens in the renderer (B90), the trace just
  records both.

### Constraints

- D4 / D10 / D9: capture is observation, no PRNG / counter side effects.
- D8: registered-schema storage contract preserved (transforms still apply
  before storage; the edge records the _stored_ `to` ID).
- D14: `generateArray` arms keep their trailing pass; edge capture happens
  per generated element.
- D13: no `node:*` imports.

### Acceptance

- `withSchema(User).withSchema(Order, { relations: { customer: User }, matchers: { userId: ctx => ctx.related("customer").id } })` →
  `world.populate(Order, 3); world.trace().edges` contains 3 `TraceEdge`s
  shaped `{ from: "order#N", fromField: "userId", to: "user#M", relation: "customer", kind: "one", poolSize: K, pickedIndex: I }`.
- `related.many(3)` produces 3 distinct edges from the same `fromField`.
- Derived records emit a lineage edge.
- With `trace: false` the edges array stays empty; no allocations.

### Notes

- Predecessor: [B85](B85-world-trace-api-and-types.md) (TraceEdge type).
- Sibling: [B86](B86-provenance-field-capture-sink.md) (field-level sink).
- **B113 spike ([report](../../research/engine/trace-capture-architecture.md)) decided the approach:**
  emit `TraceEdge` **at the `resolveRelationPool` pick site** (single + many), reading the
  already-computed `poolSize`/`pickedIndex`. **MUST NOT re-derive edges** — the spike proved
  `ctx.related` pool size at pick time is path-dependent and unrecoverable from final registry
  state (auto-provision + `store:false` ephemerals + `where` filters).
