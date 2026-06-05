/**
 * B71 — Replace fixed runs with time-budget bench measurement.
 *
 * One test per requirement ID from
 * wiki/specs/B71-site-time-budget-bench.md (R1–R8, excluding the
 * type-level R1 sub-check which lives in bench.B71.types.test.ts
 * because it's consumed by `pnpm site:check`, not vitest).
 *
 * RED CHECK: `pnpm site:test:unit`. The perf gate (`pnpm site:bench`)
 * is NOT run for RED.
 *
 * Today's failure modes (pre-fix):
 *   - `measure()` does not accept `budgetMs` / `maxRuns`; passing them
 *     either gets ignored or trips strict-options checks.
 *   - The return shape lacks a `runs` field.
 *   - `perf.test.ts` and `regression.bench.ts` still declare `RUNS`
 *     / `MATCHER_RUNS` constants and pass `runs:` to `measure()`.
 *   - `+page.svelte` still calls `measure(fn)` with no `budgetMs`
 *     option and lacks the visible "budget: 200ms per cell" badge.
 *   - The `latest.json` writer still emits `config: { warmup, runs }`
 *     instead of `{ warmup, budgetMs, maxRuns, matcherWarmup, matcherBudgetMs }`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { measure } from "./bench";

const __dirname = dirname(fileURLToPath(import.meta.url));
// site/src/lib/ → site root is two levels up.
const SITE_ROOT = join(__dirname, "..", "..");
const BENCH_DIR = join(SITE_ROOT, "bench");
const ROUTES_BENCH = join(SITE_ROOT, "src", "routes", "bench");

function readText(absPath: string): string {
  return readFileSync(absPath, "utf8");
}

/**
 * Strip line and block comments so source-text greps don't false-positive
 * on legitimate explanatory comments that mention `runs:` or `budgetMs:`.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// ─────────────────────────────────────────────────────────────────────────────
// B71-R1 — `measure()` switches from fixed runs to time budget
// ─────────────────────────────────────────────────────────────────────────────

describe("B71-R1 / budget-bounded loop", () => {
  it("B71-R1 / measure(fn, { warmup, budgetMs }) returns runs > 0 and wall-clock ≈ budgetMs", () => {
    // Spec scenario: budget-bounded loop. With a no-op `fn` and
    // budgetMs:50 the loop runs many iterations within ~50ms wall time
    // (plus startup slack). The new `runs` field must be present.
    const t0 = performance.now();
    const result = measure(() => {}, { warmup: 1, budgetMs: 50 } as Parameters<typeof measure>[1]);
    const wall = performance.now() - t0;

    // Cast the result to access the new `runs` field — pre-fix this is
    // undefined, and the assertion fails with "expected undefined to be
    // a number". Post-fix `runs` is a positive integer.
    const runs = (result as unknown as { runs?: number }).runs;
    expect(typeof runs, "result must include a numeric `runs` field").toBe("number");
    expect(runs!).toBeGreaterThan(0);

    // Generous upper bound on the wall time — the goal is to catch a
    // catastrophic regression (e.g. budget ignored, loop runs forever)
    // not nitpick scheduler noise.
    expect(wall, "wall-clock must be roughly bounded by budgetMs + slack").toBeLessThan(2000);
  });

  it("B71-R1 / return shape extension: has avg, min, max, opsPerSec, coldStart, runs (all numbers)", () => {
    // Spec scenario: return shape extension. Existing five keys plus
    // the new `runs`, all numeric.
    const result = measure(() => {}, { warmup: 0, budgetMs: 25 } as Parameters<typeof measure>[1]);
    const expected = ["avg", "min", "max", "opsPerSec", "coldStart", "runs"];
    for (const key of expected) {
      const v = (result as unknown as Record<string, unknown>)[key];
      expect(typeof v, `${key} must be a number on the BenchResult`).toBe("number");
    }
  });

  it("B71-R1 / avg / opsPerSec relationship preserved bit-for-bit", () => {
    // Spec scenario: avg/opsPerSec relationship preserved.
    const result = measure(() => {}, { warmup: 1, budgetMs: 25 } as Parameters<typeof measure>[1]);
    expect(Math.abs(result.opsPerSec - 1000 / result.avg)).toBeLessThan(1e-9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B71-R2 — `maxRuns` safety cap
// ─────────────────────────────────────────────────────────────────────────────

describe("B71-R2 / maxRuns safety cap", () => {
  it("B71-R2 / cap honoured for no-op fn (runs === maxRuns when budget would otherwise allow more)", () => {
    // Spec scenario: cap honoured. With budgetMs huge and maxRuns
    // small, the loop must hit `runs === maxRuns` long before the
    // budget elapses.
    const result = measure(() => {}, {
      warmup: 0,
      budgetMs: 1_000_000,
      maxRuns: 100,
    } as Parameters<typeof measure>[1]);
    const runs = (result as unknown as { runs?: number }).runs;
    expect(runs, "runs must equal the maxRuns cap when budget allows more").toBe(100);
  });

  it("B71-R2 / default maxRuns is 1_000_000 (bounded even with no explicit cap)", () => {
    // Spec scenario: default cap is 1_000_000. With a moderate budget
    // and no explicit maxRuns the loop is still bounded.
    const result = measure(() => {}, {
      warmup: 0,
      budgetMs: 25,
    } as Parameters<typeof measure>[1]);
    const runs = (result as unknown as { runs?: number }).runs;
    expect(typeof runs).toBe("number");
    expect(runs!).toBeLessThanOrEqual(1_000_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B71-R3 — CLI bench uses a per-tier budget
// ─────────────────────────────────────────────────────────────────────────────

describe("B71-R3 / CLI bench uses budget API", () => {
  it("B71-R3 / perf.test.ts declares BUDGET_MS=500 + MATCHER_BUDGET_MS=1000, no RUNS/MATCHER_RUNS, every measure() uses budgetMs:", () => {
    const src = readText(join(BENCH_DIR, "perf.test.ts"));
    const stripped = stripComments(src);

    // BUDGET_MS = 500 (simple/user/nested/locale).
    expect(stripped, "perf.test.ts must declare `const BUDGET_MS = 500`").toMatch(
      /\bconst\s+BUDGET_MS\s*=\s*500\b/,
    );
    // MATCHER_BUDGET_MS = 1000.
    expect(stripped, "perf.test.ts must declare `const MATCHER_BUDGET_MS = 1000`").toMatch(
      /\bconst\s+MATCHER_BUDGET_MS\s*=\s*1000\b/,
    );

    // Fixed-runs constants are gone.
    expect(/\bconst\s+RUNS\s*=/.test(stripped), "perf.test.ts must remove `const RUNS = ...`").toBe(
      false,
    );
    expect(
      /\bconst\s+MATCHER_RUNS\s*=/.test(stripped),
      "perf.test.ts must remove `const MATCHER_RUNS = ...`",
    ).toBe(false);

    // No `measure(...)` call passes a `runs:` option key. The grep is
    // conservative — `runs:` as a property literal anywhere in the
    // measure() argument area.
    expect(
      /\bmeasure\s*\([^)]*\bruns\s*:/.test(stripped),
      "no measure(...) call in perf.test.ts may pass `runs:`",
    ).toBe(false);

    // At least one `measure(...)` call uses `budgetMs:` (the migration
    // has happened, not just removed the old key).
    expect(/\bmeasure\s*\([^)]*\bbudgetMs\s*:/.test(stripped)).toBe(true);
  });

  it("B71-R3 / regression.bench.ts declares BUDGET_MS + MATCHER_BUDGET_MS, no RUNS/MATCHER_RUNS, every measure() uses budgetMs:", () => {
    const src = readText(join(BENCH_DIR, "regression.bench.ts"));
    const stripped = stripComments(src);

    expect(stripped, "regression.bench.ts must declare `const BUDGET_MS = 500`").toMatch(
      /\bconst\s+BUDGET_MS\s*=\s*500\b/,
    );
    expect(stripped, "regression.bench.ts must declare `const MATCHER_BUDGET_MS = 1000`").toMatch(
      /\bconst\s+MATCHER_BUDGET_MS\s*=\s*1000\b/,
    );

    expect(
      /\bconst\s+RUNS\s*=/.test(stripped),
      "regression.bench.ts must remove `const RUNS = ...`",
    ).toBe(false);
    expect(
      /\bconst\s+MATCHER_RUNS\s*=/.test(stripped),
      "regression.bench.ts must remove `const MATCHER_RUNS = ...`",
    ).toBe(false);

    expect(
      /\bmeasure\s*\([^)]*\bruns\s*:/.test(stripped),
      "no measure(...) call in regression.bench.ts may pass `runs:`",
    ).toBe(false);

    expect(/\bmeasure\s*\([^)]*\bbudgetMs\s*:/.test(stripped)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B71-R4 — Browser bench uses a smaller budget
// ─────────────────────────────────────────────────────────────────────────────

describe("B71-R4 / browser bench uses 200ms budget", () => {
  it("B71-R4 / +page.svelte declares BUDGET_MS=200 and the budget flows to the worker via budgetMs:", () => {
    // B71-R4 originally asserted `measure(... { budgetMs: ... })` appeared
    // in +page.svelte directly. B69 then moved the `measure()` call into
    // the Worker (`$lib/bench.worker.ts`); the page now constructs the
    // request `{ kind: 'run', schema, n, budgetMs: BUDGET_MS }` and posts
    // it to the worker, which calls `measure(..., { budgetMs: req.budgetMs })`.
    // The B71-R4 intent — "the page issues bench work parameterised by
    // BUDGET_MS=200" — is preserved; the legacy `measure(` token check
    // has been replaced by a `budgetMs:` token check that still proves
    // the constant flows downstream.
    const src = readText(join(ROUTES_BENCH, "+page.svelte"));
    const stripped = stripComments(src);

    expect(stripped, "/bench +page.svelte must declare `const BUDGET_MS = 200`").toMatch(
      /\bconst\s+BUDGET_MS\s*=\s*200\b/,
    );

    // No `runs:` literal anywhere in the page (the fixed-runs API is gone).
    expect(
      /\bruns\s*:/.test(stripped),
      "+page.svelte must not pass `runs:` (the fixed-runs API is gone)",
    ).toBe(false);

    // The BUDGET_MS constant must flow into a `budgetMs:` field somewhere
    // in the page (today, into the `BenchWorkerRequest` posted to the
    // worker).
    expect(stripped, "+page.svelte must use `budgetMs:` to forward BUDGET_MS").toMatch(
      /\bbudgetMs\s*:/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B71-R5 — `latest.json` records the budget
// ─────────────────────────────────────────────────────────────────────────────

describe("B71-R5 / latest.json header records the budget", () => {
  it("B71-R5 / perf.test.ts writer emits `config: { warmup, budgetMs, maxRuns, matcherWarmup, matcherBudgetMs }` (no `runs`)", () => {
    // Source-text grep on the writer in perf.test.ts. Today the writer
    // is `config: { warmup: WARMUP, runs: RUNS }`. Post-fix it must
    // contain the five new keys, AND must NOT contain `runs:` inside
    // the `config: { ... }` block.
    const src = readText(join(BENCH_DIR, "perf.test.ts"));
    const stripped = stripComments(src);

    // Find the writer's config block. Anchor on `config:` followed by
    // a `{ ... }` literal up to the closing brace.
    const configMatch = stripped.match(/\bconfig\s*:\s*\{([^}]*)\}/);
    expect(configMatch, "expected a `config: { ... }` block in perf.test.ts").not.toBeNull();
    const body = configMatch![1]!;

    // Five required keys (R5: warmup, budgetMs, maxRuns, matcherWarmup, matcherBudgetMs).
    for (const key of ["warmup", "budgetMs", "maxRuns", "matcherWarmup", "matcherBudgetMs"]) {
      expect(
        new RegExp(`\\b${key}\\s*:`).test(body),
        `config block must contain key \`${key}\``,
      ).toBe(true);
    }

    // The legacy `runs:` key must be gone from the config block.
    expect(/\bruns\s*:/.test(body), "config block must not contain legacy `runs:` key").toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B71-R6 — Cold-start semantics unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe("B71-R6 / coldStart semantics unchanged", () => {
  it("B71-R6 / cold-start is a single pre-warmup call (callCount = 1 + warmup + runs)", () => {
    // Spec scenario: cold-start unchanged — the cold-start step is
    // still a single-call measurement, not a budgeted loop. We assert
    // semantics by call-counting: with warmup=W and a small budget,
    // total fn invocations must be exactly `1 + W + runs` where
    // `runs` is the returned iteration count.
    let callCount = 0;
    const result = measure(
      () => {
        callCount++;
      },
      { warmup: 3, budgetMs: 25 } as Parameters<typeof measure>[1],
    );
    const runs = (result as unknown as { runs?: number }).runs;
    expect(typeof runs).toBe("number");
    expect(callCount, "callCount must equal 1 (cold start) + warmup + runs").toBe(1 + 3 + runs!);
    expect(result.coldStart, "coldStart must be a non-negative number").toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B71-R7 — Perf-baseline stability (reviewer-runs procedure)
// ─────────────────────────────────────────────────────────────────────────────

describe("B71-R7 / perf-baseline stability marker", () => {
  it("B71-R7 / perf.test.ts comments point at the ±5% baseline-stability procedure for B71", () => {
    // R7 is operationally verified by `pnpm site:bench` + the in-memory
    // regression check (the existing `regression vs baseline` describe
    // block in perf.test.ts). The reviewer reads that output; this test
    // pins the contract surface — a B71 reference in the bench source —
    // so a future cleanup can't silently delete the marker that tells
    // the reviewer how to interpret the run.
    //
    // Today the file contains no "B71" reference; post-fix the migration
    // commit either adds a comment near the regression block or
    // references B71 in the writer (since R7's tolerance is enforced by
    // the reviewer running the bench, not by an automated assertion).
    const src = readText(join(BENCH_DIR, "perf.test.ts"));
    expect(
      src,
      "perf.test.ts must reference B71 (the baseline-stability procedure marker)",
    ).toMatch(/B71/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B71-R8 — Browser `/bench` surfaces the budget (UI badge)
// ─────────────────────────────────────────────────────────────────────────────

describe("B71-R8 / /bench UI badge", () => {
  it("B71-R8 / +page.svelte renders a visible 'budget: 200ms per cell' badge near the controls", () => {
    // Spec UI scenario: a visible element containing the literal text
    // `budget: 200ms per cell` is rendered next to the run controls.
    // Source-text grep — the literal must appear in the template
    // (not inside a stripped-out comment).
    const src = readText(join(ROUTES_BENCH, "+page.svelte"));
    const stripped = stripComments(src);
    expect(
      stripped,
      "+page.svelte must render the literal text 'budget: 200ms per cell' (R8 badge)",
    ).toMatch(/budget:\s*200ms\s+per\s+cell/);
  });
});
