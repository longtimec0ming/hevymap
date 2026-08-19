import { describe, expect, it } from "vitest";
import { computeTrendDelta } from "./trend-delta";

describe("computeTrendDelta", () => {
  it("returns only recentAvg when fewer than 8 weeks of data", () => {
    const result = computeTrendDelta([2, 4, 6, 8]);
    expect(result.recentAvg).toBe(5);
    expect(result.priorAvg).toBeNull();
    expect(result.delta).toBeNull();
  });

  it("returns only recentAvg with exactly 7 weeks", () => {
    const result = computeTrendDelta([1, 2, 3, 4, 5, 6, 7]);
    expect(result.recentAvg).toBeCloseTo((4 + 5 + 6 + 7) / 4);
    expect(result.priorAvg).toBeNull();
  });

  it("compares last 4 weeks against the prior 4 weeks with exactly 8 weeks", () => {
    const result = computeTrendDelta([10, 10, 10, 10, 20, 20, 20, 20]);
    expect(result.priorAvg).toBe(10);
    expect(result.recentAvg).toBe(20);
    expect(result.delta).toBe(10);
  });

  it("only uses the last 8 weeks when more data is available", () => {
    const older = [100, 100, 100, 100, 100, 100, 100, 100];
    const relevant = [10, 10, 10, 10, 20, 20, 20, 20];
    const result = computeTrendDelta([...older, ...relevant]);
    expect(result.priorAvg).toBe(10);
    expect(result.recentAvg).toBe(20);
    expect(result.delta).toBe(10);
  });

  it("computes a negative delta when volume drops", () => {
    const result = computeTrendDelta([20, 20, 20, 20, 5, 5, 5, 5]);
    expect(result.delta).toBe(-15);
  });

  it("handles an empty series", () => {
    const result = computeTrendDelta([]);
    expect(result.recentAvg).toBe(0);
    expect(result.priorAvg).toBeNull();
    expect(result.delta).toBeNull();
  });
});
