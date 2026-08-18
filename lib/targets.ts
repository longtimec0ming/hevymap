// User-editable weekly target-set bands, keyed by sub-muscle id. Same
// localStorage wrapper pattern as lib/overrides.ts; kept as its own file
// since lib/storage.ts (the Prefs owner) is out of scope for this build
// step. Defaults come from data/taxonomy.ts's defaultWeeklyTargetSets;
// overrides here take precedence — see getEffectiveTargetBands.

import { TAXONOMY_BY_ID, type SubMuscleId } from "../data/taxonomy";

export type TargetBand = [number, number];
export type TargetOverrides = Partial<Record<SubMuscleId, TargetBand>>;

const TARGETS_KEY = "hevymap:target-overrides";

/** Taxonomy v2 (2026-08-18) split `lats` into `lats_upper`/`lats_lower`. A
 * target override saved before that split still keys on the removed `lats`
 * id, so every read copies its band onto both new ids (unless the user has
 * already set one explicitly, which wins). Read-time only, like
 * lib/overrides.ts's equivalent migration — no write-back. */
function migrateLatsSplit(overrides: TargetOverrides): TargetOverrides {
  const legacy = (overrides as Partial<Record<string, TargetBand>>)["lats"];
  if (legacy === undefined) return overrides;
  const rest = { ...(overrides as Record<string, TargetBand>) };
  delete rest["lats"];
  return {
    lats_upper: legacy,
    lats_lower: legacy,
    ...rest,
  } as TargetOverrides;
}

export function getTargetOverrides(): TargetOverrides {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(TARGETS_KEY);
  if (!raw) return {};
  try {
    return migrateLatsSplit(JSON.parse(raw) as TargetOverrides);
  } catch {
    return {};
  }
}

export function setTargetOverride(id: SubMuscleId, band: TargetBand): TargetOverrides {
  const next = { ...getTargetOverrides(), [id]: band };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TARGETS_KEY, JSON.stringify(next));
  }
  return next;
}

export function resetTargetOverride(id: SubMuscleId): TargetOverrides {
  const next = { ...getTargetOverrides() };
  delete next[id];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TARGETS_KEY, JSON.stringify(next));
  }
  return next;
}

/** Every sub-muscle's effective target band: the user override if set,
 * otherwise the taxonomy default. Always has all 26 keys. */
export function getEffectiveTargetBands(): Record<SubMuscleId, TargetBand> {
  const overrides = getTargetOverrides();
  const result = {} as Record<SubMuscleId, TargetBand>;
  for (const id of Object.keys(TAXONOMY_BY_ID) as SubMuscleId[]) {
    result[id] = overrides[id] ?? TAXONOMY_BY_ID[id].defaultWeeklyTargetSets;
  }
  return result;
}
