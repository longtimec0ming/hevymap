import { describe, expect, it } from "vitest";
import { getMuscleStatus, percentOfTarget, volumeToColor } from "./color-scale";

describe("percentOfTarget", () => {
  it("returns 0 for zero sets", () => {
    expect(percentOfTarget(0, [10, 20])).toBe(0);
  });

  it("returns 50 for half of the target minimum", () => {
    expect(percentOfTarget(5, [10, 20])).toBe(50);
  });

  it("returns 100 exactly at the target minimum", () => {
    expect(percentOfTarget(10, [10, 20])).toBe(100);
  });

  it("returns >100 above the target minimum", () => {
    expect(percentOfTarget(20, [10, 20])).toBe(200);
  });

  it("does not divide by zero when the band minimum is 0", () => {
    expect(percentOfTarget(0, [0, 5])).toBe(0);
    expect(percentOfTarget(3, [0, 5])).toBe(100);
  });
});

describe("volumeToColor", () => {
  it("returns transparent for zero or negative sets", () => {
    expect(volumeToColor(0, [10, 20])).toBe("transparent");
    expect(volumeToColor(-1, [10, 20])).toBe("transparent");
  });

  it("uses the cold hue family below the target band", () => {
    const color = volumeToColor(2, [10, 20]);
    expect(color).toMatch(/^hsl\(/);
    // Cold end should sit near the 215deg slate hue, not the accent hue.
    const hue = Number(color.match(/hsl\((\d+)/)?.[1]);
    expect(hue).toBeGreaterThan(100);
  });

  it("approaches the accent hue as sets approach the target minimum", () => {
    const nearMin = volumeToColor(9.5, [10, 20]);
    const hue = Number(nearMin.match(/hsl\((\d+)/)?.[1]);
    expect(hue).toBeLessThan(50);
  });

  it("uses the accent hue throughout the in-target band", () => {
    const low = volumeToColor(10, [10, 20]);
    const mid = volumeToColor(15, [10, 20]);
    const high = volumeToColor(20, [10, 20]);
    for (const color of [low, mid, high]) {
      expect(color).toMatch(/^hsl\(22 /);
    }
  });

  it("ramps toward the hot hue above the target band", () => {
    const justOver = volumeToColor(21, [10, 20]);
    const wayOver = volumeToColor(40, [10, 20]);
    const justOverHue = Number(justOver.match(/hsl\((\d+)/)?.[1]);
    const wayOverHue = Number(wayOver.match(/hsl\((\d+)/)?.[1]);
    // Hot hue (4) is numerically less than accent hue (22); overshoot should
    // move the hue further from the accent hue and toward hot as it grows.
    expect(wayOverHue).toBeLessThanOrEqual(justOverHue);
  });

  it("caps the hot ramp at 2x the target maximum", () => {
    const atCap = volumeToColor(40, [10, 20]);
    const wayBeyondCap = volumeToColor(200, [10, 20]);
    expect(atCap).toBe(wayBeyondCap);
  });

  it("does not divide by zero when the band maximum is 0", () => {
    expect(() => volumeToColor(5, [0, 0])).not.toThrow();
  });
});

describe("getMuscleStatus", () => {
  it("bundles sets, tonnage, percent, color and emptiness", () => {
    const status = getMuscleStatus(12, 480, [10, 20]);
    expect(status.sets).toBe(12);
    expect(status.tonnageKg).toBe(480);
    expect(status.percentOfTarget).toBe(120);
    expect(status.isEmpty).toBe(false);
    expect(status.color).toMatch(/^hsl\(/);
  });

  it("flags zero-volume muscles as empty with a transparent color", () => {
    const status = getMuscleStatus(0, 0, [10, 20]);
    expect(status.isEmpty).toBe(true);
    expect(status.color).toBe("transparent");
  });
});
