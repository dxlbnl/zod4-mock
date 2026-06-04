/**
 * B97-R3 — mutable-holder contract for the lazy bindGenerators.
 *
 * Tests-first RED file. The spec ([spec §"Mutable-holder lifetime and
 * invariants"](../../../wiki/specs/B97-fix-eager-bindgenerators-perf-regression.md))
 * states that bound closures read their `prng`/`ctx` from a mutable holder
 * at *call time*, not at bind time. This file proves that contract end-to-
 * end through public-API matchers:
 *
 *   - GIVEN a populate(N) call,
 *     each record's matcher MUST see the correct per-field `ctx.fieldPath`
 *     (which varies per field/record). If the closures captured the holder
 *     snapshot at bind time, every record would see a stale path.
 *
 *   - GIVEN a multi-field schema whose matcher calls `ctx.gen.string.uuid()`
 *     on every field, all field UUIDs MUST differ — i.e. each field's
 *     closure call resolved against the field-seeded PRNG (not a stale
 *     bind-time prng).
 *
 * Both assertions PASS post-fix (lazy holder is read at call time). Pre-fix
 * the eager bind already creates a fresh closure per field, so a naïve pass
 * is possible — but the closures pre-fix capture the *materialised* `prng`
 * at bind time per field. The lazy holder shape is what the assertions
 * encode. The R3 test failure today comes from a different angle: the
 * `__bindCount` instrumentation seam doesn't exist (covered in
 * `bind-generators-lazy.test.ts`); this file additionally asserts the
 * call-time-read contract that the implementer must build into the holder.
 *
 * Failure mode today (pre-fix): there is no holder; closures wrap the
 * per-field `prng` directly. Once the implementer introduces the
 * `{ prng, ctx }` holder pattern, this test re-confirms that the holder
 * mutation is observable through public-API matcher calls.
 *
 * NOTE on the assertions: the test deliberately reads observable behaviour
 * (matchers' view of `ctx.fieldPath`, distinct UUIDs from a single
 * `string.uuid` namespace call) rather than reaching into the holder's
 * internals. The holder is an implementation detail; what matters is that
 * the closures resolve correctly per field/record at call time.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import type { MatcherCtx } from "../../../src/types.js";

// ---------------------------------------------------------------------------
// Holder lifetime: per-record fieldPath visibility
// ---------------------------------------------------------------------------

describe("B97-R3 / closures read the holder at call time — fieldPath per record", () => {
  it("B97-R3 / populate(5) — each record's matcher sees its own fieldPath", () => {
    const Schema = z.object({
      tag: z.string(),
    });

    const seenFieldPaths: string[] = [];

    const world = createWorld({ seed: 1 }).withSchema(Schema, {
      matchers: {
        tag: (ctx: MatcherCtx) => {
          seenFieldPaths.push(ctx.fieldPath);
          return "x";
        },
      },
    });

    world.populate(Schema, 5);

    // Five records → five distinct field paths, all ending in ".tag" and
    // each carrying a different record id. Pre-fix the eager bind still
    // honours this because makeFieldCtx is rebuilt per field, so this
    // passes. Post-fix, the lazy holder MUST preserve this behaviour —
    // any holder-read regression flips this assertion.
    expect(seenFieldPaths).toHaveLength(5);
    for (const path of seenFieldPaths) {
      expect(path.endsWith(".tag") || path === "tag").toBe(true);
    }
    // Five distinct fieldPaths — the record id varies per record.
    const unique = new Set(seenFieldPaths);
    expect(unique.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Per-field PRNG threading: distinct UUIDs across same-namespace calls
// ---------------------------------------------------------------------------

describe("B97-R3 / per-field PRNG threading — no closure-bound prng leak", () => {
  it("B97-R3 / multi-field matcher calling ctx.gen.string.uuid() produces distinct UUIDs per field", () => {
    const MultiField = z.object({
      a: z.string(),
      b: z.string(),
      c: z.string(),
      d: z.string(),
      e: z.string(),
    });

    const world = createWorld({ seed: 1 }).withSchema(MultiField, {
      matchers: {
        a: (ctx: MatcherCtx) => ctx.gen.string.uuid(),
        b: (ctx: MatcherCtx) => ctx.gen.string.uuid(),
        c: (ctx: MatcherCtx) => ctx.gen.string.uuid(),
        d: (ctx: MatcherCtx) => ctx.gen.string.uuid(),
        e: (ctx: MatcherCtx) => ctx.gen.string.uuid(),
      },
    });

    const record = world.generate(MultiField, { store: false });
    const uuids = [record.a, record.b, record.c, record.d, record.e];

    // All five must be strings.
    for (const u of uuids) {
      expect(typeof u).toBe("string");
      expect(u).toMatch(/^[0-9a-f-]{36}$/i);
    }

    // All five must differ — if the closures captured a stale prng at
    // bind time (e.g. the first field's prng), some UUIDs would collide.
    const unique = new Set(uuids);
    expect(unique.size).toBe(5);
  });
});
