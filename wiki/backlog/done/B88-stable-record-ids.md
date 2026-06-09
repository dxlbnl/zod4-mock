---
id: B88
title: Stable record IDs exposed as TraceNode.id (friendly person#1)
type: feature
priority: high
flags: [review]
created: 2026-06-03
predecessor: B85
phase: 4a
spec: wiki/specs/B88-stable-record-ids.md
---

## Description

Fourth library card of B84's Phase 4a. Surfaces the internal record IDs that
the engine already computes for PRNG seeding, in the friendly form
maintainer locked at B84 §10 Q3.

### Scope (v1)

- The engine already computes IDs at `src/world/engine.ts`:
  - `reg${id}#${index}` for primary registrations.
  - `dreg${id}#${index}` for derived registrations.
- Expose these as `TraceNode.id` in the friendly form **`<typeName>#<index>`**
  (e.g. `person#1`, `order#5`) — per B84 §10 Q3.
- The `typeName` source is the registration's display name:
  - `withSchema(S)` — name comes from the schema (Zod schemas have an optional
    description; if absent, fall back to a stable schema-identity-derived name).
  - `defineSubjectType(name, S)` — name is the explicit `name` argument.
- For derived registrations (`withSchema(S, { from: T })`) — use the derived
  schema's name, not the source's (the derived record is a node of its own
  type in the Constellation; lineage to source is shown via B87's lineage edge).
- IDs are stable across world instances with the same `withSchema` /
  `defineSubjectType` chain and the same seed — same generation order, same
  IDs (D4 / D10 invariant).

### Constraints

- **No PRNG impact** — the friendly ID derivation is post-hoc; the internal
  `reg${id}#${index}` keying that drives `Prng.fork()` stays exactly as is.
  This is a display layer, not a generation layer.
- **No collision** — two schemas with the same display name on the same world
  is allowed by the existing engine; the friendly ID disambiguates with a
  numeric suffix or refuses to register at higher precision. **Recommended**:
  reject at `withSchema` time when display-name + polarity collides (matches
  D12's "polarity must be unambiguous" pattern). Surface as a clear error.
- D5: docs/api-reference.md notes the public ID format.

### Acceptance

- After B88: `world.trace().nodes[0].id` reads `person#1` (not `reg0#0`).
- Two worlds built from the same chain + same seed produce traces with
  identical `TraceNode.id` lists across runs and machines.
- A naming collision at registration throws with a clear error message
  naming both registrations and the collision token.

### Notes

- Predecessor: [B85](B85-world-trace-api-and-types.md).
- ADR + Rule at close: the public ID shape is a binding contract; users may
  copy IDs from `world.html` into bug reports or share traces.
- Brainstorm Q1 (ID display scheme) is fully answered here.
