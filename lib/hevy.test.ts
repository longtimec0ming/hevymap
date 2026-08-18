import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HevyApiError,
  NoApiKeyError,
  getAllExerciseTemplates,
  getAllWorkouts,
  getWorkoutsCount,
  syncWorkoutEvents,
} from "./hevy";
import type { HevyExerciseTemplate, HevyWorkout, PaginatedWorkoutEvents } from "./hevy";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeWorkout(id: string, overrides: Partial<HevyWorkout> = {}): HevyWorkout {
  return {
    id,
    title: `Workout ${id}`,
    routine_id: null,
    description: "",
    start_time: "2026-08-01T00:00:00+00:00",
    end_time: "2026-08-01T01:00:00+00:00",
    updated_at: "2026-08-01T01:00:00.000Z",
    created_at: "2026-08-01T01:00:00.000Z",
    exercises: [],
    ...overrides,
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

describe("lib/hevy", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getWorkoutsCount calls /api/hevy/workouts/count and returns the count", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ workout_count: 85 }));

    const count = await getWorkoutsCount();

    expect(count).toBe(85);
    expect(fetchMock).toHaveBeenCalledWith("/api/hevy/workouts/count", { method: "GET" });
  });

  it("getAllWorkouts accumulates every page and reports progress", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ workout_count: 3 }))
      .mockResolvedValueOnce(
        jsonResponse({ page: 1, page_count: 2, workouts: [makeWorkout("a"), makeWorkout("b")] }),
      )
      .mockResolvedValueOnce(jsonResponse({ page: 2, page_count: 2, workouts: [makeWorkout("c")] }));

    const progress: Array<[number, number]> = [];
    const workouts = await getAllWorkouts((fetched, total) => progress.push([fetched, total]));

    expect(workouts.map((w) => w.id)).toEqual(["a", "b", "c"]);
    expect(progress).toEqual([
      [2, 3],
      [3, 3],
    ]);
    // page 1 then page 2, pageSize capped at the API's max of 10
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/hevy/workouts?page=1&pageSize=10", { method: "GET" });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/hevy/workouts?page=2&pageSize=10", { method: "GET" });
  });

  it("getAllWorkouts stops after a single page when page_count is 1", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ workout_count: 1 }))
      .mockResolvedValueOnce(jsonResponse({ page: 1, page_count: 1, workouts: [makeWorkout("only")] }));

    const workouts = await getAllWorkouts();

    expect(workouts).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("getAllExerciseTemplates accumulates every page with pageSize capped at 100", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ page: 1, page_count: 2, exercise_templates: [makeTemplate("1"), makeTemplate("2")] }),
      )
      .mockResolvedValueOnce(jsonResponse({ page: 2, page_count: 2, exercise_templates: [makeTemplate("3")] }));

    const templates = await getAllExerciseTemplates();

    expect(templates.map((t) => t.id)).toEqual(["1", "2", "3"]);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/hevy/exercise_templates?page=1&pageSize=100", {
      method: "GET",
    });
  });

  it("syncWorkoutEvents reconciles updated and deleted events across pages", async () => {
    const page1: PaginatedWorkoutEvents = {
      page: 1,
      page_count: 2,
      events: [
        { type: "updated", workout: makeWorkout("a") },
        { type: "deleted", id: "b", deleted_at: "2026-08-15T00:00:00Z" },
      ],
    };
    const page2: PaginatedWorkoutEvents = {
      page: 2,
      page_count: 2,
      events: [{ type: "updated", workout: makeWorkout("c") }],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));

    const result = await syncWorkoutEvents("2026-08-01T00:00:00Z");

    expect(result.updated.map((w) => w.id)).toEqual(["a", "c"]);
    expect(result.deletedIds).toEqual(["b"]);
  });

  it("syncWorkoutEvents keeps only the newest event per workout id (events are newest-first)", async () => {
    // Same id appears as both deleted (newer, page 1) and updated (older, page 2).
    // The deletion should win because events are ordered newest-to-oldest.
    const page1: PaginatedWorkoutEvents = {
      page: 1,
      page_count: 2,
      events: [{ type: "deleted", id: "x", deleted_at: "2026-08-15T00:00:00Z" }],
    };
    const page2: PaginatedWorkoutEvents = {
      page: 2,
      page_count: 2,
      events: [{ type: "updated", workout: makeWorkout("x") }],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));

    const result = await syncWorkoutEvents("2026-08-01T00:00:00Z");

    expect(result.deletedIds).toEqual(["x"]);
    expect(result.updated).toEqual([]);
  });

  it("throws HevyApiError with the status on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope" }, 401));

    await expect(getWorkoutsCount()).rejects.toMatchObject({
      name: "HevyApiError",
      status: 401,
    });
  });

  it("throws NoApiKeyError on a 401 with error: no_api_key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "no_api_key" }, 401));

    await expect(getWorkoutsCount()).rejects.toBeInstanceOf(NoApiKeyError);
  });

  it("throws plain HevyApiError (not NoApiKeyError) on a 401 with a different body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));

    const error = await getWorkoutsCount().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HevyApiError);
    expect(error).not.toBeInstanceOf(NoApiKeyError);
  });

  it("throws HevyApiError on a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));

    await expect(getWorkoutsCount()).rejects.toBeInstanceOf(HevyApiError);
  });
});
