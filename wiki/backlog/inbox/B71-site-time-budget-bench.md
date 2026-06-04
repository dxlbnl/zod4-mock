---
id: B71
title: Replace fixed runs with time-budget bench measurement
type: feature
priority: high
flags: [review]
created: 2026-06-03
provenance: gen-bench P2-budget
---

## Description

`measure()` in `site/src/lib/bench.ts` runs a fixed number of iterations (`runs=20`
in browser, `runs=5000` in CLI). Slow schemas blow the budget; fast schemas finish
in microseconds and under-measure. Switch to a time-budget loop: "run for ~Nms,
report ops/sec from the actual count."

Acceptance: `pnpm site:bench` produces a `latest.json` where every (lib, schema)
cell uses a budget rather than a fixed iteration count, with the budget recorded
in the JSON header.

## Notes

- Coordinate with B69 (worker) — the budget loop is what runs inside the worker.
- Coordinate with B72 (cold-start) — current cold-start metric assumes fixed-runs;
  budget changes the framing.
