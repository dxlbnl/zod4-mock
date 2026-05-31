/**
 * Unit tests for `world.populateFrom(derivedSchema, sourceSchema, predicate?, factory?)` —
 * declarative loop primitive for source-driven derived schemas (B13).
 *
 * Written test-first against wiki/specs/B13-world-populate-from.md.
 *
 * Today the `World` interface (src/types.ts) does NOT declare a `populateFrom`
 * method, and `WorldImpl` (src/world.ts) does NOT implement it. The tests in
 * this file therefore fail in two complementary ways:
 *
 *   - B13-R1 fails at `pnpm typecheck` — every call site (`world.populateFrom(...)`)
 *     is TS2339 ("Property 'populateFrom' does not exist on type 'World'") plus
 *     consequential inference errors on `predicate`/`factory` parameters.
 *   - B13-R2 / R3 / R4 / R6 / R7 / R8 / R9 fail at `pnpm test` — at runtime
 *     `world.populateFrom` is `undefined`, so the call throws
 *     `TypeError: world.populateFrom is not a function`.
 *
 * Per the spec, R10 (docs) and R11 (changeset) are reviewer-verified and not
 * covered by tests here.
 *
 * Strict typing: no `any` and no call-site casts. All relative imports use
 * `.js` extensions (D1).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import type { GenerateOptions } from "../../../src/types.js";

// ---------------------------------------------------------------------------
// Shared fixtures — schemas used across the requirement blocks
// ---------------------------------------------------------------------------

const OrderSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "shipped", "cancelled"]),
  amount: z.number(),
});

const SummarySchema = z.object({
  orderId: z.string(),
  shippedAmount: z.number(),
});

const LabelledSummarySchema = z.object({
  orderId: z.string(),
  label: z.string(),
});

const SimpleOrderSchema = z.object({
  id: z.string(),
  amount: z.number(),
});

const SimpleSummarySchema = z.object({
  orderId: z.string(),
  label: z.string(),
});

// A coerce-bearing source schema for B13-R5 (z.infer is `Date` despite the
// input being `unknown`). Today's predicate path receives an `o` typed as
// `z.infer<TSource>` — so `o.placedAt.getTime()` MUST compile with no cast.
const CoerceOrderSchema = z.object({
  id: z.string(),
  placedAt: z.coerce.date(),
  amount: z.number(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a world with `OrderSchema` and `SummarySchema` (derived from
 * OrderSchema), pre-populating `count` orders with a deterministic mix of
 * statuses driven by a per-record factory (B14).
 *
 * The status cycle is `[shipped, pending, shipped, cancelled, shipped]`, so
 * for `count = 30` exactly 18 orders are shipped (indexes 0, 2, 4, 5, 7, 9,
 * 10, 12, 14, 15, 17, 19, 20, 22, 24, 25, 27, 29). The exact K is recovered
 * at runtime via `registry.filter` — the tests never hard-code it.
 */
function makeOrderWorld(seed: number, count: number) {
  const world = createWorld({ seed })
    .withSchema(OrderSchema)
    .withSchema(SummarySchema, {
      from: OrderSchema,
      matchers: {
        orderId: (ctx) => ctx.source.id,
        shippedAmount: (ctx) => ctx.source.amount,
      },
    });

  const cycle = ["shipped", "pending", "shipped", "cancelled", "shipped"] as const;
  world.populate(OrderSchema, count, (i) => ({
    overrides: { status: cycle[i % cycle.length]! },
  }));

  return world;
}

// ---------------------------------------------------------------------------
// B13-R1: signature is present and well-typed (no any, no cast)
// ---------------------------------------------------------------------------

describe("B13-R1: World.populateFrom is on the public interface and well-typed", () => {
  it("B13-R1 / 3-arg call type-checks; predicate parameter is z.infer<TSource>", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(OrderSchema)
      .withSchema(SummarySchema, {
        from: OrderSchema,
        matchers: {
          orderId: (ctx) => ctx.source.id,
          shippedAmount: (ctx) => ctx.source.amount,
        },
      });

    // Today `world.populateFrom` does not exist — this is TS2339 at typecheck
    // AND throws `TypeError` at runtime. The predicate's `o` parameter MUST
    // be inferred as `z.infer<typeof OrderSchema>`; reading `o.status` (the
    // enum literal type) without a cast and comparing to `"shipped"` MUST
    // compile with no `any`.
    const returned = world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");

    // Runtime guard: B13-R3 — returns the world.
    expect(returned).toBe(world);
  });

  it("B13-R1 / 2-arg call type-checks (predicate omitted)", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(OrderSchema)
      .withSchema(SummarySchema, {
        from: OrderSchema,
        matchers: {
          orderId: (ctx) => ctx.source.id,
          shippedAmount: (ctx) => ctx.source.amount,
        },
      });

    // No predicate, no factory.
    const returned = world.populateFrom(SummarySchema, OrderSchema);
    expect(returned).toBe(world);
  });

  it("B13-R1 / 4-arg call type-checks; factory parameter is z.infer<TSource>", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(SimpleOrderSchema)
      .withSchema(SimpleSummarySchema, {
        from: SimpleOrderSchema,
        matchers: { orderId: (ctx) => ctx.source.id },
      });
    world.populate(SimpleOrderSchema, 3);

    // Factory parameter MUST be inferred as `z.infer<typeof SimpleOrderSchema>`
    // — `.id.slice(0, 6)` must compile with no cast, no `any`.
    const returned = world.populateFrom(
      SimpleSummarySchema,
      SimpleOrderSchema,
      (o) => o.amount >= 0,
      (s) => ({ overrides: { label: `summary-${s.id.slice(0, 6)}` } }),
    );

    expect(returned).toBe(world);
  });

  it("B13-R1 / predicate=undefined, factory provided — independently omissible", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(SimpleOrderSchema)
      .withSchema(SimpleSummarySchema, {
        from: SimpleOrderSchema,
        matchers: { orderId: (ctx) => ctx.source.id },
      });
    world.populate(SimpleOrderSchema, 3);

    // `undefined` predicate, factory present. Per spec both parameters are
    // independently omissible.
    const returned = world.populateFrom(SimpleSummarySchema, SimpleOrderSchema, undefined, (s) => ({
      overrides: { label: s.id },
    }));

    expect(returned).toBe(world);
  });
});

// ---------------------------------------------------------------------------
// B13-R2: predicate filters; one derived record per surviving source
// ---------------------------------------------------------------------------

describe("B13-R2: iterates predicate-filtered source registry; one generate per record", () => {
  it("B13-R2 / one Summary per shipped order; none for non-shipped", () => {
    const world = makeOrderWorld(7, 30);

    // K — number of shipped orders — is recovered at runtime, never hard-coded.
    const shipped = world.registry.filter(OrderSchema, (o) => o.status === "shipped");
    const K = shipped.length;
    expect(K).toBeGreaterThan(0); // sanity: the cycle produces some shipped orders
    expect(K).toBeLessThan(30); // sanity: the cycle also produces non-shipped

    world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");

    // Exactly K Summaries — one per shipped order.
    expect(world.registry.count(SummarySchema)).toBe(K);

    const shippedIds = new Set(shipped.map((o) => o.id));
    const nonShippedIds = new Set(
      world.registry.filter(OrderSchema, (o) => o.status !== "shipped").map((o) => o.id),
    );

    for (const s of world.registry.all(SummarySchema)) {
      // Each Summary references a shipped order, and matchers wired through.
      expect(shippedIds.has(s.orderId)).toBe(true);
      expect(nonShippedIds.has(s.orderId)).toBe(false);
      // The matcher set `shippedAmount` to the source order's amount; find the
      // referenced order and confirm.
      const order = world.registry.find(OrderSchema, (o) => o.id === s.orderId);
      expect(order).toBeDefined();
      expect(s.shippedAmount).toBe(order!.amount);
    }
  });

  it("B13-R2 / no predicate — one derived record per source record", () => {
    const world = createWorld({ seed: 7 })
      .withSchema(OrderSchema)
      .withSchema(SummarySchema, {
        from: OrderSchema,
        matchers: {
          orderId: (ctx) => ctx.source.id,
          shippedAmount: (ctx) => ctx.source.amount,
        },
      });
    world.populate(OrderSchema, 4);

    world.populateFrom(SummarySchema, OrderSchema);

    expect(world.registry.count(SummarySchema)).toBe(4);
    expect(world.registry.all(SummarySchema).map((s) => s.orderId)).toEqual(
      world.registry.all(OrderSchema).map((o) => o.id),
    );
  });

  it("B13-R2 / produced derived records appear in source-insertion order", () => {
    const world = makeOrderWorld(13, 10);
    const shipped = world.registry.filter(OrderSchema, (o) => o.status === "shipped");

    world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");

    expect(world.registry.all(SummarySchema).map((s) => s.orderId)).toEqual(
      shipped.map((o) => o.id),
    );
  });
});

// ---------------------------------------------------------------------------
// B13-R3: returns `this` for fluent chaining
// ---------------------------------------------------------------------------

describe("B13-R3: populateFrom returns the world for fluent chaining", () => {
  it("B13-R3 / returned reference equals the world", () => {
    const world = makeOrderWorld(1, 6);

    const returned = world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");

    expect(returned).toBe(world);
  });

  it("B13-R3 / chains with a following populate call", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(OrderSchema)
      .withSchema(SummarySchema, {
        from: OrderSchema,
        matchers: {
          orderId: (ctx) => ctx.source.id,
          shippedAmount: (ctx) => ctx.source.amount,
        },
      });
    world.populate(OrderSchema, 2);

    // populateFrom -> populate -> still the same world reference.
    const chained = world.populateFrom(SummarySchema, OrderSchema).populate(OrderSchema, 1);

    expect(chained).toBe(world);
    expect(world.registry.count(OrderSchema)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// B13-R4: idempotence — re-running populateFrom leaves the registry unchanged
// ---------------------------------------------------------------------------

describe("B13-R4: re-running populateFrom is idempotent (B8 upsert)", () => {
  it("B13-R4 / second populateFrom call does not grow the Summary bucket", () => {
    const world = makeOrderWorld(7, 30);

    world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");

    const beforeCount = world.registry.count(SummarySchema);
    const beforeRefs = [...world.registry.all(SummarySchema)];

    world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");

    expect(world.registry.count(SummarySchema)).toBe(beforeCount);
    const afterRefs = world.registry.all(SummarySchema);
    expect(afterRefs.length).toBe(beforeRefs.length);

    // Reference equality: same upsert hits, same record instances.
    for (let i = 0; i < beforeRefs.length; i++) {
      expect(afterRefs[i]).toBe(beforeRefs[i]);
    }
  });

  it("B13-R4 / populateFrom does NOT bypass the B8 upsert (no { unique: false })", () => {
    const world = makeOrderWorld(7, 12);

    world.populateFrom(SummarySchema, OrderSchema, (o) => o.status === "shipped");

    // Capture a specific Summary reference for a specific shipped order.
    const o = world.registry.filter(OrderSchema, (x) => x.status === "shipped")[0]!;
    const s = world.registry.find(SummarySchema, (x) => x.orderId === o.id);
    expect(s).toBeDefined();

    world.populateFrom(SummarySchema, OrderSchema, (o2) => o2.status === "shipped");

    const sAfter = world.registry.find(SummarySchema, (x) => x.orderId === o.id);
    // If populateFrom had passed `unique: false`, a fresh Summary would have
    // been written and `sAfter !== s`. The reference equality pins that
    // populateFrom MUST NOT bypass the upsert.
    expect(sAfter).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// B13-R5: predicate parameter type alignment with B7 / B11
//
// The coerce-bearing schema OrderSchema.placedAt has input<> = unknown and
// z.infer<> = Date. Per B13-R5, predicate's `o` is `z.infer<TSource>`, so
// `o.placedAt.getTime()` MUST compile with no cast. Today this is a TS2339
// at typecheck (populateFrom is missing); once populateFrom exists with the
// wrong predicate typing (e.g. input<TSource>), `o.placedAt` would be
// `unknown` and `.getTime()` would TS-error — pinning the B7-aligned typing.
// ---------------------------------------------------------------------------

describe("B13-R5: predicate parameter is z.infer<TSource> (B7 / B11 alignment)", () => {
  it("B13-R5 / coerce-bearing field — predicate body uses .getTime() with no cast", () => {
    const DerivedSchema = z.object({ orderId: z.string() });

    const world = createWorld({ seed: 1 })
      .withSchema(CoerceOrderSchema)
      .withSchema(DerivedSchema, {
        from: CoerceOrderSchema,
        matchers: { orderId: (ctx) => ctx.source.id },
      });
    world.populate(CoerceOrderSchema, 3);

    // No cast, no `any`. `o.placedAt` MUST be typed as `Date` (z.infer
    // shape, per B7); `.getTime()` must compile.
    world.populateFrom(DerivedSchema, CoerceOrderSchema, (o) => o.placedAt.getTime() > 0);

    expect(world.registry.count(DerivedSchema)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// B13-R6: snapshot iteration — mid-loop source-bucket inserts not visited
// ---------------------------------------------------------------------------

describe("B13-R6: iteration uses a snapshot of the source bucket at call start", () => {
  it("B13-R6 / mid-loop side-effect inserts to source bucket are NOT iterated", () => {
    const SnapshotOrderSchema = z.object({
      id: z.string(),
      amount: z.number(),
    });
    const SnapshotSummarySchema = z.object({
      orderId: z.string(),
      label: z.string(),
    });

    const world = createWorld({ seed: 1 }).withSchema(SnapshotOrderSchema);

    // The matcher for `label` writes a NEW source record on the first few
    // invocations. If `populateFrom` snapshotted the source bucket at call
    // start, those side-effect inserts do NOT extend the iteration of the
    // current call (they show up on the next call — covered in the next
    // scenario).
    world.withSchema(SnapshotSummarySchema, {
      from: SnapshotOrderSchema,
      matchers: {
        orderId: (ctx) => ctx.source.id,
        label: () => {
          if (world.registry.count(SnapshotOrderSchema) < 5) {
            world.registry.store(SnapshotOrderSchema, {
              id: `extra-${world.registry.count(SnapshotOrderSchema)}`,
              amount: 0,
            });
          }
          return "L";
        },
      },
    });

    world.populate(SnapshotOrderSchema, 3);
    expect(world.registry.count(SnapshotOrderSchema)).toBe(3);

    world.populateFrom(SnapshotSummarySchema, SnapshotOrderSchema);

    // Exactly 3 Summaries — only the 3 originally-snapshot orders produced
    // Summaries. The mid-loop side-effect inserts did NOT add to this call's
    // iteration.
    expect(world.registry.count(SnapshotSummarySchema)).toBe(3);
    // The side-effect inserts DID land in the source bucket (just not in
    // this iteration's pool).
    expect(world.registry.count(SnapshotOrderSchema)).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------
// B13-R7: determinism preserved across runs with the same seed
// ---------------------------------------------------------------------------

describe("B13-R7: determinism — same seed -> byte-identical derived bucket", () => {
  it("B13-R7 / two worlds, same seed, same populateFrom call -> identical Summaries", () => {
    const worldA = makeOrderWorld(99, 10);
    const worldB = makeOrderWorld(99, 10);

    // Sanity: source populations are byte-identical first.
    expect(JSON.stringify(worldA.registry.all(OrderSchema))).toBe(
      JSON.stringify(worldB.registry.all(OrderSchema)),
    );

    worldA.populateFrom(SummarySchema, OrderSchema, (o) => o.amount >= 0);
    worldB.populateFrom(SummarySchema, OrderSchema, (o) => o.amount >= 0);

    expect(JSON.stringify(worldA.registry.all(SummarySchema))).toBe(
      JSON.stringify(worldB.registry.all(SummarySchema)),
    );
    // Sanity: at least one Summary actually got produced (so the equality
    // above isn't a vacuous `"[] === []"`).
    expect(worldA.registry.count(SummarySchema)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// B13-R8: always writes — factory's `store: false` is silently stripped
// ---------------------------------------------------------------------------

describe("B13-R8: populateFrom always writes (factory's store: false ignored)", () => {
  it("B13-R8 / factory returning { store: false } still produces stored derived records", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(SimpleOrderSchema)
      .withSchema(LabelledSummarySchema, {
        from: SimpleOrderSchema,
        matchers: { orderId: (ctx) => ctx.source.id },
      });
    world.populate(SimpleOrderSchema, 4);

    // Factory returns `{ store: false, overrides: ... }` per the spec scenario.
    // The `store: false` MUST be silently stripped (mirroring B10-R6 for
    // `populate`). Every derived record MUST land in the registry.
    world.populateFrom(
      LabelledSummarySchema,
      SimpleOrderSchema,
      undefined,
      (s): GenerateOptions<z.infer<typeof LabelledSummarySchema>> => ({
        store: false,
        overrides: { label: s.id },
      }),
    );

    expect(world.registry.count(LabelledSummarySchema)).toBe(4);
    // The factory's other fields still flow through — overrides win.
    for (const summary of world.registry.all(LabelledSummarySchema)) {
      const order = world.registry.find(SimpleOrderSchema, (o) => o.id === summary.orderId);
      expect(order).toBeDefined();
      expect(summary.label).toBe(order!.id);
    }
  });
});

// ---------------------------------------------------------------------------
// B13-R9: per-source factory composes with the source record
// ---------------------------------------------------------------------------

describe("B13-R9: factory invoked per source record; return flows through generate", () => {
  it("B13-R9 / factory's overrides win on every derived record (label = `summary-${id.slice(0,6)}`)", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(SimpleOrderSchema)
      .withSchema(LabelledSummarySchema, {
        from: SimpleOrderSchema,
        matchers: { orderId: (ctx) => ctx.source.id },
      });
    world.populate(SimpleOrderSchema, 3, (i) => ({
      overrides: { id: `order-${i}-abcdef` },
    }));

    world.populateFrom(LabelledSummarySchema, SimpleOrderSchema, undefined, (source) => ({
      overrides: { label: `summary-${source.id.slice(0, 6)}` },
    }));

    expect(world.registry.count(LabelledSummarySchema)).toBe(3);
    for (const summary of world.registry.all(LabelledSummarySchema)) {
      const order = world.registry.find(SimpleOrderSchema, (o) => o.id === summary.orderId);
      expect(order).toBeDefined();
      expect(summary.label).toBe(`summary-${order!.id.slice(0, 6)}`);
    }
  });

  it("B13-R9 / factory receives the source record (not an index), in iteration order", () => {
    const world = createWorld({ seed: 1 })
      .withSchema(SimpleOrderSchema)
      .withSchema(LabelledSummarySchema, {
        from: SimpleOrderSchema,
        matchers: { orderId: (ctx) => ctx.source.id },
      });
    world.populate(SimpleOrderSchema, 3);

    const seen: Array<z.infer<typeof SimpleOrderSchema>> = [];
    world.populateFrom(LabelledSummarySchema, SimpleOrderSchema, undefined, (source) => {
      seen.push(source);
      return {};
    });

    expect(seen).toHaveLength(3);
    expect(seen.map((o) => o.id)).toEqual(world.registry.all(SimpleOrderSchema).map((o) => o.id));
  });
});
