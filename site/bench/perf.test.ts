/**
 * CLI performance benchmark: faker vs @anatine/zod-mock (zod3) vs zod4-mock (zod4)
 *
 * Run:  pnpm bench
 * Results are written to bench/results/latest.json and appended to bench/results/history.json
 */

import { afterAll, describe, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { faker } from "@faker-js/faker";
import { generateMock } from "@anatine/zod-mock";
import { generate } from "zod4-mock";
import { nl } from "@zod4-mock/locale-nl";
import { en } from "@zod4-mock/locale-en";
import { z as z3 } from "zod3";
import { z as z4 } from "zod";
import { measure, type BenchResult } from "../src/lib/bench.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const WARMUP = 1000;
const RUNS = 5000;

// ─── Schema tier 1: Simple ────────────────────────────────────────────────────

const simple3 = z3.object({
  id: z3.string(),
  name: z3.string(),
  age: z3.number(),
  active: z3.boolean(),
});

const simple4 = z4.object({
  id: z4.string(),
  name: z4.string(),
  age: z4.number(),
  active: z4.boolean(),
});

function fakerSimple() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    age: faker.number.int({ min: 0, max: 120 }),
    active: faker.datatype.boolean(),
  };
}

// ─── Schema tier 2: User (realistic fields) ───────────────────────────────────

const user3 = z3.object({
  id: z3.string().uuid(),
  firstName: z3.string(),
  lastName: z3.string(),
  email: z3.string().email(),
  age: z3.number().int().min(18).max(100),
  role: z3.enum(["admin", "user", "guest"]),
  bio: z3.string().optional(),
  score: z3.number().min(0).max(1),
});

const user4 = z4.object({
  id: z4.string().uuid(),
  firstName: z4.string(),
  lastName: z4.string(),
  email: z4.string().email(),
  age: z4.int().gte(18).lte(100),
  role: z4.enum(["admin", "user", "guest"]),
  bio: z4.string().optional(),
  score: z4.number().min(0).max(1),
});

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

const address3 = z3.object({
  street: z3.string(),
  city: z3.string(),
  country: z3.string(),
  zip: z3.string(),
});

const address4 = z4.object({
  street: z4.string(),
  city: z4.string(),
  country: z4.string(),
  zip: z4.string(),
});

const nested3 = z3.object({
  id: z3.string().uuid(),
  name: z3.string(),
  email: z3.string().email(),
  address: address3,
  billingAddress: address3.optional(),
  tags: z3.array(z3.string()),
  metadata: z3.record(z3.string()),
});

const nested4 = z4.object({
  id: z4.string().uuid(),
  name: z4.string(),
  email: z4.string().email(),
  address: address4,
  billingAddress: address4.optional(),
  tags: z4.array(z4.string()),
  metadata: z4.record(z4.string(), z4.string()),
});

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

// ─── Results collection ───────────────────────────────────────────────────────

type TierResults = {
  faker: BenchResult;
  zod3_mock: BenchResult;
  zod4_mock: BenchResult;
};

const results: Record<string, TierResults> = {};

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
    results.simple.zod4_mock = measure(() => generate(simple4), {
      warmup: WARMUP,
      runs: RUNS,
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
    results.user.zod4_mock = measure(() => generate(user4), {
      warmup: WARMUP,
      runs: RUNS,
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
    results.nested.zod4_mock = measure(() => generate(nested4), {
      warmup: WARMUP,
      runs: RUNS,
    });
    console.log(` zod4-mock nested   ${fmt(results.nested.zod4_mock)}`);
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
    results,
    localeResults,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(r: BenchResult): string {
  return `avg=${r.avg.toFixed(3)}ms  min=${r.min.toFixed(3)}ms  ops/s=${Math.round(r.opsPerSec).toLocaleString()}`;
}

function pkgVersions() {
  function ver(name: string): string {
    try {
      const p = JSON.parse(
        readFileSync(
          join(
            dirname(fileURLToPath(import.meta.url)),
            `../node_modules/${name}/package.json`,
          ),
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

function printSummaryTable(
  res: Record<string, TierResults>,
  locales: Record<string, BenchResult>,
) {
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
    console.log(
      `${`user:${locale}`.padEnd(labelCol)} ${pad("—")} ${pad("—")} ${pad(z4)}`,
    );
  }

  console.log(rule);
  console.log();
}
