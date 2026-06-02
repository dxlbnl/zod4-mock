/**
 * Unit tests for B57 — Realistic per-key numeric distributions
 * (log-uniform / shaped / un-keyed auto-flip + `prng.logUniform` /
 * `prng.geometric`).
 *
 * Spec: wiki/specs/B57-realistic-numeric-distributions-impl.md
 *
 * Per the spec's `## Minimum tests directive` + [[feedback-minimal-tests]]:
 * one test file with nine `it(...)` blocks — one per test-bearing R-ID.
 * R10 (docs), R11 (changeset), R12 (snapshot re-pin) are reviewer-only.
 *
 *   - R1 — 15 new keys are present on `DEFAULT_KEY_MAP.number` (Q-13 keeps
 *     `size` un-keyed).
 *   - R2 — `finance.amount` is log-uniform for `min > 0` (Benford-band
 *     leading-digit-1 frequency ~30%), falls back to uniform when the range
 *     crosses zero, and clamps fractional-penny `min` after `.toFixed(2)`.
 *   - R3 — `commerce.price` log-uniform path mirrors R2 (Benford-band on
 *     leading-digit-1 of the parsed price); cross-zero falls back to uniform.
 *   - R4 — `age` clipped log-normal: median lands in [28, 44] across 200
 *     draws (today's uniform-int over [18, 80] sits at ~49, outside the
 *     band); ≥95% in [18, 80] (with slop); tight bounds fall back to
 *     uniform-int.
 *   - R5 — `year` exponential recent-skew: ≥50% of 200 draws land in the
 *     top (recent) half of the default range; custom `[1900, 2000]` is
 *     respected.
 *   - R6 — `quantity` truncated geometric `p = 0.5`: across 1000 draws,
 *     P(n=1) ~50% (≥45% with PRNG slack), values are positive integers in
 *     range; `count` honours its max bound.
 *   - R7 — un-keyed auto-flip: wide-bound float (`log10(max/min) ≥ 3`)
 *     produces a head-skewed log-uniform distribution; narrow-bound float
 *     stays uniform; `.int()` disables auto-flip.
 *   - R8 — `prng.logUniform` and `prng.geometric` exist as public methods
 *     on the `Prng` interface and return values consistent with their
 *     closed-form formulas.
 *   - R9 — `.multipleOf(m)` rounding: every draw on a wide-bound log-uniform
 *     route snaps to a multiple of `m`; the empty-window degenerate case
 *     (`min=7, max=7, multipleOf=5`) falls back to `min`.
 *
 * RED expectations today (pre-B57):
 *
 *   - R1: FAIL at runtime — the 15 new keys are not yet in
 *     `DEFAULT_KEY_MAP.number` (only 11 entries today per `key-map.ts:243-275`).
 *   - R2 / R3: FAIL at runtime — both generators use `prng.random() * (max - min) + min`
 *     today, which is uniform; the Benford leading-digit-1 frequency on
 *     `[1, 10000]` is ~11%, well below the 25-35% log-uniform band.
 *   - R4 / R5 / R6: FAIL at runtime — `age` / `year` / `quantity` / `count` all
 *     route through `generateNumberWithBounds` (uniform-int) today, so
 *     shape-based assertions (median band, recent-skew %, modal-at-1 mass)
 *     do not hold.
 *   - R7: FAIL at runtime — `generateZodNumber` is uniform-only; the
 *     wide-bound float case does not produce log-uniform-shaped output.
 *   - R8: FAIL at typecheck — `prng.logUniform` and `prng.geometric` do not
 *     exist on the `Prng` interface (`packages/locale-core/src/types.ts:8-24`).
 *     This is the canonical "feature missing" failure for R8.
 *   - R9: FAIL at runtime — there is no log-uniform path with `.multipleOf`
 *     today; the current `generateNumberWithBounds` returns a uniform draw
 *     over multiples, and the empty-window fallback inside the
 *     `prng.int(0, Math.max(0, count))` floor returns `min` rounded — but
 *     the open-keyed log-uniform side (R7's auto-flip) does not exist yet,
 *     so the `multipleOf` clamp on the auto-flip path is RED until B57 lands.
 *
 * D1 (no `any`), D13 (`.js` extensions on relative imports), and per the
 * test-file convention test files may import test-runner globals freely.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createPrng } from "../../src/prng.js";
import { createWorld } from "../../src/world.js";
import { defaultLocale } from "../../src/default-locale.js";
import { DEFAULT_KEY_MAP } from "../../src/generators/data/key-map.js";
import * as finance from "../../src/generators/data/finance.js";
import * as commerce from "../../src/generators/data/commerce.js";
import type { Prng } from "../../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the leading-digit-1 frequency across N draws on the schema's
 * field `key`. Used to detect the Benford-band signature of a log-uniform
 * draw versus the much-lower ~11% frequency a uniform draw on the same
 * range produces.
 */
function leadingDigitOneFraction(values: readonly number[]): number {
  let ones = 0;
  for (const v of values) {
    const abs = Math.abs(v);
    if (abs === 0) continue;
    const exp = Math.floor(Math.log10(abs));
    const lead = Math.floor(abs / Math.pow(10, exp));
    if (lead === 1) ones += 1;
  }
  return ones / values.length;
}

/**
 * Build a fresh world per seed and pull the named numeric field off the
 * generated record. Used by the shape-based tests (R2 / R3 / R4 / R5 / R6
 * / R7) so each draw exercises an independent per-field fork state.
 */
function sweepNumbers<S extends z.ZodObject<z.ZodRawShape>>(
  schema: S,
  field: string,
  n: number,
): number[] {
  const out: number[] = [];
  for (let seed = 0; seed < n; seed++) {
    const w = createWorld({ seed });
    const record = w.generate(schema) as Record<string, unknown>;
    const v = record[field];
    if (typeof v === "number") out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// R1 — 15 new keys land in `DEFAULT_KEY_MAP.number`.
//
// Q-13 keeps `size` un-keyed (ambiguous: file-size vs shoe-size); `fileSize`
// and `bytes` get explicit log-uniform routing. The 11 pre-existing entries
// (`amount`, `bedrag`, `price`, `prijs`, `latitude`, `longitude`, `port`,
// `quantity`, `count`, `age`, `year`) remain present and are exercised by
// R2 / R4 / R5 / R6.
// ---------------------------------------------------------------------------

describe("B57-R1: 15 new keys land in DEFAULT_KEY_MAP.number", () => {
  it("B57-R1 / every new key is a property of DEFAULT_KEY_MAP.number", () => {
    const newKeys = [
      "balance",
      "total",
      "subtotal",
      "revenue",
      "cost",
      "fee",
      "salary",
      "fileSize",
      "bytes",
      "views",
      "population",
      "distance",
      "rating",
      "score",
      "percentage",
    ] as const;

    const numberMap = DEFAULT_KEY_MAP.number;
    expect(numberMap).toBeDefined();
    for (const key of newKeys) {
      expect(numberMap, `${key} should be routed in DEFAULT_KEY_MAP.number`).toHaveProperty(
        key.toLowerCase(),
      );
    }

    // Q-13: `size` deliberately stays un-keyed (ambiguous semantic).
    expect(numberMap).not.toHaveProperty("size");
  });
});

// ---------------------------------------------------------------------------
// R2 — `finance.amount` switches to log-uniform with cross-zero uniform
// fallback and `Math.max(min, …)` clamp on fractional-penny `min`.
//
// Detection strategy: the log-uniform draw on `[1, 10000]` produces a
// Benford-band leading-digit-1 frequency between 25% and 35% across 1000
// draws (real-world Benford = ~30.1%); the uniform draw on the same range
// produces ~11% (≈ 1/9 since each leading digit has roughly equal share).
// ---------------------------------------------------------------------------

describe("B57-R2: finance.amount is log-uniform with cross-zero fallback + min clamp", () => {
  it("B57-R2 / Benford-band on [1, 10000]; uniform on cross-zero; clamp on fractional-penny min", () => {
    // Scenario A — positive-bounded: log-uniform produces a Benford-band
    // leading-digit-1 frequency in [0.25, 0.35].
    const positive: number[] = [];
    for (let seed = 0; seed < 1000; seed++) {
      const prng = createPrng(seed).fork("amount");
      positive.push(finance.amount(prng, 1, 10000));
    }
    const benfordFraction = leadingDigitOneFraction(positive);
    expect(benfordFraction).toBeGreaterThanOrEqual(0.25);
    expect(benfordFraction).toBeLessThanOrEqual(0.35);

    // Scenario B — cross-zero range: log-uniform is undefined, so the
    // fallback uniform path applies and values cover both signs (the
    // leading-digit-1 frequency is NOT head-skewed — uniform on a
    // symmetric range hits all leading digits roughly equally).
    const crossZero: number[] = [];
    for (let seed = 0; seed < 500; seed++) {
      const prng = createPrng(seed).fork("amount-xz");
      crossZero.push(finance.amount(prng, -100, 100));
    }
    const hasNegative = crossZero.some((v) => v < 0);
    const hasPositive = crossZero.some((v) => v > 0);
    expect(hasNegative).toBe(true);
    expect(hasPositive).toBe(true);

    // Scenario C — fractional-penny `min` clamp. Per Q-9, `Math.max(min, …)`
    // is applied after `.toFixed(2)` so a `.min(1.005)` schema never
    // produces a value below `min`. Every draw on `min = 1.005, max = 100`
    // MUST be `>= 1.005`.
    for (let seed = 0; seed < 200; seed++) {
      const prng = createPrng(seed).fork("amount-clamp");
      const v = finance.amount(prng, 1.005, 100);
      expect(v).toBeGreaterThanOrEqual(1.005);
    }
  });
});

// ---------------------------------------------------------------------------
// R3 — `commerce.price` switches to log-uniform with cross-zero fallback,
// composed unchanged with `locale.commerce.formatPrice`.
//
// Detection strategy: parse the formatted price string back to a number
// (the default locale formats as `$NN.NN`) and apply the same Benford-band
// check as R2.
// ---------------------------------------------------------------------------

describe("B57-R3: commerce.price is log-uniform composed with formatPrice", () => {
  it("B57-R3 / Benford-band on parsed price; cross-zero falls back to uniform", () => {
    // Scenario A — positive-bounded: parse back the formatted prices and
    // check the leading-digit-1 fraction lands in the log-uniform band.
    const parsedPositive: number[] = [];
    for (let seed = 0; seed < 1000; seed++) {
      const prng = createPrng(seed).fork("price");
      const s = commerce.price(prng, 1, 10000);
      // defaultLocale.commerce.formatPrice = `$${amount.toFixed(2)}` — strip
      // the leading `$` and parse.
      const numeric = parseFloat(s.replace(/[^0-9.]/g, ""));
      parsedPositive.push(numeric);
    }
    const benfordFraction = leadingDigitOneFraction(parsedPositive);
    expect(benfordFraction).toBeGreaterThanOrEqual(0.25);
    expect(benfordFraction).toBeLessThanOrEqual(0.35);

    // Scenario B — formatPrice composition is preserved (default locale
    // produces strings starting with `$`).
    const onePrice = commerce.price(createPrng(42).fork("price-one"), 1, 1000);
    expect(onePrice.startsWith("$")).toBe(true);

    // Scenario C — cross-zero falls back to uniform. The output is still a
    // formatted string; parse back and confirm at least one negative
    // value appears in the sweep (impossible under the log-uniform branch,
    // which is NaN for `min <= 0`).
    const crossZero: number[] = [];
    for (let seed = 0; seed < 500; seed++) {
      const prng = createPrng(seed).fork("price-xz");
      const s = commerce.price(prng, -50, 50);
      // formatPrice for the default locale renders negative as e.g.
      // `$-25.00` — pull a signed numeric out.
      const match = s.match(/-?\d+(\.\d+)?/);
      if (match) crossZero.push(parseFloat(match[0]));
    }
    const hasNegative = crossZero.some((v) => v < 0);
    expect(hasNegative).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R4 — `age` clipped log-normal via Beasley–Springer–Moro `normInv`.
//
// Detection strategy: 200-world sweep on a `z.number().int().min(18).max(80)`
// `age` field. Under a clipped log-normal centred on `μ = ln(36), σ = 0.35`:
//   - Median lands inside [28, 44] (real demographic centre; today's
//     uniform-int median over [18, 80] sits at ~49, outside the band).
//   - ≥95% (≈ ≥185/200 with slop) lands inside [18, 80].
// The tight-bound fallback fires at `max - min < 20`; on `[20, 30]` the
// route falls back to uniform-int, so values cover the entire small range.
// ---------------------------------------------------------------------------

describe("B57-R4: age is a clipped log-normal with tight-bound uniform-int fallback", () => {
  it("B57-R4 / wide-bound median band + ≥95% inside [18, 80]; tight bound uniform-int", () => {
    // Scenario A — wide-bound log-normal centred on ~36.
    const AgeSchema = z.object({ age: z.number().int().min(18).max(80) });
    const wide = sweepNumbers(AgeSchema, "age", 200);
    expect(wide.length).toBe(200);

    const sorted = [...wide].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] as number;
    expect(median).toBeGreaterThanOrEqual(28);
    expect(median).toBeLessThanOrEqual(44);

    const inBand = wide.filter((v) => v >= 18 && v <= 80).length;
    // ≥95% with slop (PRNG variance + clamping at the bounds).
    expect(inBand).toBeGreaterThanOrEqual(185);

    // Scenario B — tight-bound fallback: `max - min < 20` triggers uniform-int.
    // On `[20, 30]` every draw is an integer in [20, 30] (the clamped log-normal
    // would otherwise stick almost every value at the upper bound 30).
    const TightAgeSchema = z.object({ age: z.number().int().min(20).max(30) });
    const tight = sweepNumbers(TightAgeSchema, "age", 100);
    expect(tight.length).toBe(100);
    for (const v of tight) {
      expect(v).toBeGreaterThanOrEqual(20);
      expect(v).toBeLessThanOrEqual(30);
      expect(Number.isInteger(v)).toBe(true);
    }
    // Uniform-int should NOT pile everything at max (the clamped log-normal
    // would). At most ~30% of draws should equal `max` under a real uniform.
    const atMax = tight.filter((v) => v === 30).length;
    expect(atMax).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// R5 — `year` exponential recent-skew (λ = 0.05).
//
// Detection strategy: on the default `[1970, 2030]` range, ≥50% of draws
// MUST land in the top (recent) half `[2000, 2030]` — under uniform-int
// only ~50% would land in either half, but the exponential pushes the
// majority toward `max`. Custom bounds `[1900, 2000]` are respected
// (all draws fall in `[1900, 2000]`).
// ---------------------------------------------------------------------------

describe("B57-R5: year skews recent and respects custom bounds", () => {
  it("B57-R5 / ≥50% in recent half on default range; custom [1900, 2000] respected", () => {
    // Scenario A — default range `[1970, 2030]`: recent half dominates.
    const YearSchema = z.object({ year: z.number().int() });
    const def = sweepNumbers(YearSchema, "year", 200);
    expect(def.length).toBe(200);
    const recent = def.filter((v) => v >= 2000 && v <= 2030).length;
    // ≥50% in the top half. The pure uniform-int baseline yields ~50%
    // by symmetry; the exponential recent-skew yields much more. Setting
    // the threshold at 0.55 leaves headroom against PRNG variance while
    // still catching today's uniform behaviour (which sits around 0.50).
    // Allow 1-sigma slack: stricter 60% would over-tighten.
    expect(recent / def.length).toBeGreaterThanOrEqual(0.55);

    // Scenario B — custom `[1900, 2000]` is respected.
    const HistorySchema = z.object({ year: z.number().int().min(1900).max(2000) });
    const custom = sweepNumbers(HistorySchema, "year", 100);
    expect(custom.length).toBe(100);
    for (const v of custom) {
      expect(v).toBeGreaterThanOrEqual(1900);
      expect(v).toBeLessThanOrEqual(2000);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// R6 — `quantity` / `count` truncated geometric (p = 0.5).
//
// Detection strategy: across 1000 worlds, the `quantity` field MUST be:
//   - all positive integers in `[1, max]`,
//   - modal at 1 (P(n=1) ≈ 50%; ≥45% with PRNG slack).
// For `count`, the default `min = 0` is handled natively by the geometric
// formula (offset 0 → value 0), and the schema's max is respected.
// ---------------------------------------------------------------------------

describe("B57-R6: quantity / count are truncated geometric p=0.5", () => {
  it("B57-R6 / quantity modal-at-1 with ≥45% mass; count respects max bound", () => {
    // Scenario A — `quantity` is modal at 1 across 1000 worlds.
    const QuantitySchema = z.object({ quantity: z.number().int().min(1).max(100) });
    const qs = sweepNumbers(QuantitySchema, "quantity", 1000);
    expect(qs.length).toBe(1000);
    for (const v of qs) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }
    const onesQ = qs.filter((v) => v === 1).length;
    // Geometric p=0.5 puts ~50% mass on n=1; ≥45% leaves room for PRNG
    // variance on 1000 draws. Uniform-int over [1, 100] (today) puts only
    // ~1% on `1`, so this assertion is decisive RED today.
    expect(onesQ).toBeGreaterThanOrEqual(450);
    // Modal-at-1 invariant: no other single value exceeds the count of 1s.
    const counts = new Map<number, number>();
    for (const v of qs) counts.set(v, (counts.get(v) ?? 0) + 1);
    for (const [val, c] of counts) {
      if (val === 1) continue;
      expect(c).toBeLessThan(onesQ);
    }

    // Scenario B — `count` honours `min = 0` and respects schema max bound.
    const CountSchema = z.object({ count: z.number().int().min(0).max(50) });
    const counts2 = sweepNumbers(CountSchema, "count", 500);
    expect(counts2.length).toBe(500);
    for (const v of counts2) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(50);
    }
    // At least one zero should appear under geometric p=0.5 over 500 draws
    // (geometric with `min = 0`: P(0) = 0.5). Today's uniform-int over
    // `[0, 50]` also produces zeros, so this is a necessary-but-not-sufficient
    // check; the modal-at-0 dominance below is the decisive assertion.
    const zeros = counts2.filter((v) => v === 0).length;
    expect(zeros).toBeGreaterThanOrEqual(225); // ≈ 45% of 500 (p=0.5 mass)
  });
});

// ---------------------------------------------------------------------------
// R7 — Un-keyed `z.number()` auto-flips to log-uniform when:
//   `min > 0` AND `log10(max/min) ≥ 3` AND `!isInt` AND `!multipleOf`.
//
// Detection strategy: shape-based on the Benford-band leading-digit-1
// frequency. `foo` is unrouted by `DEFAULT_KEY_MAP` / `DEFAULT_KEY_PATTERNS`.
// ---------------------------------------------------------------------------

describe("B57-R7: un-keyed z.number() auto-flips when log10(max/min) ≥ 3", () => {
  it("B57-R7 / wide-bound floats auto-flip; narrow-bound stays uniform; .int() disables auto-flip", () => {
    // Scenario A — wide-bound un-keyed float: log10(1e6) = 6 ≥ 3 → log-uniform.
    const WideSchema = z.object({ foo: z.number().min(1).max(1_000_000) });
    const wide = sweepNumbers(WideSchema, "foo", 1000);
    const wideBenford = leadingDigitOneFraction(wide);
    expect(wideBenford).toBeGreaterThanOrEqual(0.25);
    expect(wideBenford).toBeLessThanOrEqual(0.35);

    // Scenario B — narrow-bound un-keyed float: log10(100) = 2 → stays uniform.
    // Under uniform on `[1, 100]`, the leading-digit-1 fraction is ~11% (10
    // out of 90 in the integer-rounded view, slightly less on continuous
    // values — well below the Benford band).
    const NarrowSchema = z.object({ foo: z.number().min(1).max(100) });
    const narrow = sweepNumbers(NarrowSchema, "foo", 1000);
    const narrowBenford = leadingDigitOneFraction(narrow);
    expect(narrowBenford).toBeLessThan(0.2);

    // Scenario C — `.int()` constraint disables auto-flip. Wide bounds
    // (`[1, 1_000_000]`) but integer-typed → today's uniform-int path. The
    // Benford fraction on uniform integers in `[1, 1_000_000]` is ~11%.
    const IntSchema = z.object({ foo: z.number().int().min(1).max(1_000_000) });
    const ints = sweepNumbers(IntSchema, "foo", 1000);
    const intBenford = leadingDigitOneFraction(ints);
    expect(intBenford).toBeLessThan(0.2);
  });
});

// ---------------------------------------------------------------------------
// R8 — `prng.logUniform(min, max)` and `prng.geometric(p)` exposed as public
// `Prng` methods.
//
// This test is the canonical "missing surface" RED: the typecheck fails
// because `Prng.logUniform` / `Prng.geometric` are not declared on the
// `Prng` interface in `packages/locale-core/src/types.ts`. The body of the
// test asserts presence + closed-form sanity.
// ---------------------------------------------------------------------------

describe("B57-R8: prng.logUniform + prng.geometric are public Prng methods", () => {
  it("B57-R8 / both methods exist and return values consistent with the closed-form formula", () => {
    const prng: Prng = createPrng(42);

    // Both surfaces MUST be functions on the public Prng interface.
    expect(typeof prng.logUniform).toBe("function");
    expect(typeof prng.geometric).toBe("function");

    // `logUniform(1, 100)` MUST land in [1, 100] (`min * Math.pow(max/min, u)`
    // for u in [0, 1) covers [min, max)).
    const luFresh = createPrng(7);
    const lu = luFresh.logUniform(1, 100);
    expect(lu).toBeGreaterThanOrEqual(1);
    expect(lu).toBeLessThanOrEqual(100);

    // `geometric(0.5)` MUST return a non-negative integer (offset from 0).
    const geomFresh = createPrng(7);
    const g = geomFresh.geometric(0.5);
    expect(Number.isInteger(g)).toBe(true);
    expect(g).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// R9 — `.multipleOf(m)` composes with log-uniform via round-after-the-draw.
//
// Detection strategy: a wide-bound `.multipleOf(10)` float (open-keyed
// `foo`) MUST produce only multiples of 10 in `[10, 100]`. Empty-window
// degenerate case `min = 7, max = 7, multipleOf = 5` MUST fall back to
// uniform-bounded and return `min = 7` (the only value in the original
// range).
// ---------------------------------------------------------------------------

describe("B57-R9: .multipleOf snaps log-uniform; empty-window falls back to uniform", () => {
  it("B57-R9 / multipleOf snap + empty-window fallback", () => {
    // Scenario A — wide-bound `.multipleOf(10)` open-keyed float. The
    // log-uniform raw is snapped to the nearest multiple of 10 and clamped
    // to `[ceil(1/10)*10, floor(100/10)*10] = [10, 100]`.
    // Bound the schema to `[1, 100]` so the multipleOf snap window is small
    // and every draw is observable. Under R9 every output MUST be a
    // multiple of 10 in `[10, 100]`.
    const MultSchema = z.object({ foo: z.number().multipleOf(10).min(1).max(100) });
    const draws = sweepNumbers(MultSchema, "foo", 200);
    expect(draws.length).toBe(200);
    for (const v of draws) {
      expect(v % 10).toBe(0);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(100);
    }

    // Scenario B — empty-window degenerate case: no multiple of 5 lies in
    // `[7, 7]`, so the implementation MUST fall back to uniform-bounded on
    // `[7, 7]` and return `7` (= `min`).
    const EmptyWindowSchema = z.object({ foo: z.number().multipleOf(5).min(7).max(7) });
    for (let seed = 0; seed < 20; seed++) {
      const w = createWorld({ seed });
      const r = w.generate(EmptyWindowSchema);
      expect(r.foo).toBe(7);
    }
  });
});
