import { describe, expect, it } from "vitest";
import { isValidSubMuscleId, SUB_MUSCLE_IDS, TAXONOMY, type SubMuscleId } from "../data/taxonomy";
import type { MuscleMap } from "../data/types";
import { validateEntry } from "../data/validate-muscle-map";
import type { HevyExercise, HevyExerciseTemplate, HevySet, HevyWorkout } from "./hevy";
import type { OverridesMap } from "./overrides";
import {
  accumulateExerciseVolume,
  computeExerciseVolume,
  computeVolumeByMuscle,
  resolveExerciseMapping,
  type ContributionMap,
  type VolumeByMuscle,
} from "./volume";

function sumContributions(contributions: ContributionMap): number {
  return Object.values(contributions).reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

function makeSet(overrides: Partial<HevySet> = {}): HevySet {
  return {
    index: 0,
    type: "normal",
    weight_kg: 100,
    reps: 10,
    distance_meters: null,
    duration_seconds: null,
    rpe: null,
    custom_metric: null,
    ...overrides,
  };
}

function makeExercise(overrides: Partial<HevyExercise> = {}): HevyExercise {
  return {
    index: 0,
    title: "Bench Press (Barbell)",
    notes: "",
    exercise_template_id: "tpl-1",
    superset_id: null,
    sets: [makeSet()],
    ...overrides,
  };
}

function makeWorkout(overrides: Partial<HevyWorkout> = {}): HevyWorkout {
  return {
    id: "w1",
    title: "Push Day",
    routine_id: null,
    description: "",
    start_time: "2026-08-18T12:00:00+00:00",
    end_time: "2026-08-18T13:00:00+00:00",
    updated_at: "2026-08-18T13:00:00.000Z",
    created_at: "2026-08-18T12:00:00.000Z",
    exercises: [makeExercise()],
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<HevyExerciseTemplate> = {}): HevyExerciseTemplate {
  return {
    id: "tpl-1",
    title: "Bench Press (Barbell)",
    type: "weight_reps",
    primary_muscle_group: "chest",
    secondary_muscle_groups: [],
    equipment: "barbell",
    is_custom: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Resolution precedence
// ---------------------------------------------------------------------------

describe("resolveExerciseMapping — precedence", () => {
  it("uses the user override when present, even if a repo map entry exists", () => {
    const overrides: OverridesMap = { "tpl-1": { biceps: 1.0 } };
    const repoMap: MuscleMap = [
      { hevy_id: "tpl-1", name: "Bench Press (Barbell)", contributions: { mid_chest: 1.0 }, confidence: "high" },
    ];

    const result = resolveExerciseMapping(
      { id: "tpl-1", name: "Bench Press (Barbell)" },
      { overrides, repoMap },
    );

    expect(result.source).toBe("override");
    expect(result.contributions).toEqual({ biceps: 1.0 });
  });

  it("falls back to the repo map when there is no override", () => {
    const repoMap: MuscleMap = [
      { hevy_id: "tpl-1", name: "Bench Press (Barbell)", contributions: { mid_chest: 1.0 }, confidence: "high" },
    ];

    const result = resolveExerciseMapping({ id: "tpl-1", name: "Bench Press (Barbell)" }, { repoMap });

    expect(result.source).toBe("repo_map");
    expect(result.contributions).toEqual({ mid_chest: 1.0 });
  });

  it("falls back to inference rules when there is no override or repo map entry", () => {
    const result = resolveExerciseMapping({ id: "tpl-unknown", name: "Lateral Raise (Dumbbell)" }, { repoMap: [] });

    expect(result.source).toBe("inference");
    expect(result.contributions).toEqual({ side_delt: 0.9, front_delt: 0.1 });
  });

  it("prefers the coarse-group inference table over the region even-split when the group is recognized", () => {
    // "chest" is a recognized Hevy coarse tag (COARSE_GROUP_CONTRIBUTIONS has
    // an entry for it), so this resolves via inference, not the last-resort
    // fallback — the fallback layer is reserved for tags with no table entry
    // at all. This documents that precedence rather than re-asserting it.
    const result = resolveExerciseMapping(
      { id: "tpl-unknown", name: "Totally Unrecognized Contraption", primaryMuscleGroup: "chest" },
      { repoMap: [] },
    );

    expect(result.source).toBe("inference");
    const chestIds = TAXONOMY.filter((m) => m.region === "Chest").map((m) => m.id);
    expect(Object.keys(result.contributions).every((id) => chestIds.includes(id as SubMuscleId))).toBe(true);
  });

  it("falls back to an even split across all 26 sub-muscles when the coarse group is unrecognized", () => {
    const result = resolveExerciseMapping(
      { id: "tpl-unknown", name: "Totally Unrecognized Contraption", primaryMuscleGroup: "not-a-real-group" },
      { repoMap: [] },
    );

    expect(result.source).toBe("fallback");
    expect(Object.keys(result.contributions).sort()).toEqual([...SUB_MUSCLE_IDS].sort());
    for (const id of SUB_MUSCLE_IDS) {
      expect(result.contributions[id as SubMuscleId]).toBeCloseTo(1 / SUB_MUSCLE_IDS.length, 6);
    }
  });

  it("falls back to an even split across all 26 sub-muscles when there is no coarse tag at all", () => {
    const result = resolveExerciseMapping({ id: "tpl-unknown", name: "Totally Unrecognized Contraption" }, { repoMap: [] });

    expect(result.source).toBe("fallback");
    expect(Object.keys(result.contributions)).toHaveLength(SUB_MUSCLE_IDS.length);
  });

  it("every resolution path's output passes the muscle-map validator", () => {
    const overrides: OverridesMap = { "tpl-override": { biceps: 1.0 } };
    const repoMap: MuscleMap = [
      { hevy_id: "tpl-repo", name: "Repo Exercise", contributions: { mid_chest: 1.0 }, confidence: "high" },
    ];

    const cases: [Parameters<typeof resolveExerciseMapping>[0]][] = [
      [{ id: "tpl-override", name: "Anything" }],
      [{ id: "tpl-repo", name: "Repo Exercise" }],
      [{ id: "tpl-unknown", name: "Lateral Raise (Dumbbell)" }],
      [{ id: "tpl-unknown", name: "Totally Unrecognized Contraption", primaryMuscleGroup: "chest" }],
      [{ id: "tpl-unknown", name: "Totally Unrecognized Contraption" }],
    ];

    for (const [identity] of cases) {
      const result = resolveExerciseMapping(identity, { overrides, repoMap });
      const errors = validateEntry({
        hevy_id: identity.id,
        name: identity.name,
        contributions: result.contributions as Record<string, number>,
        confidence: "high",
      });
      expect(errors, `${identity.name} (${result.source}) failed validation: ${errors.join("; ")}`).toEqual([]);
      for (const key of Object.keys(result.contributions)) {
        expect(isValidSubMuscleId(key)).toBe(true);
      }
      expect(sumContributions(result.contributions)).toBeCloseTo(1, 2);
    }
  });
});

// ---------------------------------------------------------------------------
// Volume math
// ---------------------------------------------------------------------------

describe("accumulateExerciseVolume", () => {
  it("allocates sets and tonnage fractionally per the contribution map", () => {
    const accumulator: VolumeByMuscle = {} as VolumeByMuscle;
    for (const id of SUB_MUSCLE_IDS) accumulator[id as SubMuscleId] = { sets: 0, tonnageKg: 0 };

    const exercise = makeExercise({ sets: [makeSet({ weight_kg: 100, reps: 10 })] });
    accumulateExerciseVolume(
      accumulator,
      exercise,
      { contributions: { mid_chest: 0.7, front_delt: 0.3 }, source: "repo_map" },
    );

    expect(accumulator.mid_chest.sets).toBeCloseTo(0.7, 6);
    expect(accumulator.mid_chest.tonnageKg).toBeCloseTo(700, 6);
    expect(accumulator.front_delt.sets).toBeCloseTo(0.3, 6);
    expect(accumulator.front_delt.tonnageKg).toBeCloseTo(300, 6);
    expect(accumulator.biceps.sets).toBe(0);
  });

  it("excludes warm-up sets by default", () => {
    const accumulator: VolumeByMuscle = {} as VolumeByMuscle;
    for (const id of SUB_MUSCLE_IDS) accumulator[id as SubMuscleId] = { sets: 0, tonnageKg: 0 };

    const exercise = makeExercise({
      sets: [
        makeSet({ type: "warmup", weight_kg: 40, reps: 10 }),
        makeSet({ type: "normal", weight_kg: 100, reps: 10 }),
      ],
    });

    accumulateExerciseVolume(accumulator, exercise, { contributions: { mid_chest: 1.0 }, source: "repo_map" });

    expect(accumulator.mid_chest.sets).toBeCloseTo(1, 6);
    expect(accumulator.mid_chest.tonnageKg).toBeCloseTo(1000, 6);
  });

  it("includes warm-up sets when includeWarmups is true", () => {
    const accumulator: VolumeByMuscle = {} as VolumeByMuscle;
    for (const id of SUB_MUSCLE_IDS) accumulator[id as SubMuscleId] = { sets: 0, tonnageKg: 0 };

    const exercise = makeExercise({
      sets: [
        makeSet({ type: "warmup", weight_kg: 40, reps: 10 }),
        makeSet({ type: "normal", weight_kg: 100, reps: 10 }),
      ],
    });

    accumulateExerciseVolume(
      accumulator,
      exercise,
      { contributions: { mid_chest: 1.0 }, source: "repo_map" },
      { includeWarmups: true },
    );

    expect(accumulator.mid_chest.sets).toBeCloseTo(2, 6);
    expect(accumulator.mid_chest.tonnageKg).toBeCloseTo(1400, 6);
  });

  it("counts bodyweight sets normally but only tonnages the logged added weight", () => {
    const accumulator: VolumeByMuscle = {} as VolumeByMuscle;
    for (const id of SUB_MUSCLE_IDS) accumulator[id as SubMuscleId] = { sets: 0, tonnageKg: 0 };

    // Bodyweight pull-up with no added weight logged.
    const bodyweightSet = makeSet({ weight_kg: null, reps: 8 });
    const weightedSet = makeSet({ weight_kg: 10, reps: 6 }); // +10kg vest

    const exercise = makeExercise({ sets: [bodyweightSet, weightedSet] });

    accumulateExerciseVolume(accumulator, exercise, { contributions: { lats: 1.0 }, source: "repo_map" });

    // Both sets count toward hard-set volume...
    expect(accumulator.lats.sets).toBeCloseTo(2, 6);
    // ...but tonnage only reflects the logged added weight (10kg * 6 reps).
    expect(accumulator.lats.tonnageKg).toBeCloseTo(60, 6);
  });

  it("treats a set with null reps as contributing zero tonnage but a full hard set", () => {
    const accumulator: VolumeByMuscle = {} as VolumeByMuscle;
    for (const id of SUB_MUSCLE_IDS) accumulator[id as SubMuscleId] = { sets: 0, tonnageKg: 0 };

    const exercise = makeExercise({ sets: [makeSet({ weight_kg: null, reps: null })] });

    accumulateExerciseVolume(accumulator, exercise, { contributions: { rectus_abdominis: 1.0 }, source: "repo_map" });

    expect(accumulator.rectus_abdominis.sets).toBeCloseTo(1, 6);
    expect(accumulator.rectus_abdominis.tonnageKg).toBe(0);
  });
});

describe("computeVolumeByMuscle / computeExerciseVolume", () => {
  it("always returns all 26 canonical sub-muscle keys, zeroed if untouched", () => {
    const result = computeVolumeByMuscle([], undefined, { repoMap: [] });

    expect(Object.keys(result).sort()).toEqual([...SUB_MUSCLE_IDS].sort());
    for (const id of SUB_MUSCLE_IDS) {
      expect(result[id as SubMuscleId]).toEqual({ sets: 0, tonnageKg: 0 });
    }
  });

  it("aggregates volume across multiple workouts and exercises using resolved mappings", () => {
    const templates = new Map<string, HevyExerciseTemplate>([["tpl-1", makeTemplate()]]);
    const repoMap: MuscleMap = [
      { hevy_id: "tpl-1", name: "Bench Press (Barbell)", contributions: { mid_chest: 0.5, front_delt: 0.5 }, confidence: "high" },
    ];

    const workouts = [
      makeWorkout({ id: "w1", exercises: [makeExercise({ sets: [makeSet({ weight_kg: 100, reps: 10 })] })] }),
      makeWorkout({ id: "w2", exercises: [makeExercise({ sets: [makeSet({ weight_kg: 100, reps: 10 })] })] }),
    ];

    const result = computeVolumeByMuscle(workouts, templates, { repoMap });

    expect(result.mid_chest.sets).toBeCloseTo(1, 6);
    expect(result.front_delt.sets).toBeCloseTo(1, 6);
    expect(result.mid_chest.tonnageKg).toBeCloseTo(1000, 6);
  });

  it("computeExerciseVolume scopes to a single exercise's sets only", () => {
    const template = makeTemplate();
    const exercise = makeExercise({ sets: [makeSet({ weight_kg: 100, reps: 10 }), makeSet({ weight_kg: 100, reps: 10 })] });
    const repoMap: MuscleMap = [
      { hevy_id: "tpl-1", name: "Bench Press (Barbell)", contributions: { mid_chest: 1.0 }, confidence: "high" },
    ];

    const result = computeExerciseVolume(exercise, template, { repoMap });

    expect(result.mid_chest.sets).toBeCloseTo(2, 6);
    expect(result.mid_chest.tonnageKg).toBeCloseTo(2000, 6);
    expect(result.biceps.sets).toBe(0);
  });

  it("output always passes the muscle-map validator's per-entry sum rule for the touched sub-muscles", () => {
    const repoMap: MuscleMap = [
      {
        hevy_id: "tpl-1",
        name: "Bench Press (Barbell)",
        contributions: { mid_chest: 0.55, front_delt: 0.2, triceps_lat_med: 0.15, triceps_long: 0.1 },
        confidence: "high",
      },
    ];
    const workouts = [makeWorkout()];

    const result = computeVolumeByMuscle(workouts, undefined, { repoMap });

    const touched = Object.entries(result).filter(([, v]) => v.sets > 0);
    const totalSets = touched.reduce((acc, [, v]) => acc + v.sets, 0);
    expect(totalSets).toBeCloseTo(1, 6);
    for (const [id] of touched) {
      expect(isValidSubMuscleId(id)).toBe(true);
    }
  });
});
