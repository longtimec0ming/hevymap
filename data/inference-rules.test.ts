import { describe, expect, it } from "vitest";
import { isValidSubMuscleId } from "./taxonomy";
import { COARSE_GROUP_CONTRIBUTIONS, COARSE_GROUP_TO_REGION, inferContributions } from "./inference-rules";

const SUM_TOLERANCE = 0.001;

function sum(contributions: Record<string, number | undefined>): number {
  return Object.values(contributions).reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

describe("inferContributions — keyword rules", () => {
  it.each([
    ["Incline Bench Press (Barbell)", { upper_chest: 0.55, front_delt: 0.25, triceps_lat_med: 0.13, triceps_long: 0.07 }],
    ["Bench Press (Barbell)", { mid_chest: 0.55, front_delt: 0.2, triceps_lat_med: 0.15, triceps_long: 0.1 }],
    ["Lateral Raise (Dumbbell)", { side_delt: 0.9, front_delt: 0.1 }],
    ["Face Pull (Cable)", { rear_delt: 0.6, mid_traps_rhomboids: 0.25, upper_traps: 0.15 }],
    ["Reverse Fly (Machine)", { rear_delt: 0.65, mid_traps_rhomboids: 0.25, side_delt: 0.1 }],
    ["Close Grip Bench Press (Barbell)", { triceps_lat_med: 0.35, triceps_long: 0.3, mid_chest: 0.2, front_delt: 0.15 }],
    ["Hammer Curl (Dumbbell)", { brachialis_brachioradialis: 0.6, biceps: 0.25, forearms: 0.15 }],
    ["Bicep Curl (Dumbbell)", { biceps: 0.75, brachialis_brachioradialis: 0.25 }],
    ["Squat (Barbell)", { quads_vasti: 0.35, quads_rectus_femoris: 0.2, glute_max: 0.3, adductors: 0.15 }],
    ["Seated Calf Raise", { soleus: 0.75, gastrocnemius: 0.25 }],
    ["Standing Calf Raise", { gastrocnemius: 0.7, soleus: 0.3 }],
  ])("infers %s correctly", (name, expected) => {
    const result = inferContributions({ name });
    expect(result).toEqual(expected);
  });

  it("returns undefined for a name with no keyword match and no coarse tag", () => {
    expect(inferContributions({ name: "Totally Unrecognized Contraption" })).toBeUndefined();
  });

  it("falls back to the coarse muscle group table when no keyword matches", () => {
    const result = inferContributions({ name: "Totally Unrecognized Contraption", primaryMuscleGroup: "biceps" });
    expect(result).toEqual(COARSE_GROUP_CONTRIBUTIONS.biceps);
  });

  it("keyword rules take precedence over the coarse group table", () => {
    // "Squat" matches a keyword rule even though primaryMuscleGroup points
    // at a different coarse table entry.
    const result = inferContributions({ name: "Squat (Barbell)", primaryMuscleGroup: "glutes" });
    expect(result).not.toEqual(COARSE_GROUP_CONTRIBUTIONS.glutes);
    expect(result).toHaveProperty("quads_vasti");
  });
});

describe("inference tables — every entry validates", () => {
  it("every keyword-rule contribution map uses valid sub-muscle ids and sums to 1.0", () => {
    const cases = [
      "Incline Bench Press (Barbell)",
      "Decline Bench Press (Barbell)",
      "Chest Fly (Machine)",
      "Close Grip Bench Press (Barbell)",
      "Bench Press (Barbell)",
      "Push Up",
      "Lateral Raise (Dumbbell)",
      "Front Raise (Dumbbell)",
      "Reverse Fly (Machine)",
      "Face Pull (Cable)",
      "Overhead Press (Barbell)",
      "Upright Row (Barbell)",
      "Shrug (Barbell)",
      "Lat Pulldown (Cable)",
      "Pull Up",
      "Seated Row (Cable)",
      "Deadlift (Barbell)",
      "Good Morning (Barbell)",
      "Back Extension",
      "Hammer Curl (Dumbbell)",
      "Bicep Curl (Dumbbell)",
      "Reverse Curl (Barbell)",
      "Wrist Curl (Dumbbell)",
      "Skull Crusher (Barbell)",
      "Tricep Pushdown (Cable)",
      "Dip (Assisted)",
      "Oblique Crunch",
      "Plank",
      "Crunch",
      "Leg Extension (Machine)",
      "Leg Curl (Machine)",
      "Romanian Deadlift (Barbell)",
      "Hip Thrust (Barbell)",
      "Bulgarian Split Squat (Dumbbell)",
      "Leg Press (Machine)",
      "Squat (Barbell)",
      "Adductor (Machine)",
      "Seated Calf Raise",
      "Standing Calf Raise",
    ];

    for (const name of cases) {
      const result = inferContributions({ name });
      expect(result, `no rule matched "${name}"`).toBeDefined();
      const contributions = result!;
      for (const key of Object.keys(contributions)) {
        expect(isValidSubMuscleId(key), `"${key}" from rule for "${name}" is not a canonical sub-muscle id`).toBe(
          true,
        );
      }
      expect(sum(contributions), `contributions for "${name}" should sum to ~1.0`).toBeCloseTo(1, 2);
    }
  });

  it("every COARSE_GROUP_CONTRIBUTIONS entry uses valid sub-muscle ids and sums to 1.0", () => {
    for (const [group, contributions] of Object.entries(COARSE_GROUP_CONTRIBUTIONS)) {
      for (const key of Object.keys(contributions)) {
        expect(isValidSubMuscleId(key), `"${key}" for coarse group "${group}" is not a canonical sub-muscle id`).toBe(
          true,
        );
      }
      expect(sum(contributions), `coarse group "${group}" should sum to ~1.0`).toBeGreaterThan(1 - SUM_TOLERANCE);
      expect(sum(contributions)).toBeLessThan(1 + SUM_TOLERANCE);
    }
  });

  it("every COARSE_GROUP_TO_REGION value is a real taxonomy region", () => {
    const KNOWN_REGIONS = new Set(["Shoulders", "Chest", "Back", "Arms", "Core", "Legs"]);
    for (const [group, region] of Object.entries(COARSE_GROUP_TO_REGION)) {
      expect(KNOWN_REGIONS.has(region), `"${group}" maps to unknown region "${region}"`).toBe(true);
    }
  });
});
