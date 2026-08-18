"use client";

// First-run "Connect your data" screen (shown by the dashboard whenever
// IndexedDB has never synced — see lib/hooks/use-workout-data.ts's
// needsImport). Two ways in:
//
//  A. Hevy API key — server-configured (HEVY_API_KEY) or pasted here and
//     stored as an encrypted cookie (see app/api/hevy-key/route.ts and
//     lib/hevy-key.ts). Either way, once connected this runs the existing
//     full-import progress flow via lib/sync.ts's runFullImport.
//  B. A Hevy CSV export, parsed entirely client-side (lib/csv/parse-hevy-csv.ts)
//     and written straight into IndexedDB — no API key needed at all.

import { useEffect, useRef, useState } from "react";
import { Activity, Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { runFullImport, importCsvWorkouts, type ImportProgress } from "@/lib/sync";
import { parseHevyCsv } from "@/lib/csv/parse-hevy-csv";
import { resolveExerciseMapping } from "@/lib/volume";
import { getOverrides } from "@/lib/overrides";
import type { HevyWorkout } from "@/lib/hevy";

type KeySource = "loading" | "env" | "cookie" | "none";

async function fetchKeySource(): Promise<KeySource> {
  try {
    const response = await fetch("/api/hevy-key", { method: "GET" });
    if (!response.ok) return "none";
    const body = (await response.json()) as { source: KeySource };
    return body.source;
  } catch {
    return "none";
  }
}

export function ImportScreen({ onComplete }: { onComplete: () => void | Promise<void> }) {
  const [keySource, setKeySource] = useState<KeySource>("loading");
  const [mode, setMode] = useState<"choose" | "api-key" | "csv">("choose");

  useEffect(() => {
    void fetchKeySource().then(setKeySource);
  }, []);

  if (keySource === "loading") {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md items-center justify-center">
        <Activity className="size-6 animate-pulse text-muted-foreground" strokeWidth={1.75} />
      </div>
    );
  }

  if (keySource === "env" || keySource === "cookie") {
    return <ConnectedImport keySource={keySource} onComplete={onComplete} onDisconnected={() => setKeySource("none")} />;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Activity className="size-7" strokeWidth={1.75} />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Connect your data</h1>
        <p className="text-sm text-muted-foreground">
          HevyMap maps every set you&apos;ve logged to a sub-muscle. Bring in your history either way below — you
          only need one.
        </p>
      </div>

      {mode === "choose" && (
        <div className="grid w-full gap-3">
          <Button size="lg" onClick={() => setMode("api-key")} className="w-full">
            Connect with a Hevy API key
          </Button>
          <Button size="lg" variant="outline" onClick={() => setMode("csv")} className="w-full">
            Upload a Hevy CSV export
          </Button>
        </div>
      )}

      {mode === "api-key" && (
        <ApiKeyForm onConnected={() => setKeySource("cookie")} onBack={() => setMode("choose")} />
      )}

      {mode === "csv" && <CsvUpload onImported={onComplete} onBack={() => setMode("choose")} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A. API key — already connected (env var or a saved cookie key)
// ---------------------------------------------------------------------------

function ConnectedImport({
  keySource,
  onComplete,
  onDisconnected,
}: {
  keySource: "env" | "cookie";
  onComplete: () => void | Promise<void>;
  onDisconnected: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "importing" | "error">("idle");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setStatus("importing");
    setError(null);
    try {
      await runFullImport(setProgress);
      await onComplete();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const disconnect = async () => {
    await fetch("/api/hevy-key", { method: "DELETE" });
    onDisconnected();
  };

  const percent =
    progress && progress.phase === "workouts" && progress.total > 0
      ? Math.min(100, Math.round((progress.fetched / progress.total) * 100))
      : progress
        ? 8
        : 0;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Activity className="size-7" strokeWidth={1.75} />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Import your Hevy history</h1>
        <p className="text-sm text-muted-foreground">
          {keySource === "env" ? "Connected via server API key." : "Connected via your saved API key."} HevyMap
          pulls every workout you&apos;ve ever logged and maps each set to a sub-muscle. This runs once — after
          that, loads are instant and new workouts sync incrementally.
        </p>
      </div>

      {status === "idle" && (
        <div className="w-full space-y-2">
          <Button size="lg" onClick={() => void start()} className="w-full">
            Start import
          </Button>
          {keySource === "cookie" && (
            <Button size="sm" variant="ghost" onClick={() => void disconnect()}>
              Disconnect
            </Button>
          )}
        </div>
      )}

      {status === "importing" && (
        <div className="w-full space-y-2">
          <Progress value={percent} />
          <p className="text-xs text-muted-foreground tabular-nums">
            {progress?.phase === "templates" && `Fetching exercise library… ${progress.fetched}`}
            {progress?.phase === "workouts" &&
              `Importing workouts… ${progress.fetched} of ${progress.total || "?"}`}
            {!progress && "Starting…"}
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="w-full space-y-3">
          <p className="text-sm text-destructive">Import failed: {error}</p>
          <Button size="lg" onClick={() => void start()} className="w-full">
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A. API key — paste-your-own form (no server key configured)
// ---------------------------------------------------------------------------

export function ApiKeyForm({ onConnected, onBack }: { onConnected: () => void; onBack: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    if (!apiKey.trim()) return;
    setStatus("checking");
    setError(null);
    try {
      const response = await fetch("/api/hevy-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        const message =
          body.error === "invalid_api_key"
            ? "That key doesn't look valid — check it and try again."
            : body.error === "hevy_unreachable"
              ? "Couldn't reach the Hevy API — try again in a moment."
              : "Couldn't connect that key.";
        setStatus("error");
        setError(message);
        return;
      }
      onConnected();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="w-full space-y-3 text-left">
      <div>
        <label htmlFor="hevy-api-key" className="text-sm font-medium">
          Hevy API key
        </label>
        <p className="text-xs text-muted-foreground">
          From the Hevy app: Settings → Developer. Stored encrypted, server-side only — never in your browser&apos;s
          local storage.
        </p>
      </div>
      <Input
        id="hevy-api-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="Paste your Hevy API key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        disabled={status === "checking"}
      />
      {status === "error" && error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-2">
        <Button onClick={() => void connect()} disabled={status === "checking" || !apiKey.trim()}>
          {status === "checking" ? "Checking…" : "Connect"}
        </Button>
        <Button variant="ghost" onClick={onBack} disabled={status === "checking"}>
          Back
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// B. CSV upload
// ---------------------------------------------------------------------------

interface CsvPreview {
  workouts: HevyWorkout[];
  workoutCount: number;
  dateRange: { start: string; end: string } | null;
  matchedExerciseCount: number;
  estimatedExerciseCount: number;
  warnings: string[];
}

function buildPreview(workouts: HevyWorkout[], warnings: string[]): CsvPreview {
  const overrides = getOverrides();
  const seenExerciseIds = new Set<string>();
  let matched = 0;
  let estimated = 0;
  let start: string | null = null;
  let end: string | null = null;

  for (const workout of workouts) {
    if (start === null || workout.start_time < start) start = workout.start_time;
    if (end === null || workout.start_time > end) end = workout.start_time;

    for (const exercise of workout.exercises) {
      if (seenExerciseIds.has(exercise.exercise_template_id)) continue;
      seenExerciseIds.add(exercise.exercise_template_id);
      const resolved = resolveExerciseMapping(
        { id: exercise.exercise_template_id, name: exercise.title },
        { overrides },
      );
      if (resolved.source === "repo_map" || resolved.source === "override") {
        matched += 1;
      } else {
        estimated += 1;
      }
    }
  }

  return {
    workouts,
    workoutCount: workouts.length,
    dateRange: start && end ? { start, end } : null,
    matchedExerciseCount: matched,
    estimatedExerciseCount: estimated,
    warnings,
  };
}

export function CsvUpload({
  onImported,
  onBack,
  importFn = importCsvWorkouts,
}: {
  onImported: () => void | Promise<void>;
  onBack: () => void;
  /** Defaults to importCsvWorkouts (first-run import, upserts). Settings'
   * "Re-upload CSV" passes reimportCsvWorkouts instead, which clears the
   * existing cache first so rows dropped from the new export don't linger. */
  importFn?: (workouts: HevyWorkout[]) => Promise<void>;
}) {
  const [status, setStatus] = useState<"idle" | "parsing" | "preview" | "importing" | "error">("idle");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setStatus("parsing");
    setError(null);
    try {
      const text = await file.text();
      const { workouts, warnings } = parseHevyCsv(text);
      if (workouts.length === 0) {
        setStatus("error");
        setError("No workouts found in that file. Is it a Hevy workout export CSV?");
        return;
      }
      setPreview(buildPreview(workouts, warnings));
      setStatus("preview");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setStatus("importing");
    try {
      await importFn(preview.workouts);
      await onImported();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="w-full space-y-4 text-left">
      {status === "idle" && (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium">Upload your Hevy export</p>
            <p className="text-xs text-muted-foreground">
              In the Hevy app: Settings → Export data. No Hevy Pro required. Parsing happens entirely in your
              browser — the file never leaves your device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border/80 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
          >
            <Upload className="size-5" strokeWidth={1.75} />
            Drag a CSV file here, or click to choose one
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </>
      )}

      {status === "parsing" && <p className="text-sm text-muted-foreground">Reading file…</p>}

      {status === "preview" && preview && (
        <div className="space-y-3">
          <Alert>
            <AlertTitle>Ready to import</AlertTitle>
            <AlertDescription>
              <span className="tabular-nums">{preview.workoutCount}</span> workout
              {preview.workoutCount === 1 ? "" : "s"}
              {preview.dateRange && (
                <>
                  {" "}
                  from {new Date(preview.dateRange.start).toLocaleDateString()} to{" "}
                  {new Date(preview.dateRange.end).toLocaleDateString()}
                </>
              )}
              . <span className="tabular-nums">{preview.matchedExerciseCount}</span> exercise
              {preview.matchedExerciseCount === 1 ? "" : "s"} matched to a known mapping,{" "}
              <span className="tabular-nums">{preview.estimatedExerciseCount}</span> will show as estimated (define
              them anytime in Exercises).
            </AlertDescription>
          </Alert>
          {preview.warnings.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {preview.warnings.length} row{preview.warnings.length === 1 ? "" : "s"} couldn&apos;t be read and
              were skipped.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={() => void confirmImport()}>Import</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setStatus("idle");
              }}
            >
              Choose a different file
            </Button>
          </div>
        </div>
      )}

      {status === "importing" && <p className="text-sm text-muted-foreground">Importing…</p>}

      {status === "error" && (
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            onClick={() => {
              setStatus("idle");
              setError(null);
            }}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
