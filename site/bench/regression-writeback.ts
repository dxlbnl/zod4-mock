/**
 * B98-R3 — write-back helpers for `regression.bench.ts`.
 *
 * Extracted into a separate module so the two R3 scenarios
 * (null → populated; populated → skipped with warning) can be
 * tested without running the alias-bisect bench against
 * `node_modules/zod4-mock-v0*`.
 */

import type { MemorySample } from "./memory.ts";

export interface MemoryBlockFile {
  simple: MemorySample;
  user: MemorySample;
  nested: MemorySample;
}

export interface VersionEntryFile {
  timestamp: string;
  version: string;
  avg_us: { simple: number; user: number; nested: number };
  memory: MemoryBlockFile | null;
  note?: string;
}

export interface VersionsFileShape {
  _doc: string;
  config: { warmup: number; runs: number };
  node: string;
  schemas: { simple: string; user: string; nested: string };
  entries: VersionEntryFile[];
}

export interface ApplyResult {
  filled: number;
  skipped: number;
  /** Versions whose row was already populated and was left untouched. */
  skippedVersions: string[];
}

/**
 * Mutate `file.entries` in place, filling `memory: null` rows with measured
 * samples. Populated rows are left untouched and their `version` is recorded
 * in `skippedVersions`. `avg_us` is never modified.
 *
 * Notes are cleaned: the "memory not captured" clause is dropped on filled
 * rows, and the `note` field is removed entirely if cleaning leaves it empty.
 */
export function applyMemoryWriteBack(
  file: VersionsFileShape,
  measured: Map<string, MemoryBlockFile>,
): ApplyResult {
  let filled = 0;
  let skipped = 0;
  const skippedVersions: string[] = [];

  for (const entry of file.entries) {
    const sample = measured.get(entry.version);
    if (!sample) continue;
    if (entry.memory !== null) {
      skipped += 1;
      skippedVersions.push(entry.version);
      continue;
    }
    entry.memory = sample;
    if (typeof entry.note === "string") {
      const cleaned = stripMemoryNotCapturedClause(entry.note);
      if (cleaned.length === 0) {
        delete entry.note;
      } else {
        entry.note = cleaned;
      }
    }
    filled += 1;
  }

  return { filled, skipped, skippedVersions };
}

/**
 * Drop the "memory not captured" clause from a note string.
 *
 * Handles the three shapes observed in the seed file:
 *   - Standalone:  "Backfilled — memory not captured by the original bisect run."
 *   - Trailing:    "... Memory not captured by the original bisect run."
 *   - With prefix: "Partial recovery vs 0.8.0 but still ~6x slower than 0.7.2 baseline. Memory not captured by the original bisect run."
 *
 * Returns the trimmed remainder (may be empty when the entire note was the
 * backfill placeholder).
 */
export function stripMemoryNotCapturedClause(note: string): string {
  if (/^Backfilled\s+[—-]+\s+memory not captured by the original bisect run\.?\s*$/i.test(note)) {
    return "";
  }
  const trimmed = note
    .replace(/\s*Memory not captured by the original bisect run\.?\s*$/i, "")
    .trim();
  return trimmed;
}
