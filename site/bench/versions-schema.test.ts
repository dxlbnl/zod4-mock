/**
 * B98-R1 / B98-R2 — on-disk shape tests for versions.json and the npm aliases.
 *
 * The Zod schema module (`./versions-schema.ts`) does not exist yet — the
 * implementer creates it. The expected contract:
 *
 *   import { versionsFileSchema, type VersionsFile, type VersionEntry }
 *     from "./versions-schema.ts";
 *
 * `versionsFileSchema.parse(json)` MUST succeed for the committed
 * `site/bench/results/versions.json`, AND every entry MUST carry either a
 * fully-populated `memory` block (per B98-R6) or `memory: null` with a
 * `note` explaining why (per B98-R1 scenario "legacy entries are upgraded
 * in place").
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { versionsFileSchema } from "./versions-schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
const versionsPath = join(here, "results", "versions.json");
const sitePkgPath = join(here, "..", "package.json");

// ─── B98-R1 — versions.json shape ────────────────────────────────────────────

describe("B98-R1 / versions.json shape", () => {
  it("B98-R1 / file parses against the pinned Zod schema", () => {
    const raw = readFileSync(versionsPath, "utf-8");
    const json = JSON.parse(raw) as unknown;
    // versionsFileSchema MUST accept the committed file.
    const parsed = versionsFileSchema.parse(json);
    expect(parsed.entries.length).toBeGreaterThan(0);
    expect(parsed.config.warmup).toBeGreaterThan(0);
    expect(parsed.config.runs).toBeGreaterThan(0);
    expect(typeof parsed.node).toBe("string");
    expect(typeof parsed.schemas.simple).toBe("string");
    expect(typeof parsed.schemas.user).toBe("string");
    expect(typeof parsed.schemas.nested).toBe("string");
  });

  it("B98-R1 / every entry has avg_us for all three tiers", () => {
    const json = JSON.parse(readFileSync(versionsPath, "utf-8")) as unknown;
    const parsed = versionsFileSchema.parse(json);
    for (const entry of parsed.entries) {
      expect(typeof entry.avg_us.simple).toBe("number");
      expect(typeof entry.avg_us.user).toBe("number");
      expect(typeof entry.avg_us.nested).toBe("number");
      expect(Number.isFinite(entry.avg_us.simple)).toBe(true);
      expect(Number.isFinite(entry.avg_us.user)).toBe(true);
      expect(Number.isFinite(entry.avg_us.nested)).toBe(true);
    }
  });

  it("B98-R1 / every entry has a memory block (object) or memory: null with a note", () => {
    const json = JSON.parse(readFileSync(versionsPath, "utf-8")) as unknown;
    const parsed = versionsFileSchema.parse(json);
    for (const entry of parsed.entries) {
      if (entry.memory === null) {
        // Legacy entry — must carry a note explaining the omission.
        expect(typeof entry.note).toBe("string");
        expect((entry.note ?? "").length).toBeGreaterThan(0);
      } else {
        // Per-tier shape: heapUsedDeltaBytes (number) + v8HeapUsedBytes (number).
        for (const tier of ["simple", "user", "nested"] as const) {
          const mem = entry.memory[tier];
          expect(typeof mem.heapUsedDeltaBytes).toBe("number");
          expect(typeof mem.v8HeapUsedBytes).toBe("number");
          expect(Number.isFinite(mem.heapUsedDeltaBytes)).toBe(true);
          expect(Number.isFinite(mem.v8HeapUsedBytes)).toBe(true);
          expect(mem.v8HeapUsedBytes).toBeGreaterThan(0);
        }
      }
    }
  });

  it("B98-R1 / every entry's timestamp is ISO-8601", () => {
    const json = JSON.parse(readFileSync(versionsPath, "utf-8")) as unknown;
    const parsed = versionsFileSchema.parse(json);
    // ISO-8601 like "2026-06-04T07:02:54Z" or with .sss / offset.
    const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
    for (const entry of parsed.entries) {
      expect(entry.timestamp).toMatch(isoLike);
      // Reparsable as a Date.
      expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
    }
  });
});

// ─── B98-R2 — npm aliases declared in site/package.json ──────────────────────

describe("B98-R2 / npm aliases stay declared in site/package.json", () => {
  it("B98-R2 / the seven aliases are present in dependencies", () => {
    const pkg = JSON.parse(readFileSync(sitePkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    const deps = pkg.dependencies ?? {};
    const required = [
      "zod4-mock-v050",
      "zod4-mock-v060",
      "zod4-mock-v070",
      "zod4-mock-v072",
      "zod4-mock-v080",
      "zod4-mock-v090",
      "zod4-mock-v092",
    ];
    for (const alias of required) {
      expect(deps[alias], `missing alias ${alias}`).toBeTruthy();
      // Each alias is npm-resolved against a published zod4-mock version.
      expect(deps[alias]).toMatch(/^npm:zod4-mock@/);
    }
  });
});
