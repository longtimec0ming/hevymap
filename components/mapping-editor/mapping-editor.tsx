"use client";

// Per-exercise contribution editor (PLAN.md §6). Works for standard repo-map
// exercises and custom exercises alike — both resolve through
// lib/overrides.ts, which is the only thing this component writes to.
//
// Sliders auto-rebalance through lib/rebalance.ts so the total displayed
// here is always 100.0% — there is no "sum must equal 100%" validation gate
// on Save the way there used to be, because the total can no longer drift.

import { useMemo, useState } from "react";
import { Lock, Unlock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TAXONOMY, TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import { InvalidOverrideError, removeOverride, setOverride, type ContributionMap } from "@/lib/overrides";
import { rebalance } from "@/lib/rebalance";
import { cn } from "@/lib/utils";

export interface MappingEditorProps {
  exerciseId: string;
  exerciseName: string;
  initialContributions: ContributionMap;
  hasOverride: boolean;
  onSaved?: () => void;
  /** Fired on every edit (not just save) with the current contribution
   * split — feeds the live body-map preview. */
  onChange?: (contributions: ContributionMap) => void;
}

const REGIONS: string[] = [...new Set(TAXONOMY.map((m) => m.region))];
const ALL_IDS = TAXONOMY.map((m) => m.id) as SubMuscleId[];
const ZERO_EPSILON = 1e-6;

function sparseFrom(values: Partial<Record<SubMuscleId, number>>): ContributionMap {
  const contributions: ContributionMap = {};
  for (const [id, fraction] of Object.entries(values) as [SubMuscleId, number][]) {
    if (fraction > ZERO_EPSILON) contributions[id] = fraction;
  }
  return contributions;
}

export function MappingEditor({
  exerciseId,
  exerciseName,
  initialContributions,
  hasOverride,
  onSaved,
  onChange,
}: MappingEditorProps) {
  const [values, setValues] = useState<Partial<Record<SubMuscleId, number>>>(() => ({
    ...initialContributions,
  }));
  const [pinned, setPinned] = useState<Set<SubMuscleId>>(
    () => new Set((Object.entries(initialContributions) as [SubMuscleId, number][])
      .filter(([, fraction]) => fraction > ZERO_EPSILON)
      .map(([id]) => id)),
  );
  const [locked, setLocked] = useState<Set<SubMuscleId>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [addId, setAddId] = useState<string>("");

  const visibleIds = useMemo(
    () => (showAll ? ALL_IDS : ALL_IDS.filter((id) => pinned.has(id))),
    [showAll, pinned],
  );

  const total = useMemo(
    () => Object.values(values).reduce((sum: number, v) => sum + (v ?? 0), 0),
    [values],
  );

  const notifyChange = (next: Partial<Record<SubMuscleId, number>>) => {
    onChange?.(sparseFrom(next));
  };

  const applyEdit = (changedId: SubMuscleId, newValue: number) => {
    const pool: Record<SubMuscleId, number> = {} as Record<SubMuscleId, number>;
    for (const id of visibleIds) pool[id] = values[id] ?? 0;

    const nextPool = rebalance(pool, changedId, newValue, locked);

    const nextValues = { ...values, ...nextPool };
    setValues(nextValues);
    setPinned((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if ((nextPool[id] ?? 0) > ZERO_EPSILON) next.add(id);
      }
      return next;
    });
    notifyChange(nextValues);
  };

  const toggleLock = (id: SubMuscleId) => {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeRow = (id: SubMuscleId) => {
    applyEdit(id, 0);
    setPinned((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setLocked((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const addRow = () => {
    if (!addId) return;
    setPinned((prev) => new Set(prev).add(addId as SubMuscleId));
    setAddId("");
  };

  const availableToAdd = useMemo(
    () => ALL_IDS.filter((id) => !pinned.has(id)),
    [pinned],
  );

  const handleSave = () => {
    const contributions = sparseFrom(values);
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

  const isValid = total > ZERO_EPSILON && Math.abs(total - 1) <= 0.005;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-xs tabular-nums",
            isValid ? "text-muted-foreground" : "text-destructive font-medium",
          )}
        >
          Total: {(total * 100).toFixed(1)}%
        </p>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Switch size="sm" checked={showAll} onCheckedChange={(checked) => setShowAll(checked)} />
          Show all 26
        </label>
      </div>

      <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
        {REGIONS.map((region) => {
          const regionIds = ALL_IDS.filter((id) => TAXONOMY_BY_ID[id].region === region && visibleIds.includes(id));
          if (regionIds.length === 0) return null;
          const sortedIds = [...regionIds].sort((a, b) => (values[b] ?? 0) - (values[a] ?? 0));

          return (
            <div key={region}>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {region}
              </p>
              <ul className="space-y-1.5">
                {sortedIds.map((id) => {
                  const percent = (values[id] ?? 0) * 100;
                  const isLocked = locked.has(id);
                  return (
                    <li key={id} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-xs">{TAXONOMY_BY_ID[id].displayName}</span>
                      <Slider
                        value={[percent]}
                        min={0}
                        max={100}
                        step={1}
                        disabled={isLocked}
                        onValueChange={(value) => applyEdit(id, (Array.isArray(value) ? value[0] : value) / 100)}
                        className="flex-1"
                      />
                      <span className="w-12 shrink-0 text-right text-xs tabular-nums">{percent.toFixed(0)}%</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0"
                        onClick={() => toggleLock(id)}
                        title={isLocked ? "Unlock (allow rebalancing)" : "Lock (pin this value)"}
                      >
                        {isLocked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5 opacity-40" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0"
                        onClick={() => removeRow(id)}
                        title="Remove"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {availableToAdd.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={addId} onValueChange={(value) => setAddId(value ?? "")}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="+ add muscle…" />
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

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={!isValid}>
          Save mapping
        </Button>
        {hasOverride && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            Reset to repo default
          </Button>
        )}
      </div>
    </div>
  );
}
