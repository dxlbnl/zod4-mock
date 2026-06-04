/**
 * B98-R5 / B98-R7 — perf + memory regression comparator.
 *
 * Pure function: takes a baseline-shaped object and a latest-shaped object,
 * returns a verdict + per-tier rows + a formatted table. Used by:
 *   - bench/perf.test.ts (live: compares the just-written run against baseline.json)
 *   - bench/regression-vs-baseline.test.ts (unit fixtures: synthetic objects)
 *
 * Only the zod4_mock arm of each tier is gated. faker / zod3_mock columns
 * are explicitly out of scope (B98-R5).
 */

export type Tier = "simple" | "user" | "nested" | "matcher";
export type Metric = "time" | "memory";
export type Status = "OK" | "WARN" | "FAIL" | "SKIP";
export type Verdict = "OK" | "WARN" | "FAIL";

export interface Row {
  tier: Tier;
  metric: Metric;
  baseline: number;
  current: number;
  deltaPct: number;
  status: Status;
}

export interface ComparisonReport {
  verdict: Verdict;
  exitCode: number;
  rows: Row[];
  table: string;
}

export interface Thresholds {
  timeWarnPct: number;
  timeFailPct: number;
  memWarnPct: number;
  memFailPct: number;
}

interface BenchResultLike {
  avg: number;
}

interface TierLike {
  zod4_mock: BenchResultLike;
}

interface MemTierLike {
  heapUsedDeltaBytes: number;
  v8HeapUsedBytes: number;
  gcForced?: boolean;
}

export interface RunLike {
  // B97-R8 — `matcher` tier may be absent on legacy baselines captured
  // before the matcher tier existed; the comparator emits SKIP rows for
  // such baselines (mirrors the `memory: null` legacy carveout).
  results: Partial<Record<Tier, TierLike>>;
  memory: Partial<Record<Tier, MemTierLike>>;
}

const TIERS: readonly Tier[] = ["simple", "user", "nested", "matcher"] as const;

function pctDelta(baseline: number, current: number): number {
  if (baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
}

function timeStatus(deltaPct: number, warnPct: number, failPct: number): Status {
  if (deltaPct > failPct) return "FAIL";
  if (deltaPct >= warnPct) return "WARN";
  return "OK";
}

function memStatus(baseline: number, deltaPct: number, warnPct: number, failPct: number): Status {
  if (baseline === 0) return "SKIP";
  if (deltaPct > failPct) return "FAIL";
  if (deltaPct >= warnPct) return "WARN";
  return "OK";
}

function aggregate(rows: Row[]): Verdict {
  let worst: Verdict = "OK";
  for (const row of rows) {
    if (row.status === "FAIL") return "FAIL";
    if (row.status === "WARN") worst = "WARN";
  }
  return worst;
}

function formatNum(n: number, digits: number): string {
  return n.toFixed(digits);
}

function formatTable(rows: Row[]): string {
  const header = ["tier", "metric", "baseline", "current", "delta_pct", "status"];
  const out: string[] = [];
  out.push(header.join(" | "));
  out.push(header.map((h) => "-".repeat(h.length)).join("-|-"));
  for (const r of rows) {
    const sign = r.deltaPct >= 0 ? "+" : "";
    const baseStr = r.metric === "time" ? `${formatNum(r.baseline, 4)}ms` : `${r.baseline}B`;
    const curStr = r.metric === "time" ? `${formatNum(r.current, 4)}ms` : `${r.current}B`;
    out.push(
      [r.tier, r.metric, baseStr, curStr, `${sign}${formatNum(r.deltaPct, 1)}%`, r.status].join(
        " | ",
      ),
    );
  }
  return out.join("\n");
}

export function compareToBaseline(
  baseline: RunLike,
  latest: RunLike,
  thresholds: Thresholds,
): ComparisonReport {
  const rows: Row[] = [];

  // Time rows first.
  for (const tier of TIERS) {
    const bTier = baseline.results[tier];
    const cTier = latest.results[tier];
    // B97-R8 — missing baseline matcher (legacy carveout) ⇒ SKIP both
    // time and memory rows for that tier; verdict unchanged.
    if (bTier === undefined || cTier === undefined) {
      if (cTier !== undefined || bTier !== undefined) {
        rows.push({
          tier,
          metric: "time",
          baseline: 0,
          current: cTier?.zod4_mock.avg ?? 0,
          deltaPct: 0,
          status: "SKIP",
        });
      }
      continue;
    }
    const b = bTier.zod4_mock.avg;
    const c = cTier.zod4_mock.avg;
    const delta = pctDelta(b, c);
    rows.push({
      tier,
      metric: "time",
      baseline: b,
      current: c,
      deltaPct: delta,
      status: timeStatus(delta, thresholds.timeWarnPct, thresholds.timeFailPct),
    });
  }

  // Memory rows.
  for (const tier of TIERS) {
    const bMem = baseline.memory[tier];
    const cMem = latest.memory[tier];
    if (bMem === undefined || cMem === undefined) {
      if (cMem !== undefined || bMem !== undefined) {
        rows.push({
          tier,
          metric: "memory",
          baseline: 0,
          current: cMem?.heapUsedDeltaBytes ?? 0,
          deltaPct: 0,
          status: "SKIP",
        });
      }
      continue;
    }
    const b = bMem.heapUsedDeltaBytes;
    const c = cMem.heapUsedDeltaBytes;
    const delta = pctDelta(b, c);
    rows.push({
      tier,
      metric: "memory",
      baseline: b,
      current: c,
      deltaPct: delta,
      status: memStatus(b, delta, thresholds.memWarnPct, thresholds.memFailPct),
    });
  }

  const verdict = aggregate(rows);
  const exitCode = verdict === "FAIL" ? 1 : 0;
  const table = formatTable(rows);

  return { verdict, exitCode, rows, table };
}
