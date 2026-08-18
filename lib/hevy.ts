// Typed Hevy API client used by the browser. All requests go through the
// server-side proxy at /api/hevy/* (see app/api/hevy/[...path]/route.ts) —
// never directly to api.hevyapp.com, per CLAUDE.md's hard invariants.
//
// Response shapes below were verified against a real account on
// 2026-08-18 (`curl` against api.hevyapp.com/v1) and against the API's
// OpenAPI schema at https://api.hevyapp.com/docs/json, not guessed.

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export type SetType = "normal" | "warmup" | "dropset" | "failure";

export interface HevySet {
  index: number;
  type: SetType;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  custom_metric: number | null;
}

export interface HevyExercise {
  index: number;
  title: string;
  notes: string;
  /** Hevy exercise_template id. Standard exercises use short hex ids
   * (e.g. "05293BCA"); some accounts have templates keyed by UUID instead
   * (observed in the wild) — treat this as an opaque string either way. */
  exercise_template_id: string;
  superset_id: number | null;
  sets: HevySet[];
}

export interface HevyWorkout {
  id: string;
  title: string;
  routine_id: string | null;
  description: string;
  /** ISO 8601 with numeric offset, e.g. "2026-08-18T12:23:24+00:00". */
  start_time: string;
  end_time: string;
  /** ISO 8601 UTC with milliseconds, e.g. "2026-08-18T13:54:24.377Z". */
  updated_at: string;
  created_at: string;
  exercises: HevyExercise[];
}

export interface PaginatedWorkouts {
  page: number;
  page_count: number;
  workouts: HevyWorkout[];
}

export interface WorkoutsCountResponse {
  workout_count: number;
}

export type ExerciseTemplateType =
  | "weight_reps"
  | "reps_only"
  | "bodyweight_reps"
  | "bodyweight_assisted_reps"
  | "duration"
  | "weight_duration"
  | "distance_duration"
  | "short_distance_weight";

export type EquipmentCategory =
  | "none"
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "machine"
  | "plate"
  | "resistance_band"
  | "suspension"
  | "other";

export interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: ExerciseTemplateType;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  /** NOTE: the live API returns this field as "equipment" — the published
   * OpenAPI schema calls it "equipment_category". Named for the real
   * response since that's what the client actually receives. */
  equipment: EquipmentCategory;
  is_custom: boolean;
}

export interface PaginatedExerciseTemplates {
  page: number;
  page_count: number;
  exercise_templates: HevyExerciseTemplate[];
}

export interface UpdatedWorkoutEvent {
  type: "updated";
  workout: HevyWorkout;
}

export interface DeletedWorkoutEvent {
  type: "deleted";
  id: string;
  deleted_at: string;
}

export type WorkoutEvent = UpdatedWorkoutEvent | DeletedWorkoutEvent;

export interface PaginatedWorkoutEvents {
  page: number;
  page_count: number;
  events: WorkoutEvent[];
}

/** Result of reconciling a page (or pages) of /workouts/events: each workout
 * id resolves to exactly one outcome, keeping only the newest event seen
 * (events are returned newest-first). */
export interface SyncResult {
  updated: HevyWorkout[];
  deletedIds: string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class HevyApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HevyApiError";
    this.status = status;
    this.body = body;
  }
}

/** Thrown when the server proxy has no Hevy API key at all (neither
 * HEVY_API_KEY nor a connected cookie key — see
 * app/api/hevy/[...path]/route.ts and lib/hevy-key.ts). Callers (the import
 * screen, background sync) can catch this specifically to route the user
 * back to the "Connect your data" screen, rather than showing a generic
 * network-error message. */
export class NoApiKeyError extends HevyApiError {
  constructor(body: unknown) {
    super("No Hevy API key is connected.", 401, body);
    this.name = "NoApiKeyError";
  }
}

function isNoApiKeyBody(body: unknown): boolean {
  return typeof body === "object" && body !== null && (body as { error?: unknown }).error === "no_api_key";
}

// ---------------------------------------------------------------------------
// Low-level fetch helper
// ---------------------------------------------------------------------------

const PROXY_BASE = "/api/hevy";

async function hevyFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const query = params
    ? "?" +
      Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join("&")
    : "";

  let response: Response;
  try {
    response = await fetch(`${PROXY_BASE}/${path}${query}`, { method: "GET" });
  } catch (error) {
    throw new HevyApiError(
      `Network error while calling ${path}: ${error instanceof Error ? error.message : String(error)}`,
      0,
      undefined,
    );
  }

  const text = await response.text();
  let body: unknown = undefined;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && isNoApiKeyBody(body)) {
      throw new NoApiKeyError(body);
    }
    throw new HevyApiError(`Hevy API request to ${path} failed with status ${response.status}`, response.status, body);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Pagination limits (from the Hevy OpenAPI spec: workouts and events cap at
// 10 items/page, exercise_templates caps at 100/page)
// ---------------------------------------------------------------------------

const WORKOUTS_MAX_PAGE_SIZE = 10;
const EVENTS_MAX_PAGE_SIZE = 10;
const EXERCISE_TEMPLATES_MAX_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Public client
// ---------------------------------------------------------------------------

/** Total number of workouts on the account — used to drive an import
 * progress bar before paginating through /workouts. */
export async function getWorkoutsCount(): Promise<number> {
  const result = await hevyFetch<WorkoutsCountResponse>("workouts/count");
  return result.workout_count;
}

export async function getWorkoutsPage(
  page: number,
  pageSize: number = WORKOUTS_MAX_PAGE_SIZE,
): Promise<PaginatedWorkouts> {
  return hevyFetch<PaginatedWorkouts>("workouts", { page, pageSize });
}

export async function getExerciseTemplatesPage(
  page: number,
  pageSize: number = EXERCISE_TEMPLATES_MAX_PAGE_SIZE,
): Promise<PaginatedExerciseTemplates> {
  return hevyFetch<PaginatedExerciseTemplates>("exercise_templates", { page, pageSize });
}

export async function getWorkoutEventsPage(
  since: string,
  page: number,
  pageSize: number = EVENTS_MAX_PAGE_SIZE,
): Promise<PaginatedWorkoutEvents> {
  return hevyFetch<PaginatedWorkoutEvents>("workouts/events", { since, page, pageSize });
}

/** Fetches every workout on the account, paginating until exhausted. Used
 * for the first-run full history import. Reports progress via `onProgress`
 * (workouts fetched so far, total count) if provided. */
export async function getAllWorkouts(
  onProgress?: (fetched: number, total: number) => void,
): Promise<HevyWorkout[]> {
  const total = await getWorkoutsCount();
  const workouts: HevyWorkout[] = [];

  let page = 1;
  let pageCount = 1;
  do {
    const result = await getWorkoutsPage(page, WORKOUTS_MAX_PAGE_SIZE);
    workouts.push(...result.workouts);
    pageCount = result.page_count;
    onProgress?.(workouts.length, total);
    page += 1;
  } while (page <= pageCount);

  return workouts;
}

/** Fetches every exercise template on the account (standard bank + the
 * user's custom exercises), paginating until exhausted. */
export async function getAllExerciseTemplates(
  onProgress?: (fetched: number) => void,
): Promise<HevyExerciseTemplate[]> {
  const templates: HevyExerciseTemplate[] = [];

  let page = 1;
  let pageCount = 1;
  do {
    const result = await getExerciseTemplatesPage(page, EXERCISE_TEMPLATES_MAX_PAGE_SIZE);
    templates.push(...result.exercise_templates);
    pageCount = result.page_count;
    onProgress?.(templates.length);
    page += 1;
  } while (page <= pageCount);

  return templates;
}

/** Fetches every workout event since `since` (ISO 8601 timestamp),
 * paginating until exhausted, and reconciles them into a single
 * updated/deleted outcome per workout id.
 *
 * Events are returned newest-to-oldest, so the first event seen for a given
 * workout id is authoritative; later (older) events for the same id are
 * discarded.
 *
 * NOTE: this is the incremental sync endpoint CLAUDE.md calls
 * `workouts/events?since=`. It behaves as documented; the one thing to
 * watch is clock skew between client and server when choosing the next
 * `since` value — see lib/storage.ts's sync-state handling. */
export async function syncWorkoutEvents(
  since: string,
  onProgress?: (fetched: number) => void,
): Promise<SyncResult> {
  const seen = new Set<string>();
  const updated: HevyWorkout[] = [];
  const deletedIds: string[] = [];

  let page = 1;
  let pageCount = 1;
  let fetched = 0;
  do {
    const result = await getWorkoutEventsPage(since, page, EVENTS_MAX_PAGE_SIZE);
    for (const event of result.events) {
      const id = event.type === "updated" ? event.workout.id : event.id;
      if (seen.has(id)) continue;
      seen.add(id);

      if (event.type === "updated") {
        updated.push(event.workout);
      } else {
        deletedIds.push(event.id);
      }
    }
    fetched += result.events.length;
    pageCount = result.page_count;
    onProgress?.(fetched);
    page += 1;
  } while (page <= pageCount);

  return { updated, deletedIds };
}
