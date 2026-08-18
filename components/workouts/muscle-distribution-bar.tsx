// Compact per-workout muscle-group distribution: a horizontal stacked bar
// segmented by the 6 coarse regions (same colors as the "Sets by muscle
// group" dashboard chart, lib/region-colors.ts) plus the top-3 groups as
// text underneath, e.g. "Chest 38% · Shoulders 22% · Arms 15%". Computed
// from a workout's VolumeByMuscle via lib/groups.ts's region grouping.
// Used both on the (collapsed) workout row and the dashboard's Recent
// workouts card, so distribution is visible without expanding.

import { groupVolumeByRegion } from "@/lib/groups";
import { REGION_COLORS } from "@/lib/region-colors";
import type { VolumeByMuscle } from "@/lib/volume";

export interface MuscleDistributionBarProps {
  volumeByMuscle: VolumeByMuscle;
  className?: string;
}

export function MuscleDistributionBar({ volumeByMuscle, className }: MuscleDistributionBarProps) {
  const groups = groupVolumeByRegion(volumeByMuscle);
  const total = groups.reduce((sum, g) => sum + g.total.sets, 0);

  if (total <= 0) {
    return <p className="text-xs text-muted-foreground">No sets logged.</p>;
  }

  const withShare = groups
    .map((g, i) => ({ region: g.region, sets: g.total.sets, pct: (g.total.sets / total) * 100, color: REGION_COLORS[i % REGION_COLORS.length] }))
    .filter((g) => g.sets > 0)
    .sort((a, b) => b.sets - a.sets);

  const topThree = withShare.slice(0, 3);

  return (
    <div className={className}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {withShare.map((g) => (
          <div key={g.region} style={{ width: `${g.pct}%`, backgroundColor: g.color }} title={`${g.region}: ${g.pct.toFixed(0)}%`} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {topThree.map((g, i) => (
          <span key={g.region}>
            {i > 0 && " · "}
            {g.region} {g.pct.toFixed(0)}%
          </span>
        ))}
      </p>
    </div>
  );
}
