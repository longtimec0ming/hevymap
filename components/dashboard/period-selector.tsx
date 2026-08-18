"use client";

// Dashboard timeframe selector (PLAN.md §9.1): rolling 7 days / calendar
// week / calendar month / custom range / all-time. Presets are a Tabs
// strip; custom range is a date-range popover with two native date inputs.
// The chosen scope is persisted via usePrefs (lib/storage.ts Prefs.periodScope).

import { useState } from "react";
import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DateRange, PeriodKind, PeriodScope } from "@/lib/period";

export interface PeriodSelectorProps {
  scope: PeriodScope;
  onScopeChange: (scope: PeriodScope) => void;
  /** The currently-resolved range, used to seed the custom-range inputs
   * when the popover is opened without an existing custom selection. */
  currentRange: DateRange;
}

const PRESETS: { kind: Exclude<PeriodKind, "custom">; label: string }[] = [
  { kind: "rolling7", label: "7 days" },
  { kind: "week", label: "This week" },
  { kind: "month", label: "This month" },
  { kind: "allTime", label: "All time" },
];

function toDateInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function PeriodSelector({ scope, onScopeChange, currentRange }: PeriodSelectorProps) {
  const [customStart, setCustomStart] = useState(scope.customStart ?? toDateInputValue(currentRange.start));
  const [customEnd, setCustomEnd] = useState(scope.customEnd ?? toDateInputValue(currentRange.end));
  const [popoverOpen, setPopoverOpen] = useState(false);

  const presetValue = scope.kind === "custom" ? "" : scope.kind;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={presetValue}
        onValueChange={(value) => {
          if (!value) return;
          onScopeChange({ kind: value as Exclude<PeriodKind, "custom"> });
        }}
      >
        <TabsList>
          {PRESETS.map((preset) => (
            <TabsTrigger key={preset.kind} value={preset.kind}>
              {preset.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          render={
            <Button variant={scope.kind === "custom" ? "secondary" : "outline"} size="sm">
              <CalendarRange data-icon="inline-start" />
              {scope.kind === "custom" && scope.customStart && scope.customEnd
                ? `${scope.customStart} – ${scope.customEnd}`
                : "Custom"}
            </Button>
          }
        />
        <PopoverContent className="w-auto">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                From
                <input
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                To
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
            </div>
            <Button
              size="sm"
              onClick={() => {
                onScopeChange({ kind: "custom", customStart, customEnd });
                setPopoverOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
