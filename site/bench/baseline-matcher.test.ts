/**
 * B97-R11 — `baseline.json` refreshed with the matcher tier.
 *
 * Tests-first RED file. After the fix, `site/bench/results/baseline.json`
 * MUST carry:
 *   - `results.matcher.zod4_mock` — a `BenchResult` shape
 *     (`avg`, `min`, `max`, `opsPerSec`, `coldStart`)
 *   - `memory.matcher` — `{ heapUsedDeltaBytes, v8HeapUsedBytes, gcForced }`
 *
 * Failure mode today (pre-fix): `baseline.json` carries only `simple`,
 * `user`, `nested` keys in both blocks. The assertions on the matcher
 * keys fail with "expected defined".
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface BenchResultLike {
  avg: number;
  min: number;
  max: number;
  opsPerSec: number;
  coldStart: number;
}
interface MemBlockLike {
  heapUsedDeltaBytes: number;
  v8HeapUsedBytes: number;
  gcForced: boolean;
}
interface BaselineFile {
  results: Record<string, { zod4_mock?: BenchResultLike } | undefined>;
  memory: Record<string, MemBlockLike | undefined>;
}

describe("B97-R11 / baseline.json carries the matcher tier", () => {
  const raw = readFileSync(join(__dirname, "results", "baseline.json"), "utf-8");
  const baseline = JSON.parse(raw) as BaselineFile;

  it("B97-R11 / results.matcher.zod4_mock has the BenchResult shape", () => {
    const matcher = baseline.results["matcher"];
    expect(matcher, "baseline.json must carry results.matcher (post-B97 refresh)").toBeDefined();
    expect(matcher!.zod4_mock).toBeDefined();
    const r = matcher!.zod4_mock!;
    expect(typeof r.avg).toBe("number");
    expect(typeof r.min).toBe("number");
    expect(typeof r.max).toBe("number");
    expect(typeof r.opsPerSec).toBe("number");
    expect(typeof r.coldStart).toBe("number");
  });

  it("B97-R11 / memory.matcher has the standard MemBlock shape", () => {
    const memMatcher = baseline.memory["matcher"];
    expect(memMatcher, "baseline.json must carry memory.matcher (post-B97 refresh)").toBeDefined();
    expect(typeof memMatcher!.heapUsedDeltaBytes).toBe("number");
    expect(typeof memMatcher!.v8HeapUsedBytes).toBe("number");
    expect(typeof memMatcher!.gcForced).toBe("boolean");
  });
});
