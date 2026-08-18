// IndexedDB isn't available in plain Node; fake-indexeddb polyfills the
// global `indexedDB` / `IDBKeyRange` that `idb` (and lib/storage.ts) expect.
// This import must run before storage.ts is evaluated.
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HevyExerciseTemplate, HevyWorkout } from "./hevy";
import {
  DEFAULT_PREFS,
  clearAll,
  deleteWorkouts,
  getAllExerciseTemplates,
  getAllWorkouts,
  getPrefs,
  getSyncState,
  getWorkoutsCount,
  getWorkoutsInRange,
  putExerciseTemplates,
  putWorkouts,
  setLastSyncedAt,
  setPrefs,
} from "./storage";

function makeWorkout(id: string, start_time: string): HevyWorkout {
  return {
    id,
    title: `Workout ${id}`,
    routine_id: null,
    description: "",
    start_time,
    end_time: start_time,
    updated_at: start_time,
    created_at: start_time,
    exercises: [],
  };
}

function makeTemplate(id: string): HevyExerciseTemplate {
  return {
    id,
    title: `Exercise ${id}`,
    type: "weight_reps",
    primary_muscle_group: "chest",
    secondary_muscle_groups: [],
    equipment: "barbell",
    is_custom: false,
  };
}

describe("lib/storage (IndexedDB, via fake-indexeddb)", () => {
  afterEach(async () => {
    await clearAll();
  });

  it("putWorkouts + getAllWorkouts round-trips", async () => {
    await putWorkouts([makeWorkout("a", "2026-08-01T00:00:00Z"), makeWorkout("b", "2026-08-02T00:00:00Z")]);

    const all = await getAllWorkouts();

    expect(all.map((w) => w.id).sort()).toEqual(["a", "b"]);
  });

  it("putWorkouts overwrites an existing row with the same id (upsert)", async () => {
    await putWorkouts([makeWorkout("a", "2026-08-01T00:00:00Z")]);
    await putWorkouts([{ ...makeWorkout("a", "2026-08-01T00:00:00Z"), title: "Updated" }]);

    const all = await getAllWorkouts();

    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Updated");
  });

  it("deleteWorkouts removes rows by id", async () => {
    await putWorkouts([makeWorkout("a", "2026-08-01T00:00:00Z"), makeWorkout("b", "2026-08-02T00:00:00Z")]);

    await deleteWorkouts(["a"]);

    const all = await getAllWorkouts();
    expect(all.map((w) => w.id)).toEqual(["b"]);
  });

  it("getWorkoutsInRange filters by start_time, inclusive start / exclusive end", async () => {
    await putWorkouts([
      makeWorkout("early", "2026-08-01T00:00:00Z"),
      makeWorkout("in-range", "2026-08-05T00:00:00Z"),
      makeWorkout("boundary", "2026-08-10T00:00:00Z"),
      makeWorkout("late", "2026-08-15T00:00:00Z"),
    ]);

    const inRange = await getWorkoutsInRange("2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z");

    expect(inRange.map((w) => w.id).sort()).toEqual(["early", "in-range"]);
  });

  it("getWorkoutsCount reflects the number of stored workouts", async () => {
    await putWorkouts([makeWorkout("a", "2026-08-01T00:00:00Z")]);
    expect(await getWorkoutsCount()).toBe(1);
  });

  it("putExerciseTemplates + getAllExerciseTemplates round-trips and upserts", async () => {
    await putExerciseTemplates([makeTemplate("t1"), makeTemplate("t2")]);
    await putExerciseTemplates([{ ...makeTemplate("t1"), title: "Renamed" }]);

    const all = await getAllExerciseTemplates();

    expect(all).toHaveLength(2);
    expect(all.find((t) => t.id === "t1")?.title).toBe("Renamed");
  });

  it("sync state defaults to null and round-trips through setLastSyncedAt", async () => {
    expect(await getSyncState()).toEqual({ lastSyncedAt: null });

    await setLastSyncedAt("2026-08-18T00:00:00Z");

    expect(await getSyncState()).toEqual({ lastSyncedAt: "2026-08-18T00:00:00Z" });
  });

  it("clearAll wipes workouts, templates, and sync state", async () => {
    await putWorkouts([makeWorkout("a", "2026-08-01T00:00:00Z")]);
    await putExerciseTemplates([makeTemplate("t1")]);
    await setLastSyncedAt("2026-08-18T00:00:00Z");

    await clearAll();

    expect(await getAllWorkouts()).toEqual([]);
    expect(await getAllExerciseTemplates()).toEqual([]);
    expect(await getSyncState()).toEqual({ lastSyncedAt: null });
  });
});

// vitest's default "node" environment has no `window`/`localStorage`
// global, so prefs (which are browser-only by design) get a minimal
// in-memory polyfill just for these tests.
class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem" | "clear"> {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe("lib/storage prefs (localStorage)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: new MemoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getPrefs returns defaults when nothing is stored", () => {
    expect(getPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("setPrefs merges a partial update and persists it", () => {
    const updated = setPrefs({ units: "lbs" });

    expect(updated).toEqual({ ...DEFAULT_PREFS, units: "lbs" });
    expect(getPrefs()).toEqual({ ...DEFAULT_PREFS, units: "lbs" });
  });

  it("setPrefs called twice accumulates changes", () => {
    setPrefs({ units: "lbs" });
    setPrefs({ includeWarmups: true });

    expect(getPrefs()).toEqual({ ...DEFAULT_PREFS, units: "lbs", includeWarmups: true });
  });
});
