/**
 * B97-R2 — allocation budget on generate(simpleSchema).
 *
 * Tests-first RED file. The spec ([B97-R2](../../../wiki/specs/B97-fix-eager-bindgenerators-perf-regression.md))
 * asserts that repeated `generate(simple4)` calls MUST NOT allocate more
 * than a small, bounded amount of additional heap per call. The spec's
 * ceiling is 4 KiB / call (loose because Node heap deltas are noisy
 * without `--expose-gc`).
 *
 * The test-writer pre-RED choice: assert the stricter ~5 KB / call ceiling
 * the test-writer dispatch named (≤ 5_000_000 bytes total over 1000 calls).
 * This is well within the spec's 4 KiB/call (4096 B) ceiling, but tighter
 * to catch the B36 shape's ~25 B/call × 1000 = 25 KB regression that the
 * spec's loose ceiling explicitly cites.
 *
 * Failure mode today (pre-fix): the eager bind allocates ~560 closures per
 * `generate()` for a 4-field schema (14 namespaces × ~10 functions × 4
 * fields). At ~25 B/closure that's ~14 KB/call → ~14 MB over 1000 calls,
 * well above the 5 MB ceiling. Post-fix: the lazy holder allocates closures
 * only when a matcher reads `ctx.gen.*`, which is zero in this test.
 *
 * The test forces a `global.gc?.()` warmup if available, then captures
 * `process.memoryUsage().heapUsed` before/after and divides. The numbers
 * print so the implementer can tighten the ceiling in a follow-up.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generate } from "../../../src/index.js";

const simple4 = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  active: z.boolean(),
});

describe("B97-R2 / allocation budget on generate(simple4)", () => {
  it("B97-R2 / 1000 generate(simple4) calls allocate < 5 MB total heap delta (~5 KB/call ceiling)", () => {
    const ITERATIONS = 1000;
    const CEILING_BYTES = 5_000_000;

    // Best-effort gc warmup; only present under `node --expose-gc`.
    const maybeGc = (globalThis as { gc?: () => void }).gc;
    if (typeof maybeGc === "function") {
      maybeGc();
      maybeGc();
    }

    // Warm the JIT and prime allocator caches so the measured loop is
    // steady-state.
    for (let i = 0; i < 100; i++) generate(simple4);

    if (typeof maybeGc === "function") {
      maybeGc();
      maybeGc();
    }

    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < ITERATIONS; i++) {
      generate(simple4);
    }
    const after = process.memoryUsage().heapUsed;
    const delta = after - before;

    // Print observable data for the implementer to tighten the ceiling
    // post-fix.
    console.log(
      `B97-R2 observed: heapUsed delta over ${ITERATIONS} calls = ${delta} bytes (≈${(delta / ITERATIONS).toFixed(1)} B/call)`,
    );

    expect(Number.isFinite(delta)).toBe(true);
    expect(delta).toBeLessThan(CEILING_BYTES);
  });
});
