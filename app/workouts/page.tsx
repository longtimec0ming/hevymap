"use client";

import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ImportScreen } from "@/components/import/import-screen";
import { WorkoutCard } from "@/components/workouts/workout-card";
import { usePrefs } from "@/lib/hooks/use-prefs";
import { useWorkoutData } from "@/lib/hooks/use-workout-data";

export default function WorkoutsPage() {
  const data = useWorkoutData();
  const [prefs] = usePrefs();

  if (!data.loaded) return <DashboardSkeleton />;
  if (data.needsImport) return <ImportScreen onComplete={data.refresh} />;

  const sorted = [...data.workouts].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workouts</h1>
        <p className="text-sm text-muted-foreground">{sorted.length} logged. Tap one to see its body map.</p>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workouts yet — log one in Hevy and force a re-sync in Settings.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              templatesById={data.templatesById}
              includeWarmups={prefs.includeWarmups}
              units={prefs.units}
            />
          ))}
        </div>
      )}
    </div>
  );
}
