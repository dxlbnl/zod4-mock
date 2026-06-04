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
  // B97-R9: matcher tier added — `null` is the legacy carveout for
  // historical aliases that can't run the matcher tier API shape.
  matcher?: MemorySample | null;
}

export interface VersionEntryFile {
  timestamp: string;
  version: string;
  avg_us: {
    simple: number;
    user: number;
    nested: number;
    // B97-R9: matcher number (or `null` legacy carveout) added in R10.
    matcher?: number | null;
  };
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

/**
 * B97-R10 — captured matcher-tier measurements per version. `avg_us: null`
 * + `memory: null` represent versions whose API can't run the matcher tier
 * (the registration `try` threw). The accompanying `note` is appended to
 * the entry's existing `note` string when the row is filled.
 */
export interface MatcherSample {
  avg_us: number | null;
  memory: MemorySample | null;
  note?: string;
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
 * B97-R10 — fill `avg_us.matcher` and `memory.matcher` on rows where the
 * matcher tier is currently absent (undefined or null). Already-populated
 * matcher rows are left untouched (append-only invariant extended from
 * B98-R2). `avg_us.{simple,user,nested}` and `memory.{simple,user,nested}`
 * are never modified.
 *
 * When a row's matcher slot is filled with `null` (legacy carveout — the
 * historical alias couldn't run the matcher tier), the row's `note` is
 * appended with the supplied `MatcherSample.note` so the reason is
 * recorded.
 */
export function applyMatcherWriteBack(
  file: VersionsFileShape,
  measured: Map<string, MatcherSample>,
): ApplyResult {
  let filled = 0;
  let skipped = 0;
  const skippedVersions: string[] = [];

  for (const entry of file.entries) {
    const sample = measured.get(entry.version);
    if (!sample) continue;
    const matcherAvgPopulated = typeof entry.avg_us.matcher === "number";
    const matcherMemPopulated = entry.memory !== null && entry.memory.matcher != null;
    if (matcherAvgPopulated || matcherMemPopulated) {
      skipped += 1;
      skippedVersions.push(entry.version);
      continue;
    }
    entry.avg_us.matcher = sample.avg_us;
    if (entry.memory !== null) {
      entry.memory.matcher = sample.memory;
    }
    // Append the carveout note for null rows.
    if (sample.avg_us === null && sample.note) {
      entry.note = entry.note ? `${entry.note} ${sample.note}` : sample.note;
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
