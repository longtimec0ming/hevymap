"use client";

import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TAXONOMY } from "@/data/taxonomy";
import type { HevyExerciseTemplate, HevyWorkout } from "@/lib/hevy";
import { getOverrides } from "@/lib/overrides";
import { REGION_COLORS } from "@/lib/region-colors";
import { buildBuckets, chartRangeToDateRange, setsByRegionSeries } from "@/lib/stats";
import { ChartCard, ChartEmptyState } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

export interface SetsByGroupCardProps {
  workouts: HevyWorkout[];
  templatesById: ReadonlyMap<string, HevyExerciseTemplate>;
  weekStartsOn: 0 | 1;
  includeWarmups: boolean;
}

function regionOrder(): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const m of TAXONOMY) {
    if (!seen.has(m.region)) {
      seen.add(m.region);
      order.push(m.region);
    }
  }
  return order;
}

export function SetsByGroupCard({ workouts, templatesById, weekStartsOn, includeWarmups }: SetsByGroupCardProps) {
  const regions = regionOrder();

  return (
    <ChartCard id="setsByGroup" icon={BarChart3} title="Sets by muscle group" subtitle="Hard sets, split by region">
      {(prefs) => {
        const range = chartRangeToDateRange(prefs.range, workouts);
        const buckets = buildBuckets(range, prefs.bucket, weekStartsOn);
        const overrides = getOverrides();
        const data = setsByRegionSeries(workouts, templatesById, { overrides }, { includeWarmups }, buckets);
        const hasData = data.some((point) => regions.some((r) => Number(point[r] ?? 0) > 0));

        if (!hasData) return <ChartEmptyState message="No sets logged in this range yet." />;

        return (
          <div className="h-[240px] w-full">
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
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  wrapperStyle={{ zIndex: 50, outline: "none" }}
                  cursor={{ fill: "var(--muted)" }}
                  content={<ChartTooltip formatValue={(v) => `${v.toFixed(1)} sets`} />}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
                {regions.map((region, i) => (
                  <Bar
                    key={region}
                    dataKey={region}
                    name={region}
                    stackId="region"
                    fill={REGION_COLORS[i % REGION_COLORS.length]}
                    isAnimationActive={false}
                    radius={i === regions.length - 1 ? [2, 2, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }}
    </ChartCard>
  );
}
