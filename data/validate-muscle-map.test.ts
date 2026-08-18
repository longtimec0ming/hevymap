import { describe, expect, it } from "vitest";
import muscleMap from "./muscle-map.json";
import type { MuscleMapEntry } from "./types";
import { validateMuscleMap } from "./validate-muscle-map";

describe("validateMuscleMap", () => {
  it("passes on a correctly-summing fixture entry", () => {
    const fixture: MuscleMapEntry[] = [
      {
        hevy_id: "05293BCA",
        name: "Incline Bench Press (Barbell)",
        contributions: {
          upper_chest: 0.55,
          front_delt: 0.25,
          triceps_lat_med: 0.13,
          triceps_long: 0.07,
        },
        confidence: "high",
        notes: "Assumes 30-45 degree incline",
      },
    ];

    const result = validateMuscleMap(fixture);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails when contributions fall short of 1.0", () => {
    const fixture: MuscleMapEntry[] = [
      {
        hevy_id: "BAD001",
        name: "Bad Exercise (Short Sum)",
        contributions: {
          upper_chest: 0.5,
          front_delt: 0.2,
        },
        confidence: "low",
      },
    ];

    const result = validateMuscleMap(fixture);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/sum to/);
  });

  it("fails when a contribution key is a coarse/invalid muscle group", () => {
    const fixture: MuscleMapEntry[] = [
      {
        hevy_id: "BAD002",
        name: "Bad Exercise (Coarse Key)",
        contributions: {
          chest: 0.6,
          triceps: 0.4,
        },
        confidence: "low",
      },
    ];

    const result = validateMuscleMap(fixture);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/invalid contribution key/);
  });

  it("validates the real data/muscle-map.json file", () => {
    const result = validateMuscleMap(muscleMap as unknown as MuscleMapEntry[]);
    if (!result.valid) {
      console.error(result.errors);
    }
    expect(result.valid).toBe(true);
  });
});
