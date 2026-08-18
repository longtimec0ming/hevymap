"use client";

import { TrendGrid } from "@/components/history/trend-grid";
import { WowTable } from "@/components/history/wow-table";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ImportScreen } from "@/components/import/import-screen";
import { usePrefs } from "@/lib/hooks/use-prefs";
import { useWeeklySeries } from "@/lib/hooks/use-weekly-series";
import { useWorkoutData } from "@/lib/hooks/use-workout-data";

const HISTORY_WEEKS = 12;

export default function HistoryPage() {
  const data = useWorkoutData();
  const [prefs] = usePrefs();
  const series = useWeeklySeries(data.workouts, data.templatesById, prefs.weekStartsOn, prefs.includeWarmups, HISTORY_WEEKS);

  if (!data.loaded) return <DashboardSkeleton />;
  if (data.needsImport) return <ImportScreen onComplete={data.refresh} />;

  const currentWeek = series[series.length - 1];
  const previousWeek = series[series.length - 2] ?? currentWeek;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Trends across the last {HISTORY_WEEKS} weeks.</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Week-over-week</h2>
        <WowTable currentWeek={currentWeek} previousWeek={previousWeek} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Per sub-muscle trend</h2>
        <TrendGrid series={series} />
      </div>
    </div>
  );
}
