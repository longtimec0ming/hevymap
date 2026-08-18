// Exercise -> sub-muscle resolution and fractional set/tonnage volume
// allocation. See PLAN.md §6 and §8, and CLAUDE.md invariant #5.
//
// Resolution order (never violate): user override -> repo map
// (data/muscle-map.json) -> inference rules (data/inference-rules.ts) ->
// coarse fallback (even split across the taxonomy region's sub-muscles).
// Every contribution map this module returns is validated against
// data/validate-muscle-map.ts before being handed back.

import repoMuscleMap from "../data/muscle-map.json";
import { SUB_MUSCLE_IDS, TAXONOMY, type SubMuscleId } from "../data/taxonomy";
import type { MuscleMap } from "../data/types";
import { validateEntry } from "../data/validate-muscle-map";
import { COARSE_GROUP_TO_REGION, inferContributions } from "../data/inference-rules";
import type { EquipmentCategory, HevyExercise, HevyExerciseTemplate, HevyWorkout, SetType } from "./hevy";
import type { OverridesMap } from "./overrides";

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export type ContributionMap = Partial<Record<SubMuscleId, number>>;

export type ResolutionSource = "override" | "repo_map" | "inference" | "fallback";

export interface ResolvedMapping {
  contributions: ContributionMap;
  source: ResolutionSource;
}

/** The minimal exercise identity resolution needs: an id to key overrides
 * and the repo map on, a name for keyword inference, and (when available)
 * Hevy's coarse tag/equipment for inference and the coarse fallback. */
export interface ExerciseIdentity {
  /** Hevy exercise_template_id. */
  id: string;
  name: string;
  primaryMuscleGroup?: string;
  equipment?: EquipmentCategory;
}

export interface ResolveContext {
  /** Defaults to no overrides (empty). Pass `getOverrides()` from
   * lib/overrides.ts for real usage. */
  overrides?: OverridesMap;
  /** Defaults to data/muscle-map.json. Overridable for tests/fixtures. */
  repoMap?: MuscleMap;
}

const DEFAULT_REPO_MAP = repoMuscleMap as unknown as MuscleMap;

function assertValid(contributions: ContributionMap, context: string): void {
  const errors = validateEntry({
    hevy_id: context,
    name: context,
    contributions: contributions as Record<string, number>,
    confidence: "high",
  });
  if (errors.length > 0) {
    throw new Error(`resolved contribution map for "${context}" failed validation: ${errors.join("; ")}`);
  }
}

/** Splits 1.0 evenly across every sub-muscle belonging to `region`. Falls
 * back to an even split across all 26 sub-muscles if the region is unknown
 * (last resort for an exercise whose coarse muscle tag we can't interpret
 * at all). */
function evenSplitForRegion(region: string | undefined): ContributionMap {
  const members = region ? TAXONOMY.filter((m) => m.region === region).map((m) => m.id) : undefined;
  const ids = members && members.length > 0 ? members : (SUB_MUSCLE_IDS as SubMuscleId[]);
  const fraction = 1 / ids.length;
  const contributions: ContributionMap = {};
  for (const id of ids) contributions[id] = fraction;
  return contributions;
}

/** Resolves an exercise's sub-muscle contribution split, in precedence
 * order: user override -> repo map -> inference rules -> coarse fallback.
 * The returned contribution map always sums to 1.0 +/- 0.001 and uses only
 * canonical sub-muscle IDs (validated before returning). */
export function resolveExerciseMapping(exercise: ExerciseIdentity, context: ResolveContext = {}): ResolvedMapping {
  const override = context.overrides?.[exercise.id];
  if (override) {
    assertValid(override, exercise.id);
    return { contributions: override, source: "override" };
  }

  const repoMap = context.repoMap ?? DEFAULT_REPO_MAP;
  // CSV-imported exercises (see lib/csv/parse-hevy-csv.ts) carry a
  // deterministic pseudo-id (`csv:<slug>`), not a real Hevy
  // exercise_template_id, so an id match against the repo map never hits.
  // Fall back to a case-insensitive exact name match so CSV rows still
  // resolve to a real mapping instead of always falling through to
  // inference/fallback.
  const repoEntry =
    repoMap.find((entry) => entry.hevy_id === exercise.id) ??
    repoMap.find((entry) => entry.name.toLowerCase() === exercise.name.toLowerCase());
  if (repoEntry) {
    assertValid(repoEntry.contributions, exercise.id);
    return { contributions: repoEntry.contributions as ContributionMap, source: "repo_map" };
  }

  const inferred = inferContributions({
    name: exercise.name,
    primaryMuscleGroup: exercise.primaryMuscleGroup,
    equipment: exercise.equipment,
  });
  if (inferred) {
    assertValid(inferred, exercise.id);
    return { contributions: inferred, source: "inference" };
  }

  const region = exercise.primaryMuscleGroup
    ? COARSE_GROUP_TO_REGION[exercise.primaryMuscleGroup.toLowerCase()]
    : undefined;
  const fallback = evenSplitForRegion(region);
  assertValid(fallback, exercise.id);
  return { contributions: fallback, source: "fallback" };
}

/** Builds an ExerciseIdentity from a logged workout exercise plus (if
 * available) its exercise template, for feeding into resolveExerciseMapping.
 * `templates` is keyed by exercise_template_id — pass the cached template
 * list from lib/storage.ts as a Map (e.g. `new Map(templates.map(t =>
 * [t.id, t]))`). */
export function buildExerciseIdentity(
  exercise: HevyExercise,
  templates?: ReadonlyMap<string, HevyExerciseTemplate>,
): ExerciseIdentity {
  const template = templates?.get(exercise.exercise_template_id);
  return {
    id: exercise.exercise_template_id,
    name: exercise.title,
    primaryMuscleGroup: template?.primary_muscle_group,
    equipment: template?.equipment,
  };
}

// ---------------------------------------------------------------------------
// Volume allocation
// ---------------------------------------------------------------------------

export interface MuscleVolume {
  /** Fractional hard sets allocated to this sub-muscle (primary metric). */
  sets: number;
  /** Tonnage (kg * reps) allocated to this sub-muscle (secondary metric,
   * toggle). Bodyweight exercises only count logged *added* weight — Hevy
   * doesn't report bodyweight itself, so tonnage understates true load for
   * bodyweight movements. Sets are unaffected by this limitation. */
  tonnageKg: number;
}

/** Per-sub-muscle volume totals. Always has all 26 canonical keys present
 * (zeroed if untouched) so consumers (e.g. the body map) don't need to
 * guard against missing entries. */
export type VolumeByMuscle = Record<SubMuscleId, MuscleVolume>;

function emptyVolumeByMuscle(): VolumeByMuscle {
  const result = {} as VolumeByMuscle;
  for (const id of SUB_MUSCLE_IDS as SubMuscleId[]) {
    result[id] = { sets: 0, tonnageKg: 0 };
  }
  return result;
}

const WARMUP_SET_TYPE: SetType = "warmup";

export interface VolumeOptions {
  /** Include warm-up sets. Defaults to false (matches
   * lib/storage.ts's Prefs.includeWarmups default). Pass
   * `getPrefs().includeWarmups` from the caller to respect the user's
   * setting everywhere volume is computed, per CLAUDE.md conventions. */
  includeWarmups?: boolean;
}

/** Adds one exercise's sets into a mutable VolumeByMuscle accumulator.
 * Exported for callers that need to compute volume across an
 * already-flattened list of (exercise, template) pairs; most callers should
 * use computeVolumeByMuscle instead. */
export function accumulateExerciseVolume(
  accumulator: VolumeByMuscle,
  exercise: HevyExercise,
  mapping: ResolvedMapping,
  options: VolumeOptions = {},
): void {
  const includeWarmups = options.includeWarmups ?? false;

  for (const set of exercise.sets) {
    if (set.type === WARMUP_SET_TYPE && !includeWarmups) continue;

    const tonnage = (set.weight_kg ?? 0) * (set.reps ?? 0);
    for (const [subMuscleId, fraction] of Object.entries(mapping.contributions) as [SubMuscleId, number][]) {
      const bucket = accumulator[subMuscleId];
      bucket.sets += fraction;
      bucket.tonnageKg += tonnage * fraction;
    }
  }
}

/** Computes fractional hard-set + tonnage volume per sub-muscle across a
 * set of workouts. Scoping to a time range, a single workout, or a single
 * exercise (PLAN.md §9) is the caller's job: pass `[workout]` for a
 * single-workout scope, or filter `workout.exercises` down to one exercise
 * before calling (see computeExerciseVolume for that shortcut). */
export function computeVolumeByMuscle(
  workouts: HevyWorkout[],
  templates: ReadonlyMap<string, HevyExerciseTemplate> | undefined,
  context: ResolveContext = {},
  options: VolumeOptions = {},
): VolumeByMuscle {
  const result = emptyVolumeByMuscle();

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const identity = buildExerciseIdentity(exercise, templates);
      const mapping = resolveExerciseMapping(identity, context);
      accumulateExerciseVolume(result, exercise, mapping, options);
    }
  }

  return result;
}

/** Convenience for the single-exercise body map scope: volume for one
 * exercise's sets only. */
export function computeExerciseVolume(
  exercise: HevyExercise,
  template: HevyExerciseTemplate | undefined,
  context: ResolveContext = {},
  options: VolumeOptions = {},
): VolumeByMuscle {
  const templates = template ? new Map([[template.id, template]]) : undefined;
  const identity = buildExerciseIdentity(exercise, templates);
  const mapping = resolveExerciseMapping(identity, context);
  const result = emptyVolumeByMuscle();
  accumulateExerciseVolume(result, exercise, mapping, options);
  return result;
}
