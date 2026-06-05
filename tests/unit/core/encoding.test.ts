/**
 * Unit tests for src/utils/encoding.ts — toBase64.
 *
 * In Node.js, `Buffer` is always defined so the primary branch is the only
 * one exercised naturally. The btoa and bare-fallback branches are reachable
 * in browser environments. We cover them by temporarily removing / replacing
 * the globals so v8 coverage registers all three paths.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toBase64 — Buffer branch (Node default)", () => {
  it("encodes a plain ASCII string", async () => {
    const { toBase64 } = await import("../../../src/utils/encoding.js");
    expect(toBase64("hello")).toBe("aGVsbG8=");
  });

  it("encodes an empty string", async () => {
    const { toBase64 } = await import("../../../src/utils/encoding.js");
    expect(toBase64("")).toBe("");
  });
});

describe("toBase64 — btoa branch (Buffer absent)", () => {
  it("falls through to btoa when Buffer is undefined", async () => {
    // Stub Buffer away so the first branch is skipped.
    vi.stubGlobal("Buffer", undefined);
    // Re-import to get a fresh evaluation with the stub in place.
    // Use a cache-busting query so Vitest re-evaluates the module.
    const mod = await import("../../../src/utils/encoding.js?btoa-branch");
    expect(mod.toBase64("hello")).toBe("aGVsbG8=");
  });
});

describe("toBase64 — bare fallback (Buffer and btoa both absent)", () => {
  it("returns the original string when neither Buffer nor btoa exist", async () => {
    vi.stubGlobal("Buffer", undefined);
    vi.stubGlobal("btoa", undefined);
    const mod = await import("../../../src/utils/encoding.js?bare-fallback");
    expect(mod.toBase64("hello")).toBe("hello");
  });
});
