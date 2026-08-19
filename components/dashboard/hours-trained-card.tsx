"use client";

import { Clock } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HevyWorkout } from "@/lib/hevy";
import { buildBuckets, chartRangeToDateRange, hoursTrainedSeries } from "@/lib/stats";
import { ChartCard, ChartEmptyState } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

export function HoursTrainedCard({ workouts, weekStartsOn }: { workouts: HevyWorkout[]; weekStartsOn: 0 | 1 }) {
  return (
    <ChartCard id="hoursTrained" icon={Clock} title="Hours trained" subtitle="Training duration over time">
      {(prefs) => {
        const range = chartRangeToDateRange(prefs.range, workouts);
        const buckets = buildBuckets(range, prefs.bucket, weekStartsOn);
        const data = hoursTrainedSeries(workouts, buckets);
        const hasData = data.some((d) => d.hours > 0);

        if (!hasData) return <ChartEmptyState message="No workouts logged in this range yet." />;

        return (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="hoursTrainedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  wrapperStyle={{ zIndex: 50, outline: "none" }}
                  cursor={{ stroke: "var(--border)" }}
                  content={<ChartTooltip formatValue={(v) => `${v.toFixed(1)}h`} />}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  name="Hours"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  fill="url(#hoursTrainedFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      }}
    </ChartCard>
  );
}
