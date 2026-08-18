"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BodyMap } from "@/components/body-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { HevyExerciseTemplate, HevyWorkout } from "@/lib/hevy";
import { getOverrides } from "@/lib/overrides";
import { getEffectiveTargetBands } from "@/lib/targets";
import { computeExerciseVolume, computeVolumeByMuscle } from "@/lib/volume";
import { cn } from "@/lib/utils";

export interface WorkoutCardProps {
  workout: HevyWorkout;
  templatesById: ReadonlyMap<string, HevyExerciseTemplate>;
  includeWarmups: boolean;
  units: "kg" | "lbs";
}

export function WorkoutCard({ workout, templatesById, includeWarmups, units }: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);

  const targetBands = getEffectiveTargetBands();
  const overrides = getOverrides();
  const setCount = workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => includeWarmups || s.type !== "warmup").length,
    0,
  );

  return (
    <Card className="border-border/70">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div>
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
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <CardContent className="space-y-4 border-t border-border/70 px-4 py-4">
          <BodyMap
            volumeByMuscle={computeVolumeByMuscle([workout], templatesById, { overrides }, { includeWarmups })}
            targetBands={targetBands}
            units={units}
          />

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
        </CardContent>
      )}
    </Card>
  );
}
