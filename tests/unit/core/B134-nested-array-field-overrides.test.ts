/**
 * B134 — BUG: array-field overrides replace elements wholesale instead of
 * per-index deep-merge. Overriding a nested array field with partial elements
 * drops the generated sibling fields instead of merging them.
 *
 * Spec: wiki/specs/B134-nested-array-field-overrides-replace-instead-of-merge.md
 * Item card: wiki/backlog/doing/B134-nested-array-field-overrides-replace-instead-of-merge.md
 *
 * One test per requirement scenario, named by requirement id. These cover the
 * behaviour-bearing requirements only:
 *   - B134-R1  registered path, nested object-array partial override merges per element
 *   - B134-R2  the same on the ad-hoc (no withSchema) path
 *   - B134-R3  short / long override arrays follow B53-R2 / D14 parity (two scenarios)
 *   - B134-R4  sibling-visibility: later matcher reads the override-applied earlier sibling
 *   - B134-R5  deepMerge array-as-leaf unchanged (runtime behaviour)
 *   - B134-R6  primitive-element array field: positional replace, schema length wins
 *   - B134-R9  regression — the playground repro: Object.keys per element == age/name/number
 *
 * NOT tested here (reviewer / standing-suite responsibilities):
 *   - B134-R7 (removal of the engine.ts:1870 whole-record deepMerge line) — verified by
 *     the existing override suite staying green + the reviewer reading the diff; there is
 *     no observable behaviour beyond what R1–R6/R9 already assert.
 *   - B134-R8 (B97/B98 perf gate) — already a standing suite in site/bench/perf.test.ts,
 *     not a new test; the implementer keeps it green.
 *   - B134-R10 (changeset) — reviewer-only artifact, not a runtime assertion.
 *
 * RED expectation (pre-fix): array-valued field overrides are returned wholesale by
 * step 0's eager-array branch and re-clobbered by the post-record whole-record
 * deepMerge, so each overridden element is the bare override object (siblings dropped).
 * R5 (deepMerge unchanged) and R6 (primitive-array replace) are expected GREEN pre-fix.
 *
 * Schemas constructed at module scope (D4 / D10). No `any`, no casts beyond the
 * narrow override-type aids (D1). `.js` extensions on relative imports (Node16 ESM).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import type { GeneratorContext } from "../../../src/index.js";
import { deepMerge } from "../../../src/utils/merge.js";

// ---------------------------------------------------------------------------
// B134-R1 — registered object, nested object-array field, partial-object
// override merges per element; generated age/name siblings survive.
// ---------------------------------------------------------------------------

describe("B134-R1: array-field override on a registered object merges per index, preserving siblings", () => {
  const Schema = z.object({
    name: z.string(),
    nested: z
      .object({ age: z.number(), name: z.string(), number: z.number() })
      .array()
      .length(4),
  });

  it("B134-R1 / registered nested object-array partial override merges per element", () => {
    const world = createWorld({ seed: 1 }).withSchema(Schema);

    const r = world.generate(Schema, {
      overrides: { nested: Array.from({ length: 4 }, (_, number) => ({ number })) },
    });

    expect(r.nested.length).toBe(4);
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
// B134-R2 — the same on the ad-hoc (no withSchema) path; proves the fix is in
// the single shared override-application flow, not a registered-path patch.
// ---------------------------------------------------------------------------

describe("B134-R2: array-field override merges per index on the ad-hoc (unregistered) path", () => {
  const Schema = z.object({
    name: z.string(),
    nested: z.object({ age: z.number(), name: z.string(), number: z.number() }).array().length(3),
  });

  it("B134-R2 / ad-hoc nested object-array partial override merges per element", () => {
    const world = createWorld({ seed: 1 }); // NO withSchema(Schema)

    const r = world.generate(Schema, {
      overrides: { nested: Array.from({ length: 3 }, (_, number) => ({ number })) },
    });

    expect(r.nested.length).toBe(3);
    for (const i of [0, 1, 2] as const) {
      const el = r.nested[i]!;
      expect(el.number).toBe(i);
      expect(typeof el.age).toBe("number");
      expect(typeof el.name).toBe("string");
      expect(el.name.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// B134-R3 — short / long override arrays follow B53-R2 / D14 parity: the
// override is applied positionally onto a schema-length-governed array and
// never resizes it. Two scenarios in the spec → two tests.
// ---------------------------------------------------------------------------

describe("B134-R3: override array does not resize the field array (B53-R2 / D14 parity)", () => {
  const LongSchema = z.object({
    items: z.object({ k: z.number(), v: z.string() }).array().length(2),
  });
  const ShortSchema = z.object({
    items: z.object({ k: z.number(), v: z.string() }).array().length(3),
  });

  it("B134-R3 / override longer than the generated array — extras ignored", () => {
    const world = createWorld({ seed: 1 }).withSchema(LongSchema);

    const r = world.generate(LongSchema, {
      overrides: { items: [{ k: 10 }, { k: 11 }, { k: 12 }, { k: 13 }] },
    });

    expect(r.items.length).toBe(2); // .length(2) governs, not the 4-entry override
    expect(r.items[0]!.k).toBe(10);
    expect(r.items[1]!.k).toBe(11);
    for (const i of [0, 1] as const) {
      expect(typeof r.items[i]!.v).toBe("string");
      expect(r.items[i]!.v.length).toBeGreaterThan(0); // sibling preserved
    }
  });

  it("B134-R3 / override shorter than the generated array — tail stays schema-generated", () => {
    const world = createWorld({ seed: 1 }).withSchema(ShortSchema);

    const r = world.generate(ShortSchema, { overrides: { items: [{ k: 100 }] } });

    expect(r.items.length).toBe(3);
    expect(r.items[0]!.k).toBe(100);
    for (const i of [1, 2] as const) {
      const el = r.items[i]!; // fully generated, no override
      expect(typeof el.k).toBe("number");
      expect(typeof el.v).toBe("string");
      expect(el.v.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// B134-R4 — sibling-visibility: a later field's matcher reading
// ctx.current.<earlierSibling> sees the override-applied value of the earlier
// overridden sibling (the override is applied at the per-field site, before
// later siblings resolve).
// ---------------------------------------------------------------------------

describe("B134-R4: a later matcher reads the override-applied value of an earlier sibling", () => {
  const Schema = z.object({
    label: z.string(),
    summary: z.string(),
  });

  it("B134-R4 / matcher reads override-applied earlier sibling", () => {
    const world = createWorld({ seed: 1 }).withSchema(Schema, {
      matchers: {
        summary: (ctx: GeneratorContext) =>
          `seen:${(ctx.current as { label?: string }).label ?? ""}`,
      },
    });

    const r = world.generate(Schema, { overrides: { label: "overridden" } });

    expect(r.label).toBe("overridden");
    expect(r.summary).toBe("seen:overridden");
  });
});

// ---------------------------------------------------------------------------
// B134-R5 — deepMerge array-as-leaf semantics are unchanged: a source array
// replaces the target array wholesale (B18). Asserting the runtime behaviour
// (a test cannot assert "file unchanged").
// ---------------------------------------------------------------------------

describe("B134-R5: deepMerge continues to treat arrays as leaves (B18 preserved)", () => {
  it("B134-R5 / deepMerge array source replaces target wholesale", () => {
    const result = deepMerge({ tags: ["a", "b", "c"] }, { tags: ["x", "y"] });
    expect(result).toEqual({ tags: ["x", "y"] });
  });
});

// ---------------------------------------------------------------------------
// B134-R6 — primitive-element array field: per-index override replaces its
// element, the schema length wins (no B12-R3 regression).
// ---------------------------------------------------------------------------

describe("B134-R6: primitive-element array field keeps positional replace, schema length governs", () => {
  const Schema = z.object({ tags: z.string().array().length(3) });

  it("B134-R6 / primitive-element array field, positional replace, schema length wins", () => {
    const world = createWorld({ seed: 1 }).withSchema(Schema);

    const r = world.generate(Schema, { overrides: { tags: ["alpha", "beta"] } });

    expect(r.tags.length).toBe(3);
    expect(r.tags[0]).toBe("alpha");
    expect(r.tags[1]).toBe("beta");
    expect(typeof r.tags[2]).toBe("string");
    expect(r.tags[2]!.length).toBeGreaterThan(0); // position 2 schema-generated
  });
});

// ---------------------------------------------------------------------------
// B134-R9 — regression test (the playground "failing overrides" repro):
// every element keeps exactly age/name/number, number is the override, and the
// generated age/name siblings are non-empty. This is the mandated bug
// regression test (D6).
// ---------------------------------------------------------------------------

describe("B134-R9: regression — partial { number } override keeps generated age and name", () => {
  const Schema = z.object({
    name: z.string(),
    nested: z
      .object({ age: z.number(), name: z.string(), number: z.number() })
      .array()
      .length(4),
  });

  it("B134-R9 / card repro — element keys are exactly age/name/number", () => {
    const world = createWorld({ seed: 1 }).withSchema(Schema);

    const r = world.generate(Schema, {
      overrides: { nested: Array.from({ length: 4 }, (_, number) => ({ number })) },
    });

    for (const i of [0, 1, 2, 3] as const) {
      const el = r.nested[i]!;
      expect(Object.keys(el).sort()).toEqual(["age", "name", "number"]);
      expect(el.number).toBe(i);
      expect(typeof el.age).toBe("number");
      expect(typeof el.name).toBe("string");
      expect(el.name.length).toBeGreaterThan(0);
    }
  });
});
