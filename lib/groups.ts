// Groups the 26 canonical sub-muscles under their coarse `region` (see
// data/taxonomy.ts) for the two-level hierarchy used in History and
// Workouts (History/Workouts pages must not list all 26 sub-muscles flat).
// Single shared helper so both pages group identically instead of
// duplicating the logic.

import { TAXONOMY, type SubMuscleId } from "../data/taxonomy";
import type { MuscleVolume, VolumeByMuscle } from "./volume";

export interface GroupChildVolume {
  id: SubMuscleId;
  displayName: string;
  volume: MuscleVolume;
}

export interface RegionGroupVolume {
  /** Coarse region name, e.g. "Shoulders". */
  region: string;
  /** Sum of every child's sets/tonnage. */
  total: MuscleVolume;
  /** Sub-muscles in this region, in taxonomy order. */
  children: GroupChildVolume[];
}

function emptyMuscleVolume(): MuscleVolume {
  return { sets: 0, tonnageKg: 0 };
}

/** Region display order, derived from each region's first appearance in
 * TAXONOMY (Shoulders, Chest, Back, Arms, Core, Legs) rather than
 * hardcoded, so it can't drift from the taxonomy's own ordering. */
function regionOrder(): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const m of TAXONOMY) {
    if (!seen.has(m.region)) {
      seen.add(m.region);
      order.push(m.region);
    }
  }
  return order;
}

/** Groups a VolumeByMuscle into ordered coarse regions, each with its
 * children (in taxonomy order) and a summed group total (sets + tonnage). */
export function groupVolumeByRegion(volumeByMuscle: VolumeByMuscle): RegionGroupVolume[] {
  return regionOrder().map((region) => {
    const members = TAXONOMY.filter((m) => m.region === region);
    const children: GroupChildVolume[] = members.map((m) => ({
      id: m.id as SubMuscleId,
      displayName: m.displayName,
      volume: volumeByMuscle[m.id as SubMuscleId] ?? emptyMuscleVolume(),
    }));
    const total = children.reduce<MuscleVolume>(
      (acc, child) => ({ sets: acc.sets + child.volume.sets, tonnageKg: acc.tonnageKg + child.volume.tonnageKg }),
      emptyMuscleVolume(),
    );
    return { region, total, children };
  });
}
