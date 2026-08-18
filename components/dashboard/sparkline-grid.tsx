"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import type { WeeklyVolumePoint } from "@/lib/hooks/use-weekly-series";

export interface SparklineGridProps {
  series: WeeklyVolumePoint[];
}

export function SparklineGrid({ series }: SparklineGridProps) {
  const muscleIds = Object.keys(TAXONOMY_BY_ID) as SubMuscleId[];

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Last {series.length} weeks, per sub-muscle</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {muscleIds.map((id) => {
          const data = series.map((point) => ({ sets: point.volume[id].sets }));
          const latest = series[series.length - 1]?.volume[id].sets ?? 0;
          return (
            <Card key={id} className="border-border/70">
              <CardContent className="px-3 py-2">
                <p className="truncate text-xs text-muted-foreground">{TAXONOMY_BY_ID[id].displayName}</p>
                <p className="tabular-nums text-sm font-medium">{latest.toFixed(1)}</p>
                <div className="h-8 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                      <YAxis domain={[0, "auto"]} hide />
                      <Line
                        type="monotone"
                        dataKey="sets"
                        stroke="var(--brand)"
                        strokeWidth={1.75}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
