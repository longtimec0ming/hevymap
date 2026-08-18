"use client";

// Shared shell for the dashboard's per-card analytics charts: a title/
// subtitle header plus independent range (ALL/1Y/6M/3M/1M) and bucket
// (WK/MO) pill controls, persisted per-card via lib/dashboard-prefs.ts.
// Each chart card (hours-trained-card.tsx, volume-progression-card.tsx,
// etc) wraps this and renders its own Recharts content via the render-prop
// `children`, so it can compute its series against the resolved prefs.

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  getChartPrefs,
  setChartPrefs,
  type ChartBucket,
  type ChartId,
  type ChartPrefs,
  type ChartRange,
} from "@/lib/dashboard-prefs";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "1y", label: "1Y" },
  { value: "6m", label: "6M" },
  { value: "3m", label: "3M" },
  { value: "1m", label: "1M" },
];

const BUCKET_OPTIONS: { value: ChartBucket; label: string }[] = [
  { value: "week", label: "WK" },
  { value: "month", label: "MO" },
];

export interface ChartCardProps {
  id: ChartId;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Some cards (the consistency heatmap) are fixed to a 12-month window and
   * don't take a range/bucket selection at all. */
  showControls?: boolean;
  showBucketToggle?: boolean;
  children: (prefs: ChartPrefs) => ReactNode;
}

function PillGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums tracking-wide transition-colors",
            value === opt.value
              ? "bg-brand text-brand-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Shared empty state for a chart card with no data in the selected range —
 * designed rather than a blank plot area. */
export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border/70 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function ChartCard({
  id,
  icon: Icon,
  title,
  subtitle,
  showControls = true,
  showBucketToggle = true,
  children,
}: ChartCardProps) {
  const [prefs, setPrefsState] = useState<ChartPrefs>(() => getChartPrefs(id));

  const update = (patch: Partial<ChartPrefs>) => setPrefsState(setChartPrefs(id, patch));

  return (
    <Card className="border-border/70">
      <CardContent className="px-4 py-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-brand" strokeWidth={1.75} />
            <div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {showControls && (
            <div className="flex flex-col items-end gap-1.5">
              <PillGroup value={prefs.range} onChange={(range) => update({ range })} options={RANGE_OPTIONS} />
              {showBucketToggle && (
                <PillGroup value={prefs.bucket} onChange={(bucket) => update({ bucket })} options={BUCKET_OPTIONS} />
              )}
            </div>
          )}
        </div>
        {children(prefs)}
      </CardContent>
    </Card>
  );
}
