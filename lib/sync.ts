// First-run full import + incremental re-sync orchestration. New file (not
// part of lib/hevy.ts or lib/storage.ts, which are out of scope for this
// build step) that composes the two: fetches via lib/hevy.ts, persists via
// lib/storage.ts. See PLAN.md §7.

import {
  getAllExerciseTemplates as fetchAllExerciseTemplates,
  getAllWorkouts as fetchAllWorkouts,
  syncWorkoutEvents,
} from "./hevy";
import {
  clearAll,
  deleteWorkouts,
  getSyncState,
  putExerciseTemplates,
  putWorkouts,
  setLastSyncedAt,
} from "./storage";

export interface ImportProgress {
  phase: "templates" | "workouts";
  fetched: number;
  total: number;
}

/** Full history import: all exercise templates, then all workouts,
 * paginated. Used on first run (no prior sync) and by "force full re-sync"
 * in settings. */
export async function runFullImport(onProgress?: (progress: ImportProgress) => void): Promise<void> {
  const templates = await fetchAllExerciseTemplates((fetched) => {
    onProgress?.({ phase: "templates", fetched, total: fetched });
  });
  await putExerciseTemplates(templates);

  const workouts = await fetchAllWorkouts((fetched, total) => {
    onProgress?.({ phase: "workouts", fetched, total });
  });
  await putWorkouts(workouts);

  await setLastSyncedAt(new Date().toISOString());
}

export interface IncrementalSyncResult {
  updatedCount: number;
  deletedCount: number;
}

/** Incremental sync via /workouts/events since the last sync timestamp.
 * Also refreshes exercise templates (cheap, covers newly-created custom
 * exercises). No-op (returns null) if there has never been a full import. */
export async function runIncrementalSync(
  onProgress?: (fetched: number) => void,
): Promise<IncrementalSyncResult | null> {
  const { lastSyncedAt } = await getSyncState();
  if (!lastSyncedAt) return null;

  const templates = await fetchAllExerciseTemplates();
  await putExerciseTemplates(templates);

  const result = await syncWorkoutEvents(lastSyncedAt, onProgress);
  await putWorkouts(result.updated);
  await deleteWorkouts(result.deletedIds);
  await setLastSyncedAt(new Date().toISOString());

  return { updatedCount: result.updated.length, deletedCount: result.deletedIds.length };
}

/** Wipes the local cache and re-runs a full import from scratch. */
export async function forceFullResync(onProgress?: (progress: ImportProgress) => void): Promise<void> {
  await clearAll();
  await runFullImport(onProgress);
}
