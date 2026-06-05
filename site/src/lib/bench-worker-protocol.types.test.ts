/**
 * B69-R7 / R2 — type-level test that `site/src/lib/bench-worker-protocol.ts`
 * exposes the typed protocol surface mandated by the spec:
 *
 *   export type SchemaKey = 'simple' | 'nestedOrder' | 'array';
 *   export interface BenchWorkerRequest {
 *     kind: 'run';
 *     schema: SchemaKey;
 *     n: number;
 *     budgetMs: number;
 *   }
 *   export type BenchLib = 'zod4mock' | 'zodmock' | 'faker';
 *   export type BenchWorkerResponse =
 *     | { kind: 'result'; lib: BenchLib; result: BenchResult }
 *     | { kind: 'error'; lib: BenchLib; message: string }
 *     | { kind: 'done' };
 *
 * Maps to wiki/specs/B69-site-bench-web-worker.md (B69-R2 + B69-R7).
 *
 * Run command: `pnpm site:check` (svelte-check picks up `.ts` files in
 * the SvelteKit project). This file has no runtime describe/it — it's
 * excluded from vitest by `vitest.unit.config.ts`'s
 * `**\/*.types.test.ts` exclude pattern.
 *
 * Red signal (today, no implementation):
 *   - `site/src/lib/bench-worker-protocol.ts` does not exist, so every
 *     import in this file resolves to a "Cannot find module" error.
 *
 * Green signal (after implementation):
 *   - All four protocol names import as types.
 *   - The structural assertions below (the `_*` constants) type-check.
 *   - The `@ts-expect-error` lines are consumed (the protocol rejects
 *     wrong-shape values).
 *   - No `: any` / `<any>` appears in this file (D1).
 */

import type { BenchResult } from "./bench";
import type {
  SchemaKey,
  BenchLib,
  BenchWorkerRequest,
  BenchWorkerResponse,
} from "./bench-worker-protocol";

// ─────────────────────────────────────────────────────────────────────────────
// SchemaKey is exactly the three canonical bench schemas.
// ─────────────────────────────────────────────────────────────────────────────

const _schemaSimple: SchemaKey = "simple";
const _schemaNested: SchemaKey = "nestedOrder";
const _schemaArray: SchemaKey = "array";

// @ts-expect-error — B69-R2: SchemaKey rejects unknown schema keys.
const _schemaBad: SchemaKey = "user";

// ─────────────────────────────────────────────────────────────────────────────
// BenchLib is exactly the three runner identifiers, in the spec's order.
// ─────────────────────────────────────────────────────────────────────────────

const _libZod4: BenchLib = "zod4mock";
const _libZod: BenchLib = "zodmock";
const _libFaker: BenchLib = "faker";

// @ts-expect-error — B69-R2: BenchLib rejects unknown runner identifiers.
const _libBad: BenchLib = "anatine";

// ─────────────────────────────────────────────────────────────────────────────
// BenchWorkerRequest — `kind: 'run'`, all four fields required.
// ─────────────────────────────────────────────────────────────────────────────

const _req: BenchWorkerRequest = {
  kind: "run",
  schema: "simple",
  n: 100,
  budgetMs: 200,
};

const _reqBadKind: BenchWorkerRequest = {
  // @ts-expect-error — B69-R2: `kind` must be the literal `'run'`.
  kind: "stop",
  schema: "simple",
  n: 100,
  budgetMs: 200,
};

// @ts-expect-error — B69-R2: `budgetMs` is required, not optional.
const _reqMissingBudget: BenchWorkerRequest = {
  kind: "run",
  schema: "simple",
  n: 100,
};

// ─────────────────────────────────────────────────────────────────────────────
// BenchWorkerResponse — discriminated union with three arms.
// ─────────────────────────────────────────────────────────────────────────────

const _respResult: BenchWorkerResponse = {
  kind: "result",
  lib: "zod4mock",
  // Structural: result must satisfy BenchResult — six numeric fields
  // (B71-R1). If the protocol forgot to import / re-export BenchResult,
  // this object literal won't type-check.
  result: {
    avg: 1,
    min: 1,
    max: 1,
    opsPerSec: 1,
    coldStart: 1,
    runs: 1,
  } satisfies BenchResult,
};

const _respError: BenchWorkerResponse = {
  kind: "error",
  lib: "zodmock",
  message: "boom",
};

const _respDone: BenchWorkerResponse = { kind: "done" };

// @ts-expect-error — B69-R2: a result message MUST carry both `lib` and `result`.
const _respResultMissing: BenchWorkerResponse = { kind: "result", lib: "zod4mock" };

// @ts-expect-error — B69-R2: a done message MUST NOT carry a `lib` field.
const _respDoneWithLib: BenchWorkerResponse = { kind: "done", lib: "zod4mock" };

// ─────────────────────────────────────────────────────────────────────────────
// Mark all the test artefacts as intentionally used so unused-locals
// checks don't drown out the real signal.
// ─────────────────────────────────────────────────────────────────────────────

void _schemaSimple;
void _schemaNested;
void _schemaArray;
void _schemaBad;
void _libZod4;
void _libZod;
void _libFaker;
void _libBad;
void _req;
void _reqBadKind;
void _reqMissingBudget;
void _respResult;
void _respError;
void _respDone;
void _respResultMissing;
void _respDoneWithLib;
