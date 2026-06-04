/**
 * Regression bisect bench: same simple/user/nested schemas measured across
 * multiple published zod4-mock versions installed as npm aliases.
 *
 * Default (read-only) — prints the per-version summary table. `versions.json`
 * is NOT touched.
 *
 * Write-back (opt-in, B98-R3 scenario 3) — when `UPDATE_VERSIONS=1` is set,
 * captured memory samples are written back into
 * `site/bench/results/versions.json` for entries whose `memory` field is
 * currently `null`. Already-populated entries are left untouched and a
 * warning is printed naming each skipped entry. `avg_us` is never modified.
 *
 * Run (read-only):
 *   pnpm --filter=@zod4-mock/site exec vitest --config bench/regression.config.ts --run
 *
 * Run (write-back):
 *   UPDATE_VERSIONS=1 pnpm --filter=@zod4-mock/site exec vitest --config bench/regression.config.ts --run
 */

import { afterAll, describe, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { measure, type BenchResult } from "../src/lib/bench.ts";
import { sampleMemory, type MemorySample } from "./memory.ts";
import {
  applyMatcherWriteBack,
  applyMemoryWriteBack,
  type MatcherSample,
  type MemoryBlockFile,
  type VersionsFileShape,
} from "./regression-writeback.ts";
// B70: canonical schema set — imported from `site/src/lib/schemas/`. The
// canonical names line up with the CLI perf-baseline (`simple` / `user` /
// `nested` plus the matcher-tier `CompanySchema` / `UserSchema`).
import { simple, user, nested } from "../src/lib/schemas/index.ts";
import { CompanySchema, UserSchema } from "../src/lib/schemas/matcher.ts";

import { generate as gen050, createWorld as createWorld050 } from "zod4-mock-v050";
import { generate as gen060, createWorld as createWorld060 } from "zod4-mock-v060";
import { generate as gen070, createWorld as createWorld070 } from "zod4-mock-v070";
import { generate as gen072, createWorld as createWorld072 } from "zod4-mock-v072";
import { generate as gen080, createWorld as createWorld080 } from "zod4-mock-v080";
import { generate as gen090, createWorld as createWorld090 } from "zod4-mock-v090";
import { generate as gen092, createWorld as createWorld092 } from "zod4-mock-v092";
import { generate as gen100, createWorld as createWorld100 } from "zod4-mock";

// B71-R3: time-budget bench measurement — see wiki/specs/B71-site-time-budget-bench.md
const WARMUP = 1000;
const BUDGET_MS = 500;

// B97-R6 matcher tier — uses a lighter warmup/budget since populate(100)
// already runs 100 records per call.
const MATCHER_WARMUP = 10;
const MATCHER_BUDGET_MS = 1000;

// `createWorld` factory shape that's tolerant of pre-/post-version differences.
// We treat the World as `unknown` and trust try/catch at registration / run
// time to surface incompatibilities (B97-R6 portability check).
type GenFn = (s: z.ZodTypeAny) => unknown;
type CreateWorldFn = (opts: { seed: number }) => {
  withSchema: (
    schema: z.ZodTypeAny,
    opts?: unknown,
  ) => {
    withSchema: (schema: z.ZodTypeAny, opts?: unknown) => unknown;
    populate: (schema: z.ZodTypeAny, count: number) => unknown;
  };
};

const versions: Array<[string, GenFn, CreateWorldFn]> = [
  ["0.5.0", gen050 as GenFn, createWorld050 as unknown as CreateWorldFn],
  ["0.6.0", gen060 as GenFn, createWorld060 as unknown as CreateWorldFn],
  ["0.7.0", gen070 as GenFn, createWorld070 as unknown as CreateWorldFn],
  ["0.7.2", gen072 as GenFn, createWorld072 as unknown as CreateWorldFn],
  ["0.8.0", gen080 as GenFn, createWorld080 as unknown as CreateWorldFn],
  ["0.9.0", gen090 as GenFn, createWorld090 as unknown as CreateWorldFn],
  ["0.9.2", gen092 as GenFn, createWorld092 as unknown as CreateWorldFn],
  ["0.10.0", gen100 as GenFn, createWorld100 as unknown as CreateWorldFn],
];

// B70: schemas (`simple`, `user`, `nested`, `CompanySchema`, `UserSchema`)
// imported above from `site/src/lib/schemas/`. The canonical references are
// what `perf.test.ts` registers too, so per-version `createWorld(...)` calls
// derive identical fork keys across the perf gate and the bisect bench.

// Cutoff comment (B97-R6 / open question §3 hand-check):
//   0.5.0 / 0.6.0: `relations?: TRelations` is Record<string, ZodTypeAny> —
//     the `{ schema, where? }` object form is unsupported. Registration
//     throws; the per-version matcher row is recorded as `null` + note.
//   0.7.0+      : RelationEntry supports both bare-schema and the
//     `{ schema, where? }` object form. Matcher tier registers successfully.
const MATCHER_CUTOFF_NOTE =
  "matcher tier unsupported on this alias (the relations `{ schema, where? }` object form arrived in 0.7.0)";

interface Row {
  version: string;
  simple: BenchResult;
  user: BenchResult;
  nested: BenchResult;
  memory: MemoryBlockFile;
  matcher: BenchResult | null;
  matcherMemory: MemorySample | null;
  matcherNote?: string;
}

const rows: Row[] = [];

/**
 * Try to register the matcher-tier schemas + matchers + relations on a fresh
 * world for `createWorldFn`, and time `populate(UserSchema, 100)`. Returns
 * `null` on any error — see B97-R6 portability check.
 */
function tryMatcherTier(createWorldFn: CreateWorldFn): {
  result: BenchResult;
  memory: MemorySample;
} | null {
  try {
    const world = createWorldFn({ seed: 1 })
      .withSchema(CompanySchema)
      .withSchema(UserSchema, {
        relations: { employer: { schema: CompanySchema } },
        matchers: {
          // Typed via the generated MatcherCtx of the per-version module.
          // We accept `unknown` ctx and read namespaces dynamically; the
          // surface (ctx.gen.person.fullName, etc.) is stable across all
          // versions that support matchers.
          fullName: (ctx: { gen: { person: { fullName: () => string } } }) =>
            ctx.gen.person.fullName(),
          email: (ctx: { gen: { internet: { email: () => string } } }) => ctx.gen.internet.email(),
          city: (ctx: { gen: { location: { city: () => string } } }) => ctx.gen.location.city(),
          address: (ctx: {
            gen: {
              location: {
                street: () => string;
                city: () => string;
                country: () => string;
              };
            };
          }) => ({
            street: ctx.gen.location.street(),
            city: ctx.gen.location.city(),
            country: ctx.gen.location.country(),
          }),
          employerId: (ctx: { related: (name: string) => { id: string } }) =>
            ctx.related("employer").id,
        },
      });
    let result!: BenchResult;
    const memSample = sampleMemory(() => {
      result = measure(() => world.populate(UserSchema, 100), {
        warmup: MATCHER_WARMUP,
        budgetMs: MATCHER_BUDGET_MS,
      });
    });
    return { result, memory: memSample };
  } catch {
    return null;
  }
}

describe("regression bisect", () => {
  for (const [label, fn, createWorldFn] of versions) {
    it(label, () => {
      const simpleCall = () => fn(simple);
      const userCall = () => fn(user);
      const nestedCall = () => fn(nested);
      const s = measure(simpleCall, { warmup: WARMUP, budgetMs: BUDGET_MS });
      const u = measure(userCall, { warmup: WARMUP, budgetMs: BUDGET_MS });
      const n = measure(nestedCall, { warmup: WARMUP, budgetMs: BUDGET_MS });
      const sMem = sampleMemory(() => fn(simple));
      const uMem = sampleMemory(() => fn(user));
      const nMem = sampleMemory(() => fn(nested));

      // B97-R6 matcher tier — try/catch portability check.
      const matcherRun = tryMatcherTier(createWorldFn);
      const matcherStr = matcherRun
        ? `matcher=${matcherRun.result.avg.toFixed(2)}ms`
        : `matcher=null`;

      rows.push({
        version: label,
        simple: s,
        user: u,
        nested: n,
        memory: { simple: sMem, user: uMem, nested: nMem },
        matcher: matcherRun?.result ?? null,
        matcherMemory: matcherRun?.memory ?? null,
        ...(matcherRun === null ? { matcherNote: MATCHER_CUTOFF_NOTE } : {}),
      });
      console.log(
        ` ${label.padEnd(8)} simple=${(s.avg * 1000).toFixed(1)}us  user=${(u.avg * 1000).toFixed(1)}us  nested=${(n.avg * 1000).toFixed(1)}us  ${matcherStr}  mem(s/u/n)=${sMem.heapUsedDeltaBytes}/${uMem.heapUsedDeltaBytes}/${nMem.heapUsedDeltaBytes}B`,
      );
    });
  }

  it("summary", () => {
    console.log("\n─── Regression bisect (avg per call) ───");
    console.log("version  simple        user          nested        matcher");
    for (const r of rows) {
      const s = `${(r.simple.avg * 1000).toFixed(1)}us`.padEnd(12);
      const u = `${(r.user.avg * 1000).toFixed(1)}us`.padEnd(12);
      const n = `${(r.nested.avg * 1000).toFixed(1)}us`.padEnd(12);
      const m = r.matcher ? `${r.matcher.avg.toFixed(2)}ms`.padEnd(10) : "null".padEnd(10);
      console.log(`${r.version.padEnd(8)} ${s}  ${u}  ${n}  ${m}`);
    }
  });
});

// ─── Write-back (B98-R3 scenario 3) ──────────────────────────────────────────
//
// When `UPDATE_VERSIONS=1` is set, fill `memory: null` rows with the captured
// samples. Never overwrites populated rows; never touches `avg_us`.

afterAll(() => {
  if (process.env["UPDATE_VERSIONS"] !== "1") return;

  const here = dirname(fileURLToPath(import.meta.url));
  const versionsPath = join(here, "results", "versions.json");
  const raw = readFileSync(versionsPath, "utf-8");
  const file = JSON.parse(raw) as VersionsFileShape;

  const measured = new Map<string, MemoryBlockFile>();
  for (const r of rows) measured.set(r.version, r.memory);

  const { filled, skipped, skippedVersions } = applyMemoryWriteBack(file, measured);
  for (const v of skippedVersions) {
    console.log(`skipping populated row: ${v}`);
  }

  // B97-R10: matcher backfill — only fill rows whose `avg_us.matcher` is
  // currently undefined or null. Existing populated matcher data is frozen
  // (extends B98-R2 append-only invariant to the new column).
  const matcherMeasured = new Map<string, MatcherSample>();
  for (const r of rows) {
    matcherMeasured.set(r.version, {
      avg_us: r.matcher === null ? null : r.matcher.avg * 1000,
      memory: r.matcherMemory,
      ...(r.matcherNote !== undefined ? { note: r.matcherNote } : {}),
    });
  }
  const matcherResult = applyMatcherWriteBack(file, matcherMeasured);
  for (const v of matcherResult.skippedVersions) {
    console.log(`skipping populated matcher row: ${v}`);
  }

  writeFileSync(versionsPath, JSON.stringify(file, null, 2) + "\n");
  console.log(
    `\nUPDATE_VERSIONS=1: filled ${filled} memory row(s), skipped ${skipped} populated row(s); filled ${matcherResult.filled} matcher row(s), skipped ${matcherResult.skipped} populated matcher row(s).`,
  );
});
