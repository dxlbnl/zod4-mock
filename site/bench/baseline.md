# Bench baseline

`site/bench/results/baseline.json` pins the per-tier reference numbers that
`bench/perf.test.ts` compares each run against. The comparator is implemented in
[`bench/regression-compare.ts`](regression-compare.ts); the thresholds live in
[`wiki/specs/B98-perf-memory-regression-suite.md`](../../wiki/specs/B98-perf-memory-regression-suite.md):

| Metric | WARN range  | FAIL threshold | Rule    |
| ------ | ----------- | -------------- | ------- |
| time   | [+10%, +25%]| > +25%         | B98-R5  |
| memory | [+25%, +50%]| > +50%         | B98-R7  |

A negative delta (improvement) prints `OK`. A baseline memory value of `0` prints
`SKIP` and never fails the build.

## Provenance of the current baseline

- `versions["zod4-mock"]` — the workspace `zod4-mock` package version at the moment the
  baseline was captured (currently `0.10.0`; see `versions["zod4-mock"]` inside
  `results/baseline.json` for the authoritative value).
- Capture date — see the `timestamp` field inside `results/baseline.json`.
- Node version — see the `node` field inside `results/baseline.json` (current
  baseline was captured on **Node v22.x**; reproduce on the same major for
  comparable numbers).
- Machine class — a developer laptop / desktop, single-process pnpm bench run. The
  thresholds (25% time, 50% memory) are deliberately loose so cross-host noise
  does not flap the gate; do **not** capture a baseline on a noisy laptop on
  battery if you can avoid it.

## Refreshing the baseline

When `zod4-mock` is published, refresh `baseline.json` to the post-release
numbers as part of the release commit (or a single follow-up commit labelled
`chore: refresh bench baseline for <version>`).

Per B98-R4 / B98-R9, `baseline.json` carries a **stripped** subset of
`latest.json`: each tier in `results` is reduced to its `zod4_mock` entry only
(no `faker`, no `zod3_mock`), because the comparator only gates on
`zod4_mock`. A wholesale `cp latest.json baseline.json` is therefore **wrong**.

The mechanism is a `jq`-based extract, run after a fresh `bench`:

```sh
pnpm --filter=@zod4-mock/site bench
jq '{
  timestamp,
  node,
  versions,
  config,
  results: (.results | map_values({ zod4_mock })),
  localeResults,
  memory
}' site/bench/results/latest.json > site/bench/results/baseline.json
git add site/bench/results/baseline.json
git commit -m "chore: refresh bench baseline for <version>"
```

This writes the stripped shape required by B98-R4: same top-level keys as
`latest.json` (`timestamp`, `node`, `versions`, `config`, `results`,
`localeResults`, `memory`), each tier in `results` containing only
`zod4_mock`, the `memory` block carried over verbatim. The first run after a
clean checkout produces a "no baseline.json" notice — the second produces the
regression table.

`jq` is widely available; install it via your package manager (`brew install
jq`, `apt-get install jq`, …) if missing. The `results` mapping uses
`map_values({ zod4_mock })` which keeps each tier object's `zod4_mock` field
verbatim and drops every other sibling (i.e. `faker` and `zod3_mock`).

## Manual merge gate (B98-R10)

This repository does not currently ship a GitHub Actions workflow. Until one
exists, the bench gate is **manual**:

> Before merging any PR that touches `src/` or `packages/locale-*`, run
> `pnpm --filter=@zod4-mock/site bench`. The test fails (non-zero exit) when
> a regression breaches the B98-R5 (time) or B98-R7 (memory) thresholds.

A FAIL status on any tier blocks the merge. WARN is informational. OK / SKIP
are fine to merge.

If/when a GitHub Actions workflow is added, lift this manual gate by wiring
`pnpm --filter=@zod4-mock/site bench` into a PR job (the comparator's exit
code will then surface as a CI-status failure automatically).
