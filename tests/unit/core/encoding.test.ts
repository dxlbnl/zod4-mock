/**
 * Unit tests for src/utils/encoding.ts — toBase64.
 *
 * `toBase64` reads `Buffer` / `btoa` at CALL time, so the three branches are
 * reachable by stubbing the globals before each call — no module re-import
 * needed. In Node the Buffer branch is the default; the btoa and bare
 * fallbacks only fire in restricted/browser environments.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { toBase64 } from "../../../src/utils/encoding.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toBase64 — Buffer branch (Node default)", () => {
  it("encodes a plain ASCII string", () => {
    expect(toBase64("hello")).toBe("aGVsbG8=");
  });

  it("encodes an empty string", () => {
    expect(toBase64("")).toBe("");
  });
});

describe("toBase64 — btoa branch (Buffer absent)", () => {
  it("falls through to btoa when Buffer is undefined", () => {
    // Capture the real Buffer object BEFORE stubbing it away, so the stand-in
    // btoa does not depend on the (now-undefined) global `Buffer` name.
    const RealBuffer = Buffer;
    const realEncode = (s: string): string => RealBuffer.from(s, "binary").toString("base64");
    vi.stubGlobal("Buffer", undefined);
    vi.stubGlobal("btoa", realEncode);
    expect(toBase64("hello")).toBe("aGVsbG8=");
  });
});

describe("toBase64 — bare fallback (Buffer and btoa both absent)", () => {
  it("returns the original string when neither Buffer nor btoa exist", () => {
    vi.stubGlobal("Buffer", undefined);
    vi.stubGlobal("btoa", undefined);
    expect(toBase64("hello")).toBe("hello");
  });
});
