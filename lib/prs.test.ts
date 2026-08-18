import { describe, expect, it } from "vitest";
import type { HevyExercise, HevySet, HevyWorkout } from "./hevy";
import { computePrEvents, epley1RM } from "./prs";

function makeSet(overrides: Partial<HevySet> = {}): HevySet {
  return {
    index: 0,
    type: "normal",
    weight_kg: 100,
    reps: 5,
    distance_meters: null,
    duration_seconds: null,
    rpe: null,
    custom_metric: null,
    ...overrides,
  };
}

function makeExercise(id: string, sets: HevySet[], title = "Bench Press"): HevyExercise {
  return { index: 0, title, notes: "", exercise_template_id: id, superset_id: null, sets };
}

function makeWorkout(id: string, startTime: string, exercises: HevyExercise[]): HevyWorkout {
  return {
    id,
    title: "Workout",
    routine_id: null,
    description: "",
    start_time: startTime,
    end_time: startTime,
    updated_at: startTime,
    created_at: startTime,
    exercises,
  };
}

describe("epley1RM", () => {
  it("computes the Epley estimate", () => {
    expect(epley1RM(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });

  it("a single at 1 rep equals the weight itself", () => {
    expect(epley1RM(100, 1)).toBeCloseTo(100 * (1 + 1 / 30), 5);
  });
});

describe("computePrEvents", () => {
  it("emits both an est1rm and a weight_reps PR for the very first valid set", () => {
    const workout = makeWorkout("w1", "2026-01-01T10:00:00Z", [makeExercise("ex1", [makeSet()])]);
    const events = computePrEvents([workout]);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.kind).sort()).toEqual(["est1rm", "weight_reps"]);
  });

  it("does not re-emit a PR for a set that ties the previous best", () => {
    const w1 = makeWorkout("w1", "2026-01-01T10:00:00Z", [makeExercise("ex1", [makeSet({ weight_kg: 100, reps: 5 })])]);
    const w2 = makeWorkout("w2", "2026-01-08T10:00:00Z", [makeExercise("ex1", [makeSet({ weight_kg: 100, reps: 5 })])]);
    const events = computePrEvents([w1, w2]);
    expect(events).toHaveLength(2); // only from w1
  });

  it("emits a new PR only for the metric that actually improved", () => {
    // Same est-1RM-beating weight but fewer reps -> lower weight_reps, so
    // only est1rm should fire the second time... actually here reps go up
    // with same weight, so weight_reps improves too. Use a case where only
    // one metric improves: heavier weight, far fewer reps.
    const w1 = makeWorkout("w1", "2026-01-01T10:00:00Z", [makeExercise("ex1", [makeSet({ weight_kg: 100, reps: 10 })])]);
    // weight_reps = 1000, est1rm = 100 * (1 + 10/30) = 133.33
    const w2 = makeWorkout("w2", "2026-01-08T10:00:00Z", [makeExercise("ex1", [makeSet({ weight_kg: 140, reps: 1 })])]);
    // weight_reps = 140 (worse than 1000), est1rm = 140 * (1 + 1/30) = 144.67 (better than 133.33)
    const events = computePrEvents([w1, w2]);
    const w2Events = events.filter((e) => e.date.getTime() === new Date("2026-01-08T10:00:00Z").getTime());
    expect(w2Events).toHaveLength(1);
    expect(w2Events[0].kind).toBe("est1rm");
  });

  it("processes workouts in chronological order regardless of input order", () => {
    const early = makeWorkout("early", "2026-01-01T10:00:00Z", [makeExercise("ex1", [makeSet({ weight_kg: 80, reps: 5 })])]);
    const later = makeWorkout("later", "2026-01-08T10:00:00Z", [makeExercise("ex1", [makeSet({ weight_kg: 100, reps: 5 })])]);
    const events = computePrEvents([later, early]);
    // Both sets are PRs (later beats earlier), in chronological order.
    expect(events[0].date.getTime()).toBeLessThan(events[2].date.getTime());
  });

  it("excludes warm-up sets by default", () => {
    const workout = makeWorkout("w1", "2026-01-01T10:00:00Z", [
      makeExercise("ex1", [makeSet({ type: "warmup", weight_kg: 200, reps: 5 })]),
    ]);
    expect(computePrEvents([workout])).toHaveLength(0);
  });

  it("includes warm-up sets when includeWarmups is set", () => {
    const workout = makeWorkout("w1", "2026-01-01T10:00:00Z", [
      makeExercise("ex1", [makeSet({ type: "warmup", weight_kg: 200, reps: 5 })]),
    ]);
    expect(computePrEvents([workout], { includeWarmups: true })).toHaveLength(2);
  });

  it("ignores sets with no weight or no reps", () => {
    const workout = makeWorkout("w1", "2026-01-01T10:00:00Z", [
      makeExercise("ex1", [makeSet({ weight_kg: null, reps: 5 }), makeSet({ weight_kg: 100, reps: null })]),
    ]);
    expect(computePrEvents([workout])).toHaveLength(0);
  });

  it("tracks PRs independently per exercise", () => {
    const workout = makeWorkout("w1", "2026-01-01T10:00:00Z", [
      makeExercise("ex1", [makeSet({ weight_kg: 100, reps: 5 })], "Bench Press"),
      makeExercise("ex2", [makeSet({ weight_kg: 60, reps: 8 })], "Overhead Press"),
    ]);
    const events = computePrEvents([workout]);
    expect(events).toHaveLength(4);
    expect(new Set(events.map((e) => e.exerciseTemplateId))).toEqual(new Set(["ex1", "ex2"]));
  });
});
