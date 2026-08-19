"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HevyWorkout } from "@/lib/hevy";
import { computePrEvents } from "@/lib/prs";
import { buildBuckets, chartRangeToDateRange, prsPerBucketSeries } from "@/lib/stats";
import { ChartCard, ChartEmptyState } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

export function PrsOverTimeCard({
  workouts,
  weekStartsOn,
  includeWarmups,
}: {
  workouts: HevyWorkout[];
  weekStartsOn: 0 | 1;
  includeWarmups: boolean;
}) {
  // PR detection scans full history in chronological order (a PR only means
  // something relative to everything before it), independent of the
  // card's own range — the range only decides which resulting events to
  // display.
  const events = useMemo(() => computePrEvents(workouts, { includeWarmups }), [workouts, includeWarmups]);

  return (
    <ChartCard id="prsOverTime" icon={Trophy} title="PRs over time" subtitle="New best est. 1RM or weight × reps">
      {(prefs) => {
        const range = chartRangeToDateRange(prefs.range, workouts);
        const buckets = buildBuckets(range, prefs.bucket, weekStartsOn);
        const data = prsPerBucketSeries(events, buckets);
        const hasData = data.some((d) => d.count > 0);

        if (!hasData) return <ChartEmptyState message="No PRs set in this range yet." />;

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
                  wrapperStyle={{ zIndex: 50, outline: "none" }}
                  cursor={{ fill: "var(--muted)" }}
                  content={<ChartTooltip formatValue={(v) => `${v} PR${v === 1 ? "" : "s"}`} />}
                />
                <Bar dataKey="count" name="PRs" fill="var(--brand)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }}
    </ChartCard>
  );
}
