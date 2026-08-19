"use client";

// Per-sub-muscle trend grid for the Trends page: a region-level overview
// (drill into a region for its sub-muscles) with a range pill group and an
// inline "4-wk avg / vs prior 4 wks" signal per card, replacing the old
// week-over-week table (a single-week snapshot wasn't as useful as a
// trend summary on every card).

import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarWeeks, startOfWeek } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { groupVolumeByRegion, type RegionGroupVolume } from "@/lib/groups";
import type { HevyExerciseTemplate, HevyWorkout } from "@/lib/hevy";
import { useWeeklySeries, type WeeklyVolumePoint } from "@/lib/hooks/use-weekly-series";
import { computeTrendDelta } from "@/lib/trend-delta";
import { cn } from "@/lib/utils";

export interface TrendGridProps {
  workouts: HevyWorkout[];
  templatesById: ReadonlyMap<string, HevyExerciseTemplate>;
  weekStartsOn: 0 | 1;
  includeWarmups: boolean;
}

type TrendRange = "3m" | "6m" | "1y" | "all";

const RANGE_OPTIONS: { value: TrendRange; label: string }[] = [
  { value: "3m", label: "3m" },
  { value: "6m", label: "6m" },
  { value: "1y", label: "1y" },
  { value: "all", label: "All" },
];

const FIXED_WEEK_COUNTS: Record<Exclude<TrendRange, "all">, number> = {
  "3m": 13,
  "6m": 26,
  "1y": 52,
};

const RANGE_KEY = "hevymap:trends-range";

function getStoredRange(): TrendRange {
  if (typeof window === "undefined") return "3m";
  const raw = window.localStorage.getItem(RANGE_KEY);
  return raw === "3m" || raw === "6m" || raw === "1y" || raw === "all" ? raw : "3m";
}

function setStoredRange(range: TrendRange): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RANGE_KEY, range);
}

/** Number of calendar weeks (per weekStartsOn) from the earliest workout's
 * week through the current week, inclusive. Falls back to 1 with no
 * workouts. */
function weeksSinceEarliestWorkout(workouts: HevyWorkout[], weekStartsOn: 0 | 1, now = new Date()): number {
  if (workouts.length === 0) return 1;
  const earliestMs = workouts.reduce((min, w) => Math.min(min, new Date(w.start_time).getTime()), Infinity);
  const weeks = differenceInCalendarWeeks(startOfWeek(now, { weekStartsOn }), startOfWeek(new Date(earliestMs), { weekStartsOn }), {
    weekStartsOn,
  });
  return Math.max(1, weeks + 1);
}

function weekLabel(point: WeeklyVolumePoint, monthOnly: boolean): string {
  return monthOnly
    ? point.weekStart.toLocaleDateString(undefined, { month: "short" })
    : point.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PillGroup({ value, onChange }: { value: TrendRange; onChange: (value: TrendRange) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums tracking-wide transition-colors",
            value === opt.value ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TrendSignal({ weeklySets }: { weeklySets: number[] }) {
  const { recentAvg, delta } = computeTrendDelta(weeklySets);
  const isFlat = delta !== null && Math.abs(delta) < 0.5;

  return (
    <p className="mb-1 text-[11px] text-muted-foreground">
      4-wk avg {recentAvg.toFixed(1)} sets
      {delta !== null && (
        <>
          {" · "}
          <span className={cn(!isFlat && delta > 0 && "text-brand")}>
            {isFlat ? "flat" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
          </span>{" "}
          vs prior 4 wks
        </>
      )}
    </p>
  );
}

function TrendCard({
  label,
  data,
  weeklySets,
  href,
}: {
  label: string;
  data: { week: string; sets: number }[];
  weeklySets: number[];
  href?: string;
}) {
  const manyWeeks = data.length > 26;

  return (
    <Card className="border-border/70">
      <CardContent className="px-4 py-3">
        <p className="group/label mb-1 flex items-center gap-1 text-sm font-medium">
          {label}
          {href && (
            <Link
              href={href}
              className="opacity-0 transition-opacity group-hover/label:opacity-100"
              aria-label={`Find exercises that train ${label}`}
            >
              <ArrowUpRight className="size-3.5 text-muted-foreground" />
            </Link>
          )}
        </p>
        <TrendSignal weeklySets={weeklySets} />
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={manyWeeks ? 24 : 8}
                interval={manyWeeks ? "preserveStartEnd" : undefined}
              />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                }}
                formatter={(value) => [typeof value === "number" ? value.toFixed(1) : String(value), "sets"]}
              />
              <Line type="monotone" dataKey="sets" stroke="var(--brand)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrendGrid({ workouts, templatesById, weekStartsOn, includeWarmups }: TrendGridProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [range, setRange] = useState<TrendRange>("3m");

  useEffect(() => {
    // Hydrate from localStorage post-mount (SSR has no access to it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRange(getStoredRange());
  }, []);

  const weeksCount =
    range === "all" ? weeksSinceEarliestWorkout(workouts, weekStartsOn) : FIXED_WEEK_COUNTS[range];
  const series = useWeeklySeries(workouts, templatesById, weekStartsOn, includeWarmups, weeksCount);
  const monthOnly = series.length > 26;

  const handleRangeChange = (next: TrendRange) => {
    setRange(next);
    setStoredRange(next);
  };

  // Every week's volume grouped by region, so both the group-level overview
  // and a drilled-in group's sub-muscles can pull from the same computation.
  const groupedSeries: RegionGroupVolume[][] = useMemo(
    () => series.map((point) => groupVolumeByRegion(point.volume)),
    [series],
  );
  const regions = groupedSeries[0]?.map((g) => g.region) ?? [];

  const groupData = regions.map((region) => {
    const weeklySets = groupedSeries.map((weekGroups) => weekGroups.find((g) => g.region === region)?.total.sets ?? 0);
    return {
      region,
      weeklySets,
      data: series.map((point, i) => ({ week: weekLabel(point, monthOnly), sets: weeklySets[i] })),
    };
  });

  const activeChildren = selectedRegion
    ? (groupedSeries[groupedSeries.length - 1]?.find((g) => g.region === selectedRegion)?.children ?? [])
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Button variant={selectedRegion === null ? "secondary" : "outline"} size="xs" onClick={() => setSelectedRegion(null)}>
            All groups
          </Button>
          {regions.map((region) => (
            <Button
              key={region}
              variant={selectedRegion === region ? "secondary" : "outline"}
              size="xs"
              onClick={() => setSelectedRegion(region)}
            >
              {region}
            </Button>
          ))}
        </div>
        <PillGroup value={range} onChange={handleRangeChange} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {selectedRegion === null
          ? groupData.map((g) => <TrendCard key={g.region} label={g.region} data={g.data} weeklySets={g.weeklySets} />)
          : activeChildren.map((child) => {
              const weeklySets = groupedSeries.map(
                (weekGroups) => weekGroups.find((g) => g.region === selectedRegion)?.children.find((c) => c.id === child.id)?.volume.sets ?? 0,
              );
              const data = series.map((point, i) => ({ week: weekLabel(point, monthOnly), sets: weeklySets[i] }));
              const href = `/exercises?muscle=${child.id}&group=${encodeURIComponent(selectedRegion)}`;
              return <TrendCard key={child.id} label={child.displayName} data={data} weeklySets={weeklySets} href={href} />;
            })}
      </div>
    </div>
  );
}
