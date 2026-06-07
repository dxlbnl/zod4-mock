---
id: B86
title: Provenance capture sink — per-field resolution + sibling reads
type: feature
priority: high
flags: [review]
created: 2026-06-03
predecessor: B85
phase: 4a
---

## Description

Second library card of B84's Phase 4a. Threads a provenance-capture sink
through the per-field pipeline so each `TraceField` records _how_ its value
was decided.

### Scope (v1)

- Thread a `TraceSink` (or equivalent) through `generateObjectFields` (in
  `src/world/engine.ts`) and `walkPipeline` (in `src/pipeline.ts`).
- For each field, the sink receives the `FieldResolution` that already gets
  computed (`src/pipeline.ts`) and writes a `TraceField` onto the current
  `TraceNode`:
  - `path` — e.g. `address.street`
  - `value` — the produced value
  - `resolution` — the `FieldResolution["kind"]` literal
  - `generator` — generator name (already in `explain` strings)
  - `reason` — human reason (already in `explain` strings)
  - `forkKey` — the per-field PRNG fork key (e.g. `person#1 ▸ firstName`)
  - `overridden` — true if `options.overrides` merged onto this field
  - `dependsOn` — sibling paths read via `ctx.current` during this field's resolution
- **Absent optionals**: when the optional/nullable/default roll lands on
  "absent" (the wrapper coin-flipped away), still record a `TraceField` with
  `resolution: "absent"` and `value: undefined`. This makes the brainstorm's
  "show greyed absent optionals" possible.
- **Opt-in** behind the world's `trace: true` flag (per B84 §10 Q4) — when off,
  the sink is a no-op and zero allocations happen on the hot path.

### Constraints

- D4 / D10 determinism preserved — provenance capture must not consume PRNG
  state or advance counters. The capture is observation, not mutation.
- D9: cache short-circuits remain PRNG/counter-neutral; if a path bypasses the
  pipeline, the trace sink also gets nothing (cache hits don't fabricate
  provenance).
- D11: the canonical PIPELINE in `src/pipeline.ts` stays the source of truth;
  the sink lives in `PipelineStepContext`, not in a parallel ladder.
- D13 (isomorphism): pure-JS, no `node:*`.

### Hot-path benchmark

`pnpm site:bench` with `trace: false` (the default) must show **no measurable
regression** vs the pre-B86 baseline. With `trace: true`, document the
overhead in the bench output. Used to inform the v2 "always-on" ADR.

### Acceptance

- After B86: `createWorld({ seed: 1, trace: true })` generates a record; `world.trace().nodes[0].fields` contains a `TraceField` per field with the right `resolution` / `generator` / `reason` / `forkKey`.
- Sibling `dependsOn` populated for matchers that read `ctx.current.<sibling>`.
- Absent-optional fields appear with `resolution: "absent"` / `value: undefined`.
- Hot-path bench with `trace: false` shows no regression.
- Tests cover each of the 7 resolution rungs (`override`, `matcher`, `key-map`, `default`/`absent`, `custom-gen`, `key-based`, `schema-based`).

### Notes

- Predecessor: [B85](B85-world-trace-api-and-types.md) (types must exist).
- Sibling: [B87](B87-provenance-relation-edge-sink.md) (relations).
- ADR + Rule at close: opt-in trace flag is a standing constraint until v2.
- **B113 spike ([report](../../research/engine/trace-capture-architecture.md)) decided the approach:**
  gated **capture-during** in `generateObjectFields`/`walkPipeline` (NOT re-derive) — off-path
  (`trace:false`) measured allocation- and throughput-neutral. Map internal `FieldResolution["kind"]`
  → public `TraceResolution` at the capture boundary; reuse the `explain()` generator/reason
  vocabulary (B85-R12). Extract capture into a helper to keep the B23-R9 body-length guard green.
