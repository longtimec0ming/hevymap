"use client";

// Shared calendar-week volume series builder — used by the dashboard's
// sparkline grid and the Trends page's trend charts, so both compute weeks
// the same way.

import { useMemo } from "react";
import type { HevyExerciseTemplate, HevyWorkout } from "@/lib/hevy";
import { getOverrides } from "@/lib/overrides";
import { filterWorkoutsInRange, weekRange } from "@/lib/period";
import { computeVolumeByMuscle, type VolumeByMuscle } from "@/lib/volume";

export interface WeeklyVolumePoint {
  weekStart: Date;
  weekEnd: Date;
  /** 0 = current week, 1 = last week, ... */
  weeksAgo: number;
  volume: VolumeByMuscle;
}

/** Volume for the last `weeksCount` calendar weeks (oldest first), one
 * entry per week including the current (possibly partial) week. */
export function useWeeklySeries(
  workouts: HevyWorkout[],
  templatesById: ReadonlyMap<string, HevyExerciseTemplate>,
  weekStartsOn: 0 | 1,
  includeWarmups: boolean,
  weeksCount: number,
): WeeklyVolumePoint[] {
  return useMemo(() => {
    const overrides = getOverrides();
    const points: WeeklyVolumePoint[] = [];
    for (let weeksAgo = weeksCount - 1; weeksAgo >= 0; weeksAgo--) {
      const range = weekRange(weekStartsOn, weeksAgo);
      const inRange = filterWorkoutsInRange(workouts, range);
      const volume = computeVolumeByMuscle(inRange, templatesById, { overrides }, { includeWarmups });
      points.push({ weekStart: range.start, weekEnd: range.end, weeksAgo, volume });
    }
    return points;
  }, [workouts, templatesById, weekStartsOn, includeWarmups, weeksCount]);
}
