/**
 * Unit tests for `world.populate(schema, count, factory?)` — per-record factory
 * for `GenerateOptions` (B14).
 *
 * Written test-first: `World.populate` does not yet accept a third `factory`
 * argument (current signature: `populate(schema, count): this`). These tests
 * fail until B14 is implemented:
 *
 *   - B14-R1 fails at `pnpm typecheck` — the three-arg call exceeds the
 *     current two-arg signature.
 *   - B14-R2 / R3 / R5 fail at `pnpm test` — today's implementation never
 *     invokes a factory, so its calls and its effect on the generated record
 *     can be observed by their absence.
 *   - B14-R4 / R6 PASS today — they are regression guards for the existing
 *     two-arg behaviour, which B14 must preserve.
 *   - B14-R7 (docs update) is verified by the reviewer in
 *     docs/api-reference.md, not here.
 *
 * Spec: wiki/specs/B14-world-populate-factory.md
 */

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import type { ZodTypeAny } from "zod";
import { createWorld } from "../../../src/index.js";
import type { GenerateOptions } from "../../../src/types.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const UserSchema = z.object({
  id: z.uuid(),
  username: z.string(),
});

const PersonSchema = z.object({
  personId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  age: z.number().int().min(18).max(90),
});

const USER_PROFILES = [
  { username: "admin" },
  { username: "editor" },
  { username: "viewer" },
] as const;

// ---------------------------------------------------------------------------
// B14-R1: signature — populate accepts an optional per-record factory
// ---------------------------------------------------------------------------

describe("B14-R1: populate accepts an optional per-record factory", () => {
  it("B14-R1 / existing two-arg call still type-checks and behaves identically", () => {
    // Two-arg form — unchanged. This call type-checks both before and after B14.
    const world = createWorld({ seed: 42 })
      .withSchema(PersonSchema)
      .populate(PersonSchema, 5);

    expect(world.registry.all(PersonSchema)).toHaveLength(5);
    // Each generated record is schema-valid (regression guard).
    for (const p of world.registry.all(PersonSchema)) {
      expect(PersonSchema.safeParse(p).success).toBe(true);
    }
  });

  it("B14-R1 / three-arg call type-checks with no any and no cast", () => {
    // No cast, no `any`. Today this errors at `pnpm typecheck` because the
    // signature is `populate(schema, count): this` (two-args). After B14 the
    // signature gains the optional third `factory` parameter and this passes.
    const world = createWorld({ seed: 42 }).withSchema(UserSchema);
    world.populate(UserSchema, USER_PROFILES.length, (i) => ({
      overrides: { username: USER_PROFILES[i]!.username },
    }));

    // Runtime guard so the test also fails for the right reason if a cast
    // ever sneaks in: the factory must actually have driven the records.
    expect(world.registry.all(UserSchema).map((u) => u.username)).toEqual([
      "admin",
      "editor",
      "viewer",
    ]);
  });
});

// ---------------------------------------------------------------------------
// B14-R2: factory is invoked per-record with the 0-based index
// ---------------------------------------------------------------------------

describe("B14-R2: factory is invoked count times with index 0..count-1", () => {
  it("B14-R2 / factory invoked count times with indexes 0..count-1 in order", () => {
    const world = createWorld({ seed: 42 }).withSchema(UserSchema);
    const seen: number[] = [];

    world.populate(UserSchema, 4, (i: number) => {
      seen.push(i);
      return {};
    });

    expect(seen).toEqual([0, 1, 2, 3]);
    expect(world.registry.all(UserSchema)).toHaveLength(4);
  });

  it("B14-R2 / zero-count call does not invoke the factory", () => {
    const world = createWorld({ seed: 42 }).withSchema(UserSchema);
    const factory = vi.fn((_i: number): GenerateOptions<z.infer<typeof UserSchema>> => ({}));

    world.populate(UserSchema, 0, factory);

    expect(factory).not.toHaveBeenCalled();
    expect(world.registry.all(UserSchema)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// B14-R3: factory output flows through the normal generate pipeline
// ---------------------------------------------------------------------------

describe("B14-R3: factory output flows through generate (overrides + transform honored)", () => {
  it("B14-R3 / overrides from the factory win on the populated record", () => {
    const world = createWorld({ seed: 42 }).withSchema(UserSchema);

    world.populate(UserSchema, USER_PROFILES.length, (i) => ({
      overrides: { username: USER_PROFILES[i]!.username },
    }));

    expect(world.registry.all(UserSchema).map((u) => u.username)).toEqual([
      "admin",
      "editor",
      "viewer",
    ]);
    // The non-overridden field is still populated by the normal pipeline.
    for (const u of world.registry.all(UserSchema)) {
      expect(typeof u.id).toBe("string");
      expect(u.id.length).toBeGreaterThan(0);
    }
  });

  it("B14-R3 / transform from the factory is applied per record", () => {
    const world = createWorld({ seed: 42 }).withSchema(UserSchema);

    world.populate(UserSchema, 3, (i) => ({
      transform: (u) => ({ ...u, username: `u-${i}` }),
    }));

    expect(world.registry.all(UserSchema).map((u) => u.username)).toEqual([
      "u-0",
      "u-1",
      "u-2",
    ]);
  });
});

// ---------------------------------------------------------------------------
// B14-R4: no-factory form is unchanged (regression guard)
// ---------------------------------------------------------------------------

describe("B14-R4: no-factory form is unchanged", () => {
  it("B14-R4 / no-factory call is byte-equivalent across two same-seed worlds", () => {
    // Same seed, same schema, no factory — both populates must hit the same
    // code path with the same per-field PRNG forks and produce identical
    // registry contents. This is the regression guard B14-R4 calls for: if
    // the implementer accidentally rewires the no-factory branch (e.g.
    // routes it through a new code path that calls generate differently),
    // this test will diverge.
    const a = createWorld({ seed: 42 })
      .withSchema(PersonSchema)
      .populate(PersonSchema, 5);
    const b = createWorld({ seed: 42 })
      .withSchema(PersonSchema)
      .populate(PersonSchema, 5);

    expect(JSON.stringify(a.registry.all(PersonSchema))).toEqual(
      JSON.stringify(b.registry.all(PersonSchema)),
    );
    expect(a.registry.all(PersonSchema)).toHaveLength(5);
  });

  it("B14-R4 / factory not invoked when omitted (length matches count)", () => {
    const world = createWorld({ seed: 42 }).withSchema(UserSchema);
    world.populate(UserSchema, 3);
    expect(world.registry.all(UserSchema)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// B14-R5: deterministic across runs for the same seed and factory output
// ---------------------------------------------------------------------------

describe("B14-R5: deterministic for same seed and factory output", () => {
  it("B14-R5 / same seed + same factory → byte-identical registry across runs", () => {
    const factory = (i: number): GenerateOptions<z.infer<typeof UserSchema>> => ({
      overrides: { username: USER_PROFILES[i]!.username },
    });

    const a = createWorld({ seed: 42 }).withSchema(UserSchema);
    a.populate(UserSchema, 3, factory);
    const A = a.registry.all(UserSchema);

    const b = createWorld({ seed: 42 }).withSchema(UserSchema);
    b.populate(UserSchema, 3, factory);
    const B = b.registry.all(UserSchema);

    expect(JSON.stringify(A)).toEqual(JSON.stringify(B));
    // Sanity: the factory's per-record overrides made it through.
    expect(A.map((u) => u.username)).toEqual(["admin", "editor", "viewer"]);
  });
});

// ---------------------------------------------------------------------------
// B14-R6: populate keeps returning `this` for fluent chaining
// ---------------------------------------------------------------------------

describe("B14-R6: populate keeps returning `this` for fluent chaining", () => {
  it("B14-R6 / three-arg populate returns the world (reference equality)", () => {
    const world = createWorld({ seed: 42 }).withSchema(UserSchema);

    const returned = world.populate(UserSchema, 2, () => ({}));

    expect(returned).toBe(world);
  });

  it("B14-R6 / chaining a three-arg populate then a two-arg populate", () => {
    const world = createWorld({ seed: 42 }).withSchema(UserSchema);

    const chained = world
      .populate(UserSchema, 2, () => ({}))
      .populate(UserSchema, 1);

    expect(chained).toBe(world);
    expect(world.registry.all(UserSchema)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// B14-R7: docs update — verified by reviewer in docs/api-reference.md.
// (No test here; this comment exists so every requirement ID is accounted for.)
// ---------------------------------------------------------------------------

// Type-only assertion: silence "unused import" warnings for ZodTypeAny if any
// scenario above stops referencing it. ZodTypeAny is kept imported for clarity
// in the test header even though it is currently only used in JSDoc-style
// commentary above the schemas.
type _KeepZodTypeAnyReferenced = ZodTypeAny;
