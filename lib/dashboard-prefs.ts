// Per-chart-card range/bucket preferences for the dashboard's analytics
// cards (Hours trained, Volume progression, etc). Deliberately separate
// from lib/storage.ts's Prefs (out of scope for this build step — see
// CLAUDE.md/task notes) but the same localStorage wrapper pattern as
// lib/overrides.ts and lib/targets.ts. Each card picks its own range/bucket
// independent of the dashboard's global period selector.

export type ChartRange = "all" | "1y" | "6m" | "3m" | "1m";
export type ChartBucket = "week" | "month";

export interface ChartPrefs {
  range: ChartRange;
  bucket: ChartBucket;
}

export type ChartId =
  | "hoursTrained"
  | "volumeProgression"
  | "setsByGroup"
  | "workoutsPerWeek"
  | "prsOverTime";

const DEFAULT_CHART_PREFS: Record<ChartId, ChartPrefs> = {
  hoursTrained: { range: "6m", bucket: "week" },
  volumeProgression: { range: "6m", bucket: "week" },
  setsByGroup: { range: "3m", bucket: "week" },
  workoutsPerWeek: { range: "6m", bucket: "week" },
  prsOverTime: { range: "1y", bucket: "month" },
};

const KEY_PREFIX = "hevymap:dashboard-chart-prefs:";
const SPARKLINES_EXPANDED_KEY = "hevymap:dashboard-sparklines-expanded";

export function getChartPrefs(id: ChartId): ChartPrefs {
  if (typeof window === "undefined") return DEFAULT_CHART_PREFS[id];
  const raw = window.localStorage.getItem(KEY_PREFIX + id);
  if (!raw) return DEFAULT_CHART_PREFS[id];
  try {
    return { ...DEFAULT_CHART_PREFS[id], ...(JSON.parse(raw) as Partial<ChartPrefs>) };
  } catch {
    return DEFAULT_CHART_PREFS[id];
  }
}

export function setChartPrefs(id: ChartId, patch: Partial<ChartPrefs>): ChartPrefs {
  const next = { ...getChartPrefs(id), ...patch };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY_PREFIX + id, JSON.stringify(next));
  }
  return next;
}

/** Whether the "Per-muscle sparklines" section (the 26-tile grid) is
 * expanded on the dashboard. Defaults to collapsed so the page isn't 26
 * tiny charts long by default. */
export function getSparklinesExpanded(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SPARKLINES_EXPANDED_KEY) === "1";
}

export function setSparklinesExpanded(expanded: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SPARKLINES_EXPANDED_KEY, expanded ? "1" : "0");
}
