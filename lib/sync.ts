// First-run full import + incremental re-sync orchestration. New file (not
// part of lib/hevy.ts or lib/storage.ts, which are out of scope for this
// build step) that composes the two: fetches via lib/hevy.ts, persists via
// lib/storage.ts. See PLAN.md §7.

import {
  getAllExerciseTemplates as fetchAllExerciseTemplates,
  getAllWorkouts as fetchAllWorkouts,
  syncWorkoutEvents,
} from "./hevy";
import type { HevyWorkout } from "./hevy";
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
 * exercises). No-op (returns null) if there has never been a full import,
 * or if the cache's data came from a CSV upload — there's no Hevy API key
 * to sync with in that case, and workouts came from a file, not an
 * account. See components/import/import-screen.tsx's CSV upload path and
 * lib/storage.ts's DataSource. */
export async function runIncrementalSync(
  onProgress?: (fetched: number) => void,
): Promise<IncrementalSyncResult | null> {
  const { lastSyncedAt, dataSource } = await getSyncState();
  if (!lastSyncedAt || dataSource === "csv") return null;

  const templates = await fetchAllExerciseTemplates();
  await putExerciseTemplates(templates);

  const result = await syncWorkoutEvents(lastSyncedAt, onProgress);
  await putWorkouts(result.updated);
  await deleteWorkouts(result.deletedIds);
  await setLastSyncedAt(new Date().toISOString());

  return { updatedCount: result.updated.length, deletedCount: result.deletedIds.length };
}

/** Wipes the local cache and re-runs a full import from scratch. Only valid
 * for an API-sourced cache — CSV users re-upload a file instead (see
 * importCsvWorkouts). */
export async function forceFullResync(onProgress?: (progress: ImportProgress) => void): Promise<void> {
  await clearAll();
  await runFullImport(onProgress);
}

/** Writes CSV-parsed workouts (lib/csv/parse-hevy-csv.ts) into the cache as
 * a first-run "import", exactly like runFullImport does for the API path,
 * but marks the cache's dataSource as "csv" so runIncrementalSync no-ops
 * (there's no API key to sync with) and settings can offer "Re-upload CSV"
 * instead of "Force full re-sync". Does not touch exercise templates —
 * CSV rows have no template ids; lib/volume.ts's resolver falls back to a
 * name match against the repo map for these exercises instead. */
export async function importCsvWorkouts(workouts: HevyWorkout[]): Promise<void> {
  await putWorkouts(workouts);
  await setLastSyncedAt(new Date().toISOString(), "csv");
}

/** Wipes the local cache and re-imports from a freshly parsed CSV
 * ("Re-upload CSV" in settings). */
export async function reimportCsvWorkouts(workouts: HevyWorkout[]): Promise<void> {
  await clearAll();
  await importCsvWorkouts(workouts);
}
