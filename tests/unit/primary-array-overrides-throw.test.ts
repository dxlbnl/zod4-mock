/**
 * Unit tests for B38 — `world.generate(primaryArraySchema, { overrides })`
 * silently drops per-index overrides on a primary-registered inner schema.
 *
 * Written test-first against the spec
 * (wiki/specs/B38-primary-array-overrides-dropped.md). The chosen direction
 * is **C + D**: throw loudly when the caller passes a non-empty
 * `overrides` array against a primary-registered inner, and redirect to
 * `world.populate(schema, count, factory)` in the error message and docs.
 *
 * This file is the regression test mandated by B38-R5 / D6: the B38-R5
 * scenario reproduces the exact #22 repro and asserts the first iteration
 * throws an `Error` whose message names
 * `world.populate(schema, count, factory)`.
 *
 * Today (0.7.1) — pre-B38 — the situation per `src/world.ts` lines 968–984:
 *   if (primaryRegs.length > 0) {
 *     const reg = primaryRegs[0]!;
 *     const existingCount = this.registry.count(innerSchema);
 *     const target = Math.max(existingCount, genPrng.int(...));
 *     while (this.registry.count(innerSchema) < target) {
 *       this.generateAndStorePrimary(innerSchema, reg);
 *       //   ↑ no options, no overrides, no per-position info
 *     }
 *     return this.registry.all(innerSchema);
 *   }
 * Two compounded silent-no-op effects:
 *   (1) per-index overrides never reach the field generator;
 *   (2) `existingCount` short-circuits the top-up loop on subsequent calls.
 *
 * Spec-mandated requirements (R6/R7 are reviewer-only):
 *  - B38-R1: throw when per-index overrides target a primary-registered
 *    array. Two scenarios:
 *      * minimal repro — throws, message names `world.populate(schema,
 *        count, factory)`, AND registry.count === 0 afterwards (no partial
 *        write). RED today — the call returns silently, no throw.
 *      * error message is actionable — `err instanceof Error` and
 *        `err.message.includes("world.populate(schema, count, factory)")`.
 *        RED today — no error is thrown to inspect.
 *  - B38-R2: empty / absent overrides keep today's behaviour
 *    byte-equivalent. Two scenarios:
 *      * no-options primary-array call is byte-equivalent to an
 *        independent same-seed call. GREEN today — pre-fix guard
 *        (B38 must not regress this; it stays green after the fix).
 *      * explicit empty overrides array does not throw and produces the
 *        requested count. GREEN today — pre-fix guard.
 *  - B38-R3: ad-hoc (unregistered) array branch unchanged. Two scenarios:
 *      * ad-hoc array with per-index object overrides still applies
 *        `deepMerge(item, overrides[i])` per element (B12 semantics).
 *        GREEN today — pre-fix guard.
 *      * ad-hoc array with primitive-array override returns the overrides
 *        verbatim (B12 primitive-replace pinning). GREEN today — pre-fix
 *        guard.
 *  - B38-R4: `world.populate(schema, count, factory)` is unaffected
 *    (B14-R3 regression check). GREEN today — pre-fix guard.
 *  - B38-R5: regression test pinning the exact #22 repro. RED today —
 *    today's silent failure has the loop complete with
 *    `registry.count === 4`; after B38 the first iteration throws.
 *  - B38-R6: docs update. Reviewer-only; not tested here.
 *  - B38-R7: changeset. Reviewer-only; not tested here.
 *
 * No `any`, no casts (architecture Rules D1). `z.infer<typeof Schema>` is
 * used for typed result values.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures — the exact #22 schema (per B38-R1 / B38-R5's GIVEN block).
// ---------------------------------------------------------------------------

const ProductSchema = z.object({
  id: z.uuid(),
  category: z.enum(["alpha", "bravo", "charlie"]),
  name: z.string(),
});

// A simpler primary schema used by B38-R2's byte-equivalence guard. No enum,
// so the baseline capture is robust to enum-order changes elsewhere.
const SimpleProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

// ---------------------------------------------------------------------------
// B38-R1: throw when per-index overrides target a primary-registered array
// ---------------------------------------------------------------------------

describe("B38-R1: throw when per-index overrides target a primary-registered array", () => {
  it("B38-R1 / minimal repro — primary-array with per-index overrides throws", () => {
    const world = createWorld({ seed: 1 }).withSchema(ProductSchema);

    // Sanity: registry is empty before the call.
    expect(world.registry.count(ProductSchema)).toBe(0);

    const overrides: Array<{ category: "alpha" }> = Array.from({ length: 4 }, () => ({
      category: "alpha" as const,
    }));

    // RED today: the call returns silently and writes 4 (un-overridden)
    // records. Post-B38: the call throws BEFORE any record is generated.
    expect(() => world.generate(ProductSchema.array().min(4).max(4), { overrides })).toThrow(
      /world\.populate\(schema, count, factory\)/,
    );

    // No partial write — the throw fires at the top of the branch, before
    // any record is generated. (Today, this assertion ALSO fails: the
    // silent path writes 4 records.)
    expect(world.registry.count(ProductSchema)).toBe(0);
  });

  it("B38-R1 / error message is actionable (names the right API)", () => {
    const world = createWorld({ seed: 1 }).withSchema(ProductSchema);

    const overrides: Array<{ category: "alpha" }> = Array.from({ length: 4 }, () => ({
      category: "alpha" as const,
    }));

    let caught: unknown;
    try {
      world.generate(ProductSchema.array().min(4).max(4), { overrides });
    } catch (err) {
      caught = err;
    }

    // RED today: nothing is thrown, so `caught` is `undefined`.
    expect(caught).toBeDefined();
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("world.populate(schema, count, factory)");
  });
});

// ---------------------------------------------------------------------------
// B38-R2: empty / absent overrides keep today's behaviour byte-equivalent
//   GUARD today — both scenarios are expected to pass on the current
//   (pre-fix) code, and must continue to pass after B38.
// ---------------------------------------------------------------------------

describe("B38-R2: empty / absent overrides keep today's behaviour byte-equivalent", () => {
  it("B38-R2 / no-options primary-array call is byte-equivalent across identically-seeded worlds (GUARD)", () => {
    // Two independent worlds, same seed, same registration order, same call.
    const a = createWorld({ seed: 1 }).withSchema(SimpleProductSchema);
    const A = JSON.stringify(a.generate(SimpleProductSchema.array().min(4).max(4)));

    const b = createWorld({ seed: 1 }).withSchema(SimpleProductSchema);
    const B = JSON.stringify(b.generate(SimpleProductSchema.array().min(4).max(4)));

    // No throw on either side, and the two captures are byte-identical.
    expect(A).toBe(B);
    expect(a.registry.count(SimpleProductSchema)).toBe(4);
    expect(b.registry.count(SimpleProductSchema)).toBe(4);
  });

  it("B38-R2 / explicit empty overrides array does not throw and produces the requested count (GUARD)", () => {
    const world = createWorld({ seed: 1 }).withSchema(SimpleProductSchema);

    // Empty array — the bug only manifests when `overrides.length > 0`.
    // Today this never enters a throw branch; post-B38 the guard for
    // `overrides.length > 0` keeps this path unchanged.
    expect(() =>
      world.generate(SimpleProductSchema.array().min(4).max(4), {
        overrides: [],
      }),
    ).not.toThrow();

    expect(world.registry.count(SimpleProductSchema)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// B38-R3: ad-hoc (unregistered) array branch unchanged
//   GUARD today — both scenarios are expected to pass on the current
//   (pre-fix) code, and must continue to pass after B38.
// ---------------------------------------------------------------------------

describe("B38-R3: ad-hoc array branch keeps per-element deepMerge semantics", () => {
  it("B38-R3 / ad-hoc array with per-index object overrides still works (GUARD)", () => {
    // Unregistered schema — NO `withSchema(Item)` call.
    const Item = z.object({ id: z.string(), label: z.string() });
    const world = createWorld({ seed: 1 });

    const items: z.infer<typeof Item>[] = world.generate(Item.array().length(3), {
      overrides: [{ label: "first" }, { label: "second" }, { label: "third" }],
    });

    expect(items).toHaveLength(3);
    expect(items.map((it) => it.label)).toEqual(["first", "second", "third"]);
    // Sibling field `id` is preserved on each element — non-empty string from
    // the schema-based generator.
    for (const it of items) {
      expect(typeof it.id).toBe("string");
      expect(it.id.length).toBeGreaterThan(0);
    }
  });

  it("B38-R3 / ad-hoc array with primitive-array override does not throw (GUARD)", () => {
    // Unregistered primitive-element array — pinned by B12-R3 primitive-replace.
    const Tags = z.string().array().length(2);
    const world = createWorld({ seed: 1 });

    let result: z.infer<typeof Tags> | undefined;
    expect(() => {
      result = world.generate(Tags, { overrides: ["alpha", "beta"] });
    }).not.toThrow();

    expect(result).toEqual(["alpha", "beta"]);
  });
});

// ---------------------------------------------------------------------------
// B38-R4: `world.populate(schema, count, factory)` is unaffected
//   GUARD today — this is the B14-R3 regression check. The B38 fix sits in
//   `generateArray`, which `populate` does not call; this path must stay
//   green before and after the fix.
// ---------------------------------------------------------------------------

describe("B38-R4: world.populate(schema, count, factory) is unaffected", () => {
  it("B38-R4 / populate with factory overrides per record (B14-R3 regression check, GUARD)", () => {
    const world = createWorld({ seed: 1 }).withSchema(ProductSchema);

    // The repro's intent expressed via `populate` — the recommended workaround
    // named by B38-R1's error message.
    for (const category of ["alpha", "bravo", "charlie"] as const) {
      world.populate(ProductSchema, 4, () => ({ overrides: { category } }));
    }

    expect(world.registry.count(ProductSchema)).toBe(12);
    expect(world.registry.all(ProductSchema).map((p) => p.category)).toEqual([
      "alpha",
      "alpha",
      "alpha",
      "alpha",
      "bravo",
      "bravo",
      "bravo",
      "bravo",
      "charlie",
      "charlie",
      "charlie",
      "charlie",
    ]);
  });
});

// ---------------------------------------------------------------------------
// B38-R5: regression test pinning the exact #22 repro (D6)
//   RED today — today's silent failure has the three-category loop complete
//   with `registry.count(ProductSchema) === 4`. After B38 the first
//   iteration throws an `Error` whose message names
//   `world.populate(schema, count, factory)`.
// ---------------------------------------------------------------------------

describe("B38-R5: regression test pinning the exact #22 repro", () => {
  it("B38-R5 / exact #22 repro — first iteration throws naming world.populate(schema, count, factory)", () => {
    // The exact code from #22's body — `Array.from({ length: 4 }, () => ({ category }))`
    // overrides over `ProductSchema.array().min(4).max(4)` against a registered inner.
    const world = createWorld({ seed: 1 });
    world.withSchema(ProductSchema);

    expect(world.registry.count(ProductSchema)).toBe(0);

    // Pre-B38 behaviour (the silent failure): the for-loop completes silently
    // and `world.registry.count(ProductSchema) === 4` afterwards — none of the
    // 4 records carry the caller-supplied `category`. Post-B38: iteration 1
    // throws and the loop never reaches iteration 2.
    expect(() => {
      for (const category of ["alpha", "bravo", "charlie"] as const) {
        world.generate(ProductSchema.array().min(4).max(4), {
          overrides: Array.from({ length: 4 }, () => ({ category })),
        });
      }
    }).toThrow(/world\.populate\(schema, count, factory\)/);
  });
});

// ---------------------------------------------------------------------------
// B38-R6 — docs update. Reviewer-only; verified in `docs/api-reference.md`.
// B38-R7 — changeset entry. Reviewer-only; verified in `.changeset/`.
// ---------------------------------------------------------------------------
