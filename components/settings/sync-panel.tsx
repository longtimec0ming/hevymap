"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { forceFullResync, type ImportProgress } from "@/lib/sync";
import type { SyncState } from "@/lib/storage";

export function SyncPanel({ syncState, onSynced }: { syncState: SyncState; onSynced: () => void | Promise<void> }) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const handleResync = async () => {
    setSyncing(true);
    setProgress(null);
    try {
      await forceFullResync(setProgress);
      await onSynced();
      toast.success("Re-sync complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Re-sync failed");
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  const percent =
    progress && progress.phase === "workouts" && progress.total > 0
      ? Math.min(100, Math.round((progress.fetched / progress.total) * 100))
      : progress
        ? 8
        : 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Last synced:{" "}
        <span className="tabular-nums text-foreground">
          {syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleString() : "never"}
        </span>
      </p>
      <Button variant="outline" onClick={() => void handleResync()} disabled={syncing}>
        {syncing ? "Re-syncing…" : "Force full re-sync"}
      </Button>
      {syncing && (
        <div className="max-w-sm space-y-1">
          <Progress value={percent} />
          <p className="text-xs text-muted-foreground tabular-nums">
            {progress?.phase === "workouts" && `${progress.fetched} / ${progress.total || "?"} workouts`}
            {progress?.phase === "templates" && `${progress.fetched} exercise templates`}
          </p>
        </div>
      )}
    </div>
  );
}
