// Dashboard stat tile row: total workouts, total sets, total volume, avg
// volume/workout, total hours trained, current streak, most-trained
// sub-muscle, longest workout — computed for the selected period, with a
// delta vs the previous period where that comparison is meaningful (not for
// streak/most-trained/longest-workout, which aren't period deltas).

import { ArrowDown, ArrowUp, Clock, Dumbbell, Flame, Layers, Timer, TrendingUp, Trophy, Weight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  currentStreakWeeks,
  mostTrainedMuscle,
  percentDelta,
  totalSets,
  totalTonnageKg,
  workoutDurationStats,
} from "@/lib/stats";
import { formatWeight } from "@/lib/units";
import { cn } from "@/lib/utils";
import type { HevyWorkout } from "@/lib/hevy";
import type { VolumeByMuscle } from "@/lib/volume";

export interface StatTilesProps {
  workoutsInPeriod: HevyWorkout[];
  /** Full workout history (unfiltered by period) — the streak is a running
   * count independent of the dashboard's period selector. */
  allWorkouts: HevyWorkout[];
  volumeByMuscle: VolumeByMuscle;
  /** Omit when there's no meaningful previous period (e.g. all-time). */
  previousWorkoutsInPeriod?: HevyWorkout[];
  previousVolumeByMuscle?: VolumeByMuscle;
  weekStartsOn: 0 | 1;
  units: "kg" | "lbs";
}

function formatHours(hours: number): string {
  return `${hours.toLocaleString(undefined, { maximumFractionDigits: 1 })}h`;
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-[10px] text-muted-foreground">new</span>;
  }
  if (Math.abs(pct) < 0.5) {
    return <span className="text-[10px] tabular-nums text-muted-foreground">flat</span>;
  }
  const Icon = pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground">
      <Icon className="size-2.5" strokeWidth={2} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  deltaPct,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  deltaPct?: number | null;
}) {
  return (
    <Card size="sm" className="border-border/70 py-1.5">
      <CardContent className="flex items-center gap-2 px-2.5">
        <Icon className="size-3.5 shrink-0 text-brand" strokeWidth={1.75} />
        <div className="min-w-0 leading-tight">
          <p className={cn("truncate text-sm font-semibold tabular-nums tracking-tight")}>
            {value} <span className="text-[10px] font-normal text-muted-foreground">{label}</span>
            {deltaPct !== undefined && (
              <>
                {" "}
                <Delta pct={deltaPct} />
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatTiles({
  workoutsInPeriod,
  allWorkouts,
  volumeByMuscle,
  previousWorkoutsInPeriod,
  previousVolumeByMuscle,
  weekStartsOn,
  units,
}: StatTilesProps) {
  const sets = totalSets(volumeByMuscle);
  const volumeKg = totalTonnageKg(volumeByMuscle);
  const workoutCount = workoutsInPeriod.length;
  const avgVolumeKg = workoutCount > 0 ? volumeKg / workoutCount : 0;
  const { totalHours, longestWorkoutMinutes } = workoutDurationStats(workoutsInPeriod);
  const streak = currentStreakWeeks(allWorkouts, weekStartsOn);
  const topMuscle = mostTrainedMuscle(volumeByMuscle);

  const hasPrevious = previousWorkoutsInPeriod !== undefined && previousVolumeByMuscle !== undefined;
  const prevSets = hasPrevious ? totalSets(previousVolumeByMuscle!) : 0;
  const prevVolumeKg = hasPrevious ? totalTonnageKg(previousVolumeByMuscle!) : 0;
  const prevWorkoutCount = previousWorkoutsInPeriod?.length ?? 0;
  const prevAvgVolumeKg = prevWorkoutCount > 0 ? prevVolumeKg / prevWorkoutCount : 0;
  const prevHours = hasPrevious ? workoutDurationStats(previousWorkoutsInPeriod!).totalHours : 0;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      <Tile
        icon={Dumbbell}
        label="Workouts"
        value={String(workoutCount)}
        deltaPct={hasPrevious ? percentDelta(workoutCount, prevWorkoutCount) : undefined}
      />
      <Tile
        icon={Layers}
        label="Hard sets"
        value={sets.toFixed(1)}
        deltaPct={hasPrevious ? percentDelta(sets, prevSets) : undefined}
      />
      <Tile
        icon={Weight}
        label="Total volume"
        value={formatWeight(volumeKg, units)}
        deltaPct={hasPrevious ? percentDelta(volumeKg, prevVolumeKg) : undefined}
      />
      <Tile
        icon={TrendingUp}
        label="Avg volume / workout"
        value={formatWeight(avgVolumeKg, units)}
        deltaPct={hasPrevious ? percentDelta(avgVolumeKg, prevAvgVolumeKg) : undefined}
      />
      <Tile
        icon={Clock}
        label="Hours trained"
        value={formatHours(totalHours)}
        deltaPct={hasPrevious ? percentDelta(totalHours, prevHours) : undefined}
      />
      <Tile icon={Flame} label="Current streak (weeks)" value={String(streak)} />
      <Tile icon={Trophy} label="Most trained" value={topMuscle ? topMuscle.displayName : "—"} />
      <Tile icon={Timer} label="Longest workout" value={formatMinutes(longestWorkoutMinutes)} />
    </div>
  );
}
