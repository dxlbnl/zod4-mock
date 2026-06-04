/**
 * CLI performance benchmark: faker vs @anatine/zod-mock (zod3) vs zod4-mock (zod4)
 *
 * Run:  pnpm bench
 * Results are written to bench/results/latest.json and appended to bench/results/history.json
 */

import { afterAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { faker } from "@faker-js/faker";
import { generateMock } from "@anatine/zod-mock";
import { createWorld, generate, type MatcherCtx } from "zod4-mock";
import { nl } from "@zod4-mock/locale-nl";
import { en } from "@zod4-mock/locale-en";
import { measure, type BenchResult } from "../src/lib/bench.ts";
import { sampleMemory, type MemorySample } from "./memory.ts";
import { compareToBaseline, type RunLike } from "./regression-compare.ts";
// B70: canonical schema set — imported from `site/src/lib/schemas/`.
// Aliased to the historical inline names (`simple4` / `user4` / `nested4`)
// so the rest of this file keeps reading the same way.
import { simple as simple4, simple3 } from "../src/lib/schemas/simple";
import { user as user4, user3 } from "../src/lib/schemas/user";
import { nested as nested4, nested3 } from "../src/lib/schemas/nested";
import { CompanySchema, UserSchema } from "../src/lib/schemas/matcher";

// ─── Config ───────────────────────────────────────────────────────────────────

const WARMUP = 1000;
const RUNS = 5000;

// ─── Schema tier 1: Simple ────────────────────────────────────────────────────

function fakerSimple() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    age: faker.number.int({ min: 0, max: 120 }),
    active: faker.datatype.boolean(),
  };
}

// ─── Schema tier 2: User (realistic fields) ───────────────────────────────────

function fakerUser() {
  return {
    id: faker.string.uuid(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    age: faker.number.int({ min: 18, max: 100 }),
    role: faker.helpers.arrayElement(["admin", "user", "guest"] as const),
    bio: faker.helpers.maybe(() => faker.lorem.sentence()),
    score: faker.number.float({ min: 0, max: 1 }),
  };
}

// ─── Schema tier 3: Nested ────────────────────────────────────────────────────

function fakerNested() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    address: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      country: faker.location.country(),
      zip: faker.location.zipCode(),
    },
    billingAddress: faker.helpers.maybe(() => ({
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      country: faker.location.country(),
      zip: faker.location.zipCode(),
    })),
    tags: faker.helpers.multiple(() => faker.lorem.word(), {
      count: { min: 1, max: 5 },
    }),
    metadata: Object.fromEntries(
      faker.helpers.multiple(() => [faker.lorem.word(), faker.lorem.word()], {
        count: 3,
      }),
    ),
  };
}

// ─── Schema tier 4: Matcher (B97-R6, zod4-mock-only) ─────────────────────────
//
// The matcher tier is zod4-mock-specific (the matcher / relations registration
// shape is a zod4-mock API surface — faker / @anatine/zod-mock don't have a
// comparable concept). Schemas (CompanySchema / UserSchema / AddressSchema)
// are constructed at module scope per D10 in `site/src/lib/schemas/matcher.ts`
// so reference identity is stable across worlds.

// ─── Results collection ───────────────────────────────────────────────────────

type TierResults = {
  faker: BenchResult;
  zod3_mock: BenchResult;
  zod4_mock: BenchResult;
};

const results: Record<string, TierResults> = {};

// Matcher tier is zod4-mock-only — split into its own narrower shape (no
// faker / zod3_mock column). B97-R6 / B98-R5 gate zod4_mock alone on this
// tier per spec ("faker / zod3_mock columns on the matcher tier ... are
// NOT gated").
const matcherResults: { zod4_mock: BenchResult | null } = { zod4_mock: null };

// ─── Memory collection (B98-R6) ───────────────────────────────────────────────

const memory: Record<"simple" | "user" | "nested" | "matcher", MemorySample> = {
  simple: { heapUsedDeltaBytes: 0, v8HeapUsedBytes: 0, gcForced: false },
  user: { heapUsedDeltaBytes: 0, v8HeapUsedBytes: 0, gcForced: false },
  nested: { heapUsedDeltaBytes: 0, v8HeapUsedBytes: 0, gcForced: false },
  matcher: { heapUsedDeltaBytes: 0, v8HeapUsedBytes: 0, gcForced: false },
};

// ─── Benchmarks ───────────────────────────────────────────────────────────────

describe("simple schema", () => {
  it("faker direct", () => {
    results.simple = { ...results.simple } as TierResults;
    results.simple.faker = measure(fakerSimple, { warmup: WARMUP, runs: RUNS });
    console.log(` faker simple       ${fmt(results.simple.faker)}`);
  });

  it("@anatine/zod-mock (zod3)", () => {
    results.simple.zod3_mock = measure(() => generateMock(simple3), {
      warmup: WARMUP,
      runs: RUNS,
    });
    console.log(` zod3-mock simple   ${fmt(results.simple.zod3_mock)}`);
  });

  it("zod4-mock (zod4)", () => {
    memory.simple = sampleMemory(() => {
      results.simple.zod4_mock = measure(() => generate(simple4), {
        warmup: WARMUP,
        runs: RUNS,
      });
    });
    console.log(` zod4-mock simple   ${fmt(results.simple.zod4_mock)}`);
  });
});

describe("user schema", () => {
  it("faker direct", () => {
    results.user = {} as TierResults;
    results.user.faker = measure(fakerUser, { warmup: WARMUP, runs: RUNS });
    console.log(` faker user         ${fmt(results.user.faker)}`);
  });

  it("@anatine/zod-mock (zod3)", () => {
    results.user.zod3_mock = measure(() => generateMock(user3), {
      warmup: WARMUP,
      runs: RUNS,
    });
    console.log(` zod3-mock user     ${fmt(results.user.zod3_mock)}`);
  });

  it("zod4-mock (zod4)", () => {
    memory.user = sampleMemory(() => {
      results.user.zod4_mock = measure(() => generate(user4), {
        warmup: WARMUP,
        runs: RUNS,
      });
    });
    console.log(` zod4-mock user     ${fmt(results.user.zod4_mock)}`);
  });
});

describe("nested schema", () => {
  it("faker direct", () => {
    results.nested = {} as TierResults;
    results.nested.faker = measure(fakerNested, { warmup: WARMUP, runs: RUNS });
    console.log(` faker nested       ${fmt(results.nested.faker)}`);
  });

  it("@anatine/zod-mock (zod3)", () => {
    results.nested.zod3_mock = measure(() => generateMock(nested3), {
      warmup: WARMUP,
      runs: RUNS,
    });
    console.log(` zod3-mock nested   ${fmt(results.nested.zod3_mock)}`);
  });

  it("zod4-mock (zod4)", () => {
    memory.nested = sampleMemory(() => {
      results.nested.zod4_mock = measure(() => generate(nested4), {
        warmup: WARMUP,
        runs: RUNS,
      });
    });
    console.log(` zod4-mock nested   ${fmt(results.nested.zod4_mock)}`);
  });
});

// ─── Schema tier 4: Matcher (zod4-mock only) ─────────────────────────────────
//
// B97-R6: the matcher tier reports `populate(UserSchema, 100)` (recommended
// over `generate(UserSchema)` because populate amplifies per-call closure
// rebuild cost on the larger sample — see spec §B97-R6 measurement note).

describe("matcher schema", () => {
  it("zod4-mock (zod4)", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(CompanySchema)
      .withSchema(UserSchema, {
        relations: { employer: { schema: CompanySchema } },
        matchers: {
          fullName: (ctx: MatcherCtx) => ctx.gen.person.fullName(),
          email: (ctx: MatcherCtx) => ctx.gen.internet.email(),
          city: (ctx: MatcherCtx) => ctx.gen.location.city(),
          address: (ctx: MatcherCtx) => ({
            street: ctx.gen.location.street(),
            city: ctx.gen.location.city(),
            country: ctx.gen.location.country(),
          }),
          employerId: (ctx: MatcherCtx<{ employer: typeof CompanySchema }>) =>
            ctx.related("employer").id as string,
        },
      });

    // Matcher tier uses lighter warmup/runs because each call generates
    // 100 records (vs 1 for the other three tiers) — keeps the bench's
    // wall-clock budget bounded.
    memory.matcher = sampleMemory(() => {
      matcherResults.zod4_mock = measure(() => world.populate(UserSchema, 100), {
        warmup: 10,
        runs: 100,
      });
    });
    console.log(` zod4-mock matcher  ${fmt(matcherResults.zod4_mock!)}`);
  });
});

// ─── Locale variants (zod4-mock, user schema) ─────────────────────────────────

const localeResults: Record<string, BenchResult> = {};

describe("locale (zod4-mock, user schema)", () => {
  it("default locale", () => {
    localeResults.default = measure(() => generate(user4), {
      warmup: WARMUP,
      runs: RUNS,
    });
    console.log(` zod4-mock default  ${fmt(localeResults.default)}`);
  });

  it("en locale", () => {
    localeResults.en = measure(() => generate(user4, { locale: en }), {
      warmup: WARMUP,
      runs: RUNS,
    });
    console.log(` zod4-mock en       ${fmt(localeResults.en)}`);
  });

  it("nl locale", () => {
    localeResults.nl = measure(() => generate(user4, { locale: nl }), {
      warmup: WARMUP,
      runs: RUNS,
    });
    console.log(` zod4-mock nl       ${fmt(localeResults.nl)}`);
  });
});

// ─── Write results ────────────────────────────────────────────────────────────

afterAll(() => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "results");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const entry = {
    timestamp: new Date().toISOString(),
    node: process.version,
    versions: pkgVersions(),
    config: { warmup: WARMUP, runs: RUNS },
    results: buildResultsWithMatcher(),
    localeResults,
    memory,
  };

  writeFileSync(join(dir, "latest.json"), JSON.stringify(entry, null, 2));

  const historyPath = join(dir, "history.json");
  const history: unknown[] = existsSync(historyPath)
    ? (JSON.parse(readFileSync(historyPath, "utf-8")) as unknown[])
    : [];
  history.push(entry);
  writeFileSync(historyPath, JSON.stringify(history, null, 2));

  const v = entry.versions;
  console.log("\n─── Versions ───────────────────────────────────────");
  console.log(` node                 ${entry.node}`);
  console.log(` @faker-js/faker      ${v.faker}`);
  console.log(` @anatine/zod-mock    ${v["@anatine/zod-mock"]}  (zod3 ${v.zod3})`);
  console.log(` zod4-mock            ${v["zod4-mock"]}  (zod4 ${v.zod4})`);
  console.log(` config               warmup=${WARMUP}  runs=${RUNS}`);
  console.log("\n─── Results written ────────────────────────────────");
  console.log(` bench/results/latest.json`);
  console.log(` bench/results/history.json  (${history.length} total runs)`);
  printSummaryTable(results, localeResults);
});

// ─── Regression vs baseline (B98-R5 / B98-R7) ────────────────────────────────
//
// Runs AFTER the measurement blocks above so `results` + `memory` are populated.
// Reads bench/results/baseline.json and compares the in-memory run against it.
// FAIL verdict ⇒ test fails ⇒ `pnpm bench` exits non-zero.

describe("regression vs baseline", () => {
  it("zod4_mock does not regress past per-tier thresholds", () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), "results");
    const baselinePath = join(dir, "baseline.json");
    if (!existsSync(baselinePath)) {
      console.log(
        " (no baseline.json — skipping regression check; see site/bench/baseline.md for the jq-based refresh step)",
      );
      return;
    }
    const baseline = JSON.parse(readFileSync(baselinePath, "utf-8")) as RunLike;
    const latest: RunLike = {
      results: buildResultsWithMatcher() as RunLike["results"],
      memory: memory as RunLike["memory"],
    };
    const report = compareToBaseline(baseline, latest, {
      timeWarnPct: 10,
      timeFailPct: 25,
      memWarnPct: 25,
      memFailPct: 50,
    });
    console.log("\n─── Regression vs baseline ──────────────────────────");
    console.log(report.table);
    console.log(` verdict: ${report.verdict}`);
    expect(report.verdict).not.toBe("FAIL");
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(r: BenchResult): string {
  return `avg=${r.avg.toFixed(3)}ms  min=${r.min.toFixed(3)}ms  ops/s=${Math.round(r.opsPerSec).toLocaleString()}`;
}

// B97-R6: append the matcher tier (zod4-mock-only — no faker / zod3_mock
// columns) onto the three-tier `results` map for `latest.json` and the
// in-memory regression-vs-baseline comparison.
function buildResultsWithMatcher(): Record<string, unknown> {
  const out: Record<string, unknown> = { ...results };
  if (matcherResults.zod4_mock !== null) {
    out.matcher = { zod4_mock: matcherResults.zod4_mock };
  }
  return out;
}

function pkgVersions() {
  function ver(name: string): string {
    try {
      const p = JSON.parse(
        readFileSync(
          join(dirname(fileURLToPath(import.meta.url)), `../node_modules/${name}/package.json`),
          "utf-8",
        ),
      ) as { version: string };
      return p.version;
    } catch {
      return "unknown";
    }
  }
  return {
    faker: ver("@faker-js/faker"),
    "@anatine/zod-mock": ver("@anatine/zod-mock"),
    "zod4-mock": ver("zod4-mock"),
    zod3: ver("zod3"),
    zod4: ver("zod"),
  };
}

function printSummaryTable(res: Record<string, TierResults>, locales: Record<string, BenchResult>) {
  const labelCol = 14;
  const col = 18;
  const pad = (s: string) => s.padEnd(col);
  const rule = "─".repeat(labelCol + 1 + col * 3 + 2);

  console.log("\n─── Summary (avg ms per call) ──────────────────────");
  console.log(
    `${"Schema".padEnd(labelCol)} ${"faker".padEnd(col)} ${"zod3-mock".padEnd(col)} ${"zod4-mock".padEnd(col)}`,
  );
  console.log(rule);

  for (const [schema, tier] of Object.entries(res)) {
    if (!tier?.faker || !tier?.zod3_mock || !tier?.zod4_mock) continue;
    const f = tier.faker.avg.toFixed(3) + "ms";
    const z3 = tier.zod3_mock.avg.toFixed(3) + "ms";
    const z4 = tier.zod4_mock.avg.toFixed(3) + "ms";
    console.log(`${schema.padEnd(labelCol)} ${pad(f)} ${pad(z3)} ${pad(z4)}`);
  }

  // Locale variants are zod4-mock only — faker and zod-mock have no locale support.
  for (const [locale, r] of Object.entries(locales)) {
    if (!r) continue;
    const z4 = r.avg.toFixed(3) + "ms";
    console.log(`${`user:${locale}`.padEnd(labelCol)} ${pad("—")} ${pad("—")} ${pad(z4)}`);
  }

  console.log(rule);
  console.log();
}
