/**
 * Unit tests for `registry.find()` — single-record predicate lookup (B4).
 *
 * These tests are written test-first: the `find` method does not yet exist on
 * the `Registry` interface / `SchemaRegistry` implementation, so they are
 * expected to FAIL until B4 is implemented. Each test is named by its
 * requirement ID and scenario.
 *
 * Spec: wiki/specs/B4-registry-find.md
 *
 * The expected contract (B4-R1):
 *   find<T extends ZodTypeAny>(
 *     schema: T,
 *     predicate: (item: input<T>) => boolean,
 *   ): input<T> | undefined
 *
 * The local `WithFind` type below expresses that exact signature (no `any`,
 * no cast at the call site). Once `find` is added to the `Registry`
 * interface, this local type is structurally satisfied by `SchemaRegistry`
 * and `pnpm typecheck` passes; today it documents the intended shape and the
 * tests fail at runtime because `registry.find` is `undefined`.
 */

import { describe, it, expect } from "vitest";
import type { ZodTypeAny, input } from "zod";
import { z } from "zod";
import { createPrng } from "../../../src/index.js";
import { SchemaRegistry } from "../../../src/registry.js";
import type { Registry } from "../../../src/types.js";

// The schema-bound, input<T>-typed `find` contract from B4-R1. Used to type
// the call sites without `any` and without reaching into the implementation.
interface WithFind {
  find<T extends ZodTypeAny>(
    schema: T,
    predicate: (item: input<T>) => boolean,
  ): input<T> | undefined;
}

const userSchema = z.object({
  username: z.string(),
  role: z.string(),
  n: z.number(),
});

const personSchema = z.object({
  personId: z.number(),
  firstName: z.string(),
});

type User = input<typeof userSchema>;
type Person = input<typeof personSchema>;

function makeRegistry(): Registry & WithFind {
  // `SchemaRegistry implements Registry`; the `& WithFind` documents the
  // method B4 adds. Once `find` lands on `Registry`, this is a plain
  // `Registry` and the intersection is satisfied structurally.
  return new SchemaRegistry(createPrng(42)) as Registry & WithFind;
}

describe("registry.find — B4", () => {
  // -------------------------------------------------------------------------
  // B4-R1: `find` is added to the Registry interface
  // -------------------------------------------------------------------------
  describe("B4-R1: find is present and typed", () => {
    it("B4-R1 / method present and typed", () => {
      const registry = makeRegistry();
      expect(typeof registry.find).toBe("function");
    });
  });

  // -------------------------------------------------------------------------
  // B4-R2: `find` returns the first matching record
  // -------------------------------------------------------------------------
  describe("B4-R2: returns the first matching record", () => {
    it("B4-R2 / single match returned", () => {
      const registry = makeRegistry();
      registry.store(userSchema, { username: "alice", role: "member", n: 1 });
      registry.store(userSchema, { username: "admin", role: "admin", n: 2 });
      registry.store(userSchema, { username: "bob", role: "member", n: 3 });

      const found = registry.find(userSchema, (u: User) => u.username === "admin");
      expect(found).toEqual({ username: "admin", role: "admin", n: 2 });
    });

    it("B4-R2 / lookup by id across records", () => {
      const registry = makeRegistry();
      registry.store(personSchema, { personId: 7, firstName: "Ada" });
      registry.store(personSchema, { personId: 42, firstName: "Grace" });
      registry.store(personSchema, { personId: 13, firstName: "Linus" });

      const found = registry.find(personSchema, (p: Person) => p.personId === 42);
      expect(found).toEqual({ personId: 42, firstName: "Grace" });
    });
  });

  // -------------------------------------------------------------------------
  // B4-R3: `find` returns undefined when nothing matches (never throws)
  // -------------------------------------------------------------------------
  describe("B4-R3: returns undefined when nothing matches", () => {
    it("B4-R3 / no record matches the predicate", () => {
      const registry = makeRegistry();
      registry.store(userSchema, { username: "alice", role: "member", n: 1 });
      registry.store(userSchema, { username: "bob", role: "member", n: 2 });

      let result: User | undefined;
      expect(() => {
        result = registry.find(userSchema, (u: User) => u.username === "nobody");
      }).not.toThrow();
      expect(result).toBeUndefined();
    });

    it("B4-R3 / schema has no stored records", () => {
      const registry = makeRegistry();

      let result: User | undefined;
      expect(() => {
        result = registry.find(userSchema, () => true);
      }).not.toThrow();
      expect(result).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // B4-R4: "First" means registry insertion order
  // -------------------------------------------------------------------------
  describe("B4-R4: insertion order — earliest match wins", () => {
    it("B4-R4 / earliest matching record wins", () => {
      const registry = makeRegistry();
      registry.store(userSchema, { username: "first", role: "member", n: 1 });
      registry.store(userSchema, { username: "second", role: "member", n: 2 });

      const found = registry.find(userSchema, (u: User) => u.role === "member");
      expect(found?.n).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // B4-R5: `find` is a pure, non-mutating lookup
  // -------------------------------------------------------------------------
  describe("B4-R5: pure, non-mutating, does not consume PRNG", () => {
    it("B4-R5 / registry contents unchanged and PRNG untouched", () => {
      const prng = createPrng(42);
      const registry = new SchemaRegistry(prng) as Registry & WithFind;
      registry.store(userSchema, { username: "alice", role: "member", n: 1 });
      registry.store(userSchema, { username: "admin", role: "admin", n: 2 });
      registry.store(userSchema, { username: "bob", role: "member", n: 3 });

      // Baseline: what `pick` would return if `find` is never called.
      const reference: Registry = new SchemaRegistry(createPrng(42));
      reference.store(userSchema, { username: "alice", role: "member", n: 1 });
      reference.store(userSchema, { username: "admin", role: "admin", n: 2 });
      reference.store(userSchema, { username: "bob", role: "member", n: 3 });
      const expectedPick = reference.pick(userSchema);

      const countBefore = registry.count(userSchema);
      const allBefore = registry.all(userSchema);

      // Repeated calls with the same args return the same record.
      const first = registry.find(userSchema, (u: User) => u.username === "admin");
      const second = registry.find(userSchema, (u: User) => u.username === "admin");
      expect(first).toEqual({ username: "admin", role: "admin", n: 2 });
      expect(second).toEqual(first);

      // Registry contents unchanged by the calls.
      expect(registry.count(userSchema)).toBe(countBefore);
      expect(registry.all(userSchema)).toEqual(allBefore);

      // PRNG advances by zero steps: a subsequent pick yields exactly what it
      // would have yielded had `find` never been called.
      expect(registry.pick(userSchema)).toEqual(expectedPick);
    });
  });
});
