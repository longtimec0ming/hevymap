"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BodyMap } from "@/components/body-map";
import { Button } from "@/components/ui/button";
import { ConsistencyHeatmapCard } from "@/components/dashboard/consistency-heatmap-card";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { HoursTrainedCard } from "@/components/dashboard/hours-trained-card";
import { NeglectRadar } from "@/components/dashboard/neglect-radar";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { PrsOverTimeCard } from "@/components/dashboard/prs-over-time-card";
import { RecentWorkoutsCard } from "@/components/dashboard/recent-workouts-card";
import { SetsByGroupCard } from "@/components/dashboard/sets-by-group-card";
import { SetsBySubMuscleCard } from "@/components/dashboard/sets-by-sub-muscle-card";
import { SparklineGrid } from "@/components/dashboard/sparkline-grid";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { VolumeProgressionCard } from "@/components/dashboard/volume-progression-card";
import { WorkoutsPerWeekCard } from "@/components/dashboard/workouts-per-week-card";
import { ImportScreen } from "@/components/import/import-screen";
import { getSparklinesExpanded, setSparklinesExpanded } from "@/lib/dashboard-prefs";
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
  const [sparklinesExpanded, setSparklinesExpandedState] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage post-mount, same reasoning as usePrefs: SSR
    // has no access to it, and matching DEFAULT on the initial render avoids
    // a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSparklinesExpandedState(getSparklinesExpanded());
  }, []);

  // Sparklines are always the last 8 calendar weeks, independent of the
  // timeframe selector below (PLAN.md §9.1: "Sparklines stay 8-week
  // regardless").
  const series = useWeeklySeries(data.workouts, data.templatesById, prefs.weekStartsOn, prefs.includeWarmups, SPARKLINE_WEEKS);

  const baseTargetBands = useMemo(() => getEffectiveTargetBands(), []);

  const resolved = useMemo(
    () => resolvePeriod(prefs.periodScope, prefs.weekStartsOn, data.workouts),
    [prefs.periodScope, prefs.weekStartsOn, data.workouts],
  );

  const workoutsInPeriod = useMemo(
    () => filterWorkoutsInRange(data.workouts, resolved.range),
    [data.workouts, resolved.range],
  );

  const periodVolume = useMemo(() => {
    const overrides = getOverrides();
    return computeVolumeByMuscle(workoutsInPeriod, data.templatesById, { overrides }, { includeWarmups: prefs.includeWarmups });
  }, [workoutsInPeriod, data.templatesById, prefs.includeWarmups]);

  const previousRange = useMemo(() => previousPeriodRange(prefs.periodScope, resolved.range), [prefs.periodScope, resolved.range]);

  const previousWorkoutsInPeriod = useMemo(
    () => (previousRange ? filterWorkoutsInRange(data.workouts, previousRange) : undefined),
    [data.workouts, previousRange],
  );

  const previousVolume = useMemo(() => {
    if (!previousWorkoutsInPeriod) return undefined;
    const overrides = getOverrides();
    return computeVolumeByMuscle(previousWorkoutsInPeriod, data.templatesById, { overrides }, { includeWarmups: prefs.includeWarmups });
  }, [previousWorkoutsInPeriod, data.templatesById, prefs.includeWarmups]);

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

  if (!data.loaded) {
    return <DashboardSkeleton />;
  }

  if (data.needsImport) {
    return <ImportScreen onComplete={data.refresh} />;
  }

  const toggleSparklines = () => {
    const next = !sparklinesExpanded;
    setSparklinesExpandedState(next);
    setSparklinesExpanded(next);
  };

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

      <StatTiles
        workoutsInPeriod={workoutsInPeriod}
        allWorkouts={data.workouts}
        volumeByMuscle={periodVolume}
        previousWorkoutsInPeriod={previousWorkoutsInPeriod}
        previousVolumeByMuscle={previousVolume}
        weekStartsOn={prefs.weekStartsOn}
        units={prefs.units}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
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
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Analytics</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <ConsistencyHeatmapCard workouts={data.workouts} weekStartsOn={prefs.weekStartsOn} />
          </div>
          <RecentWorkoutsCard
            workouts={data.workouts}
            templatesById={data.templatesById}
            includeWarmups={prefs.includeWarmups}
          />
          <HoursTrainedCard workouts={data.workouts} weekStartsOn={prefs.weekStartsOn} />
          <VolumeProgressionCard
            workouts={data.workouts}
            templatesById={data.templatesById}
            weekStartsOn={prefs.weekStartsOn}
            includeWarmups={prefs.includeWarmups}
            units={prefs.units}
          />
          <SetsByGroupCard
            workouts={data.workouts}
            templatesById={data.templatesById}
            weekStartsOn={prefs.weekStartsOn}
            includeWarmups={prefs.includeWarmups}
          />
          <SetsBySubMuscleCard
            workouts={data.workouts}
            templatesById={data.templatesById}
            weekStartsOn={prefs.weekStartsOn}
            includeWarmups={prefs.includeWarmups}
          />
          <WorkoutsPerWeekCard workouts={data.workouts} weekStartsOn={prefs.weekStartsOn} />
          <PrsOverTimeCard workouts={data.workouts} weekStartsOn={prefs.weekStartsOn} includeWarmups={prefs.includeWarmups} />
        </div>
      </div>

      <div>
        <Button variant="ghost" size="sm" className="mb-3 -ml-2.5 text-muted-foreground" onClick={toggleSparklines}>
          {sparklinesExpanded ? <ChevronUp data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
          Per-muscle sparklines
        </Button>
        {sparklinesExpanded && <SparklineGrid series={series} />}
      </div>
    </div>
  );
}
