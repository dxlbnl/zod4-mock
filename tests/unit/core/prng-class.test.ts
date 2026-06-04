/**
 * B97-R14 — PRNG is a class with prototype methods.
 *
 * Tests-first RED file. The spec ([B97-R14](../../../wiki/specs/B97-fix-eager-bindgenerators-perf-regression.md))
 * requires `createPrng(seed)` to return a class instance
 * (`new SFC32Prng(seed)`) whose methods live on `SFC32Prng.prototype`
 * rather than as per-instance closure-object properties.
 *
 * Failure modes today (pre-fix):
 *   - `SFC32Prng` is not exported from `src/prng.ts`. The named import
 *     fails (TypeError on module load) — every test goes RED at import time.
 *   - The current `createPrng` (src/prng.ts:77-177) returns a plain object
 *     literal with own `random`/`int`/etc. properties — no prototype
 *     methods. Even with the import resolved, scenarios 1, 2, and 4 would
 *     observe own-property functions, not prototype methods.
 *
 * Byte-identity pinning (scenario 3) captures the CURRENT (pre-fix)
 * `createPrng(1).random()` sequence so the class refactor cannot
 * accidentally alter SFC32 output. The captured constants were obtained
 * via a one-shot probe run against today's `src/prng.ts`.
 */

import { describe, it, expect } from "vitest";
import { createPrng } from "../../../src/prng.js";
import { SFC32Prng } from "../../../src/prng.js";

// ---------------------------------------------------------------------------
// B97-R14 — prototype shape
// ---------------------------------------------------------------------------

describe("B97-R14 / prototype shape", () => {
  it("B97-R14 / Object.getPrototypeOf(createPrng(42)) === SFC32Prng.prototype, no own `random`, typeof random === 'function'", () => {
    const p = createPrng(42);
    expect(Object.getPrototypeOf(p)).toBe(SFC32Prng.prototype);
    expect(Object.prototype.hasOwnProperty.call(p, "random")).toBe(false);
    expect(typeof p.random).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// B97-R14 — instanceof but interface-typed contract
// ---------------------------------------------------------------------------

describe("B97-R14 / instanceof SFC32Prng", () => {
  it("B97-R14 / createPrng(42) instanceof SFC32Prng === true", () => {
    const p = createPrng(42);
    expect(p instanceof SFC32Prng).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B97-R14 — byte-identical output (pinned constants captured pre-fix)
// ---------------------------------------------------------------------------

describe("B97-R14 / byte-identical output across the class refactor", () => {
  it("B97-R14 / createPrng(1).random() x5 matches the pre-fix output table exactly", () => {
    // Captured by a one-shot probe against today's `src/prng.ts` (pre-R14).
    // The class refactor MUST NOT alter the SFC32 state machine — same
    // `seedToSfc32` initialisation, same `sfc32(...)` step, same float
    // conversion. If this assertion flips, the refactor changed the
    // PRNG's observable output and the change is rejected.
    const EXPECTED_SEED1_FIRST_5: ReadonlyArray<number> = [
      0.04669448919594288, 0.9715853179804981, 0.8028125767596066, 0.6854734916705638,
      0.20914834132418036,
    ];

    const p = createPrng(1);
    const observed: number[] = [];
    for (let i = 0; i < 5; i++) observed.push(p.random());

    expect(observed).toEqual(EXPECTED_SEED1_FIRST_5);
  });
});

// ---------------------------------------------------------------------------
// B97-R14 — fork produces another SFC32Prng instance
// ---------------------------------------------------------------------------

describe("B97-R14 / fork returns an SFC32Prng instance", () => {
  it("B97-R14 / createPrng(42).fork('k') instanceof SFC32Prng === true", () => {
    const child = createPrng(42).fork("k");
    expect(child instanceof SFC32Prng).toBe(true);
  });
});
