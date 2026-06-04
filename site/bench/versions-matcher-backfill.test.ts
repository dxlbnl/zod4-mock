/**
 * B97-R10 — historical backfill of `versions.json` with the matcher tier.
 *
 * Tests-first RED file. After the fix, every entry in
 * `site/bench/results/versions.json` MUST carry:
 *   - `avg_us.matcher: number | null`
 *   - `memory.matcher: { heapUsedDeltaBytes, v8HeapUsedBytes, gcForced } | null`
 *
 * Entries with `null` MUST carry a `note` explaining the incompatibility
 * (per the spec's legacy-row pattern). At least one historical entry MUST
 * have a populated matcher block (the implementer determines which
 * versions support the matcher tier API — open question §3 in the spec
 * notes this is hand-checked).
 *
 * Failure mode today (pre-fix): no entry carries any `matcher` field at
 * all — they are all undefined on read, which the assertion rejects.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface MemBlock {
  heapUsedDeltaBytes: number;
  v8HeapUsedBytes: number;
  gcForced: boolean;
}

interface VersionsEntry {
  timestamp: string;
  version: string;
  avg_us: Record<string, number | null | undefined>;
  memory: Record<string, MemBlock | null | undefined> | null;
  note?: string;
}

interface VersionsFile {
  entries: VersionsEntry[];
}

describe("B97-R10 / versions.json carries the matcher tier (historical backfill)", () => {
  const raw = readFileSync(join(__dirname, "results", "versions.json"), "utf-8");
  const file = JSON.parse(raw) as VersionsFile;

  it("B97-R10 / every entry has avg_us.matcher (number | null) and memory.matcher (object | null)", () => {
    expect(file.entries.length).toBeGreaterThan(0);

    for (const entry of file.entries) {
      const avgMatcher = entry.avg_us.matcher;
      const memBlock = entry.memory;
      // NB: read matcher slot WITHOUT collapsing `null` to `undefined` —
      // spec B97-R10 explicitly mandates `memory.matcher: null` for the
      // legacy carveout (incompatible alias). Reading `memBlock?.matcher`
      // preserves `null` distinct from `undefined` (absent key).
      const memMatcher = memBlock === null ? null : memBlock?.matcher;

      const avgOk = avgMatcher === null || typeof avgMatcher === "number";
      expect(
        avgOk,
        `entry ${entry.version}: avg_us.matcher must be number | null, got ${typeof avgMatcher}`,
      ).toBe(true);

      const memOk =
        memMatcher === null ||
        (typeof memMatcher === "object" &&
          memMatcher !== null &&
          typeof memMatcher.heapUsedDeltaBytes === "number");
      expect(memOk, `entry ${entry.version}: memory.matcher must be MemBlock | null`).toBe(true);

      // R10 — null rows MUST carry a note explaining why.
      if (avgMatcher === null) {
        expect(
          typeof entry.note === "string" && entry.note.length > 0,
          `entry ${entry.version}: avg_us.matcher is null but no explanatory note is present`,
        ).toBe(true);
      }
    }
  });

  it("B97-R10 / at least one entry has a populated matcher block (the historical cutoff forward)", () => {
    const populated = file.entries.filter((e) => typeof e.avg_us.matcher === "number");
    expect(
      populated.length,
      "at least one historical entry must have a populated matcher tier (post-backfill); zero means the backfill never ran",
    ).toBeGreaterThan(0);
  });
});
