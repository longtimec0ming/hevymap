"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BodyMap } from "@/components/body-map";
import { MappingEditor } from "@/components/mapping-editor/mapping-editor";
import repoMuscleMap from "@/data/muscle-map.json";
import { SUB_MUSCLE_IDS, TAXONOMY, TAXONOMY_BY_ID, isValidSubMuscleId, type SubMuscleId } from "@/data/taxonomy";
import type { MuscleMap } from "@/data/types";
import {
  DEFAULT_CONTRIBUTION_THRESHOLD,
  filterAndSortExercises,
  maxContribution,
  type ExerciseFilterItem,
  type ExerciseSortBy,
  type SourceFilterValue,
} from "@/lib/exercise-filters";
import { getOverrides } from "@/lib/overrides";
import { filterWorkoutsInRange, resolvePeriod } from "@/lib/period";
import { getEffectiveTargetBands } from "@/lib/targets";
import { computeVolumeByMuscle, resolveExerciseMapping, type ContributionMap, type ExerciseIdentity, type ResolutionSource } from "@/lib/volume";
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

/** Fallback equipment label parsed from a trailing "(Barbell)"-style
 * parenthetical in the exercise name, used when the template cache doesn't
 * have an entry for this identity (e.g. a CSV-imported exercise). */
function equipmentFromName(name: string): string | undefined {
  const match = /\(([^()]+)\)\s*$/.exec(name);
  if (!match) return undefined;
  return match[1].trim().toLowerCase().replace(/\s+/g, "_");
}

function contributionsToVolume(contributions: ContributionMap) {
  const result = {} as Record<SubMuscleId, { sets: number; tonnageKg: number }>;
  for (const id of SUB_MUSCLE_IDS as SubMuscleId[]) {
    result[id] = { sets: contributions[id] ?? 0, tonnageKg: 0 };
  }
  return result;
}

const REGIONS: string[] = [...new Set(TAXONOMY.map((m) => m.region))];

const THRESHOLD_PRESETS: { label: string; value: number }[] = [
  { label: "Primary ≥40%", value: 0.4 },
  { label: "Significant ≥15%", value: DEFAULT_CONTRIBUTION_THRESHOLD },
  { label: "Any >0%", value: 0 },
];

const SOURCE_FILTER_OPTIONS: { label: string; value: SourceFilterValue }[] = [
  { label: "High confidence", value: "high" },
  { label: "Medium confidence", value: "medium" },
  { label: "Low confidence", value: "low" },
  { label: "Override", value: "override" },
  { label: "Estimated", value: "estimated" },
];

const SORT_OPTIONS: { label: string; value: ExerciseSortBy }[] = [
  { label: "Name", value: "name" },
  { label: "Contribution", value: "contribution" },
  { label: "Confidence", value: "confidence" },
];

export default function ExercisesPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ExercisesPageInner />
    </Suspense>
  );
}

function ExercisesPageInner() {
  const data = useWorkoutData();
  const [prefs] = usePrefs();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveContributions, setLiveContributions] = useState<ContributionMap | null>(null);
  const [overridesVersion, setOverridesVersion] = useState(0);

  // Filter bar state.
  const [groupFilter, setGroupFilter] = useState<string>("All");
  const [selectedMuscles, setSelectedMuscles] = useState<SubMuscleId[]>([]);
  const [equipmentFilter, setEquipmentFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue[]>([]);
  const [customOnly, setCustomOnly] = useState(false);
  const [threshold, setThreshold] = useState(DEFAULT_CONTRIBUTION_THRESHOLD);
  const [sortBy, setSortBy] = useState<ExerciseSortBy | null>(null);

  // Deep-link banner (PLAN.md-adjacent: "from an under-trained sub-muscle,
  // jump straight to exercises that train it"). Captured once at mount so
  // it survives the user tweaking filters afterward, and dismissible.
  const [deepLinkMuscleId, setDeepLinkMuscleId] = useState<SubMuscleId | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    const muscleParam = searchParams.get("muscle");
    const groupParam = searchParams.get("group");
    if (muscleParam && isValidSubMuscleId(muscleParam)) {
      const id = muscleParam as SubMuscleId;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMuscles([id]);
      setGroupFilter(groupParam ?? TAXONOMY_BY_ID[id].region);
      setDeepLinkMuscleId(id);
    }
    // Only react to the initial URL — the filter bar owns state afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Distinct equipment values across the template cache, falling back to
  // parsing a trailing "(Barbell)"-style parenthetical from the name for
  // exercises the cache doesn't have (e.g. before first sync).
  const equipmentOptions = useMemo(() => {
    const values = new Set<string>();
    for (const { identity } of resolved) {
      const fromCache = data.templatesById.get(identity.id)?.equipment;
      const value = fromCache ?? equipmentFromName(identity.name);
      if (value) values.add(value);
    }
    return [...values].sort();
  }, [resolved, data.templatesById]);

  const filterItems = useMemo<ExerciseFilterItem[]>(() => {
    return resolved.map(({ identity, mapping }) => {
      const template = data.templatesById.get(identity.id);
      const equipment = template?.equipment ?? equipmentFromName(identity.name);
      return {
        id: identity.id,
        name: identity.name,
        contributions: mapping.contributions,
        source: mapping.source,
        confidence: mapping.source === "repo_map" ? repoConfidence(identity) : undefined,
        equipment,
        isCustom: template?.is_custom ?? false,
      };
    });
  }, [resolved, data.templatesById]);

  const muscleChipOptions = useMemo(
    () => (groupFilter === "All" ? TAXONOMY : TAXONOMY.filter((m) => m.region === groupFilter)),
    [groupFilter],
  );

  const filteredItems = useMemo(
    () =>
      filterAndSortExercises(filterItems, {
        muscleIds: selectedMuscles,
        threshold,
        equipment: equipmentFilter,
        sourceFilters: sourceFilter,
        customOnly,
        sortBy: sortBy ?? undefined,
      }),
    [filterItems, selectedMuscles, threshold, equipmentFilter, sourceFilter, customOnly, sortBy],
  );

  // Coverage signal: does ANY exercise in the whole bank hit the selected
  // muscle(s) at the "significant" (0.15) threshold, ignoring every other
  // filter? Zero means a real mapping-coverage gap, not just a strict filter.
  const hasAnyCoverage = useMemo(() => {
    if (selectedMuscles.length === 0) return true;
    return filterItems.some((item) => maxContribution(item, selectedMuscles) >= DEFAULT_CONTRIBUTION_THRESHOLD);
  }, [filterItems, selectedMuscles]);

  const hasActiveFilters =
    groupFilter !== "All" ||
    selectedMuscles.length > 0 ||
    equipmentFilter.length > 0 ||
    sourceFilter.length > 0 ||
    customOnly ||
    threshold !== DEFAULT_CONTRIBUTION_THRESHOLD;

  const clearFilters = () => {
    setGroupFilter("All");
    setSelectedMuscles([]);
    setEquipmentFilter([]);
    setSourceFilter([]);
    setCustomOnly(false);
    setThreshold(DEFAULT_CONTRIBUTION_THRESHOLD);
    setSortBy(null);
  };

  const toggleMuscle = (id: SubMuscleId) => {
    setSelectedMuscles((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const toggleEquipment = (value: string) => {
    setEquipmentFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const toggleSource = (value: SourceFilterValue) => {
    setSourceFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const selected = resolved.find((row) => row.identity.id === selectedId) ?? null;

  const previewVolume = selected
    ? contributionsToVolume(liveContributions ?? selected.mapping.contributions)
    : null;

  const selectedTemplate = selected ? data.templates.find((t) => t.id === selected.identity.id) : undefined;
  const confidence = selected ? repoConfidence(selected.identity) : undefined;

  // Banner data: current-period volume/target for the deep-linked muscle.
  const bannerBand = deepLinkMuscleId ? getEffectiveTargetBands()[deepLinkMuscleId] : undefined;
  const bannerSets = useMemo(() => {
    if (!deepLinkMuscleId || !data.loaded) return undefined;
    const period = resolvePeriod({ kind: "week" }, prefs.weekStartsOn, data.workouts);
    const workoutsInPeriod = filterWorkoutsInRange(data.workouts, period.range);
    const volume = computeVolumeByMuscle(workoutsInPeriod, data.templatesById, { overrides }, { includeWarmups: prefs.includeWarmups });
    return volume[deepLinkMuscleId].sets;
  }, [deepLinkMuscleId, data.loaded, data.workouts, data.templatesById, prefs.weekStartsOn, prefs.includeWarmups, overrides]);

  if (!data.loaded) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exercises</h1>
        <p className="text-sm text-muted-foreground">
          {identities.length} exercises. Search to find one, then define or correct its sub-muscle split.
        </p>
      </div>

      {deepLinkMuscleId && !bannerDismissed && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm">
          <p>
            Showing exercises that train <strong>{TAXONOMY_BY_ID[deepLinkMuscleId].displayName}</strong>
            {bannerSets !== undefined && bannerBand && (
              <>
                {" — "}
                {bannerSets.toFixed(1)} sets this week, target {bannerBand[0]}–{bannerBand[1]}
              </>
            )}
            .
          </p>
          <Button variant="ghost" size="icon-xs" onClick={() => setBannerDismissed(true)} aria-label="Dismiss">
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <Command className="h-80 rounded-lg border border-border/70 bg-card lg:h-96">
        <CommandInput placeholder="Search exercises…" value={search} onValueChange={setSearch} />
        <CommandList className="max-h-full">
          <CommandEmpty>
            <div className="px-2 py-1 text-left text-sm text-muted-foreground">
              <p>No exercises match.</p>
              {threshold > 0 && selectedMuscles.length > 0 && <p className="mt-1">Try loosening the contribution threshold.</p>}
              {!hasAnyCoverage && (
                <p className="mt-1 text-amber-500">
                  No exercise in the whole bank trains {selectedMuscles.map((id) => TAXONOMY_BY_ID[id].displayName).join(", ")} at
                  ≥15% — that&apos;s a mapping-coverage gap, not just a strict filter.
                </p>
              )}
            </div>
          </CommandEmpty>
          <CommandGroup>
            {filteredItems.map((item) => {
              const topContributions = (Object.entries(item.contributions) as [SubMuscleId, number][])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
              return (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => {
                    setSelectedId(item.id);
                    setLiveContributions(null);
                  }}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <span className="mr-auto truncate">{item.name}</span>
                  {item.equipment && (
                    <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                      {item.equipment.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {topContributions.map(([id, fraction]) => (
                    <Badge key={id} variant="outline" className="shrink-0 text-[10px]">
                      {TAXONOMY_BY_ID[id].displayName} {(fraction * 100).toFixed(0)}%
                    </Badge>
                  ))}
                  <Badge variant={sourceBadgeVariant(item.source)} className="shrink-0 text-[10px]">
                    {item.confidence ? `${item.confidence} confidence` : SOURCE_LABEL[item.source]}
                  </Badge>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>

      {/* Filter bar */}
      <div className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={groupFilter} onValueChange={(value) => value && setGroupFilter(value)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All groups</SelectItem>
              {REGIONS.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy ?? "auto"} onValueChange={(value) => setSortBy(value === "auto" ? null : (value as ExerciseSortBy))}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Sort: auto</SelectItem>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  Sort: {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch size="sm" checked={customOnly} onCheckedChange={setCustomOnly} />
            Custom only
          </label>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{filteredItems.length} of {identities.length}</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="xs" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Muscle</p>
          <div className="flex flex-wrap gap-1.5">
            {muscleChipOptions.map((m) => (
              <Button
                key={m.id}
                variant={selectedMuscles.includes(m.id as SubMuscleId) ? "secondary" : "outline"}
                size="xs"
                onClick={() => toggleMuscle(m.id as SubMuscleId)}
              >
                {m.displayName}
              </Button>
            ))}
          </div>
        </div>

        {selectedMuscles.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Threshold</p>
            <div className="flex flex-wrap gap-1.5">
              {THRESHOLD_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={threshold === preset.value ? "secondary" : "outline"}
                  size="xs"
                  onClick={() => setThreshold(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {equipmentOptions.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Equipment</p>
            <div className="flex flex-wrap gap-1.5">
              {equipmentOptions.map((value) => (
                <Button
                  key={value}
                  variant={equipmentFilter.includes(value) ? "secondary" : "outline"}
                  size="xs"
                  className="capitalize"
                  onClick={() => toggleEquipment(value)}
                >
                  {value.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Source / confidence</p>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_FILTER_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={sourceFilter.includes(opt.value) ? "secondary" : "outline"}
                size="xs"
                onClick={() => toggleSource(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

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
