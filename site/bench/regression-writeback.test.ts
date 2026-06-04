/**
 * B98-R3 — write-back behaviour tests.
 *
 * Covers the two opt-in (`UPDATE_VERSIONS=1`) scenarios:
 *
 *   1. `memory: null` rows are filled with the captured sample, and the
 *      "memory not captured" clause is stripped from the note (or the note
 *      is removed entirely if it was the standalone placeholder).
 *   2. Rows whose `memory` is already populated are left byte-identical,
 *      and their version is reported in `skippedVersions` so the caller
 *      can print a warning.
 *
 * `avg_us` is never modified by either path; this is verified explicitly.
 *
 * The bench file (`regression.bench.ts`) itself can't be tested without the
 * `zod4-mock-v0*` npm aliases — these tests target the pure helper
 * (`regression-writeback.ts`) instead.
 */

import { describe, expect, it } from "vitest";

import {
  applyMemoryWriteBack,
  stripMemoryNotCapturedClause,
  type MemoryBlockFile,
  type VersionsFileShape,
} from "./regression-writeback.ts";

function sample(seed: number): MemoryBlockFile {
  return {
    simple: { heapUsedDeltaBytes: seed, v8HeapUsedBytes: seed + 1, gcForced: true },
    user: { heapUsedDeltaBytes: seed + 2, v8HeapUsedBytes: seed + 3, gcForced: true },
    nested: { heapUsedDeltaBytes: seed + 4, v8HeapUsedBytes: seed + 5, gcForced: true },
  };
}

function makeFile(): VersionsFileShape {
  return {
    _doc: "fixture",
    config: { warmup: 1000, runs: 5000 },
    node: "v22.22.2",
    schemas: { simple: "S", user: "U", nested: "N" },
    entries: [
      {
        timestamp: "2026-06-04T07:02:54Z",
        version: "0.5.0",
        avg_us: { simple: 9.6, user: 21.0, nested: 48.2 },
        memory: null,
        note: "Backfilled — memory not captured by the original bisect run.",
      },
      {
        timestamp: "2026-06-04T07:02:54Z",
        version: "0.8.0",
        avg_us: { simple: 76.8, user: 154.1, nested: 467.8 },
        memory: null,
        note: "First version with B36 (9717326) — replaced lazy bindGenerators Proxy with eager per-field binding; per-call closure allocations explode. Memory not captured by the original bisect run.",
      },
    ],
  };
}

describe("B98-R3 / applyMemoryWriteBack", () => {
  it("B98-R3 / scenario: null memory is filled with the captured sample", () => {
    const file = makeFile();
    const measured = new Map<string, MemoryBlockFile>([
      ["0.5.0", sample(100)],
      ["0.8.0", sample(200)],
    ]);

    const result = applyMemoryWriteBack(file, measured);

    expect(result.filled).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.skippedVersions).toEqual([]);
    expect(file.entries[0]!.memory).toEqual(sample(100));
    expect(file.entries[1]!.memory).toEqual(sample(200));
  });

  it("B98-R3 / scenario: populated memory is skipped (warning surfaced via skippedVersions)", () => {
    const file = makeFile();
    // Pre-populate 0.5.0 so it should be skipped.
    const frozen = sample(999);
    file.entries[0]!.memory = frozen;
    file.entries[0]!.note = "Already measured.";

    const measured = new Map<string, MemoryBlockFile>([
      ["0.5.0", sample(100)],
      ["0.8.0", sample(200)],
    ]);

    const result = applyMemoryWriteBack(file, measured);

    expect(result.filled).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.skippedVersions).toEqual(["0.5.0"]);
    // 0.5.0 left byte-identical (same object reference, same content).
    expect(file.entries[0]!.memory).toBe(frozen);
    expect(file.entries[0]!.note).toBe("Already measured.");
    // 0.8.0 filled.
    expect(file.entries[1]!.memory).toEqual(sample(200));
  });

  it("B98-R3 / avg_us is never modified", () => {
    const file = makeFile();
    const avgBefore = JSON.parse(JSON.stringify(file.entries.map((e) => e.avg_us))) as unknown;
    const measured = new Map<string, MemoryBlockFile>([
      ["0.5.0", sample(100)],
      ["0.8.0", sample(200)],
    ]);
    applyMemoryWriteBack(file, measured);
    expect(file.entries.map((e) => e.avg_us)).toEqual(avgBefore);
  });

  it("B98-R3 / entry order is preserved", () => {
    const file = makeFile();
    const orderBefore = file.entries.map((e) => e.version);
    const measured = new Map<string, MemoryBlockFile>([
      ["0.5.0", sample(100)],
      ["0.8.0", sample(200)],
    ]);
    applyMemoryWriteBack(file, measured);
    expect(file.entries.map((e) => e.version)).toEqual(orderBefore);
  });

  it("B98-R3 / standalone backfill note is dropped after fill", () => {
    const file = makeFile();
    const measured = new Map<string, MemoryBlockFile>([["0.5.0", sample(100)]]);
    applyMemoryWriteBack(file, measured);
    // The 0.5.0 note was the standalone placeholder — removed entirely.
    expect(file.entries[0]!.note).toBeUndefined();
  });

  it("B98-R3 / note with extra content keeps the extra content after fill", () => {
    const file = makeFile();
    const measured = new Map<string, MemoryBlockFile>([["0.8.0", sample(200)]]);
    applyMemoryWriteBack(file, measured);
    // 0.8.0's note had real content before the "Memory not captured..." sentence.
    expect(file.entries[1]!.note).toBe(
      "First version with B36 (9717326) — replaced lazy bindGenerators Proxy with eager per-field binding; per-call closure allocations explode.",
    );
  });
});

describe("B98-R3 / stripMemoryNotCapturedClause", () => {
  it("drops the standalone backfill placeholder entirely", () => {
    expect(
      stripMemoryNotCapturedClause("Backfilled — memory not captured by the original bisect run."),
    ).toBe("");
  });

  it("keeps real content and drops the trailing clause", () => {
    expect(
      stripMemoryNotCapturedClause(
        "Partial recovery vs 0.8.0 but still ~6x slower than 0.7.2 baseline. Memory not captured by the original bisect run.",
      ),
    ).toBe("Partial recovery vs 0.8.0 but still ~6x slower than 0.7.2 baseline.");
  });

  it("leaves unrelated notes untouched", () => {
    expect(stripMemoryNotCapturedClause("Already measured.")).toBe("Already measured.");
  });
});
