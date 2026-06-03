---
id: B73
title: Add progress indicator + Abort button to /bench
type: feature
priority: medium
created: 2026-06-03
provenance: gen-bench P2-ux
---

## Description

`/bench` currently runs to completion with no visible progress and no way to stop.
On the highest tiers (nested + array, 10k iterations) the page appears frozen.
Add a progress bar that updates per-library-per-schema-cell and an Abort button
that terminates the worker.

Acceptance: clicking Run shows incremental progress; clicking Abort mid-run stops
the worker and surfaces partial results.

## Notes

- Gates on B69 (worker) — Abort requires `worker.terminate()` which the current
  main-thread loop can't offer.
