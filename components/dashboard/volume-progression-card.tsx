"use client";

import { TrendingUp } from "lucide-react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HevyExerciseTemplate, HevyWorkout } from "@/lib/hevy";
import { getOverrides } from "@/lib/overrides";
import { buildBuckets, chartRangeToDateRange, volumeProgressionSeries } from "@/lib/stats";
import { convertWeight } from "@/lib/units";
import { ChartCard, ChartEmptyState } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

export interface VolumeProgressionCardProps {
  workouts: HevyWorkout[];
  templatesById: ReadonlyMap<string, HevyExerciseTemplate>;
  weekStartsOn: 0 | 1;
  includeWarmups: boolean;
  units: "kg" | "lbs";
}

export function VolumeProgressionCard({
  workouts,
  templatesById,
  weekStartsOn,
  includeWarmups,
  units,
}: VolumeProgressionCardProps) {
  return (
    <ChartCard id="volumeProgression" icon={TrendingUp} title="Volume progression" subtitle={`Total tonnage lifted per period (${units})`}>
      {(prefs) => {
        const range = chartRangeToDateRange(prefs.range, workouts);
        const buckets = buildBuckets(range, prefs.bucket, weekStartsOn);
        const overrides = getOverrides();
        const series = volumeProgressionSeries(workouts, templatesById, { overrides }, { includeWarmups }, buckets);
        const data = series.map((p) => ({ label: p.label, volume: convertWeight(p.volumeKg, units) }));
        const hasData = data.some((d) => d.volume > 0);

        if (!hasData) return <ChartEmptyState message="No volume logged in this range yet." />;

        return (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
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
                  width={44}
                  tickFormatter={(v: number) => v.toLocaleString(undefined, { notation: "compact" })}
                />
                <Tooltip
                  wrapperStyle={{ zIndex: 50, outline: "none" }}
                  cursor={{ stroke: "var(--border)" }}
                  content={<ChartTooltip formatValue={(v) => `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${units}`} />}
                />
                <Line
                  type="monotone"
                  dataKey="volume"
                  name="Volume"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      }}
    </ChartCard>
  );
}
