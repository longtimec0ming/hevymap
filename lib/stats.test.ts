import { describe, expect, it } from "vitest";
import { SUB_MUSCLE_IDS, type SubMuscleId } from "../data/taxonomy";
import type { HevyExercise, HevySet, HevyWorkout } from "./hevy";
import type { OverridesMap } from "./overrides";
import {
  buildBuckets,
  chartRangeToDateRange,
  consistencyCalendar,
  currentStreakWeeks,
  hoursTrainedSeries,
  mostTrainedMuscle,
  percentDelta,
  prsPerBucketSeries,
  regionWithMostVolume,
  setsBySubMuscleSeries,
  subMuscleIdsForRegion,
  totalSets,
  totalTonnageKg,
  workoutDurationStats,
  workoutsPerBucketSeries,
} from "./stats";
import type { PrEvent } from "./prs";
import type { VolumeByMuscle } from "./volume";

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
    title: "Test Exercise",
    notes: "",
    exercise_template_id: "tpl-1",
    superset_id: null,
    sets: [makeSet()],
    ...overrides,
  };
}

function makeWorkout(id: string, startTime: string, endTime = startTime, exercises: HevyExercise[] = []): HevyWorkout {
  return {
    id,
    title: "Workout",
    routine_id: null,
    description: "",
    start_time: startTime,
    end_time: endTime,
    updated_at: startTime,
    created_at: startTime,
    exercises,
  };
}

function emptyVolume(): VolumeByMuscle {
  const result = {} as VolumeByMuscle;
  for (const id of SUB_MUSCLE_IDS) result[id as SubMuscleId] = { sets: 0, tonnageKg: 0 };
  return result;
}

describe("workoutDurationStats", () => {
  it("sums durations and finds the longest", () => {
    const w1 = makeWorkout("1", "2026-01-01T10:00:00Z", "2026-01-01T10:30:00Z"); // 30 min
    const w2 = makeWorkout("2", "2026-01-02T10:00:00Z", "2026-01-02T11:15:00Z"); // 75 min
    const stats = workoutDurationStats([w1, w2]);
    expect(stats.totalHours).toBeCloseTo(105 / 60, 5);
    expect(stats.longestWorkoutMinutes).toBe(75);
  });

  it("clamps a negative/bad duration to 0 instead of subtracting", () => {
    const bad = makeWorkout("1", "2026-01-01T10:00:00Z", "2026-01-01T09:00:00Z"); // end before start
    const stats = workoutDurationStats([bad]);
    expect(stats.totalHours).toBe(0);
    expect(stats.longestWorkoutMinutes).toBe(0);
  });

  it("returns zeros for an empty list", () => {
    expect(workoutDurationStats([])).toEqual({ totalHours: 0, longestWorkoutMinutes: 0 });
  });
});

describe("totalSets / totalTonnageKg", () => {
  it("sums across all sub-muscles", () => {
    const volume = emptyVolume();
    volume.front_delt = { sets: 4, tonnageKg: 400 };
    volume.lats_upper = { sets: 6, tonnageKg: 900 };
    expect(totalSets(volume)).toBeCloseTo(10, 5);
    expect(totalTonnageKg(volume)).toBeCloseTo(1300, 5);
  });
});

describe("mostTrainedMuscle", () => {
  it("picks the sub-muscle with the most sets", () => {
    const volume = emptyVolume();
    volume.front_delt = { sets: 4, tonnageKg: 0 };
    volume.lats_upper = { sets: 9, tonnageKg: 0 };
    const result = mostTrainedMuscle(volume);
    expect(result?.id).toBe("lats_upper");
    expect(result?.sets).toBe(9);
  });

  it("returns null when every muscle is at 0 sets", () => {
    expect(mostTrainedMuscle(emptyVolume())).toBeNull();
  });
});

describe("currentStreakWeeks", () => {
  const now = new Date("2026-08-19T12:00:00Z"); // a Wednesday

  it("counts consecutive weeks with a workout, ending at the current week", () => {
    const workouts = [
      makeWorkout("1", "2026-08-18T10:00:00Z"), // this week (Mon-start)
      makeWorkout("2", "2026-08-12T10:00:00Z"), // last week
      makeWorkout("3", "2026-08-04T10:00:00Z"), // week before
    ];
    expect(currentStreakWeeks(workouts, 1, now)).toBe(3);
  });

  it("stops at the first gap", () => {
    const workouts = [
      makeWorkout("1", "2026-08-18T10:00:00Z"), // this week
      // gap: no workout the week of 2026-08-11
      makeWorkout("3", "2026-08-04T10:00:00Z"),
    ];
    expect(currentStreakWeeks(workouts, 1, now)).toBe(1);
  });

  it("doesn't zero the streak just because the current week has no workout yet", () => {
    const workouts = [makeWorkout("2", "2026-08-12T10:00:00Z")]; // last week only
    expect(currentStreakWeeks(workouts, 1, now)).toBe(1);
  });

  it("returns 0 for no workouts at all", () => {
    expect(currentStreakWeeks([], 1, now)).toBe(0);
  });
});

describe("percentDelta", () => {
  it("computes a normal percentage change", () => {
    expect(percentDelta(120, 100)).toBeCloseTo(20, 5);
    expect(percentDelta(80, 100)).toBeCloseTo(-20, 5);
  });

  it("returns 0 when both are 0", () => {
    expect(percentDelta(0, 0)).toBe(0);
  });

  it("returns null when there's no baseline to compare against", () => {
    expect(percentDelta(5, 0)).toBeNull();
  });
});

describe("chartRangeToDateRange", () => {
  const now = new Date("2026-08-18T12:00:00Z");

  it("1m/3m/6m/1y all end at now and start earlier by that amount", () => {
    const oneMonth = chartRangeToDateRange("1m", [], now);
    expect(oneMonth.end).toEqual(now);
    expect(oneMonth.start.getTime()).toBeLessThan(now.getTime());
  });

  it("all falls back to the earliest workout", () => {
    const workouts = [makeWorkout("1", "2020-01-01T00:00:00Z")];
    const range = chartRangeToDateRange("all", workouts, now);
    expect(range.start.getUTCFullYear()).toBe(2020);
  });
});

describe("buildBuckets", () => {
  it("produces week-aligned buckets covering the range", () => {
    const range = { start: new Date("2026-08-01T00:00:00Z"), end: new Date("2026-08-20T00:00:00Z") };
    const buckets = buildBuckets(range, "week", 1);
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets[0].start.getTime()).toBeLessThanOrEqual(range.start.getTime());
    expect(buckets[buckets.length - 1].end.getTime()).toBeGreaterThanOrEqual(range.end.getTime());
  });

  it("produces month-aligned buckets covering the range", () => {
    const range = { start: new Date("2026-01-15T00:00:00Z"), end: new Date("2026-04-05T00:00:00Z") };
    const buckets = buildBuckets(range, "month", 1);
    expect(buckets).toHaveLength(4); // Jan, Feb, Mar, Apr
  });
});

describe("hoursTrainedSeries / workoutsPerBucketSeries", () => {
  it("aggregates per bucket", () => {
    const w1 = makeWorkout("1", "2026-08-03T10:00:00Z", "2026-08-03T11:00:00Z");
    const w2 = makeWorkout("2", "2026-08-10T10:00:00Z", "2026-08-10T11:30:00Z");
    const buckets = buildBuckets({ start: new Date("2026-08-01"), end: new Date("2026-08-16") }, "week", 1);

    const hours = hoursTrainedSeries([w1, w2], buckets);
    expect(hours.reduce((sum, p) => sum + p.hours, 0)).toBeCloseTo(2.5, 5);

    const counts = workoutsPerBucketSeries([w1, w2], buckets);
    expect(counts.reduce((sum, p) => sum + p.workouts, 0)).toBe(2);
  });
});

describe("prsPerBucketSeries", () => {
  it("counts events falling within each bucket", () => {
    const events: PrEvent[] = [
      { date: new Date("2026-08-03T10:00:00Z"), exerciseTemplateId: "ex1", exerciseName: "Bench", kind: "est1rm", value: 100 },
      { date: new Date("2026-08-03T10:05:00Z"), exerciseTemplateId: "ex1", exerciseName: "Bench", kind: "weight_reps", value: 500 },
      { date: new Date("2026-08-10T10:00:00Z"), exerciseTemplateId: "ex2", exerciseName: "Squat", kind: "est1rm", value: 150 },
    ];
    const buckets = buildBuckets({ start: new Date("2026-08-01"), end: new Date("2026-08-16") }, "week", 1);
    const series = prsPerBucketSeries(events, buckets);
    expect(series.reduce((sum, p) => sum + p.count, 0)).toBe(3);
  });
});

describe("consistencyCalendar", () => {
  it("covers the last 12 months including today", () => {
    const now = new Date("2026-08-18T12:00:00Z");
    const workout = makeWorkout("1", "2026-08-10T10:00:00Z");
    const days = consistencyCalendar([workout], now);
    expect(days[days.length - 1].date.getDate()).toBe(now.getDate());
    const hit = days.find(
      (d) => d.date.getFullYear() === 2026 && d.date.getMonth() === 7 && d.date.getDate() === new Date("2026-08-10T10:00:00Z").getDate(),
    );
    expect(hit?.count).toBe(1);
  });

  it("counts multiple workouts on the same day", () => {
    const now = new Date("2026-08-18T12:00:00Z");
    const days = consistencyCalendar(
      [makeWorkout("1", "2026-08-10T08:00:00Z"), makeWorkout("2", "2026-08-10T18:00:00Z")],
      now,
    );
    const targetDay = new Date("2026-08-10T08:00:00Z").getDate();
    const hit = days.find((d) => d.date.getDate() === targetDay && d.date.getMonth() === 7);
    expect(hit?.count).toBe(2);
  });
});

describe("subMuscleIdsForRegion", () => {
  it("returns exactly the 4 Shoulders sub-muscles for that region", () => {
    expect(subMuscleIdsForRegion("Shoulders")).toEqual(["front_delt", "side_delt", "rear_delt", "rotator_cuff"]);
  });

  it("returns all 32 sub-muscle ids for 'All'", () => {
    expect(subMuscleIdsForRegion("All")).toHaveLength(SUB_MUSCLE_IDS.length);
  });

  it("falls back to all 32 for an unrecognized region", () => {
    expect(subMuscleIdsForRegion("Nonexistent")).toHaveLength(SUB_MUSCLE_IDS.length);
  });
});

describe("setsBySubMuscleSeries", () => {
  const overrides: OverridesMap = { "tpl-1": { front_delt: 0.6, mid_chest: 0.4 } };
  const buckets = buildBuckets({ start: new Date("2026-08-01"), end: new Date("2026-08-16") }, "week", 1);

  it("only includes keys for the filtered region's sub-muscles", () => {
    const workout = makeWorkout("1", "2026-08-03T10:00:00Z", "2026-08-03T11:00:00Z", [makeExercise()]);
    const series = setsBySubMuscleSeries([workout], undefined, { overrides }, {}, buckets, "Shoulders");
    for (const point of series) {
      expect(Object.keys(point).sort()).toEqual(
        ["front_delt", "label", "rear_delt", "rotator_cuff", "side_delt"].sort(),
      );
    }
  });

  it("allocates fractional sets per sub-muscle within the filtered region", () => {
    const workout = makeWorkout("1", "2026-08-03T10:00:00Z", "2026-08-03T11:00:00Z", [makeExercise()]);
    const series = setsBySubMuscleSeries([workout], undefined, { overrides }, {}, buckets, "Shoulders");
    const total = series.reduce((sum, p) => sum + Number(p.front_delt ?? 0), 0);
    expect(total).toBeCloseTo(0.6, 5);
  });

  it("'All' includes every sub-muscle key", () => {
    const workout = makeWorkout("1", "2026-08-03T10:00:00Z", "2026-08-03T11:00:00Z", [makeExercise()]);
    const series = setsBySubMuscleSeries([workout], undefined, { overrides }, {}, buckets, "All");
    expect(Object.keys(series[0]).length).toBe(SUB_MUSCLE_IDS.length + 1); // + label
  });
});

describe("regionWithMostVolume", () => {
  it("picks the region with the most total fractional sets", () => {
    const overrides: OverridesMap = { "tpl-1": { front_delt: 1.0 } };
    const workout = makeWorkout("1", "2026-08-03T10:00:00Z", "2026-08-03T11:00:00Z", [makeExercise()]);
    expect(regionWithMostVolume([workout], undefined, { overrides }, {})).toBe("Shoulders");
  });

  it("falls back to 'All' when there's no volume at all", () => {
    expect(regionWithMostVolume([], undefined, {}, {})).toBe("All");
  });
});
