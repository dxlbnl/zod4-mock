/**
 * Unit tests for B7 — Registry read methods + `World.get` return type should
 * be `z.infer<T>` (output shape), while writes / matchers / overrides stay
 * `input<T>` (the asymmetry is the point).
 *
 * Spec: wiki/specs/B7-registry-output-typing.md
 *
 * This is mostly a TYPE-LEVEL spec — there is no runtime change. The tests
 * below assert the new public types by writing call sites that
 *   - MUST type-check after B7 lands, and
 *   - MUST NOT type-check today (under the current `input<T>` typing).
 *
 * Pattern: build the assertions around a schema with `z.coerce.date()` so the
 * input and output shapes genuinely differ:
 *   input<EventSchema>.occurredAt  : unknown
 *   z.infer<EventSchema>.occurredAt: Date
 *
 * Each assignability scenario is paired with a runtime assertion confirming
 * the stored value is already output-shaped (a `Date`) — the bug is purely
 * in the types, so the runtime side is expected to be green even today.
 *
 * No casts at the call sites the tests claim are typed correctly: this file
 * uses NO `as` casts on B7-targeted reads, no `any`, and `.js` imports.
 */

import { describe, it, expect } from "vitest";
import type { ZodTypeAny, input } from "zod";
import { z } from "zod";
import { createWorld, generate } from "../../../src/index.js";
import type { World, Registry, GenerateOptions, SchemaOpts } from "../../../src/types.js";

// ---------------------------------------------------------------------------
// Shared fixture — coerce.date() makes input and output shapes diverge.
//   input<EventSchema>.occurredAt   : unknown   (Zod accepts anything to coerce)
//   z.infer<EventSchema>.occurredAt : Date      (post-coerce output)
// ---------------------------------------------------------------------------

const EventSchema = z.object({
  id: z.string(),
  occurredAt: z.coerce.date(),
});
type EventOut = z.infer<typeof EventSchema>;
type EventIn = input<typeof EventSchema>;

// The B7 read-side contract — z.infer everywhere reads happen. Used to
// document the intended shape of `Registry` after B7 lands; today this is
// strictly stricter than the live `Registry` interface, so values of type
// `Registry` are NOT assignable to `B7Registry` (the predicate parameter is
// narrower under B7), and that mismatch is the RED signal.
interface B7Registry {
  store<T extends ZodTypeAny>(schema: T, item: input<T>): void;
  all<T extends ZodTypeAny>(schema: T): z.infer<T>[];
  pick<T extends ZodTypeAny>(schema: T): z.infer<T>;
  filter<T extends ZodTypeAny>(schema: T, predicate: (item: z.infer<T>) => boolean): z.infer<T>[];
  find<T extends ZodTypeAny>(
    schema: T,
    predicate: (item: z.infer<T>) => boolean,
  ): z.infer<T> | undefined;
  count(schema: ZodTypeAny): number;
}

interface B7World {
  get<TSchema extends ZodTypeAny>(
    schema: TSchema,
    predicate?: Partial<input<TSchema>>,
  ): z.infer<TSchema>;
}

// ---------------------------------------------------------------------------
// B7-R1: Registry read methods return z.infer<T> (output shape)
// ---------------------------------------------------------------------------

describe("output-typing — B7-R1: registry reads return z.infer<T>", () => {
  it("B7-R1 / all() — no-cast assignment to z.infer<T>[] type-checks; stored value is a Date", () => {
    const world = createWorld({ seed: 1 }).withSchema(EventSchema);
    world.populate(EventSchema, 2);

    // RED today: registry.all is typed input<T>[] where occurredAt is unknown,
    // and unknown is NOT assignable to Date — so this assignment fails TS.
    // GREEN after B7: registry.all is z.infer<T>[] and the assignment works.
    const items: EventOut[] = world.registry.all(EventSchema);

    expect(items.length).toBeGreaterThan(0);
    // Runtime confirms the bug is purely typing: the stored values are Dates.
    expect(items[0]!.occurredAt).toBeInstanceOf(Date);
  });

  it("B7-R1 / find() — predicate typed (item: z.infer<T>) => boolean is accepted", () => {
    const world = createWorld({ seed: 1 }).withSchema(EventSchema);
    world.populate(EventSchema, 1);

    // RED today: registry.find expects (item: input<T>) => boolean; a predicate
    // that requires output-shape (Date) is not assignable to input-shape (unknown).
    // GREEN after B7: predicate is (item: z.infer<T>) => boolean.
    const predicate: (item: EventOut) => boolean = (e) => e.occurredAt.getTime() > 0;
    const found: EventOut | undefined = world.registry.find(EventSchema, predicate);

    expect(found).toBeDefined();
    expect(found!.occurredAt).toBeInstanceOf(Date);
  });

  it("B7-R1 / filter() — predicate typed (item: z.infer<T>) => boolean is accepted", () => {
    const world = createWorld({ seed: 1 }).withSchema(EventSchema);
    world.populate(EventSchema, 2);

    // RED today: same reason as `find` above — predicate parameter is input<T>.
    // GREEN after B7: predicate is z.infer<T>.
    const predicate: (item: EventOut) => boolean = (e) => e.occurredAt instanceof Date;
    const items: EventOut[] = world.registry.filter(EventSchema, predicate);

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.occurredAt instanceof Date)).toBe(true);
  });

  it("B7-R1 / pick() — no-cast assignment to z.infer<T> type-checks", () => {
    const world = createWorld({ seed: 1 }).withSchema(EventSchema);
    world.populate(EventSchema, 1);

    // RED today: registry.pick is input<T>; unknown is not assignable to Date.
    // GREEN after B7: registry.pick is z.infer<T>.
    const evt: EventOut = world.registry.pick(EventSchema);

    expect(evt.occurredAt).toBeInstanceOf(Date);
  });

  it("B7-R1 / Registry interface is assignable to the B7 read-typed shape", () => {
    // This pins the WHOLE interface, not just one method. Under the current
    // types, `Registry` has input<T>-typed reads — its `all` return type
    // (input<T>[]) is NOT assignable to z.infer<T>[], so `Registry` is NOT
    // assignable to `B7Registry`. After B7 lands the two are structurally
    // identical and the assignment type-checks.
    const world = createWorld({ seed: 1 }).withSchema(EventSchema);
    world.populate(EventSchema, 1);
    const reg: B7Registry = world.registry;

    expect(reg.count(EventSchema)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// B7-R2: Registry.store still accepts input<T> (pre-coerce permissive shape)
// ---------------------------------------------------------------------------

describe("output-typing — B7-R2: registry.store accepts input<T>", () => {
  it("B7-R2 / coerce-field write accepts a permissive input (pre-coerce) value", () => {
    const world = createWorld({ seed: 1 }).withSchema(EventSchema);

    // input<EventSchema>.occurredAt is `unknown`, so a string literal is a
    // valid input. This MUST type-check both today and after B7 (B7 does NOT
    // tighten the write side).
    const item: EventIn = { id: "e1", occurredAt: "2024-01-01" };
    world.registry.store(EventSchema, item);

    // Runtime: store is a pure push — the value lands in the registry exactly
    // as passed; no parse is performed (B7-R6 pins "no runtime change").
    const stored = world.registry.all(EventSchema);
    // The stored value is the exact same string we passed in.
    expect(stored[0]!.occurredAt).toBe("2024-01-01");
  });
});

// ---------------------------------------------------------------------------
// B7-R3: World.get returns z.infer<T>; predicate stays Partial<input<T>>
// ---------------------------------------------------------------------------

describe("output-typing — B7-R3: world.get return is z.infer<T>", () => {
  it("B7-R3 / get() — no-cast assignment to z.infer<T> type-checks", () => {
    const world = createWorld({ seed: 1 }).withSchema(EventSchema);

    // RED today: world.get is typed `input<TSchema>`; unknown is not
    // assignable to Date.
    // GREEN after B7: world.get is z.infer<TSchema>.
    const evt: EventOut = world.get(EventSchema, { id: "e1" });

    expect(evt.occurredAt).toBeInstanceOf(Date);
  });

  it("B7-R3 / get() — predicate accepts the permissive input shape", () => {
    const world = createWorld({ seed: 1 }).withSchema(EventSchema);

    // Partial<input<TSchema>>.occurredAt is `unknown | undefined`, so a string
    // literal is permitted as the predicate value. This MUST type-check both
    // today and after B7 (predicate stays input-typed).
    const predicate: Partial<EventIn> = { occurredAt: "2024-01-01" };
    const evt: EventOut = world.get(EventSchema, predicate);

    // Runtime: get's create path passes the predicate as overrides, so the
    // returned occurredAt is whatever override we passed (the raw string).
    expect(evt.occurredAt).toBe("2024-01-01");
  });

  it("B7-R3 / World interface is assignable to the B7 get-typed shape", () => {
    // Pins the whole `get` signature on `World`. Today the live `World.get`
    // returns `input<TSchema>`, which is not assignable to `z.infer<TSchema>`
    // — so `World` is not assignable to `B7World`. After B7 the two match.
    const world: World = createWorld({ seed: 1 }).withSchema(EventSchema);
    const w: B7World = world;

    const evt = w.get(EventSchema, { id: "e1" });
    expect(evt.occurredAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// B7-R4: World.generate return type stays z.infer<T> (invariant pinned)
// ---------------------------------------------------------------------------

describe("output-typing — B7-R4: world.generate returns z.infer<T>", () => {
  it("B7-R4 / world.generate — no-cast assignment to z.infer<T> type-checks", () => {
    const world = createWorld({ seed: 1 }).withSchema(EventSchema);

    // This invariant is already true today (it is what B7 brings the reads in
    // line with). Pinned so a future refactor cannot regress it.
    const evt: EventOut = world.generate(EventSchema);

    expect(evt.occurredAt).toBeInstanceOf(Date);
  });

  it("B7-R4 / top-level generate() returns z.infer<T>", () => {
    // Re-exported from src/index.ts — same invariant.
    const evt: EventOut = generate(EventSchema, { seed: 1 });

    expect(evt.occurredAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// B7-R5: matchers and GenerateOptions.overrides stay input-typed
// ---------------------------------------------------------------------------

describe("output-typing — B7-R5: matchers and overrides stay input-typed", () => {
  it("B7-R5 / matcher returns a permissive input value (string) for a coerce.date() field", () => {
    // The matcher's return type is `input<EventSchema>['occurredAt']`, which
    // is `unknown` for a `coerce.date()` field. Returning a raw string MUST
    // type-check both today and after B7 (B7 does NOT tighten matchers).
    const opts: SchemaOpts<typeof EventSchema> = {
      matchers: {
        occurredAt: () => "2024-01-01",
      },
    };

    const world = createWorld({ seed: 1 }).withSchema(EventSchema, opts);
    const evt = world.generate(EventSchema);

    // Runtime: the matcher's raw string is stored as-is (no implicit parse).
    expect(evt.occurredAt).toBe("2024-01-01");
  });

  it("B7-R5 / overrides accepts a permissive pre-coerce value (string) for a coerce.date() field", () => {
    const world = createWorld({ seed: 1 }).withSchema(EventSchema);

    // GenerateOptions<EventOut>.overrides is DeepPartial<EventOut>; since the
    // caller-supplied type parameter on `generate<EventSchema>` is
    // `z.infer<EventSchema>`, this is DeepPartial<EventOut>. occurredAt of
    // type `Date` is not directly compatible with a string — but in PRACTICE
    // the existing tests (and B6's `get` implementation) pass an input-shaped
    // override through; B7-R5 records that this remains permissive enough at
    // the `world.generate` boundary.
    //
    // To exercise the documented contract that overrides flow IN unchanged
    // from today, build the options through the typed `GenerateOptions` alias
    // exactly as the implementation uses it: GenerateOptions<input<T>> at the
    // matcher-fed call site. That MUST type-check today and after B7.
    const inOpts: GenerateOptions<EventIn> = {
      overrides: { occurredAt: "2024-01-02" },
    };

    // The implementation casts at the boundary (see WorldImpl.get); a
    // top-level caller building options against input<T> remains valid.
    const evt = world.generate(EventSchema, inOpts as GenerateOptions<EventOut>);

    // Runtime: override wins — the value comes through as the raw string.
    expect(evt.occurredAt).toBe("2024-01-02");
  });
});

// ---------------------------------------------------------------------------
// B7-R6: pure type change — runtime behaviour unchanged
//
// B7-R6 says "the full existing suite stays green with assertion bodies
// unedited." That is verified by NOT editing any existing test and running
// `pnpm test` after B7 lands. The check below is a focused, B7-local
// reaffirmation: a store-then-read round-trip preserves the exact value
// (no parse on store, no transform on read).
// ---------------------------------------------------------------------------

describe("output-typing — B7-R6: no runtime parse on store or read", () => {
  it("B7-R6 / store-then-read returns the exact value passed in (===)", () => {
    const reg: Registry = createWorld({ seed: 1 }).withSchema(EventSchema).registry;

    const item: EventIn = { id: "e1", occurredAt: "2024-01-01" };
    reg.store(EventSchema, item);

    const items = reg.all(EventSchema);
    // Same reference — no copy/parse on store.
    expect(items[0]).toBe(item);
    // Same string — no implicit coerce.date() parse on read.
    expect(items[0]!.occurredAt).toBe("2024-01-01");
  });
});

// ---------------------------------------------------------------------------
// B7-R7: docs/api-reference.md updated in the same step.
//
// This is a documentation-side requirement. The test-writer does not assert
// docs content in a test file; the reviewer verifies the doc update lands
// in the same change. Noted here for traceability.
// ---------------------------------------------------------------------------
