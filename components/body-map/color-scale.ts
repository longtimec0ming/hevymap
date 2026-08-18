// Pure heatmap color-ramp + percent-of-target math for the body map.
// Kept separate from the JSX so it's cleanly unit-testable (see color-scale.test.ts).

export type TargetBand = readonly [number, number];

/** Hue used for "neglected" (below target): a desaturated slate-blue, NOT
 * part of the accent ramp itself — this is the cold pole PLAN.md §9 calls
 * for ("cold/desaturated ... -> accent ... -> hot"), distinct from the
 * single accent hue used once volume enters/exceeds the target band. */
const COLD_HUE = 215;
/** Single restrained accent hue (orange) — the only hue used once a muscle
 * is at-or-above its target band, ramping darker/more saturated ("hot") as
 * volume overshoots further. Never a second, unrelated hue. */
const ACCENT_HUE = 22;
const HOT_HUE = 4;

/** Overshoot ratio (sets beyond max, as a fraction of max) at which the
 * "hot" end of the ramp is fully reached. Chosen so a muscle at 2x its
 * target ceiling reads as fully hot rather than needing extreme volumes. */
const OVERSHOOT_SATURATES_AT = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hsl(hue: number, saturation: number, lightness: number): string {
  return `hsl(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(lightness)}%)`;
}

/** Percent of target-min represented by `sets` (0 target sets => 0% unless
 * sets is also 0, to avoid a divide-by-zero reading as Infinity%). Rounded
 * to the nearest whole percent for display. */
export function percentOfTarget(sets: number, band: TargetBand): number {
  const [min] = band;
  if (min <= 0) return sets > 0 ? 100 : 0;
  return Math.round((sets / min) * 100);
}

/**
 * Maps a muscle's current volume (sets) against its weekly target band to a
 * CSS color string, per PLAN.md §9's cold -> accent -> hot ramp:
 *   - sets <= 0: "transparent" (caller should render a neutral outline)
 *   - 0 < sets < min: cold slate ramping toward the accent hue
 *   - min <= sets <= max: the accent hue (in-target)
 *   - sets > max: the accent hue ramping toward a hotter, darker shade
 */
export function volumeToColor(sets: number, band: TargetBand): string {
  const [min, max] = band;

  if (sets <= 0) return "transparent";

  if (sets < min) {
    const t = clamp(sets / min, 0, 1);
    const hue = lerp(COLD_HUE, ACCENT_HUE, t);
    const saturation = lerp(24, 80, t);
    // Floor matches NO_VOLUME_FILL's perceived lightness so a muscle with a
    // sliver of volume never reads as *less* present than one with none.
    const lightness = lerp(44, 50, t);
    return hsl(hue, saturation, lightness);
  }

  if (sets <= max) {
    const t = max > min ? clamp((sets - min) / (max - min), 0, 1) : 1;
    const lightness = lerp(52, 58, t);
    return hsl(ACCENT_HUE, 88, lightness);
  }

  const overshoot = max > 0 ? clamp((sets - max) / max, 0, OVERSHOOT_SATURATES_AT) / OVERSHOOT_SATURATES_AT : 1;
  const hue = lerp(ACCENT_HUE, HOT_HUE, overshoot);
  const lightness = lerp(58, 46, overshoot);
  return hsl(hue, 92, lightness);
}

/** Fill used for a muscle with no volume in scope: a neutral, clearly-lit
 * muscle tone on the figure's dark body base — light enough to read as its
 * own resting muscle plate rather than fading into the base or the
 * non-interactive silhouette fill. Shared by the figure and the legend so
 * the "No data" swatch always matches what the body map draws. */
export const NO_VOLUME_FILL = "oklch(0.46 0.02 265)";

export interface MuscleStatus {
  sets: number;
  tonnageKg: number;
  percentOfTarget: number;
  color: string;
  /** True when the muscle has zero logged volume in the current scope. */
  isEmpty: boolean;
}

/** Convenience wrapper bundling the color + percent + emptiness checks a
 * tooltip/legend needs for one muscle, given its raw sets/tonnage and band. */
export function getMuscleStatus(sets: number, tonnageKg: number, band: TargetBand): MuscleStatus {
  return {
    sets,
    tonnageKg,
    percentOfTarget: percentOfTarget(sets, band),
    color: volumeToColor(sets, band),
    isEmpty: sets <= 0,
  };
}

/** Legend stops (as fractions of the target band) used to render the
 * color-scale legend that ships with the component. */
export const LEGEND_STOPS: ReadonlyArray<{ label: string; color: string }> = [
  { label: "No data", color: NO_VOLUME_FILL },
  { label: "Below target", color: volumeToColor(0.5, [1, 2]) },
  { label: "In target", color: volumeToColor(1.5, [1, 2]) },
  { label: "Above target", color: volumeToColor(4, [1, 2]) },
];
