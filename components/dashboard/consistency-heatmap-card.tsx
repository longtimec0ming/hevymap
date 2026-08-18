"use client";

// GitHub-style contribution calendar of workout days over the last 12
// months. Fixed to that window by definition (PLAN's "last 12 months"), so
// unlike the other chart cards it doesn't take a range/bucket selection —
// see ChartCard's showControls={false} equivalent, implemented directly
// here since this card isn't built on ChartCard at all (no Recharts plot,
// just a day grid).

import { useMemo, useState } from "react";
import { differenceInCalendarWeeks, format, startOfWeek } from "date-fns";
import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { HevyWorkout } from "@/lib/hevy";
import { consistencyCalendar, type ConsistencyDay } from "@/lib/stats";
import { cn } from "@/lib/utils";

function levelClass(count: number, maxCount: number): string {
  if (count === 0) return "bg-muted";
  const ratio = count / maxCount;
  if (ratio > 0.75) return "bg-brand";
  if (ratio > 0.5) return "bg-brand/70";
  if (ratio > 0.25) return "bg-brand/45";
  return "bg-brand/25";
}

export function ConsistencyHeatmapCard({ workouts, weekStartsOn }: { workouts: HevyWorkout[]; weekStartsOn: 0 | 1 }) {
  const [hovered, setHovered] = useState<ConsistencyDay | null>(null);
  const days = useMemo(() => consistencyCalendar(workouts), [workouts]);
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const totalDaysTrained = days.filter((d) => d.count > 0).length;

  const columns = useMemo(() => {
    const firstWeekStart = startOfWeek(days[0]!.date, { weekStartsOn });
    const lastWeekStart = startOfWeek(days[days.length - 1]!.date, { weekStartsOn });
    const weekCount = differenceInCalendarWeeks(lastWeekStart, firstWeekStart, { weekStartsOn }) + 1;
    const grid: (ConsistencyDay | null)[][] = Array.from({ length: weekCount }, () => Array<ConsistencyDay | null>(7).fill(null));
    for (const day of days) {
      const weekIndex = differenceInCalendarWeeks(startOfWeek(day.date, { weekStartsOn }), firstWeekStart, { weekStartsOn });
      const dayOfWeek = (day.date.getDay() - weekStartsOn + 7) % 7;
      grid[weekIndex]![dayOfWeek] = day;
    }
    return grid;
  }, [days, weekStartsOn]);

  return (
    <Card className="border-border/70">
      <CardContent className="px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="size-4 text-brand" strokeWidth={1.75} />
          <div>
            <h3 className="text-sm font-semibold">Consistency</h3>
            <p className="text-xs text-muted-foreground">{totalDaysTrained} training days in the last 12 months</p>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="flex w-fit gap-[3px]" onMouseLeave={() => setHovered(null)}>
            {columns.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {week.map((day, dayIndex) =>
                  day ? (
                    <button
                      key={dayIndex}
                      type="button"
                      onMouseEnter={() => setHovered(day)}
                      onFocus={() => setHovered(day)}
                      className={cn("size-[10px] rounded-[2px] outline-none focus-visible:ring-1 focus-visible:ring-ring", levelClass(day.count, maxCount))}
                      aria-label={`${format(day.date, "MMM d, yyyy")}: ${day.count} workout${day.count === 1 ? "" : "s"}`}
                    />
                  ) : (
                    <div key={dayIndex} className="size-[10px]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {hovered ? `${format(hovered.date, "MMM d, yyyy")} — ${hovered.count} workout${hovered.count === 1 ? "" : "s"}` : "Hover a day for details"}
          </span>
          <span className="flex items-center gap-1">
            Less
            <span className="size-[10px] rounded-[2px] bg-muted" />
            <span className="size-[10px] rounded-[2px] bg-brand/25" />
            <span className="size-[10px] rounded-[2px] bg-brand/45" />
            <span className="size-[10px] rounded-[2px] bg-brand/70" />
            <span className="size-[10px] rounded-[2px] bg-brand" />
            More
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
