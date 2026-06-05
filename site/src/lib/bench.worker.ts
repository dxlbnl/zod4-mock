/**
 * B69-R1 / R3 / R4 / R7 — bench Web Worker entry.
 *
 * Loaded by `/bench/+page.svelte` via
 *   `new Worker(new URL('$lib/bench.worker.ts', import.meta.url), { type: 'module' })`.
 *
 * The actual handler is the exported `handleBenchRequest`. The bottom of
 * this file wires `self.onmessage` to it in a Worker context; the import
 * graph stays browser-safe (D13 — no `node:*` imports).
 *
 * Spec: wiki/specs/B69-site-bench-web-worker.md
 */

import { measure } from "./bench.js";
import { runZod4Mock } from "./runners/zod4mock.js";
import { runZodMock } from "./runners/zodmock.js";
import { runFaker } from "./runners/faker.js";
import type {
  BenchLib,
  BenchWorkerRequest,
  BenchWorkerResponse,
  SchemaKey,
} from "./bench-worker-protocol.js";

/**
 * The three runner libraries, in the canonical order the chart legend
 * expects (B69-R4). Each entry maps a `BenchLib` identifier to a factory
 * that, given the request, returns a zero-arg call for `measure()`.
 */
const RUNNERS: ReadonlyArray<{
  lib: BenchLib;
  call: (schema: SchemaKey, n: number) => () => void;
}> = [
  { lib: "zod4mock", call: (schema, n) => () => runZod4Mock.batch(schema, n) },
  { lib: "zodmock", call: (schema, n) => () => runZodMock.batch(schema, n) },
  { lib: "faker", call: (schema, n) => () => runFaker.batch(schema, n) },
];

/**
 * Handle one `BenchWorkerRequest` by running `measure()` for each
 * library in canonical order and posting an incremental message per
 * cell, then a final `{ kind: 'done' }`.
 *
 * Exported so unit tests can call it directly with a synchronous fake
 * `post` collector (B69-R7) — no `new Worker(...)` required.
 */
export function handleBenchRequest(
  req: BenchWorkerRequest,
  post: (msg: BenchWorkerResponse) => void,
): void {
  for (const { lib, call } of RUNNERS) {
    try {
      const result = measure(call(req.schema, req.n), { budgetMs: req.budgetMs });
      post({ kind: "result", lib, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      post({ kind: "error", lib, message });
    }
  }
  post({ kind: "done" });
}

// Wire `self.onmessage` only when this module is loaded as a real Worker
// entry — never when a unit test imports it under Node (where `window`
// is undefined but `self` exists as an alias of `globalThis`). The guard
// looks for the dedicated-worker-scope sentinel: a `postMessage` on
// `self` AND the absence of `window` (which Worker scopes don't have,
// but jsdom-style test envs do).
declare const self: {
  onmessage: ((e: MessageEvent<BenchWorkerRequest>) => void) | null;
  postMessage: (msg: BenchWorkerResponse) => void;
} & Record<string, unknown>;

if (
  typeof self !== "undefined" &&
  typeof (self as { postMessage?: unknown }).postMessage === "function" &&
  typeof (globalThis as { window?: unknown }).window === "undefined"
) {
  self.onmessage = (e: MessageEvent<BenchWorkerRequest>) => {
    handleBenchRequest(e.data, (msg) => self.postMessage(msg));
  };
}
