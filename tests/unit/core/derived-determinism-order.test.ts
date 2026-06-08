/**
 * Unit / regression tests for B130 — derived-record determinism is coupled to
 * registration order, not schema reference identity.
 *
 * Written test-first against the spec
 * (wiki/specs/B130-derived-determinism-coupled-to-registration-order.md). The
 * defect: a `from:`-derived schema's field PRNG seed is `dreg<regId>#<index>`,
 * where `regId` is the *registration ordinal*. Inserting an unrelated
 * `withSchema(...)` before the derived schema bumps its `regId`, reseeds its
 * field PRNG, and silently shifts every non-source field it generates — even
 * though the derived schema, its source, and the seed are all identical. This
 * violates the binding determinism Rule (D4/D10): "call order across distinct
 * schemas MUST NOT affect any value."
 *
 * Determinism keys on schema **reference identity**, not structural equality,
 * so EVERY schema used for a cross-world / cross-run equality assertion is
 * constructed ONCE at module scope and reused. (The earlier confounded B130
 * repro used fresh-schema-per-call, which is a reference-identity artifact, not
 * the order-dependence defect.)
 *
 * Per requirement:
 *  - B130-R1 (regression, D6): inserting an unrelated earlier `withSchema(...)`
 *    MUST NOT change a derived record. RED before the fix (`run(false)` !==
 *    `run(true)` because the prior registration bumped `Derived`'s `regId`).
 *  - B130-R2: same module-scope `Derived` registered at different positions
 *    (2nd vs 4th) across two same-seed worlds produces byte-identical output.
 *    RED before the fix.
 *  - B130-R4 (green guard): distinct source records still yield distinct
 *    derived non-source values — the `#<sourceIndex>` suffix differentiates.
 *  - B130-R5 (green guard): B8 upsert idempotence — `generate(D,{source})`
 *    twice returns `===`, count stays 1; `{unique:false}` yields distinct.
 *  - B130-R6 (green guard): `populateFrom` yields one derived record per source
 *    and is byte-equivalent across two same-seed same-builder-chain worlds.
 *  - B130-R7 IS this file (the regression test the bug requires).
 *
 * No `any`, no casts (per architecture Rules D1).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures — constructed ONCE at module scope so reference identity is
// stable across worlds / runs. Each derived schema includes a non-source field
// the PRNG fills (`label` / `note` / `tag` / `bio`), which is the observable
// that shifts under the bug.
// ---------------------------------------------------------------------------

// B130-R1 / B130-R7 — the item card's order-based reproduction.
const Parent = z.object({ id: z.string() });
const Derived = z.object({ pid: z.string(), label: z.string() });

// B130-R2 — different registration positions across worlds.
const Source2 = z.object({ id: z.string() });
const Derived2 = z.object({ sid: z.string(), note: z.string() });

// B130-R4 — distinct source indices stay distinct.
const Source4 = z.object({ id: z.string() });
const Derived4 = z.object({ sid: z.string(), tag: z.string() });

// B130-R5 — B8 upsert idempotence preserved.
const UserSchema = z.object({ id: z.uuid(), email: z.string() });
const UserProfileSchema = z.object({ userId: z.uuid(), bio: z.string() });

// B130-R6 — populateFrom byte-equivalence across same-seed worlds.
const Source6 = z.object({ id: z.string() });
const Summary6 = z.object({ sid: z.string(), text: z.string() });

// ---------------------------------------------------------------------------
// B130-R1: derived output is independent of unrelated prior registrations
// (the canonical D6 regression, from the item card).
// ---------------------------------------------------------------------------

describe("B130-R1: an unrelated earlier registration does not change a derived record", () => {
  it("B130-R1 / unrelated earlier registration does not change a derived record", () => {
    const run = (insertEarlierReg: boolean): string => {
      const w = createWorld({ seed: 1 });
      if (insertEarlierReg) {
        // A DIFFERENT, unrelated schema registered BEFORE Derived — under the
        // bug this only bumps Derived's regId, reseeding its field PRNG.
        w.withSchema(z.object({ unrelated: z.string() }));
      }
      w.withSchema(Derived, {
        from: Parent,
        matchers: { pid: (c) => c.source.id },
      });
      w.populate(Parent, 1);
      const [p] = w.registry.all(Parent);
      return JSON.stringify(w.generate(Derived, { source: p! }));
    };

    // THEN: holding seed + Derived ref + Parent ref + source constant, the
    // derived record (its PRNG-filled `label`) must be byte-identical with and
    // without the unrelated earlier registration. RED before the fix: the
    // recordId `dreg<regId>#<index>` shifts because the earlier registration
    // bumped Derived's regId.
    expect(run(false)).toBe(run(true));
  });
});

// ---------------------------------------------------------------------------
// B130-R2: two worlds register the same derived schema at different positions
// (2nd vs 4th) and produce byte-identical derived data.
// ---------------------------------------------------------------------------

describe("B130-R2: derived data matches across worlds with different registration positions", () => {
  it("B130-R2 / same derived schema at different registration positions yields identical output", () => {
    // worldA: Derived2 registered 2nd.
    const worldA = createWorld({ seed: 7 })
      .withSchema(Source2)
      .withSchema(Derived2, {
        from: Source2,
        matchers: { sid: (c) => c.source.id },
      });

    // worldB: Derived2 registered 4th (two unrelated registrations before it).
    const worldB = createWorld({ seed: 7 })
      .withSchema(Source2)
      .withSchema(z.object({ x: z.string() }))
      .withSchema(z.object({ y: z.string() }))
      .withSchema(Derived2, {
        from: Source2,
        matchers: { sid: (c) => c.source.id },
      });

    worldA.populate(Source2, 1);
    worldB.populate(Source2, 1);

    const sourceA = worldA.registry.all(Source2)[0]!;
    const sourceB = worldB.registry.all(Source2)[0]!;
    // Same seed + same Source2 ref → byte-identical source on both worlds.
    expect(JSON.stringify(sourceA)).toBe(JSON.stringify(sourceB));

    const a = worldA.generate(Derived2, { source: sourceA });
    const b = worldB.generate(Derived2, { source: sourceB });

    // THEN: byte-identical — Derived2's `note` does not depend on its
    // registration position. RED before the fix (regId differs: 2nd vs 4th).
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

// ---------------------------------------------------------------------------
// B130-R4 (green guard): #<sourceIndex> suffix preserved — distinct source
// indices stay distinct. Passes today; must stay green after the fix.
// ---------------------------------------------------------------------------

describe("B130-R4: distinct source records produce distinct derived field values", () => {
  it("B130-R4 / two source records draw from distinct field PRNGs (suffix differentiates)", () => {
    const world = createWorld({ seed: 3 })
      .withSchema(Source4)
      .withSchema(Derived4, {
        from: Source4,
        matchers: { sid: (c) => c.source.id },
      });

    world.populate(Source4, 2);
    const [s0, s1] = world.registry.all(Source4);

    const a = world.generate(Derived4, { source: s0!, unique: false });
    const b = world.generate(Derived4, { source: s1!, unique: false });

    // Two distinct sources → distinct sids (matcher) and distinct PRNG-filled tags.
    expect(a.sid).not.toBe(b.sid);
    expect(a.tag).not.toBe(b.tag);
  });
});

// ---------------------------------------------------------------------------
// B130-R5 (green guard): B8 per-pair upsert idempotence + { unique: false }.
// ---------------------------------------------------------------------------

describe("B130-R5: B8 upsert idempotence and identity contract are unaffected", () => {
  it("B130-R5 / same-source upsert returns the same instance (count stays 1)", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(UserSchema)
      .withSchema(UserProfileSchema, {
        from: UserSchema,
        matchers: { userId: (ctx) => ctx.source.id },
      });
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const a = world.generate(UserProfileSchema, { source: user });
    const b = world.generate(UserProfileSchema, { source: user });

    expect(a).toBe(b);
    expect(world.registry.count(UserProfileSchema)).toBe(1);
    expect(a.userId).toBe(user.id);
  });

  it("B130-R5 / { unique: false } still produces distinct fresh records (count grows by 2)", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(UserSchema)
      .withSchema(UserProfileSchema, {
        from: UserSchema,
        matchers: { userId: (ctx) => ctx.source.id },
      });
    world.populate(UserSchema, 1);
    const user = world.registry.pick(UserSchema);

    const before = world.registry.count(UserProfileSchema);
    const a = world.generate(UserProfileSchema, { source: user, unique: false });
    const b = world.generate(UserProfileSchema, { source: user, unique: false });

    expect(a).not.toBe(b);
    expect(world.registry.count(UserProfileSchema) - before).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// B130-R6 (green guard): populateFrom produces one derived record per source
// and is byte-equivalent across two same-seed same-builder-chain worlds.
// ---------------------------------------------------------------------------

describe("B130-R6: populateFrom produces one derived record per source, byte-equivalent across worlds", () => {
  it("B130-R6 / populateFrom yields count 3 and identical output across same-seed worlds", () => {
    const build = () =>
      createWorld({ seed: 9 })
        .withSchema(Source6)
        .withSchema(Summary6, {
          from: Source6,
          matchers: { sid: (c) => c.source.id },
        });

    const worldA = build();
    const worldB = build();

    worldA.populate(Source6, 3);
    worldB.populate(Source6, 3);

    worldA.populateFrom(Summary6, Source6);
    worldB.populateFrom(Summary6, Source6);

    expect(worldA.registry.count(Summary6)).toBe(3);
    expect(worldB.registry.count(Summary6)).toBe(3);

    // Byte-equivalent across two same-seed, same-builder-chain worlds.
    expect(JSON.stringify(worldA.registry.all(Summary6))).toBe(
      JSON.stringify(worldB.registry.all(Summary6)),
    );
  });
});
