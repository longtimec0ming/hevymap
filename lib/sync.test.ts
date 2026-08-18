// fake-indexeddb polyfills the IndexedDB globals lib/storage.ts needs; must
// import before storage.ts is evaluated (see lib/storage.test.ts).
import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";
import type { HevyWorkout } from "./hevy";
import { importCsvWorkouts, reimportCsvWorkouts, runIncrementalSync } from "./sync";
import { clearAll, getAllWorkouts, getSyncState } from "./storage";

function makeWorkout(id: string): HevyWorkout {
  return {
    id,
    title: `Workout ${id}`,
    routine_id: null,
    description: "",
    start_time: "2026-08-18T00:00:00.000Z",
    end_time: "2026-08-18T01:00:00.000Z",
    updated_at: "2026-08-18T01:00:00.000Z",
    created_at: "2026-08-18T00:00:00.000Z",
    exercises: [],
  };
}

describe("lib/sync — CSV import path", () => {
  afterEach(async () => {
    await clearAll();
    vi.unstubAllGlobals();
  });

  it("importCsvWorkouts stores the workouts and marks the sync state dataSource as csv", async () => {
    await importCsvWorkouts([makeWorkout("csv:a"), makeWorkout("csv:b")]);

    const all = await getAllWorkouts();
    expect(all.map((w) => w.id).sort()).toEqual(["csv:a", "csv:b"]);

    const state = await getSyncState();
    expect(state.dataSource).toBe("csv");
    expect(state.lastSyncedAt).not.toBeNull();
  });

  it("runIncrementalSync no-ops after a CSV import (no API key to sync with)", async () => {
    await importCsvWorkouts([makeWorkout("csv:a")]);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runIncrementalSync();

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reimportCsvWorkouts clears the previous cache before writing the new one", async () => {
    await importCsvWorkouts([makeWorkout("csv:old")]);
    await reimportCsvWorkouts([makeWorkout("csv:new")]);

    const all = await getAllWorkouts();
    expect(all.map((w) => w.id)).toEqual(["csv:new"]);
  });
});
