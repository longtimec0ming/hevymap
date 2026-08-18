// Click-a-muscle drill-down panel for the dashboard body map (PLAN.md §9:
// "click a muscle -> drill-down panel listing which exercises fed it in the
// current scope, sorted by contribution"). Wired via BodyMap's existing
// onMuscleClick prop from app/page.tsx — this file never touches
// components/body-map internals.

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import type { HevyExerciseTemplate, HevyWorkout, SetType } from "@/lib/hevy";
import { getOverrides } from "@/lib/overrides";
import { buildExerciseIdentity, resolveExerciseMapping } from "@/lib/volume";

export interface MuscleDetailPanelProps {
  muscleId: SubMuscleId;
  workoutsInPeriod: HevyWorkout[];
  templatesById: Map<string, HevyExerciseTemplate>;
  includeWarmups: boolean;
  onClose: () => void;
}

interface ExerciseContribution {
  id: string;
  name: string;
  sets: number;
}

const WARMUP_SET_TYPE: SetType = "warmup";

/** Sets each exercise contributed to `muscleId` in the given workouts,
 * aggregated by exercise identity and sorted by contribution descending.
 * Mirrors lib/volume.ts's resolution/allocation logic but keyed to a single
 * target muscle instead of all 26. */
function contributionsToMuscle(
  workouts: HevyWorkout[],
  templatesById: Map<string, HevyExerciseTemplate>,
  muscleId: SubMuscleId,
  includeWarmups: boolean,
): ExerciseContribution[] {
  const overrides = getOverrides();
  const byId = new Map<string, ExerciseContribution>();

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const identity = buildExerciseIdentity(exercise, templatesById);
      const mapping = resolveExerciseMapping(identity, { overrides });
      const fraction = mapping.contributions[muscleId] ?? 0;
      if (fraction <= 0) continue;

      let sets = 0;
      for (const set of exercise.sets) {
        if (set.type === WARMUP_SET_TYPE && !includeWarmups) continue;
        sets += fraction;
      }
      if (sets <= 0) continue;

      const existing = byId.get(identity.id);
      if (existing) {
        existing.sets += sets;
      } else {
        byId.set(identity.id, { id: identity.id, name: identity.name, sets });
      }
    }
  }

  return [...byId.values()].sort((a, b) => b.sets - a.sets);
}

export function MuscleDetailPanel({ muscleId, workoutsInPeriod, templatesById, includeWarmups, onClose }: MuscleDetailPanelProps) {
  const taxon = TAXONOMY_BY_ID[muscleId];
  const contributions = contributionsToMuscle(workoutsInPeriod, templatesById, muscleId, includeWarmups);
  const href = `/exercises?muscle=${muscleId}&group=${encodeURIComponent(taxon.region)}`;

  return (
    <Card className="border-border/70">
      <CardContent className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{taxon.displayName}</h2>
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close">
            <X className="size-3.5" />
          </Button>
        </div>

        {contributions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing fed {taxon.displayName} in this period.</p>
        ) : (
          <ul className="space-y-1.5">
            {contributions.map((row) => (
              <li key={row.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{row.name}</span>
                <span className="tabular-nums text-muted-foreground">{row.sets.toFixed(1)} sets</span>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          render={
            <Link href={href}>
              Find exercises
              <ArrowRight data-icon="inline-end" />
            </Link>
          }
        />
      </CardContent>
    </Card>
  );
}
