/**
 * B98-R6 — memory sampling helper unit tests.
 *
 * The helper module `./memory.ts` does not exist yet — the implementer creates
 * it. Expected contract:
 *
 *   import { sampleMemory, type MemorySample } from "./memory.ts";
 *
 *   const sample: MemorySample = sampleMemory(() => doWork());
 *
 *   sample.heapUsedDeltaBytes: number   // post-fn − pre-fn process.memoryUsage().heapUsed
 *   sample.v8HeapUsedBytes:    number   // post-fn v8.getHeapStatistics().used_heap_size
 *   sample.gcForced:           boolean  // whether global.gc was callable
 *
 * The helper MUST force a GC pass via `global.gc?.()` before sampling pre/post
 * when available (so `gcForced` reflects the actual runtime capability), and
 * MUST be safe to call when `--expose-gc` is absent (no-op on gc).
 */

import { describe, expect, it } from "vitest";

import { sampleMemory } from "./memory.ts";

describe("B98-R6 / sampleMemory helper", () => {
  it("B98-R6 / returns finite numeric heap deltas", () => {
    const sample = sampleMemory(() => {
      // Touch the heap so the delta is meaningful (but the test doesn't
      // depend on a specific magnitude — just that the numbers are finite).
      const arr: number[] = [];
      for (let i = 0; i < 1000; i++) arr.push(i);
      // Return arr to prevent V8 dead-code-eliminating the allocation.
      return arr.length;
    });

    expect(typeof sample.heapUsedDeltaBytes).toBe("number");
    expect(Number.isFinite(sample.heapUsedDeltaBytes)).toBe(true);
    expect(typeof sample.v8HeapUsedBytes).toBe("number");
    expect(Number.isFinite(sample.v8HeapUsedBytes)).toBe(true);
    expect(sample.v8HeapUsedBytes).toBeGreaterThan(0);
  });

  it("B98-R6 / gcForced reflects whether global.gc is callable", () => {
    const sample = sampleMemory(() => undefined);
    expect(typeof sample.gcForced).toBe("boolean");
    const gcAvailable = typeof (globalThis as { gc?: () => void }).gc === "function";
    expect(sample.gcForced).toBe(gcAvailable);
  });

  it("B98-R6 / invokes the callback exactly once", () => {
    let calls = 0;
    sampleMemory(() => {
      calls += 1;
    });
    expect(calls).toBe(1);
  });
});
