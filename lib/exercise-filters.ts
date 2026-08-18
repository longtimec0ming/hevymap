// Pure filter/sort logic for the Exercises page's filter bar. Kept separate
// from the page component so the semantics (threshold matching, OR across
// selected muscles, source/confidence matching, sorting) are unit-testable
// without React or IndexedDB in the loop.

import type { SubMuscleId } from "../data/taxonomy";
import type { MappingConfidence } from "../data/types";
import type { ContributionMap, ResolutionSource } from "./volume";

/** One exercise's resolved mapping, flattened into whatever the filters
 * need to read. Callers build this from resolveExerciseMapping's output
 * plus template/identity metadata — see app/exercises/page.tsx. */
export interface ExerciseFilterItem {
  id: string;
  name: string;
  contributions: ContributionMap;
  source: ResolutionSource;
  /** Only meaningful when source === "repo_map" (repo map entries carry a
   * confidence rating; overrides/inference/fallback don't). */
  confidence?: MappingConfidence;
  equipment?: string;
  isCustom?: boolean;
}

/** Source/confidence filter values shown in the UI: the repo map's three
 * confidence tiers, plus "override" and "estimated" (inference or coarse
 * fallback — anything the UI badges as estimated elsewhere in the app). */
export type SourceFilterValue = MappingConfidence | "override" | "estimated";

export type ExerciseSortBy = "name" | "contribution" | "confidence";

export interface ExerciseFilterCriteria {
  /** OR match: an item matches if its contribution to ANY of these muscles
   * meets `threshold`. Empty/undefined = no muscle filtering. */
  muscleIds?: SubMuscleId[];
  /** Minimum contribution fraction (0-1) to count as a match against
   * `muscleIds`. Defaults to 0.15 ("significant"). */
  threshold?: number;
  /** OR match against `equipment`. Empty/undefined = no equipment filtering. */
  equipment?: string[];
  /** OR match against `source`/`confidence` (see matchesSourceFilter).
   * Empty/undefined = no source filtering. */
  sourceFilters?: SourceFilterValue[];
  customOnly?: boolean;
  /** Defaults to "contribution" when muscleIds is non-empty, else "name". */
  sortBy?: ExerciseSortBy;
}

export const DEFAULT_CONTRIBUTION_THRESHOLD = 0.15;

/** Highest contribution this item has to any of `muscleIds` (0 if none
 * selected or no overlap). */
export function maxContribution(item: ExerciseFilterItem, muscleIds: readonly SubMuscleId[]): number {
  let max = 0;
  for (const id of muscleIds) {
    const value = item.contributions[id] ?? 0;
    if (value > max) max = value;
  }
  return max;
}

function matchesSourceFilter(item: ExerciseFilterItem, sourceFilters: readonly SourceFilterValue[]): boolean {
  if (sourceFilters.length === 0) return true;
  if (item.source === "override") return sourceFilters.includes("override");
  if (item.source === "repo_map") return item.confidence !== undefined && sourceFilters.includes(item.confidence);
  // inference or fallback: both badged "estimated" throughout the UI.
  return sourceFilters.includes("estimated");
}

/** Rank used for confidence sort, highest first: override > repo-map high >
 * medium > low > estimated (inference/fallback). */
function confidenceRank(item: ExerciseFilterItem): number {
  if (item.source === "override") return 4;
  if (item.source === "repo_map") {
    if (item.confidence === "high") return 3;
    if (item.confidence === "medium") return 2;
    return 1; // low
  }
  return 0; // inference/fallback
}

/** Filters and sorts exercise items per the criteria. Pure function — safe
 * to unit test directly. */
export function filterAndSortExercises(
  items: readonly ExerciseFilterItem[],
  criteria: ExerciseFilterCriteria = {},
): ExerciseFilterItem[] {
  const muscleIds = criteria.muscleIds ?? [];
  const threshold = criteria.threshold ?? DEFAULT_CONTRIBUTION_THRESHOLD;
  const equipment = criteria.equipment ?? [];
  const sourceFilters = criteria.sourceFilters ?? [];

  const filtered = items.filter((item) => {
    if (muscleIds.length > 0) {
      // ">= threshold" alone would let a threshold of 0 ("any") match
      // muscles the exercise has zero contribution to (missing keys default
      // to 0 via `?? 0`), so require a genuinely nonzero contribution too.
      const matchesMuscle = muscleIds.some((id) => {
        const value = item.contributions[id] ?? 0;
        return value > 0 && value >= threshold;
      });
      if (!matchesMuscle) return false;
    }
    if (equipment.length > 0 && (!item.equipment || !equipment.includes(item.equipment))) return false;
    if (!matchesSourceFilter(item, sourceFilters)) return false;
    if (criteria.customOnly && !item.isCustom) return false;
    return true;
  });

  const sortBy: ExerciseSortBy = criteria.sortBy ?? (muscleIds.length > 0 ? "contribution" : "name");

  return filtered.sort((a, b) => {
    if (sortBy === "contribution") {
      const diff = maxContribution(b, muscleIds) - maxContribution(a, muscleIds);
      if (diff !== 0) return diff;
    } else if (sortBy === "confidence") {
      const diff = confidenceRank(b) - confidenceRank(a);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });
}
