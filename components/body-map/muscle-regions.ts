// Hand-authored anatomical shape data for the front/back body map figures.
// See Figure.tsx for how these become <path>/<ellipse> elements. Coordinates
// share a 0 0 300 700 viewBox, centerline x=150. Bilateral muscles are
// authored once for the LEFT half (x < 150) and mirrored across the
// centerline at render time (see Figure.tsx), so a single shape definition
// drives both sides of the body.
//
// Landmark reference (front == back silhouette; only what's drawn on top
// differs):
//   head:      cx150 cy52, r~30              (bottom ~y84)
//   shoulders: outer point (60,122), width 60..240 at y122
//   ribcage:   outer edge ~(68,175)
//   waist:     narrowest ~(92,270)
//   hip/thigh top: ~(90,336) outer, ~(146,338) inner (near groin)
//   knee:      ~y480
//   ankle:     ~y620
//   arm:       shoulder (42..66,130) tapering to wrist (48..60,390)

import type { SubMuscleId } from "@/data/taxonomy";

export type MuscleShape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "path"; d: string };

export interface MuscleRegion {
  id: SubMuscleId;
  /** One or more shapes sharing this muscle id (e.g. quads_vasti renders
   * as two teardrops per leg — lateral + medial heads). */
  shapes: MuscleShape[];
  /** If true, this region is authored for the left half only and gets a
   * mirrored copy rendered across the centerline. Centerline-spanning
   * regions (abs, traps, spine) set this to false. */
  mirror: boolean;
}

// ---------------------------------------------------------------------------
// Background silhouette (non-interactive guide, drawn behind the muscles).
// Straight-edge polygons (not freehand curves) so proportions stay
// predictable/checkable: shoulders widest, waist narrowest, hips flare
// slightly, limbs taper from joint to joint.
// ---------------------------------------------------------------------------

export const SILHOUETTE = {
  head: { kind: "ellipse", cx: 150, cy: 52, rx: 28, ry: 32 } as MuscleShape,
  neck: { kind: "path", d: "M132,82 L168,82 L178,106 L122,106 Z" } as MuscleShape,
  // Hourglass torso: shoulder(60,122) -> ribcage(68,175) -> waist(92,270) -> hip(85..95,300..336).
  torso: {
    kind: "path",
    d: "M88,106 L60,122 L68,175 L92,270 L85,300 L95,336 L205,336 L215,300 L208,270 L232,175 L240,122 L212,106 Z",
  } as MuscleShape,
  // Shoulder(42..66,130) -> upper arm -> elbow(~270) -> forearm -> wrist(~390).
  armLeft: {
    kind: "path",
    d: "M42,130 L33,220 L36,270 L40,340 L48,392 L60,388 L54,330 L50,268 L58,200 L66,132 Z",
  } as MuscleShape,
  // Hip(90/146,336) -> thigh -> knee(~480) -> calf -> ankle(~620) -> foot stub.
  legLeft: {
    kind: "path",
    d: "M90,336 L85,420 L88,480 L92,540 L90,620 L88,660 L108,662 L106,620 L112,540 L118,480 L128,420 L146,338 Z",
  } as MuscleShape,
} as const;

export const SILHOUETTE_FRONT = SILHOUETTE;
export const SILHOUETTE_BACK = SILHOUETTE;

// ---------------------------------------------------------------------------
// Front view muscles
// ---------------------------------------------------------------------------

export const FRONT_REGIONS: readonly MuscleRegion[] = [
  { id: "front_delt", mirror: true, shapes: [{ kind: "ellipse", cx: 51, cy: 141, rx: 21, ry: 30 }] },
  { id: "side_delt", mirror: true, shapes: [{ kind: "ellipse", cx: 33, cy: 152, rx: 11, ry: 23 }] },

  { id: "upper_chest", mirror: true, shapes: [{ kind: "path", d: "M150,113 L66,130 L68,150 L150,150 Z" }] },
  { id: "mid_chest", mirror: true, shapes: [{ kind: "path", d: "M150,150 L68,150 L70,188 L150,190 Z" }] },
  { id: "lower_chest", mirror: true, shapes: [{ kind: "path", d: "M150,190 L70,188 L78,218 L150,222 Z" }] },

  { id: "biceps", mirror: true, shapes: [{ kind: "ellipse", cx: 48, cy: 202, rx: 13, ry: 50 }] },
  {
    id: "brachialis_brachioradialis",
    mirror: true,
    shapes: [{ kind: "ellipse", cx: 44, cy: 270, rx: 10, ry: 18 }],
  },
  { id: "forearms", mirror: true, shapes: [{ kind: "ellipse", cx: 47, cy: 332, rx: 12, ry: 54 }] },

  {
    id: "rectus_abdominis",
    mirror: false,
    shapes: [{ kind: "path", d: "M126,224 L174,224 L166,295 L150,304 L134,295 Z" }],
  },
  {
    id: "obliques",
    mirror: true,
    shapes: [{ kind: "path", d: "M126,228 L110,235 L96,265 L100,290 L118,296 L126,296 Z" }],
  },

  { id: "quads_rectus_femoris", mirror: true, shapes: [{ kind: "ellipse", cx: 115, cy: 410, rx: 13, ry: 60 }] },
  {
    id: "quads_vasti",
    mirror: true,
    shapes: [
      { kind: "ellipse", cx: 96, cy: 400, rx: 10, ry: 48 },
      { kind: "ellipse", cx: 132, cy: 440, rx: 9, ry: 34 },
    ],
  },
  { id: "adductors", mirror: true, shapes: [{ kind: "ellipse", cx: 141, cy: 385, rx: 7, ry: 44 }] },
];

// ---------------------------------------------------------------------------
// Back view muscles
// ---------------------------------------------------------------------------

export const BACK_REGIONS: readonly MuscleRegion[] = [
  { id: "rear_delt", mirror: true, shapes: [{ kind: "ellipse", cx: 51, cy: 141, rx: 21, ry: 30 }] },
  { id: "side_delt", mirror: true, shapes: [{ kind: "ellipse", cx: 33, cy: 152, rx: 11, ry: 23 }] },

  { id: "upper_traps", mirror: false, shapes: [{ kind: "path", d: "M124,96 L176,96 L212,118 L150,140 L88,118 Z" }] },
  {
    id: "mid_traps_rhomboids",
    mirror: false,
    shapes: [{ kind: "path", d: "M120,142 L180,142 L196,205 L150,220 L104,205 Z" }],
  },
  { id: "lower_traps", mirror: false, shapes: [{ kind: "path", d: "M136,222 L164,222 L154,262 L150,268 L146,262 Z" }] },
  {
    id: "spinal_erectors",
    mirror: true,
    shapes: [{ kind: "path", d: "M140,215 L150,215 L150,300 L140,300 C134,270 134,245 140,215 Z" }],
  },

  { id: "lats", mirror: true, shapes: [{ kind: "path", d: "M92,150 L74,180 L80,225 L98,258 L124,228 L120,155 Z" }] },

  { id: "triceps_long", mirror: true, shapes: [{ kind: "ellipse", cx: 50, cy: 202, rx: 9, ry: 34 }] },
  { id: "triceps_lat_med", mirror: true, shapes: [{ kind: "ellipse", cx: 42, cy: 210, rx: 13, ry: 54 }] },

  { id: "hamstrings", mirror: true, shapes: [{ kind: "ellipse", cx: 114, cy: 410, rx: 15, ry: 60 }] },
  { id: "glute_max", mirror: true, shapes: [{ kind: "ellipse", cx: 110, cy: 345, rx: 27, ry: 32 }] },
  { id: "glute_med", mirror: true, shapes: [{ kind: "ellipse", cx: 90, cy: 322, rx: 12, ry: 16 }] },

  { id: "gastrocnemius", mirror: true, shapes: [{ kind: "ellipse", cx: 113, cy: 545, rx: 15, ry: 42 }] },
  { id: "soleus", mirror: true, shapes: [{ kind: "ellipse", cx: 115, cy: 602, rx: 10, ry: 28 }] },
];

export const VIEW_BOX = "0 0 300 700";
