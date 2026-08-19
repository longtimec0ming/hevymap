"use client";

// Root nav + one-time background incremental sync. Wraps every page (see
// app/layout.tsx). The incremental sync only fires when a full import has
// already happened (lib/sync.ts's runIncrementalSync no-ops otherwise) and
// only once per session — pages read from IndexedDB via useWorkoutData and
// re-read after this completes.
//
// Desktop: a fixed left sidebar (logo, nav, last-synced + sync button,
// version). Mobile: a sticky top bar that opens the same nav as a slide-in
// drawer.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, History, LayoutDashboard, ListTree, Menu, RefreshCw, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWorkoutData } from "@/lib/hooks/use-workout-data";
import { runIncrementalSync } from "@/lib/sync";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/history", label: "History", icon: History },
  { href: "/exercises", label: "Exercises", icon: ListTree },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

// Bump on release; shown at the bottom of the sidebar, mirroring the
// reference dashboard's "v1.2.0" footer.
const APP_VERSION = "v0.1.0";

let backgroundSyncStarted = false;

function useBackgroundSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled || backgroundSyncStarted) return;
    backgroundSyncStarted = true;
    void runIncrementalSync().catch((error) => {
      console.error("Background sync failed", error);
    });
  }, [enabled]);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              active && "bg-sidebar-accent text-sidebar-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SyncStatus() {
  const { syncState, refresh } = useWorkoutData();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await runIncrementalSync();
      await refresh();
      if (result) {
        toast.success(
          result.updatedCount === 0 && result.deletedCount === 0
            ? "Already up to date"
            : `Synced ${result.updatedCount} workout${result.updatedCount === 1 ? "" : "s"}`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-sidebar-foreground/60">
        Last synced{" "}
        <span className="tabular-nums text-sidebar-foreground/80">
          {syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleString() : "never"}
        </span>
      </p>
      <Button variant="outline" size="sm" className="w-full" onClick={() => void handleSync()} disabled={syncing}>
        <RefreshCw data-icon="inline-start" className={cn("size-3.5", syncing && "animate-spin")} />
        {syncing ? "Syncing…" : "Sync now"}
      </Button>
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-6 items-center justify-center rounded-md bg-brand text-brand-foreground text-xs font-bold">H</span>
      HevyMap
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useBackgroundSync(!isLoginPage);

  // The login page (only reachable when ACCESS_PASSWORD is set — see
  // proxy.ts) renders its own full-screen layout: no nav for a route the
  // user isn't authenticated for yet, and no point syncing Hevy data before
  // they've unlocked the app.
  if (isLoginPage) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-sidebar-border md:bg-sidebar">
          <div className="flex h-14 items-center px-4">
            <Logo />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <NavLinks pathname={pathname} />
          </div>
          <div className="border-t border-sidebar-border px-3 py-3">
            <SyncStatus />
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[11px] tabular-nums text-sidebar-foreground/40">{APP_VERSION}</p>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur md:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}>
              <Menu className="size-5" strokeWidth={1.75} />
            </Button>
            <Logo />
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        </div>

        {/* Mobile drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-xl">
              <div className="flex h-14 items-center justify-between px-4">
                <Logo />
                <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setMobileNavOpen(false)}>
                  <X className="size-5" strokeWidth={1.75} />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                <NavLinks pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
              </div>
              <div className="border-t border-sidebar-border px-3 py-3">
                <SyncStatus />
                <p className="mt-3 text-[11px] tabular-nums text-sidebar-foreground/40">{APP_VERSION}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
