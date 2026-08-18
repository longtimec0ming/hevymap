import { Card, CardContent } from "@/components/ui/card";
import { TAXONOMY_BY_ID, type SubMuscleId } from "@/data/taxonomy";
import type { WeeklyVolumePoint } from "@/lib/hooks/use-weekly-series";

export interface WowTableProps {
  currentWeek: WeeklyVolumePoint;
  previousWeek: WeeklyVolumePoint;
}

export function WowTable({ currentWeek, previousWeek }: WowTableProps) {
  const rows = (Object.keys(TAXONOMY_BY_ID) as SubMuscleId[]).map((id) => {
    const current = currentWeek.volume[id].sets;
    const previous = previousWeek.volume[id].sets;
    return { id, current, previous, delta: current - previous };
  });

  return (
    <Card className="border-border/70">
      <CardContent className="overflow-x-auto px-0 py-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Sub-muscle</th>
              <th className="px-4 py-2 font-medium text-right">This week</th>
              <th className="px-4 py-2 font-medium text-right">Last week</th>
              <th className="px-4 py-2 font-medium text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2">{TAXONOMY_BY_ID[row.id].displayName}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.current.toFixed(1)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{row.previous.toFixed(1)}</td>
                <td
                  className={`px-4 py-2 text-right tabular-nums ${
                    row.delta > 0 ? "text-brand" : row.delta < 0 ? "text-muted-foreground" : ""
                  }`}
                >
                  {row.delta > 0 ? "+" : ""}
                  {row.delta.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
