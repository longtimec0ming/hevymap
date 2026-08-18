"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { groupVolumeByRegion, type RegionGroupVolume } from "@/lib/groups";
import type { WeeklyVolumePoint } from "@/lib/hooks/use-weekly-series";

export interface TrendGridProps {
  series: WeeklyVolumePoint[];
}

function weekLabel(point: WeeklyVolumePoint): string {
  return point.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TrendCard({ label, data, href }: { label: string; data: { week: string; sets: number }[]; href?: string }) {
  return (
    <Card className="border-border/70">
      <CardContent className="px-4 py-3">
        <p className="group/label mb-1 flex items-center gap-1 text-sm font-medium">
          {label}
          {href && (
            <Link
              href={href}
              className="opacity-0 transition-opacity group-hover/label:opacity-100"
              aria-label={`Find exercises that train ${label}`}
            >
              <ArrowUpRight className="size-3.5 text-muted-foreground" />
            </Link>
          )}
        </p>
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                }}
                formatter={(value) => [typeof value === "number" ? value.toFixed(1) : String(value), "sets"]}
              />
              <Line type="monotone" dataKey="sets" stroke="var(--brand)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrendGrid({ series }: TrendGridProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Every week's volume grouped by region, so both the group-level overview
  // and a drilled-in group's sub-muscles can pull from the same computation.
  const groupedSeries: RegionGroupVolume[][] = useMemo(
    () => series.map((point) => groupVolumeByRegion(point.volume)),
    [series],
  );
  const regions = groupedSeries[0]?.map((g) => g.region) ?? [];

  const groupData = regions.map((region) => ({
    region,
    data: groupedSeries.map((weekGroups, i) => ({
      week: weekLabel(series[i]),
      sets: weekGroups.find((g) => g.region === region)?.total.sets ?? 0,
    })),
  }));

  const activeChildren = selectedRegion
    ? (groupedSeries[groupedSeries.length - 1]?.find((g) => g.region === selectedRegion)?.children ?? [])
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Button variant={selectedRegion === null ? "secondary" : "outline"} size="xs" onClick={() => setSelectedRegion(null)}>
          All groups
        </Button>
        {regions.map((region) => (
          <Button
            key={region}
            variant={selectedRegion === region ? "secondary" : "outline"}
            size="xs"
            onClick={() => setSelectedRegion(region)}
          >
            {region}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {selectedRegion === null
          ? groupData.map((g) => <TrendCard key={g.region} label={g.region} data={g.data} />)
          : activeChildren.map((child) => {
              const data = groupedSeries.map((weekGroups, i) => ({
                week: weekLabel(series[i]),
                sets: weekGroups.find((g) => g.region === selectedRegion)?.children.find((c) => c.id === child.id)?.volume.sets ?? 0,
              }));
              const href = `/exercises?muscle=${child.id}&group=${encodeURIComponent(selectedRegion)}`;
              return <TrendCard key={child.id} label={child.displayName} data={data} href={href} />;
            })}
      </div>
    </div>
  );
}
