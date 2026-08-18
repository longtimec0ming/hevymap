"use client";

// Dashboard "Recent workouts" card (item 4): the last 5 workouts with date,
// title, duration, sets, and a muscle-distribution mini-bar (same component
// as the collapsed workout row, components/workouts/muscle-distribution-bar.tsx),
// plus a "See all ->" link to /workouts. No range/bucket controls — this
// card isn't built on ChartCard, same reasoning as ConsistencyHeatmapCard.

import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MuscleDistributionBar } from "@/components/workouts/muscle-distribution-bar";
import type { HevyExerciseTemplate, HevyWorkout } from "@/lib/hevy";
import { getOverrides } from "@/lib/overrides";
import { computeVolumeByMuscle } from "@/lib/volume";

const RECENT_COUNT = 5;

function formatDuration(startTime: string, endTime: string): string {
  const minutes = Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000));
  if (minutes === 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface RecentWorkoutsCardProps {
  workouts: HevyWorkout[];
  templatesById: ReadonlyMap<string, HevyExerciseTemplate>;
  includeWarmups: boolean;
}

export function RecentWorkoutsCard({ workouts, templatesById, includeWarmups }: RecentWorkoutsCardProps) {
  const recent = [...workouts]
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    .slice(0, RECENT_COUNT);
  const overrides = getOverrides();

  return (
    <Card className="border-border/70">
      <CardContent className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-brand" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold">Recent workouts</h3>
          </div>
          <Link href="/workouts" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            See all
            <ArrowRight className="size-3" strokeWidth={2} />
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workouts logged yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {recent.map((workout) => {
              const setCount = workout.exercises.reduce(
                (sum, ex) => sum + ex.sets.filter((s) => includeWarmups || s.type !== "warmup").length,
                0,
              );
              const volume = computeVolumeByMuscle([workout], templatesById, { overrides }, { includeWarmups });
              return (
                <li key={workout.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{workout.title || "Workout"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(workout.start_time).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        {" · "}
                        {formatDuration(workout.start_time, workout.end_time)}
                        {" · "}
                        {setCount} sets
                      </p>
                    </div>
                  </div>
                  <MuscleDistributionBar volumeByMuscle={volume} className="mt-2" />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
