import { describe, expect, it } from "vitest";
import type { HevyWorkout } from "./hevy";
import {
  allTimeRange,
  customDateRange,
  filterWorkoutsInRange,
  monthRange,
  periodDays,
  previousPeriodRange,
  proRateBand,
  proRateBands,
  proRateFactor,
  resolvePeriod,
  rolling7DayRange,
  rollingRange,
  weekRange,
  weeklyAverageVolume,
  type PeriodScope,
} from "./period";
import type { VolumeByMuscle } from "./volume";

// Matches lib/period.ts's internal dayFormatter so label assertions aren't
// tied to a specific locale's month/day ordering.
const dayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
function rangeLabel(start: Date, end: Date): string {
  return `${dayFormatter.format(start)} – ${dayFormatter.format(end)}`;
}

function makeWorkout(id: string, startTime: string): HevyWorkout {
  return {
    id,
    title: "Workout",
    routine_id: null,
    description: "",
    start_time: startTime,
    end_time: startTime,
    updated_at: startTime,
    created_at: startTime,
    exercises: [],
  };
}

// ---------------------------------------------------------------------------
// weekRange — Monday vs Sunday week starts
// ---------------------------------------------------------------------------

describe("weekRange", () => {
  it("Monday-start: a Wednesday anchor resolves to Mon–Sun", () => {
    const wednesday = new Date("2026-08-19T12:00:00Z"); // Wed
    const range = weekRange(1, 0);
    // Sanity: just check start is a Monday and end is the following Sunday,
    // both local-time midnights per date-fns convention.
    expect(range.start.getDay()).toBe(1);
    expect(range.end.getDay()).toBe(0);
    expect(range.start.getTime()).toBeLessThan(wednesday.getTime());
    expect(range.end.getTime()).toBeGreaterThan(wednesday.getTime());
  });

  it("Sunday-start: start is a Sunday and end is the following Saturday", () => {
    const range = weekRange(0, 0);
    expect(range.start.getDay()).toBe(0);
    expect(range.end.getDay()).toBe(6);
  });

  it("weeksAgo shifts the anchor back by whole weeks", () => {
    const thisWeek = weekRange(1, 0);
    const lastWeek = weekRange(1, 1);
    expect(thisWeek.start.getTime() - lastWeek.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// rolling7DayRange
// ---------------------------------------------------------------------------

describe("rolling7DayRange", () => {
  it("spans exactly 7 calendar days ending today, inclusive", () => {
    const now = new Date("2026-08-18T15:30:00Z");
    const range = rolling7DayRange(now);

    expect(periodDays(range)).toBe(7);
    expect(range.end.getFullYear()).toBe(2026);
    expect(range.end.getMonth()).toBe(7); // August
    expect(range.end.getDate()).toBe(18);
    expect(range.start.getDate()).toBe(12); // 18 - 6
  });

  it("start is midnight and end is end-of-day", () => {
    const now = new Date("2026-08-18T15:30:00Z");
    const range = rolling7DayRange(now);

    expect(range.start.getHours()).toBe(0);
    expect(range.start.getMinutes()).toBe(0);
    expect(range.end.getHours()).toBe(23);
    expect(range.end.getMinutes()).toBe(59);
  });
});

// ---------------------------------------------------------------------------
// rollingRange
// ---------------------------------------------------------------------------

describe("rollingRange", () => {
  it("spans exactly `days` calendar days ending today, inclusive", () => {
    const now = new Date("2026-08-18T15:30:00Z");

    expect(periodDays(rollingRange(14, now))).toBe(14);
    expect(periodDays(rollingRange(30, now))).toBe(30);
    expect(periodDays(rollingRange(90, now))).toBe(90);
  });

  it("rollingRange(7, now) matches rolling7DayRange(now)", () => {
    const now = new Date("2026-08-18T15:30:00Z");
    expect(rollingRange(7, now)).toEqual(rolling7DayRange(now));
  });
});

// ---------------------------------------------------------------------------
// monthRange
// ---------------------------------------------------------------------------

describe("monthRange", () => {
  it("resolves to the 1st through the last day of the anchor month", () => {
    const now = new Date("2026-02-15T00:00:00Z");
    const range = monthRange(now);

    expect(range.start.getDate()).toBe(1);
    expect(range.start.getMonth()).toBe(1); // Feb
    // 2026 is not a leap year -> Feb has 28 days.
    expect(range.end.getDate()).toBe(28);
    expect(range.end.getMonth()).toBe(1);
  });

  it("handles a 31-day month correctly", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const range = monthRange(now);

    expect(range.start.getDate()).toBe(1);
    expect(range.end.getDate()).toBe(31);
  });

  it("monthsAgo shifts to a previous calendar month", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const range = monthRange(now, 1);

    expect(range.start.getMonth()).toBe(6); // July
    expect(range.end.getMonth()).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// customDateRange
// ---------------------------------------------------------------------------

describe("customDateRange", () => {
  it("spans full calendar days from start through end, inclusive", () => {
    const range = customDateRange("2026-08-01", "2026-08-10");

    expect(periodDays(range)).toBe(10);
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getHours()).toBe(23);
  });

  it("a single-day range spans exactly 1 day", () => {
    const range = customDateRange("2026-08-05", "2026-08-05");
    expect(periodDays(range)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// allTimeRange
// ---------------------------------------------------------------------------

describe("allTimeRange", () => {
  it("spans from the earliest workout through now", () => {
    const now = new Date("2026-08-18T12:00:00Z");
    const workouts = [
      makeWorkout("a", "2026-06-01T00:00:00Z"),
      makeWorkout("b", "2026-07-15T00:00:00Z"),
      makeWorkout("c", "2026-05-20T00:00:00Z"), // earliest
    ];

    const range = allTimeRange(workouts, now);

    expect(range.start.getMonth()).toBe(4); // May
    expect(range.start.getDate()).toBe(20);
    expect(range.end.getDate()).toBe(18);
  });

  it("falls back to just today when there are no workouts", () => {
    const now = new Date("2026-08-18T12:00:00Z");
    const range = allTimeRange([], now);
    expect(periodDays(range)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// periodDays / proRateFactor / proRateBand
// ---------------------------------------------------------------------------

describe("periodDays", () => {
  it("a range spanning exactly one calendar day is 1 day", () => {
    const day = customDateRange("2026-08-05", "2026-08-05");
    expect(periodDays(day)).toBe(1);
  });
});

describe("proRateFactor", () => {
  it("a 7-day period has a factor of 1", () => {
    expect(proRateFactor(7)).toBe(1);
  });

  it("a 1-day period has a factor of 1/7", () => {
    expect(proRateFactor(1)).toBeCloseTo(1 / 7, 10);
  });

  it("a 30-day (calendar month) period has a factor of ~4.29", () => {
    expect(proRateFactor(30)).toBeCloseTo(30 / 7, 10);
  });
});

describe("proRateBand", () => {
  it("scales a weekly band by days/7", () => {
    expect(proRateBand([10, 20], 14)).toEqual([20, 40]);
  });

  it("a 1-day band is 1/7th of the weekly band", () => {
    const [min, max] = proRateBand([7, 14], 1);
    expect(min).toBeCloseTo(1, 6);
    expect(max).toBeCloseTo(2, 6);
  });

  it("proRateBands applies the scale across every key", () => {
    const bands = { a: [10, 20] as [number, number], b: [4, 8] as [number, number] };
    expect(proRateBands(bands, 14)).toEqual({ a: [20, 40], b: [8, 16] });
  });
});

// ---------------------------------------------------------------------------
// weeklyAverageVolume (all-time comparison mode)
// ---------------------------------------------------------------------------

describe("weeklyAverageVolume", () => {
  it("divides totals down to a per-week rate", () => {
    const volume = {
      mid_chest: { sets: 40, tonnageKg: 4000 },
    } as unknown as VolumeByMuscle;

    // 28 days = 4 weeks of history.
    const result = weeklyAverageVolume(volume, 28);

    expect(result.mid_chest.sets).toBeCloseTo(10, 6);
    expect(result.mid_chest.tonnageKg).toBeCloseTo(1000, 6);
  });
});

// ---------------------------------------------------------------------------
// resolvePeriod
// ---------------------------------------------------------------------------

describe("resolvePeriod", () => {
  const now = new Date("2026-08-18T12:00:00Z"); // Tuesday

  it("rolling7 resolves to a 7-day trailing window", () => {
    const scope: PeriodScope = { kind: "rolling7" };
    const resolved = resolvePeriod(scope, 1, [], now);
    expect(resolved.days).toBe(7);
    expect(resolved.isAllTime).toBe(false);
  });

  it("rolling14/30/90 resolve to their respective trailing windows", () => {
    expect(resolvePeriod({ kind: "rolling14" }, 1, [], now).days).toBe(14);
    expect(resolvePeriod({ kind: "rolling14" }, 1, [], now).label).toBe("Last 14 days");
    expect(resolvePeriod({ kind: "rolling30" }, 1, [], now).days).toBe(30);
    expect(resolvePeriod({ kind: "rolling30" }, 1, [], now).label).toBe("Last 30 days");
    expect(resolvePeriod({ kind: "rolling90" }, 1, [], now).days).toBe(90);
    expect(resolvePeriod({ kind: "rolling90" }, 1, [], now).label).toBe("Last 90 days");
  });

  it("week resolves per weekStartsOn", () => {
    const scope: PeriodScope = { kind: "week" };
    const mon = resolvePeriod(scope, 1, [], now);
    const sun = resolvePeriod(scope, 0, [], now);
    expect(mon.range.start.getDay()).toBe(1);
    expect(sun.range.start.getDay()).toBe(0);
  });

  it("week counts only elapsed days mid-week, and labels the elapsed fraction", () => {
    const wednesday = new Date("2026-08-19T12:00:00Z"); // 3rd day of the Mon-start week
    const resolved = resolvePeriod({ kind: "week" }, 1, [], wednesday);
    expect(resolved.days).toBe(3);
    expect(resolved.range.end.getDate()).toBe(19); // capped at today, not Sunday the 23rd
    expect(resolved.label).toBe(`${rangeLabel(resolved.range.start, resolved.range.end)} (3 of 7 days)`);
  });

  it("week label has no elapsed-fraction suffix on the last day of the week", () => {
    const sunday = new Date("2026-08-23T12:00:00Z"); // last day of the Mon-start week
    const resolved = resolvePeriod({ kind: "week" }, 1, [], sunday);
    expect(resolved.days).toBe(7);
    expect(resolved.label).toBe(rangeLabel(resolved.range.start, resolved.range.end));
  });

  it("month resolves to the current calendar month, capped at today mid-month", () => {
    const scope: PeriodScope = { kind: "month" };
    const resolved = resolvePeriod(scope, 1, [], now); // now = Aug 18
    expect(resolved.range.start.getDate()).toBe(1);
    expect(resolved.range.end.getDate()).toBe(18); // capped at "now", not the 31st
  });

  it("month resolves to the full calendar month on the last day of a 30-day month", () => {
    const sep30 = new Date("2026-09-30T12:00:00Z");
    const resolved = resolvePeriod({ kind: "month" }, 1, [], sep30);
    expect(resolved.days).toBe(30);
    expect(resolved.range.end.getDate()).toBe(30);
    expect(resolved.label).toBe(rangeLabel(resolved.range.start, resolved.range.end)); // no elapsed suffix
  });

  it("month counts only elapsed days mid-month, and labels the elapsed fraction", () => {
    const aug19 = new Date("2026-08-19T12:00:00Z");
    const resolved = resolvePeriod({ kind: "month" }, 1, [], aug19);
    expect(resolved.days).toBe(19);
    expect(resolved.range.end.getDate()).toBe(19);
    expect(resolved.label).toBe(`${rangeLabel(resolved.range.start, resolved.range.end)} (19 of 31 days)`);
  });

  it("custom resolves to the given date-only strings", () => {
    const scope: PeriodScope = { kind: "custom", customStart: "2026-07-01", customEnd: "2026-07-15" };
    const resolved = resolvePeriod(scope, 1, [], now);
    expect(resolved.days).toBe(15);
  });

  it("allTime is flagged isAllTime and spans from the earliest workout", () => {
    const scope: PeriodScope = { kind: "allTime" };
    const workouts = [makeWorkout("a", "2026-01-01T00:00:00Z")];
    const resolved = resolvePeriod(scope, 1, workouts, now);
    expect(resolved.isAllTime).toBe(true);
    expect(resolved.range.start.getMonth()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// previousPeriodRange
// ---------------------------------------------------------------------------

describe("previousPeriodRange", () => {
  it("returns the same-length window immediately before the current one", () => {
    const scope: PeriodScope = { kind: "rolling7" };
    const current = rolling7DayRange(new Date("2026-08-18T12:00:00Z"));
    const previous = previousPeriodRange(scope, current);

    expect(previous).not.toBeNull();
    expect(periodDays(previous!)).toBe(periodDays(current));
    expect(previous!.end.getTime()).toBeLessThan(current.start.getTime());
  });

  it("returns null for all-time (nothing precedes the full history)", () => {
    const scope: PeriodScope = { kind: "allTime" };
    const current = allTimeRange([], new Date());
    expect(previousPeriodRange(scope, current)).toBeNull();
  });

  it("matches the elapsed length of a mid-week 'week' period, not the full 7 days", () => {
    const wednesday = new Date("2026-08-19T12:00:00Z");
    const scope: PeriodScope = { kind: "week" };
    const current = resolvePeriod(scope, 1, [], wednesday).range;
    const previous = previousPeriodRange(scope, current);

    expect(previous).not.toBeNull();
    expect(periodDays(previous!)).toBe(3); // same as the elapsed current period, not 7
    expect(previous!.end.getTime()).toBeLessThan(current.start.getTime());
  });

  it("matches the elapsed length of a mid-month 'month' period, not the full month", () => {
    const aug19 = new Date("2026-08-19T12:00:00Z");
    const scope: PeriodScope = { kind: "month" };
    const current = resolvePeriod(scope, 1, [], aug19).range;
    const previous = previousPeriodRange(scope, current);

    expect(previous).not.toBeNull();
    expect(periodDays(previous!)).toBe(19);
    expect(previous!.end.getTime()).toBeLessThan(current.start.getTime());
  });
});

// ---------------------------------------------------------------------------
// filterWorkoutsInRange (pre-existing behavior, still covered)
// ---------------------------------------------------------------------------

describe("filterWorkoutsInRange", () => {
  it("includes workouts within the range, inclusive of both ends", () => {
    const range = customDateRange("2026-08-01", "2026-08-10");
    const workouts = [
      makeWorkout("early", "2026-07-31T00:00:00Z"),
      makeWorkout("in", "2026-08-05T00:00:00Z"),
      makeWorkout("late", "2026-08-11T00:00:00Z"),
    ];

    expect(filterWorkoutsInRange(workouts, range).map((w) => w.id)).toEqual(["in"]);
  });
});
