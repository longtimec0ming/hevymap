"use client";

// Reads the cached workouts/templates/sync-state from IndexedDB (lib/storage.ts)
// into React state. Does not talk to the Hevy API — see lib/sync.ts and
// components/import/import-screen.tsx for the actual fetch/import flow, and
// components/layout/app-shell.tsx for the one-time background incremental
// sync kicked off on load.

import { useCallback, useEffect, useState } from "react";
import type { HevyExerciseTemplate, HevyWorkout } from "@/lib/hevy";
import { getAllExerciseTemplates, getAllWorkouts, getSyncState, type SyncState } from "@/lib/storage";

export interface WorkoutDataState {
  workouts: HevyWorkout[];
  templates: HevyExerciseTemplate[];
  templatesById: Map<string, HevyExerciseTemplate>;
  syncState: SyncState;
  /** True once the initial IndexedDB read has completed. */
  loaded: boolean;
  /** True once loaded and there has never been a successful sync — the
   * caller should show the first-run import screen. */
  needsImport: boolean;
  refresh: () => Promise<void>;
}

export function useWorkoutData(): WorkoutDataState {
  const [workouts, setWorkouts] = useState<HevyWorkout[]>([]);
  const [templates, setTemplates] = useState<HevyExerciseTemplate[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({ lastSyncedAt: null });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [w, t, s] = await Promise.all([getAllWorkouts(), getAllExerciseTemplates(), getSyncState()]);
    setWorkouts(w);
    setTemplates(t);
    setSyncState(s);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // IndexedDB is only reachable client-side; there's no synchronous
    // alternative to loading it in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const templatesById = new Map(templates.map((t) => [t.id, t]));

  return {
    workouts,
    templates,
    templatesById,
    syncState,
    loaded,
    needsImport: loaded && syncState.lastSyncedAt === null,
    refresh,
  };
}
