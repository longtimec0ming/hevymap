"use client";

// "Sets by sub-muscle" (item 2): same stacked bars + range/bucket controls as
// SetsByGroupCard, but broken down to the 26 sub-muscles with a group filter
// (All / one of the 6 coarse regions) so the chart stays readable instead of
// always showing 26 stacked series at once.

import { useState } from "react";
import { ListTree } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TAXONOMY, TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import type { HevyExerciseTemplate, HevyWorkout } from "@/lib/hevy";
import { getOverrides } from "@/lib/overrides";
import {
  buildBuckets,
  chartRangeToDateRange,
  regionWithMostVolume,
  setsBySubMuscleSeries,
  subMuscleIdsForRegion,
} from "@/lib/stats";
import { getSetsBySubMuscleGroupFilter, setSetsBySubMuscleGroupFilter } from "@/lib/dashboard-prefs";
import { cn } from "@/lib/utils";
import { ChartCard, ChartEmptyState } from "./chart-card";
import { ChartTooltip } from "./chart-tooltip";

export interface SetsBySubMuscleCardProps {
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

const REGIONS = regionOrder();
const FILTER_OPTIONS = ["All", ...REGIONS];

// Cycled per sub-muscle within the currently-visible set (at most 8, one
// coarse region's worth). color-mix tints extend the theme's 6-color ramp
// (see sets-by-group-card.tsx) so up to 8 stacked series stay distinguishable.
const SUB_MUSCLE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--brand)",
  "color-mix(in oklch, var(--chart-1) 55%, var(--foreground))",
  "color-mix(in oklch, var(--chart-3) 55%, var(--foreground))",
];

export function SetsBySubMuscleCard({ workouts, templatesById, weekStartsOn, includeWarmups }: SetsBySubMuscleCardProps) {
  const [filter, setFilterState] = useState<string>(() => {
    const stored = getSetsBySubMuscleGroupFilter();
    if (stored) return stored;
    const overrides = getOverrides();
    return regionWithMostVolume(workouts, templatesById, { overrides }, { includeWarmups });
  });

  const setFilter = (region: string) => {
    setFilterState(region);
    setSetsBySubMuscleGroupFilter(region);
  };

  const ids = subMuscleIdsForRegion(filter as string | "All");

  return (
    <ChartCard
      id="setsBySubMuscle"
      icon={ListTree}
      title="Sets by sub-muscle"
      subtitle="Hard sets, split by individual sub-muscle"
    >
      {(prefs) => {
        const range = chartRangeToDateRange(prefs.range, workouts);
        const buckets = buildBuckets(range, prefs.bucket, weekStartsOn);
        const overrides = getOverrides();
        const data = setsBySubMuscleSeries(workouts, templatesById, { overrides }, { includeWarmups }, buckets, filter as string | "All");
        const hasData = data.some((point) => ids.some((id) => Number(point[id] ?? 0) > 0));

        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-0.5 rounded-md bg-muted p-0.5">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  aria-pressed={filter === option}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-semibold tracking-wide transition-colors",
                    filter === option ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>

            {!hasData ? (
              <ChartEmptyState message="No sets logged in this range yet." />
            ) : (
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
                      allowEscapeViewBox={{ x: true, y: true }}
                      cursor={{ fill: "var(--muted)" }}
                      content={<ChartTooltip hideZero formatValue={(v) => `${v.toFixed(1)} sets`} />}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
                    {ids.map((id, i) => (
                      <Bar
                        key={id}
                        dataKey={id}
                        name={TAXONOMY_BY_ID[id as SubMuscleId].displayName}
                        stackId="submuscle"
                        fill={SUB_MUSCLE_COLORS[i % SUB_MUSCLE_COLORS.length]}
                        isAnimationActive={false}
                        radius={i === ids.length - 1 ? [2, 2, 0, 0] : undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      }}
    </ChartCard>
  );
}
