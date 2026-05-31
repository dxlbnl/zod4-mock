/**
 * Unit tests for B47 — `WorldImpl.withSchema` MUST throw when the same schema
 * reference is registered as both primary (no `from:`) and derived (with
 * `from:`) on the same world. Order-invariant: primary-then-derived and
 * derived-then-primary both throw the same way.
 *
 * Spec: wiki/specs/B47-forbid-dual-primary-derived-registration.md
 *
 * Minimum-tests directive ([[feedback-minimal-tests]] + spec table):
 *   1. R1 + R2 — polarity mismatch throws in BOTH call orders (one test, two
 *      `expect(...).toThrow(Error)` assertions on two fresh worlds).
 *   2. R3 — same-polarity re-registration does NOT throw (two primary + two
 *      derived sub-cases in one test).
 *   3. R4 — relation-target / from-source / mixed-role appearances do NOT
 *      throw.
 *
 * `schemaRegs` is a private field on `WorldImpl`; the assertions on registry
 * length use a narrow structural type cast (no `any` — D1) so the test can
 * confirm the failed throw left state unchanged.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import type { World } from "../../../src/types.js";

// ---------------------------------------------------------------------------
// Reach-into helper — `schemaRegs` is private on `WorldImpl`. We read its
// length only (never write); the cast is the minimum needed to assert "the
// failed throw didn't mutate the registration list".
// ---------------------------------------------------------------------------

interface WorldWithRegs {
  readonly schemaRegs: ReadonlyArray<{ schema: unknown; from: unknown | null }>;
}

function regCount(world: World): number {
  return (world as unknown as WorldWithRegs).schemaRegs.length;
}

// ---------------------------------------------------------------------------
// Shared fixtures — schemas constructed at module scope (D4/D10: reference
// stability). Two fields each — the spec doesn't ask for more.
// ---------------------------------------------------------------------------

const Person = z.object({ id: z.uuid(), name: z.string() });
const Company = z.object({ id: z.uuid(), name: z.string() });
const Org = z.object({ id: z.uuid(), name: z.string() });
const Post = z.object({ id: z.uuid(), title: z.string() });
const Comment = z.object({ id: z.uuid(), postId: z.uuid() });
const Summary = z.object({ id: z.uuid(), title: z.string() });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("B47: forbid dual primary+derived registration", () => {
  it("B47-R1 + B47-R2 / polarity mismatch throws in both call orders", () => {
    // Order A: primary then derived — second call throws (R1).
    const worldA = createWorld({ seed: 1 });
    worldA.withSchema(Person);
    expect(regCount(worldA)).toBe(1);
    expect(() => worldA.withSchema(Person, { from: Company })).toThrow(Error);
    // The failed throw MUST leave `schemaRegs` unchanged — only the first,
    // accepted registration is present.
    expect(regCount(worldA)).toBe(1);

    // Order B: derived then primary — second call throws (R2). Same throw
    // rule observed from the opposite incoming polarity.
    const worldB = createWorld({ seed: 1 });
    worldB.withSchema(Person, { from: Company });
    expect(regCount(worldB)).toBe(1);
    expect(() => worldB.withSchema(Person)).toThrow(Error);
    expect(regCount(worldB)).toBe(1);
  });

  it("B47-R3 / same-polarity re-registration does not throw (primary+primary and derived+derived)", () => {
    // Sub-case 1: two primary registrations of the same schema reference —
    // multi-primary semantics (last-write-wins for matchers) are out of B47's
    // scope and MUST be preserved.
    const worldPrimary = createWorld({ seed: 1 });
    worldPrimary.withSchema(Person);
    expect(() => worldPrimary.withSchema(Person)).not.toThrow();
    expect(regCount(worldPrimary)).toBe(2);

    // Sub-case 2: two derived registrations from DIFFERENT sources — the
    // media-library fan-in pattern (B41 §3) MUST be preserved.
    const worldDerived = createWorld({ seed: 1 });
    worldDerived.withSchema(Person, { from: Company });
    expect(() => worldDerived.withSchema(Person, { from: Org })).not.toThrow();
    expect(regCount(worldDerived)).toBe(2);
  });

  it("B47-R4 / relation-target and from-source roles do not trigger the throw", () => {
    // Post is registered ONCE as primary. It then appears (a) as a relation
    // target on Comment's registration and (b) as the `from:` source on
    // Summary's registration. Neither appearance is a registration of Post —
    // none of the three `withSchema` calls throws, and the final registration
    // list has exactly three entries (one per actual registration).
    const world = createWorld({ seed: 1 });
    expect(() => {
      world.withSchema(Post);
      world.withSchema(Comment, { relations: { post: Post } });
      world.withSchema(Summary, { from: Post });
    }).not.toThrow();
    expect(regCount(world)).toBe(3);
  });
});
