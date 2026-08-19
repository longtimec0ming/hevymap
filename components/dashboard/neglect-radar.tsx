import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import type { TargetBand } from "@/lib/targets";
import type { VolumeByMuscle } from "@/lib/volume";

export interface NeglectRadarProps {
  volumeByMuscle: VolumeByMuscle;
  targetBands: Record<SubMuscleId, TargetBand>;
}

/** Formats a target-band endpoint: one decimal place, trailing ".0"
 * stripped when the value is whole (bands are pro-rated so they aren't
 * always whole numbers). */
function formatBandValue(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

export function NeglectRadar({ volumeByMuscle, targetBands }: NeglectRadarProps) {
  const neglected = (Object.keys(TAXONOMY_BY_ID) as SubMuscleId[])
    .map((id) => {
      const sets = volumeByMuscle[id].sets;
      const [min, max] = targetBands[id];
      return { id, sets, min, max, deficit: min - sets };
    })
    .filter((row) => row.deficit > 0.5)
    .sort((a, b) => b.deficit - a.deficit);

  return (
    <Card className="border-border/70">
      <CardContent className="px-4 py-4">
        <div className="mb-1 flex items-center gap-2">
          <AlertTriangle className="size-4 text-brand" strokeWidth={1.75} />
          <h2 className="text-sm font-semibold">Neglect radar</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Sub-muscles below the minimum of their target band for this period.
        </p>
        {neglected.length === 0 ? (
          <p className="text-sm text-muted-foreground">Everything is within target this week. Nice work.</p>
        ) : (
          <ul className="space-y-2">
            {neglected.slice(0, 8).map((row) => {
              const region = TAXONOMY_BY_ID[row.id].region;
              const fillPercent = Math.min(100, row.min > 0 ? (row.sets / row.min) * 100 : 0);
              return (
                <li key={row.id}>
                  <Link
                    href={`/exercises?muscle=${row.id}&group=${encodeURIComponent(region)}`}
                    className="block rounded-md px-1.5 py-1 -mx-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span>{TAXONOMY_BY_ID[row.id].displayName}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.sets.toFixed(1)} / {formatBandValue(row.min)}–{formatBandValue(row.max)} sets
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-muted">
                      <div className="h-1 rounded-full bg-brand" style={{ width: `${fillPercent}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
