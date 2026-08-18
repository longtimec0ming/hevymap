"use client";

import { useMemo, useState } from "react";
import { BodyMap } from "@/components/body-map";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { NeglectRadar } from "@/components/dashboard/neglect-radar";
import { SparklineGrid } from "@/components/dashboard/sparkline-grid";
import { SummaryStrip } from "@/components/dashboard/summary-strip";
import { ImportScreen } from "@/components/import/import-screen";
import { usePrefs } from "@/lib/hooks/use-prefs";
import { useWeeklySeries } from "@/lib/hooks/use-weekly-series";
import { useWorkoutData } from "@/lib/hooks/use-workout-data";
import { getEffectiveTargetBands } from "@/lib/targets";
import type { SubMuscleId } from "@/data/taxonomy";

const SPARKLINE_WEEKS = 8;

export default function DashboardPage() {
  const data = useWorkoutData();
  const [prefs] = usePrefs();
  const [highlighted, setHighlighted] = useState<SubMuscleId | null>(null);

  const series = useWeeklySeries(data.workouts, data.templatesById, prefs.weekStartsOn, prefs.includeWarmups, SPARKLINE_WEEKS);
  const targetBands = useMemo(() => getEffectiveTargetBands(), []);

  if (!data.loaded) {
    return <DashboardSkeleton />;
  }

  if (data.needsImport) {
    return <ImportScreen onComplete={data.refresh} />;
  }

  const currentWeek = series[series.length - 1];
  const previousWeek = series[series.length - 2] ?? currentWeek;
  const sessionsThisWeek = data.workouts.filter((w) => {
    const t = new Date(w.start_time);
    return t >= currentWeek.weekStart && t <= currentWeek.weekEnd;
  }).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Current week ({currentWeek.weekStart.toLocaleDateString()} – {currentWeek.weekEnd.toLocaleDateString()})
        </p>
      </div>

      <SummaryStrip
        volumeByMuscle={currentWeek.volume}
        previousVolumeByMuscle={previousWeek.volume}
        sessionCount={sessionsThisWeek}
        units={prefs.units}
      />

      <BodyMap
        volumeByMuscle={currentWeek.volume}
        targetBands={targetBands}
        highlightedMuscleId={highlighted}
        onMuscleHover={setHighlighted}
        onMuscleClick={setHighlighted}
        units={prefs.units}
      />

      <NeglectRadar volumeByMuscle={currentWeek.volume} targetBands={targetBands} />

      <SparklineGrid series={series} />
    </div>
  );
}
