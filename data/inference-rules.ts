// Keyword/equipment-based heuristics for guessing an exercise's sub-muscle
// contribution split when it isn't in the user's overrides or the repo map.
// See PLAN.md §5/§6 and CLAUDE.md invariant #5 (resolution order).
//
// This is a best-effort layer, not ground truth: `lib/volume.ts`'s resolver
// always flags anything produced here as `source: "inference"` so the UI can
// badge it "estimated". Step 4 (seeding `muscle-map.json` for the full
// standard exercise bank) is the real coverage; this file only needs to
// handle common name/equipment patterns sensibly, not exhaustively.

import type { SubMuscleId } from "./taxonomy";

export type ContributionMap = Partial<Record<SubMuscleId, number>>;

export interface InferenceInput {
  /** Exercise title, e.g. "Incline Bench Press (Barbell)". */
  name: string;
  /** Hevy's coarse primary muscle group tag, if known (e.g. "chest"). */
  primaryMuscleGroup?: string;
  secondaryMuscleGroups?: string[];
  /** Hevy's equipment_category tag, if known. Typed as `string` here (not
   * lib/hevy's EquipmentCategory) to keep data/ dependency-free of lib/ —
   * no current rule keys off it, but it's accepted for future use. */
  equipment?: string;
}

interface KeywordRule {
  id: string;
  /** All patterns must match the lowercased exercise name. */
  include: RegExp[];
  /** If any of these match, the rule is skipped even if `include` matches. */
  exclude?: RegExp[];
  contributions: ContributionMap;
}

// Rules are checked in order; the first full match wins. More specific
// patterns (e.g. "incline" + chest keywords) are listed before their more
// generic fallback siblings (e.g. plain "bench press").
const KEYWORD_RULES: KeywordRule[] = [
  // --- Chest ---
  {
    id: "incline-press",
    include: [/incline/, /(bench|press|fly|flye)/],
    contributions: { upper_chest: 0.55, front_delt: 0.25, triceps_lat_med: 0.13, triceps_long: 0.07 },
  },
  {
    id: "decline-press",
    include: [/decline/, /(bench|press|fly|flye)/],
    contributions: { lower_chest: 0.55, mid_chest: 0.2, triceps_lat_med: 0.15, triceps_long: 0.1 },
  },
  {
    id: "chest-fly",
    include: [/(fly|flye|pec\s*deck)/],
    exclude: [/reverse/, /rear/],
    contributions: { mid_chest: 0.75, upper_chest: 0.15, front_delt: 0.1 },
  },
  {
    id: "close-grip-press",
    include: [/close.?grip/, /(bench|press)/],
    contributions: { triceps_lat_med: 0.35, triceps_long: 0.3, mid_chest: 0.2, front_delt: 0.15 },
  },
  {
    id: "flat-press",
    include: [/(bench\s*press|chest\s*press)/],
    contributions: { mid_chest: 0.55, front_delt: 0.2, triceps_lat_med: 0.15, triceps_long: 0.1 },
  },
  {
    id: "push-up",
    include: [/push.?up/],
    contributions: { mid_chest: 0.5, front_delt: 0.2, triceps_lat_med: 0.15, triceps_long: 0.1, rectus_abdominis: 0.05 },
  },

  // --- Shoulders ---
  {
    id: "lateral-raise",
    include: [/lateral\s*raise/],
    contributions: { side_delt: 0.9, front_delt: 0.1 },
  },
  {
    id: "front-raise",
    include: [/front\s*raise/],
    contributions: { front_delt: 0.9, side_delt: 0.1 },
  },
  {
    id: "rear-delt-fly",
    include: [/(reverse\s*fly|reverse\s*flye|rear\s*delt)/],
    contributions: { rear_delt: 0.65, mid_traps_rhomboids: 0.25, side_delt: 0.1 },
  },
  {
    id: "face-pull",
    include: [/face\s*pull/],
    contributions: { rear_delt: 0.6, mid_traps_rhomboids: 0.25, upper_traps: 0.15 },
  },
  {
    id: "overhead-press",
    include: [/(overhead|shoulder|military)\s*press/],
    contributions: { front_delt: 0.55, side_delt: 0.3, triceps_lat_med: 0.1, triceps_long: 0.05 },
  },
  {
    id: "upright-row",
    include: [/upright\s*row/],
    contributions: { side_delt: 0.55, upper_traps: 0.3, front_delt: 0.15 },
  },
  {
    id: "shrug",
    include: [/shrug/],
    contributions: { upper_traps: 0.85, mid_traps_rhomboids: 0.15 },
  },

  // --- Back ---
  // Lats split by movement per CONTRIBUTING.md's lats-split rules: vertical
  // pulls default 55/45 upper/lower unless the grip narrows the split
  // further; wide/pronated grip biases upper lats harder, neutral/underhand
  // biases lower lats.
  {
    id: "pulldown-pullup-wide",
    include: [/(pulldown|pull.?up|chin.?up)/, /(wide|pronated)/],
    contributions: { lats_upper: 0.33, lats_lower: 0.22, mid_traps_rhomboids: 0.2, biceps: 0.15, rear_delt: 0.1 },
  },
  {
    id: "pulldown-pullup-narrow",
    include: [/(pulldown|pull.?up|chin.?up)/, /(neutral|underhand|reverse.?grip)/],
    contributions: { lats_upper: 0.25, lats_lower: 0.3, mid_traps_rhomboids: 0.2, biceps: 0.15, rear_delt: 0.1 },
  },
  {
    id: "straight-arm-pulldown",
    include: [/(straight.?arm\s*pulldown|pullover)/],
    contributions: { lats_upper: 0.17, lats_lower: 0.38, mid_chest: 0.15, triceps_long: 0.15, rear_delt: 0.15 },
  },
  {
    id: "pulldown-pullup",
    include: [/(pulldown|pull.?up|chin.?up)/],
    contributions: { lats_upper: 0.3, lats_lower: 0.25, mid_traps_rhomboids: 0.2, biceps: 0.15, rear_delt: 0.1 },
  },
  {
    id: "row-high-flared",
    include: [/row/, /(high\s*row|flared|face.?level)/],
    exclude: [/upright/],
    contributions: { lats_upper: 0.24, lats_lower: 0.16, mid_traps_rhomboids: 0.3, rear_delt: 0.15, biceps: 0.15 },
  },
  {
    id: "row-low",
    include: [/row/, /(low\s*row|seated\s*cable|underhand|neutral|t.?bar|meadows|one.?arm)/],
    exclude: [/upright/],
    contributions: { lats_upper: 0.16, lats_lower: 0.24, mid_traps_rhomboids: 0.3, rear_delt: 0.15, biceps: 0.15 },
  },
  {
    id: "row",
    include: [/row/],
    exclude: [/upright/],
    contributions: { lats_upper: 0.16, lats_lower: 0.24, mid_traps_rhomboids: 0.3, rear_delt: 0.15, biceps: 0.15 },
  },
  {
    id: "deadlift",
    include: [/deadlift/],
    exclude: [/stiff.?leg/, /romanian/, /rdl/],
    // Lats brace isometrically across a deadlift, so the small lats share
    // splits evenly (rule 1: deadlifts/rack pulls/carries -> 50/50).
    contributions: { spinal_erectors: 0.35, glute_max: 0.3, hamstrings: 0.25, lats_upper: 0.05, lats_lower: 0.05 },
  },
  {
    id: "external-internal-rotation",
    include: [/(external|internal)\s*rotation/],
    contributions: { rotator_cuff: 0.8, rear_delt: 0.2 },
  },
  {
    id: "rotator-cuff",
    include: [/rotator/],
    contributions: { rotator_cuff: 0.75, rear_delt: 0.25 },
  },
  {
    id: "serratus",
    include: [/(serratus|protraction|scapular\s*push)/],
    contributions: { serratus_anterior: 0.5, mid_chest: 0.2, front_delt: 0.15, obliques: 0.15 },
  },
  {
    id: "neck",
    include: [/neck/],
    contributions: { neck: 0.85, upper_traps: 0.15 },
  },
  {
    id: "good-morning",
    include: [/good\s*morning/],
    contributions: { spinal_erectors: 0.5, hamstrings: 0.35, glute_max: 0.15 },
  },
  {
    id: "hyperextension",
    include: [/(hyperextension|back\s*extension)/],
    contributions: { spinal_erectors: 0.7, glute_max: 0.2, hamstrings: 0.1 },
  },

  // --- Arms ---
  {
    id: "hammer-curl",
    include: [/hammer\s*curl/],
    contributions: { brachialis_brachioradialis: 0.6, biceps: 0.25, forearms: 0.15 },
  },
  {
    id: "curl",
    include: [/curl/],
    exclude: [/leg\s*curl/, /hammer/, /wrist/, /reverse/],
    contributions: { biceps: 0.75, brachialis_brachioradialis: 0.25 },
  },
  {
    id: "reverse-curl",
    include: [/reverse\s*curl/],
    contributions: { brachialis_brachioradialis: 0.5, forearms: 0.35, biceps: 0.15 },
  },
  {
    id: "wrist-forearm",
    include: [/(wrist\s*curl|forearm)/],
    contributions: { forearms: 1.0 },
  },
  {
    id: "skull-crusher",
    include: [/skull\s*crusher/],
    contributions: { triceps_long: 0.6, triceps_lat_med: 0.4 },
  },
  {
    id: "overhead-triceps",
    include: [/overhead/, /tricep/],
    contributions: { triceps_long: 0.6, triceps_lat_med: 0.4 },
  },
  {
    id: "triceps-pushdown",
    include: [/(pushdown|kickback|tricep)/],
    contributions: { triceps_lat_med: 0.6, triceps_long: 0.4 },
  },
  {
    id: "dip",
    include: [/dip/],
    contributions: { lower_chest: 0.4, triceps_lat_med: 0.3, triceps_long: 0.2, front_delt: 0.1 },
  },

  // --- Core ---
  {
    id: "oblique",
    include: [/(oblique|russian\s*twist|side\s*bend)/],
    contributions: { obliques: 0.8, rectus_abdominis: 0.2 },
  },
  {
    id: "plank-abwheel",
    include: [/(plank|ab\s*wheel|ab\s*rollout)/],
    contributions: { rectus_abdominis: 0.55, obliques: 0.3, serratus_anterior: 0.15 },
  },
  {
    id: "leg-raise",
    include: [/(leg\s*raise|knee\s*raise|hip\s*flexor|toes.?to.?bar|l.?sit|mountain\s*climber|flutter\s*kick|scissor\s*kick|high\s*knee)/],
    contributions: { hip_flexors: 0.55, rectus_abdominis: 0.45 },
  },
  {
    id: "crunch-situp",
    include: [/(crunch|sit.?up)/],
    contributions: { rectus_abdominis: 0.85, hip_flexors: 0.15 },
  },

  // --- Legs ---
  {
    id: "leg-extension",
    include: [/leg\s*extension/],
    contributions: { quads_vasti: 0.6, quads_rectus_femoris: 0.4 },
  },
  {
    id: "leg-curl",
    include: [/leg\s*curl/],
    contributions: { hamstrings: 1.0 },
  },
  {
    id: "rdl",
    include: [/(romanian|stiff.?leg|rdl)/],
    contributions: { hamstrings: 0.55, glute_max: 0.3, spinal_erectors: 0.15 },
  },
  {
    id: "hip-thrust",
    include: [/(hip\s*thrust|glute\s*bridge)/],
    contributions: { glute_max: 0.7, hamstrings: 0.2, adductors: 0.1 },
  },
  {
    id: "lunge",
    include: [/(lunge|split\s*squat|bulgarian)/],
    contributions: { quads_vasti: 0.35, glute_max: 0.35, hamstrings: 0.15, quads_rectus_femoris: 0.15 },
  },
  {
    id: "leg-press",
    include: [/leg\s*press/],
    contributions: { quads_vasti: 0.4, quads_rectus_femoris: 0.2, glute_max: 0.3, adductors: 0.1 },
  },
  {
    id: "squat",
    include: [/squat/],
    exclude: [/split/],
    contributions: { quads_vasti: 0.35, quads_rectus_femoris: 0.2, glute_max: 0.3, adductors: 0.15 },
  },
  {
    id: "adductor-abductor",
    include: [/(adductor|inner\s*thigh)/],
    contributions: { adductors: 1.0 },
  },
  {
    id: "abduction",
    include: [/(abduction|clamshell|lateral\s*band\s*walk|fire\s*hydrant)/],
    contributions: { glute_med: 0.7, glute_max: 0.3 },
  },
  {
    id: "tibialis",
    include: [/(tib(ialis)?\s*raise|dorsiflexion)/],
    contributions: { tibialis_anterior: 0.95, gastrocnemius: 0.05 },
  },
  {
    id: "calf-raise-seated",
    include: [/seated/, /calf/],
    contributions: { soleus: 0.75, gastrocnemius: 0.25 },
  },
  {
    id: "calf-raise",
    include: [/calf/],
    contributions: { gastrocnemius: 0.7, soleus: 0.3 },
  },
];

/** Coarse Hevy `primary_muscle_group` tag -> a specific-as-possible sub-muscle
 * split. Used when no keyword rule matches but Hevy's own coarse tag is more
 * specific than "everything in this taxonomy region" (e.g. "biceps" is a
 * much tighter guess than splitting across all of Arms).
 *
 * NOTE: Hevy's exact `primary_muscle_group` string values aren't documented
 * in a fixed enum in the OpenAPI schema (the field is typed as `string`).
 * This table covers the group names observed in the Hevy app's own exercise
 * categorization; unrecognized values fall through to the region-wide
 * coarse fallback in lib/volume.ts. Worth verifying against a live
 * `/v1/exercise_templates` response when step 4 seeds muscle-map.json.
 */
export const COARSE_GROUP_CONTRIBUTIONS: Record<string, ContributionMap> = {
  chest: { mid_chest: 0.5, upper_chest: 0.3, lower_chest: 0.2 },
  shoulders: { front_delt: 0.4, side_delt: 0.4, rear_delt: 0.2 },
  biceps: { biceps: 0.75, brachialis_brachioradialis: 0.25 },
  triceps: { triceps_lat_med: 0.55, triceps_long: 0.45 },
  forearms: { forearms: 1.0 },
  lats: { lats_upper: 0.44, lats_lower: 0.36, mid_traps_rhomboids: 0.2 },
  upper_back: { mid_traps_rhomboids: 0.5, lats_upper: 0.15, lats_lower: 0.15, rear_delt: 0.2 },
  traps: { upper_traps: 0.6, mid_traps_rhomboids: 0.3, lower_traps: 0.1 },
  neck: { neck: 0.85, upper_traps: 0.15 },
  lower_back: { spinal_erectors: 1.0 },
  abdominals: { rectus_abdominis: 0.6, obliques: 0.4 },
  quadriceps: { quads_vasti: 0.6, quads_rectus_femoris: 0.4 },
  hamstrings: { hamstrings: 1.0 },
  glutes: { glute_max: 0.75, glute_med: 0.25 },
  adductors: { adductors: 1.0 },
  abductors: { glute_med: 1.0 },
  calves: { gastrocnemius: 0.65, soleus: 0.35 },
};

/** Hevy coarse group -> taxonomy `region`, used only for the last-resort
 * even-split fallback in lib/volume.ts (when even COARSE_GROUP_CONTRIBUTIONS
 * has no entry). */
export const COARSE_GROUP_TO_REGION: Record<string, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  biceps: "Arms",
  triceps: "Arms",
  forearms: "Arms",
  lats: "Back",
  upper_back: "Back",
  traps: "Traps",
  neck: "Traps",
  lower_back: "Back",
  abdominals: "Core",
  quadriceps: "Legs",
  hamstrings: "Legs",
  glutes: "Legs",
  adductors: "Legs",
  abductors: "Legs",
  calves: "Legs",
};

function normalize(name: string): string {
  return name.toLowerCase();
}

/** Attempts to infer a contribution map from an exercise's name and Hevy's
 * coarse muscle tag. Returns undefined if nothing matches — callers should
 * fall back to the region-wide coarse split in that case. */
export function inferContributions(input: InferenceInput): ContributionMap | undefined {
  const nameLower = normalize(input.name);

  for (const rule of KEYWORD_RULES) {
    const included = rule.include.every((pattern) => pattern.test(nameLower));
    if (!included) continue;
    const excluded = rule.exclude?.some((pattern) => pattern.test(nameLower)) ?? false;
    if (excluded) continue;
    return rule.contributions;
  }

  if (input.primaryMuscleGroup) {
    const coarse = COARSE_GROUP_CONTRIBUTIONS[input.primaryMuscleGroup.toLowerCase()];
    if (coarse) return coarse;
  }

  return undefined;
}
