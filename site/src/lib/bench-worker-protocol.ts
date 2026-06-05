/**
 * B69-R2 / R7 — typed message contract between the `/bench` page and the
 * bench Web Worker. The protocol module is the single source of truth for
 * both ends of the wire.
 *
 * See wiki/specs/B69-site-bench-web-worker.md (B69-R2).
 */

import type { BenchResult } from "./bench.js";

export type { BenchResult };

/**
 * The set of canonical bench schemas the worker knows how to run.
 * Matches the segmented-control options in `/bench/+page.svelte`.
 */
export type SchemaKey = "simple" | "nestedOrder" | "array";

/**
 * The runner libraries the worker iterates over, in the order they are
 * reported back. The order is part of the contract — the chart legend
 * depends on it (B69-R4).
 */
export type BenchLib = "zod4mock" | "zodmock" | "faker";

/**
 * Request from the page to the worker. Today there is only one kind
 * (`'run'`); a future abort affordance (B73) would add `{ kind: 'abort' }`.
 */
export interface BenchWorkerRequest {
  kind: "run";
  schema: SchemaKey;
  n: number;
  budgetMs: number;
}

/**
 * Discriminated union of messages the worker posts back. One `result` per
 * library cell, then a single `done` when all libraries have reported.
 * An `error` carries the library identifier so the page can surface a
 * per-cell failure without aborting the whole run.
 */
export type BenchWorkerResponse =
  | { kind: "result"; lib: BenchLib; result: BenchResult }
  | { kind: "error"; lib: BenchLib; message: string }
  | { kind: "done" };
