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
import { useWorkoutData } from "@/lib/hooks/use-workout-data";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

const REPO_MAP = repoMuscleMap as unknown as MuscleMap;

const SOURCE_LABEL: Record<ResolutionSource, string> = {
  override: "custom mapping",
  repo_map: "repo map",
  inference: "estimated",
  fallback: "estimated",
};

function sourceBadgeVariant(source: ResolutionSource): "default" | "outline" | "secondary" {
  if (source === "override") return "default";
  if (source === "repo_map") return "secondary";
  return "outline";
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

  if (!data.loaded) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exercises</h1>
        <p className="text-sm text-muted-foreground">
          {identities.length} exercises. Search to find one, then define or correct its sub-muscle split.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <Command className="h-[32rem] rounded-lg border border-border/70 bg-card">
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

        <div>
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select an exercise to view or edit its mapping.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{selected.identity.name}</h2>
                <Badge variant={sourceBadgeVariant(selected.mapping.source)}>
                  {SOURCE_LABEL[selected.mapping.source]}
                </Badge>
              </div>

              {previewVolume && <BodyMap volumeByMuscle={previewVolume} />}

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
          )}
        </div>
      </div>
    </div>
  );
}
