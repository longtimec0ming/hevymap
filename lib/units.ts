// Display-time kg <-> lbs conversion. See PLAN.md §11 and CLAUDE.md hard
// invariant #4: all storage and volume math stays in kg; this module only
// converts for display, and only when the caller explicitly asks for lbs.

const KG_PER_LB = 0.45359237;

export function kgToLbs(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

/** Converts a kg value to the requested display unit. */
export function convertWeight(kg: number, unit: "kg" | "lbs"): number {
  return unit === "lbs" ? kgToLbs(kg) : kg;
}

/** Formats a kg value for display in the given unit, e.g. "220 lbs" or
 * "100 kg". Rounds to the nearest whole unit, matching how tonnage and
 * set weights are already displayed elsewhere in the app. */
export function formatWeight(kg: number, unit: "kg" | "lbs"): string {
  const value = convertWeight(kg, unit);
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${unit}`;
}
