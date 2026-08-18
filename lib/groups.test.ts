import { describe, expect, it } from "vitest";
import { SUB_MUSCLE_IDS, type SubMuscleId } from "../data/taxonomy";
import { groupVolumeByRegion } from "./groups";
import type { VolumeByMuscle } from "./volume";

function emptyVolume(): VolumeByMuscle {
  const result = {} as VolumeByMuscle;
  for (const id of SUB_MUSCLE_IDS) result[id as SubMuscleId] = { sets: 0, tonnageKg: 0 };
  return result;
}

describe("groupVolumeByRegion", () => {
  it("groups all 32 sub-muscles into 7 regions in taxonomy order", () => {
    const groups = groupVolumeByRegion(emptyVolume());

    expect(groups.map((g) => g.region)).toEqual(["Shoulders", "Chest", "Back", "Traps", "Arms", "Core", "Legs"]);
    const totalChildren = groups.reduce((sum, g) => sum + g.children.length, 0);
    expect(totalChildren).toBe(SUB_MUSCLE_IDS.length);
  });

  it("Shoulders contains exactly front/side/rear delt + rotator cuff", () => {
    const groups = groupVolumeByRegion(emptyVolume());
    const shoulders = groups.find((g) => g.region === "Shoulders")!;
    expect(shoulders.children.map((c) => c.id)).toEqual(["front_delt", "side_delt", "rear_delt", "rotator_cuff"]);
  });

  it("group total is the sum of its children's sets and tonnage", () => {
    const volume = emptyVolume();
    volume.front_delt = { sets: 4, tonnageKg: 400 };
    volume.side_delt = { sets: 6, tonnageKg: 300 };
    volume.rear_delt = { sets: 2, tonnageKg: 100 };

    const groups = groupVolumeByRegion(volume);
    const shoulders = groups.find((g) => g.region === "Shoulders")!;

    expect(shoulders.total).toEqual({ sets: 12, tonnageKg: 800 });
  });

  it("a region with zero volume across all children totals zero", () => {
    const groups = groupVolumeByRegion(emptyVolume());
    const core = groups.find((g) => g.region === "Core")!;
    expect(core.total).toEqual({ sets: 0, tonnageKg: 0 });
  });

  it("every child volume is carried through unchanged", () => {
    const volume = emptyVolume();
    volume.lats_upper = { sets: 8, tonnageKg: 1200 };

    const groups = groupVolumeByRegion(volume);
    const back = groups.find((g) => g.region === "Back")!;
    const lats = back.children.find((c) => c.id === "lats_upper")!;

    expect(lats.volume).toEqual({ sets: 8, tonnageKg: 1200 });
    expect(lats.displayName).toBe("Upper Lats");
  });
});
