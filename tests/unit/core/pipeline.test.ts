/**
 * B23 — structural contract tests for the per-field PIPELINE list.
 *
 * Spec: wiki/specs/B23-promote-per-field-pipeline-to-list.md
 *
 * These tests pin the **observable structural contracts** the spec mandates,
 * none of which are covered by the existing seeded-snapshot suite:
 *
 *  - B23-R3  — PIPELINE has exactly seven named steps in pinned order.
 *  - B23-R4  — PIPELINE_NO_REGISTRATION shares function instances with
 *              PIPELINE (no duplicate bodies), three steps in pinned order.
 *  - B23-R6  — `applyObjectOverride` deep-merges plain objects, replaces
 *              primitives/arrays, and no-ops on `undefined` override.
 *  - B23-R9  — `WorldImpl.generateObjectFields` body stays ≤ 50 LOC (with
 *              jsdoc/signature tolerance, ≤ 60 here per spec discussion).
 *  - B23-R7  — `src/explain.ts` is ≤ 215 LOC (down from 315 pre-B23).
 *
 * No PRNG / world calls — these are static structural assertions on the
 * pipeline module itself plus two file-size assertions.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  PIPELINE,
  PIPELINE_NO_REGISTRATION,
  applyObjectOverride,
} from "../../../src/pipeline.js";

// ---------------------------------------------------------------------------
// Repo-root helper (shared by R9 / R7 file-size assertions).
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../..",
);

// ---------------------------------------------------------------------------
// B23-R3 — PIPELINE shape: exactly seven named step functions in pinned order
// ---------------------------------------------------------------------------

describe("B23-R3: PIPELINE list — exact seven named step functions in pinned order", () => {
  it("B23-R3 / pipeline-shape — PIPELINE has exactly seven entries", () => {
    expect(PIPELINE.length).toBe(7);
  });

  it("B23-R3 / pipeline-shape — entries are named functions in pinned order", () => {
    expect(PIPELINE.map((s) => s.name)).toEqual([
      "overrideEagerStep",
      "matcherStep",
      "schemaKeyMapStep",
      "unwrapOptionalStep",
      "customKeyGenStep",
      "keyHeuristicStep",
      "schemaBasedStep",
    ]);
  });

  it("B23-R3 / pipeline-shape — joined name string matches scenario fixture", () => {
    expect(PIPELINE.map((s) => s.name).join(",")).toBe(
      "overrideEagerStep,matcherStep,schemaKeyMapStep,unwrapOptionalStep,customKeyGenStep,keyHeuristicStep,schemaBasedStep",
    );
  });
});

// ---------------------------------------------------------------------------
// B23-R4 — PIPELINE_NO_REGISTRATION subset references same step instances
// ---------------------------------------------------------------------------

describe("B23-R4: PIPELINE_NO_REGISTRATION — three-step subset references PIPELINE instances", () => {
  it("B23-R4 / subset-shape — exactly three entries", () => {
    expect(PIPELINE_NO_REGISTRATION.length).toBe(3);
  });

  it("B23-R4 / subset-shape — entries are named in pinned order", () => {
    expect(PIPELINE_NO_REGISTRATION.map((s) => s.name)).toEqual([
      "unwrapOptionalStep",
      "keyHeuristicStep",
      "schemaBasedStep",
    ]);
  });

  it("B23-R4 / subset-identity — references same function instances as PIPELINE", () => {
    // The subset MUST reference the same step instances as PIPELINE so the
    // per-rung behaviour cannot drift (spec: B23-R4 "no duplicate function
    // bodies"). Indices 3, 5, 6 of PIPELINE are unwrap / keyHeuristic /
    // schemaBased respectively.
    expect(PIPELINE_NO_REGISTRATION[0]).toBe(PIPELINE[3]);
    expect(PIPELINE_NO_REGISTRATION[1]).toBe(PIPELINE[5]);
    expect(PIPELINE_NO_REGISTRATION[2]).toBe(PIPELINE[6]);
  });

  it("B23-R4 / subset-omissions — matcher / schemaKeyMap / customKeyGen / override absent", () => {
    const subsetNames = PIPELINE_NO_REGISTRATION.map((s) => s.name);
    expect(subsetNames).not.toContain("overrideEagerStep");
    expect(subsetNames).not.toContain("matcherStep");
    expect(subsetNames).not.toContain("schemaKeyMapStep");
    expect(subsetNames).not.toContain("customKeyGenStep");
  });
});

// ---------------------------------------------------------------------------
// B23-R6 — `applyObjectOverride` deep-merge contract
// ---------------------------------------------------------------------------

describe("B23-R6: applyObjectOverride — B12 deep-merge contract helper", () => {
  it("B23-R6 / undefined-override — returns value unchanged", () => {
    expect(applyObjectOverride({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(applyObjectOverride("foo", undefined)).toBe("foo");
    expect(applyObjectOverride(42, undefined)).toBe(42);
    expect(applyObjectOverride([1, 2, 3], undefined)).toEqual([1, 2, 3]);
  });

  it("B23-R6 / plain-object-override — deep-merges top-level keys", () => {
    expect(applyObjectOverride({ a: 1, b: 2 }, { c: 3 })).toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
  });

  it("B23-R6 / plain-object-override — deep-merges nested plain objects", () => {
    expect(
      applyObjectOverride({ a: { x: 1 } }, { a: { y: 2 } }),
    ).toEqual({ a: { x: 1, y: 2 } });
  });

  it("B23-R6 / plain-object-override — override key wins on collision", () => {
    // When both target and source carry the same leaf key, the override
    // replaces the leaf (deepMerge falls through to source for non-plain
    // values, including primitives).
    expect(
      applyObjectOverride({ a: 1, b: 2 }, { b: 99 }),
    ).toEqual({ a: 1, b: 99 });
  });

  it("B23-R6 / primitive-override — replaces value verbatim", () => {
    // deepMerge bails to source when either side is not a plain object.
    expect(applyObjectOverride("foo", "bar")).toBe("bar");
    expect(applyObjectOverride(42, 100)).toBe(100);
    expect(applyObjectOverride(true, false)).toBe(false);
  });

  it("B23-R6 / array-override — replaces (not concat, not merge)", () => {
    // Arrays are non-plain-object: deepMerge replaces wholesale.
    expect(applyObjectOverride([1, 2, 3], [4, 5])).toEqual([4, 5]);
  });

  it("B23-R6 / atomic-object-override — replaces (B18 contract)", () => {
    // Date / Map / Set / RegExp are non-plain-object: deepMerge replaces
    // wholesale rather than reducing them to `{}`. This is the B18 guard.
    const d1 = new Date("2020-01-01T00:00:00.000Z");
    const d2 = new Date("2026-05-29T00:00:00.000Z");
    expect(applyObjectOverride(d1, d2)).toBe(d2);

    const m1 = new Map<string, number>([["a", 1]]);
    const m2 = new Map<string, number>([["b", 2]]);
    expect(applyObjectOverride(m1, m2)).toBe(m2);
  });
});

// ---------------------------------------------------------------------------
// B23-R9 — `WorldImpl.generateObjectFields` body stays ≤ 50 LOC
//
// The spec scenario uses `awk '/private generateObjectFields/,/^  }/'`. We
// reproduce that here by regex-matching from the `private generateObjectFields`
// signature up through the first `\n  }\n` (the method's closing brace at
// two-space indent). The spec's binding upper bound is 50 LOC; we apply the
// 10-line jsdoc/signature tolerance from the user-supplied task brief (≤ 60).
//
// B28: the method moved from `src/world.ts` to `src/world/engine.ts` when
// `world.ts` was split by concern. The LOC bound is unchanged — only the
// path follows the file.
// ---------------------------------------------------------------------------

describe("B23-R9: generateObjectFields method body stays concise", () => {
  it("B23-R9 / loc-bound — body is ≤ 60 lines (signature + jsdoc tolerance over 50)", () => {
    const src = readFileSync(
      path.join(REPO_ROOT, "src/world/engine.ts"),
      "utf-8",
    );
    const match = src.match(/private generateObjectFields\([\s\S]*?\n  \}\n/);
    expect(match).not.toBeNull();
    const body = match![0];
    const lineCount = body.split("\n").length - 1; // trailing "\n" yields empty slot
    expect(lineCount).toBeLessThanOrEqual(60);
  });
});

// ---------------------------------------------------------------------------
// B23-R7 — `src/explain.ts` is ≤ 215 LOC (down from 315 pre-B23)
// ---------------------------------------------------------------------------

describe("B23-R7: explain.ts shrinks by ≥ 100 LOC", () => {
  it("B23-R7 / loc-bound — src/explain.ts is ≤ 215 lines", () => {
    const src = readFileSync(
      path.join(REPO_ROOT, "src/explain.ts"),
      "utf-8",
    );
    // Match `wc -l` semantics: count newline-terminated lines. A trailing
    // newline yields the same count as `wc -l` reports.
    const lineCount = src.split("\n").length - 1;
    expect(lineCount).toBeLessThanOrEqual(215);
  });
});
