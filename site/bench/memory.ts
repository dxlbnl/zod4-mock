/**
 * B98-R6 — memory sampling helper.
 *
 * Reads `process.memoryUsage().heapUsed` before and after a callback, forces
 * a GC pass when Node is started with `--expose-gc`, and reports the post-
 * loop `v8.getHeapStatistics().used_heap_size`.
 *
 * Lives in site/bench/* — dev-only. `node:*` imports are fine here (D13
 * only constrains shipped library code).
 */

import { getHeapStatistics } from "node:v8";

export interface MemorySample {
  heapUsedDeltaBytes: number;
  v8HeapUsedBytes: number;
  gcForced: boolean;
}

interface GlobalWithGc {
  gc?: () => void;
}

export function sampleMemory(fn: () => unknown): MemorySample {
  const g = globalThis as GlobalWithGc;
  const gcForced = typeof g.gc === "function";

  if (gcForced) g.gc!();

  const pre = process.memoryUsage().heapUsed;
  fn();
  const post = process.memoryUsage().heapUsed;
  const v8HeapUsedBytes = getHeapStatistics().used_heap_size;

  return {
    heapUsedDeltaBytes: post - pre,
    v8HeapUsedBytes,
    gcForced,
  };
}
