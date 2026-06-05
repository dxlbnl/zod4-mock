/**
 * Regression: bench writeback left `latest.json` without a trailing newline.
 *
 * `JSON.stringify(value, null, 2)` produces no final `\n`, so every
 * `pnpm bench` run rewrote `site/bench/results/latest.json` without a
 * trailing newline, leaving the working tree fmt-dirty and failing
 * `pnpm fmt:check` (inside `pnpm validate`). `serializeJson` appends
 * exactly one newline.
 */

import { describe, expect, it } from "vitest";

import { serializeJson } from "./write-json.ts";

describe("serializeJson (bench writeback trailing-newline regression)", () => {
  const obj = { timestamp: "2026-06-05T00:00:00.000Z", results: { simple: { avg: 1.23 } } };

  it("ends with exactly one trailing newline", () => {
    const out = serializeJson(obj);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });

  it("round-trips back to the original value", () => {
    expect(JSON.parse(serializeJson(obj))).toEqual(obj);
  });

  it("is 2-space indented", () => {
    expect(serializeJson(obj)).toContain('\n  "');
  });
});
