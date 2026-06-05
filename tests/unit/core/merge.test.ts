import { describe, it, expect } from "vitest";
import { deepMerge, deepEqual } from "../../../src/utils/merge.js";

describe("deepMerge utility", () => {
  it("merges nested objects", () => {
    const obj1 = { a: 1, nested: { b: 2 } };
    const obj2 = { c: 3, nested: { d: 4 } };
    const result = deepMerge(obj1, obj2) as any;
    expect(result.a).toBe(1);
    expect(result.c).toBe(3);
    expect(result.nested.b).toBe(2);
    expect(result.nested.d).toBe(4);
  });

  it("overwrites primitives", () => {
    expect(deepMerge(1, 2)).toBe(2);
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("merges structures from bug-hunt", () => {
    const s1 = { person: { name: "alice" } };
    const s2 = { person: { age: 30 } };
    const result = deepMerge(s1, s2) as any;
    expect(result.person.name).toBe("alice");
    expect(result.person.age).toBe(30);
  });
});

describe("deepEqual utility", () => {
  it("primitives — same value", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true); // Object.is semantics
  });

  it("primitives — different value", () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "b")).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it("object vs non-object", () => {
    expect(deepEqual({}, null)).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual(1, {})).toBe(false);
  });

  it("arrays — equal", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([], [])).toBe(true);
    expect(deepEqual([[1], [2]], [[1], [2]])).toBe(true);
  });

  it("arrays — different length", () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("arrays — different element", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it("array vs object", () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({}, [])).toBe(false);
  });

  it("plain objects — equal", () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });

  it("plain objects — different key count", () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("plain objects — missing key in b", () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it("plain objects — different value", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});
