// Hand-authored anatomical line-art for the front/back body map figures.
//
// APPROACH — the figure IS a tessellation of muscle outlines. Rather than
// floating coloured blobs over a silhouette, every body part is defined as a
// *grid*: a stack of cross-sections (rows) each holding the same number of
// points (rails) running from one edge of the part to the other. A muscle is
// then a rectangular block of that grid, and because neighbouring blocks are
// generated from the *same* rail/section curves, they share edges exactly —
// no gaps, no overlaps, and the union of all blocks fills the body outline.
//
// Everything is authored for the LEFT half only (x <= 200) and mirrored at
// render time with `translate(400,0) scale(-1,1)`, so the figure can never
// drift out of symmetry. Centreline muscles (rectus abdominis, traps,
// erectors) are therefore drawn as two half-shapes carrying the same
// `data-muscle-id`; the shared centre edge reads as the linea alba / spine.
//
// All curves are cubic beziers derived from Catmull-Rom interpolation of the
// grid points, so shapes stay organic and a reversed traversal of an edge
// produces byte-identical geometry to the forward one (that identity is what
// guarantees the tessellation).
//
// Proportions: viewBox 0 0 400 900, centreline x = 200, ~7.3 head-heights.
// Landmarks — hair 16, crown 24, chin 140, shoulder line 170, nipple 224,
// navel 344, groin 432, knee 616, ankle 810, sole 858.

import type { SubMuscleId } from "@/data/taxonomy";

export const VIEW_BOX = "0 0 400 900";
export const FIGURE_WIDTH = 400;
export const FIGURE_HEIGHT = 900;
export const MIRROR_TRANSFORM = `translate(${FIGURE_WIDTH},0) scale(-1,1)`;

type Pt = readonly [number, number];
type Section = readonly Pt[];
type Grid = readonly Section[];

/** A muscle: one or more closed paths sharing a single taxonomy id. */
export interface MuscleRegion {
  id: SubMuscleId;
  shapes: string[];
}

/** Everything needed to draw one view's left half. */
export interface ViewArt {
  /** Solid neutral under-layer (fill only) — insurance against hairline seams. */
  base: string[];
  /** Non-interactive anatomy: hands, feet, knees, tibialis, serratus... */
  silhouette: string[];
  /**
   * Already-symmetric silhouette pieces (head, hair, neck) drawn ONCE, not
   * mirrored — a mirrored half would leave a stroked seam down the middle of
   * the face, which the rest of the figure wants (linea alba, spine) but the
   * head very much does not.
   */
  centre: string[];
  /** The 26 addressable muscles present in this view. */
  regions: MuscleRegion[];
  /** Outer contour of each body part, stroked a touch heavier. */
  outline: string[];
  /** Thin decorative strokes (toes, clavicle, achilles). */
  details: string[];
}

// ---------------------------------------------------------------------------
// Curve machinery
// ---------------------------------------------------------------------------

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * Catmull-Rom chain over `pts` from index `from` to index `to` (either
 * direction), emitted as cubic beziers. Traversing an index range backwards
 * yields the same curve with swapped control points, which is what lets two
 * adjacent cells share an edge exactly.
 */
function edge(pts: Section, from: number, to: number): string {
  if (from === to) return "";
  const step = to > from ? 1 : -1;
  const out: string[] = [];
  for (let i = from; i !== to; i += step) {
    const a = pts[i];
    const b = pts[i + step];
    const prev = pts[i - step] ?? a;
    const next = pts[i + 2 * step] ?? b;
    const c1x = a[0] + (b[0] - prev[0]) / 6;
    const c1y = a[1] + (b[1] - prev[1]) / 6;
    const c2x = b[0] - (next[0] - a[0]) / 6;
    const c2y = b[1] - (next[1] - a[1]) / 6;
    out.push(
      `C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(b[0])},${round(b[1])}`,
    );
  }
  return out.join(" ");
}

function rail(grid: Grid, j: number): Section {
  return grid.map((section) => section[j]);
}

/**
 * The closed path bounding grid rows `i0..i1` and rails `j0..j1`. Drawn
 * clockwise: across the top section, down the right rail, back across the
 * bottom section, up the left rail.
 */
function cell(grid: Grid, i0: number, i1: number, j0: number, j1: number): string {
  const start = grid[i0][j0];
  return (
    `M${round(start[0])},${round(start[1])} ` +
    `${edge(grid[i0], j0, j1)} ` +
    `${edge(rail(grid, j1), i0, i1)} ` +
    `${edge(grid[i1], j1, j0)} ` +
    `${edge(rail(grid, j0), i1, i0)} Z`
  );
}

/** The full outer boundary of a grid. */
function full(grid: Grid): string {
  return cell(grid, 0, grid.length - 1, 0, grid[0].length - 1);
}

/** A smooth closed Catmull-Rom loop through `pts` (neighbours wrap around). */
function loop(pts: Section): string {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n];
  const out = [`M${pt(pts[0])}`];
  for (let i = 0; i < n; i++) {
    const a = at(i);
    const b = at(i + 1);
    const prev = at(i - 1);
    const next = at(i + 2);
    out.push(
      curve(
        [a[0] + (b[0] - prev[0]) / 6, a[1] + (b[1] - prev[1]) / 6],
        [b[0] - (next[0] - a[0]) / 6, b[1] - (next[1] - a[1]) / 6],
        b,
      ),
    );
  }
  return `${out.join(" ")} Z`;
}

/**
 * A left-right symmetric closed shape. `profile` walks the LEFT side only,
 * from a point on the centreline down to another point on the centreline;
 * the right side is generated by reflection, so head/neck read as one piece
 * with no seam down the middle.
 */
function symmetric(profile: Section): string {
  const reflected = profile
    .slice(1, -1)
    .map(([x, y]) => [FIGURE_WIDTH - x, y] as Pt)
    .reverse();
  return loop([...profile, ...reflected]);
}

const rad = (a: number) => (a * Math.PI) / 180;
/** Unit vector pointing "down the finger" for an angle measured off +y. */
const dir = (a: number): Pt => [Math.sin(rad(a)), Math.cos(rad(a))];
/** Unit normal to `dir(a)`. */
const nrm = (a: number): Pt => [Math.cos(rad(a)), -Math.sin(rad(a))];
const add = (p: Pt, v: Pt, s = 1): Pt => [p[0] + v[0] * s, p[1] + v[1] * s];
const pt = (p: Pt) => `${round(p[0])},${round(p[1])}`;
const curve = (c1: Pt, c2: Pt, e: Pt) => `C${pt(c1)} ${pt(c2)} ${pt(e)}`;

/** A tapered digit with a rounded tip, as a curve chain from one side of its
 * base, round the tip, to the other side. Used for fingers, thumb and toes. */
function digit(base: Pt, angle: number, len: number, w: number) {
  const d = dir(angle);
  const n = nrm(angle);
  const start = add(base, n, -w);
  const end = add(base, n, w);
  const tip = add(base, d, len);
  const tipA = add(tip, n, -w * 0.62);
  const tipB = add(tip, n, w * 0.62);
  const path =
    `${curve(add(start, d, len * 0.5), add(tipA, d, -len * 0.3), tipA)} ` +
    `${curve(add(tipA, d, w * 1.15), add(tipB, d, w * 1.15), tipB)} ` +
    `${curve(add(tipB, d, -len * 0.3), add(end, d, len * 0.5), end)}`;
  return { start, end, path };
}

/** The webbing between two digits: dips back toward the palm/sole. */
function web(a: Pt, b: Pt, depth = 7): string {
  const c1: Pt = [a[0] + (b[0] - a[0]) * 0.35, a[1] + (b[1] - a[1]) * 0.35 - depth];
  const c2: Pt = [a[0] + (b[0] - a[0]) * 0.65, a[1] + (b[1] - a[1]) * 0.65 - depth];
  return curve(c1, c2, b);
}

// ---------------------------------------------------------------------------
// Grids
// ---------------------------------------------------------------------------

/** Shared inguinal line: bottom row of the torso, top row of the thigh. */
const GROIN: Section = [
  [200, 428],
  [188, 422],
  [170, 413],
  [146, 404],
  [120, 396],
];

// Torso, front. Rails: 0 centreline, 1 rectus edge, 2 + 3 shaping, 4 outline.
// Rows are deliberately diagonal: each runs from the midline down-and-out to
// the flank, which is the direction pec and oblique fibres actually take, and
// is what stops the chest bands reading as horizontal stripes.
const TORSO_FRONT: Grid = [
  [[200, 158], [180, 160], [158, 166], [138, 176], [120, 188]],
  [[200, 194], [176, 192], [152, 190], [132, 194], [114, 202]],
  [[200, 230], [174, 226], [150, 218], [128, 210], [111, 214]],
  [[200, 266], [176, 258], [150, 244], [128, 232], [112, 228]],
  [[200, 294], [172, 290], [150, 277], [132, 262], [116, 248]],
  [[200, 322], [171, 318], [150, 305], [134, 290], [121, 276]],
  [[200, 350], [170, 346], [150, 333], [136, 318], [125, 304]],
  [[200, 378], [170, 374], [151, 361], [138, 346], [127, 332]],
  [[200, 404], [173, 399], [155, 387], [142, 371], [129, 354]],
  GROIN,
];

// Torso, back. Rails: 0 spine, 1 erector/trap edge, 2 mid, 3 scapula, 4 outline.
const TORSO_BACK: Grid = [
  [[200, 148], [182, 151], [160, 158], [138, 168], [118, 179]],
  [[200, 192], [178, 191], [156, 190], [130, 190], [110, 194]],
  [[200, 232], [174, 229], [150, 222], [126, 214], [108, 212]],
  [[200, 272], [172, 268], [150, 258], [126, 244], [110, 236]],
  [[200, 310], [178, 307], [148, 294], [128, 276], [114, 262]],
  [[200, 348], [186, 346], [146, 330], [130, 310], [118, 292]],
  [[200, 380], [174, 377], [148, 361], [134, 340], [123, 320]],
  [[200, 408], [172, 404], [152, 391], [144, 374], [126, 348]],
  [[200, 440], [176, 437], [155, 427], [143, 410], [119, 382]],
  [[200, 470], [180, 468], [160, 460], [140, 444], [116, 418]],
];

// Deltoid cap. Rails: 0 medial (against the pec / trap), 1 mid, 2 lateral
// outline. The last row is the V-shaped insertion partway down the arm.
const DELT: Grid = [
  // Rail 1 sits well outboard: from the front (or back) the anterior (or
  // posterior) head is most of what you see and the side head is the sliver
  // that wraps round the outer edge.
  [[124, 186], [102, 178], [84, 194]],
  [[116, 210], [80, 210], [68, 226]],
  [[114, 244], [80, 250], [69, 256]],
  [[120, 282], [92, 306], [70, 280]],
];

// Upper arm. Rails: 0 lateral edge -> 4 medial edge.
const UPPER_ARM: Grid = [
  [[74, 262], [88, 258], [102, 254], [112, 250], [122, 248]],
  [[62, 320], [78, 322], [94, 324], [108, 322], [118, 316]],
  [[62, 380], [74, 384], [86, 386], [98, 384], [108, 378]],
];

// Forearm. Row 0 is the elbow (shared with the upper arm's last row).
const FOREARM: Grid = [
  UPPER_ARM[2],
  [[54, 428], [66, 432], [78, 434], [90, 432], [100, 426]],
  [[50, 466], [60, 470], [70, 472], [80, 470], [88, 464]],
  [[48, 502], [55, 505], [62, 506], [69, 504], [74, 500]],
];

// Thigh. Row 0 is the groin line (shared with the torso). Rails: 0 lateral
// (vastus lateralis) -> 4 medial (adductors).
const THIGH: Grid = [
  [GROIN[4], GROIN[3], GROIN[2], GROIN[1], GROIN[0]],
  // Rails 2 and 3 pinch together high on the thigh and spread just above the
  // knee, so vastus medialis reads as a teardrop and the adductors as a wedge
  // that tapers out, instead of both being parallel stripes.
  [[104, 462], [130, 470], [156, 474], [164, 470], [188, 462]],
  [[106, 522], [128, 528], [158, 532], [174, 528], [186, 518]],
  [[114, 572], [134, 578], [156, 580], [176, 574], [180, 566]],
  [[124, 606], [144, 616], [154, 622], [170, 616], [174, 604]],
];

// Lower leg. Row 0 is the knee line (shared with the thigh).
const SHANK: Grid = [
  THIGH[4],
  // The rows below the knee bow downward so the gastrocnemius bellies end in
  // a rounded arc rather than a straight "sock cuff" line across the calf.
  [[128, 648], [140, 656], [152, 660], [164, 656], [173, 648]],
  [[118, 696], [136, 720], [152, 730], [168, 718], [182, 694]],
  [[134, 756], [145, 770], [156, 776], [166, 768], [174, 754]],
  [[146, 806], [152, 810], [158, 810], [164, 808], [169, 802]],
];

// ---------------------------------------------------------------------------
// Free-hand silhouette pieces (head, neck, hand, feet)
// ---------------------------------------------------------------------------

// Head: rounded cranium tapering through the cheekbone into a squared jaw.
// Head: cranium, cheekbone, jaw corner, then a squared chin.
const HEAD = symmetric([
  [200, 26],
  [178, 29],
  [161, 48],
  [158, 74],
  [163, 94],
  [169, 106],
  [176, 121],
  [188, 130],
  [200, 133],
]);

// Hair: a cap over the cranium closed off by a rounded hairline.
const HAIR = symmetric([
  [200, 12],
  [173, 16],
  [154, 40],
  [152, 76],
  [158, 76],
  [161, 57],
  [168, 48],
  [180, 44],
  [200, 43],
]);

// Drawn before the head so only the outer rim of each ear shows.
const EAR_PROFILE: Section = [[163, 82], [155, 85], [152, 95], [156, 104], [163, 101]];
const EARS = [
  loop(EAR_PROFILE),
  loop(EAR_PROFILE.map(([x, y]) => [FIGURE_WIDTH - x, y] as Pt)),
];

const NECK = symmetric([
  [200, 118],
  [187, 121],
  [180, 134],
  [177, 148],
  [171, 160],
  [163, 170],
  [178, 175],
  [200, 177],
]);

const HAND = (() => {
  const wristOuter: Pt = [48, 502];
  const wristInner: Pt = [74, 500];
  const thumb = digit([44, 520], -54, 20, 7);
  const index = digit([45, 552], -10, 22, 6.6);
  const middle = digit([57, 555], 0, 25, 6.8);
  const ring = digit([69, 553], 11, 22, 6.4);
  const pinky = digit([80, 542], 26, 18, 5.6);
  return (
    `M${pt(wristOuter)} ` +
    `${curve([45, 506], [42, 510], thumb.start)} ` +
    `${thumb.path} ` +
    `${curve([44, 530], [40, 542], index.start)} ` +
    `${index.path} ` +
    `${web(index.end, middle.start, 3)} ` +
    `${middle.path} ` +
    `${web(middle.end, ring.start, 3)} ` +
    `${ring.path} ` +
    `${web(ring.end, pinky.start, 3)} ` +
    `${pinky.path} ` +
    `${curve([89, 538], [82, 514], wristInner)} Z`
  );
})();

// Foot, seen from the front: the shin rolls into the instep and the toes are
// only implied by the detail strokes, which reads far better at this size
// than five separately drawn digits.
const FOOT_FRONT =
  "M146,806 C136,816 127,828 126,838 C125,848 134,853 148,854 " +
  "C164,855 177,851 180,842 C182,830 176,816 169,802 Z";

// Foot from behind: heel and achilles, no toes visible.
const FOOT_BACK =
  "M146,806 C138,818 133,832 135,842 C138,852 147,857 157,856 " +
  "C169,855 175,848 174,838 C172,826 171,812 169,802 Z";

// ---------------------------------------------------------------------------
// Front view
// ---------------------------------------------------------------------------

const FRONT_REGIONS: MuscleRegion[] = [
  // Legs first so the torso/arms layer over them where they meet.
  { id: "quads_vasti", shapes: [cell(THIGH, 0, 4, 0, 1), cell(THIGH, 1, 4, 2, 3)] },
  { id: "quads_rectus_femoris", shapes: [cell(THIGH, 0, 4, 1, 2)] },
  { id: "adductors", shapes: [cell(THIGH, 0, 2, 3, 4)] },

  // Torso.
  { id: "upper_chest", shapes: [cell(TORSO_FRONT, 0, 1, 0, 4)] },
  { id: "mid_chest", shapes: [cell(TORSO_FRONT, 1, 2, 0, 4)] },
  { id: "lower_chest", shapes: [cell(TORSO_FRONT, 2, 3, 0, 4)] },
  {
    id: "rectus_abdominis",
    shapes: [
      cell(TORSO_FRONT, 3, 4, 0, 1),
      cell(TORSO_FRONT, 4, 5, 0, 1),
      cell(TORSO_FRONT, 5, 6, 0, 1),
      cell(TORSO_FRONT, 6, 7, 0, 1),
    ],
  },
  { id: "obliques", shapes: [cell(TORSO_FRONT, 4, 8, 1, 4)] },

  // Arms, then the deltoid cap on top of the arm's shoulder end.
  { id: "biceps", shapes: [cell(UPPER_ARM, 0, 2, 1, 2), cell(UPPER_ARM, 0, 2, 2, 3)] },
  {
    id: "brachialis_brachioradialis",
    shapes: [cell(UPPER_ARM, 0, 2, 0, 1), cell(FOREARM, 0, 2, 0, 1)],
  },
  { id: "forearms", shapes: [cell(FOREARM, 0, 3, 1, 4), cell(FOREARM, 2, 3, 0, 1)] },
  { id: "front_delt", shapes: [cell(DELT, 0, 3, 0, 1)] },
  { id: "side_delt", shapes: [cell(DELT, 0, 3, 1, 2)] },
];

const FRONT_SILHOUETTE: string[] = [
  // Lower leg is entirely posterior-muscle territory, so it reads as outline:
  // patella, the gastrocnemius edges either side, tibialis anterior between.
  cell(SHANK, 0, 4, 0, 1),
  cell(SHANK, 0, 1, 1, 4),
  cell(SHANK, 1, 4, 1, 3),
  cell(SHANK, 1, 4, 3, 4),
  // Sartorius / inner-knee strip below the adductors.
  cell(THIGH, 2, 4, 3, 4),
  // Serratus under the pec, lower abdomen, hip.
  cell(TORSO_FRONT, 3, 4, 1, 4),
  cell(TORSO_FRONT, 7, 9, 0, 1),
  cell(TORSO_FRONT, 8, 9, 1, 4),
  // Triceps edge showing on the medial side of the arm.
  cell(UPPER_ARM, 0, 2, 3, 4),
  HAND,
  FOOT_FRONT,
];

const FRONT_DETAILS: string[] = [
  // Clavicle.
  "M196,168 C180,162 160,162 146,170",
  // Instep and the four toe clefts.
  "M151,812 C145,822 141,832 140,842",
  "M133,838 C134,845 135,850 136,853",
  "M143,842 C144,848 145,851 145,854",
  "M154,844 C155,849 155,852 155,855",
  "M165,843 C165,848 165,851 164,853",
];

// ---------------------------------------------------------------------------
// Back view
// ---------------------------------------------------------------------------

const BACK_REGIONS: MuscleRegion[] = [
  { id: "hamstrings", shapes: [cell(THIGH, 0, 4, 0, 1), cell(THIGH, 0, 4, 1, 3)] },
  { id: "gastrocnemius", shapes: [cell(SHANK, 1, 2, 0, 2), cell(SHANK, 1, 2, 2, 4)] },
  { id: "soleus", shapes: [cell(SHANK, 2, 3, 0, 2), cell(SHANK, 2, 3, 2, 4)] },

  { id: "glute_max", shapes: [cell(TORSO_BACK, 7, 9, 0, 3)] },
  { id: "glute_med", shapes: [cell(TORSO_BACK, 7, 8, 3, 4)] },

  { id: "lats", shapes: [cell(TORSO_BACK, 2, 6, 2, 4), cell(TORSO_BACK, 3, 6, 1, 2)] },
  { id: "upper_traps", shapes: [cell(TORSO_BACK, 0, 1, 0, 3)] },
  { id: "mid_traps_rhomboids", shapes: [cell(TORSO_BACK, 1, 3, 0, 2)] },
  { id: "lower_traps", shapes: [cell(TORSO_BACK, 3, 5, 0, 1)] },
  { id: "spinal_erectors", shapes: [cell(TORSO_BACK, 5, 7, 0, 1)] },

  {
    id: "triceps_lat_med",
    shapes: [cell(UPPER_ARM, 0, 2, 0, 1), cell(UPPER_ARM, 0, 2, 1, 2)],
  },
  { id: "triceps_long", shapes: [cell(UPPER_ARM, 0, 2, 2, 4)] },
  { id: "rear_delt", shapes: [cell(DELT, 0, 3, 0, 1)] },
  { id: "side_delt", shapes: [cell(DELT, 0, 3, 1, 2)] },
];

const BACK_SILHOUETTE: string[] = [
  // Forearm (anterior muscle group) reads as outline from behind.
  cell(FOREARM, 0, 3, 0, 1),
  cell(FOREARM, 0, 3, 1, 3),
  cell(FOREARM, 0, 3, 3, 4),
  // Over-the-shoulder trap edge, infraspinatus / teres, lumbar sheet, hip.
  cell(TORSO_BACK, 0, 1, 3, 4),
  cell(TORSO_BACK, 1, 2, 2, 4),
  cell(TORSO_BACK, 6, 7, 1, 4),
  cell(TORSO_BACK, 8, 9, 3, 4),
  // Popliteal fossa and achilles.
  cell(SHANK, 0, 1, 0, 4),
  cell(SHANK, 3, 4, 0, 4),
  HAND,
  FOOT_BACK,
];

const BACK_DETAILS: string[] = [
  // Achilles tendon.
  "M150,782 C150,794 151,802 152,810",
  // Heel.
  "M137,838 C146,844 160,844 170,838",
];

// ---------------------------------------------------------------------------
// Assembled views
// ---------------------------------------------------------------------------

const BASE = [full(THIGH), full(SHANK), full(UPPER_ARM), full(FOREARM), HAND];
const CENTRE = [...EARS, HEAD, HAIR, NECK];
const OUTLINE = [full(UPPER_ARM), full(FOREARM), full(THIGH), full(SHANK), full(DELT)];

export const FRONT_ART: ViewArt = {
  base: [...BASE, full(TORSO_FRONT), FOOT_FRONT],
  centre: CENTRE,
  silhouette: FRONT_SILHOUETTE,
  regions: FRONT_REGIONS,
  outline: [
    ...OUTLINE,
    full(TORSO_FRONT),
    // Group boundaries, so pec mass / ab column / quad group read as units
    // rather than as a run of equal-weight internal divisions.
    cell(TORSO_FRONT, 0, 3, 0, 4),
    cell(TORSO_FRONT, 3, 7, 0, 1),
    cell(THIGH, 0, 4, 0, 3),
    FOOT_FRONT,
    HAND,
  ],
  details: FRONT_DETAILS,
};

export const BACK_ART: ViewArt = {
  base: [...BASE, full(TORSO_BACK), FOOT_BACK],
  centre: CENTRE,
  silhouette: BACK_SILHOUETTE,
  regions: BACK_REGIONS,
  outline: [
    ...OUTLINE,
    full(TORSO_BACK),
    cell(TORSO_BACK, 0, 3, 0, 2),
    cell(TORSO_BACK, 7, 9, 0, 4),
    cell(THIGH, 0, 4, 0, 3),
    FOOT_BACK,
    HAND,
  ],
  details: BACK_DETAILS,
};
