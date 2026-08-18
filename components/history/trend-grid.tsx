"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import type { WeeklyVolumePoint } from "@/lib/hooks/use-weekly-series";

export interface TrendGridProps {
  series: WeeklyVolumePoint[];
}

function weekLabel(point: WeeklyVolumePoint): string {
  return point.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TrendGrid({ series }: TrendGridProps) {
  const muscleIds = Object.keys(TAXONOMY_BY_ID) as SubMuscleId[];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {muscleIds.map((id) => {
        const data = series.map((point) => ({ week: weekLabel(point), sets: point.volume[id].sets }));
        return (
          <Card key={id} className="border-border/70">
            <CardContent className="px-4 py-3">
              <p className="mb-1 text-sm font-medium">{TAXONOMY_BY_ID[id].displayName}</p>
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
      })}
    </div>
  );
}
