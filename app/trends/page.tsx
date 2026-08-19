"use client";

import { TrendGrid } from "@/components/trends/trend-grid";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ImportScreen } from "@/components/import/import-screen";
import { usePrefs } from "@/lib/hooks/use-prefs";
import { useWorkoutData } from "@/lib/hooks/use-workout-data";

export default function TrendsPage() {
  const data = useWorkoutData();
  const [prefs] = usePrefs();

  if (!data.loaded) return <DashboardSkeleton />;
  if (data.needsImport) return <ImportScreen onComplete={data.refresh} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="text-sm text-muted-foreground">How your training volume moves over time.</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Per sub-muscle trend</h2>
        <TrendGrid
          workouts={data.workouts}
          templatesById={data.templatesById}
          weekStartsOn={prefs.weekStartsOn}
          includeWarmups={prefs.includeWarmups}
        />
      </div>
    </div>
  );
}
