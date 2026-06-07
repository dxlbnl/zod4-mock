# Trace capture architecture — capture-during vs re-derive vs hybrid (B113)

> Research spike commissioned at B85's review checkpoint (2026-06-07) to answer the
> maintainer's question: can `world.trace()` introspect generation **without a
> generation-time performance hit**? Prototyped + measured in an isolated worktree
> against live `main` (`6ab49f7`); prototype code was throwaway. Gates B85/B86/B87.

## Question

Can `world.trace()` expose per-field provenance + relation edges **without a
generation-time performance hit**? Decide between **A — capture-during** (thread a gated
sink through the per-field pipeline), **B — re-derive on demand** (replay a record under a
capturing context, extending the `explain()` precedent), or a **hybrid**, and state the
consequence for B85's `createWorld({ trace: true })` opt-in flag and for B86/B87.

## Method

- **Worktree:** prototyped against the real engine (`src/world/engine.ts`,
  `src/pipeline.ts`, `src/explain.ts`, `src/world/relations.ts`, `src/registry.ts`), reset
  to current `main` HEAD (`6ab49f7`).
- **Harness:** the project's own `measure()` from `site/src/lib/bench.ts` (warmup +
  time-budget loop, B71), wrapped in a median-of-5-trials helper. Heap via
  `process.memoryUsage().heapUsed` with `--expose-gc`.
- **Schemas:** the canonical bench set from `site/src/lib/schemas/` — `nested` (7 fields
  incl. nested object + array + record, no relations) for the field path; the `matcher`
  tier (`CompanySchema` + `UserSchema` with an `employer` relation + `ctx.related`) for
  edges. N = 100 records/call.
- **A prototype:** patched the engine — `trace?: boolean` on `WorldOptions`, a `traceOn`
  flag + `traceSink` on `WorldImpl`, gated `if (this.traceOn) sink.push({...TraceField})`
  in `generateObjectFields`'s per-field loop. OFF = gate false (`trace:false`); ON =
  `trace:true`. Ran the full library suite to prove behaviour-neutrality.
- **B prototype:** replayed a record by re-running the same registrations + seed in a fresh
  `trace:true` world and reading the sink — faithful because each record's field PRNG is
  seeded from its `recordId` (`reg<regId>#<index>`). Measured replay latency + peak alloc;
  verified value/decision parity.
- **Edge fidelity:** a probe generating a user against a small Company pool, growing the
  pool, then replaying against (a) final registry state and (b) reconstructed
  pool-at-pick-time state.

## Measurements

All per-call figures are for **100 records/call**; deltas are median-of-5 vs baseline.
Absolute numbers are machine-relative; the **deltas and allocation figures are the signal**.

**1. Baseline throughput (no trace)**
- `nested` ad-hoc: ~7.6 ms / 100 records (~131 call/s) → ~76 µs/record.
- `matcher` `populate`: ~2.8 ms / 100 records (~360 call/s) → ~28 µs/record.

**2. Approach A — OFF-path (gated sink threaded, `trace:false`)**
- `nested`: delta **−0.9% to +2.1%** across runs (both directions).
- `matcher`: delta **−2% to +10%** across runs (both directions).
- **No measurable regression.** The off-path is a single boolean branch per field that V8
  predicts perfectly; the delta is run-to-run noise and frequently *negative*. The B97-R2
  allocation-budget test (1000 `generate` calls < 5 MB) **passes** with the patch — the
  off-path allocates nothing.

**3. Approach A — ON-path (`trace:true`)**
- Throughput delta also within noise (**−1.7% to +3.4%**) — the field pipeline dominates;
  one object push per field is not a detectable *time* cost.
- **Allocation is the real ON-path cost:** GC-settled retained size of a `TraceField` ≈
  **193 bytes**. For `nested` (700 fields/100 records) ≈ **~132 KiB** retained per 100
  records — linear in fields×records, and *retained* (the point is to keep it).

**4. Approach B — re-derive on demand**
- `trace()` latency to replay 100 `nested` records: **~7.9 ms** — **≈ a full second
  generation pass** (≈ the ~7.6 ms baseline). Paid at `trace()`-call time.
- Peak allocation for the replay: **~11 MB** for 100 records — one extra generation's worth
  of transient garbage, ~85× the 132 KiB approach A retains. Transient/collectable, but the
  per-`trace()` spike.
- **Determinism confirmed:** `trace:false` vs `trace:true` record values are
  **byte-identical**; replayed per-field values + resolutions match originals (e.g.
  `id=key-based`, `email=key-based`, `address.zip=schema-based`).

**5. Edge-replay fidelity (decisive)**
A `ctx.related` pick is `items = registry.all(relSchema)` snapshot **at pick time** (filtered
by `where`), then `recordPrng.fork("rel:<name>").int(0, items.length−1)`. The fork key is
reconstructible from `recordId`; **`items.length` is not** — it depends on how many related
records existed *at the moment of the pick*.

Probe: a user generated when the Company pool held **3** picked `eababfd8`. Replayed against
the **final 8-company** registry it picked `acb83262` — **DIFFERS**. Replayed against a
reconstructed **3-company pool-at-pick-time** it picked `eababfd8` again — **MATCH**.
(Company identities are stable across replays — same seed — so pool *content* is
reconstructible; the missing ingredient is its **size/membership at pick time**.)

## Edge analysis

- **Edges are NOT faithfully re-derivable from final registry state alone.** Any interleaved
  generation (`populate(Company,3); generate(User); populate(Company,5)`), `where`-filtered
  pool, `store:false` ephemeral, or mid-stream relation auto-provisioning makes the per-pick
  pool size path-dependent and unrecoverable from the end state. A re-derive that wants edges
  must replay the **entire world in original insertion order** — far more than "replay one
  record."
- **Edges are trivially cheap to capture at generation time:** one record emits at most a few
  relation picks (vs ~7+ field allocations), and `resolveRelationPool` already computes
  exactly `{ items, pickedIndex, poolSize }` — the `TraceEdge` payload is sitting right there
  at the pick site for free.
- **Per-record metadata a field-replay would need** (none persisted today): the **schema
  reference** + the per-`generate()`-call options that change the record and its resolution —
  `overrides` (step-0 eager + deep-merge → changes `resolution.kind`), `transform`, `source`
  (derived), `store` mode, `locale`, `defaultArrayLength`, `unique`.

## Recommendation — Hybrid, leaning capture-during

Adopt the **hybrid**, which in practice collapses toward **capture-during (A) as the primary
mechanism**, because the measurements remove A's only feared downside:

1. **A's off-path is free** — no measurable throughput regression and zero allocation when
   `trace:false`. The "instrumented hot loop" concern does not materialize: one predicted
   branch per field.
2. **A's on-path time cost is also in the noise** — the only real on-path cost is ~193 B/field
   of *retained* trace, inherent to any design that keeps provenance (B retains the same data
   once `trace()` is called).
3. **B cannot do edges faithfully** without replaying the whole world in insertion order and
   *still* needs per-record metadata captured at generation time — so B does not avoid touching
   the generate path; it defers and complicates it. B's per-call cost (≈ a full extra
   generation + ~11 MB transient/100 records) is strictly worse than A's incremental capture
   for any workload that calls `trace()`.

**Concretely:**
- **Capture edges during generation (mandatory).** Emit a `TraceEdge` at each
  `resolveRelationPool` pick — `poolSize`/`pickedIndex` already computed there. This part
  *must* be capture-during; re-derivation is proven lossy.
- **Capture fields during generation, gated (recommended).** Off-path is free, on-path is
  allocation-bounded; capture `TraceField`s in the `generateObjectFields` loop under the
  `traceOn` gate, reusing the exact `resolution.kind` the pipeline already returns (map
  internal `FieldResolution["kind"]` → public `TraceResolution` at the capture boundary, per
  B85-R11).
- The **only** scenario favoring re-derive (B) is introspecting records generated *before*
  `trace` was requested — which requires retaining the per-record replay-metadata anyway, i.e.
  most of A's bookkeeping without A's correctness simplicity. Not worth it.

### Consequence for B85's contract

- **Keep `createWorld({ trace: true })`.** The flag does not dodge an off-path regression
  (there is none); it **gates the retained-memory cost** (~193 B × fields × records) + the
  edge-capture bookkeeping. A long-lived world generating millions of records with trace
  always-on would retain an unbounded trace it never reads. Opt-in keeps the default
  `trace:false` path allocation-identical to today.
- `trace()` stays **always-callable** (it's the registry projection) but returns **populated**
  `fields`/`edges` only when built with `trace: true`; with the flag off it returns the B85
  stub shape (`fields: []`, `edges: []`). No re-derive fallback — re-derive cannot reproduce
  edges faithfully.

### Shape for B86 / B87

- **B86 (field capture):** thread the gated `TraceField` sink through
  `generateObjectFields`/`walkPipeline`, keyed by record id + field path. Map
  `FieldResolution["kind"]` → `TraceResolution` (total mapping) and reuse the `explain()`
  `generator`/`reason` vocabulary (B85-R12). Extract the capture into a helper so the
  `generateObjectFields` body-length guard (B23-R9) stays green. The off-path benchmark B86
  already demands will confirm this spike's finding (off-path neutral).
- **B87 (edge capture):** emit `TraceEdge` at the `resolveRelationPool` pick site (single +
  many), reading the already-computed `poolSize`/`pickedIndex`. **Do not attempt edge
  re-derivation** — proven lossy against any non-trivial generation timeline.
- Neither card should build a re-derive/replay engine. `explain()` is the right *pattern* for
  read-only per-field decisions, but the value/edge capture `trace()` needs is cheaper and
  strictly more correct done in-line under the gate.

## Bottom line

Recommend the **hybrid (capture-during edges + gated capture-during fields)** — re-derive is
rejected because `ctx.related` edges are not re-derivable from final registry state — and
**keep B85's `createWorld({ trace: true })` opt-in flag** (it gates retained-memory cost, not
an off-path regression, which the spike shows does not exist). The existing B85 contract
stands unchanged.

## Caveats

- Prototype patches + benches were worktree-only throwaway. Full suite ran **1165/1167**
  behavioural tests green with the patch; the 2 non-greens were a cosmetic body-length guard
  (prototype inlined the sink) + a heap-budget test flaky under parallel runs that passes in
  isolation — neither behavioural.
- Throughput deltas are ranges because at 100-records/call the trace gate/push is below the
  generation cost's noise floor — which is the finding. The allocation figures (193 B/field;
  132 KiB retained vs 11 MB transient) are the stable, decision-relevant numbers.
