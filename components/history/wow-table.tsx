import { Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { groupVolumeByRegion } from "@/lib/groups";
import type { WeeklyVolumePoint } from "@/lib/hooks/use-weekly-series";

export interface WowTableProps {
  currentWeek: WeeklyVolumePoint;
  previousWeek: WeeklyVolumePoint;
}

function deltaClass(delta: number): string {
  return delta > 0 ? "text-brand" : delta < 0 ? "text-muted-foreground" : "";
}

function formatDelta(delta: number): string {
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
}

export function WowTable({ currentWeek, previousWeek }: WowTableProps) {
  const currentGroups = groupVolumeByRegion(currentWeek.volume);
  const previousGroups = groupVolumeByRegion(previousWeek.volume);

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
            {currentGroups.map((group, groupIndex) => {
              const previousTotal = previousGroups[groupIndex].total.sets;
              const groupDelta = group.total.sets - previousTotal;
              return (
                <Fragment key={group.region}>
                  <tr className="border-b border-border/40 bg-muted/40">
                    <td className="px-4 py-2 font-semibold">{group.region}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{group.total.sets.toFixed(1)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-muted-foreground">
                      {previousTotal.toFixed(1)}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold tabular-nums ${deltaClass(groupDelta)}`}>
                      {formatDelta(groupDelta)}
                    </td>
                  </tr>
                  {group.children.map((child, childIndex) => {
                    const previousChild = previousGroups[groupIndex].children[childIndex].volume.sets;
                    const childDelta = child.volume.sets - previousChild;
                    return (
                      <tr key={child.id} className="border-b border-border/40 last:border-0">
                        <td className="py-2 pr-4 pl-8 text-muted-foreground">{child.displayName}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{child.volume.sets.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {previousChild.toFixed(1)}
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums ${deltaClass(childDelta)}`}>
                          {formatDelta(childDelta)}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
