"use client";

// Root nav + one-time background incremental sync. Wraps every page (see
// app/layout.tsx). The incremental sync only fires when a full import has
// already happened (lib/sync.ts's runIncrementalSync no-ops otherwise) and
// only once per session — pages read from IndexedDB via useWorkoutData and
// re-read after this completes.

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, History, LayoutDashboard, ListTree, Settings } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { runIncrementalSync } from "@/lib/sync";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/exercises", label: "Exercises", icon: ListTree },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
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
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex size-6 items-center justify-center rounded-md bg-brand text-brand-foreground text-xs font-bold">
                H
              </span>
              <span className="hidden sm:inline">HevyMap</span>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                      active && "bg-secondary text-foreground",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                    <span className="hidden md:inline">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
