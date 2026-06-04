---
id: B98
title: Perf + memory regression suite (CI guardrail + per-version history)
type: feature
priority: medium
flags: [review]
created: 2026-06-04
spec: wiki/specs/B98-perf-memory-regression-suite.md
---

## Description

We just hit a ~7× regression (B97) that lived in `main` for several releases
because nothing flagged it. Set up a suite that would have caught it. Three
pieces:

1. **Per-version baseline history** — keep `site/bench/results/versions.json`
   (already seeded with 0.5.0..0.10.0 by the B97 bisect) as the canonical
   per-version record. Future bisects re-use these entries instead of
   re-installing old npm aliases each time. `site/bench/regression.bench.ts`
   becomes the generator for new entries when needed.
2. **CI guardrail on `site/bench/perf.test.ts`** — on each PR, run the existing
   `pnpm --filter=@zod4-mock/site bench`, diff `latest.json` against a
   `baseline.json` pinned to the last release. Fail (or warn) if any tier's
   `avg` ms regresses beyond a configurable threshold (e.g. >25%). Update
   `baseline.json` automatically on release.
3. **Memory tracking** — sample `process.memoryUsage().heapUsed` (and probably
   `v8.getHeapStatistics().used_heap_size`) before/after each `simple`/`user`/
   `nested` measurement loop; persist deltas alongside the `avg` timings in
   `latest.json` and `history.json`. Compare these the same way as the time
   thresholds.

Open design questions for the spec page:

- Threshold per-tier vs single global? Hysteresis (only fail if 2 runs in a row
  regress)?
- Does `versions.json` get appended-to forever, or pruned to "interesting"
  versions?
- Should the regression test re-install aliases on demand, or do we keep them
  in `site/package.json` long-term?
- Where does the comparison run live — a vitest test, a separate script,
  inside the `bench` command, or a GitHub Actions step?

## Notes

- Inspiration: B97 (`wiki/backlog/inbox/B97-fix-eager-bindgenerators-perf-regression.md`)
  produced the first cut of `versions.json` and the bisect harness.
- The existing bench infrastructure is `site/bench/perf.test.ts` (writes
  `latest.json` + appends to `history.json`), `site/src/lib/bench.ts`
  (`measure()` helper), `site/bench/vitest.config.ts`.
- Don't combine with B97 — B97 fixes the regression, B98 prevents the next one.
