"use client";

import { useMemo, useState } from "react";
import { BodyMap } from "@/components/body-map";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { NeglectRadar } from "@/components/dashboard/neglect-radar";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { SparklineGrid } from "@/components/dashboard/sparkline-grid";
import { SummaryStrip } from "@/components/dashboard/summary-strip";
import { ImportScreen } from "@/components/import/import-screen";
import { usePrefs } from "@/lib/hooks/use-prefs";
import { useWeeklySeries } from "@/lib/hooks/use-weekly-series";
import { useWorkoutData } from "@/lib/hooks/use-workout-data";
import { getOverrides } from "@/lib/overrides";
import {
  filterWorkoutsInRange,
  previousPeriodRange,
  proRateBands,
  resolvePeriod,
  weeklyAverageVolume,
} from "@/lib/period";
import { getEffectiveTargetBands } from "@/lib/targets";
import { computeVolumeByMuscle } from "@/lib/volume";
import type { SubMuscleId } from "@/data/taxonomy";

const SPARKLINE_WEEKS = 8;

export default function DashboardPage() {
  const data = useWorkoutData();
  const [prefs, updatePrefs] = usePrefs();
  const [highlighted, setHighlighted] = useState<SubMuscleId | null>(null);

  // Sparklines are always the last 8 calendar weeks, independent of the
  // timeframe selector below (PLAN.md §9.1: "Sparklines stay 8-week
  // regardless").
  const series = useWeeklySeries(data.workouts, data.templatesById, prefs.weekStartsOn, prefs.includeWarmups, SPARKLINE_WEEKS);

  const baseTargetBands = useMemo(() => getEffectiveTargetBands(), []);

  const resolved = useMemo(
    () => resolvePeriod(prefs.periodScope, prefs.weekStartsOn, data.workouts),
    [prefs.periodScope, prefs.weekStartsOn, data.workouts],
  );

  const periodVolume = useMemo(() => {
    const overrides = getOverrides();
    const inRange = filterWorkoutsInRange(data.workouts, resolved.range);
    return computeVolumeByMuscle(inRange, data.templatesById, { overrides }, { includeWarmups: prefs.includeWarmups });
  }, [data.workouts, data.templatesById, resolved.range, prefs.includeWarmups]);

  const previousVolume = useMemo(() => {
    const previousRange = previousPeriodRange(prefs.periodScope, resolved.range);
    if (!previousRange) return undefined;
    const overrides = getOverrides();
    const inRange = filterWorkoutsInRange(data.workouts, previousRange);
    return computeVolumeByMuscle(inRange, data.templatesById, { overrides }, { includeWarmups: prefs.includeWarmups });
  }, [data.workouts, data.templatesById, prefs.periodScope, prefs.includeWarmups, resolved.range]);

  // Target-band comparison (PLAN.md §9.1: "vs (pro-rated) targets"). For a
  // bounded period, scale the weekly target band up/down to the period's
  // length. For all-time, scaling the target to hundreds of days would be
  // meaningless, so instead we scale the *volume* down to a weekly-average
  // rate and compare that to the unscaled weekly target — see
  // lib/period.ts's weeklyAverageVolume for the rationale.
  const { comparisonVolume, comparisonTargetBands, comparisonNote } = useMemo(() => {
    if (resolved.isAllTime) {
      return {
        comparisonVolume: weeklyAverageVolume(periodVolume, resolved.days),
        comparisonTargetBands: baseTargetBands,
        comparisonNote: "Showing weekly average across all-time history, vs weekly targets.",
      };
    }
    return {
      comparisonVolume: periodVolume,
      comparisonTargetBands: proRateBands(baseTargetBands, resolved.days),
      comparisonNote:
        resolved.days === 7 ? "" : `Targets pro-rated to ${resolved.days} day${resolved.days === 1 ? "" : "s"}.`,
    };
  }, [resolved.isAllTime, resolved.days, periodVolume, baseTargetBands]);

  const sessionsInPeriod = useMemo(
    () => filterWorkoutsInRange(data.workouts, resolved.range).length,
    [data.workouts, resolved.range],
  );

  if (!data.loaded) {
    return <DashboardSkeleton />;
  }

  if (data.needsImport) {
    return <ImportScreen onComplete={data.refresh} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{resolved.label}</p>
        </div>
        <PeriodSelector
          scope={prefs.periodScope}
          onScopeChange={(scope) => updatePrefs({ periodScope: scope })}
          currentRange={resolved.range}
        />
      </div>

      <SummaryStrip
        volumeByMuscle={periodVolume}
        previousVolumeByMuscle={previousVolume}
        sessionCount={sessionsInPeriod}
        units={prefs.units}
      />

      <div className="space-y-2">
        <BodyMap
          volumeByMuscle={comparisonVolume}
          targetBands={comparisonTargetBands}
          highlightedMuscleId={highlighted}
          onMuscleHover={setHighlighted}
          onMuscleClick={setHighlighted}
          units={prefs.units}
        />
        {comparisonNote && <p className="text-center text-xs text-muted-foreground">{comparisonNote}</p>}
      </div>

      <NeglectRadar volumeByMuscle={comparisonVolume} targetBands={comparisonTargetBands} />

      <SparklineGrid series={series} />
    </div>
  );
}
