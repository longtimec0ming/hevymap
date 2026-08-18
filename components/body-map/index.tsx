"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { SUB_MUSCLE_IDS, TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import { formatWeight } from "@/lib/units";
import type { VolumeByMuscle } from "@/lib/volume";
import { getMuscleStatus, type MuscleStatus, type TargetBand } from "./color-scale";
import { Figure } from "./Figure";
import { Legend } from "./Legend";

export interface BodyMapProps {
  volumeByMuscle: VolumeByMuscle;
  view?: "front" | "back" | "both";
  targetBands?: Partial<Record<SubMuscleId, [number, number]>>;
  highlightedMuscleId?: SubMuscleId | null;
  onMuscleClick?: (muscleId: SubMuscleId) => void;
  onMuscleHover?: (muscleId: SubMuscleId | null) => void;
  units?: "kg" | "lbs";
  className?: string;
}

interface TooltipState {
  muscleId: SubMuscleId;
  x: number;
  y: number;
}

function formatSets(sets: number): string {
  return sets.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function BodyMap({
  volumeByMuscle,
  view = "both",
  targetBands,
  highlightedMuscleId = null,
  onMuscleClick,
  onMuscleHover,
  units = "kg",
  className,
}: BodyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredMuscleId, setHoveredMuscleId] = useState<SubMuscleId | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const statusByMuscle = useMemo(() => {
    const result = {} as Record<SubMuscleId, MuscleStatus>;
    for (const id of SUB_MUSCLE_IDS as SubMuscleId[]) {
      const taxon = TAXONOMY_BY_ID[id];
      const volume = volumeByMuscle[id];
      const band: TargetBand = targetBands?.[id] ?? taxon.defaultWeeklyTargetSets;
      result[id] = getMuscleStatus(volume?.sets ?? 0, volume?.tonnageKg ?? 0, band);
    }
    return result;
  }, [volumeByMuscle, targetBands]);

  const activeMuscleId = highlightedMuscleId ?? hoveredMuscleId;

  const handleHover = (muscleId: SubMuscleId | null) => {
    setHoveredMuscleId(muscleId);
    onMuscleHover?.(muscleId);
  };

  const handleFocus = (
    muscleId: SubMuscleId | null,
    event?: MouseEvent<SVGElement> | KeyboardEvent<SVGElement>,
  ) => {
    if (!muscleId) {
      setTooltip(null);
      return;
    }
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    let x: number;
    let y: number;
    if (event && "clientX" in event) {
      x = event.clientX - containerRect.left;
      y = event.clientY - containerRect.top;
    } else {
      // Keyboard focus: anchor the tooltip near the top of the container
      // rather than a stale/absent pointer position.
      x = containerRect.width / 2;
      y = 24;
    }
    setTooltip({ muscleId, x, y });
  };

  const activeTaxon = tooltip ? TAXONOMY_BY_ID[tooltip.muscleId] : undefined;
  const activeStatus = tooltip ? statusByMuscle[tooltip.muscleId] : undefined;

  const showFront = view === "front" || view === "both";
  const showBack = view === "back" || view === "both";

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center sm:gap-4">
        {showFront && (
          <div className="flex w-full max-w-[300px] flex-col items-center gap-2">
            <Figure
              view="front"
              statusByMuscle={statusByMuscle}
              highlightedMuscleId={activeMuscleId}
              onMuscleClick={onMuscleClick}
              onMuscleHover={handleHover}
              onMuscleFocus={handleFocus}
            />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Front</span>
          </div>
        )}
        {showBack && (
          <div className="flex w-full max-w-[300px] flex-col items-center gap-2">
            <Figure
              view="back"
              statusByMuscle={statusByMuscle}
              highlightedMuscleId={activeMuscleId}
              onMuscleClick={onMuscleClick}
              onMuscleHover={handleHover}
              onMuscleFocus={handleFocus}
            />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Back</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <Legend />
      </div>

      {tooltip && activeTaxon && activeStatus && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-100 shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y - 10 }}
          role="status"
        >
          <div className="font-medium">{activeTaxon.displayName}</div>
          <div className="mt-1 tabular-nums text-zinc-300">
            {formatSets(activeStatus.sets)} sets · {formatWeight(activeStatus.tonnageKg, units)}
          </div>
          <div className="tabular-nums text-zinc-300">{activeStatus.percentOfTarget}% of target</div>
        </div>
      )}
    </div>
  );
}
