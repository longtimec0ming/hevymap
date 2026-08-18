// Personal-record detection: a set is a PR when it sets a new best estimated
// 1-rep-max (Epley formula) OR a new best weight x reps for that exercise,
// evaluated chronologically. Pure, no React — used by the dashboard's "PRs
// over time" chart (components/dashboard/prs-over-time-card.tsx via
// lib/stats.ts's bucketing).

import type { HevyWorkout } from "./hevy";

export type PrKind = "est1rm" | "weight_reps";

export interface PrEvent {
  /** Workout start_time this PR was set in. */
  date: Date;
  exerciseTemplateId: string;
  exerciseName: string;
  kind: PrKind;
  value: number;
}

/** Epley formula: estimated 1-rep-max from a submaximal set. */
export function epley1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

export interface PrOptions {
  /** Include warm-up sets when scanning for PRs. Defaults to false, matching
   * lib/volume.ts's VolumeOptions default. */
  includeWarmups?: boolean;
}

/** Scans every logged set in chronological order and emits one PrEvent each
 * time a set beats the exercise's previous-best est-1RM or previous-best
 * weight x reps. `workouts` need not be pre-sorted. Ties do not count as a
 * new PR (strictly greater than). */
export function computePrEvents(workouts: HevyWorkout[], options: PrOptions = {}): PrEvent[] {
  const includeWarmups = options.includeWarmups ?? false;
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );

  const best1RM = new Map<string, number>();
  const bestWeightReps = new Map<string, number>();
  const events: PrEvent[] = [];

  for (const workout of sorted) {
    const date = new Date(workout.start_time);
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        if (set.type === "warmup" && !includeWarmups) continue;
        const weight = set.weight_kg ?? 0;
        const reps = set.reps ?? 0;
        if (weight <= 0 || reps <= 0) continue;

        const est1RM = epley1RM(weight, reps);
        const prevBest1RM = best1RM.get(exercise.exercise_template_id) ?? 0;
        if (est1RM > prevBest1RM) {
          best1RM.set(exercise.exercise_template_id, est1RM);
          events.push({
            date,
            exerciseTemplateId: exercise.exercise_template_id,
            exerciseName: exercise.title,
            kind: "est1rm",
            value: est1RM,
          });
        }

        const weightReps = weight * reps;
        const prevBestWeightReps = bestWeightReps.get(exercise.exercise_template_id) ?? 0;
        if (weightReps > prevBestWeightReps) {
          bestWeightReps.set(exercise.exercise_template_id, weightReps);
          events.push({
            date,
            exerciseTemplateId: exercise.exercise_template_id,
            exerciseName: exercise.title,
            kind: "weight_reps",
            value: weightReps,
          });
        }
      }
    }
  }

  return events;
}
