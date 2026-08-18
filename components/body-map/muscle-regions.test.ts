// The body map is only honest if every sub-muscle the taxonomy claims exists
// actually renders. A taxonomy change that adds or re-sides an id must fail
// here rather than silently drawing nothing.

import { describe, expect, it } from "vitest";
// Relative, not "@/": vitest.config.mts sets no path alias (muscle-regions.ts
// only ever imports taxonomy types, which are erased before vitest sees them).
import { TAXONOMY, isValidSubMuscleId } from "../../data/taxonomy";
import { BACK_ART, FRONT_ART } from "./muscle-regions";

const VIEWS = [
  { view: "front" as const, art: FRONT_ART },
  { view: "back" as const, art: BACK_ART },
];

describe("body map region coverage", () => {
  for (const { view, art } of VIEWS) {
    const ids = art.regions.map((region) => region.id);

    it(`${view}: renders exactly the sub-muscles whose bodySide includes it`, () => {
      const expected = TAXONOMY.filter((m) => m.bodySide === view || m.bodySide === "both").map(
        (m) => m.id,
      );
      expect([...ids].sort()).toEqual([...expected].sort());
    });

    it(`${view}: has no duplicate or unknown muscle ids`, () => {
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(isValidSubMuscleId(id)).toBe(true);
    });

    it(`${view}: every region draws at least one non-empty path`, () => {
      for (const region of art.regions) {
        expect(region.shapes.length).toBeGreaterThan(0);
        for (const d of region.shapes) expect(d.startsWith("M")).toBe(true);
      }
    });
  }
});
