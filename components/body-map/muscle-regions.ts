// Hand-authored anatomical artwork for the front/back body map figures.
//
// APPROACH — every body part is defined as a *grid*: a stack of cross-sections
// (rows) each holding the same number of points (rails) running from one edge
// of the part to the other. A muscle is a rectangular block of that grid, so
// muscles are laid out by construction — they stay in their anatomical lanes,
// never overlap, and together they cover the whole figure.
//
// v3 draws each block as an *island* (`block()`, inset from its grid cell and
// re-sampled with rounded ends) rather than as an edge-sharing tile, so the
// dark body base shows through as a groove between muscles. That separation is
// the difference between a shaded body and a suit of armour plating.
//
// v3 also adds:
//   * FIBRE STRIATIONS. Because a muscle is a block of grid cells, any line
//     drawn in *index space* (row/rail coordinates, fractional allowed) is by
//     construction inside the muscle. So striations need no clip paths at all:
//     `fibre(grid, [i0,j0], [i1,j1])` bilinearly samples the grid and emits a
//     smooth open curve that follows the fascicle direction of that muscle.
//     Every region's striations are joined into ONE path string, so the extra
//     cost is exactly one <path> per muscle.
//   * A PEC FAN. The chest is its own converging grid (rails run from the
//     sternum out to a narrow insertion strip on the humerus), so upper/mid/
//     lower chest are three wedges of one fan rather than three stacked bars.
//
// Everything is authored for the LEFT half only (x <= 200) and mirrored at
// render time with `translate(400,0) scale(-1,1)`, so the figure can never
// drift out of symmetry. Centreline muscles (rectus abdominis, traps,
// erectors) are therefore drawn as two half-shapes carrying the same
// `data-muscle-id`; the shared centre edge reads as the linea alba / spine.
//
// All curves are cubic beziers derived from Catmull-Rom interpolation of the
// grid points, so shapes stay organic and a reversed traversal of an edge
// produces byte-identical geometry to the forward one, so the body-part
// outlines and the muscle blocks inside them always agree.
//
// Proportions: viewBox 0 0 400 900, centreline x = 200, ~7.3 head-heights,
// athletic build (shoulders ~3.3 heads wide, waist pinched at row 6).
// Landmarks — hair 12, crown 24, chin 141, shoulder line 172, nipple 226,
// navel 344, groin 430, knee 616, ankle 810, sole 858.

import type { SubMuscleId } from "@/data/taxonomy";

export const VIEW_BOX = "0 0 400 900";
export const FIGURE_WIDTH = 400;
export const FIGURE_HEIGHT = 900;
export const MIRROR_TRANSFORM = `translate(${FIGURE_WIDTH},0) scale(-1,1)`;

type Pt = readonly [number, number];
type Section = readonly Pt[];
type Grid = readonly Section[];
/** A point in grid index space: [row, rail], fractions allowed. */
type Ix = readonly [number, number];

/** A muscle: one or more closed paths sharing a single taxonomy id. */
export interface MuscleRegion {
  id: SubMuscleId;
  shapes: string[];
  /** Fibre striations, all subpaths joined into one path string. */
  fibres: string;
}

/** Everything needed to draw one view's left half. */
export interface ViewArt {
  /** Solid dark under-layer (fill only) — insurance against hairline seams. */
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
  /** Every taxonomy sub-muscle whose `bodySide` includes this view. */
  regions: MuscleRegion[];
  /** Outer contour of each body part, stroked as a faint rim UNDER the
   * muscles so it never draws a line across one. */
  outline: string[];
  /** Hair, filled a shade darker than the face. */
  hair: string[];
  /** Thin decorative strokes (toes, clavicle, achilles, tibialis fibres). */
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

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Bilinear sample of a grid at fractional [row, rail]. */
function gridPoint(grid: Grid, i: number, j: number): Pt {
  const rows = grid.length;
  const rails = grid[0].length;
  const i0 = Math.max(0, Math.min(rows - 1, Math.floor(i)));
  const i1 = Math.min(rows - 1, i0 + 1);
  const j0 = Math.max(0, Math.min(rails - 1, Math.floor(j)));
  const j1 = Math.min(rails - 1, j0 + 1);
  const ti = i - i0;
  const tj = j - j0;
  const top = [
    mix(grid[i0][j0][0], grid[i0][j1][0], tj),
    mix(grid[i0][j0][1], grid[i0][j1][1], tj),
  ];
  const bot = [
    mix(grid[i1][j0][0], grid[i1][j1][0], tj),
    mix(grid[i1][j0][1], grid[i1][j1][1], tj),
  ];
  return [mix(top[0], bot[0], ti), mix(top[1], bot[1], ti)];
}

/**
 * A rail bound for `block`: either a fixed rail index, or `[top, bottom]` to
 * taper the edge linearly from the block's first row to its last. Tapering is
 * what keeps the flat sheet muscles (rhomboids, lower traps, erectors, the
 * lower lat) from reading as rectangles.
 */
type Bound = number | readonly [number, number];
const bound = (b: Bound, t: number) => (typeof b === "number" ? b : mix(b[0], b[1], t));

/**
 * A muscle *island*: the same rows/rails block as `cell`, but inset by `m`
 * (rows) and `mj` (rails, either one value or `[j0 side, j1 side]`) in index
 * units and re-sampled through the grid, so the shape has rounded ends and
 * neighbouring muscles are separated by a thin groove of dark body rather
 * than sharing a hard seam. That separation is what stops the figure reading
 * as armour plating; the grid still guarantees the muscles stay in their
 * anatomical lanes and never overlap. An asymmetric `mj` is how the abs get a
 * narrow linea alba on the midline and a wide groove on the flank side.
 */
function block(
  grid: Grid,
  i0: number,
  i1: number,
  j0: Bound,
  j1: Bound,
  m = 0.1,
  mj: number | readonly [number, number] = m,
): string {
  const samples = 6;
  const mi = Math.min(m, (i1 - i0) / 3);
  const [mj0, mj1] = typeof mj === "number" ? [mj, mj] : mj;
  const a = i0 + mi;
  const b = i1 - mi;
  /** Inset rail bounds at row-fraction `t` (0 = first row, 1 = last). */
  const lo = (t: number) => bound(j0, t) + mj0;
  const hi = (t: number) => bound(j1, t) - mj1;
  const row = (t: number) => mix(a, b, t);
  const pts: Pt[] = [];
  const at = (i: number, j: number) => pts.push(gridPoint(grid, i, j));
  for (let k = 0; k < samples; k++) at(a, mix(lo(0), hi(0), k / (samples - 1)));
  for (let k = 1; k < samples; k++) {
    const t = k / (samples - 1);
    at(row(t), hi(t));
  }
  for (let k = 1; k < samples; k++) at(b, mix(hi(1), lo(1), k / (samples - 1)));
  for (let k = 1; k < samples - 1; k++) {
    const t = 1 - k / (samples - 1);
    at(row(t), lo(t));
  }
  return loop(pts);
}

/**
 * One fibre striation: an open curve from index-space point `a` to `b`,
 * sampled through the grid so it bends with the muscle. Because both ends
 * live inside the muscle's own index block, the stroke can never escape the
 * shape — no clip path needed.
 */
function fibre(grid: Grid, a: Ix, b: Ix, samples = 6): string {
  const pts: Pt[] = [];
  for (let k = 0; k < samples; k++) {
    const t = k / (samples - 1);
    pts.push(gridPoint(grid, mix(a[0], b[0], t), mix(a[1], b[1], t)));
  }
  return `M${round(pts[0][0])},${round(pts[0][1])} ${edge(pts, 0, pts.length - 1)}`;
}

/** Several striations on one grid, joined into a single path string. */
function fibres(grid: Grid, lines: ReadonlyArray<readonly [Ix, Ix]>): string {
  return lines.map(([a, b]) => fibre(grid, a, b)).join(" ");
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
  [200, 430],
  [188, 424],
  [168, 414],
  [144, 404],
  [118, 393],
];

// Torso, front. Rails: 0 centreline, 1 rectus edge, 2 + 3 shaping, 4 flank.
// Rows are deliberately diagonal: each runs from the midline down-and-out to
// the flank, which is the direction oblique fibres actually take. The waist
// pinches at row 6 and the flank flares back out at rows 2-3, giving the
// V-taper the reference figure has.
const TORSO_FRONT: Grid = [
  [[200, 158], [178, 160], [156, 166], [134, 176], [114, 190]],
  [[200, 196], [174, 194], [150, 192], [126, 196], [108, 206]],
  [[200, 232], [172, 228], [148, 220], [124, 214], [105, 220]],
  [[200, 268], [168, 259], [148, 248], [128, 238], [108, 236]],
  [[200, 296], [166, 291], [150, 280], [134, 266], [116, 254]],
  [[200, 324], [165, 319], [150, 308], [137, 292], [124, 276]],
  [[200, 352], [165, 347], [150, 336], [139, 320], [130, 300]],
  [[200, 380], [166, 375], [151, 364], [141, 348], [132, 326]],
  [[200, 406], [170, 400], [154, 389], [143, 373], [128, 350]],
  GROIN,
];

// Torso, back. Rails: 0 spine, 1 erector/trap edge, 2 mid, 3 scapula, 4 flank.
const TORSO_BACK: Grid = [
  [[200, 148], [180, 151], [156, 158], [132, 168], [110, 180]],
  [[200, 192], [176, 191], [152, 190], [124, 190], [102, 196]],
  [[200, 232], [172, 229], [146, 222], [120, 214], [100, 216]],
  [[200, 272], [170, 268], [146, 258], [120, 244], [102, 236]],
  [[200, 310], [176, 307], [144, 294], [122, 276], [108, 260]],
  [[200, 348], [184, 346], [142, 330], [126, 310], [114, 290]],
  [[200, 380], [172, 377], [146, 361], [132, 340], [122, 318]],
  [[200, 408], [170, 404], [150, 391], [142, 374], [126, 346]],
  [[200, 442], [174, 439], [152, 428], [140, 410], [116, 380]],
  [[200, 474], [178, 472], [157, 463], [136, 446], [112, 416]],
];

// Pectoral fan (front only). Rails run from the sternum (0) out to a narrow
// insertion strip on the humerus (3), so the three chest bands are wedges of
// ONE fan converging at the shoulder rather than three stacked bars. Rail 0
// stops short of x=200 so the mirrored halves leave a sternum groove.
const PEC: Grid = [
  [[190, 170], [170, 169], [150, 178], [136, 205]],
  [[190, 207], [170, 203], [150, 201], [135, 214]],
  [[190, 243], [170, 236], [150, 226], [134, 224]],
  [[190, 276], [168, 266], [148, 246], [134, 233]],
];

// Sternocleidomastoid (front neck). Rows run down the strip from the mastoid
// (behind the ear) to the sternal notch; rails cross it. Authored to sit
// inside the neck silhouette's left half, so the mirrored pair frames the
// throat the way the SCM heads actually do.
const SCM: Grid = [
  [[190, 138], [178, 141]],
  [[194, 156], [182, 158]],
  [[198, 172], [188, 171]],
];

// Posterior neck column (back view): the strip beside the spine between the
// skull base and the top of the traps.
const NECK_BACK: Grid = [
  [[198, 120], [184, 126]],
  [[198, 138], [179, 141]],
  [[198, 154], [176, 154]],
];

// Upper trap, front view: the slope from the side of the neck out to the
// acromion. Row 0 is its upper (posterior) edge, row 1 the lower edge that
// follows the clavicle; rails run along the slope, which is also the fibre
// direction.
// It has to thread a narrow lane: medially it must clear the SCM strip,
// laterally it must stop short of the deltoid, and it must stay below the
// neck's shoulder flare or it floats over the background.
const TRAP_FRONT: Grid = [
  [[178, 146], [170, 154], [161, 162], [152, 171]],
  [[180, 158], [173, 166], [164, 175], [155, 186]],
];

// Deltoid cap. Rails: 0 medial (against the pec / trap), 1 mid, 2 lateral
// outline. The last row is the V-shaped insertion partway down the arm.
// Wider and rounder than v2 — the delt is what sells an athletic silhouette.
const DELT: Grid = [
  [[142, 180], [98, 170], [92, 192]],
  [[134, 208], [84, 196], [70, 220]],
  [[130, 238], [80, 234], [67, 250]],
  [[130, 266], [90, 286], [74, 268]],
];

// Upper arm. Rails: 0 lateral edge -> 4 medial edge. The belly (row 1) is
// pushed outboard on both sides so the arm reads thick rather than tubular.
const UPPER_ARM: Grid = [
  [[70, 268], [86, 264], [102, 260], [116, 256], [128, 254]],
  [[58, 326], [76, 330], [94, 332], [110, 330], [124, 322]],
  [[62, 386], [76, 390], [90, 392], [104, 390], [116, 382]],
];

// Forearm. Row 0 is the elbow (shared with the upper arm's last row).
const FOREARM: Grid = [
  UPPER_ARM[2],
  [[52, 432], [66, 438], [80, 440], [94, 436], [106, 428]],
  [[48, 470], [60, 476], [72, 478], [84, 474], [94, 466]],
  [[50, 504], [57, 508], [65, 509], [73, 506], [80, 500]],
];

// Thigh. Row 0 is the groin line (shared with the torso). Rails: 0 lateral
// (vastus lateralis) -> 4 medial (adductors).
const THIGH: Grid = [
  [GROIN[4], GROIN[3], GROIN[2], GROIN[1], GROIN[0]],
  // Rails 2 and 3 pinch together high on the thigh and spread just above the
  // knee, so vastus medialis reads as a teardrop and the adductors as a wedge
  // that tapers out, instead of both being parallel stripes.
  [[90, 466], [122, 473], [152, 477], [168, 472], [188, 463]],
  [[92, 526], [120, 533], [152, 537], [172, 532], [187, 519]],
  [[102, 576], [128, 583], [152, 585], [174, 578], [181, 567]],
  [[120, 610], [142, 618], [154, 624], [168, 618], [174, 606]],
];

// Lower leg. Row 0 is the knee line (shared with the thigh).
const SHANK: Grid = [
  THIGH[4],
  // The rows below the knee bow downward so the gastrocnemius bellies end in
  // a rounded arc rather than a straight "sock cuff" line across the calf.
  [[126, 646], [140, 654], [152, 658], [164, 654], [174, 646]],
  [[104, 702], [130, 718], [152, 726], [174, 716], [192, 700]],
  [[130, 760], [143, 772], [156, 778], [167, 770], [177, 756]],
  [[146, 806], [152, 810], [158, 810], [164, 808], [169, 802]],
];

// ---------------------------------------------------------------------------
// Free-hand silhouette pieces (head, neck, hand, feet)
// ---------------------------------------------------------------------------

// Head: rounded cranium tapering through the cheekbone into a squared jaw.
const HEAD = symmetric([
  [200, 26],
  [178, 29],
  [161, 48],
  [158, 76],
  [164, 96],
  [170, 110],
  [178, 124],
  [190, 134],
  [200, 137],
]);

// Hair: a short cropped cut — flat on top, tapering down over the temple and
// finishing above the ear, with a shallow fringe across the forehead.
const HAIR = symmetric([
  [200, 14],
  [176, 18],
  [160, 34],
  [154, 56],
  [153, 78],
  [159, 80],
  [162, 60],
  [167, 50],
  [178, 46],
  [200, 45],
]);

// Back-of-head hair: the same crop up top, but instead of stopping at the
// temple it keeps going — a full cap that covers the crown all the way down
// to the nape, with a narrow waist at ear height so the ear still pokes out.
const HAIR_BACK = symmetric([
  [200, 12],
  [172, 15],
  [153, 32],
  [145, 58],
  [148, 78],
  [169, 88],
  [167, 98],
  [170, 108],
  [148, 120],
  [143, 130],
  [168, 138],
  [200, 140],
]);

// Drawn before the head so only the outer rim of each ear shows.
const EAR_PROFILE: Section = [[163, 84], [155, 87], [152, 97], [157, 106], [164, 103]];
const EARS = [
  loop(EAR_PROFILE),
  loop(EAR_PROFILE.map(([x, y]) => [FIGURE_WIDTH - x, y] as Pt)),
];

// Back view: same ear, pulled in a touch so it reads narrower from behind.
const EAR_PROFILE_BACK: Section = [[163, 84], [157, 87], [156, 97], [159, 106], [164, 103]];
const EARS_BACK = [
  loop(EAR_PROFILE_BACK),
  loop(EAR_PROFILE_BACK.map(([x, y]) => [FIGURE_WIDTH - x, y] as Pt)),
];

// Thick athletic neck running into the trap slope.
const NECK = symmetric([
  [200, 118],
  [186, 122],
  [178, 136],
  [175, 150],
  [168, 162],
  [158, 172],
  [176, 177],
  [200, 179],
]);

const HAND = (() => {
  const wristOuter: Pt = [50, 504];
  const wristInner: Pt = [80, 500];
  const thumb = digit([46, 522], -54, 21, 7.4);
  const index = digit([47, 554], -10, 23, 6.8);
  const middle = digit([59, 557], 0, 26, 7);
  const ring = digit([71, 555], 11, 23, 6.6);
  const pinky = digit([83, 544], 26, 19, 5.8);
  return (
    `M${pt(wristOuter)} ` +
    `${curve([47, 508], [44, 512], thumb.start)} ` +
    `${thumb.path} ` +
    `${curve([46, 532], [42, 544], index.start)} ` +
    `${index.path} ` +
    `${web(index.end, middle.start, 3)} ` +
    `${middle.path} ` +
    `${web(middle.end, ring.start, 3)} ` +
    `${ring.path} ` +
    `${web(ring.end, pinky.start, 3)} ` +
    `${pinky.path} ` +
    `${curve([92, 540], [88, 514], wristInner)} Z`
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
  {
    id: "quads_vasti",
    shapes: [block(THIGH, 0.15, 4, 0, 1, 0.13), block(THIGH, 1.1, 4, 2, 3, 0.13)],
    fibres: fibres(THIGH, [
      [[0.45, 0.35], [3.8, 0.62]],
      [[0.45, 0.75], [3.8, 0.85]],
      [[1.45, 2.5], [3.8, 2.6]],
    ]),
  },
  {
    id: "quads_rectus_femoris",
    shapes: [block(THIGH, 0.15, 4, 1, 2, 0.13)],
    fibres: fibres(THIGH, [
      [[0.3, 1.3], [3.85, 1.42]],
      [[0.3, 1.7], [3.85, 1.6]],
    ]),
  },
  {
    id: "adductors",
    shapes: [block(THIGH, 0.15, 2.2, 3, 4, 0.13)],
    fibres: fibres(THIGH, [
      [[0.25, 3.85], [1.85, 3.3]],
      [[0.6, 3.9], [1.85, 3.62]],
    ]),
  },
  {
    // Just lateral to the tibia, between the peroneal group and the shin
    // ridge (both of which stay silhouette).
    id: "tibialis_anterior",
    shapes: [block(SHANK, 0.8, 3.2, 1.2, 2.15, 0.14)],
    fibres: fibres(SHANK, [
      [[1.05, 1.35], [3.0, 1.7]],
      [[1.05, 1.7], [3.0, 1.85]],
    ]),
  },

  // Chest: three wedges of one fan, fibres converging on the humerus.
  {
    id: "upper_chest",
    shapes: [block(PEC, 0.04, 1, 0, 2.95, 0.08)],
    fibres: fibres(PEC, [
      [[0.28, 0.12], [0.62, 2.85]],
      [[0.68, 0.12], [0.82, 2.85]],
    ]),
  },
  {
    id: "mid_chest",
    shapes: [block(PEC, 1, 2, 0, 2.95, 0.08)],
    fibres: fibres(PEC, [
      [[1.3, 0.12], [1.42, 2.85]],
      [[1.68, 0.12], [1.62, 2.85]],
    ]),
  },
  {
    id: "lower_chest",
    shapes: [block(PEC, 2, 2.96, 0, 2.95, 0.08)],
    fibres: fibres(PEC, [
      [[2.3, 0.12], [2.4, 2.85]],
      [[2.7, 0.12], [2.62, 2.85]],
    ]),
  },
  {
    id: "serratus_anterior",
    shapes: [block(TORSO_FRONT, 2.05, 3.5, 3.05, 3.95, 0.1)],
    // The finger-like slips reaching forward onto the ribs.
    fibres: fibres(TORSO_FRONT, [
      [[2.4, 3.85], [2.55, 3.2]],
      [[2.8, 3.85], [2.95, 3.2]],
      [[3.2, 3.85], [3.35, 3.2]],
    ]),
  },
  {
    // Four pairs, each rounded and slightly narrower than the one above, with
    // a deliberately thin midline inset so the linea alba reads as a crease
    // rather than a gutter. The grooves between the blocks are the tendinous
    // intersections, so no extra banding is drawn over them.
    id: "rectus_abdominis",
    shapes: [
      block(TORSO_FRONT, 3.05, 4.35, 0, 1.02, 0.11, [0.05, 0.16]),
      block(TORSO_FRONT, 4.35, 5.5, 0, 1.0, 0.11, [0.05, 0.16]),
      block(TORSO_FRONT, 5.5, 6.62, 0, 0.96, 0.11, [0.05, 0.17]),
      block(TORSO_FRONT, 6.62, 7.95, 0, 0.88, 0.12, [0.05, 0.18]),
    ],
    fibres: fibres(TORSO_FRONT, [
      [[3.35, 0.55], [4.05, 0.55]],
      [[4.6, 0.54], [5.25, 0.54]],
      [[5.75, 0.52], [6.35, 0.52]],
      [[6.9, 0.48], [7.65, 0.48]],
    ]),
  },
  {
    id: "obliques",
    shapes: [block(TORSO_FRONT, 3.9, 8, 1, 3, 0.1)],
    // External oblique fibres run down-and-in toward the pubis.
    fibres: fibres(TORSO_FRONT, [
      [[4.25, 3.8], [5.9, 1.25]],
      [[5.15, 3.8], [6.8, 1.25]],
      [[6.05, 3.8], [7.7, 1.25]],
    ]),
  },
  {
    // Iliopsoas / TFL at the hip crease: deliberately modest, wedged between
    // the lower abs, the obliques and the top of rectus femoris.
    id: "hip_flexors",
    shapes: [block(TORSO_FRONT, 8.0, 8.95, [1.35, 1.6], [2.95, 2.75], 0.14, 0.16)],
    fibres: fibres(TORSO_FRONT, [
      [[8.15, 2.9], [8.7, 2.0]],
      [[8.35, 3.0], [8.8, 2.4]],
    ]),
  },

  // Arms, then the deltoid cap on top of the arm's shoulder end.
  {
    id: "biceps",
    shapes: [block(UPPER_ARM, 0.22, 1.92, 1, 3.1, 0.1)],
    fibres: fibres(UPPER_ARM, [
      [[0.15, 1.5], [1.85, 1.5]],
      [[0.15, 2.5], [1.85, 2.5]],
    ]),
  },
  {
    id: "brachialis_brachioradialis",
    shapes: [block(UPPER_ARM, 0.9, 2, 0, 1.05, 0.1), block(FOREARM, 0, 1.8, 0, 1, 0.1)],
    fibres:
      fibres(UPPER_ARM, [[[0.2, 0.5], [1.85, 0.5]]]) +
      " " +
      fibres(FOREARM, [[[0.2, 0.45], [1.85, 0.55]]]),
  },
  {
    id: "forearms",
    shapes: [block(FOREARM, 0.12, 2.95, 1, 4, 0.09), block(FOREARM, 1.9, 2.95, 0, 1, 0.09)],
    fibres: fibres(FOREARM, [
      [[0.35, 1.6], [2.8, 1.85]],
      [[0.35, 2.6], [2.8, 2.55]],
    ]),
  },
  {
    // Sternocleidomastoid strips either side of the throat.
    id: "neck",
    shapes: [block(SCM, 0, 2, 0, 1, 0.12)],
    fibres: fibres(SCM, [[[0.3, 0.5], [1.7, 0.5]]]),
  },
  {
    // Front view of the trap: the neck-to-shoulder slope above the clavicle.
    id: "upper_traps",
    shapes: [block(TRAP_FRONT, 0, 1, 0, 3, 0.12)],
    fibres: fibres(TRAP_FRONT, [[[0.5, 0.25], [0.5, 2.75]]]),
  },
  {
    // Drawn after the pec and the trap, and extended a little past the
    // deltoid grid's medial rail, so the delt rounds *over* the pec insertion
    // instead of meeting it at a hard vertical seam.
    id: "front_delt",
    shapes: [block(DELT, 0.05, 2.95, -0.16, 1, 0.13, [0.2, 0.13])],
    // Radiating from the clavicle down to the V insertion.
    fibres: fibres(DELT, [
      [[0.2, 0.2], [2.85, 0.55]],
      [[0.2, 0.55], [2.85, 0.68]],
      [[0.2, 0.85], [2.85, 0.8]],
    ]),
  },
  {
    id: "side_delt",
    shapes: [block(DELT, 0.05, 2.95, 1, 2, 0.13)],
    fibres: fibres(DELT, [
      [[0.2, 1.25], [2.85, 1.42]],
      [[0.2, 1.65], [2.85, 1.58]],
    ]),
  },
];

const FRONT_SILHOUETTE: string[] = [
  // Lower leg: peroneals on the outside and the medial shin edge stay
  // silhouette; tibialis anterior between them is now an addressable region.
  block(SHANK, 0.8, 3.5, 0.1, 1.15, 0.14),
  block(SHANK, 0.8, 3.5, 2.85, 3.9, 0.14),
  block(SHANK, 0, 0.75, 0.6, 3.4, 0.14),
  // Sartorius / inner-knee strip below the adductors.
  block(THIGH, 2, 4, 3, 4),
  // Pubic region and the outer hip, either side of the hip flexors.
  block(TORSO_FRONT, 7.95, 9, 0, 1.1, 0.1),
  block(TORSO_FRONT, 8, 9, 3.15, 4, 0.1),
  // Triceps edge showing on the medial side of the arm.
  block(UPPER_ARM, 0.25, 1.95, 3.1, 4, 0.1),
  HAND,
  FOOT_FRONT,
];

const FRONT_DETAILS: string[] = [
  // Brow, cheekbone and jaw, so the head is not a featureless blob.
  "M186,84 C178,80 170,80 164,84",
  "M172,106 C176,112 180,116 184,118",
  // Clavicle.
  "M194,166 C178,160 158,161 142,170",
  // Instep and the four toe clefts.
  "M151,812 C145,822 141,832 140,842",
  "M133,838 C134,845 135,850 136,853",
  "M143,842 C144,848 145,851 145,854",
  "M154,844 C155,849 155,852 155,855",
  "M165,843 C165,848 165,851 164,853",
  // Palm creases: this is the palm side of the hand.
  "M52,518 C62,522 72,522 80,518",
  "M50,528 C62,533 74,533 84,527",
  "M52,538 C64,541 74,540 82,535",
];

// ---------------------------------------------------------------------------
// Back view
// ---------------------------------------------------------------------------

const BACK_REGIONS: MuscleRegion[] = [
  {
    id: "hamstrings",
    shapes: [block(THIGH, 0.1, 4, 0, 1, 0.13), block(THIGH, 0.1, 4, 1, 3, 0.13)],
    fibres: fibres(THIGH, [
      [[0.35, 0.5], [3.85, 0.6]],
      [[0.3, 1.5], [3.85, 1.5]],
      [[0.3, 2.5], [3.85, 2.5]],
    ]),
  },
  {
    id: "gastrocnemius",
    shapes: [block(SHANK, 1.1, 2.4, 0.2, 3.8, 0.13)],
    // Two heads, each converging toward the achilles below.
    fibres: fibres(SHANK, [
      [[1.15, 0.55], [1.9, 1.5]],
      [[1.15, 1.4], [1.9, 1.8]],
      [[1.15, 3.45], [1.9, 2.5]],
      [[1.15, 2.6], [1.9, 2.2]],
    ]),
  },
  {
    id: "soleus",
    shapes: [block(SHANK, 2.45, 3.45, 0.4, 3.6, 0.12)],
    fibres: fibres(SHANK, [
      [[2.15, 0.6], [2.85, 1.4]],
      [[2.15, 3.4], [2.85, 2.6]],
    ]),
  },

  {
    // Lower/medial mass only — the upper-outer corner is ceded to glute_med
    // (abductors), which anatomically sit above and lateral to glute max.
    id: "glute_max",
    shapes: [block(TORSO_BACK, 7.05, 9, 0, [1.55, 3], 0.09)],
    // Fibres run down-and-out from the sacrum to the femur.
    fibres: fibres(TORSO_BACK, [
      [[7.2, 0.25], [8.8, 2.4]],
      [[7.6, 0.25], [8.85, 1.6]],
      [[7.25, 1.2], [8.5, 2.55]],
    ]),
  },
  {
    // Abductors (glute med/min + TFL) as a crescent fan on the upper-lateral
    // hip: wide at the top near the iliac crest, narrowing toward the
    // greater trochanter, clearly separate from glute max's lower mass.
    id: "glute_med",
    shapes: [block(TORSO_BACK, 6.75, 8.4, [1.7, 3.1], 4, 0.13)],
    fibres: fibres(TORSO_BACK, [
      [[8.2, 3.35], [7.0, 2.2]],
      [[8.2, 3.6], [6.95, 2.7]],
      [[8.2, 3.8], [7.05, 3.2]],
    ]),
  },

  {
    // The thoracic sweep: from the armpit down and in toward the spine at
    // mid-back, under the teres/infraspinatus group.
    id: "lats_upper",
    shapes: [block(TORSO_BACK, 2.45, 4.35, [1.5, 1.3], 4, 0.09)],
    fibres: fibres(TORSO_BACK, [
      [[4.15, 1.5], [2.65, 3.6]],
      [[4.2, 2.2], [3.1, 3.75]],
      [[4.15, 2.9], [3.55, 3.8]],
    ]),
  },
  {
    // The lumbar sheet: wide at the bottom of the ribcage, tapering to the
    // iliac crest / thoracolumbar fascia.
    id: "lats_lower",
    shapes: [block(TORSO_BACK, 4.35, 6.5, [1.32, 1.25], [4, 3.05], 0.09)],
    fibres: fibres(TORSO_BACK, [
      [[6.2, 1.25], [4.6, 3.3]],
      [[6.25, 1.9], [5.1, 3.5]],
      [[5.35, 1.3], [4.5, 2.5]],
    ]),
  },
  {
    id: "neck",
    shapes: [block(NECK_BACK, 0, 2, 0, 1, 0.12)],
    fibres: fibres(NECK_BACK, [[[0.3, 0.5], [1.7, 0.5]]]),
  },
  {
    id: "upper_traps",
    shapes: [block(TORSO_BACK, 0, 1.05, 0, 3, 0.09)],
    fibres: fibres(TORSO_BACK, [
      [[0.3, 0.15], [0.85, 2.75]],
      [[0.6, 0.15], [0.95, 1.9]],
    ]),
  },
  {
    // Infraspinatus / teres on the scapula, below the rear delt and lateral
    // to the rhomboids.
    id: "rotator_cuff",
    // Kept medial of rail ~2.6: past that the deltoid, which is drawn last,
    // covers the scapula entirely.
    shapes: [block(TORSO_BACK, 1.25, 2.4, [1.72, 1.58], [2.6, 2.45], 0.08, 0.08)],
    fibres: fibres(TORSO_BACK, [
      [[2.2, 1.9], [1.5, 2.45]],
      [[2.3, 2.15], [1.75, 2.5]],
    ]),
  },
  {
    // Tapered toward the bottom of the scapula rather than a plain rectangle.
    id: "mid_traps_rhomboids",
    shapes: [block(TORSO_BACK, 1.05, 3.25, 0, [1.55, 1.05], 0.1)],
    fibres: fibres(TORSO_BACK, [
      [[1.4, 0.15], [1.25, 1.8]],
      [[2.1, 0.15], [1.95, 1.7]],
      [[2.8, 0.15], [2.65, 1.5]],
    ]),
  },
  {
    // Narrows as it runs down to its thoracic origin — the lower trap is a
    // triangle, not a bar.
    id: "lower_traps",
    shapes: [block(TORSO_BACK, 3.25, 5.15, 0, [1.05, 1.0], 0.1)],
    fibres: fibres(TORSO_BACK, [
      [[4.85, 0.15], [3.4, 0.9]],
      [[4.9, 0.4], [3.75, 0.92]],
    ]),
  },
  {
    // Thin at the thoracolumbar junction, thickest over the lumbar spine.
    id: "spinal_erectors",
    shapes: [block(TORSO_BACK, 5.15, 7, 0, [1.22, 1.1], 0.1)],
    fibres: fibres(TORSO_BACK, [
      [[5.25, 0.3], [6.85, 0.4]],
      [[5.3, 0.5], [6.85, 0.8]],
    ]),
  },

  {
    id: "triceps_lat_med",
    shapes: [block(UPPER_ARM, 0.2, 1.95, 0, 1, 0.1), block(UPPER_ARM, 0.2, 1.95, 1, 2, 0.1)],
    fibres: fibres(UPPER_ARM, [
      [[0.2, 0.5], [1.85, 0.75]],
      [[0.2, 1.5], [1.85, 1.55]],
    ]),
  },
  {
    id: "triceps_long",
    shapes: [block(UPPER_ARM, 0.15, 1.95, 2, 4, 0.1)],
    fibres: fibres(UPPER_ARM, [
      [[0.2, 2.5], [1.85, 2.4]],
      [[0.2, 3.5], [1.85, 3.3]],
    ]),
  },
  {
    id: "rear_delt",
    shapes: [block(DELT, 0.05, 2.95, 0, 1, 0.13)],
    fibres: fibres(DELT, [
      [[0.2, 0.2], [2.85, 0.55]],
      [[0.2, 0.55], [2.85, 0.68]],
      [[0.2, 0.85], [2.85, 0.8]],
    ]),
  },
  {
    id: "side_delt",
    shapes: [block(DELT, 0.05, 2.95, 1, 2, 0.13)],
    fibres: fibres(DELT, [
      [[0.2, 1.25], [2.85, 1.42]],
      [[0.2, 1.65], [2.85, 1.58]],
    ]),
  },
];

const BACK_SILHOUETTE: string[] = [
  // Forearm (anterior muscle group) reads as outline from behind.
  block(FOREARM, 0.12, 2.95, 0, 1, 0.09),
  block(FOREARM, 0.12, 2.95, 1, 3, 0.09),
  block(FOREARM, 0.12, 2.95, 3, 4, 0.09),
  // Thoracolumbar fascia / flank strip between the lower lat and the glutes.
  block(TORSO_BACK, 6.55, 7.05, [1.2, 1.35], 4, 0.13),
  HAND,
  FOOT_BACK,
];

const BACK_DETAILS: string[] = [
  // Achilles tendon.
  "M150,782 C150,794 151,802 152,810",
  // Heel.
  "M137,838 C146,844 160,844 170,838",
  // Knuckle row: this is the back of the hand, not the palm.
  "M42,551 C44,556 50,556 52,551",
  "M54,554 C56,559 62,559 64,554",
  "M66,552 C68,557 74,557 76,552",
  "M78,541 C80,546 86,546 88,541",
];

// ---------------------------------------------------------------------------
// Assembled views
// ---------------------------------------------------------------------------

const BASE = [full(THIGH), full(SHANK), full(UPPER_ARM), full(FOREARM), HAND];
const CENTRE_FRONT = [...EARS, HEAD, NECK];
const CENTRE_BACK = [...EARS_BACK, HEAD, NECK];
const OUTLINE = [full(UPPER_ARM), full(FOREARM), full(THIGH), full(SHANK)];

export const FRONT_ART: ViewArt = {
  base: [...BASE, full(TORSO_FRONT), FOOT_FRONT],
  centre: CENTRE_FRONT,
  hair: [HAIR],
  silhouette: FRONT_SILHOUETTE,
  regions: FRONT_REGIONS,
  outline: [...OUTLINE, full(TORSO_FRONT), FOOT_FRONT, HAND],
  details: FRONT_DETAILS,
};

export const BACK_ART: ViewArt = {
  base: [...BASE, full(TORSO_BACK), FOOT_BACK],
  centre: CENTRE_BACK,
  hair: [HAIR_BACK],
  silhouette: BACK_SILHOUETTE,
  regions: BACK_REGIONS,
  outline: [...OUTLINE, full(TORSO_BACK), FOOT_BACK, HAND],
  details: BACK_DETAILS,
};
