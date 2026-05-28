/**
 * Unit tests for the PRNG module.
 *
 * `createPrng` and `fieldSeed` are fully implemented in fase 1, so these
 * tests are expected to pass immediately.  They serve as a regression guard
 * for the seeding contract: same inputs → same outputs, always.
 */

import { describe, it, expect } from "vitest";
import { createPrng, fieldSeed } from "../../../src/index.js";
import type { Prng } from "../../../src/types.js";

describe("createPrng", () => {
  it("is deterministic: same seed produces same sequence", () => {
    const a = createPrng(42);
    const b = createPrng(42);
    expect(a.random()).toBe(b.random());
    expect(a.random()).toBe(b.random());
    expect(a.random()).toBe(b.random());
  });

  it("different seeds produce different first values", () => {
    expect(createPrng(42).random()).not.toBe(createPrng(99).random());
  });

  it("random() returns a float in [0, 1)", () => {
    const prng = createPrng(7);
    for (let i = 0; i < 50; i++) {
      const v = prng.random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() stays within [min, max] inclusive", () => {
    const prng = createPrng(42);
    for (let i = 0; i < 200; i++) {
      const v = prng.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("int() can produce both boundary values", () => {
    const results = new Set<number>();
    const prng = createPrng(0);
    for (let i = 0; i < 1000; i++) results.add(prng.int(0, 1));
    expect(results.has(0)).toBe(true);
    expect(results.has(1)).toBe(true);
  });

  it("pick() returns an element from the tuple", () => {
    const items = ["a", "b", "c"] as const;
    const prng = createPrng(42);
    for (let i = 0; i < 30; i++) {
      expect(items).toContain(prng.pick(items));
    }
  });

  it("pick() can return every element given enough calls", () => {
    const items = ["x", "y", "z"] as const;
    const seen = new Set<string>();
    const prng = createPrng(1);
    for (let i = 0; i < 500; i++) seen.add(prng.pick(items));
    expect(seen).toContain("x");
    expect(seen).toContain("y");
    expect(seen).toContain("z");
  });

  // ----------------------------------------------------------------------
  // B15: pick overload & shuffle/sample invariant
  //
  // Per wiki/specs/B15-prng-pick-readonly-and-verify-shuffle-sample.md:
  //   R1 — pick accepts `readonly T[]` and returns `T | undefined`; the existing
  //        strict-tuple overload `readonly [T, ...T[]] -> T` remains.
  //   R2 — shuffle/sample are pinned on the shared Prng interface (type-level).
  //
  // The "Additional deliverables" (prepublishOnly, doc comment, api-reference)
  // are NOT covered by tests — they are reviewer-verified per the spec.
  // ----------------------------------------------------------------------

  describe("B15: pick overload & shuffle/sample invariant", () => {
    // -- B15-R1 --------------------------------------------------------------

    it("B15-R1 / pick accepts a plain string[] without a cast", () => {
      // GIVEN: a plain string[] (no `as const`, no `[T, ...T[]]` cast).
      // The variable annotation `: string[]` forces the type system to use
      // the plain-array overload, NOT the strict-tuple overload.
      const kinds: string[] = Object.keys({ a: 1, b: 2, c: 3 });
      const p = createPrng(42);

      // Today the interface only declares
      //   pick<T>(items: readonly [T, ...T[]]): T;
      // so this call site MUST fail `pnpm typecheck` (TS2345 — `string[]` is
      // not assignable to `readonly [string, ...string[]]`). When the overload
      // is added, the inferred return type becomes `string | undefined`.
      const k: string | undefined = p.pick(kinds);
      expect(kinds).toContain(k);
    });

    it("B15-R1 / pick on a plain readonly T[] returns T | undefined", () => {
      // Pin: the inferred return type of pick(readonly T[]) MUST allow
      // undefined. Today this also fails typecheck because the only overload
      // demands a non-empty tuple.
      const items: readonly string[] = ["alpha", "beta"];
      const p = createPrng(1);
      const v: string | undefined = p.pick(items);
      expect(items).toContain(v);
    });

    it("B15-R1 / pick on an empty readonly T[] returns undefined (no throw, no null)", () => {
      const empty: readonly string[] = [];
      const p = createPrng(42);
      // MUST NOT throw, MUST return undefined.
      const result: string | undefined = p.pick(empty);
      expect(result).toBeUndefined();
    });

    it("B15-R1 / non-empty plain array always returns one of its elements", () => {
      const items: readonly number[] = [10, 20, 30];
      for (let seed = 0; seed < 50; seed++) {
        const v = createPrng(seed).pick(items);
        expect(v).not.toBeUndefined();
        expect(items).toContain(v);
      }
    });

    it("B15-R1 / deterministic for the same seed under the plain-array overload", () => {
      const items: readonly string[] = ["x", "y", "z"];
      const a = createPrng(123).pick(items);
      const b = createPrng(123).pick(items);
      expect(a).toBe(b);
    });

    it("B15-R1 / strict-tuple overload still resolves: return type is T (non-undefined)", () => {
      // Regression guard for the EXISTING strict-tuple overload. With `as const`,
      // `items` is `readonly ["a", "b", "c"]`, so the strict-tuple overload MUST
      // resolve first and the return type MUST be the tuple-element union with
      // NO `| undefined`. The assignment `const v: "a" | "b" | "c" = ...` will
      // fail typecheck if the new plain-array overload subsumes the tuple one
      // (e.g. due to ordering — the strict-tuple overload MUST appear first).
      const items = ["a", "b", "c"] as const;
      const v: "a" | "b" | "c" = createPrng(7).pick(items);
      expect(items).toContain(v);
    });

    // -- B15-R2 (type-level assignability pins) ------------------------------

    it("B15-R2 / shuffle is pinned on the shared Prng interface", () => {
      // Type-level pin: if `shuffle` is ever dropped from `Prng` or its
      // signature weakened, this assignment fails `pnpm typecheck`. Both the
      // type alias and the runtime assignment must type-check.
      type _PinShuffle = <T>(items: readonly T[]) => T[];
      const p: Prng = createPrng(1);
      const _shuffle: _PinShuffle = p.shuffle;
      expect(typeof _shuffle).toBe("function");
    });

    it("B15-R2 / sample is pinned on the shared Prng interface", () => {
      // Type-level pin: if `sample` is ever dropped from `Prng` or its
      // signature weakened, this assignment fails `pnpm typecheck`.
      type _PinSample = <T>(items: readonly T[], count: number) => T[];
      const p: Prng = createPrng(1);
      const _sample: _PinSample = p.sample;
      expect(typeof _sample).toBe("function");
    });

    it("B15-R2 / a Prng-typed runtime instance still exposes shuffle and sample", () => {
      // Runtime sanity assignment matching the type-level pin above.
      const p: Prng = createPrng(42);
      const shuffled: number[] = p.shuffle([1, 2, 3]);
      const sampled: number[] = p.sample([1, 2, 3], 2);
      expect(shuffled).toHaveLength(3);
      expect(sampled).toHaveLength(2);
    });
  });

  describe("shuffle()", () => {
    it("is deterministic: same seed produces the same order", () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8];
      const a = createPrng(42).shuffle(items);
      const b = createPrng(42).shuffle(items);
      expect(a).toEqual(b);
    });

    it("is a permutation: same length and same elements", () => {
      const items = ["a", "b", "c", "d", "e"];
      const result = createPrng(7).shuffle(items);
      expect(result).toHaveLength(items.length);
      expect([...result].sort()).toEqual([...items].sort());
    });

    it("does not mutate the input array", () => {
      const items = [1, 2, 3, 4, 5];
      const copy = [...items];
      createPrng(3).shuffle(items);
      expect(items).toEqual(copy);
    });

    it("handles empty and single-element arrays", () => {
      const prng = createPrng(1);
      expect(prng.shuffle([])).toEqual([]);
      expect(prng.shuffle(["x"])).toEqual(["x"]);
    });
  });

  describe("sample()", () => {
    it("returns exactly `count` distinct elements drawn from the input", () => {
      const items = [10, 20, 30, 40, 50, 60];
      const result = createPrng(42).sample(items, 3);
      expect(result).toHaveLength(3);
      expect(new Set(result).size).toBe(3);
      for (const v of result) expect(items).toContain(v);
    });

    it("is deterministic: same seed produces the same sample", () => {
      const items = ["a", "b", "c", "d", "e", "f"];
      const a = createPrng(99).sample(items, 4);
      const b = createPrng(99).sample(items, 4);
      expect(a).toEqual(b);
    });

    it("clamps count greater than the array length to the array length", () => {
      const items = [1, 2, 3];
      const result = createPrng(5).sample(items, 10);
      expect(result).toHaveLength(3);
      expect([...result].sort((x, y) => x - y)).toEqual([1, 2, 3]);
    });

    it("returns an empty array for zero or negative counts", () => {
      const prng = createPrng(5);
      expect(prng.sample([1, 2, 3], 0)).toEqual([]);
      expect(prng.sample([1, 2, 3], -2)).toEqual([]);
    });
  });

  describe("fork()", () => {
    it("produces the same sequence for the same key and parent seed", () => {
      const child1 = createPrng(42).fork("fieldA");
      const child2 = createPrng(42).fork("fieldA");
      expect(child1.random()).toBe(child2.random());
      expect(child1.random()).toBe(child2.random());
    });

    it("different keys produce different sequences", () => {
      const parent = createPrng(42);
      const child1 = parent.fork("fieldA");
      const child2 = parent.fork("fieldB");
      expect(child1.random()).not.toBe(child2.random());
    });

    it("consuming the parent does not affect an existing fork", () => {
      const parent = createPrng(42);
      const child = parent.fork("field");
      const v1 = child.random();
      // advance parent's state
      parent.random();
      parent.random();
      parent.random();
      // child is independent — re-creating it from the same seed gives same value
      const childCopy = createPrng(42).fork("field");
      expect(childCopy.random()).toBe(v1);
    });
  });
});

describe("fieldSeed", () => {
  it("is deterministic", () => {
    expect(fieldSeed(42, "person#1", "firstName")).toBe(fieldSeed(42, "person#1", "firstName"));
  });

  it("returns a number", () => {
    expect(typeof fieldSeed(42, "person#1", "email")).toBe("number");
  });

  it("different field paths produce different seeds", () => {
    const a = fieldSeed(42, "person#1", "firstName");
    const b = fieldSeed(42, "person#1", "lastName");
    expect(a).not.toBe(b);
  });

  it("different subject IDs produce different seeds", () => {
    const a = fieldSeed(42, "person#1", "firstName");
    const b = fieldSeed(42, "person#2", "firstName");
    expect(a).not.toBe(b);
  });

  it("different world seeds produce different field seeds", () => {
    const a = fieldSeed(42, "person#1", "email");
    const b = fieldSeed(99, "person#1", "email");
    expect(a).not.toBe(b);
  });

  it("field seeds are independent: no field affects another", () => {
    // Simulate "adding middleName" — existing field seeds must remain stable
    const emailSeed = fieldSeed(42, "person#1", "email");
    const ageSeed = fieldSeed(42, "person#1", "age");
    const middleNameSeed = fieldSeed(42, "person#1", "middleName");

    expect(fieldSeed(42, "person#1", "email")).toBe(emailSeed);
    expect(fieldSeed(42, "person#1", "age")).toBe(ageSeed);
    // middleName seed is its own value and does not equal others
    expect(middleNameSeed).not.toBe(emailSeed);
    expect(middleNameSeed).not.toBe(ageSeed);
  });
});
