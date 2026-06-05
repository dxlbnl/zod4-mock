---
id: B69
title: Move /bench to a Web Worker
type: feature
priority: high
flags: [review]
created: 2026-06-03
provenance: gen-bench P2-worker
spec: wiki/specs/B69-site-bench-web-worker.md
---

## Description

The live `/bench` route currently runs benchmark loops on the main thread, which
blocks the UI and skews the numbers (a slow tab dragging the event loop is part of
what's being measured). Move the benchmark execution into a `Worker` so the UI
stays responsive and the measurement isolates from rendering work.

Acceptance: clicking "Run" on `/bench` reports progress while the UI remains
interactive (scrolling, segmented-control changes work). The worker posts back
incremental `BenchResult` messages; the chart updates as each library finishes.

## Notes

- Gates on B83 (ecosystem survey) — the worker shape depends on which runner libs
  ship in the bench.
- Coordinate with B71 (time-budget) so the worker's loop is budget-driven, not
  fixed-runs-driven.
