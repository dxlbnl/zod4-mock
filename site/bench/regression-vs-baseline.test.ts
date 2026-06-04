/**
 * B98-R5 / B98-R7 / B98-R8 — comparator unit tests.
 *
 * Feeds synthetic baseline/latest objects into the comparator that
 * `bench/perf.test.ts` will invoke after measurement. The comparator module
 * (`./regression-compare.ts`) does not exist yet — the implementer creates it.
 *
 * Contract (negotiated here so the implementer has a target signature):
 *
 *   import { compareToBaseline, type ComparisonReport, type Verdict, type Row }
 *     from "./regression-compare.ts";
 *
 *   const report: ComparisonReport = compareToBaseline(baseline, latest, {
 *     timeWarnPct: 10,      // [10, 25] → WARN
 *     timeFailPct: 25,      // > 25     → FAIL
 *     memWarnPct: 25,
 *     memFailPct: 50,
 *   });
 *
 *   report.verdict: "OK" | "WARN" | "FAIL"   // aggregate
 *   report.rows: Row[]                       // ordered: time rows then memory rows
 *   report.exitCode: number                  // 0 unless verdict === "FAIL"
 *
 * A `Row` has at least:
 *   { tier: "simple" | "user" | "nested",
 *     metric: "time" | "memory",
 *     baseline: number,
 *     current: number,
 *     deltaPct: number,
 *     status: "OK" | "WARN" | "FAIL" | "SKIP" }
 *
 * `report.table` is the formatted multi-line string the test logs.
 * faker / zod3_mock columns MUST NOT appear in `rows`.
 */

import { describe, expect, it } from "vitest";

import {
  compareToBaseline,
  type ComparisonReport,
} from "./regression-compare.ts";

// ─── Shared baseline / latest fixtures ────────────────────────────────────────

/** Minimal latest.json/baseline.json shape used by the comparator. */
type BenchResultLike = { avg: number };
type TierLike = {
  faker: BenchResultLike;
  zod3_mock: BenchResultLike;
  zod4_mock: BenchResultLike;
};
type MemTierLike = {
  heapUsedDeltaBytes: number;
  v8HeapUsedBytes: number;
  gcForced: boolean;
};
type RunLike = {
  results: { simple: TierLike; user: TierLike; nested: TierLike };
  memory: { simple: MemTierLike; user: MemTierLike; nested: MemTierLike };
};

function makeRun(
  z4: { simple: number; user: number; nested: number },
  mem: { simple: number; user: number; nested: number } = {
    simple: 1_000_000,
    user: 1_000_000,
    nested: 1_000_000,
  },
): RunLike {
  const tier = (avg: number): TierLike => ({
    faker: { avg: 0.005 },
    zod3_mock: { avg: 0.02 },
    zod4_mock: { avg },
  });
  const m = (bytes: number): MemTierLike => ({
    heapUsedDeltaBytes: bytes,
    v8HeapUsedBytes: 50_000_000,
    gcForced: false,
  });
  return {
    results: { simple: tier(z4.simple), user: tier(z4.user), nested: tier(z4.nested) },
    memory: { simple: m(mem.simple), user: m(mem.user), nested: m(mem.nested) },
  };
}

const THRESHOLDS = {
  timeWarnPct: 10,
  timeFailPct: 25,
  memWarnPct: 25,
  memFailPct: 50,
} as const;

// ─── B98-R5 — time regression guardrail ───────────────────────────────────────

describe("B98-R5 / time regression guardrail", () => {
  it("B98-R5 / 30% time regression on simple fails the build", () => {
    const baseline = makeRun({ simple: 0.0083, user: 0.0168, nested: 0.0437 });
    // +30% on simple
    const latest = makeRun({ simple: 0.0108, user: 0.0168, nested: 0.0437 });

    const report: ComparisonReport = compareToBaseline(baseline, latest, THRESHOLDS);

    expect(report.verdict).toBe("FAIL");
    expect(report.exitCode).not.toBe(0);
    const simpleTime = report.rows.find((r) => r.tier === "simple" && r.metric === "time");
    expect(simpleTime).toBeDefined();
    expect(simpleTime!.status).toBe("FAIL");
    expect(simpleTime!.deltaPct).toBeGreaterThan(25);
    expect(simpleTime!.deltaPct).toBeLessThan(35);
  });

  it("B98-R5 / 15% time regression on user warns but does not fail", () => {
    const baseline = makeRun({ simple: 0.0083, user: 0.0168, nested: 0.0437 });
    // +15% on user only
    const latest = makeRun({
      simple: 0.0083,
      user: 0.0168 * 1.15,
      nested: 0.0437,
    });

    const report = compareToBaseline(baseline, latest, THRESHOLDS);

    expect(report.verdict).toBe("WARN");
    expect(report.exitCode).toBe(0);
    const userTime = report.rows.find((r) => r.tier === "user" && r.metric === "time");
    expect(userTime).toBeDefined();
    expect(userTime!.status).toBe("WARN");
    expect(userTime!.deltaPct).toBeGreaterThanOrEqual(10);
    expect(userTime!.deltaPct).toBeLessThanOrEqual(25);
  });

  it("B98-R5 / an improvement is OK (negative deltaPct)", () => {
    const baseline = makeRun({ simple: 0.0100, user: 0.0200, nested: 0.0500 });
    // simple gets 20% faster
    const latest = makeRun({ simple: 0.0080, user: 0.0200, nested: 0.0500 });

    const report = compareToBaseline(baseline, latest, THRESHOLDS);

    const simpleTime = report.rows.find((r) => r.tier === "simple" && r.metric === "time");
    expect(simpleTime).toBeDefined();
    expect(simpleTime!.status).toBe("OK");
    expect(simpleTime!.deltaPct).toBeLessThan(0);
    // No tier failed, so aggregate is not FAIL.
    expect(report.verdict).not.toBe("FAIL");
    expect(report.exitCode).toBe(0);
  });

  it("B98-R5 / faker and zod3_mock columns do not gate", () => {
    const baseline = makeRun({ simple: 0.0083, user: 0.0168, nested: 0.0437 });
    // zod4_mock unchanged; faker +200% would gate if it were included.
    const latest: RunLike = makeRun({ simple: 0.0083, user: 0.0168, nested: 0.0437 });
    latest.results.simple.faker = { avg: baseline.results.simple.faker.avg * 3 };

    const report = compareToBaseline(baseline, latest, THRESHOLDS);

    // No row should reference faker or zod3_mock.
    for (const row of report.rows) {
      expect(["simple", "user", "nested"]).toContain(row.tier);
      // metric is time|memory; the comparator never emits faker/zod3_mock rows.
      expect(row.metric === "time" || row.metric === "memory").toBe(true);
    }
    expect(report.verdict).not.toBe("FAIL");
    expect(report.exitCode).toBe(0);
  });

  it("B98-R5 / formatted table includes the required columns", () => {
    const baseline = makeRun({ simple: 0.0083, user: 0.0168, nested: 0.0437 });
    const latest = makeRun({ simple: 0.0108, user: 0.0168, nested: 0.0437 });
    const report = compareToBaseline(baseline, latest, THRESHOLDS);

    expect(typeof report.table).toBe("string");
    // The spec calls out the columns explicitly: tier, baseline, current, delta_pct, status.
    expect(report.table.toLowerCase()).toContain("tier");
    expect(report.table.toLowerCase()).toContain("baseline");
    expect(report.table.toLowerCase()).toContain("current");
    expect(report.table.toLowerCase()).toMatch(/delta[_ ]?pct/);
    expect(report.table.toLowerCase()).toContain("status");
  });
});

// ─── B98-R7 — memory regression guardrail ─────────────────────────────────────

describe("B98-R7 / memory regression guardrail", () => {
  it("B98-R7 / 70% memory regression on user fails", () => {
    const baseline = makeRun(
      { simple: 0.0083, user: 0.0168, nested: 0.0437 },
      { simple: 1_000_000, user: 1_000_000, nested: 1_000_000 },
    );
    const latest = makeRun(
      { simple: 0.0083, user: 0.0168, nested: 0.0437 },
      { simple: 1_000_000, user: 1_700_000, nested: 1_000_000 },
    );

    const report = compareToBaseline(baseline, latest, THRESHOLDS);

    const userMem = report.rows.find((r) => r.tier === "user" && r.metric === "memory");
    expect(userMem).toBeDefined();
    expect(userMem!.status).toBe("FAIL");
    expect(userMem!.deltaPct).toBeGreaterThan(50);
    expect(userMem!.deltaPct).toBeLessThan(100);
    expect(report.verdict).toBe("FAIL");
    expect(report.exitCode).not.toBe(0);
  });

  it("B98-R7 / baseline memory of 0 skips the memory check", () => {
    const baseline = makeRun(
      { simple: 0.0083, user: 0.0168, nested: 0.0437 },
      { simple: 0, user: 1_000_000, nested: 1_000_000 },
    );
    const latest = makeRun(
      { simple: 0.0083, user: 0.0168, nested: 0.0437 },
      { simple: 5_000_000, user: 1_000_000, nested: 1_000_000 },
    );

    const report = compareToBaseline(baseline, latest, THRESHOLDS);

    const simpleMem = report.rows.find((r) => r.tier === "simple" && r.metric === "memory");
    expect(simpleMem).toBeDefined();
    expect(simpleMem!.status).toBe("SKIP");
    // SKIP must not flip the aggregate verdict or the exit code.
    expect(report.verdict).not.toBe("FAIL");
    expect(report.exitCode).toBe(0);
  });
});

// ─── B98-R5 — comparator tolerates a stripped baseline (no faker / zod3_mock) ─

describe("B98-R5 / comparator tolerates a stripped baseline", () => {
  it("B98-R5 / baseline with only zod4_mock per tier does not throw and emits no faker/zod3_mock rows", () => {
    // Synthetic baseline: each tier carries ONLY zod4_mock (per B98-R4 amended).
    type StrippedTierLike = { zod4_mock: BenchResultLike };
    type StrippedRunLike = {
      results: { simple: StrippedTierLike; user: StrippedTierLike; nested: StrippedTierLike };
      memory: { simple: MemTierLike; user: MemTierLike; nested: MemTierLike };
    };
    const m: MemTierLike = {
      heapUsedDeltaBytes: 1_000_000,
      v8HeapUsedBytes: 50_000_000,
      gcForced: false,
    };
    const strippedBaseline: StrippedRunLike = {
      results: {
        simple: { zod4_mock: { avg: 0.0083 } },
        user: { zod4_mock: { avg: 0.0168 } },
        nested: { zod4_mock: { avg: 0.0437 } },
      },
      memory: { simple: m, user: m, nested: m },
    };
    // latest carries the full set (faker + zod3_mock + zod4_mock) — current
    // perf.test.ts still writes all three; the comparator should ignore
    // baseline's missing faker/zod3_mock without crashing.
    const latest = makeRun({ simple: 0.0083, user: 0.0168, nested: 0.0437 });

    // The cast reflects that on disk the baseline is the stripped subset.
    expect(() =>
      compareToBaseline(strippedBaseline as unknown as Parameters<typeof compareToBaseline>[0], latest, THRESHOLDS),
    ).not.toThrow();

    const report = compareToBaseline(
      strippedBaseline as unknown as Parameters<typeof compareToBaseline>[0],
      latest,
      THRESHOLDS,
    );
    // No row references faker or zod3_mock — only the three tiers (time + memory).
    for (const row of report.rows) {
      expect(["simple", "user", "nested"]).toContain(row.tier);
      expect(row.metric === "time" || row.metric === "memory").toBe(true);
    }
    expect(report.verdict).not.toBe("FAIL");
    expect(report.exitCode).toBe(0);
  });
});

// ─── B98-R8 — smoke acceptance against 0.7.2 → 0.8.0 numbers ─────────────────

describe("B98-R8 / smoke acceptance — 0.7.2 baseline rejects 0.8.0", () => {
  it("B98-R8 / comparator returns FAIL on all three tiers", () => {
    // From site/bench/results/versions.json (avg_us, µs → ms = /1000).
    const v072 = { simple: 8.3 / 1000, user: 16.8 / 1000, nested: 43.7 / 1000 };
    const v080 = { simple: 76.8 / 1000, user: 154.1 / 1000, nested: 467.8 / 1000 };

    const baseline = makeRun(v072);
    const latest = makeRun(v080);

    const report = compareToBaseline(baseline, latest, THRESHOLDS);

    const timeRows = report.rows.filter((r) => r.metric === "time");
    expect(timeRows).toHaveLength(3);
    for (const row of timeRows) {
      expect(row.status).toBe("FAIL");
      // 0.7.2 → 0.8.0 is roughly +800% on every tier; well past the 25% threshold.
      expect(row.deltaPct).toBeGreaterThan(700);
    }
    expect(report.verdict).toBe("FAIL");
    expect(report.exitCode).not.toBe(0);
  });
});
