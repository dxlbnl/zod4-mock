/**
 * B136 — BUG: an array `options.overrides` value MUST set the array element
 * count. Override length wins; the prior "override never resizes — schema length
 * governs" rule (B53-R2 / B134-R3 / D14's no-resize clause) is superseded.
 *
 * Spec: wiki/specs/B136-override-array-length-wins.md
 * Item card: wiki/backlog/doing/B136-override-array-length-wins.md
 *
 * Contract (spec): when `options.overrides` supplies an ARRAY for an array-typed
 * target, the result has exactly `override.length` elements — generate
 * `override.length` per-element-seeded base elements (B135 indexing extended to
 * `0..override.length-1`), then per-index deep-merge each override slot onto its
 * base (object slot merges siblings, primitive slot replaces, hole leaves the
 * element fully generated). Override length wins even over `.length(N)`. Schema
 * bounds / `defaultArrayLength` govern ONLY the no-override case.
 *
 * One test per behavioural requirement id (minimum tests):
 *   - B136-R1  bare array field, override → exactly N, siblings preserved (RED)
 *   - B136-R2  override LONGER than default → N (extras generated, RED)
 *   - B136-R3  override SHORTER than default → N (tail dropped, RED)
 *   - B136-R4  override wins over explicit `.length(3)` (RED)
 *   - B136-R5  sparse hole → fully-generated element at that index (RED)
 *   - B136-R6  standalone primary path: fresh + pre-populated (two scenarios, RED)
 *   - B136-R7  bases per-element distinct + store-neutral over override count (RED)
 *   - B136-R8  deepMerge array-as-leaf unchanged — runtime behaviour (GREEN control)
 *   - B136-R9  no-override → schema length governs (GREEN control, unchanged)
 *   - B136-R10 regression — card repro, bare field + 4-entry override → 4 (RED, D6)
 *
 * NOT tested here:
 *   - B136-R11 (changeset) — reviewer-only artifact, not a runtime assertion.
 *   - The B136-R9 perf-gate clause (B97/B98 in site/bench/perf.test.ts) — a
 *     standing suite, not a new test; the unit control below covers the
 *     no-override length-governance half.
 *
 * RED expectation (pre-fix): the array branch maps over the SCHEMA/`defaultArrayLength`-
 * governed base, so override-longer drops extras (length = schema count), override-shorter
 * keeps a generated tail (length = schema count), `.length(N)` wins, and a bare field
 * generates the `[1,5]` default — none resize to `override.length`.
 *
 * Schemas constructed at module scope (D4 / D10). No `any`, no casts. `.js`
 * extensions on relative imports (Node16 ESM).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import { deepMerge } from "../../../src/utils/merge.js";

// ---------------------------------------------------------------------------
// B136-R1 — bare array field (no .length, no defaultArrayLength): an override
// of length 4 yields exactly 4 elements, siblings preserved.
//
// NOTE (RED caveat): this is the verbatim spec R1 scenario (seed 1, 4-entry
// override). Pre-fix the bare `[1,5]` default happens to roll exactly 4
// elements at seed 1, and the override maps positionally onto those 4 bases —
// so this test COINCIDENTALLY PASSES pre-fix. B136-R10 is the robust RED twin
// of the same bare-field-resize requirement (its slot rolls 3, so it fails
// pre-fix). R1 is kept faithful to the spec; R10 carries the RED proof.
// ---------------------------------------------------------------------------

describe("B136-R1: array-field override resizes the field array to override.length", () => {
  const Schema = z.object({
    name: z.string(),
    nested: z.object({ age: z.number(), name: z.string(), number: z.number() }).array(), // bare
  });

  it("B136-R1 / bare array field override yields exactly N elements, siblings preserved", () => {
    const world = createWorld({ seed: 1 }).withSchema(Schema); // no defaultArrayLength

    const r = world.generate(Schema, {
      overrides: { nested: Array.from({ length: 4 }, (_, number) => ({ number })) },
    });

    expect(r.nested.length).toBe(4); // override length wins — no .length()/defaultArrayLength
    for (const i of [0, 1, 2, 3] as const) {
      const el = r.nested[i]!;
      expect(el.number).toBe(i); // override won
      expect(typeof el.age).toBe("number"); // generated sibling survived
      expect(typeof el.name).toBe("string");
      expect(el.name.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// B136-R2 — override LONGER than the schema-generated default: extras are
// generated, not dropped. defaultArrayLength: [2,2], override of 5 → 5.
// ---------------------------------------------------------------------------

describe("B136-R2: override longer than the default produces override.length (extras generated)", () => {
  const Schema = z.object({
    items: z.object({ k: z.number(), v: z.string() }).array(),
  });

  it("B136-R2 / override longer than defaultArrayLength yields N, extras generated", () => {
    const world = createWorld({ seed: 1, defaultArrayLength: [2, 2] }).withSchema(Schema);

    const r = world.generate(Schema, {
      overrides: { items: [{ k: 10 }, { k: 11 }, { k: 12 }, { k: 13 }, { k: 14 }] },
    });

    expect(r.items.length).toBe(5); // 5-entry override wins over default of 2 — extras NOT dropped
    for (const i of [0, 1, 2, 3, 4] as const) {
      const el = r.items[i]!;
      expect(el.k).toBe(10 + i);
      expect(typeof el.v).toBe("string");
      expect(el.v.length).toBeGreaterThan(0); // each extra slot generated a base element
    }
  });
});

// ---------------------------------------------------------------------------
// B136-R3 — override SHORTER than the schema-generated default: the generated
// tail is NOT kept. defaultArrayLength: [4,4], override of 1 → 1.
// ---------------------------------------------------------------------------

describe("B136-R3: override shorter than the default produces override.length (no tail)", () => {
  const Schema = z.object({
    items: z.object({ k: z.number(), v: z.string() }).array(),
  });

  it("B136-R3 / override shorter than defaultArrayLength yields N, no generated tail", () => {
    const world = createWorld({ seed: 1, defaultArrayLength: [4, 4] }).withSchema(Schema);

    const r = world.generate(Schema, { overrides: { items: [{ k: 100 }] } });

    expect(r.items.length).toBe(1); // single-entry override wins over default of 4 — tail NOT kept
    expect(r.items[0]!.k).toBe(100);
    expect(typeof r.items[0]!.v).toBe("string");
    expect(r.items[0]!.v.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// B136-R4 — override length wins over an explicit `.length(3)`.
// ---------------------------------------------------------------------------

describe("B136-R4: override length wins over an explicit .length(N)", () => {
  const Schema = z.object({
    items: z.object({ k: z.number(), v: z.string() }).array().length(3),
  });

  it("B136-R4 / 5-entry override on a .length(3) field yields 5 elements", () => {
    const world = createWorld({ seed: 1 }).withSchema(Schema);

    const r = world.generate(Schema, {
      overrides: { items: [{ k: 0 }, { k: 1 }, { k: 2 }, { k: 3 }, { k: 4 }] },
    });

    expect(r.items.length).toBe(5); // 5-entry override wins over .length(3)
    for (const i of [0, 1, 2, 3, 4] as const) {
      const el = r.items[i]!;
      expect(el.k).toBe(i);
      expect(typeof el.v).toBe("string");
      expect(el.v.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// B136-R5 — a sparse hole in the override array yields a fully-generated
// element at that index; length is still override.length.
// ---------------------------------------------------------------------------

describe("B136-R5: a sparse hole yields a fully-generated element at that index", () => {
  const Schema = z.object({
    items: z.object({ x: z.number(), y: z.string() }).array(),
  });

  it("B136-R5 / sparse hole at the middle index yields a fully-generated middle element", () => {
    const world = createWorld({ seed: 1 }).withSchema(Schema);

    // eslint-disable-next-line no-sparse-arrays -- the hole at index 1 is the scenario
    const r = world.generate(Schema, { overrides: { items: [{ x: 0 }, , { x: 2 }] } });

    expect(r.items.length).toBe(3);
    expect(r.items[0]!.x).toBe(0);
    expect(r.items[2]!.x).toBe(2);
    expect(typeof r.items[1]!.x).toBe("number"); // hole → fully generated
    for (const i of [0, 1, 2] as const) {
      expect(typeof r.items[i]!.y).toBe("string");
      expect(r.items[i]!.y.length).toBeGreaterThan(0); // every slot's y sibling generated
    }
  });
});

// ---------------------------------------------------------------------------
// B136-R6 — standalone primary-array path: fresh world resizes to
// override.length; pre-populated registry resolves to
// max(existingCount, override.length) with the head untouched (D8 carveout).
// Two scenarios → two tests.
// ---------------------------------------------------------------------------

describe("B136-R6: standalone primary array resizes to override.length (D8 carveout when pre-populated)", () => {
  const Person = z.object({ id: z.string(), name: z.string() });

  it("B136-R6 / fresh primary array, 5-entry override yields 5, registry == result (D8)", () => {
    const world = createWorld({ seed: 1 }).withSchema(Person);

    const result = world.generate(Person.array(), {
      overrides: [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }, { name: "e" }],
    });

    expect(result.length).toBe(5); // override length wins — no schema bound supplied
    expect(result.map((p) => p.name)).toEqual(["a", "b", "c", "d", "e"]);
    for (const p of result) {
      expect(typeof p.id).toBe("string");
      expect(p.id.length).toBeGreaterThan(0); // sibling preserved
    }
    expect(world.registry.all(Person)).toEqual(result); // D8 — stored == returned
  });

  it("B136-R6 / pre-populated primary array, length is max(existingCount, override.length), head untouched", () => {
    const PrePerson = z.object({ id: z.string(), name: z.string() });
    const world = createWorld({ seed: 1 }).withSchema(PrePerson);
    world.populate(PrePerson, 3); // three pre-existing stored records
    const head = world.registry
      .all(PrePerson)
      .slice(0, 3)
      .map((p) => p.name);

    const result = world.generate(PrePerson.array(), {
      overrides: [{ name: "x" }, { name: "y" }, { name: "z" }, { name: "w" }, { name: "v" }],
    });

    expect(result.length).toBe(5); // max(existingCount=3, override.length=5)
    expect(result.slice(0, 3).map((p) => p.name)).toEqual(head); // head untouched (D8)
    expect(result.slice(3).map((p) => p.name)).toEqual(["w", "v"]); // tail carries override slot
    expect(world.registry.all(PrePerson)).toEqual(result); // D8 — stored == returned
  });
});

// ---------------------------------------------------------------------------
// B136-R7 — the override.length base elements are per-element distinct and
// store-neutral over the override-driven base count (composes with B135/D35).
// ---------------------------------------------------------------------------

describe("B136-R7: override.length bases are per-element distinct and store-neutral", () => {
  const Schema = z.object({
    items: z.object({ k: z.number(), v: z.string() }).array(),
  });

  it("B136-R7 / longer override → distinct generated v siblings, store-off == store-on", () => {
    const worldOn = createWorld({ seed: 7, defaultArrayLength: [1, 1] }).withSchema(Schema);
    const worldOff = createWorld({ seed: 7, defaultArrayLength: [1, 1] }).withSchema(Schema);

    const overrides = { items: [{ k: 0 }, { k: 1 }, { k: 2 }, { k: 3 }] }; // length 4, default 1
    const on = worldOn.generate(Schema, { overrides });
    const off = worldOff.generate(Schema, { store: false, overrides });

    expect(on.items.length).toBe(4);
    // four generated v siblings — incl. the three slots beyond the default-1 base — distinct
    expect(new Set(on.items.map((it) => it.v)).size).toBe(4);
    // store-off elements byte-equal store-on at every position (D35 over override base count)
    expect(JSON.stringify(off.items)).toBe(JSON.stringify(on.items));
  });
});

// ---------------------------------------------------------------------------
// B136-R8 — CONTROL (GREEN pre-fix): deepMerge keeps array-as-leaf semantics
// (B18). Asserting the runtime behaviour, not "file unchanged".
// ---------------------------------------------------------------------------

describe("B136-R8: deepMerge keeps array-as-leaf semantics (B18 preserved)", () => {
  it("B136-R8 / deepMerge array source replaces target wholesale", () => {
    const result = deepMerge({ tags: ["a", "b", "c"] }, { tags: ["x", "y"] });
    expect(result).toEqual({ tags: ["x", "y"] });
  });
});

// ---------------------------------------------------------------------------
// B136-R9 — CONTROL (GREEN pre-fix): no override → schema length governs. The
// no-override length resolution is unchanged by B136.
// ---------------------------------------------------------------------------

describe("B136-R9: no-override case stays governed by schema bounds (control)", () => {
  const Schema = z.object({ items: z.object({ k: z.number() }).array().length(3) });

  it("B136-R9 / no override → .length(3) field yields exactly 3 (governance unchanged)", () => {
    const world = createWorld({ seed: 1 }).withSchema(Schema);

    const r = world.generate(Schema); // no overrides

    expect(r.items.length).toBe(3); // .length(3) governs the no-override case
  });
});

// ---------------------------------------------------------------------------
// B136-R10 — regression (D6): the card/playground repro. Registered
// NestedThing + bare nested array field, 4-entry override, NO
// defaultArrayLength → exactly 4 elements, siblings preserved.
// ---------------------------------------------------------------------------

describe("B136-R10: regression — bare nested array field + 4-entry override yields 4, siblings kept", () => {
  const NestedThing = z.object({ age: z.number(), name: z.string(), number: z.number() });
  const Schema = z.object({ name: z.string(), nested: NestedThing.array() }); // bare array

  it("B136-R10 / card repro — bare field + 4-entry override, no defaultArrayLength, yields 4", () => {
    const world = createWorld({ seed: 1 }).withSchema(NestedThing).withSchema(Schema);

    const r = world.generate(Schema, {
      overrides: { nested: Array.from({ length: 4 }, (_, number) => ({ number })) },
    }); // NO defaultArrayLength

    expect(r.nested.length).toBe(4);
    expect(r.nested.map((n) => n.number)).toEqual([0, 1, 2, 3]);
    for (const i of [0, 1, 2, 3] as const) {
      const el = r.nested[i]!;
      expect(Object.keys(el).sort()).toEqual(["age", "name", "number"]);
      expect(typeof el.age).toBe("number");
      expect(typeof el.name).toBe("string");
      expect(el.name.length).toBeGreaterThan(0);
    }
  });
});
