"use client";

// First-run import screen (PLAN.md §7). Shown by the dashboard when
// IndexedDB has never synced. Streams progress from lib/sync.ts's
// runFullImport (templates first, then paginated workouts, using
// /v1/workouts/count for the total).

import { useState } from "react";
import { Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { runFullImport, type ImportProgress } from "@/lib/sync";

export function ImportScreen({ onComplete }: { onComplete: () => void | Promise<void> }) {
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
          HevyMap pulls every workout you&apos;ve ever logged and maps each set to a sub-muscle. This
          runs once — after that, loads are instant and new workouts sync incrementally.
        </p>
      </div>

      {status === "idle" && (
        <Button size="lg" onClick={() => void start()} className="w-full">
          Start import
        </Button>
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
