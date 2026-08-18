import { describe, expect, it } from "vitest";
import { rebalance } from "./rebalance";

function sum(map: Record<string, number>): number {
  return Object.values(map).reduce((total, v) => total + v, 0);
}

describe("lib/rebalance", () => {
  it("scales other non-zero unlocked entries proportionally", () => {
    const result = rebalance({ a: 0.5, b: 0.3, c: 0.2 }, "a", 0.6);
    expect(result.a).toBeCloseTo(0.6, 5);
    expect(result.b).toBeCloseTo(0.24, 5);
    expect(result.c).toBeCloseTo(0.16, 5);
    expect(sum(result)).toBeCloseTo(1, 6);
  });

  it("leaves the ratio between unlocked others unchanged", () => {
    const result = rebalance({ a: 0.5, b: 0.3, c: 0.2 }, "a", 0.6);
    // b:c was 3:2 before, must stay 3:2 after.
    expect(result.b / result.c).toBeCloseTo(0.3 / 0.2, 5);
  });

  it("clamps the requested value to [0, 1]", () => {
    const high = rebalance({ a: 0.5, b: 0.5 }, "a", 5);
    expect(high.a).toBe(1);
    expect(high.b).toBe(0);
    expect(sum(high)).toBeCloseTo(1, 6);

    const low = rebalance({ a: 0.5, b: 0.5 }, "a", -5);
    expect(low.a).toBe(0);
    expect(low.b).toBe(1);
    expect(sum(low)).toBeCloseTo(1, 6);
  });

  it("newValue = 1 zeroes every other unlocked entry", () => {
    const result = rebalance({ a: 0.2, b: 0.3, c: 0.5 }, "a", 1);
    expect(result).toEqual({ a: 1, b: 0, c: 0 });
  });

  it("newValue = 0 (removing a muscle) redistributes its share proportionally", () => {
    const result = rebalance({ a: 0.5, b: 0.3, c: 0.2 }, "a", 0);
    expect(result.a).toBe(0);
    expect(result.b).toBeCloseTo(0.6, 5);
    expect(result.c).toBeCloseTo(0.4, 5);
    expect(sum(result)).toBeCloseTo(1, 6);
  });

  it("locked entries are never modified and keep their value out of the scaled pool", () => {
    const result = rebalance({ a: 0.5, b: 0.3, c: 0.2 }, "a", 0.6, new Set(["c"]));
    expect(result.c).toBe(0.2); // untouched
    expect(result.a).toBeCloseTo(0.6, 5);
    expect(result.b).toBeCloseTo(0.2, 5); // absorbs the entire 0.2 remaining budget
    expect(sum(result)).toBeCloseTo(1, 6);
  });

  it("clamps the requested value so a locked entry's budget is never stolen", () => {
    // b is locked at 0.5, so a+c can never exceed 0.5 combined; requesting
    // a=0.9 is impossible without touching b, so it's clamped to 0.5.
    const result = rebalance({ a: 0.1, b: 0.5, c: 0.4 }, "a", 0.9, new Set(["b"]));
    expect(result.a).toBe(0.5);
    expect(result.b).toBe(0.5);
    expect(result.c).toBe(0);
    expect(sum(result)).toBeCloseTo(1, 6);
  });

  it("all unlocked others at zero: splits the remaining budget equally", () => {
    const result = rebalance({ a: 0.5, b: 0, c: 0 }, "a", 0.2);
    expect(result.a).toBe(0.2);
    expect(result.b).toBeCloseTo(0.4, 5);
    expect(result.c).toBeCloseTo(0.4, 5);
    expect(sum(result)).toBeCloseTo(1, 6);
  });

  it("no unlocked others exist: changedId is forced to absorb the leftover budget", () => {
    // b is locked at 0.5 and is the only other entry, so a has nowhere to
    // send/receive slack from — it must land on exactly 0.5, regardless of
    // the 0.2 that was requested.
    const result = rebalance({ a: 0.5, b: 0.5 }, "a", 0.2, new Set(["b"]));
    expect(result.a).toBe(0.5);
    expect(result.b).toBe(0.5);
    expect(sum(result)).toBeCloseTo(1, 6);
  });

  it("everything locked except changedId: changedId takes the full remainder", () => {
    const result = rebalance({ a: 0.2, b: 0.3, c: 0.5 }, "a", 0.9, new Set(["b", "c"]));
    expect(result.a).toBeCloseTo(0.2, 5); // 1 - 0.3 - 0.5
    expect(result.b).toBe(0.3);
    expect(result.c).toBe(0.5);
  });

  it("rounds to 3dp and fixes drift on the largest unlocked entry so the total is exactly 1", () => {
    const result = rebalance({ a: 1 / 3, b: 1 / 3, c: 1 / 3 }, "a", 0.5);
    const total = sum(result);
    expect(total).toBe(1);
    for (const v of Object.values(result)) {
      expect(Number.isInteger(v * 1000)).toBe(true); // 3dp
    }
  });

  it("does not mutate the input map", () => {
    const input = { a: 0.5, b: 0.3, c: 0.2 };
    const copy = { ...input };
    rebalance(input, "a", 0.9);
    expect(input).toEqual(copy);
  });

  it("does not introduce keys that weren't in the input", () => {
    const result = rebalance({ a: 0.5, b: 0.5 }, "a", 0.3);
    expect(Object.keys(result).sort()).toEqual(["a", "b"]);
  });

  it("single-entry map: changed value is forced to 1", () => {
    const result = rebalance({ a: 0.5 }, "a", 0.3);
    expect(result).toEqual({ a: 1 });
  });
});
