import { describe, expect, it } from "vitest";
import { filterAndSortExercises, type ExerciseFilterItem } from "./exercise-filters";

function item(overrides: Partial<ExerciseFilterItem> & Pick<ExerciseFilterItem, "id" | "name">): ExerciseFilterItem {
  return {
    contributions: {},
    source: "repo_map",
    confidence: "high",
    ...overrides,
  };
}

const ITEMS: ExerciseFilterItem[] = [
  item({
    id: "1",
    name: "Incline Bench Press (Barbell)",
    contributions: { upper_chest: 0.55, front_delt: 0.25, triceps_lat_med: 0.13, triceps_long: 0.07 },
    source: "repo_map",
    confidence: "high",
    equipment: "barbell",
  }),
  item({
    id: "2",
    name: "Face Pull (Cable)",
    contributions: { rear_delt: 0.55, mid_traps_rhomboids: 0.3, upper_traps: 0.15 },
    source: "repo_map",
    confidence: "medium",
    equipment: "cable",
  }),
  item({
    id: "3",
    name: "Reverse Fly (Dumbbell)",
    contributions: { rear_delt: 0.65, mid_traps_rhomboids: 0.35 },
    source: "inference",
    confidence: undefined,
    equipment: "dumbbell",
  }),
  item({
    id: "4",
    name: "Some Custom Machine Row",
    contributions: { lats_upper: 0.16, mid_traps_rhomboids: 0.14, rear_delt: 0.1, biceps: 0.6 },
    source: "fallback",
    confidence: undefined,
    equipment: "machine",
    isCustom: true,
  }),
  item({
    id: "5",
    name: "Cable Rear Delt Row",
    contributions: { rear_delt: 0.5, mid_traps_rhomboids: 0.5 },
    source: "override",
    confidence: undefined,
    equipment: "cable",
  }),
];

describe("filterAndSortExercises", () => {
  it("with no criteria, returns everything sorted by name", () => {
    const result = filterAndSortExercises(ITEMS);
    expect(result.map((r) => r.id)).toEqual(["5", "2", "1", "3", "4"]);
  });

  it("threshold: excludes items below the contribution threshold for the selected muscle", () => {
    const result = filterAndSortExercises(ITEMS, { muscleIds: ["rear_delt"], threshold: 0.15 });
    // item "4" contributes 0.10 to rear_delt, below 0.15 -> excluded.
    expect(result.map((r) => r.id).sort()).toEqual(["2", "3", "5"]);
  });

  it("threshold: a stricter threshold narrows further", () => {
    const result = filterAndSortExercises(ITEMS, { muscleIds: ["rear_delt"], threshold: 0.6 });
    expect(result.map((r) => r.id)).toEqual(["3"]);
  });

  it("threshold: 'any' (0) includes anything with a nonzero contribution", () => {
    const result = filterAndSortExercises(ITEMS, { muscleIds: ["rear_delt"], threshold: 0 });
    expect(result.map((r) => r.id).sort()).toEqual(["2", "3", "4", "5"]);
  });

  it("multi-muscle OR: matches if ANY selected muscle clears the threshold", () => {
    const result = filterAndSortExercises(ITEMS, { muscleIds: ["upper_chest", "lats_upper"], threshold: 0.15 });
    expect(result.map((r) => r.id).sort()).toEqual(["1", "4"]);
  });

  it("equipment: OR match against selected equipment", () => {
    const result = filterAndSortExercises(ITEMS, { equipment: ["barbell", "machine"] });
    expect(result.map((r) => r.id).sort()).toEqual(["1", "4"]);
  });

  it("source filter: 'estimated' matches both inference and fallback", () => {
    const result = filterAndSortExercises(ITEMS, { sourceFilters: ["estimated"] });
    expect(result.map((r) => r.id).sort()).toEqual(["3", "4"]);
  });

  it("source filter: repo-map confidence tiers only match repo_map items at that tier", () => {
    const result = filterAndSortExercises(ITEMS, { sourceFilters: ["high"] });
    expect(result.map((r) => r.id)).toEqual(["1"]);
  });

  it("source filter: 'override' matches only override-sourced items", () => {
    const result = filterAndSortExercises(ITEMS, { sourceFilters: ["override"] });
    expect(result.map((r) => r.id)).toEqual(["5"]);
  });

  it("customOnly: keeps only isCustom items", () => {
    const result = filterAndSortExercises(ITEMS, { customOnly: true });
    expect(result.map((r) => r.id)).toEqual(["4"]);
  });

  it("sort by contribution: descending by max contribution to the selected muscle(s), defaulted when a muscle is selected", () => {
    const result = filterAndSortExercises(ITEMS, { muscleIds: ["rear_delt"], threshold: 0 });
    expect(result.map((r) => r.id)).toEqual(["3", "2", "5", "4"]);
  });

  it("sort by confidence: override > high > medium > low > estimated (ties broken by name)", () => {
    const result = filterAndSortExercises(ITEMS, { sortBy: "confidence" });
    expect(result.map((r) => r.id)).toEqual(["5", "1", "2", "3", "4"]);
  });

  it("sort by name is the default with no muscle selected", () => {
    const result = filterAndSortExercises(ITEMS, { equipment: ["cable"] });
    expect(result.map((r) => r.id)).toEqual(["5", "2"]);
  });
});
