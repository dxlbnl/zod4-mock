---
id: B113
title: Research spike — trace capture architecture (capture-during vs re-derive/hybrid)
type: research
priority: high
created: 2026-06-07
gates: [B85, B86, B87]
report: wiki/research/engine/trace-capture-architecture.md
---

## Description

Before B85's `world.trace()` contract is finalized and B86/B87 commit to a capture
mechanism, **measure** whether the trace API can introspect generation **without a
generation-time performance hit**. The question was raised by the maintainer at B85's
review checkpoint.

### The fork

- **A — capture-during:** thread a provenance-capture sink through the per-field pipeline
  (`generateObjectFields` / `walkPipeline`) + `ctx.related`. Opt-in via
  `createWorld({ trace: true })`. Records reality (trivially correct), but instruments the
  hot loop (a `TraceField` allocation per field when on; a gating cost even when off — B86
  already demands a hot-path benchmark to prove no off-path regression).
- **B — re-derive on demand:** leave the `generate()` hot path untouched; compute
  provenance only when `world.trace()` is called, by replaying generation under a capturing
  context. The codebase already does PRNG-neutral re-derivation in `world.explain()`
  (`src/explain.ts`), so the pattern exists. Zero hot-path cost; no opt-in flag. The hard
  part is **edges** (`ctx.related` picks depend on registry/pool state at generation time —
  replay must reconstruct it faithfully).
- **Hybrid:** re-derive _fields_ (the expensive ~per-field-allocation part → on-demand),
  cheaply capture _edges_ (rare — one per relation pick) plus lightweight **per-record**
  metadata (schema + options each record was generated with) to drive the replay.

### What to measure / answer

1. **Off-path cost of A:** prototype a gated/no-op sink threaded through the field pipeline;
   benchmark `generate()`/`populate()` against the current baseline on a representative
   schema (use the project's bench harness — `pnpm bench` / `scripts/bench` / the `site/bench`
   schemas). Is there a measurable regression when `trace: false`? By how much?
2. **On-path cost of A:** same with `trace: true` — allocations + latency for N records × M
   fields.
3. **Re-derive latency + allocations (B):** prototype computing `TraceField` provenance for a
   stored record by replaying its generation under a capturing context (extend the `explain`
   machinery to also capture values). Measure `world.trace()` latency for N records and peak
   allocations. Confirm it reproduces the same values + decisions deterministically.
4. **Edge-replay fidelity:** can a `ctx.related` edge be faithfully re-derived, or must it be
   captured at generation time? What per-record metadata would a replay need (options,
   overrides, transform, schema ref)?
5. **Recommendation:** A, B, or hybrid — and the concrete consequence for **B85's contract**
   (does the `createWorld({ trace: true })` flag survive? is `trace()` always-available?), plus
   the shape B86/B87 should take.

### Constraints

- Prototype in an **isolated worktree** (throwaway code — do NOT land prototypes on main).
- Use the project's own bench tooling; do not hand-roll ad-hoc node timing scripts where the
  bench harness applies.
- Honor D13 (re-derive/replay must stay runtime-agnostic — no `node:*` in shipped paths).

## Acceptance

- `wiki/research/engine/trace-capture-architecture.md` answers questions 1–5 with **measured
  numbers** (not just analysis), names the recommended architecture, and states the explicit
  consequence for B85's contract (the opt-in flag) + B86/B87's approach.

## Notes

- Gates B85 (parked), B86, B87. Source: B85 review-checkpoint discussion (2026-06-07).
- `world.explain()` (`src/explain.ts`, PRNG-neutral re-derivation) is the existing precedent
  for approach B.
