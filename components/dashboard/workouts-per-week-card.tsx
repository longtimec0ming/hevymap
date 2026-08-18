"use client";

import { CalendarDays } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HevyWorkout } from "@/lib/hevy";
import { buildBuckets, chartRangeToDateRange, workoutsPerBucketSeries } from "@/lib/stats";
import { ChartCard, ChartEmptyState } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

export function WorkoutsPerWeekCard({ workouts, weekStartsOn }: { workouts: HevyWorkout[]; weekStartsOn: 0 | 1 }) {
  return (
    <ChartCard id="workoutsPerWeek" icon={CalendarDays} title="Workouts" subtitle="Sessions logged per period">
      {(prefs) => {
        const range = chartRangeToDateRange(prefs.range, workouts);
        const buckets = buildBuckets(range, prefs.bucket, weekStartsOn);
        const data = workoutsPerBucketSeries(workouts, buckets);
        const hasData = data.some((d) => d.workouts > 0);

        if (!hasData) return <ChartEmptyState message="No workouts logged in this range yet." />;

        return (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={<ChartTooltip formatValue={(v) => `${v} workout${v === 1 ? "" : "s"}`} />}
                />
                <Bar dataKey="workouts" name="Workouts" fill="var(--brand)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }}
    </ChartCard>
  );
}
