"use client";

// Dashboard timeframe selector (PLAN.md §9.1): calendar week / calendar
// month / all-time as a Tabs strip, plus a "Last N days" Select (7/14/30/90)
// and a custom-range popover. The chosen scope is persisted via usePrefs
// (lib/storage.ts Prefs.periodScope); old persisted "rolling7" values still
// resolve correctly since rolling7 is just one of the Select's options.

import { useState } from "react";
import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { DateRange, PeriodKind, PeriodScope } from "@/lib/period";

export interface PeriodSelectorProps {
  scope: PeriodScope;
  onScopeChange: (scope: PeriodScope) => void;
  /** The currently-resolved range, used to seed the custom-range inputs
   * when the popover is opened without an existing custom selection. */
  currentRange: DateRange;
}

type TabKind = "week" | "month" | "allTime";

const TABS: { kind: TabKind; label: string }[] = [
  { kind: "week", label: "This week" },
  { kind: "month", label: "This month" },
  { kind: "allTime", label: "All time" },
];

const ROLLING_KINDS = ["rolling7", "rolling14", "rolling30", "rolling90"] as const;
type RollingKind = (typeof ROLLING_KINDS)[number];

const ROLLING_OPTIONS: { kind: RollingKind; label: string }[] = [
  { kind: "rolling7", label: "Last 7 days" },
  { kind: "rolling14", label: "Last 14 days" },
  { kind: "rolling30", label: "Last 30 days" },
  { kind: "rolling90", label: "Last 90 days" },
];

function isRollingKind(kind: PeriodKind): kind is RollingKind {
  return (ROLLING_KINDS as readonly PeriodKind[]).includes(kind);
}

function toDateInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function PeriodSelector({ scope, onScopeChange, currentRange }: PeriodSelectorProps) {
  const [customStart, setCustomStart] = useState(scope.customStart ?? toDateInputValue(currentRange.start));
  const [customEnd, setCustomEnd] = useState(scope.customEnd ?? toDateInputValue(currentRange.end));
  const [popoverOpen, setPopoverOpen] = useState(false);

  const tabValue = scope.kind === "week" || scope.kind === "month" || scope.kind === "allTime" ? scope.kind : "";
  const rollingValue = isRollingKind(scope.kind) ? scope.kind : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={tabValue}
        onValueChange={(value) => {
          if (!value) return;
          onScopeChange({ kind: value as TabKind });
        }}
      >
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.kind} value={tab.kind}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Select
        value={rollingValue}
        onValueChange={(value) => {
          if (!value) return;
          onScopeChange({ kind: value as RollingKind });
        }}
      >
        <SelectTrigger
          size="sm"
          className={cn(rollingValue && "bg-secondary text-secondary-foreground hover:bg-secondary")}
        >
          <SelectValue placeholder="Last…" />
        </SelectTrigger>
        <SelectContent>
          {ROLLING_OPTIONS.map((option) => (
            <SelectItem key={option.kind} value={option.kind}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
