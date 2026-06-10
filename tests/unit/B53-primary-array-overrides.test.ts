/**
 * Unit tests for B53 — per-index `options.overrides` on primary-registered
 * array schemas MUST apply (deep-merge at field-level per record) instead of
 * throwing the B38 guard.
 *
 * Spec: wiki/specs/B53-primary-array-per-index-overrides.md
 *
 * Per the minimum-tests directive ([[feedback-minimal-tests]] + the spec's
 * test matrix): **5 behaviour tests** — R1, R2 split into two named scenarios
 * (short and long), R3, R4. R5 (D14 amendment), R6 (test-file delta), R7
 * (docs), R8 (changeset) are reviewer-only and NOT tested here.
 *
 * RED expectations today (pre-B53, post-B38):
 *   - All five tests FAIL today because the primary-array branch throws at
 *     src/world/engine.ts:1369-1374 the moment `options.overrides.length > 0`
 *     against a primary-registered inner schema:
 *
 *       "Per-index overrides on a primary-registered array schema are not
 *        supported on world.generate. Use world.populate(schema, count,
 *        factory) instead — see docs/api-reference.md → .populate."
 *
 *     B53 lifts the throw and routes `overrides[i]` through
 *     `generateAndStorePrimary({ overrides: overrides[i] })` per record —
 *     same field-level deep-merge `populate(S, N, factory)` already uses.
 *     After the implementer wires the two loops (store-on `while`, store-off
 *     `Array.from`), all 5 tests turn GREEN.
 *
 * Schemas constructed at module scope (D4 / D10 — determinism keyed on
 * schema reference identity). No `any`, no casts (D1). `.js` extensions on
 * relative imports (D1, Node16 ESM).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/index.js";

// ---------------------------------------------------------------------------
// Module-scoped fixture — the canonical Person schema the spec's GIVEN
// blocks reference. `id` uses `z.uuid()` so the key-based heuristic produces
// a stable non-empty string; `name` is a free `z.string()` (matcher / key
// heuristic / schema-based fallback chain) — the surface the override targets.
// ---------------------------------------------------------------------------

const Person = z.object({ id: z.uuid(), name: z.string() });

type PersonOverride = Partial<z.input<typeof Person>>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("B53: per-index overrides on primary-registered arrays", () => {
  // -------------------------------------------------------------------------
  // R1 — per-index overrides MUST apply to records freshly produced by the
  //      primary array branch; D8 (stored = returned) preserved by construction.
  // -------------------------------------------------------------------------

  it("B53-R1 / fresh primary array + overrides applied; D8 preserved", () => {
    // Spec §R1 scenario. RED today: the B38 guard at engine.ts:1369-1374
    // throws before any record is generated because
    // `options.overrides.length > 0` against a primary-registered inner.
    const world = createWorld({ seed: 1 }).withSchema(Person);

    const overrides: PersonOverride[] = [{ name: "alice" }, { name: "bob" }, { name: "carol" }];

    const result = world.generate(Person.array().length(3), { overrides });

    expect(result.length).toBe(3);
    expect(result[0]!.name).toBe("alice");
    expect(result[1]!.name).toBe("bob");
    expect(result[2]!.name).toBe("carol");

    // D8 — every returned record was stored before it was returned. The
    // field-level merge happens inside `generateAndStorePrimary` BEFORE
    // `registry.store`, so the registry view equals the returned array.
    expect(world.registry.all(Person)).toEqual(result);
  });

  // -------------------------------------------------------------------------
  // R2 — extra and short override arrays MUST follow ad-hoc / derived parity.
  //      Two scenarios per the spec's table — split into two tests.
  // -------------------------------------------------------------------------

  it("B53-R2 / override shorter than .length(N); override length wins (B136 supersedes tail)", () => {
    // B136 SUPERSEDES B53-R2's no-resize length rule: an override array now sets
    // the element count to `override.length`, winning over `.length(5)` — there
    // is no schema-generated tail.
    const world = createWorld({ seed: 1 }).withSchema(Person);

    const overrides: PersonOverride[] = [{ name: "a" }, { name: "b" }];

    const result = world.generate(Person.array().length(5), { overrides });

    expect(result.length).toBe(2); // B136: 2-entry override wins over .length(5)
    expect(result[0]!.name).toBe("a");
    expect(result[1]!.name).toBe("b");
  });

  it("B53-R2 / override longer than .length(N); override length wins (B136 supersedes drop)", () => {
    // B136 SUPERSEDES B53-R2's no-resize length rule: the extras are no longer
    // dropped — the override length wins over `.length(2)`.
    const world = createWorld({ seed: 1 }).withSchema(Person);

    const overrides: PersonOverride[] = [{ name: "x" }, { name: "y" }, { name: "z" }];

    const result = world.generate(Person.array().length(2), { overrides });

    expect(result.length).toBe(3); // B136: 3-entry override wins over .length(2)
    expect(result[0]!.name).toBe("x");
    expect(result[1]!.name).toBe("y");
    expect(result[2]!.name).toBe("z");
  });

  // -------------------------------------------------------------------------
  // R3 — pre-existing records MUST be returned untouched; overrides apply
  //      only to records produced by this call (positions
  //      [existingCount, target)). Pinned by the spec's R3 resolution under
  //      D8 (re-fetching pre-existing records with overrides would either
  //      diverge stored vs returned or mutate the registry — both rejected).
  // -------------------------------------------------------------------------

  it("B53-R3 / pre-existing records returned untouched; overrides apply to fresh tail", () => {
    // Spec §R3 scenario. RED today: throws on entry (B38 guard).
    // Post-B53: positions 0-2 byte-equal `pre[0..2]` (registry-stored, no
    // override applied), positions 3-5 carry `overrides[3..5]` (the override
    // array is indexed in the returned array's coordinate system — slots
    // < existingCount are ignored).
    const world = createWorld({ seed: 1 }).withSchema(Person);

    world.populate(Person, 3);
    const pre = world.registry.all(Person);

    const overrides: PersonOverride[] = [
      { name: "a" },
      { name: "b" },
      { name: "c" },
      { name: "d" },
      { name: "e" },
      { name: "f" },
    ];

    const result = world.generate(Person.array().length(6), { overrides });

    expect(result.length).toBe(6);

    // Head — pre-existing records returned untouched (override slots 0..2
    // never consulted; the records the registry stored at populate time).
    expect(result.slice(0, 3)).toEqual(pre.slice(0, 3));

    // Tail — overrides at indices 3..5 apply to records produced by the loop.
    expect(result[3]!.name).toBe("d");
    expect(result[4]!.name).toBe("e");
    expect(result[5]!.name).toBe("f");

    // Registry grew to target; D8 — stored equals returned.
    expect(world.registry.count(Person)).toBe(6);
    expect(world.registry.all(Person)).toEqual(result);
  });

  // -------------------------------------------------------------------------
  // R4 — `options.transform` MUST run after overrides; the transform sees
  //      the override-merged record on every position (override-carrying
  //      and override-free alike).
  // -------------------------------------------------------------------------

  it("B53-R4 / overrides + transform composition; transform sees the override-merged record", () => {
    // Spec §R4 scenario. RED today: throws on entry (B38 guard).
    // Post-B53: cap → overrides → transform (D14). Position 0 carries the
    // override AND the transform; position 1 has no override but still goes
    // through the transform. NOTE: the engine applies `options.transform`
    // per-element (`result.map(options.transform as any)`) on the primary
    // arm at engine.ts:1420-1424, mirroring B52-R3's test shape.
    const world = createWorld({ seed: 1 }).withSchema(Person);

    type PersonHidden = z.input<typeof Person> & { hidden: boolean };
    const perElementTransform = (p: z.input<typeof Person>): PersonHidden => ({
      ...p,
      hidden: true,
    });

    const overrides: PersonOverride[] = [{ name: "x" }];

    const result = world.generate(Person.array().length(2), {
      overrides,
      transform: perElementTransform as unknown as (
        data: z.input<typeof Person>[],
      ) => z.input<typeof Person>[],
    });

    // B136: the 1-entry override sets the length to 1 (wins over .length(2));
    // the cap → overrides → transform sequence (D14) is unchanged — the
    // transform still sees the override-merged record.
    expect(result.length).toBe(1);

    expect(result[0]!.name).toBe("x");
    expect((result[0] as unknown as PersonHidden).hidden).toBe(true);
  });
});
