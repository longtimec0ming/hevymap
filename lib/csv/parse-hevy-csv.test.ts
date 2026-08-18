import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseHevyCsv } from "./parse-hevy-csv";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf8");
}

describe("parseHevyCsv — kg export, supersets, quoted notes, warmup/dropset/failure", () => {
  const result = parseHevyCsv(fixture("kg-superset-quoted.csv"));

  it("groups all rows sharing (title, start_time) into a single workout", () => {
    expect(result.workouts).toHaveLength(1);
    const workout = result.workouts[0];
    expect(workout.title).toBe("Push Day");
    expect(workout.id).toMatch(/^csv:[0-9a-f]{8}$/);
  });

  it("parses the named-month date format into a UTC ISO timestamp", () => {
    expect(result.workouts[0].start_time).toBe("2026-08-18T07:00:00.000Z");
    expect(result.workouts[0].end_time).toBe("2026-08-18T08:05:00.000Z");
  });

  it("un-escapes a quoted field containing a comma", () => {
    expect(result.workouts[0].description).toBe("Felt good, strong session");
  });

  it("un-escapes a quoted field containing an embedded newline", () => {
    const pushdown = result.workouts[0].exercises.find((e) => e.title === "Triceps Pushdown (Cable)");
    expect(pushdown?.notes).toBe("Great pump\nkept elbows tucked");
  });

  it("splits into separate exercise entries in row order, one per performed instance", () => {
    const titles = result.workouts[0].exercises.map((e) => e.title);
    expect(titles).toEqual([
      "Bench Press (Barbell)",
      "Incline Dumbbell Press",
      "Cable Fly",
      "Triceps Pushdown (Cable)",
    ]);
  });

  it("assigns a deterministic csv: pseudo template id, slugified from the exercise name", () => {
    const bench = result.workouts[0].exercises.find((e) => e.title === "Bench Press (Barbell)");
    expect(bench?.exercise_template_id).toBe("csv:bench-press-barbell");
  });

  it("carries superset_id through for a superset pair, null otherwise", () => {
    const incline = result.workouts[0].exercises.find((e) => e.title === "Incline Dumbbell Press");
    const cableFly = result.workouts[0].exercises.find((e) => e.title === "Cable Fly");
    const bench = result.workouts[0].exercises.find((e) => e.title === "Bench Press (Barbell)");
    expect(incline?.superset_id).toBe(1);
    expect(cableFly?.superset_id).toBe(1);
    expect(bench?.superset_id).toBeNull();
  });

  it("preserves warmup, normal, dropset, and failure set types", () => {
    const bench = result.workouts[0].exercises.find((e) => e.title === "Bench Press (Barbell)");
    expect(bench?.sets.map((s) => s.type)).toEqual(["warmup", "normal", "dropset"]);
    const pushdown = result.workouts[0].exercises.find((e) => e.title === "Triceps Pushdown (Cable)");
    expect(pushdown?.sets.map((s) => s.type)).toEqual(["normal", "failure"]);
  });

  it("keeps weight_kg values as-is (no conversion needed)", () => {
    const bench = result.workouts[0].exercises.find((e) => e.title === "Bench Press (Barbell)");
    expect(bench?.sets.map((s) => s.weight_kg)).toEqual([40, 80, 60]);
  });

  it("produces no warnings for a well-formed file", () => {
    expect(result.warnings).toEqual([]);
  });
});

describe("parseHevyCsv — lbs export and a bodyweight exercise with empty weight", () => {
  const result = parseHevyCsv(fixture("lbs-bodyweight.csv"));

  it("converts weight_lbs to canonical kg", () => {
    const row = result.workouts[0].exercises.find((e) => e.title === "Barbell Row");
    expect(row?.sets[0].weight_kg).toBeCloseTo(61.235, 2); // 135 lbs
    expect(row?.sets[1].weight_kg).toBeCloseTo(70.307, 2); // 155 lbs
  });

  it("treats an empty weight cell as null (bodyweight exercise), not zero", () => {
    const pullUp = result.workouts[0].exercises.find((e) => e.title === "Pull Up (Assisted)");
    expect(pullUp?.sets.every((s) => s.weight_kg === null)).toBe(true);
    expect(pullUp?.sets.map((s) => s.reps)).toEqual([8, 7, 6]);
  });

  it("converts distance_miles to meters", () => {
    const treadmill = result.workouts[0].exercises.find((e) => e.title === "Treadmill");
    expect(treadmill?.sets[0].distance_meters).toBeCloseTo(2414.016, 1); // 1.5 miles
  });
});

describe("parseHevyCsv — ISO dates and a repeated (non-superset) exercise", () => {
  const result = parseHevyCsv(fixture("iso-dates-repeated-exercise.csv"));

  it("accepts ISO-8601 timestamps as-is", () => {
    expect(result.workouts[0].start_time).toBe("2026-07-04T09:00:00.000Z");
  });

  it("creates two separate exercise instances for a non-adjacent repeated exercise", () => {
    const titles = result.workouts[0].exercises.map((e) => e.title);
    expect(titles).toEqual(["Squat (Barbell)", "Leg Press (Machine)", "Squat (Barbell)"]);
    expect(result.workouts[0].exercises[0].sets).toHaveLength(2);
    expect(result.workouts[0].exercises[2].sets).toHaveLength(2);
  });
});

describe("parseHevyCsv — error handling", () => {
  it("throws on an empty file", () => {
    expect(() => parseHevyCsv("")).toThrow(/empty/i);
  });

  it("throws a helpful error when required columns are missing", () => {
    expect(() => parseHevyCsv("foo,bar\n1,2\n")).toThrow(/Hevy workout export/i);
  });

  it("warns and skips a row with an unparseable date instead of throwing", () => {
    const csv =
      "title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe\n" +
      "Push Day,not a date,not a date,,Bench Press,,,0,normal,80,8,,0,8\n";
    const result = parseHevyCsv(csv);
    expect(result.workouts).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/unrecognized date format/i);
  });
});
