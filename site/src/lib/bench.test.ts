import { describe, it, expect } from "vitest";
import { measure } from "./bench";

describe("measure", () => {
  it("returns a result with all fields", () => {
    const result = measure(() => {}, { budgetMs: 25 });
    expect(result).toHaveProperty("avg");
    expect(result).toHaveProperty("min");
    expect(result).toHaveProperty("max");
    expect(result).toHaveProperty("opsPerSec");
    expect(result).toHaveProperty("coldStart");
    expect(result).toHaveProperty("runs");
  });

  it("coldStart is the first call duration", () => {
    let callCount = 0;
    const result = measure(
      () => {
        callCount++;
      },
      { warmup: 0, budgetMs: 25 },
    );
    // coldStart + warmup(0) + runs(actual) = 1 + runs total calls
    expect(callCount).toBe(1 + result.runs);
    expect(result.coldStart).toBeGreaterThanOrEqual(0);
  });

  it("runs warmup + budget iterations after cold start", () => {
    let callCount = 0;
    const result = measure(
      () => {
        callCount++;
      },
      { warmup: 3, budgetMs: 25 },
    );
    // 1 cold start + 3 warmup + runs (actual) = 4 + runs
    expect(callCount).toBe(1 + 3 + result.runs);
  });

  it("min <= avg <= max", () => {
    const result = measure(() => {}, { warmup: 2, budgetMs: 25 });
    expect(result.min).toBeLessThanOrEqual(result.avg);
    expect(result.avg).toBeLessThanOrEqual(result.max);
  });

  it("opsPerSec is positive", () => {
    const result = measure(() => {}, { warmup: 1, budgetMs: 25 });
    expect(result.opsPerSec).toBeGreaterThan(0);
  });
});
