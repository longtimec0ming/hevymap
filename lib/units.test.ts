import { describe, expect, it } from "vitest";
import { convertWeight, formatWeight, kgToLbs, lbsToKg } from "./units";

describe("kgToLbs / lbsToKg", () => {
  it("converts a known reference value", () => {
    expect(kgToLbs(100)).toBeCloseTo(220.462, 2);
  });

  it("round-trips kg -> lbs -> kg", () => {
    const kg = 82.5;
    expect(lbsToKg(kgToLbs(kg))).toBeCloseTo(kg, 9);
  });

  it("round-trips lbs -> kg -> lbs", () => {
    const lbs = 315;
    expect(kgToLbs(lbsToKg(lbs))).toBeCloseTo(lbs, 9);
  });

  it("zero maps to zero in both directions", () => {
    expect(kgToLbs(0)).toBe(0);
    expect(lbsToKg(0)).toBe(0);
  });
});

describe("convertWeight", () => {
  it("passes kg through unchanged when unit is kg", () => {
    expect(convertWeight(123.4, "kg")).toBe(123.4);
  });

  it("converts to lbs when unit is lbs", () => {
    expect(convertWeight(100, "lbs")).toBeCloseTo(220.462, 2);
  });
});

describe("formatWeight", () => {
  it("formats kg rounded to the nearest whole unit with a suffix", () => {
    expect(formatWeight(1234.6, "kg")).toBe("1,235 kg");
  });

  it("formats lbs converted and rounded with a suffix", () => {
    expect(formatWeight(100, "lbs")).toBe("220 lbs");
  });

  it("rounds down to zero cleanly", () => {
    expect(formatWeight(0, "kg")).toBe("0 kg");
    expect(formatWeight(0, "lbs")).toBe("0 lbs");
  });
});
