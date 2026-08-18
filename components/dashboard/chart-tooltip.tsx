"use client";

// Shared Recharts tooltip content for every dashboard chart card, so
// tooltips read as one system instead of Recharts' unstyled default box.
// Props are intentionally loose/optional — Recharts clones this element at
// render time and injects active/payload/label itself (the standard
// `content={<ChartTooltip .../>}` pattern), so this component's own JSX
// usage never provides them directly.

export interface ChartTooltipPayloadEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  fill?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly ChartTooltipPayloadEntry[];
  label?: string | number;
  formatValue?: (value: number, name: string) => string;
}

export function ChartTooltip({ active, payload, label, formatValue }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-medium text-popover-foreground">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((entry, i) => {
          const name = String(entry.name ?? entry.dataKey ?? "");
          const value = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
          return (
            <p key={`${name}-${i}`} className="flex items-center gap-1.5">
              <span className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color ?? entry.fill }} />
              <span className="text-muted-foreground">{name}</span>
              <span className="ml-auto tabular-nums text-popover-foreground">
                {formatValue ? formatValue(value, name) : value.toLocaleString()}
              </span>
            </p>
          );
        })}
      </div>
    </div>
  );
}
