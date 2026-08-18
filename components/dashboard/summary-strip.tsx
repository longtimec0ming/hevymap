import { Card, CardContent } from "@/components/ui/card";
import { TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import { formatWeight } from "@/lib/units";
import type { VolumeByMuscle } from "@/lib/volume";

export interface SummaryStripProps {
  volumeByMuscle: VolumeByMuscle;
  previousVolumeByMuscle: VolumeByMuscle;
  sessionCount: number;
  units?: "kg" | "lbs";
}

function totals(volume: VolumeByMuscle) {
  let sets = 0;
  let tonnageKg = 0;
  for (const v of Object.values(volume)) {
    sets += v.sets;
    tonnageKg += v.tonnageKg;
  }
  return { sets, tonnageKg };
}

function biggestMover(current: VolumeByMuscle, previous: VolumeByMuscle) {
  let bestId: SubMuscleId | null = null;
  let bestDelta = 0;
  for (const id of Object.keys(TAXONOMY_BY_ID) as SubMuscleId[]) {
    const delta = current[id].sets - previous[id].sets;
    if (Math.abs(delta) > Math.abs(bestDelta)) {
      bestDelta = delta;
      bestId = id;
    }
  }
  return { id: bestId, delta: bestDelta };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/70">
      <CardContent className="px-4 py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export function SummaryStrip({ volumeByMuscle, previousVolumeByMuscle, sessionCount, units = "kg" }: SummaryStripProps) {
  const { sets, tonnageKg } = totals(volumeByMuscle);
  const mover = biggestMover(volumeByMuscle, previousVolumeByMuscle);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Hard sets" value={sets.toFixed(1)} />
      <Stat label="Sessions" value={String(sessionCount)} />
      <Stat label="Tonnage" value={formatWeight(tonnageKg, units)} />
      <Stat
        label="Biggest mover"
        value={
          mover.id
            ? `${TAXONOMY_BY_ID[mover.id].displayName} ${mover.delta > 0 ? "+" : ""}${mover.delta.toFixed(1)}`
            : "—"
        }
      />
    </div>
  );
}
