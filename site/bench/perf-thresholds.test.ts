/**
 * B97-R1 / B97-R7 — perf thresholds.
 *
 * Tests-first RED file. Asserts two perf thresholds the lazy-bind fix must
 * satisfy:
 *
 *   - B97-R1 — simple-tier avg ≤ 25 µs (post-fix ceiling).
 *     Uses `measure()` from `site/src/lib/bench.ts` with the same
 *     warmup/runs as the full bench (warmup=1000, runs=5000) so the test's
 *     JIT-amortised numbers line up with `site/bench/perf.test.ts`'s
 *     measurement (the spec's round-5 17 µs cite is the full-bench number;
 *     reviewer measured 22.7 µs in full-bench context on a different host —
 *     25 µs ceiling gives noise headroom for cross-host CI runs).
 *     Smaller samples under-amortise warmup and over-state per-call cost.
 *
 *   - B97-R7 — matcher tier beats the current 0.10.0 number by ≥ 3×.
 *     The exact pre-fix number is captured by the implementer during the
 *     fix. For RED today, this is split into two stages:
 *       (a) the matcher-tier measurement runs and produces a finite, positive
 *           number (proves the tier was wired through),
 *       (b) a placeholder assertion the implementer rewires once they have
 *           the post-fix baseline number captured in baseline.json.
 *     Stage (b) intentionally fails today — the implementer pins the
 *     threshold by replacing `PRE_FIX_MATCHER_AVG_MS_TODO` with the real
 *     pre-fix number captured during the test-writer/implementer crossover.
 *
 * Bench source for the matcher tier mirrors the spec's pinned shape
 * (see B97-R6) — User+Company schema, matcher set hitting person /
 * internet / location namespaces, with a nested-object matcher on
 * `address` and a relation to Company via `employerId`.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld, generate } from "zod4-mock";
import { measure } from "../src/lib/bench.ts";
import type { MatcherCtx } from "zod4-mock";

// ─── Local matcher-tier schemas (mirror B97-R6 / `perf.test.ts` plan) ────────

const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  industry: z.string(),
});

const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
});

const UserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email(),
  city: z.string(),
  address: AddressSchema,
  employerId: z.string().uuid(),
});

// ─── B97-R1 — simple tier avg ≤ 25 µs ────────────────────────────────────────

describe("B97-R1 / simple tier avg ≤ 25 µs", () => {
  it("B97-R1 / simple tier — measure(() => generate(simple4)) avg ≤ 0.025 ms (25 µs)", () => {
    const simple4 = z.object({
      id: z.string(),
      name: z.string(),
      age: z.number(),
      active: z.boolean(),
    });

    // Match `site/bench/perf.test.ts`'s WARMUP/RUNS (1000/5000) so the
    // test's JIT amortisation lines up with the full-bench measurement —
    // the spec's round-5 17 µs cite is the full-bench number.
    const result = measure(() => generate(simple4), { warmup: 1000, runs: 5000 });

    // Print observed data for diagnostics.
    console.log(`B97-R1 observed: simple avg=${(result.avg * 1000).toFixed(2)}µs (ceiling 25µs)`);

    // Avg in ms — threshold 0.025 ms = 25 µs.
    expect(result.avg).toBeLessThan(0.025);
  });
});

// ─── B97-R7 — matcher tier ≥ 3× faster than pre-fix ──────────────────────────

describe("B97-R7 / matcher tier ≥ 3× faster than pre-fix", () => {
  it("B97-R7 / stage 1 — matcher-tier measurement produces a finite positive avg", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(CompanySchema)
      .withSchema(UserSchema, {
        relations: { employer: { schema: CompanySchema } },
        matchers: {
          fullName: (ctx: MatcherCtx) => ctx.gen.person.fullName(),
          email: (ctx: MatcherCtx) => ctx.gen.internet.email(),
          city: (ctx: MatcherCtx) => ctx.gen.location.city(),
          address: (ctx: MatcherCtx) => ({
            street: ctx.gen.location.street(),
            city: ctx.gen.location.city(),
            country: ctx.gen.location.country(),
          }),
          employerId: (ctx: MatcherCtx<{ employer: typeof CompanySchema }>) =>
            ctx.related("employer").id as string,
        },
      });

    const result = measure(() => world.populate(UserSchema, 100), {
      warmup: 5,
      runs: 50,
    });

    console.log(`B97-R7 observed: matcher populate(100) avg=${result.avg.toFixed(3)}ms`);

    expect(Number.isFinite(result.avg)).toBe(true);
    expect(result.avg).toBeGreaterThan(0);
    expect(Number.isFinite(result.opsPerSec)).toBe(true);
  });

  it("B97-R7 / stage 2 — matcher-tier avg ≤ pre-fix matcher number / 3", () => {
    // Pre-fix matcher tier avg (captured against 0.10.0 / pre-B97 source
    // by running this same test file with `git stash`-ed changes; observed
    // 7.3-7.5 ms across multiple runs on the implementer's host). Pin
    // conservatively at 7.0 ms so flap from cross-host noise doesn't flip
    // this assertion. The post-fix `avg` (lazy holder) is ~2.1 ms on the
    // same host — a 3.5× improvement — well within the 7.0 / 3 ≈ 2.33 ms
    // budget.
    const PRE_FIX_MATCHER_AVG_MS = 7.0;

    const world = createWorld({ seed: 1 })
      .withSchema(CompanySchema)
      .withSchema(UserSchema, {
        relations: { employer: { schema: CompanySchema } },
        matchers: {
          fullName: (ctx: MatcherCtx) => ctx.gen.person.fullName(),
          email: (ctx: MatcherCtx) => ctx.gen.internet.email(),
          city: (ctx: MatcherCtx) => ctx.gen.location.city(),
          address: (ctx: MatcherCtx) => ({
            street: ctx.gen.location.street(),
            city: ctx.gen.location.city(),
            country: ctx.gen.location.country(),
          }),
          employerId: (ctx: MatcherCtx<{ employer: typeof CompanySchema }>) =>
            ctx.related("employer").id as string,
        },
      });

    const result = measure(() => world.populate(UserSchema, 100), {
      warmup: 5,
      runs: 50,
    });

    console.log(
      `B97-R7 stage-2: pre-fix=${PRE_FIX_MATCHER_AVG_MS.toFixed(3)}ms post-fix=${result.avg.toFixed(3)}ms (target ≤ ${(PRE_FIX_MATCHER_AVG_MS / 3).toFixed(3)}ms)`,
    );

    expect(result.avg).toBeLessThanOrEqual(PRE_FIX_MATCHER_AVG_MS / 3);
  });
});
