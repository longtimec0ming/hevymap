// Calendar-week range helpers respecting the user's weekStartsOn pref.
// New file — lib/storage.ts (source of the Prefs type) stays untouched.

import { endOfWeek, startOfWeek, subWeeks } from "date-fns";
import type { HevyWorkout } from "./hevy";

export interface DateRange {
  start: Date;
  end: Date;
}

/** The calendar week `weeksAgo` weeks before the current one (0 = this
 * week), per weekStartsOn (0 = Sunday, 1 = Monday, date-fns convention). */
export function weekRange(weekStartsOn: 0 | 1, weeksAgo = 0): DateRange {
  const anchor = subWeeks(new Date(), weeksAgo);
  return {
    start: startOfWeek(anchor, { weekStartsOn }),
    end: endOfWeek(anchor, { weekStartsOn }),
  };
}

/** Workouts with start_time within [start, end] inclusive. */
export function filterWorkoutsInRange(workouts: HevyWorkout[], range: DateRange): HevyWorkout[] {
  return workouts.filter((workout) => {
    const t = new Date(workout.start_time);
    return t >= range.start && t <= range.end;
  });
}
