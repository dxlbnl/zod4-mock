import { describe, it, expect } from "vitest";
import { deepMerge } from "../../../src/utils/merge.js";

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
