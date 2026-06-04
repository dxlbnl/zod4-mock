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
import { sampleMemory } from "./memory.ts";
import {
  applyMemoryWriteBack,
  type MemoryBlockFile,
  type VersionsFileShape,
} from "./regression-writeback.ts";

import { generate as gen050 } from "zod4-mock-v050";
import { generate as gen060 } from "zod4-mock-v060";
import { generate as gen070 } from "zod4-mock-v070";
import { generate as gen072 } from "zod4-mock-v072";
import { generate as gen080 } from "zod4-mock-v080";
import { generate as gen090 } from "zod4-mock-v090";
import { generate as gen092 } from "zod4-mock-v092";
import { generate as gen100 } from "zod4-mock";

const WARMUP = 1000;
const RUNS = 5000;

const versions: Array<[string, (s: z.ZodTypeAny) => unknown]> = [
  ["0.5.0", gen050 as (s: z.ZodTypeAny) => unknown],
  ["0.6.0", gen060 as (s: z.ZodTypeAny) => unknown],
  ["0.7.0", gen070 as (s: z.ZodTypeAny) => unknown],
  ["0.7.2", gen072 as (s: z.ZodTypeAny) => unknown],
  ["0.8.0", gen080 as (s: z.ZodTypeAny) => unknown],
  ["0.9.0", gen090 as (s: z.ZodTypeAny) => unknown],
  ["0.9.2", gen092 as (s: z.ZodTypeAny) => unknown],
  ["0.10.0", gen100 as (s: z.ZodTypeAny) => unknown],
];

const simple = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  active: z.boolean(),
});

const user = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  age: z.int().gte(18).lte(100),
  role: z.enum(["admin", "user", "guest"]),
  bio: z.string().optional(),
  score: z.number().min(0).max(1),
});

const address = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
  zip: z.string(),
});

const nested = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  address,
  billingAddress: address.optional(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.string()),
});

interface Row {
  version: string;
  simple: BenchResult;
  user: BenchResult;
  nested: BenchResult;
  memory: MemoryBlockFile;
}

const rows: Row[] = [];

describe("regression bisect", () => {
  for (const [label, fn] of versions) {
    it(label, () => {
      const s = measure(() => fn(simple), { warmup: WARMUP, runs: RUNS });
      const u = measure(() => fn(user), { warmup: WARMUP, runs: RUNS });
      const n = measure(() => fn(nested), { warmup: WARMUP, runs: RUNS });
      const sMem = sampleMemory(() => fn(simple));
      const uMem = sampleMemory(() => fn(user));
      const nMem = sampleMemory(() => fn(nested));
      rows.push({
        version: label,
        simple: s,
        user: u,
        nested: n,
        memory: { simple: sMem, user: uMem, nested: nMem },
      });
      console.log(
        ` ${label.padEnd(8)} simple=${(s.avg * 1000).toFixed(1)}us  user=${(u.avg * 1000).toFixed(1)}us  nested=${(n.avg * 1000).toFixed(1)}us  mem(s/u/n)=${sMem.heapUsedDeltaBytes}/${uMem.heapUsedDeltaBytes}/${nMem.heapUsedDeltaBytes}B`,
      );
    });
  }

  it("summary", () => {
    console.log("\n─── Regression bisect (avg per call) ───");
    console.log("version  simple        user          nested");
    for (const r of rows) {
      const s = `${(r.simple.avg * 1000).toFixed(1)}us`.padEnd(12);
      const u = `${(r.user.avg * 1000).toFixed(1)}us`.padEnd(12);
      const n = `${(r.nested.avg * 1000).toFixed(1)}us`.padEnd(12);
      console.log(`${r.version.padEnd(8)} ${s}  ${u}  ${n}`);
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

  writeFileSync(versionsPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nUPDATE_VERSIONS=1: filled ${filled} row(s), skipped ${skipped} populated row(s).`);
});
