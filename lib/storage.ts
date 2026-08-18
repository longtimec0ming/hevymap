// Client-side persistence: IndexedDB cache for workouts + exercise
// templates (via `idb`), and a small typed localStorage wrapper for
// lightweight prefs. See PLAN.md §7 and CLAUDE.md's repo structure.
//
// This module owns storage only — it does not call the Hevy API. Callers
// (the sync engine, UI) fetch via lib/hevy.ts and hand the results here.

import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { HevyExerciseTemplate, HevyWorkout } from "./hevy";

// ---------------------------------------------------------------------------
// IndexedDB schema
// ---------------------------------------------------------------------------

const DB_NAME = "hevymap";
const DB_VERSION = 1;

interface SyncMeta {
  key: "lastSyncedAt";
  lastSyncedAt: string | null;
}

interface HevyMapDB extends DBSchema {
  workouts: {
    key: string;
    value: HevyWorkout;
    indexes: { start_time: string };
  };
  exerciseTemplates: {
    key: string;
    value: HevyExerciseTemplate;
  };
  meta: {
    key: string;
    value: SyncMeta;
  };
}

let dbPromise: Promise<IDBPDatabase<HevyMapDB>> | null = null;

function getDB(): Promise<IDBPDatabase<HevyMapDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HevyMapDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const workouts = db.createObjectStore("workouts", { keyPath: "id" });
        workouts.createIndex("start_time", "start_time");
        db.createObjectStore("exerciseTemplates", { keyPath: "id" });
        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

/** Bulk-writes workouts, overwriting any existing rows with the same id.
 * Used for both the initial full import and incremental upserts. */
export async function putWorkouts(workouts: HevyWorkout[]): Promise<void> {
  if (workouts.length === 0) return;
  const db = await getDB();
  const tx = db.transaction("workouts", "readwrite");
  await Promise.all([...workouts.map((workout) => tx.store.put(workout)), tx.done]);
}

export async function deleteWorkouts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  const tx = db.transaction("workouts", "readwrite");
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

export async function getAllWorkouts(): Promise<HevyWorkout[]> {
  const db = await getDB();
  return db.getAll("workouts");
}

/** Workouts with start_time in [startISO, endISO), inclusive of start,
 * exclusive of end. */
export async function getWorkoutsInRange(startISO: string, endISO: string): Promise<HevyWorkout[]> {
  const db = await getDB();
  return db.getAllFromIndex("workouts", "start_time", IDBKeyRange.bound(startISO, endISO, false, true));
}

export async function getWorkoutsCount(): Promise<number> {
  const db = await getDB();
  return db.count("workouts");
}

// ---------------------------------------------------------------------------
// Exercise templates
// ---------------------------------------------------------------------------

export async function putExerciseTemplates(templates: HevyExerciseTemplate[]): Promise<void> {
  if (templates.length === 0) return;
  const db = await getDB();
  const tx = db.transaction("exerciseTemplates", "readwrite");
  await Promise.all([...templates.map((template) => tx.store.put(template)), tx.done]);
}

export async function getAllExerciseTemplates(): Promise<HevyExerciseTemplate[]> {
  const db = await getDB();
  return db.getAll("exerciseTemplates");
}

// ---------------------------------------------------------------------------
// Sync state
// ---------------------------------------------------------------------------

export interface SyncState {
  /** ISO 8601 timestamp of the last successful sync, or null if this is a
   * fresh cache that has never synced (a full import is needed). */
  lastSyncedAt: string | null;
}

export async function getSyncState(): Promise<SyncState> {
  const db = await getDB();
  const row = await db.get("meta", "lastSyncedAt");
  return { lastSyncedAt: row?.lastSyncedAt ?? null };
}

export async function setLastSyncedAt(iso: string): Promise<void> {
  const db = await getDB();
  await db.put("meta", { key: "lastSyncedAt", lastSyncedAt: iso });
}

/** Wipes all cached workouts, templates, and sync state — used by
 * settings' "Force full re-sync". Does not touch prefs. */
export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["workouts", "exerciseTemplates", "meta"], "readwrite");
  await Promise.all([
    tx.objectStore("workouts").clear(),
    tx.objectStore("exerciseTemplates").clear(),
    tx.objectStore("meta").clear(),
    tx.done,
  ]);
}

// ---------------------------------------------------------------------------
// Lightweight prefs (localStorage)
// ---------------------------------------------------------------------------

export interface Prefs {
  units: "kg" | "lbs";
  /** date-fns weekStartsOn convention: 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1;
  includeWarmups: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  units: "kg",
  weekStartsOn: 1,
  includeWarmups: false,
};

const PREFS_KEY = "hevymap:prefs";

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  const raw = window.localStorage.getItem(PREFS_KEY);
  if (!raw) return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setPrefs(update: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...update };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }
  return next;
}
