/**
 * B98-R4 / B98-R9 — baseline.json + baseline.md provenance tests.
 *
 * Both files are expected to exist after the implementer lands B98:
 *   - site/bench/results/baseline.json — pinned reference for the comparator
 *   - site/bench/baseline.md           — refresh workflow + Node-version note
 *
 * Top-level shape of baseline.json MUST mirror latest.json, plus the new
 * `memory` field added by B98-R6.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const baselineJsonPath = join(here, "results", "baseline.json");
const baselineMdPath = join(here, "baseline.md");
const latestJsonPath = join(here, "results", "latest.json");

const TIME_TIERS = ["simple", "user", "nested"] as const;
const EXPECTED_TOP_LEVEL_KEYS = [
  "timestamp",
  "node",
  "versions",
  "config",
  "results",
  "localeResults",
  "memory",
] as const;

// ─── B98-R4 — baseline.json exists and mirrors latest.json shape ─────────────

describe("B98-R4 / baseline.json shape", () => {
  it("B98-R4 / file exists", () => {
    expect(existsSync(baselineJsonPath), `expected ${baselineJsonPath} to exist`).toBe(true);
  });

  it("B98-R4 / top-level keys exactly match latest.json's top-level key set", () => {
    const raw = readFileSync(baselineJsonPath, "utf-8");
    const baseline = JSON.parse(raw) as Record<string, unknown>;
    const latest = JSON.parse(readFileSync(latestJsonPath, "utf-8")) as Record<string, unknown>;
    const baselineKeys = Object.keys(baseline).sort();
    const latestKeys = Object.keys(latest).sort();
    expect(baselineKeys).toEqual(latestKeys);
    // And the expected set is the documented spec set.
    expect(baselineKeys).toEqual([...EXPECTED_TOP_LEVEL_KEYS].sort());
  });

  it("B98-R4 / versions['zod4-mock'] is a semver string", () => {
    const baseline = JSON.parse(readFileSync(baselineJsonPath, "utf-8")) as {
      versions: Record<string, string>;
    };
    const v = baseline.versions["zod4-mock"];
    expect(typeof v).toBe("string");
    expect(v).toMatch(/^\d+\.\d+\.\d+([-+].+)?$/);
  });

  it("B98-R4 / each tier in results carries only zod4_mock (no faker, no zod3_mock)", () => {
    const baseline = JSON.parse(readFileSync(baselineJsonPath, "utf-8")) as {
      results: Record<string, Record<string, { avg: number }>>;
    };
    for (const tier of TIME_TIERS) {
      expect(baseline.results, `missing results.${tier}`).toHaveProperty(tier);
      const subKeys = Object.keys(baseline.results[tier]!).sort();
      expect(subKeys, `results.${tier} sub-keys`).toEqual(["zod4_mock"]);
      expect(typeof baseline.results[tier]!.zod4_mock!.avg).toBe("number");
    }
  });

  it("B98-R4 / memory block has the per-tier shape", () => {
    const baseline = JSON.parse(readFileSync(baselineJsonPath, "utf-8")) as {
      memory: Record<string, { heapUsedDeltaBytes: number; v8HeapUsedBytes: number; gcForced: boolean }>;
    };
    for (const tier of TIME_TIERS) {
      const mem = baseline.memory[tier];
      expect(mem, `missing memory.${tier}`).toBeDefined();
      expect(typeof mem!.heapUsedDeltaBytes).toBe("number");
      expect(typeof mem!.v8HeapUsedBytes).toBe("number");
      expect(typeof mem!.gcForced).toBe("boolean");
      expect(mem!.v8HeapUsedBytes).toBeGreaterThan(0);
    }
  });

});

// ─── B98-R9 — baseline.md documents the refresh workflow ─────────────────────

describe("B98-R9 / baseline.md provenance", () => {
  it("B98-R9 / baseline.md exists", () => {
    expect(existsSync(baselineMdPath), `expected ${baselineMdPath} to exist`).toBe(true);
  });

  it("B98-R9 / documents the refresh command and target file", () => {
    const md = readFileSync(baselineMdPath, "utf-8");
    // Either a `pnpm bench:baseline`-style script, a `jq` extract producing
    // baseline.json from latest.json, or another documented stripped-extract
    // mechanism. A wholesale `cp` is no longer acceptable (B98-R9 amended:
    // baseline carries a stripped subset; cp would preserve faker/zod3_mock
    // sub-keys that B98-R4 forbids).
    const hasRefreshSignal =
      /bench:baseline|UPDATE_BASELINE=1|jq[\s\S]*latest\.json[\s\S]*baseline\.json/i.test(md);
    expect(hasRefreshSignal, "baseline.md must document the refresh mechanism").toBe(true);
    // Must name the file path being overwritten.
    expect(md).toMatch(/baseline\.json/);
  });

  it("B98-R9 / records Node version + machine class expectation", () => {
    const md = readFileSync(baselineMdPath, "utf-8");
    // Must mention Node (so future maintainers know which runtime to use).
    expect(md.toLowerCase()).toMatch(/node/);
    // Must mention the version used (e.g. v22.x or specific) — we accept
    // any "v<digits>" reference here.
    expect(md).toMatch(/v\d+/);
  });
});
