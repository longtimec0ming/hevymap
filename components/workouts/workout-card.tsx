"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { BodyMap } from "@/components/body-map";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { HevyExerciseTemplate, HevyWorkout } from "@/lib/hevy";
import { groupVolumeByRegion } from "@/lib/groups";
import { getOverrides } from "@/lib/overrides";
import { getEffectiveTargetBands } from "@/lib/targets";
import { computeExerciseVolume, computeVolumeByMuscle, type VolumeByMuscle } from "@/lib/volume";
import { cn } from "@/lib/utils";
import { MuscleDistributionBar } from "./muscle-distribution-bar";

const REGIONS = ["Shoulders", "Chest", "Back", "Arms", "Core", "Legs"];

/** Grouped "sets by sub-muscle" summary for a single workout — region
 * headers with subtotals, sub-muscles indented underneath (default
 * expanded), same grouping helper as the History page. */
function MuscleGroupSummary({ volumeByMuscle }: { volumeByMuscle: VolumeByMuscle }) {
  const groups = groupVolumeByRegion(volumeByMuscle).filter((g) => g.total.sets > 0);
  if (groups.length === 0) return null;

  const totalSets = groups.reduce((sum, g) => sum + g.total.sets, 0);
  const pct = (sets: number) => (totalSets > 0 ? Math.round((sets / totalSets) * 100) : 0);

  return (
    <Accordion defaultValue={REGIONS} multiple>
      {groups.map((group) => (
        <AccordionItem key={group.region} value={group.region}>
          <AccordionTrigger>
            <span className="flex w-full items-center justify-between pr-6 text-sm">
              <span>{group.region}</span>
              <span className="tabular-nums text-muted-foreground">
                {group.total.sets.toFixed(1)} sets · {pct(group.total.sets)}%
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1 pl-3">
              {group.children
                .filter((child) => child.volume.sets > 0)
                .map((child) => (
                  <li key={child.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{child.displayName}</span>
                    <span className="tabular-nums">
                      {child.volume.sets.toFixed(1)} sets · {pct(child.volume.sets)}%
                    </span>
                  </li>
                ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export interface WorkoutCardProps {
  workout: HevyWorkout;
  templatesById: ReadonlyMap<string, HevyExerciseTemplate>;
  includeWarmups: boolean;
  units: "kg" | "lbs";
  /** Initial value for `expanded`, e.g. when linked to directly from the
   * dashboard's Recent workouts card. */
  defaultExpanded?: boolean;
}

export function WorkoutCard({ workout, templatesById, includeWarmups, units, defaultExpanded }: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);

  const targetBands = getEffectiveTargetBands();
  const overrides = getOverrides();
  const setCount = workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => includeWarmups || s.type !== "warmup").length,
    0,
  );

  const workoutVolume = useMemo(
    () => computeVolumeByMuscle([workout], templatesById, { overrides }, { includeWarmups }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workout, templatesById, includeWarmups],
  );

  return (
    <Card id={`workout-${workout.id}`} className="border-border/70">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{workout.title || "Workout"}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(workout.start_time).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {" · "}
            {workout.exercises.length} exercises · {setCount} sets
          </p>
          <MuscleDistributionBar volumeByMuscle={workoutVolume} className="mt-2 max-w-sm" />
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <CardContent className="space-y-4 border-t border-border/70 px-4 py-4">
          <BodyMap volumeByMuscle={workoutVolume} targetBands={targetBands} units={units} />

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Muscles hit</h3>
            <MuscleGroupSummary volumeByMuscle={workoutVolume} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exercises</h3>
            <ul className="divide-y divide-border/60">
            {workout.exercises.map((exercise, index) => {
              const isSelected = selectedExerciseIndex === index;
              const template = templatesById.get(exercise.exercise_template_id);
              return (
                <li key={`${exercise.exercise_template_id}-${index}`} className="py-2">
                  <button
                    type="button"
                    onClick={() => setSelectedExerciseIndex(isSelected ? null : index)}
                    className="flex w-full items-center justify-between gap-3 text-left text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {exercise.title}
                      {!template && <Badge variant="outline">estimated</Badge>}
                    </span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {exercise.sets.filter((s) => includeWarmups || s.type !== "warmup").length} sets
                    </span>
                  </button>
                  {isSelected && (
                    <div className="mt-3">
                      <BodyMap
                        volumeByMuscle={computeExerciseVolume(exercise, template, { overrides }, { includeWarmups })}
                        targetBands={targetBands}
                        units={units}
                      />
                    </div>
                  )}
                </li>
              );
            })}
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
