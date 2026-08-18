"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import { getTargetOverrides, resetTargetOverride, setTargetOverride, type TargetBand } from "@/lib/targets";

export function TargetEditor() {
  const [overrides, setOverrides] = useState(() => getTargetOverrides());

  const muscleIds = Object.keys(TAXONOMY_BY_ID) as SubMuscleId[];

  const bandFor = (id: SubMuscleId): TargetBand => overrides[id] ?? TAXONOMY_BY_ID[id].defaultWeeklyTargetSets;

  const update = (id: SubMuscleId, index: 0 | 1, value: number) => {
    const current = bandFor(id);
    const next: TargetBand = index === 0 ? [value, current[1]] : [current[0], value];
    setOverrides(setTargetOverride(id, next));
  };

  const reset = (id: SubMuscleId) => {
    setOverrides(resetTargetOverride(id));
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">Sub-muscle</th>
            <th className="px-4 py-2 font-medium">Min sets/wk</th>
            <th className="px-4 py-2 font-medium">Max sets/wk</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {muscleIds.map((id) => {
            const [min, max] = bandFor(id);
            const isOverridden = id in overrides;
            return (
              <tr key={id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2">{TAXONOMY_BY_ID[id].displayName}</td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    value={min}
                    onChange={(e) => update(id, 0, Number(e.target.value))}
                    className="w-20 tabular-nums"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    value={max}
                    onChange={(e) => update(id, 1, Number(e.target.value))}
                    className="w-20 tabular-nums"
                  />
                </td>
                <td className="px-4 py-2">
                  {isOverridden && (
                    <Button variant="ghost" size="sm" onClick={() => reset(id)}>
                      <RotateCcw className="size-3.5" /> Reset
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
