"use client";

// Reactive wrapper around lib/storage.ts's prefs (localStorage). Plain
// getPrefs()/setPrefs() don't trigger React re-renders on their own, so
// pages that need live updates (settings toggles, unit display) go through
// this hook instead.

import { useEffect, useState } from "react";
import { DEFAULT_PREFS, getPrefs, setPrefs as persistPrefs, type Prefs } from "@/lib/storage";

export function usePrefs(): [Prefs, (update: Partial<Prefs>) => void] {
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    // Hydrate from localStorage post-mount (SSR has no access to it; the
    // initial render intentionally matches DEFAULT_PREFS to avoid a
    // hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefsState(getPrefs());
  }, []);

  const update = (patch: Partial<Prefs>) => {
    setPrefsState(persistPrefs(patch));
  };

  return [prefs, update];
}
