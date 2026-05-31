/**
 * Unit tests for `world.get(schema, predicate?)` — find-an-existing-record-or-
 * generate-one (B6).
 *
 * Written test-first: `World.get` does not yet exist on the `World` interface
 * nor on `WorldImpl`, so these tests are expected to FAIL until B6 is
 * implemented. Each test is named by its requirement ID and scenario.
 *
 * Spec: wiki/specs/B6-world-get-find-or-create.md
 *
 * The expected contract (B6-R1):
 *   get<TSchema extends ZodTypeAny>(
 *     schema: TSchema,
 *     predicate?: Partial<input<TSchema>>,
 *   ): input<TSchema>
 *
 * The local `WithGet` interface below expresses that exact signature (no
 * `any`, no cast at the call site). Once `get` is added to the `World`
 * interface, this local type is structurally satisfied by `WorldImpl` and
 * `pnpm typecheck` passes; today it documents the intended shape and the tests
 * fail at runtime because `world.get` is `undefined`.
 */

import { describe, it, expect } from "vitest";
import type { ZodTypeAny, input } from "zod";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import type { World } from "../../../src/types.js";

// The schema-bound, input<T>-typed `get` contract from B6-R1. Used to type the
// call sites without `any` and without reaching into the implementation. The
// `predicate` argument is optional, per B6-R1.
interface WithGet {
  get<TSchema extends ZodTypeAny>(
    schema: TSchema,
    predicate?: Partial<input<TSchema>>,
  ): input<TSchema>;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const productSchema = z.object({
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  n: z.number().int(),
});

const nodeSchema = z.object({
  externalId: z.string(),
  tenantId: z.string(),
  meta: z.object({
    region: z.string(),
    zone: z.number().int(),
  }),
});

// An object schema that is *never* passed to withSchema (unregistered, ad-hoc).
const gadgetSchema = z.object({
  code: z.string(),
  label: z.string(),
});

type Product = input<typeof productSchema>;

// `WorldImpl implements World`; the `& WithGet` documents the method B6 adds.
// Once `get` lands on `World`, this is a plain `World` and the intersection is
// satisfied structurally.
function makeWorld(seed: number): World & WithGet {
  return createWorld({ seed }).withSchema(productSchema) as World & WithGet;
}

describe("world.get — B6", () => {
  // -------------------------------------------------------------------------
  // B6-R1: `get` is added to the World interface
  // -------------------------------------------------------------------------
  describe("B6-R1: get is present and typed", () => {
    it("B6-R1 / method present and typed", () => {
      const world = makeWorld(1);
      expect(typeof world.get).toBe("function");

      // Typed: predicate and return value are input<typeof productSchema> with
      // no `any` and no cast at the call site.
      const result: Product = world.get(productSchema, { sku: "WIDGET-42" });
      expect(result.sku).toBe("WIDGET-42");
    });

    it("B6-R1 / predicate is optional — no-argument call type-checks and returns a value", () => {
      const world = makeWorld(1);
      // No second argument; must type-check and return input<typeof productSchema>.
      const result: Product = world.get(productSchema);
      expect(productSchema.safeParse(result).success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // B6-R2: find path — return an existing matching record
  // -------------------------------------------------------------------------
  describe("B6-R2: returns an existing matching record by reference", () => {
    it("B6-R2 / existing record returned by reference", () => {
      const world = makeWorld(1);
      // First call generates-and-stores; second call must find it.
      const first = world.get(productSchema, { sku: "WIDGET-42" });
      const countAfterFirst = world.registry.count(productSchema);

      const again = world.get(productSchema, { sku: "WIDGET-42" });

      // Same instance as held in the registry (reference equality), not a copy.
      const inRegistry = world.registry.find(productSchema, (p: Product) => p.sku === "WIDGET-42");
      expect(again).toBe(inRegistry);
      expect(again).toBe(first);
      // No new record created by the find-path call.
      expect(world.registry.count(productSchema)).toBe(countAfterFirst);
    });

    it("B6-R2 / multi-field predicate — all keys must match", () => {
      const world = createWorld({ seed: 1 }).withSchema(nodeSchema) as World & WithGet;
      // Two stored nodes share externalId but differ on tenantId.
      world.registry.store(nodeSchema, {
        externalId: "ext-1",
        tenantId: "t-1",
        meta: { region: "eu", zone: 1 },
      });
      world.registry.store(nodeSchema, {
        externalId: "ext-1",
        tenantId: "t-2",
        meta: { region: "us", zone: 2 },
      });

      const result = world.get(nodeSchema, { externalId: "ext-1", tenantId: "t-1" });

      // Returns the record where *every* predicate key matches.
      expect(result.tenantId).toBe("t-1");
      // No new record created.
      expect(world.registry.count(nodeSchema)).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // B6-R3: create path — generate with predicate as overrides, store, return
  // -------------------------------------------------------------------------
  describe("B6-R3: create path generates, honors the key, and stores", () => {
    it("B6-R3 / miss generates, honors the key, and is discoverable", () => {
      const world = makeWorld(1);
      const countBefore = world.registry.count(productSchema);

      const result = world.get(productSchema, { sku: "GADGET-99" });

      // Predicate honored as overrides.
      expect(result.sku).toBe("GADGET-99");
      // Other fields populated by the normal pipeline → schema-valid.
      expect(productSchema.safeParse(result).success).toBe(true);
      // Count increased by one.
      expect(world.registry.count(productSchema)).toBe(countBefore + 1);
      // Discoverable by a later find — and it is the same record.
      const found = world.registry.find(productSchema, (p: Product) => p.sku === "GADGET-99");
      expect(found).toBe(result);
    });

    it("B6-R3 / created record stored even for an unregistered ad-hoc schema", () => {
      // gadgetSchema is NEVER passed to withSchema.
      const world = makeWorld(1);

      const a = world.get(gadgetSchema, { code: "X1" });
      const b = world.get(gadgetSchema, { code: "X1" });

      // Same instance across both calls; the first call stored it despite the
      // schema being unregistered, so the second resolves via the find path.
      expect(b).toBe(a);
      expect(world.registry.count(gadgetSchema)).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // B6-R4: predicate wins over matchers on conflicting keys
  // -------------------------------------------------------------------------
  describe("B6-R4: predicate wins over a matcher on a conflicting key", () => {
    it("B6-R4 / predicate overrides a matcher", () => {
      const world = createWorld({ seed: 1 }).withSchema(productSchema, {
        matchers: { sku: () => "AUTO-SKU" },
      }) as World & WithGet;

      const result = world.get(productSchema, { sku: "WIDGET-42" });

      // Predicate value wins over the matcher's "AUTO-SKU".
      expect(result.sku).toBe("WIDGET-42");
    });
  });

  // -------------------------------------------------------------------------
  // B6-R5: multiple matches resolve to the first in insertion order
  // -------------------------------------------------------------------------
  describe("B6-R5: multiple matches resolve to the first in insertion order", () => {
    it("B6-R5 / earliest matching record wins", () => {
      const world = makeWorld(1);
      // Two records both in category "tools"; first stored has n === 1.
      world.registry.store(productSchema, {
        sku: "A",
        name: "Hammer",
        category: "tools",
        n: 1,
      });
      world.registry.store(productSchema, {
        sku: "B",
        name: "Wrench",
        category: "tools",
        n: 2,
      });

      const result = world.get(productSchema, { category: "tools" });

      expect(result.n).toBe(1);
      // No new record created.
      expect(world.registry.count(productSchema)).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // B6-R6: deterministic for a given seed and call sequence
  // -------------------------------------------------------------------------
  describe("B6-R6: deterministic for a given seed and call sequence", () => {
    it("B6-R6 / identical records across two worlds with the same seed", () => {
      const worldX = makeWorld(7);
      const worldY = makeWorld(7);

      const xResults = [
        worldX.get(productSchema, { sku: "A" }),
        worldX.get(productSchema, { sku: "B" }),
      ];
      const yResults = [
        worldY.get(productSchema, { sku: "A" }),
        worldY.get(productSchema, { sku: "B" }),
      ];

      expect(xResults).toEqual(yResults);
    });
  });

  // -------------------------------------------------------------------------
  // B6-R7: idempotent for the same predicate
  // -------------------------------------------------------------------------
  describe("B6-R7: idempotent for the same predicate", () => {
    it("B6-R7 / second call returns the first call's instance", () => {
      const world = makeWorld(3);

      const a = world.get(productSchema, { sku: "ONCE" });
      const b = world.get(productSchema, { sku: "ONCE" });

      expect(a).toBe(b);
      expect(world.registry.count(productSchema)).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // B6-R8: nested-object predicate keys compared by deep equality
  // -------------------------------------------------------------------------
  describe("B6-R8: nested-object predicate keys compared by deep equality", () => {
    it("B6-R8 / nested-object predicate matches by value", () => {
      const world = createWorld({ seed: 1 }).withSchema(nodeSchema) as World & WithGet;
      world.registry.store(nodeSchema, {
        externalId: "ext-1",
        tenantId: "t-1",
        meta: { region: "eu", zone: 1 },
      });
      const countBefore = world.registry.count(nodeSchema);

      // A DIFFERENT object instance that deep-equals the stored meta.
      const result = world.get(nodeSchema, { meta: { region: "eu", zone: 1 } });

      // Returns the existing record (matched by deep equality), no new one.
      expect(result.externalId).toBe("ext-1");
      expect(world.registry.count(nodeSchema)).toBe(countBefore);
    });
  });

  // -------------------------------------------------------------------------
  // B6-R9: absent or empty predicate returns the first existing record, else
  //        generates one
  // -------------------------------------------------------------------------
  describe("B6-R9: absent or empty predicate returns first existing, else generates", () => {
    it("B6-R9 / no-argument call returns the first existing record", () => {
      const world = makeWorld(1);
      world.registry.store(productSchema, {
        sku: "A",
        name: "First",
        category: "x",
        n: 1,
      });
      world.registry.store(productSchema, {
        sku: "B",
        name: "Second",
        category: "x",
        n: 2,
      });

      const result = world.get(productSchema);

      expect(result.n).toBe(1);
      expect(world.registry.count(productSchema)).toBe(2);
    });

    it("B6-R9 / empty predicate returns the first existing record", () => {
      const world = makeWorld(1);
      world.registry.store(productSchema, {
        sku: "A",
        name: "First",
        category: "x",
        n: 1,
      });
      world.registry.store(productSchema, {
        sku: "B",
        name: "Second",
        category: "x",
        n: 2,
      });

      const result = world.get(productSchema, {});

      expect(result.n).toBe(1);
      expect(world.registry.count(productSchema)).toBe(2);
    });

    it("B6-R9 / empty predicate with an empty registry generates one", () => {
      const world = makeWorld(5);
      expect(world.registry.count(productSchema)).toBe(0);

      const result = world.get(productSchema, {});

      expect(productSchema.safeParse(result).success).toBe(true);
      expect(world.registry.count(productSchema)).toBe(1);
    });

    it("B6-R9 / absent predicate with an empty registry generates one", () => {
      const world = makeWorld(5);
      expect(world.registry.count(productSchema)).toBe(0);

      const result = world.get(productSchema);

      expect(productSchema.safeParse(result).success).toBe(true);
      expect(world.registry.count(productSchema)).toBe(1);
    });
  });
});
