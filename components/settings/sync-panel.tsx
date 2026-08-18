"use client";

// Settings' "Sync" card. Behavior depends on how the cache was populated
// (SyncState.dataSource, set by lib/sync.ts):
//  - "api": the normal Force full re-sync button, plus a Disconnect action
//    for a user-pasted API key (nothing to disconnect for a server-configured
//    HEVY_API_KEY).
//  - "csv": no background sync is possible (lib/sync.ts's runIncrementalSync
//    no-ops), so this offers "Re-upload CSV" and "Switch to API key" instead.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ApiKeyForm, CsvUpload } from "@/components/import/import-screen";
import { forceFullResync, reimportCsvWorkouts, type ImportProgress } from "@/lib/sync";
import type { SyncState } from "@/lib/storage";

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

export function SyncPanel({ syncState, onSynced }: { syncState: SyncState; onSynced: () => void | Promise<void> }) {
  const [keySource, setKeySource] = useState<KeySource>("loading");
  const [switching, setSwitching] = useState<"csv" | "api-key" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  useEffect(() => {
    void fetchKeySource().then(setKeySource);
  }, []);

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

  const handleDisconnect = async () => {
    await fetch("/api/hevy-key", { method: "DELETE" });
    setKeySource("none");
    toast("Disconnected your Hevy API key");
  };

  const percent =
    progress && progress.phase === "workouts" && progress.total > 0
      ? Math.min(100, Math.round((progress.fetched / progress.total) * 100))
      : progress
        ? 8
        : 0;

  const sourceLabel = syncState.dataSource === "csv" ? "CSV upload" : syncState.dataSource === "api" ? "Hevy API" : "—";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Data source: <span className="text-foreground">{sourceLabel}</span>
        {" · "}Last synced:{" "}
        <span className="tabular-nums text-foreground">
          {syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleString() : "never"}
        </span>
      </p>

      {syncState.dataSource === "api" && (
        <div className="space-y-3">
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
          {keySource === "cookie" && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => void handleDisconnect()}>
                Disconnect Hevy API key
              </Button>
            </div>
          )}
        </div>
      )}

      {syncState.dataSource === "csv" && switching === null && !syncing && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setSwitching("csv")}>
            Re-upload CSV
          </Button>
          <Button variant="outline" onClick={() => setSwitching("api-key")}>
            Switch to API key
          </Button>
        </div>
      )}

      {syncing && switching === null && (
        <div className="max-w-sm space-y-1">
          <Progress value={percent} />
          <p className="text-xs text-muted-foreground tabular-nums">Switching to your Hevy API key and importing…</p>
        </div>
      )}

      {switching === "csv" && (
        <CsvUpload
          importFn={reimportCsvWorkouts}
          onImported={async () => {
            setSwitching(null);
            await onSynced();
            toast.success("CSV re-imported");
          }}
          onBack={() => setSwitching(null)}
        />
      )}

      {switching === "api-key" && (
        <ApiKeyForm
          onConnected={() => {
            setKeySource("cookie");
            void (async () => {
              setSwitching(null);
              setSyncing(true);
              try {
                await forceFullResync(setProgress);
                await onSynced();
                toast.success("Switched to your Hevy API key");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Import failed");
              } finally {
                setSyncing(false);
                setProgress(null);
              }
            })();
          }}
          onBack={() => setSwitching(null)}
        />
      )}
    </div>
  );
}
