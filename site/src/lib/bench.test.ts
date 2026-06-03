import { describe, it, expect } from "vitest";
import { measure } from "./bench";

describe("measure", () => {
  it("returns a result with all fields", () => {
    const result = measure(() => {});
    expect(result).toHaveProperty("avg");
    expect(result).toHaveProperty("min");
    expect(result).toHaveProperty("max");
    expect(result).toHaveProperty("opsPerSec");
    expect(result).toHaveProperty("coldStart");
  });

  it("coldStart is the first call duration", () => {
    let callCount = 0;
    const result = measure(
      () => {
        callCount++;
      },
      { warmup: 0, runs: 1 },
    );
    // coldStart + warmup(0) + runs(1) = 2 total calls
    expect(callCount).toBe(2);
    expect(result.coldStart).toBeGreaterThanOrEqual(0);
  });

  it("runs warmup + runs iterations after cold start", () => {
    let callCount = 0;
    measure(
      () => {
        callCount++;
      },
      { warmup: 3, runs: 5 },
    );
    // 1 cold start + 3 warmup + 5 timed = 9
    expect(callCount).toBe(9);
  });

  it("min <= avg <= max", () => {
    const result = measure(() => {}, { warmup: 2, runs: 10 });
    expect(result.min).toBeLessThanOrEqual(result.avg);
    expect(result.avg).toBeLessThanOrEqual(result.max);
  });

  it("opsPerSec is positive", () => {
    const result = measure(() => {}, { warmup: 1, runs: 5 });
    expect(result.opsPerSec).toBeGreaterThan(0);
  });
});
