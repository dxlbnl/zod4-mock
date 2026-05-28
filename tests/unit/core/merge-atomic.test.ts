/**
 * B18 — BUG: `deepMerge` recurses into `Date` / `Map` / `Set` / `RegExp` / class
 * instances and reduces them to `{}`.
 *
 * Spec: wiki/specs/B18-deepmerge-atomic-objects.md
 * Item card: wiki/backlog/doing/B18-deepmerge-atomic-objects.md
 *
 * Helper-boundary tests against `deepMerge` directly. The user-facing
 * `world.generate` boundary tests live in `tests/unit/core/overrides-atomic.test.ts`.
 *
 *  - B18-R1: any non-plain-object source/target is a leaf, returned verbatim
 *    (by reference) without recursion. Atomic types covered: Date, Map, Set,
 *    RegExp, custom class instance. Plus: non-plain target → source returned
 *    verbatim; `Object.create(null)` recognised as plain.
 *  - B18-R2: plain-object recursion (today's semantics) preserved. These
 *    scenarios are forward-looking regression guards that MUST already pass.
 *
 * Each test is named by requirement id + scenario per the test-writer SKILL.
 * Per D1 (no `any`): tests use `unknown` + narrow `as { key: unknown }` casts
 * and `instanceof` checks before further access.
 */

import { describe, it, expect } from "vitest";
import { deepMerge } from "../../../src/utils/merge.js";

// ---------------------------------------------------------------------------
// B18-R1 — atomic source is a leaf, returned verbatim by reference
// ---------------------------------------------------------------------------

describe("B18-R1: deepMerge treats non-plain-object source as a leaf", () => {
  it("B18-R1 / Date source replaces, by reference", () => {
    const target = { at: { ignored: true } };
    const source = { at: new Date("2024-01-01T00:00:00Z") };

    const result = deepMerge(target, source) as { at: unknown };

    expect(result.at instanceof Date).toBe(true);
    // Strict reference equality — the Date is passed through, not reconstructed.
    expect(result.at).toBe(source.at);
    if (result.at instanceof Date) {
      expect(result.at.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    }
  });

  it("B18-R1 / Map source replaces, by reference", () => {
    const target = { m: { ignored: true } };
    const source = {
      m: new Map<string, number>([
        ["a", 1],
        ["b", 2],
      ]),
    };

    const result = deepMerge(target, source) as { m: unknown };

    expect(result.m instanceof Map).toBe(true);
    expect(result.m).toBe(source.m);
    if (result.m instanceof Map) {
      expect((result.m as Map<string, number>).get("a")).toBe(1);
    }
  });

  it("B18-R1 / Set source replaces, by reference", () => {
    const target = { s: { ignored: true } };
    const source = { s: new Set<number>([1, 2, 3]) };

    const result = deepMerge(target, source) as { s: unknown };

    expect(result.s instanceof Set).toBe(true);
    expect(result.s).toBe(source.s);
    if (result.s instanceof Set) {
      expect((result.s as Set<number>).has(2)).toBe(true);
    }
  });

  it("B18-R1 / RegExp source replaces, by reference", () => {
    const target = { r: { ignored: true } };
    const source = { r: /foo/i };

    const result = deepMerge(target, source) as { r: unknown };

    expect(result.r instanceof RegExp).toBe(true);
    expect(result.r).toBe(source.r);
    if (result.r instanceof RegExp) {
      // The `i` flag survived — proves the regex was not re-constructed as `/(?:)/`.
      expect(result.r.test("FOO")).toBe(true);
    }
  });

  it("B18-R1 / class instance source replaces, by reference (positive guard)", () => {
    class Box {
      constructor(public n: number) {}
    }
    const b = new Box(7);
    const target = { box: { ignored: true } };
    const source = { box: b };

    const result = deepMerge(target, source) as { box: unknown };

    expect(result.box).toBe(b);
    expect(result.box instanceof Box).toBe(true);
    if (result.box instanceof Box) {
      expect(result.box.n).toBe(7);
    }
  });

  it("B18-R1 / target itself is a non-plain object — source returned verbatim (no spread)", () => {
    const target = new Date("2024-01-01T00:00:00Z");
    const source = { merged: true };

    const result = deepMerge(target, source);

    // The plain-object source is returned by reference; the function does NOT
    // attempt to spread the Date target into `{}` and lose its identity.
    expect(result).toBe(source);
  });

  it("B18-R1 / null-prototype dict is treated as a plain object and recurses", () => {
    const target = Object.create(null) as Record<string, unknown>;
    target.a = 1;
    const source = Object.create(null) as Record<string, unknown>;
    source.b = 2;

    const result = deepMerge(target, source) as Record<string, unknown>;

    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// B18-R2 — plain-object recursion preserved (regression guards; should PASS today)
// ---------------------------------------------------------------------------

describe("B18-R2: deepMerge still recurses into plain object literals (no regression)", () => {
  it("B18-R2 / plain-object recursion preserves sibling keys", () => {
    const target = { a: { b: 1 } };
    const source = { a: { c: 2 } };

    const result = deepMerge(target, source) as { a: { b: number; c: number } };

    expect(result).toEqual({ a: { b: 1, c: 2 } });
  });

  it("B18-R2 / plain-object recursion overrides on conflicting keys", () => {
    const target = { a: { b: 1, c: 1 } };
    const source = { a: { c: 2 } };

    const result = deepMerge(target, source) as { a: { b: number; c: number } };

    expect(result.a.b).toBe(1);
    expect(result.a.c).toBe(2);
  });

  it("B18-R2 / array at a key replaces wholesale (today's semantics preserved)", () => {
    const target = { tags: ["a", "b", "c"] };
    const source = { tags: ["x", "y"] };

    const result = deepMerge(target, source) as { tags: string[] };

    expect(result.tags).toEqual(["x", "y"]);
  });

  it("B18-R2 / primitive at a key replaces (today's semantics preserved)", () => {
    const target = { n: 1 };
    const source = { n: 2 };

    const result = deepMerge(target, source) as { n: number };

    expect(result.n).toBe(2);
  });
});
