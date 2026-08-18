// Calendar-week range helpers respecting the user's weekStartsOn pref, plus
// the dashboard timeframe selector's date math (PLAN.md §9.1 / §10): rolling
// 7 days, calendar week, calendar month, custom range, all-time — and the
// pro-rating math ("vs (pro-rated) targets") that scales weekly target
// bands to whatever period length is selected.

import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import type { HevyWorkout } from "./hevy";
import type { VolumeByMuscle } from "./volume";

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

// ---------------------------------------------------------------------------
// Dashboard timeframe selector (PLAN.md §9.1)
// ---------------------------------------------------------------------------

export type PeriodKind = "rolling7" | "week" | "month" | "custom" | "allTime";

/** Persisted in Prefs.periodScope (lib/storage.ts). customStart/customEnd
 * are "yyyy-MM-dd" date-only strings (native <input type="date"> format),
 * only meaningful when kind === "custom". */
export interface PeriodScope {
  kind: PeriodKind;
  customStart?: string;
  customEnd?: string;
}

export const DEFAULT_PERIOD_SCOPE: PeriodScope = { kind: "week" };

/** The last 7 days including today: [today - 6 days 00:00, today 23:59:59]. */
export function rolling7DayRange(now = new Date()): DateRange {
  return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
}

/** The calendar month `monthsAgo` months before the current one (0 = this
 * month). */
export function monthRange(now = new Date(), monthsAgo = 0): DateRange {
  const anchor = subMonths(now, monthsAgo);
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

/** A user-chosen custom range from two date-only strings, inclusive of both
 * calendar days. */
export function customDateRange(startISO: string, endISO: string): DateRange {
  return { start: startOfDay(parseISO(startISO)), end: endOfDay(parseISO(endISO)) };
}

/** Earliest workout's day through today. Falls back to just "today" if
 * there are no workouts (an empty but valid range, not an error). */
export function allTimeRange(workouts: HevyWorkout[], now = new Date()): DateRange {
  if (workouts.length === 0) return { start: startOfDay(now), end: endOfDay(now) };
  const earliest = workouts.reduce(
    (min, w) => Math.min(min, new Date(w.start_time).getTime()),
    Number.POSITIVE_INFINITY,
  );
  return { start: startOfDay(new Date(earliest)), end: endOfDay(now) };
}

export interface ResolvedPeriod {
  range: DateRange;
  /** Inclusive day count spanned by range (e.g. a single calendar day = 1). */
  days: number;
  /** Human-readable label for the header, e.g. "Aug 11 – Aug 17" or "All time". */
  label: string;
  isAllTime: boolean;
}

const dayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function formatRangeLabel(range: DateRange): string {
  return `${dayFormatter.format(range.start)} – ${dayFormatter.format(range.end)}`;
}

/** Resolves a PeriodScope + the user's weekStartsOn pref into a concrete
 * date range, day count, and label. `workouts` is only consulted for
 * kind === "allTime" (to find the earliest workout). */
export function resolvePeriod(
  scope: PeriodScope,
  weekStartsOn: 0 | 1,
  workouts: HevyWorkout[],
  now = new Date(),
): ResolvedPeriod {
  switch (scope.kind) {
    case "rolling7": {
      const range = rolling7DayRange(now);
      return { range, days: periodDays(range), label: "Last 7 days", isAllTime: false };
    }
    case "month": {
      const range = monthRange(now);
      return { range, days: periodDays(range), label: formatRangeLabel(range), isAllTime: false };
    }
    case "custom": {
      const range =
        scope.customStart && scope.customEnd
          ? customDateRange(scope.customStart, scope.customEnd)
          : weekRange(weekStartsOn);
      return { range, days: periodDays(range), label: formatRangeLabel(range), isAllTime: false };
    }
    case "allTime": {
      const range = allTimeRange(workouts, now);
      return { range, days: periodDays(range), label: "All time", isAllTime: true };
    }
    case "week":
    default: {
      const range = weekRange(weekStartsOn);
      return { range, days: periodDays(range), label: formatRangeLabel(range), isAllTime: false };
    }
  }
}

/** The same-length window immediately preceding `currentRange`, for
 * "vs last period" comparisons. Not defined for all-time (nothing precedes
 * the full history), which returns null — callers should hide the
 * comparison in that case. */
export function previousPeriodRange(scope: PeriodScope, currentRange: DateRange): DateRange | null {
  if (scope.kind === "allTime") return null;
  const days = periodDays(currentRange);
  return {
    start: startOfDay(subDays(currentRange.start, days)),
    end: endOfDay(subDays(currentRange.start, 1)),
  };
}

/** Inclusive day count spanned by a range. */
export function periodDays(range: DateRange): number {
  return differenceInCalendarDays(range.end, range.start) + 1;
}

/** How many "weeks" a period represents, for pro-rating a weekly target
 * band to the period length (PLAN.md §9.1: weekly target × days/7). */
export function proRateFactor(days: number): number {
  return days / 7;
}

/** Scales a [min, max] weekly target band by the period's pro-rating
 * factor. Not meaningful for all-time (an unbounded period would produce an
 * enormous band) — callers should use weeklyAverageVolume + the unscaled
 * band instead for that case (see below). */
export function proRateBand(band: [number, number], days: number): [number, number] {
  const factor = proRateFactor(days);
  return [band[0] * factor, band[1] * factor];
}

/** Pro-rates every band in a full sub-muscle -> band record. */
export function proRateBands<T extends string>(
  bands: Record<T, [number, number]>,
  days: number,
): Record<T, [number, number]> {
  const result = {} as Record<T, [number, number]>;
  for (const id of Object.keys(bands) as T[]) {
    result[id] = proRateBand(bands[id], days);
  }
  return result;
}

/** For the all-time scope, pro-rating the *target* to hundreds of days
 * would produce a meaningless band. Instead we scale the *volume* down to a
 * weekly-equivalent rate (total / (days/7)) and compare that against the
 * unscaled weekly target band — i.e. "vs weekly average" (PLAN.md §9.1:
 * "for all-time, show against per-week average ... pick one, state it in
 * the UI"). Callers must label this mode explicitly since it changes what
 * the displayed numbers mean. */
export function weeklyAverageVolume(volume: VolumeByMuscle, days: number): VolumeByMuscle {
  const factor = proRateFactor(days);
  const result = {} as VolumeByMuscle;
  for (const id of Object.keys(volume) as (keyof VolumeByMuscle)[]) {
    const v = volume[id];
    result[id] = { sets: factor > 0 ? v.sets / factor : 0, tonnageKg: factor > 0 ? v.tonnageKg / factor : 0 };
  }
  return result;
}
