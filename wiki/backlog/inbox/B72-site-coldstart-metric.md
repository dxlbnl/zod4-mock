---
id: B72
title: Rename or remove the cold-start metric on /bench
type: chore
priority: medium
created: 2026-06-03
provenance: gen-bench P2-coldstart
---

## Description

The "cold start" column on `/bench` measures the first run after a fresh import,
but the number is dominated by V8 inline-cache warmup, not anything library-specific.
Three options: (a) rename to something honest ("first-run latency" with a tooltip
explaining the V8 warmup), (b) remove it entirely, (c) keep it but report only at
the CLI tier where warmup=1000 makes the noise floor flat.

Acceptance: decide between (a) / (b) / (c); apply.

## Notes

- Gates on B71 (time-budget) — budget loop changes what "cold start" even means.
