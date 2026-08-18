// Canonical sub-muscle taxonomy for HevyMap. Single source of truth — see PLAN.md §4.
// Every contribution key anywhere in the codebase (muscle-map.json, inference rules,
// overrides) must be one of the 26 IDs defined here. Coarse groups are forbidden.

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
    defaultWeeklyTargetSets: [6, 12],
  },
  {
    id: "side_delt",
    displayName: "Side Delt",
    region: "Shoulders",
    bodySide: "both",
    defaultWeeklyTargetSets: [10, 20],
  },
  {
    id: "rear_delt",
    displayName: "Rear Delt",
    region: "Shoulders",
    bodySide: "back",
    defaultWeeklyTargetSets: [8, 16],
  },

  // Chest
  {
    id: "upper_chest",
    displayName: "Upper Chest",
    region: "Chest",
    bodySide: "front",
    defaultWeeklyTargetSets: [8, 16],
  },
  {
    id: "mid_chest",
    displayName: "Mid Chest",
    region: "Chest",
    bodySide: "front",
    defaultWeeklyTargetSets: [10, 20],
  },
  {
    id: "lower_chest",
    displayName: "Lower Chest",
    region: "Chest",
    bodySide: "front",
    defaultWeeklyTargetSets: [6, 12],
  },

  // Back
  {
    id: "lats",
    displayName: "Lats",
    region: "Back",
    bodySide: "back",
    defaultWeeklyTargetSets: [10, 20],
  },
  {
    id: "upper_traps",
    displayName: "Upper Traps",
    region: "Back",
    bodySide: "back",
    defaultWeeklyTargetSets: [6, 12],
  },
  {
    id: "mid_traps_rhomboids",
    displayName: "Mid Traps / Rhomboids",
    region: "Back",
    bodySide: "back",
    defaultWeeklyTargetSets: [8, 16],
  },
  {
    id: "lower_traps",
    displayName: "Lower Traps",
    region: "Back",
    bodySide: "back",
    defaultWeeklyTargetSets: [4, 8],
  },
  {
    id: "spinal_erectors",
    displayName: "Spinal Erectors",
    region: "Back",
    bodySide: "back",
    defaultWeeklyTargetSets: [6, 12],
  },

  // Arms
  {
    id: "biceps",
    displayName: "Biceps",
    region: "Arms",
    bodySide: "front",
    defaultWeeklyTargetSets: [8, 16],
  },
  {
    id: "brachialis_brachioradialis",
    displayName: "Brachialis / Brachioradialis",
    region: "Arms",
    bodySide: "front",
    defaultWeeklyTargetSets: [4, 8],
  },
  {
    id: "triceps_long",
    displayName: "Triceps (Long Head)",
    region: "Arms",
    bodySide: "back",
    defaultWeeklyTargetSets: [6, 12],
  },
  {
    id: "triceps_lat_med",
    displayName: "Triceps (Lateral/Medial Head)",
    region: "Arms",
    bodySide: "back",
    defaultWeeklyTargetSets: [6, 12],
  },
  {
    id: "forearms",
    displayName: "Forearms",
    region: "Arms",
    bodySide: "front",
    defaultWeeklyTargetSets: [4, 8],
  },

  // Core
  {
    id: "rectus_abdominis",
    displayName: "Rectus Abdominis",
    region: "Core",
    bodySide: "front",
    defaultWeeklyTargetSets: [8, 16],
  },
  {
    id: "obliques",
    displayName: "Obliques",
    region: "Core",
    bodySide: "front",
    defaultWeeklyTargetSets: [6, 12],
  },

  // Legs
  {
    id: "quads_rectus_femoris",
    displayName: "Quads (Rectus Femoris)",
    region: "Legs",
    bodySide: "front",
    defaultWeeklyTargetSets: [6, 12],
  },
  {
    id: "quads_vasti",
    displayName: "Quads (Vasti)",
    region: "Legs",
    bodySide: "front",
    defaultWeeklyTargetSets: [10, 20],
  },
  {
    id: "hamstrings",
    displayName: "Hamstrings",
    region: "Legs",
    bodySide: "back",
    defaultWeeklyTargetSets: [8, 16],
  },
  {
    id: "glute_max",
    displayName: "Glute Max",
    region: "Legs",
    bodySide: "back",
    defaultWeeklyTargetSets: [8, 16],
  },
  {
    id: "glute_med",
    displayName: "Glute Med",
    region: "Legs",
    bodySide: "back",
    defaultWeeklyTargetSets: [4, 8],
  },
  {
    id: "adductors",
    displayName: "Adductors",
    region: "Legs",
    bodySide: "front",
    defaultWeeklyTargetSets: [4, 8],
  },
  {
    id: "gastrocnemius",
    displayName: "Gastrocnemius",
    region: "Legs",
    bodySide: "back",
    defaultWeeklyTargetSets: [6, 12],
  },
  {
    id: "soleus",
    displayName: "Soleus",
    region: "Legs",
    bodySide: "back",
    defaultWeeklyTargetSets: [4, 8],
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
