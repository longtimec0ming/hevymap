// Canonical sub-muscle taxonomy for HevyMap. Single source of truth — see PLAN.md §4.
// Every contribution key anywhere in the codebase (muscle-map.json, inference rules,
// overrides) must be one of the 32 IDs defined here. Coarse groups are forbidden.
//
// v2 (2026-08-18): 26 -> 32 sub-muscles. Added neck, hip_flexors,
// tibialis_anterior, rotator_cuff, serratus_anterior. Split lats into
// lats_upper/lats_lower. Regrouped upper_traps/mid_traps_rhomboids/
// lower_traps (+ the new neck) out of Back into their own Traps region.
// Renamed glute_med's displayName to "Glute Med / Abductors" (id unchanged).
// Region order: Shoulders, Chest, Back, Traps, Arms, Core, Legs.

// ---------------------------------------------------------------------------
// defaultWeeklyTargetSets — how these numbers were derived (2026-08-18)
// ---------------------------------------------------------------------------
// DO NOT "fix" these back up to 10-20 across the board. That was the bug.
//
// These are PER-SUB-MUSCLE FRACTIONAL weekly hard sets (lib/volume.ts), not
// per-muscle-GROUP hard sets. A single set of an exercise splits its credit
// across every sub-muscle it touches (e.g. one incline bench set might be
// 0.55 upper_chest + 0.25 front_delt + 0.20 triceps), so no individual
// sub-muscle accumulates anywhere near a full set's worth of credit per
// working set. The previous defaults (10-20 for every "major" sub-muscle)
// were lifted directly from the hypertrophy literature's per-MUSCLE-GROUP
// range (e.g. "10-20 sets/week for chest") and applied to each individual
// sub-muscle within that group — so even a well-trained 4-day/week routine
// left almost every sub-muscle looking deep in the red.
//
// Rederived by: (1) taking the literature's ~10-20 hard-sets/week/group
// range as the target for each GROUP's total, (2) splitting that total
// across the group's sub-muscles by typical training emphasis (e.g. chest:
// mid > upper > lower; shoulders: side/front > rear; back: lats > mid traps
// > erectors > upper/lower traps; arms: biceps ~= triceps lateral/medial >
// triceps long > brachialis > forearms; legs: vasti > glute max > hamstrings
// > rectus femoris ~= adductors > gastroc > glute med > soleus; core:
// rectus > obliques), and (3) sanity-checking against ~8 weeks of a real,
// consistently-trained account (~3-4 sessions/week) pulled via the Hevy API
// and run through computeVolumeByMuscle — the well-trained sub-muscles in
// that data now land in-band or just under it on a solid week, rather than
// uniformly far below. Composite regions with many sub-muscles (Arms, Legs)
// legitimately sum well above a single group's 10-20, since they fold
// together what the literature treats as 2-4 separate muscle groups.
// Genuinely under-trained sub-muscles (e.g. calves, hamstrings, lower traps,
// in a routine that doesn't isolate them) are still meant to show as
// under-target — that's the neglect radar doing its job, not a bug.
// Rough magnitude bands used: majors ~5-9, secondaries ~3-6, small ~1-4.

export type BodySide = "front" | "back" | "both";

export interface SubMuscle {
  id: string;
  displayName: string;
  region: string;
  bodySide: BodySide;
  /** Weekly hard-set target range, [min, max]. User-editable default. */
  defaultWeeklyTargetSets: [number, number];
}

export const TAXONOMY: readonly SubMuscle[] = [
  // Shoulders
  {
    id: "front_delt",
    displayName: "Front Delt",
    region: "Shoulders",
    bodySide: "front",
    defaultWeeklyTargetSets: [5, 9],
  },
  {
    id: "side_delt",
    displayName: "Side Delt",
    region: "Shoulders",
    bodySide: "both",
    defaultWeeklyTargetSets: [5, 9],
  },
  {
    id: "rear_delt",
    displayName: "Rear Delt",
    region: "Shoulders",
    bodySide: "back",
    defaultWeeklyTargetSets: [4, 7],
  },
  {
    id: "rotator_cuff",
    displayName: "Rotator Cuff",
    region: "Shoulders",
    bodySide: "back",
    defaultWeeklyTargetSets: [1, 3],
  },

  // Chest
  {
    id: "upper_chest",
    displayName: "Upper Chest",
    region: "Chest",
    bodySide: "front",
    defaultWeeklyTargetSets: [2, 4],
  },
  {
    id: "mid_chest",
    displayName: "Mid Chest",
    region: "Chest",
    bodySide: "front",
    defaultWeeklyTargetSets: [3, 6],
  },
  {
    id: "lower_chest",
    displayName: "Lower Chest",
    region: "Chest",
    bodySide: "front",
    defaultWeeklyTargetSets: [1, 2],
  },
  {
    id: "serratus_anterior",
    displayName: "Serratus Anterior",
    region: "Chest",
    bodySide: "front",
    defaultWeeklyTargetSets: [1, 2],
  },

  // Back
  {
    id: "lats_upper",
    displayName: "Upper Lats",
    region: "Back",
    bodySide: "back",
    defaultWeeklyTargetSets: [3, 6],
  },
  {
    id: "lats_lower",
    displayName: "Lower Lats",
    region: "Back",
    bodySide: "back",
    defaultWeeklyTargetSets: [3, 6],
  },
  {
    id: "spinal_erectors",
    displayName: "Spinal Erectors",
    region: "Back",
    bodySide: "back",
    defaultWeeklyTargetSets: [3, 5],
  },

  // Traps
  {
    id: "upper_traps",
    displayName: "Upper Traps",
    region: "Traps",
    bodySide: "both",
    defaultWeeklyTargetSets: [2, 4],
  },
  {
    id: "mid_traps_rhomboids",
    displayName: "Mid Traps / Rhomboids",
    region: "Traps",
    bodySide: "back",
    defaultWeeklyTargetSets: [3, 6],
  },
  {
    id: "lower_traps",
    displayName: "Lower Traps",
    region: "Traps",
    bodySide: "back",
    defaultWeeklyTargetSets: [1, 3],
  },
  {
    id: "neck",
    displayName: "Neck",
    region: "Traps",
    bodySide: "both",
    defaultWeeklyTargetSets: [1, 3],
  },

  // Arms
  {
    id: "biceps",
    displayName: "Biceps",
    region: "Arms",
    bodySide: "front",
    defaultWeeklyTargetSets: [5, 9],
  },
  {
    id: "brachialis_brachioradialis",
    displayName: "Brachialis / Brachioradialis",
    region: "Arms",
    bodySide: "front",
    defaultWeeklyTargetSets: [2, 4],
  },
  {
    id: "triceps_long",
    displayName: "Triceps (Long Head)",
    region: "Arms",
    bodySide: "back",
    defaultWeeklyTargetSets: [3, 6],
  },
  {
    id: "triceps_lat_med",
    displayName: "Triceps (Lateral/Medial Head)",
    region: "Arms",
    bodySide: "back",
    defaultWeeklyTargetSets: [5, 9],
  },
  {
    id: "forearms",
    displayName: "Forearms",
    region: "Arms",
    bodySide: "front",
    defaultWeeklyTargetSets: [2, 4],
  },

  // Core
  {
    id: "rectus_abdominis",
    displayName: "Rectus Abdominis",
    region: "Core",
    bodySide: "front",
    defaultWeeklyTargetSets: [4, 7],
  },
  {
    id: "obliques",
    displayName: "Obliques",
    region: "Core",
    bodySide: "front",
    defaultWeeklyTargetSets: [3, 5],
  },
  {
    id: "hip_flexors",
    displayName: "Hip Flexors",
    region: "Core",
    bodySide: "front",
    defaultWeeklyTargetSets: [1, 3],
  },

  // Legs
  {
    id: "quads_rectus_femoris",
    displayName: "Quads (Rectus Femoris)",
    region: "Legs",
    bodySide: "front",
    defaultWeeklyTargetSets: [2, 4],
  },
  {
    id: "quads_vasti",
    displayName: "Quads (Vasti)",
    region: "Legs",
    bodySide: "front",
    defaultWeeklyTargetSets: [4, 8],
  },
  {
    id: "hamstrings",
    displayName: "Hamstrings",
    region: "Legs",
    bodySide: "back",
    defaultWeeklyTargetSets: [2, 4],
  },
  {
    id: "glute_max",
    displayName: "Glute Max",
    region: "Legs",
    bodySide: "back",
    defaultWeeklyTargetSets: [3, 6],
  },
  {
    id: "glute_med",
    displayName: "Glute Med / Abductors",
    region: "Legs",
    bodySide: "back",
    defaultWeeklyTargetSets: [1, 3],
  },
  {
    id: "adductors",
    displayName: "Adductors",
    region: "Legs",
    bodySide: "front",
    defaultWeeklyTargetSets: [2, 4],
  },
  {
    id: "gastrocnemius",
    displayName: "Gastrocnemius",
    region: "Legs",
    bodySide: "back",
    defaultWeeklyTargetSets: [1, 3],
  },
  {
    id: "soleus",
    displayName: "Soleus",
    region: "Legs",
    bodySide: "back",
    defaultWeeklyTargetSets: [1, 2],
  },
  {
    id: "tibialis_anterior",
    displayName: "Tibialis Anterior",
    region: "Legs",
    bodySide: "front",
    defaultWeeklyTargetSets: [1, 2],
  },
] as const;

export const SUB_MUSCLE_IDS = TAXONOMY.map((m) => m.id) as readonly string[];

export type SubMuscleId = (typeof TAXONOMY)[number]["id"];

export const TAXONOMY_BY_ID: Readonly<Record<string, SubMuscle>> = Object.fromEntries(
  TAXONOMY.map((m) => [m.id, m]),
);

export function isValidSubMuscleId(id: string): id is SubMuscleId {
  return Object.prototype.hasOwnProperty.call(TAXONOMY_BY_ID, id);
}
