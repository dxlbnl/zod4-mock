/**
 * B18 — BUG: `deepMerge` recurses into `Date` / `Map` / `Set` / `RegExp` / class
 * instances and reduces them to `{}`. User-facing `world.generate` boundary
 * tests — pinning the fix at every call site that flows through `deepMerge`
 * (matcher branch, final-pass, array per-element).
 *
 * Spec: wiki/specs/B18-deepmerge-atomic-objects.md
 * Item card: wiki/backlog/doing/B18-deepmerge-atomic-objects.md
 *
 *  - B18-R3: the fix lands in `deepMerge` itself — matcher branch, final-pass,
 *    and array per-element override all inherit it.
 *  - B18-R4: regression test for the exact card repro (D6 — mandatory for bugs).
 *    The first scenario MUST reproduce the card's failure shape exactly:
 *    no matcher for the `at` field, same field name, same `z.string()` + `z.date()`
 *    shape, same `overrides` keys.
 *
 * Each test is named by requirement id + scenario per the test-writer SKILL.
 * Per D1 (no `any`): tests use narrow `instanceof` checks rather than `any`.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// B18-R3 — atomic overrides flow through every `deepMerge` call site
// ---------------------------------------------------------------------------

describe("B18-R3: atomic overrides flow through every deepMerge call site", () => {
  it("B18-R3 / matcher-branch atomic override flows through (B12 matcher path)", () => {
    const EventSchema = z.object({
      id: z.string(),
      at: z.date(),
    });

    const world = createWorld({ seed: 42 }).withSchema(EventSchema, {
      matchers: {
        at: () => new Date("2000-01-01T00:00:00Z"),
      },
    });

    const e = world.generate(EventSchema, {
      overrides: { at: new Date("2024-06-15T12:00:00Z") },
    });

    expect(e.at instanceof Date).toBe(true);
    if (e.at instanceof Date) {
      expect(e.at.toISOString()).toBe("2024-06-15T12:00:00.000Z");
    }
  });

  it("B18-R3 / final-pass atomic override flows through (no matcher)", () => {
    const EventSchema = z.object({
      id: z.string(),
      at: z.date(),
    });

    const world = createWorld({ seed: 42 }).withSchema(EventSchema);

    const e = world.generate(EventSchema, {
      overrides: { at: new Date("2024-06-15T12:00:00Z") },
    });

    expect(e.at instanceof Date).toBe(true);
    if (e.at instanceof Date) {
      expect(e.at.toISOString()).toBe("2024-06-15T12:00:00.000Z");
    }
  });

  it("B18-R3 / per-element atomic override flows through (array path)", () => {
    const Schema = z.array(z.date());
    const overrides: (Date | undefined)[] = [
      undefined,
      new Date("2024-06-15T12:00:00Z"),
      undefined,
    ];

    const r = createWorld({ seed: 1 }).generate(Schema, {
      // The array path's per-element `deepMerge(item, ov)` runs at index 1.
      overrides: overrides as unknown as Date[],
    });

    expect(Array.isArray(r)).toBe(true);
    const element1 = r[1];
    expect(element1 instanceof Date).toBe(true);
    if (element1 instanceof Date) {
      expect(element1.toISOString()).toBe("2024-06-15T12:00:00.000Z");
    }
  });
});

// ---------------------------------------------------------------------------
// B18-R4 — regression test for the exact card repro (D6 — mandatory)
// ---------------------------------------------------------------------------

describe("B18-R4: regression test for the exact card repro (D6)", () => {
  it("B18-R4 / card repro — z.date() field, Date override survives", () => {
    // Exact card repro: no matcher registered for `at`, same field name,
    // same `z.string()` + `z.date()` shape, same `overrides` keys.
    const Event = z.object({
      id: z.string(),
      at: z.date(),
    });

    const world = createWorld({ seed: 1 }).withSchema(Event);

    const e = world.generate(Event, {
      overrides: {
        id: "evt-1",
        at: new Date("2024-01-01T00:00:00Z"),
      },
    });

    expect(e.id).toBe("evt-1");
    expect(e.at instanceof Date).toBe(true);
    if (e.at instanceof Date) {
      expect(e.at.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    }
  });

  it("B18-R4 / card repro — z.instanceof(RegExp) field, /foo/ override survives", () => {
    const Pat = z.object({
      rule: z.instanceof(RegExp),
    });

    const world = createWorld({ seed: 1 }).withSchema(Pat);

    const p = world.generate(Pat, {
      overrides: { rule: /foo/ },
    });

    expect(p.rule instanceof RegExp).toBe(true);
    if (p.rule instanceof RegExp) {
      expect(p.rule.test("foobar")).toBe(true);
    }
  });

  it("B18-R4 / card repro — Map override survives (forward-looking)", () => {
    // Spec illustrative TS used `z.instanceof(Map<string, number>)`; at the
    // Zod runtime level `z.instanceof` takes a constructor, not a
    // parameterised type, so we use `z.instanceof(Map)`.
    const Container = z.object({
      tags: z.instanceof(Map),
    });

    const world = createWorld({ seed: 1 }).withSchema(Container);

    const c = world.generate(Container, {
      overrides: { tags: new Map<string, number>([["a", 1]]) },
    });

    expect(c.tags instanceof Map).toBe(true);
    if (c.tags instanceof Map) {
      expect((c.tags as Map<string, number>).get("a")).toBe(1);
    }
  });
});
