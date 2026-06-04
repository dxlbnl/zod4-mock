---
id: B99
title: Perf-focused code review — static analysis, hot-loop hunting, micro-opts
type: research
priority: medium
flags: [review]
created: 2026-06-04
predecessor: B97
---

## Description

After B97 lands (lazy `bindGenerators` restored, matcher-tier bench in place,
versions.json backfilled), do a **perf-focused** read of `src/` and propose a
prioritized list of micro-opts. This is the perf analogue of B22's complexity
audit — same shape, different lens.

What to look for:

- **Hot loops** — places that run per field × per record × per call.
  Candidates already on the radar:
  - `walkPipeline(PIPELINE, ...)` ([src/pipeline.ts](src/pipeline.ts)) — runs
    per field; check whether the step iteration is amortised.
  - `Object.entries(shape)` in the field loop
    ([src/world/engine.ts:971](src/world/engine.ts#L971)) — allocates an
    array of `[key, value]` pairs per record.
  - `generateFromSchema`'s DISPATCH table (B26) — fast in steady state,
    but verify no per-call rebuild.
  - `recordPrng.fork(key)` per field ([src/world/engine.ts:972](src/world/engine.ts#L972))
    — confirm the FNV-1a hash + SFC32 seed init isn't doing more allocation
    than needed.
  - Per-field PRNG wrapper in `effectiveUniqueMode`
    ([src/world/engine.ts:810-826](src/world/engine.ts#L810-L826)) — allocates
    a wrapper object per field when `unique: true`.

- **Avoidable allocations** — closures rebuilt per field that could be
  hoisted, object literals in hot paths, repeated string concatenation
  (e.g. `fieldPath` construction).

- **Cache opportunities** — `resolveLazyChain` already caches (B31); other
  per-field work that could benefit from a per-`generate()` cache (schema
  reachability, key-map lookup misses, format-detection on `z.string()`).

- **Type-tag introspection cost** — every pipeline step ends up calling
  `def(schema)` to read `_zod.def`. Check whether the cost is significant
  enough to warrant per-schema caching.

- **`generateArray` mode resolution** — `resolveMode(schema)` is called
  per array generation; verify it's hot-path cheap.

- **`bindGenerators` post-B97** — once B97 lands the lazy holder pattern,
  re-measure to confirm the per-`generate()` setup is genuinely cheap
  (single getter object + one mutable holder; no per-field rebuild).

Out of scope:

- **Algorithmic changes** that touch the PRNG contract, the determinism
  invariants (D4 / D10), or the pipeline ordering. Those are separate items.
- **B36-shape regressions** — B97's matcher-tier bench + B98's CI gate
  catch those going forward.

## Methodology

- Read the engine top-to-bottom with an allocation-counting mindset
  (every `new X`, every `[...spread]`, every `Object.entries`, every
  closure-in-hot-loop).
- Use the matcher-tier bench (post-B97) to validate any proposed
  optimization moves the needle. **Do not** propose changes that improve a
  micro-benchmark but don't show up in `populate(100)` of the matcher tier.
- Reference numbers in `site/bench/results/versions.json` (current floor)
  and the post-B97 `baseline.json` (post-fix floor) for any claim of "this
  is hot."
- Report as `wiki/research/reports/perf-static-analysis.md` (the same
  shape as the B22 complexity report — top-N hot spots per category,
  recommendation per spot, NOT auto-filed as backlog items).

## Notes

- B22 (codebase complexity audit) is the precedent — same report shape,
  different focal lens.
- B98 (perf suite) is the measurement infrastructure this item leans on.
- B97 (matcher-tier bench) is the workload this audit measures against.
- Do not file individual backlog items inside the report — that's the
  manager's call when the user reads the report and prioritizes.
