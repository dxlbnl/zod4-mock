---
id: B74
title: Sync vision version note + bench baseline to current release
type: chore
priority: low
created: 2026-06-03
provenance: gen-bench wiki-vision
---

## Description

Two pieces of stale-version copy survived the merge:

1. `site/src/routes/+page.svelte` and `site/content/docs/comparison.md` cite
   `zod4-mock@0.5.0` ops/sec from the 2026-05-14 `latest.json`. Live workspace
   is `0.10.0`.
2. `wiki/vision.md` § "Honest framing" still cites the 2026-05-13 tier numbers.

Re-run `pnpm site:bench` against `workspace:*` (now 0.10.0), commit the new
`latest.json`, and update both copy locations.

Acceptance: every speed citation in `site/` and `wiki/` references the same
`latest.json` snapshot, and that snapshot's header records the current package
version.
