// Inline per-card trend signal for the Trends page: average weekly sets
// over the last 4 complete-or-current weeks vs the 4 weeks before that,
// replacing the old week-over-week table with a small summary line under
// each trend card's label.

export interface TrendDelta {
  /** Average weekly sets over the most recent (up to) 4 weeks. */
  recentAvg: number;
  /** Average weekly sets over the (up to) 4 weeks before that, or null if
   * there isn't a full prior window (fewer than 8 weeks of data). */
  priorAvg: number | null;
  /** recentAvg - priorAvg, or null when priorAvg is null. */
  delta: number | null;
}

/** `weeklySets` is one entry per week, oldest first (same order as
 * useWeeklySeries' output). Uses the last 4 weeks vs the 4 before them. */
export function computeTrendDelta(weeklySets: number[]): TrendDelta {
  const recentWindow = weeklySets.slice(-4);
  const recentAvg = average(recentWindow);

  if (weeklySets.length < 8) {
    return { recentAvg, priorAvg: null, delta: null };
  }

  const priorWindow = weeklySets.slice(-8, -4);
  const priorAvg = average(priorWindow);
  return { recentAvg, priorAvg, delta: recentAvg - priorAvg };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
