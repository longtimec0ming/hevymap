"use client";

// Per-exercise contribution editor (PLAN.md §6). Works for standard repo-map
// exercises and custom exercises alike — both resolve through
// lib/overrides.ts, which is the only thing this component writes to.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import { InvalidOverrideError, removeOverride, setOverride, type ContributionMap } from "@/lib/overrides";
import { cn } from "@/lib/utils";

export interface MappingEditorProps {
  exerciseId: string;
  exerciseName: string;
  initialContributions: ContributionMap;
  hasOverride: boolean;
  onSaved?: () => void;
  /** Fired on every edit (not just save) with the current, possibly-invalid
   * contribution split — feeds the live body-map preview. */
  onChange?: (contributions: ContributionMap) => void;
}

interface Row {
  id: SubMuscleId;
  percent: number;
}

function toRows(contributions: ContributionMap): Row[] {
  return (Object.entries(contributions) as [SubMuscleId, number][])
    .filter(([, fraction]) => fraction > 0)
    .map(([id, fraction]) => ({ id, percent: Math.round(fraction * 1000) / 10 }));
}

export function MappingEditor({
  exerciseId,
  exerciseName,
  initialContributions,
  hasOverride,
  onSaved,
  onChange,
}: MappingEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialContributions));
  const [addId, setAddId] = useState<string>("");

  const sum = rows.reduce((total, row) => total + row.percent, 0);
  const isValid = rows.length > 0 && Math.abs(sum - 100) <= 0.1;

  useEffect(() => {
    const contributions: ContributionMap = {};
    for (const row of rows) {
      if (row.percent > 0) contributions[row.id] = row.percent / 100;
    }
    onChange?.(contributions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const availableToAdd = useMemo(() => {
    const used = new Set(rows.map((r) => r.id));
    return (Object.keys(TAXONOMY_BY_ID) as SubMuscleId[]).filter((id) => !used.has(id));
  }, [rows]);

  const updatePercent = (id: SubMuscleId, percent: number) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, percent } : row)));
  };

  const removeRow = (id: SubMuscleId) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const addRow = () => {
    if (!addId) return;
    setRows((prev) => [...prev, { id: addId as SubMuscleId, percent: 0 }]);
    setAddId("");
  };

  const handleSave = () => {
    const contributions: ContributionMap = {};
    for (const row of rows) {
      if (row.percent > 0) contributions[row.id] = row.percent / 100;
    }
    try {
      setOverride(exerciseId, contributions);
      toast.success(`Saved mapping for ${exerciseName}`);
      onSaved?.();
    } catch (error) {
      if (error instanceof InvalidOverrideError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to save mapping");
      }
    }
  };

  const handleReset = () => {
    removeOverride(exerciseId);
    toast(`Reverted ${exerciseName} to the default mapping`);
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p
          className={cn(
            "text-sm tabular-nums",
            isValid ? "text-muted-foreground" : "text-destructive font-medium",
          )}
        >
          Sum: {sum.toFixed(1)}% {isValid ? "✓" : "— must equal 100%"}
        </p>
      </div>

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm">{TAXONOMY_BY_ID[row.id].displayName}</span>
            <Slider
              value={[row.percent]}
              min={0}
              max={100}
              step={1}
              onValueChange={(value) => updatePercent(row.id, Array.isArray(value) ? value[0] : value)}
              className="flex-1"
            />
            <span className="w-14 shrink-0 text-right text-sm tabular-nums">{row.percent.toFixed(0)}%</span>
            <Button variant="ghost" size="sm" onClick={() => removeRow(row.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>

      {availableToAdd.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={addId} onValueChange={(value) => setAddId(value ?? "")}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Add a sub-muscle…" />
            </SelectTrigger>
            <SelectContent>
              {availableToAdd.map((id) => (
                <SelectItem key={id} value={id}>
                  {TAXONOMY_BY_ID[id].displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={addRow} disabled={!addId}>
            Add
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={handleSave} disabled={!isValid}>
          Save mapping
        </Button>
        {hasOverride && (
          <Button variant="outline" onClick={handleReset}>
            Reset to default
          </Button>
        )}
      </div>
    </div>
  );
}
