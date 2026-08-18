// Parses a Hevy "Export data" workouts CSV (Settings -> Export data in the
// Hevy app) into the same HevyWorkout/HevyExercise/HevySet shapes
// lib/storage.ts already stores, so everything downstream (lib/volume.ts,
// pages) works unchanged. Pure, no DOM — safe to call from a Web Worker or
// directly on File.text() in the browser.
//
// Column set and formats verified against real export data from primary
// sources (not guessed):
//  - Hevy's own help centre docs on exporting/importing workout CSVs
//    (help.hevyapp.com), which confirm the export exists under
//    Settings -> Export data and describe its round-trip with Hevy's own
//    CSV import.
//  - A real sample Hevy export CSV (header + rows) published in
//    github.com/matanabudy/workout-data-sync, giving the exact header line:
//    title,start_time,end_time,description,exercise_title,superset_id,
//    exercise_notes,set_index,set_type,weight_kg,reps,distance_km,
//    duration_seconds,rpe
//    — and the date format actually used: `"22 Dec 2025, 08:00"`.
//  - github.com/casudo/Hevy-Insights (MIT), used as a format reference only
//    (no code copied): confirms Hevy exports a weight_lbs column instead of
//    weight_kg when the account's unit setting is lbs, and that some
//    exports carry ISO-8601 timestamps instead of the "D Mon YYYY, HH:mm"
//    style — both are handled below.
//
// Known limitation: the "D Mon YYYY, HH:mm" date format carries no UTC
// offset (unlike the Hevy API's start_time, which does). We interpret it as
// UTC wall-clock time; if a user's local timezone differs from UTC, CSV-
// imported workout timestamps can be off by the offset. This only affects
// which day/period a workout is bucketed into near midnight — there's no
// way to recover the true offset from the file itself.

import { lbsToKg } from "../units";
import type { HevyExercise, HevySet, HevyWorkout, SetType } from "../hevy";

// ---------------------------------------------------------------------------
// RFC-4180 CSV tokenizer (hand-rolled: no new dependency for a ~40-line
// parser). Handles quoted fields containing commas, newlines, and escaped
// ("") quotes; CRLF and LF line endings.
// ---------------------------------------------------------------------------

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += char;
        i += 1;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
    } else if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (char === "\r") {
      i += 1; // normalize CRLF -> LF by ignoring the \r
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += char;
      i += 1;
    }
  }

  // Trailing field/row not terminated by a final newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

// ---------------------------------------------------------------------------
// Date parsing: handles both formats observed in real exports.
// ---------------------------------------------------------------------------

const NAMED_MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

// e.g. "22 Dec 2025, 08:00"
const NAMED_DATE_RE = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),\s*(\d{1,2}):(\d{2})$/;

function parseHevyDate(raw: string): Date {
  const trimmed = raw.trim();

  const match = NAMED_DATE_RE.exec(trimmed);
  if (match) {
    const [, day, monthName, year, hour, minute] = match;
    const month = NAMED_MONTHS[monthName.toLowerCase()];
    if (month === undefined) {
      throw new Error(`unrecognized month "${monthName}" in date "${raw}"`);
    }
    // No UTC offset in this format — treated as UTC wall-clock (see module
    // doc comment's Known limitation note).
    const date = new Date(Date.UTC(Number(year), month, Number(day), Number(hour), Number(minute)));
    if (Number.isNaN(date.getTime())) {
      throw new Error(`invalid date "${raw}"`);
    }
    return date;
  }

  // Fall back to ISO-8601 (some exports use this instead).
  const isoDate = new Date(trimmed);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  throw new Error(`unrecognized date format: "${raw}"`);
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const METERS_PER_MILE = 1609.344;

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "exercise";
}

/** Deterministic 32-bit FNV-1a hash, hex-encoded. Used for the pseudo
 * workout id (`csv:` + hash of title+start_time), not for anything
 * security-sensitive — just a stable, collision-resistant-enough key so
 * re-uploading the same export upserts instead of duplicating. */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const KNOWN_SET_TYPES: readonly SetType[] = ["normal", "warmup", "dropset", "failure"];

function normalizeSetType(raw: string | undefined): SetType {
  const lower = (raw ?? "").trim().toLowerCase();
  return (KNOWN_SET_TYPES as readonly string[]).includes(lower) ? (lower as SetType) : "normal";
}

function parseNullableNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function parseNullableInt(raw: string | undefined): number | null {
  const value = parseNullableNumber(raw);
  return value === null ? null : Math.round(value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParseHevyCsvResult {
  workouts: HevyWorkout[];
  /** Non-fatal issues (unparseable row skipped, unrecognized set type
   * defaulted to "normal", etc). Parsing continues past these — only a
   * structurally wrong file (missing required columns) throws. */
  warnings: string[];
}

const REQUIRED_HEADERS = ["title", "start_time", "end_time", "exercise_title", "set_index", "set_type"] as const;

/** Parses a Hevy workouts export CSV into HevyWorkout[]. Exercise rows with
 * the same (title, start_time) are grouped into one workout; consecutive
 * rows with the same exercise_title are grouped into one exercise instance,
 * restarting whenever the title changes or set_index doesn't increase
 * (handles supersets, where exercises interleave, and repeated exercises
 * within one workout). Each exercise gets a deterministic pseudo template
 * id (`csv:<slugified-name>`) since CSV rows carry names, not Hevy
 * exercise_template_ids — lib/volume.ts's resolver falls back to a
 * case-insensitive name match against the repo map for these. */
export function parseHevyCsv(csvText: string): ParseHevyCsvResult {
  const rows = parseCsvRows(csvText.replace(/^﻿/, ""));
  if (rows.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const header = rows[0].map((h) => h.trim());
  const colIndex = (name: string): number => header.indexOf(name);

  for (const required of REQUIRED_HEADERS) {
    if (colIndex(required) === -1) {
      throw new Error(`This doesn't look like a Hevy workout export — missing column "${required}".`);
    }
  }

  const weightField = colIndex("weight_kg") !== -1 ? "weight_kg" : colIndex("weight_lbs") !== -1 ? "weight_lbs" : null;
  const distanceField =
    colIndex("distance_km") !== -1 ? "distance_km" : colIndex("distance_miles") !== -1 ? "distance_miles" : null;

  const idx = {
    title: colIndex("title"),
    start_time: colIndex("start_time"),
    end_time: colIndex("end_time"),
    description: colIndex("description"),
    exercise_title: colIndex("exercise_title"),
    superset_id: colIndex("superset_id"),
    exercise_notes: colIndex("exercise_notes"),
    set_index: colIndex("set_index"),
    set_type: colIndex("set_type"),
    weight: weightField ? colIndex(weightField) : -1,
    reps: colIndex("reps"),
    distance: distanceField ? colIndex(distanceField) : -1,
    duration_seconds: colIndex("duration_seconds"),
    rpe: colIndex("rpe"),
  };

  const warnings: string[] = [];
  const workoutsById = new Map<string, HevyWorkout>();
  const workoutOrder: string[] = [];
  // Per workout id: the exercise instance currently being appended to, so
  // we can tell "same exercise, next set" from "new instance of this (or a
  // different) exercise".
  const openExercise = new Map<string, { title: string; lastSetIndex: number; exercise: HevyExercise }>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0].trim() === "") continue;

    const title = row[idx.title]?.trim() ?? "";
    const startRaw = row[idx.start_time]?.trim() ?? "";
    const exerciseTitle = row[idx.exercise_title]?.trim() ?? "";
    if (!title || !startRaw || !exerciseTitle) {
      warnings.push(`Row ${r + 1}: missing title/start_time/exercise_title — skipped.`);
      continue;
    }

    let startDate: Date;
    let endDate: Date;
    try {
      startDate = parseHevyDate(startRaw);
      endDate = parseHevyDate(row[idx.end_time]?.trim() || startRaw);
    } catch (error) {
      warnings.push(`Row ${r + 1}: ${error instanceof Error ? error.message : String(error)} — skipped.`);
      continue;
    }

    const startIso = startDate.toISOString();
    const workoutId = `csv:${fnv1aHex(`${title}|${startIso}`)}`;

    let workout = workoutsById.get(workoutId);
    if (!workout) {
      workout = {
        id: workoutId,
        title,
        routine_id: null,
        description: idx.description !== -1 ? (row[idx.description] ?? "") : "",
        start_time: startIso,
        end_time: endDate.toISOString(),
        updated_at: startIso,
        created_at: startIso,
        exercises: [],
      };
      workoutsById.set(workoutId, workout);
      workoutOrder.push(workoutId);
    }

    const setIndexRaw = idx.set_index !== -1 ? row[idx.set_index] : undefined;
    const setIndex = Number(setIndexRaw);
    const previous = openExercise.get(workoutId);
    const isNewInstance =
      !previous || previous.title !== exerciseTitle || !Number.isFinite(setIndex) || setIndex <= previous.lastSetIndex;

    let exercise: HevyExercise;
    if (isNewInstance) {
      exercise = {
        index: workout.exercises.length,
        title: exerciseTitle,
        notes: idx.exercise_notes !== -1 ? (row[idx.exercise_notes] ?? "") : "",
        exercise_template_id: `csv:${slugify(exerciseTitle)}`,
        superset_id: idx.superset_id !== -1 ? parseNullableInt(row[idx.superset_id]) : null,
        sets: [],
      };
      workout.exercises.push(exercise);
      openExercise.set(workoutId, {
        title: exerciseTitle,
        lastSetIndex: Number.isFinite(setIndex) ? setIndex : 0,
        exercise,
      });
    } else {
      exercise = previous.exercise;
      previous.lastSetIndex = Number.isFinite(setIndex) ? setIndex : previous.lastSetIndex + 1;
    }

    const weightRaw = idx.weight !== -1 ? row[idx.weight] : undefined;
    let weightKg = parseNullableNumber(weightRaw);
    if (weightKg !== null && weightField === "weight_lbs") {
      weightKg = lbsToKg(weightKg);
    }

    const distanceRaw = idx.distance !== -1 ? row[idx.distance] : undefined;
    let distanceMeters = parseNullableNumber(distanceRaw);
    if (distanceMeters !== null) {
      distanceMeters = distanceMeters * (distanceField === "distance_miles" ? METERS_PER_MILE : 1000);
    }

    const set: HevySet = {
      index: exercise.sets.length,
      type: normalizeSetType(idx.set_type !== -1 ? row[idx.set_type] : undefined),
      weight_kg: weightKg,
      reps: idx.reps !== -1 ? parseNullableInt(row[idx.reps]) : null,
      distance_meters: distanceMeters,
      duration_seconds: idx.duration_seconds !== -1 ? parseNullableInt(row[idx.duration_seconds]) : null,
      rpe: idx.rpe !== -1 ? parseNullableNumber(row[idx.rpe]) : null,
      custom_metric: null,
    };
    exercise.sets.push(set);
  }

  const workouts = workoutOrder.map((id) => workoutsById.get(id)!);
  return { workouts, warnings };
}
