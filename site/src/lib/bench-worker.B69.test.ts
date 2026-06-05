/**
 * B69 — Move `/bench` to a Web Worker.
 *
 * One test per requirement ID from
 * wiki/specs/B69-site-bench-web-worker.md (R1–R8).
 *
 * R7's type-level surface (the typed protocol exports + no-`any` in the
 * worker/page) lives in `bench-worker-protocol.types.test.ts`, which is
 * picked up by `pnpm site:check` (svelte-check) but excluded from vitest
 * by `vitest.unit.config.ts`'s `**\/*.types.test.ts` exclude pattern.
 *
 * RED CHECK: `pnpm site:test:unit` for the runtime tests in this file,
 * and `pnpm site:check` for the types file. The browser-driven bench
 * (`pnpm site:bench`) is NOT run for RED.
 *
 * Today's failure modes (pre-fix):
 *   - `site/src/lib/bench.worker.ts` does not exist; the dynamic import
 *     in R1 / R3 / R4 / R7 throws "Cannot find module".
 *   - `site/src/lib/bench-worker-protocol.ts` does not exist.
 *   - `/bench` page still imports `measure` from `$lib/bench`, calls
 *     `measure(...)` directly on the main thread, yields with
 *     `setTimeout(r, 0)` between cells, and constructs no `Worker`.
 *   - The page has no `onMount` worker construction and no `onDestroy`
 *     `terminate()`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BenchResult } from "./bench";

const __dirname = dirname(fileURLToPath(import.meta.url));
// site/src/lib/ → site root is two levels up.
const SITE_ROOT = join(__dirname, "..", "..");
const LIB_DIR = join(SITE_ROOT, "src", "lib");
const ROUTES_BENCH = join(SITE_ROOT, "src", "routes", "bench");

function readText(absPath: string): string {
  return readFileSync(absPath, "utf8");
}

/** Strip line and block comments so source-text greps don't false-positive. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// ─────────────────────────────────────────────────────────────────────────────
// B69-R1 — Worker entry module exists and exports `handleBenchRequest`
// ─────────────────────────────────────────────────────────────────────────────

describe("B69-R1 / worker entry module", () => {
  it("B69-R1 / site/src/lib/bench.worker.ts exists, exports handleBenchRequest, and contains no `node:` imports", async () => {
    // Spec scenario: worker entry exists and is module-type compatible.
    // The file must exist at the canonical path. Source-text grep that
    // it contains no `node:*` imports (D13).
    const workerPath = join(LIB_DIR, "bench.worker.ts");
    const src = readText(workerPath);
    const stripped = stripComments(src);

    // R1 / R7: the worker MUST export a `handleBenchRequest` function so
    // a unit test can call it directly with a fake `post` collector.
    expect(stripped, "bench.worker.ts must export `handleBenchRequest`").toMatch(
      /\bexport\s+(?:async\s+)?function\s+handleBenchRequest\b/,
    );

    // R1 / D13: no node:* imports in the worker entry.
    expect(
      /from\s+['"]node:/.test(stripped),
      "bench.worker.ts must not import from any `node:*` module (D13)",
    ).toBe(false);

    // R1 scenario: the worker is a side-effecting entry — it sets
    // `self.onmessage` so a real Worker instance dispatches incoming
    // messages.
    expect(stripped, "bench.worker.ts must wire `self.onmessage`").toMatch(/\bself\.onmessage\s*=/);

    // The handler must be importable from a unit test (R7 scenario).
    // Vite-resolved import of the worker module file from this test
    // file — we don't instantiate `new Worker(...)`; we just import
    // the module and assert the named export is a function.
    const mod = (await import("./bench.worker")) as unknown as {
      handleBenchRequest?: unknown;
    };
    expect(typeof mod.handleBenchRequest, "handleBenchRequest must be a callable export").toBe(
      "function",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B69-R2 — Page delegates to a Worker (no direct measure() call)
// ─────────────────────────────────────────────────────────────────────────────

describe("B69-R2 / page delegates to worker", () => {
  it("B69-R2 / +page.svelte no longer imports `measure` from $lib/bench, no measure( call, uses `new Worker(`", () => {
    // Spec scenarios: page no longer imports `measure`; page no longer
    // calls `measure(`; page constructs a Worker.
    const src = readText(join(ROUTES_BENCH, "+page.svelte"));
    const stripped = stripComments(src);

    // Removed import: `import { measure ... } from '$lib/bench'`. The
    // page MAY still import the `BenchResult` type from `$lib/bench`
    // (the spec explicitly allows that). The grep targets a `measure`
    // identifier inside a named import list from `$lib/bench`.
    expect(
      /import\s*\{[^}]*\bmeasure\b[^}]*\}\s*from\s*['"]\$lib\/bench['"]/.test(stripped),
      "+page.svelte must not import `measure` from `$lib/bench` after the migration",
    ).toBe(false);

    // No call site: no `measure(` token anywhere in the (stripped) script.
    expect(
      /\bmeasure\s*\(/.test(stripped),
      "+page.svelte must not call `measure(` directly — the worker owns the measurement",
    ).toBe(false);

    // The page must construct a Worker (the delegation mechanism).
    expect(stripped, "+page.svelte must construct a Worker").toMatch(/\bnew\s+Worker\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B69-R3 — Handler posts 3 `result` messages in order + 1 `done`
// ─────────────────────────────────────────────────────────────────────────────

describe("B69-R3 / handler emits ordered result + done messages", () => {
  it("B69-R3 / handleBenchRequest emits zod4mock → zodmock → faker `result` then `done`", async () => {
    // Spec scenario: three result messages plus one done.
    // We call the handler directly with a synchronously-collecting fake
    // `post`. The request is small (`budgetMs: 50`, `n: 10`) — enough to
    // produce a real BenchResult for each library, fast enough for a
    // unit test.
    const mod = (await import("./bench.worker")) as unknown as {
      handleBenchRequest?: (
        req: { kind: "run"; schema: "simple"; n: number; budgetMs: number },
        post: (msg: unknown) => void,
      ) => Promise<void> | void;
    };
    expect(typeof mod.handleBenchRequest).toBe("function");

    interface CollectedMessage {
      kind: string;
      lib?: string;
      result?: BenchResult;
    }
    const messages: CollectedMessage[] = [];
    const post = (msg: unknown) => {
      messages.push(msg as CollectedMessage);
    };

    await mod.handleBenchRequest!({ kind: "run", schema: "simple", n: 10, budgetMs: 50 }, post);

    // Exactly four messages.
    expect(messages.length, "expected 4 messages (3 result + 1 done)").toBe(4);

    // First three are `result` in order: zod4mock, zodmock, faker.
    expect(messages[0]?.kind).toBe("result");
    expect(messages[0]?.lib).toBe("zod4mock");
    expect(messages[1]?.kind).toBe("result");
    expect(messages[1]?.lib).toBe("zodmock");
    expect(messages[2]?.kind).toBe("result");
    expect(messages[2]?.lib).toBe("faker");

    // Fourth is `done`.
    expect(messages[3]?.kind).toBe("done");

    // Each `result` payload carries the six numeric fields B71-R1 mandates.
    for (let i = 0; i < 3; i++) {
      const r = messages[i]?.result;
      expect(r, `message ${i} must carry a BenchResult`).toBeDefined();
      for (const key of ["avg", "min", "max", "opsPerSec", "coldStart", "runs"] as const) {
        const v = (r as unknown as Record<string, unknown>)[key];
        expect(typeof v, `result[${i}].${key} must be a number`).toBe("number");
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B69-R4 — Page no longer yields with `setTimeout(r, 0)` between cells
// ─────────────────────────────────────────────────────────────────────────────

describe("B69-R4 / page no longer yields with setTimeout(0)", () => {
  it("B69-R4 / +page.svelte contains no `setTimeout(r, 0)` (or `setTimeout(r,0)`) — the per-cell yields are obsolete", () => {
    // Spec scenario: page no longer yields with `setTimeout(0)`.
    const src = readText(join(ROUTES_BENCH, "+page.svelte"));
    const stripped = stripComments(src);

    // Match `setTimeout(r, 0)` with optional whitespace variations.
    expect(
      /\bsetTimeout\s*\(\s*r\s*,\s*0\s*\)/.test(stripped),
      "+page.svelte must not yield with `setTimeout(r, 0)` between cells — the worker owns the loop",
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B69-R5 — Run button retains `disabled={running}`
// ─────────────────────────────────────────────────────────────────────────────

describe("B69-R5 / Run button disabled while running", () => {
  it("B69-R5 / +page.svelte's Run button keeps `disabled={running}` after the migration", () => {
    // Spec scenario: Run button disabled while running. The
    // re-run-policy R6 cites the existing `disabled={running}` binding
    // as the surfacing mechanism — the migration must preserve it.
    const src = readText(join(ROUTES_BENCH, "+page.svelte"));
    const stripped = stripComments(src);

    expect(stripped, "+page.svelte must keep `disabled={running}` on the Run button").toMatch(
      /\bdisabled\s*=\s*\{\s*running\s*\}/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B69-R6 — Worker created in `onMount`, terminated in `onDestroy`
// ─────────────────────────────────────────────────────────────────────────────

describe("B69-R6 / worker lifecycle", () => {
  it("B69-R6 / +page.svelte constructs the Worker in `onMount` and calls `terminate()` in `onDestroy`", () => {
    // Spec scenario: worker terminated on unmount. Combined with R8's
    // "no top-level `new Worker(`" — we read the script block and check
    // (a) `onDestroy` is imported from svelte and (b) `terminate()` is
    // called in the script (the only place that makes sense is the
    // `onDestroy` callback the spec describes).
    const src = readText(join(ROUTES_BENCH, "+page.svelte"));
    const stripped = stripComments(src);

    // `onDestroy` must be imported from svelte alongside `onMount`.
    expect(
      stripped,
      "+page.svelte must import `onDestroy` from 'svelte' for worker cleanup",
    ).toMatch(/import\s*\{[^}]*\bonDestroy\b[^}]*\}\s*from\s*['"]svelte['"]/);

    // The script must call `.terminate()` somewhere (on the worker
    // reference, inside the `onDestroy` handler).
    expect(stripped, "+page.svelte must call `.terminate()` on the worker").toMatch(
      /\.terminate\s*\(/,
    );

    // Sanity: `onDestroy(` is actually wired (not just imported and
    // dead-code-eliminated).
    expect(stripped, "+page.svelte must invoke `onDestroy(...)`").toMatch(/\bonDestroy\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B69-R7 — Typed protocol module exists with the named exports
// ─────────────────────────────────────────────────────────────────────────────

describe("B69-R7 / typed protocol module", () => {
  it("B69-R7 / site/src/lib/bench-worker-protocol.ts exports SchemaKey, BenchLib, BenchWorkerRequest, BenchWorkerResponse and uses no `any`", () => {
    // Spec scenario: protocol module exports the named types. Source-text
    // grep that all four type names appear as `export type` (or `export
    // interface` for the request shape, per the spec snippet). The
    // type-level test in `bench-worker-protocol.types.test.ts` covers
    // the structural assertions; this runtime test just pins the file's
    // existence and the surface.
    const protoPath = join(LIB_DIR, "bench-worker-protocol.ts");
    const src = readText(protoPath);
    const stripped = stripComments(src);

    expect(stripped, "protocol module must `export type SchemaKey`").toMatch(
      /\bexport\s+type\s+SchemaKey\b/,
    );
    expect(stripped, "protocol module must `export type BenchLib`").toMatch(
      /\bexport\s+type\s+BenchLib\b/,
    );
    // Per the spec snippet, BenchWorkerRequest is an interface and
    // BenchWorkerResponse is a (discriminated) type. Accept either
    // `interface` or `type` to keep the test focused on the contract,
    // not the syntactic form.
    expect(stripped, "protocol module must export `BenchWorkerRequest`").toMatch(
      /\bexport\s+(?:interface|type)\s+BenchWorkerRequest\b/,
    );
    expect(stripped, "protocol module must export `BenchWorkerResponse`").toMatch(
      /\bexport\s+(?:interface|type)\s+BenchWorkerResponse\b/,
    );

    // D1 / R2: no `any` in a type position in the protocol module.
    expect(/:\s*any\b|<any>/.test(stripped), "protocol module must not use `any` (D1)").toBe(false);

    // R2 spec also requires the page/worker handling code path has no
    // `any`. Check the worker file too — the page is harder to
    // tokenise reliably from this test (Svelte template syntax), so the
    // types file pins the page-side typing via the BenchWorkerResponse
    // import.
    const workerSrc = readText(join(LIB_DIR, "bench.worker.ts"));
    const workerStripped = stripComments(workerSrc);
    expect(
      /:\s*any\b|<any>/.test(workerStripped),
      "bench.worker.ts must not use `any` (D1 / R2)",
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B69-R8 — SSR-safe worker construction (no top-level `new Worker(`)
// ─────────────────────────────────────────────────────────────────────────────

describe("B69-R8 / SSR-safe worker construction", () => {
  it("B69-R8 / +page.svelte constructs the Worker inside `onMount(` (or `if (browser)`), never at module load", () => {
    // Spec scenario: no top-level `new Worker(` in the page. We isolate
    // the <script> block, then assert that every `new Worker(` token
    // appears AFTER an `onMount(` token (or an `if (browser)` guard).
    // The simplest robust check: take the script body up to the first
    // `new Worker(` — that prefix MUST contain `onMount(` (or
    // `if (browser)`).
    const src = readText(join(ROUTES_BENCH, "+page.svelte"));

    // Extract the first <script ...>...</script> block — that's where
    // the lang="ts" module code lives.
    const scriptMatch = src.match(/<script\b[^>]*>([\s\S]*?)<\/script>/);
    expect(scriptMatch, "+page.svelte must have a <script> block").not.toBeNull();
    const script = stripComments(scriptMatch![1]!);

    // There must be at least one `new Worker(` for R2 to be satisfied;
    // this test scopes its R8 assertion to that case.
    const newWorkerIdx = script.search(/\bnew\s+Worker\s*\(/);
    expect(
      newWorkerIdx,
      "+page.svelte must construct a Worker (also enforced by R2); R8 then constrains where",
    ).toBeGreaterThanOrEqual(0);

    // Everything up to the first `new Worker(` is the "prefix" — for
    // SSR safety, the construction must be inside an `onMount(` callback
    // or guarded by `if (browser)`. Both forms place an `onMount(` or
    // `if (browser)` token in the prefix.
    const prefix = script.slice(0, newWorkerIdx);
    const insideOnMount = /\bonMount\s*\(/.test(prefix);
    const insideBrowserGuard = /\bif\s*\(\s*browser\s*\)/.test(prefix);
    expect(
      insideOnMount || insideBrowserGuard,
      "+page.svelte's `new Worker(` MUST appear inside `onMount(` or behind `if (browser)` — SSR safety (R8 / D22 principle)",
    ).toBe(true);
  });
});
