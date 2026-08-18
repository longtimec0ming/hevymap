// User-defined exercise -> sub-muscle contribution overrides. Sibling of
// `lib/storage.ts`'s prefs wrapper (same localStorage pattern), kept
// separate so lib/storage.ts stays untouched (per build-step-3 scope).
//
// Overrides are the top of the resolution order (CLAUDE.md invariant #5):
// user override -> repo map -> inference rules -> coarse fallback. They
// cover both custom exercises (no repo map entry possible, per-account IDs)
// and user corrections to standard exercises.

import { validateEntry } from "../data/validate-muscle-map";
import type { SubMuscleId } from "../data/taxonomy";

export type ContributionMap = Partial<Record<SubMuscleId, number>>;

/** Hevy exercise_template_id -> contribution map. */
export type OverridesMap = Record<string, ContributionMap>;

const OVERRIDES_KEY = "hevymap:overrides";

/** Taxonomy v2 (2026-08-18) split `lats` into `lats_upper`/`lats_lower`.
 * Overrides saved before that split still key on the removed `lats` id, so
 * every read migrates it in place: `lats`'s fraction is split 50/50 into
 * `lats_upper`/`lats_lower` and merged into any existing values for those
 * ids (a saved override predating the split can't already have them). This
 * is read-time only — it doesn't write anything back, so the migration
 * re-runs (cheaply) on every read rather than depending on a one-time
 * write actually landing in localStorage. */
function migrateLatsSplit(overrides: OverridesMap): OverridesMap {
  let changed = false;
  const next: OverridesMap = {};
  for (const [exerciseId, contributions] of Object.entries(overrides)) {
    const legacy = (contributions as Record<string, number>)["lats"];
    if (legacy === undefined) {
      next[exerciseId] = contributions;
      continue;
    }
    changed = true;
    const migrated: ContributionMap = { ...contributions };
    delete (migrated as Record<string, number>)["lats"];
    // Rounded to 6dp so a plain 0.1 + 0.2-style override doesn't pick up
    // binary-float dust (e.g. 0.30000000000000004) on every read.
    migrated.lats_upper = Math.round(((migrated.lats_upper ?? 0) + legacy / 2) * 1e6) / 1e6;
    migrated.lats_lower = Math.round(((migrated.lats_lower ?? 0) + legacy / 2) * 1e6) / 1e6;
    next[exerciseId] = migrated;
  }
  return changed ? next : overrides;
}

export class InvalidOverrideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOverrideError";
  }
}

function assertValidContributions(exerciseId: string, contributions: ContributionMap): void {
  const errors = validateEntry({
    hevy_id: exerciseId,
    name: exerciseId,
    contributions: contributions as Record<string, number>,
    confidence: "high",
  });
  if (errors.length > 0) {
    throw new InvalidOverrideError(`invalid override for "${exerciseId}": ${errors.join("; ")}`);
  }
}

export function getOverrides(): OverridesMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(OVERRIDES_KEY);
  if (!raw) return {};
  try {
    return migrateLatsSplit(JSON.parse(raw) as OverridesMap);
  } catch {
    return {};
  }
}

export function getOverride(exerciseId: string): ContributionMap | undefined {
  return getOverrides()[exerciseId];
}

/** Sets (or replaces) the override for one exercise. Throws
 * InvalidOverrideError if the contribution map doesn't validate (invalid
 * sub-muscle keys, or doesn't sum to 1.0 +/- 0.001). */
export function setOverride(exerciseId: string, contributions: ContributionMap): OverridesMap {
  assertValidContributions(exerciseId, contributions);
  const next = { ...getOverrides(), [exerciseId]: contributions };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
  }
  return next;
}

export function removeOverride(exerciseId: string): OverridesMap {
  const next = { ...getOverrides() };
  delete next[exerciseId];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
  }
  return next;
}

/** Serializes all overrides to a JSON string, for the settings export button. */
export function exportOverrides(): string {
  return JSON.stringify(getOverrides(), null, 2);
}

/** Parses and validates a JSON export, then writes it. `mode: "merge"`
 * (default) layers the imported overrides on top of existing ones;
 * `"replace"` discards existing overrides entirely. Throws
 * InvalidOverrideError (before writing anything) if any entry is invalid,
 * or a plain Error if the JSON itself is malformed. */
export function importOverrides(json: string, mode: "merge" | "replace" = "merge"): OverridesMap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`could not parse overrides JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("overrides JSON must be an object mapping exercise id -> contribution map");
  }

  const incoming = migrateLatsSplit(parsed as OverridesMap);
  for (const [exerciseId, contributions] of Object.entries(incoming)) {
    assertValidContributions(exerciseId, contributions);
  }

  const next = mode === "replace" ? incoming : { ...getOverrides(), ...incoming };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
  }
  return next;
}

/** Clears all overrides. */
export function clearOverrides(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(OVERRIDES_KEY);
  }
}
