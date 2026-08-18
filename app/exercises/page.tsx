"use client";

import { useMemo, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { BodyMap } from "@/components/body-map";
import { MappingEditor } from "@/components/mapping-editor/mapping-editor";
import repoMuscleMap from "@/data/muscle-map.json";
import { SUB_MUSCLE_IDS, type SubMuscleId } from "@/data/taxonomy";
import type { MuscleMap } from "@/data/types";
import { getOverrides } from "@/lib/overrides";
import { resolveExerciseMapping, type ContributionMap, type ExerciseIdentity, type ResolutionSource } from "@/lib/volume";
import { usePrefs } from "@/lib/hooks/use-prefs";
import { useWorkoutData } from "@/lib/hooks/use-workout-data";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

const REPO_MAP = repoMuscleMap as unknown as MuscleMap;

const SOURCE_LABEL: Record<ResolutionSource, string> = {
  override: "override",
  repo_map: "repo map",
  inference: "estimated",
  fallback: "estimated",
};

function sourceBadgeVariant(source: ResolutionSource): "default" | "outline" | "secondary" {
  if (source === "override") return "default";
  if (source === "repo_map") return "secondary";
  return "outline";
}

/** Repo-map confidence for the selected exercise, when its mapping came
 * from the repo map (matches the same id-then-name fallback resolveExerciseMapping
 * uses, so this always agrees with what's actually being shown). Undefined
 * for override/inference/fallback sources — those don't carry a confidence rating. */
function repoConfidence(identity: ExerciseIdentity): "high" | "medium" | "low" | undefined {
  const entry =
    REPO_MAP.find((e) => e.hevy_id === identity.id) ??
    REPO_MAP.find((e) => e.name.toLowerCase() === identity.name.toLowerCase());
  return entry?.confidence;
}

function contributionsToVolume(contributions: ContributionMap) {
  const result = {} as Record<SubMuscleId, { sets: number; tonnageKg: number }>;
  for (const id of SUB_MUSCLE_IDS as SubMuscleId[]) {
    result[id] = { sets: contributions[id] ?? 0, tonnageKg: 0 };
  }
  return result;
}

export default function ExercisesPage() {
  const data = useWorkoutData();
  const [prefs] = usePrefs();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveContributions, setLiveContributions] = useState<ContributionMap | null>(null);
  const [overridesVersion, setOverridesVersion] = useState(0);

  // Union of exercises: everything in the repo map, plus every custom
  // exercise template (repo map only ever covers standard exercises).
  const identities = useMemo<ExerciseIdentity[]>(() => {
    const byId = new Map<string, ExerciseIdentity>();
    for (const entry of REPO_MAP) {
      byId.set(entry.hevy_id, { id: entry.hevy_id, name: entry.name });
    }
    for (const template of data.templates) {
      if (template.is_custom) {
        byId.set(template.id, {
          id: template.id,
          name: template.title,
          primaryMuscleGroup: template.primary_muscle_group,
          equipment: template.equipment,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.templates]);

  // overridesVersion isn't read inside the memo, but bumping it after a save
  // is how we force a re-read of localStorage (getOverrides has no reactive
  // subscription of its own).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overrides = useMemo(() => getOverrides(), [overridesVersion]);

  const resolved = useMemo(() => {
    return identities.map((identity) => ({
      identity,
      mapping: resolveExerciseMapping(identity, { overrides }),
    }));
  }, [identities, overrides]);

  const selected = resolved.find((row) => row.identity.id === selectedId) ?? null;

  const previewVolume = selected
    ? contributionsToVolume(liveContributions ?? selected.mapping.contributions)
    : null;

  const selectedTemplate = selected ? data.templates.find((t) => t.id === selected.identity.id) : undefined;
  const confidence = selected ? repoConfidence(selected.identity) : undefined;

  if (!data.loaded) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exercises</h1>
        <p className="text-sm text-muted-foreground">
          {identities.length} exercises. Search to find one, then define or correct its sub-muscle split.
        </p>
      </div>

      <Command className="h-64 rounded-lg border border-border/70 bg-card lg:h-72">
        <CommandInput placeholder="Search exercises…" value={search} onValueChange={setSearch} />
        <CommandList className="max-h-full">
          <CommandEmpty>No exercises found.</CommandEmpty>
          <CommandGroup>
            {resolved.map(({ identity, mapping }) => (
              <CommandItem
                key={identity.id}
                value={identity.name}
                onSelect={() => {
                  setSelectedId(identity.id);
                  setLiveContributions(null);
                }}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">{identity.name}</span>
                <Badge variant={sourceBadgeVariant(mapping.source)} className="shrink-0 text-[10px]">
                  {SOURCE_LABEL[mapping.source]}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>

      {!selected ? (
        <p className="text-sm text-muted-foreground">Select an exercise above to view or edit its mapping.</p>
      ) : (
        <div className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{selected.identity.name}</h2>
            {selectedTemplate?.equipment && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {selectedTemplate.equipment.replace(/_/g, " ")}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {selectedTemplate?.is_custom ? "custom" : selected.identity.id}
            </Badge>
            <Badge variant={sourceBadgeVariant(selected.mapping.source)} className="text-[10px]">
              {SOURCE_LABEL[selected.mapping.source]}
            </Badge>
            {confidence && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {confidence} confidence
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {previewVolume && <BodyMap volumeByMuscle={previewVolume} view="both" units={prefs.units} />}

            <div>
              <MappingEditor
                key={selected.identity.id}
                exerciseId={selected.identity.id}
                exerciseName={selected.identity.name}
                initialContributions={selected.mapping.contributions}
                hasOverride={selected.mapping.source === "override"}
                onChange={setLiveContributions}
                onSaved={() => {
                  setLiveContributions(null);
                  setOverridesVersion((v) => v + 1);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
