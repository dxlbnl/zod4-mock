/**
 * B97-R6 / B97-R8 / B97-R9 — matcher-tier shape & infrastructure.
 *
 * Tests-first RED file. Covers:
 *
 *   - B97-R6 — matcher-tier schema and registration shape is present in
 *     `site/bench/perf.test.ts` (a User+Company schema with matchers hitting
 *     `fullName`, `email`, `city`, nested-object `address`, and relation
 *     `employerId`). Asserted by source-text grep — the implementer
 *     satisfies it by adding the schemas/matchers/`describe` block to the
 *     bench file.
 *
 *   - B97-R8 — `compareToBaseline` iterates a fourth `matcher` tier, with
 *     the +25 % time / +50 % memory thresholds applied identically. A
 *     missing matcher baseline (legacy carveout) prints SKIP and does NOT
 *     fail the build.
 *
 *   - B97-R9 — `versions-schema.ts`'s Zod schema accepts an entry whose
 *     `avg_us` and `memory` blocks carry a `matcher` field (number / mem
 *     block, OR `null` for legacy rows).
 *
 * Failure modes today (pre-fix):
 *   - R6 — `perf.test.ts` has no `CompanySchema` / `UserSchema` /
 *     `employerId` matcher references.
 *   - R8 — `regression-compare.ts` exports `Tier = "simple" | "user" |
 *     "nested"` only; the comparator never emits a matcher row.
 *   - R9 — `versions-schema.ts` does not declare a matcher key.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compareToBaseline, type RunLike } from "./regression-compare.ts";
import { versionsFileSchema } from "./versions-schema.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── B97-R6 — matcher tier schema in perf.test.ts ────────────────────────────

describe("B97-R6 / perf.test.ts carries the matcher tier", () => {
  it("B97-R6 / perf.test.ts source references CompanySchema, UserSchema, and the spec-pinned matcher names", () => {
    const src = readFileSync(join(__dirname, "perf.test.ts"), "utf-8");

    // Spec §B97-R6 pins the schema and matcher names. Source grep is the
    // cheapest correct check.
    expect(src).toContain("CompanySchema");
    expect(src).toContain("UserSchema");
    expect(src).toContain("fullName");
    expect(src).toContain("email");
    expect(src).toContain("city");
    expect(src).toContain("address");
    expect(src).toContain("employerId");

    // The matcher tier must measure populate(UserSchema, 100) (or
    // generate(UserSchema)) — the spec recommends populate(100). Assert at
    // least one of the two forms is present.
    const measuresUserPopulate =
      src.includes("populate(UserSchema, 100)") || src.includes("generate(UserSchema)");
    expect(measuresUserPopulate).toBe(true);
  });

  it("B97-R6 / perf.test.ts has a 'matcher schema' describe block", () => {
    const src = readFileSync(join(__dirname, "perf.test.ts"), "utf-8");
    expect(src).toMatch(/describe\(["']matcher schema["']/);
  });
});

// ─── B97-R8 — comparator iterates the matcher tier ──────────────────────────

interface MatcherBenchResultLike {
  avg: number;
}
interface MatcherTierLike {
  zod4_mock: MatcherBenchResultLike;
}
interface MatcherMemTierLike {
  heapUsedDeltaBytes: number;
  v8HeapUsedBytes: number;
  gcForced: boolean;
}
type FourTierRun = {
  results: Record<"simple" | "user" | "nested" | "matcher", MatcherTierLike>;
  memory: Record<"simple" | "user" | "nested" | "matcher", MatcherMemTierLike>;
};

const THRESHOLDS = {
  timeWarnPct: 10,
  timeFailPct: 25,
  memWarnPct: 25,
  memFailPct: 50,
} as const;

function makeFourTierRun(matcherAvg: number, memBytes = 1_000_000): FourTierRun {
  const t = (avg: number): MatcherTierLike => ({ zod4_mock: { avg } });
  const m = (bytes: number): MatcherMemTierLike => ({
    heapUsedDeltaBytes: bytes,
    v8HeapUsedBytes: 50_000_000,
    gcForced: false,
  });
  return {
    results: {
      simple: t(0.0083),
      user: t(0.0168),
      nested: t(0.0437),
      matcher: t(matcherAvg),
    },
    memory: {
      simple: m(memBytes),
      user: m(memBytes),
      nested: m(memBytes),
      matcher: m(memBytes),
    },
  };
}

describe("B97-R8 / comparator iterates the matcher tier", () => {
  it("B97-R8 / regression-compare.ts source declares the matcher tier", () => {
    // Source-grep mirror of the typecheck-level signal. RED today:
    // `regression-compare.ts` declares `Tier = "simple" | "user" |
    // "nested"` and `TIERS = ["simple", "user", "nested"] as const`.
    // Post-fix both grow a `"matcher"` member. (We use a source grep
    // because the union narrowness is a typecheck concern that vitest
    // cannot directly observe at runtime.)
    const src = readFileSync(join(__dirname, "regression-compare.ts"), "utf-8");
    expect(
      src.includes('"matcher"'),
      "regression-compare.ts must declare the matcher tier in its Tier union and TIERS list",
    ).toBe(true);
  });

  it("B97-R8 / +30% matcher-tier time regression produces a FAIL row", () => {
    // baseline matcher avg = 0.040 ms; latest matcher avg = 0.060 ms (+50%).
    const baseline = makeFourTierRun(0.04);
    const latest = makeFourTierRun(0.06);

    const report = compareToBaseline(
      baseline as unknown as RunLike,
      latest as unknown as RunLike,
      THRESHOLDS,
    );

    const matcherTime = report.rows.find(
      (r) => (r.tier as string) === "matcher" && r.metric === "time",
    );
    expect(matcherTime).toBeDefined();
    expect(matcherTime!.status).toBe("FAIL");
    expect(matcherTime!.deltaPct).toBeGreaterThan(25);
    expect(report.verdict).toBe("FAIL");
  });

  it("B97-R8 / missing matcher baseline (legacy) emits SKIP and does not fail the build", () => {
    // Baseline is the three-tier shape — no `matcher` keys. Latest carries
    // a populated matcher block. The comparator must emit SKIP for the
    // matcher rows and the aggregate verdict MUST NOT be FAIL.
    const baseline = {
      results: {
        simple: { zod4_mock: { avg: 0.0083 } },
        user: { zod4_mock: { avg: 0.0168 } },
        nested: { zod4_mock: { avg: 0.0437 } },
      },
      memory: {
        simple: { heapUsedDeltaBytes: 1_000_000, v8HeapUsedBytes: 50_000_000, gcForced: false },
        user: { heapUsedDeltaBytes: 1_000_000, v8HeapUsedBytes: 50_000_000, gcForced: false },
        nested: { heapUsedDeltaBytes: 1_000_000, v8HeapUsedBytes: 50_000_000, gcForced: false },
      },
    };
    const latest = makeFourTierRun(0.04);

    const report = compareToBaseline(
      baseline as unknown as RunLike,
      latest as unknown as RunLike,
      THRESHOLDS,
    );

    const matcherTime = report.rows.find(
      (r) => (r.tier as string) === "matcher" && r.metric === "time",
    );
    const matcherMem = report.rows.find(
      (r) => (r.tier as string) === "matcher" && r.metric === "memory",
    );

    // RED today: matcher rows are absent altogether.
    expect(matcherTime).toBeDefined();
    expect(matcherTime!.status).toBe("SKIP");
    expect(matcherMem).toBeDefined();
    expect(matcherMem!.status).toBe("SKIP");

    // Aggregate must be OK (a SKIP doesn't gate the build).
    expect(report.verdict).not.toBe("FAIL");
  });
});

// ─── B97-R9 — versions-schema.ts carries the matcher field ───────────────────

describe("B97-R9 / versions-schema parses entries with the matcher tier", () => {
  it("B97-R9 / parses an entry whose avg_us and memory both carry matcher data", () => {
    const fixture = {
      _doc: "test fixture",
      config: { warmup: 1000, runs: 5000 },
      node: "v22.22.2",
      schemas: { simple: "x", user: "y", nested: "z" },
      entries: [
        {
          timestamp: "2026-06-04T00:00:00Z",
          version: "0.99.0",
          avg_us: {
            simple: 8.3,
            user: 16.8,
            nested: 43.7,
            matcher: 25.0,
          },
          memory: {
            simple: { heapUsedDeltaBytes: 1000, v8HeapUsedBytes: 100000, gcForced: false },
            user: { heapUsedDeltaBytes: 1000, v8HeapUsedBytes: 100000, gcForced: false },
            nested: { heapUsedDeltaBytes: 1000, v8HeapUsedBytes: 100000, gcForced: false },
            matcher: { heapUsedDeltaBytes: 1000, v8HeapUsedBytes: 100000, gcForced: false },
          },
        },
      ],
    };

    // RED today: the schema's `avg_us` and `memory` objects don't declare
    // `matcher`, and the `entries` array is parsed against the strict
    // shape — the extra key surfaces as a parse error or is dropped
    // depending on z.object posture. The schema becomes additive in the
    // implementer's update.
    const parsed = versionsFileSchema.parse(fixture);
    const entry = parsed.entries[0]!;
    const avg = entry.avg_us as Record<string, number>;
    const mem = entry.memory as Record<string, { heapUsedDeltaBytes: number }>;
    expect(typeof avg.matcher).toBe("number");
    expect(mem.matcher).toBeDefined();
    expect(typeof mem.matcher.heapUsedDeltaBytes).toBe("number");
  });

  it("B97-R9 / parses a legacy entry whose matcher fields are absent or null", () => {
    const legacyFixture = {
      _doc: "test fixture",
      config: { warmup: 1000, runs: 5000 },
      node: "v22.22.2",
      schemas: { simple: "x", user: "y", nested: "z" },
      entries: [
        {
          timestamp: "2026-06-04T00:00:00Z",
          version: "0.5.0",
          avg_us: { simple: 9.6, user: 21, nested: 48.2, matcher: null },
          memory: {
            simple: { heapUsedDeltaBytes: 1000, v8HeapUsedBytes: 100000, gcForced: false },
            user: { heapUsedDeltaBytes: 1000, v8HeapUsedBytes: 100000, gcForced: false },
            nested: { heapUsedDeltaBytes: 1000, v8HeapUsedBytes: 100000, gcForced: false },
            matcher: null,
          },
          note: "matcher tier not supported on this alias",
        },
      ],
    };

    // RED today: legacy `matcher: null` is rejected by the strict schema
    // (no `matcher` key declared at all). Post-fix the schema accepts
    // either undefined or null.
    const parsed = versionsFileSchema.parse(legacyFixture);
    const entry = parsed.entries[0]!;
    const avg = entry.avg_us as Record<string, number | null | undefined>;
    const mem = entry.memory as Record<string, unknown>;
    expect(avg.matcher === null || avg.matcher === undefined).toBe(true);
    expect(mem.matcher === null || mem.matcher === undefined).toBe(true);
  });
});
