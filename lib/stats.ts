// Pure aggregation helpers for the dashboard's stat tiles and per-card
// charts (components/dashboard/*). No React here — everything takes plain
// data in and returns plain data out, so it's unit-testable without
// mounting anything. See lib/dashboard-prefs.ts for the per-card range/
// bucket preferences these helpers bucket by.

import {
  addDays,
  addMonths,
  addWeeks,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subYears,
} from "date-fns";
import { TAXONOMY, TAXONOMY_BY_ID, type SubMuscleId } from "../data/taxonomy";
import type { ChartBucket, ChartRange } from "./dashboard-prefs";
import { groupVolumeByRegion } from "./groups";
import type { HevyExerciseTemplate, HevyWorkout } from "./hevy";
import { allTimeRange, filterWorkoutsInRange, type DateRange } from "./period";
import type { PrEvent } from "./prs";
import { computeVolumeByMuscle, type ResolveContext, type VolumeByMuscle, type VolumeOptions } from "./volume";

// ---------------------------------------------------------------------------
// Stat tiles
// ---------------------------------------------------------------------------

export interface WorkoutDurationStats {
  /** Sum of every workout's (end_time - start_time), in hours. */
  totalHours: number;
  /** The single longest workout's duration, in minutes. 0 if there are none. */
  longestWorkoutMinutes: number;
}

/** Negative or nonsensical durations (a bad end_time) are clamped to 0
 * rather than allowed to pull the total down. */
export function workoutDurationStats(workouts: HevyWorkout[]): WorkoutDurationStats {
  let totalMinutes = 0;
  let longestWorkoutMinutes = 0;
  for (const workout of workouts) {
    const minutes = Math.max(0, differenceInMinutes(new Date(workout.end_time), new Date(workout.start_time)));
    totalMinutes += minutes;
    if (minutes > longestWorkoutMinutes) longestWorkoutMinutes = minutes;
  }
  return { totalHours: totalMinutes / 60, longestWorkoutMinutes };
}

export function totalSets(volume: VolumeByMuscle): number {
  let sum = 0;
  for (const v of Object.values(volume)) sum += v.sets;
  return sum;
}

export function totalTonnageKg(volume: VolumeByMuscle): number {
  let sum = 0;
  for (const v of Object.values(volume)) sum += v.tonnageKg;
  return sum;
}

export interface MostTrainedMuscle {
  id: SubMuscleId;
  displayName: string;
  sets: number;
}

/** The sub-muscle with the most fractional hard sets, or null if the period
 * had no logged sets at all. */
export function mostTrainedMuscle(volume: VolumeByMuscle): MostTrainedMuscle | null {
  let best: SubMuscleId | null = null;
  let bestSets = 0;
  for (const id of Object.keys(TAXONOMY_BY_ID) as SubMuscleId[]) {
    if (volume[id].sets > bestSets) {
      bestSets = volume[id].sets;
      best = id;
    }
  }
  return best ? { id: best, displayName: TAXONOMY_BY_ID[best].displayName, sets: bestSets } : null;
}

function weekHasWorkout(workouts: HevyWorkout[], weekStartsOn: 0 | 1, weeksAgo: number, now: Date): boolean {
  const anchor = addWeeks(now, -weeksAgo);
  const start = startOfWeek(anchor, { weekStartsOn });
  const end = endOfWeek(anchor, { weekStartsOn });
  return workouts.some((w) => {
    const t = new Date(w.start_time);
    return t >= start && t <= end;
  });
}

/** Consecutive calendar weeks (per weekStartsOn) with >=1 workout, counting
 * back from the current week. If the current week has no workout yet (it
 * may simply not be over), that alone doesn't break the streak — counting
 * starts from the most recent week that does have one. Independent of any
 * dashboard period filter: pass the user's full workout history. */
export function currentStreakWeeks(workouts: HevyWorkout[], weekStartsOn: 0 | 1, now = new Date()): number {
  let weeksAgo = weekHasWorkout(workouts, weekStartsOn, 0, now) ? 0 : 1;
  let streak = 0;
  const SAFETY_CAP_WEEKS = 520; // ~10 years
  while (weeksAgo < SAFETY_CAP_WEEKS && weekHasWorkout(workouts, weekStartsOn, weeksAgo, now)) {
    streak++;
    weeksAgo++;
  }
  return streak;
}

/** Percent change from previous to current, or null when there's no
 * meaningful baseline (previous was 0 but current isn't) — callers should
 * render that as "new" rather than a percentage. Returns 0 when both are 0. */
export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------------------
// Chart range/bucket resolution
// ---------------------------------------------------------------------------

/** Resolves a ChartCard's ChartRange selection into a concrete DateRange.
 * "all" defers to the earliest workout in history (lib/period.ts's
 * allTimeRange), matching the dashboard's own all-time period behavior. */
export function chartRangeToDateRange(range: ChartRange, workouts: HevyWorkout[], now = new Date()): DateRange {
  switch (range) {
    case "1m":
      return { start: startOfDay(subMonths(now, 1)), end: now };
    case "3m":
      return { start: startOfDay(subMonths(now, 3)), end: now };
    case "6m":
      return { start: startOfDay(subMonths(now, 6)), end: now };
    case "1y":
      return { start: startOfDay(subYears(now, 1)), end: now };
    case "all":
    default:
      return allTimeRange(workouts, now);
  }
}

export interface Bucket {
  start: Date;
  end: Date;
  /** Short axis label, e.g. "Aug 11" (week) or "Aug 2026" (month). */
  label: string;
}

const MAX_BUCKETS = 260; // ~5 years of weeks; a hard cap so a bad range can't hang the chart

/** Splits a date range into consecutive week- or month-aligned buckets
 * covering it. The first/last bucket may extend slightly past `range`
 * (aligned to the calendar unit's own boundaries), matching how the
 * dashboard already treats calendar weeks/months elsewhere (lib/period.ts). */
export function buildBuckets(range: DateRange, unit: ChartBucket, weekStartsOn: 0 | 1): Bucket[] {
  const buckets: Bucket[] = [];
  if (unit === "week") {
    let cursor = startOfWeek(range.start, { weekStartsOn });
    while (cursor <= range.end && buckets.length < MAX_BUCKETS) {
      const end = endOfWeek(cursor, { weekStartsOn });
      buckets.push({ start: cursor, end, label: format(cursor, "MMM d") });
      cursor = addWeeks(cursor, 1);
    }
  } else {
    let cursor = startOfMonth(range.start);
    while (cursor <= range.end && buckets.length < MAX_BUCKETS) {
      const end = endOfMonth(cursor);
      buckets.push({ start: cursor, end, label: format(cursor, "MMM yyyy") });
      cursor = addMonths(cursor, 1);
    }
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Per-card series
// ---------------------------------------------------------------------------

export interface HoursPoint {
  label: string;
  hours: number;
}

export function hoursTrainedSeries(workouts: HevyWorkout[], buckets: Bucket[]): HoursPoint[] {
  return buckets.map((bucket) => {
    const inRange = filterWorkoutsInRange(workouts, bucket);
    return { label: bucket.label, hours: workoutDurationStats(inRange).totalHours };
  });
}

export interface VolumePoint {
  label: string;
  volumeKg: number;
}

export function volumeProgressionSeries(
  workouts: HevyWorkout[],
  templatesById: ReadonlyMap<string, HevyExerciseTemplate> | undefined,
  context: ResolveContext,
  options: VolumeOptions,
  buckets: Bucket[],
): VolumePoint[] {
  return buckets.map((bucket) => {
    const inRange = filterWorkoutsInRange(workouts, bucket);
    const volume = computeVolumeByMuscle(inRange, templatesById, context, options);
    return { label: bucket.label, volumeKg: totalTonnageKg(volume) };
  });
}

export interface WorkoutsCountPoint {
  label: string;
  workouts: number;
}

export function workoutsPerBucketSeries(workouts: HevyWorkout[], buckets: Bucket[]): WorkoutsCountPoint[] {
  return buckets.map((bucket) => ({ label: bucket.label, workouts: filterWorkoutsInRange(workouts, bucket).length }));
}

/** One point per bucket, with every coarse region as a numeric key alongside
 * `label` (for Recharts' stacked bar/area series, one <Bar>/<Area> per
 * region reading straight off the region name). */
export type SetsByRegionPoint = { label: string } & Record<string, number | string>;

export function setsByRegionSeries(
  workouts: HevyWorkout[],
  templatesById: ReadonlyMap<string, HevyExerciseTemplate> | undefined,
  context: ResolveContext,
  options: VolumeOptions,
  buckets: Bucket[],
): SetsByRegionPoint[] {
  return buckets.map((bucket) => {
    const inRange = filterWorkoutsInRange(workouts, bucket);
    const volume = computeVolumeByMuscle(inRange, templatesById, context, options);
    const point: SetsByRegionPoint = { label: bucket.label };
    for (const group of groupVolumeByRegion(volume)) {
      point[group.region] = group.total.sets;
    }
    return point;
  });
}

/** One point per bucket, with every sub-muscle id (optionally filtered to a
 * single region's members) as a numeric key alongside `label`, mirroring
 * SetsByRegionPoint's shape for the same Recharts stacked bar/area pattern
 * (one <Bar>/<Area> per sub-muscle). */
export type SetsBySubMuscleGroupPoint = { label: string } & Record<string, number | string>;

/** Sub-muscle ids belonging to `region`, in taxonomy order — "All" (or an
 * unrecognized region) returns every sub-muscle. Exported so the card and
 * its group-filter pill row share one definition of "which ids does this
 * filter select" instead of re-deriving it. */
export function subMuscleIdsForRegion(region: string | "All"): SubMuscleId[] {
  if (region === "All") return TAXONOMY.map((m) => m.id as SubMuscleId);
  const members = TAXONOMY.filter((m) => m.region === region).map((m) => m.id as SubMuscleId);
  return members.length > 0 ? members : TAXONOMY.map((m) => m.id as SubMuscleId);
}

/** Sets-by-sub-muscle series (PLAN.md §10's "Sets by muscle group" card,
 * extended to sub-muscle granularity with a group filter). Same
 * bucket-then-allocate shape as setsByRegionSeries, filtered down to
 * `region`'s sub-muscles (or all 26 for "All"). */
export function setsBySubMuscleSeries(
  workouts: HevyWorkout[],
  templatesById: ReadonlyMap<string, HevyExerciseTemplate> | undefined,
  context: ResolveContext,
  options: VolumeOptions,
  buckets: Bucket[],
  region: string | "All",
): SetsBySubMuscleGroupPoint[] {
  const ids = subMuscleIdsForRegion(region);
  return buckets.map((bucket) => {
    const inRange = filterWorkoutsInRange(workouts, bucket);
    const volume = computeVolumeByMuscle(inRange, templatesById, context, options);
    const point: SetsBySubMuscleGroupPoint = { label: bucket.label };
    for (const id of ids) {
      point[id] = volume[id].sets;
    }
    return point;
  });
}

/** The region (of the 6 coarse regions) with the most total fractional sets
 * across `workouts`, for defaulting the sub-muscle chart's group filter to
 * "whatever's actually being trained" rather than always "All". Falls back
 * to "All" when there's no volume at all to rank by. */
export function regionWithMostVolume(
  workouts: HevyWorkout[],
  templatesById: ReadonlyMap<string, HevyExerciseTemplate> | undefined,
  context: ResolveContext,
  options: VolumeOptions,
): string | "All" {
  const volume = computeVolumeByMuscle(workouts, templatesById, context, options);
  const groups = groupVolumeByRegion(volume);
  let best: string | "All" = "All";
  let bestSets = 0;
  for (const group of groups) {
    if (group.total.sets > bestSets) {
      bestSets = group.total.sets;
      best = group.region;
    }
  }
  return best;
}

export interface PrCountPoint {
  label: string;
  count: number;
}

export function prsPerBucketSeries(events: PrEvent[], buckets: Bucket[]): PrCountPoint[] {
  return buckets.map((bucket) => ({
    label: bucket.label,
    count: events.filter((e) => e.date >= bucket.start && e.date <= bucket.end).length,
  }));
}

// ---------------------------------------------------------------------------
// Consistency heatmap
// ---------------------------------------------------------------------------

export interface ConsistencyDay {
  date: Date;
  count: number;
}

/** One entry per calendar day for the last 12 months (inclusive of today),
 * with how many workouts started that day (0 for rest days) — the raw data
 * for a GitHub-style contribution calendar. */
export function consistencyCalendar(workouts: HevyWorkout[], now = new Date()): ConsistencyDay[] {
  const start = startOfDay(subMonths(now, 12));
  const end = startOfDay(now);

  const counts = new Map<string, number>();
  for (const workout of workouts) {
    const key = format(startOfDay(new Date(workout.start_time)), "yyyy-MM-dd");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const days: ConsistencyDay[] = [];
  let cursor = start;
  while (cursor <= end) {
    const key = format(cursor, "yyyy-MM-dd");
    days.push({ date: cursor, count: counts.get(key) ?? 0 });
    cursor = addDays(cursor, 1);
  }
  return days;
}
