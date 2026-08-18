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

export function NeglectRadar({ volumeByMuscle, targetBands }: NeglectRadarProps) {
  const neglected = (Object.keys(TAXONOMY_BY_ID) as SubMuscleId[])
    .map((id) => {
      const sets = volumeByMuscle[id].sets;
      const [min] = targetBands[id];
      return { id, sets, min, deficit: min - sets };
    })
    .filter((row) => row.deficit > 0.5)
    .sort((a, b) => b.deficit - a.deficit);

  return (
    <Card className="border-border/70">
      <CardContent className="px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="size-4 text-brand" strokeWidth={1.75} />
          <h2 className="text-sm font-semibold">Neglect radar</h2>
        </div>
        {neglected.length === 0 ? (
          <p className="text-sm text-muted-foreground">Everything is within target this week. Nice work.</p>
        ) : (
          <ul className="space-y-1.5">
            {neglected.slice(0, 8).map((row) => {
              const region = TAXONOMY_BY_ID[row.id].region;
              return (
                <li key={row.id}>
                  <Link
                    href={`/exercises?muscle=${row.id}&group=${encodeURIComponent(region)}`}
                    className="flex items-center justify-between rounded-md px-1.5 py-1 -mx-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <span>{TAXONOMY_BY_ID[row.id].displayName}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.sets.toFixed(1)} sets — {row.deficit.toFixed(1)} below target
                    </span>
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
