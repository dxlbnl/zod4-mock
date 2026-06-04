# B98: Perf + memory regression suite (CI guardrail + per-version history)

## Context

The 0.8.0 → 0.10.0 release window shipped a ~7× CLI-bench regression on every
schema tier (B36 / B97 — eager `bindGenerators` per field). It lived in `main`
across four published releases (0.8.0, 0.9.0, 0.9.2, 0.10.0) because nothing in
the test suite or CI gated on perf. The B97 bisect captured the per-version
shape in [`site/bench/results/versions.json`](../../site/bench/results/versions.json)
as a one-off; this card promotes that artefact into a maintained regression
suite and adds the guardrail that would have flagged 0.7.2 → 0.8.0 at PR time.

Three pieces, mirroring the item card
([`B98-perf-memory-regression-suite.md`](../backlog/doing/B98-perf-memory-regression-suite.md)):

1. **Per-version baseline history** — formalize `site/bench/results/versions.json`
   as the canonical per-version record (already seeded with 0.5.0..0.10.0 by the
   B97 bisect) and clarify how new entries are added.
2. **CI guardrail** — `site/bench/perf.test.ts` compares the run's `latest.json`
   against a release-pinned `baseline.json` and fails when a tier's `avg`
   regresses past a threshold.
3. **Memory tracking** — `process.memoryUsage().heapUsed` (and
   `v8.getHeapStatistics().used_heap_size`) sampled around every `simple` /
   `user` / `nested` measurement loop in `perf.test.ts`, persisted in the same
   result files under a new `memory:` field and thresholded identically to
   time.

Related wiki pages:

- [`wiki/architecture.md`](../architecture.md) — binding **Rules**. This card
  touches **D17** (CLI baseline is the citable source — the suite operates on
  the same `latest.json`).
- [`wiki/site/benchmark-methodology.md`](../site/benchmark-methodology.md) —
  documents the CLI / browser two-harness split and the `measure()` primitive.
- [`wiki/backlog/inbox/B97-fix-eager-bindgenerators-perf-regression.md`](../backlog/inbox/B97-fix-eager-bindgenerators-perf-regression.md)
  — the bug B98 must catch in retrospect (smoke acceptance).
- [`.claude/practices/performance.md`](../../.claude/practices/performance.md) —
  measure-before-optimise; the suite is the project's measurement of record.

This spec complies with all binding rules in `architecture.md` as of
2026-06-04. No rules are amended.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as
> defined in RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B98-R1: `versions.json` schema is pinned and documented

The repository **MUST** carry a `site/bench/results/versions.json` whose
top-level shape is fixed as: `_doc: string`, `config: { warmup: number, runs:
number }`, `node: string`, `schemas: { simple: string, user: string, nested:
string }` (string-form schema descriptions for reproducibility), and
`entries: VersionEntry[]`, where each `VersionEntry` is

```
{
  "timestamp": string,             // ISO 8601, e.g. "2026-06-04T07:02:54Z"
  "version": string,               // semver of zod4-mock under test
  "avg_us": { "simple": number, "user": number, "nested": number },
  "memory": {                      // added by B98-R6 — `null` permitted for legacy entries
    "simple": { "heapUsedDeltaBytes": number, "v8HeapUsedBytes": number, "gcForced": boolean },
    "user":   { "heapUsedDeltaBytes": number, "v8HeapUsedBytes": number, "gcForced": boolean },
    "nested": { "heapUsedDeltaBytes": number, "v8HeapUsedBytes": number, "gcForced": boolean }
  } | null,
  "note"?: string                  // optional human annotation
}
```

`avg_us` is in microseconds (per-call avg × 1000) — keeps the existing B97
shape. `memory.heapUsedDeltaBytes` is the post-loop − pre-loop delta in bytes
captured per B98-R6. `memory.v8HeapUsedBytes` is the post-loop reading of
`v8.getHeapStatistics().used_heap_size` in bytes. `memory.gcForced` is `true`
when the bench process had `global.gc` available (Node started with
`--expose-gc`) at sample time, `false` otherwise — informational only,
needed when comparing heap deltas captured under different GC regimes
(e.g. across a backfill run vs. a CI run). `memory` **MAY** be `null` for
legacy entries that were seeded before memory sampling existed; the
backfill in B98-R3 replaces those nulls with real samples. The
co-located Zod schema in `site/bench/versions-schema.ts` **MUST** be
updated so each tier object carries `gcForced: boolean` alongside
`heapUsedDeltaBytes` and `v8HeapUsedBytes`.

- Scenario: shape validates
  GIVEN the committed `site/bench/results/versions.json`
  WHEN the file is parsed as JSON and each entry is validated against the
  schema above (a Zod schema co-located in `site/bench/versions-schema.ts`
  is acceptable as a verification mechanism)
  THEN parsing succeeds and every entry satisfies the structural contract
  (all required fields present, types as declared, no unknown top-level
  fields besides `_doc` / `config` / `node` / `schemas` / `entries`).

- Scenario: legacy entries are upgraded in place
  GIVEN the file already carries seven B97-seeded entries (0.5.0..0.10.0) that
  lack the `memory` field
  WHEN B98 lands
  THEN every existing entry has either been re-measured to include `memory`,
  or marked with `"memory": null` and a `note` explaining the omission; no
  entry has a partial `memory` object.

### B98-R2: `versions.json` is append-only and human-curated

`versions.json` **MUST** be append-only with one narrow, one-time exception:
entries are added by humans (or via `site/bench/regression.bench.ts` as the
on-demand generator), never auto-pruned, and an existing version's row is
never edited in place **except**:

1. to add a post-hoc `note`, and
2. to fill in a `memory: null` placeholder with a real captured sample (the
   one-time memory backfill performed by `regression.bench.ts` in its
   opt-in write-back mode — see B98-R3).

`avg_us` values **MUST NOT** be edited in place under any circumstance —
they are the timing baseline and must remain reproducible from the
original bisect. Once an entry's `memory` is a non-null object (i.e.
has been populated, whether at row creation or via the one-time
backfill), it is frozen: further edits to that row's `memory` are
disallowed. The append-only spirit applies to the now-populated field —
a re-measurement that disagrees with the existing memory block belongs
in a new entry, not an overwrite.

The npm aliases in `site/package.json` (`zod4-mock-v050..v092`)
**MUST** stay declared so the on-demand regression generator can run
without a reinstall, and **MAY** be extended for future versions when a
new bisect is needed.

- Scenario: regenerating the file is idempotent for an existing version
  GIVEN a `versions.json` with an entry for `0.7.2`
  AND `0.7.2`'s `memory` block is already populated (non-null)
  WHEN `site/bench/regression.bench.ts` is re-run against the same aliases
  in its default (read-only) mode
  THEN the test produces a console summary but **does not** overwrite or
  duplicate the existing `0.7.2` entry in `versions.json` (the test prints;
  the human appends).

- Scenario: avg_us is never overwritten
  GIVEN a `versions.json` entry for `0.7.2` with `avg_us.simple = 8.3`
  WHEN `regression.bench.ts` runs in **any** mode (including write-back)
  THEN `avg_us.simple` for the `0.7.2` entry is `8.3` after the run
  (write-back affects `memory` only — never `avg_us`).

- Scenario: a populated memory block is frozen
  GIVEN a `versions.json` entry whose `memory` is a non-null object
  WHEN `regression.bench.ts` runs in write-back mode
  THEN the existing `memory` object for that entry is byte-identical
  after the run (write-back is gated on `memory === null`; populated
  rows are left alone — see B98-R3 for the warning behaviour).

- Scenario: aliases are present for the seeded versions
  GIVEN `site/package.json`
  WHEN the file is parsed
  THEN `dependencies` contains the seven aliases
  `zod4-mock-v050`, `zod4-mock-v060`, `zod4-mock-v070`, `zod4-mock-v072`,
  `zod4-mock-v080`, `zod4-mock-v090`, `zod4-mock-v092` resolving via
  `npm:zod4-mock@<version>`.

### B98-R3: `regression.bench.ts` remains the on-demand alias-bisect tool

`site/bench/regression.bench.ts` **MUST** be retained as an on-demand
multi-version benchmark and **MUST NOT** be wired into the default `pnpm
--filter=@zod4-mock/site bench` invocation, so the standard bench run stays
fast and a fresh contributor without `node_modules` symlinks to old aliases
can still run `bench`.

`regression.bench.ts` **MUST** support two modes:

1. **Default (read-only)** — the existing behaviour: measure each declared
   alias, sample memory around each measurement loop via `sampleMemory()`
   from `site/bench/memory.ts`, print the per-version summary table to
   stdout, and exit. `versions.json` is **not** touched.

2. **Write-back (opt-in)** — gated on the environment variable
   `UPDATE_VERSIONS=1`. When set, after measuring, the runner writes
   captured memory samples back into `site/bench/results/versions.json`
   **only for entries whose `memory` field is currently `null`**.
   Entries whose `memory` is already populated (non-null) are left
   untouched and a warning is printed to stdout naming each skipped
   entry. `avg_us` values are **never** modified by write-back. The
   write is a single atomic JSON serialisation that preserves the
   existing top-level fields (`_doc`, `config`, `node`, `schemas`,
   `entries`) and the existing ordering of `entries`.

The gate (`UPDATE_VERSIONS=1`) keeps the default opt-in invocation a
print-only operation; write-back is a deliberate maintainer step.

- Scenario: default bench skips regression
  GIVEN a fresh checkout
  WHEN the user runs `pnpm --filter=@zod4-mock/site bench`
  THEN the vitest invocation runs `bench/perf.test.ts` (and the new
  comparison; see B98-R4) but **does not** import any `zod4-mock-v0*`
  alias, and exits successfully even if those aliases are absent from
  `node_modules`.

- Scenario: regression is opt-in (read-only)
  GIVEN a fresh checkout with the seven aliases installed
  WHEN the user runs
  `pnpm --filter=@zod4-mock/site exec vitest --config bench/regression.config.ts --run`
  (without `UPDATE_VERSIONS` set)
  THEN the test executes, prints the per-version summary table,
  `site/bench/results/versions.json` is byte-identical before and after
  the run, and the command exits 0. (The alias-bisect lives at
  `bench/regression.bench.ts` and is gated behind its own
  `bench/regression.config.ts` so the default `pnpm bench` glob does
  not pick it up.)

- Scenario: opt-in write-back updates `memory: null` entries
  GIVEN a `versions.json` where every entry's `memory` is `null`
  AND the seven aliases are installed
  WHEN the user runs
  `UPDATE_VERSIONS=1 pnpm --filter=@zod4-mock/site exec vitest --config bench/regression.config.ts --run`
  THEN every entry's `memory` field is replaced with a captured
  measurement of the shape
  `{ simple: { heapUsedDeltaBytes, v8HeapUsedBytes, gcForced }, user: { ... }, nested: { ... } }`
  (per B98-R1, including `gcForced`), AND `avg_us` is unchanged for
  each entry, AND no entry is added or removed, AND `entries` ordering
  is preserved.

- Scenario: write-back does not overwrite a populated memory
  GIVEN a `versions.json` where some entries already have a populated
  `memory` object (non-null) and some have `memory: null`
  AND `UPDATE_VERSIONS=1` is set
  WHEN the bench runs
  THEN populated entries are left untouched (their `memory` object is
  byte-identical before and after); only `memory: null` rows are filled
  in; AND a warning is printed to stdout naming each entry that was
  skipped because it was already populated.

### B98-R4: `baseline.json` pins the comparison reference

The repository **MUST** carry a `site/bench/results/baseline.json` file that
shares `latest.json`'s top-level keys (`timestamp`, `node`, `versions`,
`config`, `results`, `localeResults`, plus the new `memory` field per
B98-R6) but **strips the non-gated comparator columns**: for each tier in
`results`, only the `zod4_mock` sub-key (the avg/min/max/opsPerSec/coldStart
object) is retained — `faker` and `zod3_mock` are external libraries the
comparator (B98-R5) does not gate on, and storing their numbers in the
baseline is misleading. `localeResults` is kept as-is for now (it is also
not gated by B98-R5 / B98-R7, but it is small and homogeneous, and dropping
it would cascade churn into B98-R8 / B98-R9 fixtures — see Open questions).
`versions["zod4-mock"]` **MUST** correspond to the most recently published
release at the moment the file was updated. A `site/bench/baseline.md`
sidecar (or equivalent `_meta` field inside the JSON) **MUST** record which
release the baseline was captured from and the date of capture.

- Scenario: baseline file exists and has correct top-level shape
  GIVEN the repository at this card's merge
  WHEN `site/bench/results/baseline.json` is read and parsed
  THEN it contains the same top-level keys as `latest.json` (`timestamp`,
  `node`, `versions`, `config`, `results`, `localeResults`, `memory`),
  `versions["zod4-mock"]` is a valid semver string, AND for each tier in
  `results` (`simple` / `user` / `nested`) the tier object's only sub-key
  is `zod4_mock` (no `faker` key, no `zod3_mock` key).

- Scenario: baseline provenance is recorded
  GIVEN the committed `baseline.json` (or its sidecar)
  WHEN inspected
  THEN there is a human-readable record of (a) which `zod4-mock` release this
  baseline came from, (b) the date the baseline was captured, and (c) the
  Node version it was captured on.

### B98-R5: Time-regression guardrail with per-tier 25 % threshold

`pnpm --filter=@zod4-mock/site bench` **MUST** fail (non-zero exit) when the
current run's `results.<tier>.zod4_mock.avg` for **any** of the three tiers
(`simple` / `user` / `nested`) exceeds the matching value in `baseline.json`
by more than **25 %**. The faker and `@anatine/zod-mock` columns **MUST NOT**
gate the build (they're external libraries; informational only) — and per
B98-R4 they are **not present** in `baseline.json` at all, so the comparator
**MUST** treat their absence from the baseline as expected (no crash, no
`undefined` access) and skip them silently when iterating tiers; only
`results.<tier>.zod4_mock.avg` is read from the baseline. The
comparison **MUST** run inside the `perf.test.ts` suite (a dedicated
`describe("regression vs baseline")` block executed after the measurement
blocks in the same test file), so a single `bench` invocation produces both
the `latest.json` write and the pass/fail signal.

When the comparison fails, the test output **MUST** print a table with the
columns `tier | baseline_avg_ms | current_avg_ms | delta_pct | status`, with
`status` being `OK` / `WARN` / `FAIL`. A delta in the **interval [10 %, 25 %]**
**MUST** print `WARN` (and not fail the build); a delta **> 25 %** prints
`FAIL` and the test fails. A negative delta (improvement) prints `OK`.

Hysteresis is **out of scope** for this card (see Out of scope and Open
questions); the threshold is a single per-tier comparison against the
release-pinned baseline.

- Scenario: a 30 % time regression fails the build
  GIVEN a `baseline.json` with `results.simple.zod4_mock.avg = 0.0083` (i.e.
  8.3 µs; the 0.7.2 baseline)
  AND a synthetic `latest.json` (constructed in a unit fixture that
  exercises the comparator directly) with `results.simple.zod4_mock.avg =
  0.0108` (i.e. 13.0 µs — a +30 % regression)
  WHEN the comparison block runs
  THEN it logs a row `simple | 0.0083ms | 0.0108ms | +30.1% | FAIL` and
  the test fails with a non-zero exit code from `pnpm bench`.

- Scenario: a 15 % time regression warns but does not fail
  GIVEN the same baseline
  AND a synthetic `latest.json` with `results.user.zod4_mock.avg` showing
  +15 % vs baseline
  WHEN the comparison block runs
  THEN it logs a row with `WARN` status, and the test process exits 0.

- Scenario: an improvement is OK
  GIVEN any baseline
  AND a `latest.json` whose tier `avg` is **lower** than the baseline
  WHEN the comparison block runs
  THEN that tier's row prints `status = OK` with a negative `delta_pct`,
  and the test does not fail on account of that tier.

- Scenario: faker / zod3-mock columns do not gate
  GIVEN a synthetic `latest.json` with `results.simple.faker.avg` at +200 %
  versus baseline (a faker regression we have no control over)
  AND `zod4_mock.avg` unchanged
  WHEN the comparison block runs
  THEN no faker row is added to the regression table, and the test exits 0.

### B98-R6: Memory sampling and persistence

`perf.test.ts` **MUST** sample `process.memoryUsage().heapUsed` and
`v8.getHeapStatistics().used_heap_size` immediately before and immediately
after each `zod4_mock` measurement loop for the three tiers (`simple` /
`user` / `nested`), force a GC pass when available (`global.gc?.()` —
no-op when Node is not started with `--expose-gc`), and persist the
post-minus-pre `heapUsed` delta plus the post-loop `v8` reading under a
new top-level `memory` field in `latest.json`, `history.json`, and (via
B98-R2's append-only flow) `versions.json`.

The shape in `latest.json` / each `history.json` entry is:

```
"memory": {
  "simple": { "heapUsedDeltaBytes": number, "v8HeapUsedBytes": number, "gcForced": boolean },
  "user":   { "heapUsedDeltaBytes": number, "v8HeapUsedBytes": number, "gcForced": boolean },
  "nested": { "heapUsedDeltaBytes": number, "v8HeapUsedBytes": number, "gcForced": boolean }
}
```

`gcForced` is `true` when `global.gc` was callable, `false` otherwise.
Memory is **only** sampled around the `zod4_mock` arm of each tier (not
around faker or zod3-mock) — the goal is to track this library, not its
peers.

- Scenario: memory block is present
  GIVEN a successful `pnpm --filter=@zod4-mock/site bench` run
  WHEN `site/bench/results/latest.json` is read
  THEN it contains a top-level `memory` key whose value matches the shape
  above; each tier has all three sub-keys; `heapUsedDeltaBytes` is a finite
  number; `v8HeapUsedBytes` is a positive finite number.

- Scenario: GC flag reflects the runtime
  GIVEN Node started **without** `--expose-gc`
  WHEN bench runs
  THEN every tier's `memory.<tier>.gcForced` is `false`.

  GIVEN Node started **with** `--expose-gc`
  WHEN bench runs
  THEN every tier's `memory.<tier>.gcForced` is `true`.

- Scenario: history grows
  GIVEN a `history.json` with N existing entries
  WHEN bench runs successfully
  THEN `history.json` has N+1 entries and the new entry's last key is the
  `memory` block.

### B98-R7: Memory-regression guardrail with per-tier 50 % threshold

The same comparison block that gates time (B98-R5) **MUST** also gate
memory: for each tier, the current `memory.<tier>.heapUsedDeltaBytes`
**MUST** be compared against the matching `baseline.json` value, and a
delta **> 50 %** **MUST** fail the build. The threshold is intentionally
looser than the time threshold because `heapUsed` deltas are noisier (no
`--expose-gc` ⇒ samples can include allocations the GC has not yet
collected). A delta in **[25 %, 50 %]** **MUST** print `WARN`. A baseline
value of `0` (legacy entries pre-B98) **MUST** print `SKIP` and not fail.

- Scenario: a 70 % memory regression on `user` fails
  GIVEN `baseline.json` with `memory.user.heapUsedDeltaBytes = 1_000_000`
  AND a synthetic `latest.json` (unit-test fixture) with
  `memory.user.heapUsedDeltaBytes = 1_700_000` (+70 %)
  WHEN the comparison runs
  THEN a row `user | mem 1000000B | mem 1700000B | +70.0% | FAIL` is
  printed and the test fails.

- Scenario: a baseline of 0 skips the memory check
  GIVEN `baseline.json` with `memory.simple.heapUsedDeltaBytes = 0`
  AND any `latest.json`
  WHEN the comparison runs
  THEN the row prints `SKIP` for that tier's memory check and the test does
  not fail on account of memory for that tier.

### B98-R8: Smoke acceptance — the suite would have flagged 0.7.2 → 0.8.0

A repeatable, manually-runnable smoke check **MUST** demonstrate that
B98-R5 + B98-R7, configured with the release-pinned `baseline.json` from
0.7.2 (the last clean release before B36 / B97), would have **failed** the
bench if it had run against 0.8.0's numbers. This is the regression-of-the-
regression that motivates B98 existing in the first place.

The implementer **MUST** add a unit-style test (e.g.
`site/bench/regression-vs-baseline.test.ts`) that feeds the comparator a
synthetic `baseline.json` derived from `versions.json`'s `0.7.2` entry and
a synthetic `latest.json` derived from `0.8.0`, and asserts the comparator
returns a `FAIL` verdict on all three tiers' time and (if memory data is
present for those rows; otherwise a `note` records the omission) on
memory. Re-using the synthetic-fixture path of B98-R5 / B98-R7 is
acceptable.

- Scenario: 0.7.2 baseline rejects 0.8.0 numbers
  GIVEN a comparator fed `0.7.2` `avg_us` values from `versions.json`
  (simple=8.3 µs, user=16.8 µs, nested=43.7 µs)
  AND `0.8.0` `avg_us` values from `versions.json`
  (simple=76.8 µs, user=154.1 µs, nested=467.8 µs)
  WHEN the comparator evaluates the three tiers at the B98-R5 threshold
  (> 25 %)
  THEN all three tiers report `FAIL` (deltas ≈ +825 %, +817 %, +970 %), and
  the comparator's aggregate verdict is `FAIL`.

### B98-R9: Baseline-update workflow at release time

When `zod4-mock` is published, `baseline.json` **MUST** be refreshed to the
post-release numbers as part of the **same** release commit (or a single
follow-up commit explicitly labelled `chore: refresh bench baseline for
<version>`). The refresh **MUST NOT** be a wholesale `cp latest.json
baseline.json` — per B98-R4 the baseline carries a **stripped** subset of
`latest.json` (each tier in `results` reduced to its `zod4_mock` entry,
plus the `memory` block; `timestamp`/`node`/`versions`/`config`/
`localeResults` carried over as-is). The mechanism is documented as one
of: (a) a `pnpm --filter=@zod4-mock/site bench:baseline` script that runs
the bench (with `UPDATE_BASELINE=1` set, or as a dedicated entry point)
and **extracts** the gated subset from the freshly-produced `latest.json`
into `baseline.json`, or (b) a manual step recorded in
`site/bench/baseline.md` that produces the same stripped subset (e.g.
`jq` filter or a short maintainer script — _not_ `cp`). The chosen
mechanism **MUST** be documented in `site/bench/baseline.md`.

- Scenario: baseline-update script (option a)
  GIVEN the implementer chose mechanism (a)
  WHEN `pnpm --filter=@zod4-mock/site bench:baseline` runs
  THEN `site/bench/results/baseline.json` is overwritten with the
  **stripped** shape required by B98-R4: same top-level keys as
  `latest.json` (`timestamp`, `node`, `versions`, `config`, `results`,
  `localeResults`, `memory`), each tier in `results` contains **only**
  `zod4_mock` (no `faker`, no `zod3_mock`), the `memory` block is carried
  over verbatim, and `versions["zod4-mock"]` matches the workspace
  `zod4-mock` package version.

- Scenario: documented in `baseline.md`
  GIVEN the chosen mechanism
  WHEN `site/bench/baseline.md` is read
  THEN the file describes (in plain prose) the exact step a maintainer runs
  to refresh the baseline at release time, names the file path being
  overwritten, and notes which Node version + machine class the baseline
  is expected to be captured on for results to be comparable.

### B98-R10: CI invocation runs the gated bench

The CI configuration (a GitHub Actions workflow under `.github/workflows/`,
the path to be confirmed by the implementer against the repo's existing CI
layout) **MUST** include a step that runs `pnpm
--filter=@zod4-mock/site bench` on every PR against `main` (or `claude/*`
release branches), and **MUST** surface the test failure as a CI-status
failure when the comparator returns `FAIL` per B98-R5 or B98-R7.

If the repository does **not** currently run any GitHub Actions workflow
(check before assuming), this requirement becomes: document the **manual**
gate in `site/bench/baseline.md` — "run `pnpm bench` before merging any PR
that touches `src/` or `packages/locale-*`" — and the CI-workflow piece is
deferred under Open questions. The MUST applies to whichever path is
chosen.

- Scenario: CI step exists
  GIVEN the chosen path is "wired into a GitHub Actions workflow"
  WHEN the workflow file is inspected
  THEN there is a job step that runs `pnpm --filter=@zod4-mock/site bench`
  and the job fails when that step exits non-zero.

- Scenario: manual gate is documented
  GIVEN the chosen path is "manual gate documented"
  WHEN `site/bench/baseline.md` is read
  THEN it states the exact one-line command a maintainer runs before
  merging a PR touching the listed paths, and names the threshold rule
  numbers (`B98-R5`, `B98-R7`) as the success criteria.

### B98-R11: Bench command remains the existing invocation

`pnpm --filter=@zod4-mock/site bench` **MUST** remain the single command
that runs the full bench locally (no new sub-commands required to get the
guardrail), so the documented workflow in
`wiki/site/benchmark-methodology.md` keeps working unchanged.

- Scenario: existing invocation still works
  GIVEN the repository at this card's merge
  WHEN `pnpm --filter=@zod4-mock/site bench` is run
  THEN it executes the measurement blocks, writes `latest.json` and
  appends to `history.json`, runs the comparison block, prints the
  regression table, and exits with the appropriate status (0 unless
  B98-R5 or B98-R7 returned `FAIL`).

## Out of scope

- **Run-over-run hysteresis** — the card discusses "fail only if 2 runs in
  a row regress" as a possible smoothing mechanism. This spec does **not**
  adopt hysteresis; the first failing run fails the build. If post-merge
  noise turns out to flap, hysteresis is a follow-up backlog item.
- **Browser bench coverage** — the `/bench` SvelteKit page (qualitative,
  warmup=5/runs=20, see `wiki/site/benchmark-methodology.md`) is out of
  scope. D17 makes the CLI the citable source; only the CLI bench is
  gated.
- **Locale bench gating** — `localeResults` (default/en/nl) in
  `latest.json` are recorded as today but **not** gated by B98-R5 /
  B98-R7. They're a useful trend signal but locale-specific perf is a
  separate workstream.
- **`@anatine/zod-mock` and faker gating** — explicitly excluded by B98-R5.
- **CPU profile capture** — no flame-graphs, no `--prof`, no Clinic.js
  integration. If a regression fires, the maintainer investigates manually.
- **Threshold tuning per Node version or CPU class** — the threshold is a
  single number, applied uniformly. Cross-machine reproducibility is
  partially addressed by `baseline.json` carrying its Node version, but
  the suite does not auto-adjust thresholds per host.
- **Editing existing `versions.json` rows** — append-only by B98-R2; row
  edits are out of scope except for adding a `note`.
- **Auto-updating `baseline.json` from CI** — the refresh is manual /
  maintainer-driven per B98-R9; no CI-side write back.
- **B97's fix itself** — B98 is the guardrail; B97 fixes the underlying
  regression. Don't combine them (the item card calls this out).

## Open questions

- **(non-blocking)** Should the threshold be **per-tier** (B98-R5 picks
  this — fail on _any_ tier > 25 %) or a **single global** check on a
  composite metric (e.g. weighted sum across tiers)? This spec answers
  per-tier; revisit if it turns out per-tier flaps noisily on `simple`
  (small absolute numbers magnify percentage noise).
- **(non-blocking)** Should hysteresis (fail only on two consecutive PR
  runs above threshold) be adopted? Out of scope here; revisit if the
  per-tier check flaps.
- **(non-blocking)** Long-term, should `versions.json` be **pruned to
  "interesting" versions** (release boundaries, regressions, fixes)
  rather than carrying every published 0.x release? This spec keeps it
  append-only-forever (B98-R2); the file is small and the bench takes
  seconds to regenerate when needed. Revisit if the file grows past a
  practical size.
- **(non-blocking)** Should the npm aliases in `site/package.json`
  (`zod4-mock-v050..v092`) be kept long-term or installed on demand by a
  separate script before running `regression.bench.ts`? This spec keeps
  them declared (B98-R2) — the install cost is paid once at
  `pnpm install` and the file change is a one-line entry per future
  version added. Revisit if the alias list grows past ~20 entries.
- **(non-blocking)** Does this repo currently run any GitHub Actions
  workflow? B98-R10 branches on the answer (CI step vs. manual-gate
  documentation). The implementer **MUST** check before choosing the
  path; if neither path is acceptable to the maintainer, escalate
  back to the manager. Recorded here so the question is visible, not
  blocking because either path satisfies B98-R10.
- **(non-blocking)** Are the 25 % (time) and 50 % (memory) thresholds the
  right initial values? They're set conservatively: a real regression
  (e.g. B36 at ~+825 %) blows through both by orders of magnitude; a
  trivial micro-fluctuation (≤10 %) stays silent. If sustained noise above
  25 % time turns out to be common on the maintainer's hardware, lower or
  raise after observing.
- **(non-blocking)** Should `--expose-gc` be required in the CI bench
  invocation to make `gcForced` deterministically `true`? B98-R6 leaves
  it optional (the flag is informational) — making it mandatory is a one-
  line CI change if the memory-delta noise demands it.
- **(non-blocking)** Should `localeResults` also be stripped from
  `baseline.json` (as faker / `zod3_mock` were per B98-R4)? It is **not**
  gated by B98-R5 / B98-R7 today (locale gating is explicitly out of
  scope), so by the same "storing what's not gated is misleading"
  argument we could drop it. This spec keeps it for now to avoid cascade
  churn in B98-R8 / B98-R9 fixtures and refresh logic, and because it's
  small and homogeneous. Revisit if locale-bench results start drifting
  the file size or causing baseline diffs to bury the gated rows.

No question above is **blocking** — every requirement is implementable
under reasonable defaults the implementer can pick, and any of the
above tunings can be adjusted in a follow-up without re-spec.
