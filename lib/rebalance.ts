// Pure auto-rebalance math for the mapping editor's sliders (PLAN.md §6,
// CLAUDE.md invariant #2: contributions must always sum to 1.0). Generic
// over the key type so it has no dependency on data/taxonomy — the editor
// calls it with SubMuscleId, tests call it with plain strings.
//
// Semantics: set `changedId` to `newValue` (clamped), then scale every
// other *unlocked* entry proportionally so the whole map sums to exactly
// 1.0. Locked entries are never touched (their combined value is
// subtracted from the budget available to everyone else, and a requested
// value that would violate that budget is clamped down to what's left).
//
// Edge cases (documented, not accidental):
// - `newValue` is clamped to [0, 1 - lockedSum] before anything else runs.
//   A slider can never push the total over 1.0 by stealing from a locked
//   entry.
// - If the unlocked "others" are all zero, there's nothing to scale
//   proportionally (any ratio times zero is zero), so the remaining budget
//   is split equally across them instead.
// - If there are no unlocked "others" at all (every other entry is
//   locked), there's nowhere for the remainder to go — `changedId` is
//   forced to absorb whatever budget locked entries leave behind
//   (1 - lockedSum), overriding the requested value. This is a deliberate
//   "refuse and clamp" rather than silently leaving the total off 1.0.
// - Setting `newValue` to 0 for the changed entry (e.g. removing a muscle
//   row) redistributes its whole share proportionally across the others —
//   no separate "remove" function needed, callers just rebalance to 0.
// - Setting `newValue` to 1 (with nothing locked) zeroes every other entry.
// - Output is rounded to 3dp; any rounding drift left over after that is
//   pushed onto the largest unlocked entry so the total lands on exactly
//   1 (not 0.999/1.001).

const EPSILON = 1e-6;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Rebalances a contribution map so it always sums to 1.0. See file header
 * for the full edge-case semantics. Does not mutate `contributions`; keys
 * not present in the input never appear in the output (callers control
 * which rows exist by what they pass in). */
export function rebalance(
  contributions: Record<string, number>,
  changedId: string,
  newValue: number,
  locked: ReadonlySet<string> = new Set(),
): Record<string, number> {
  const ids = Object.keys(contributions);

  const lockedSum = ids
    .filter((id) => id !== changedId && locked.has(id))
    .reduce((sum, id) => sum + (contributions[id] ?? 0), 0);

  const budgetForRest = Math.max(0, 1 - lockedSum);
  const clampedValue = Math.min(Math.max(newValue, 0), budgetForRest);

  const others = ids.filter((id) => id !== changedId && !locked.has(id));
  const remainingBudget = Math.max(0, 1 - clampedValue - lockedSum);

  const result: Record<string, number> = { ...contributions };
  result[changedId] = clampedValue;

  if (others.length === 0) {
    // Nowhere for the remainder to go: changedId must absorb the entire
    // non-locked budget, regardless of what was requested.
    result[changedId] = budgetForRest;
  } else {
    const othersSum = others.reduce((sum, id) => sum + (contributions[id] ?? 0), 0);
    if (othersSum > EPSILON) {
      const scale = remainingBudget / othersSum;
      for (const id of others) result[id] = (contributions[id] ?? 0) * scale;
    } else if (remainingBudget > EPSILON) {
      const share = remainingBudget / others.length;
      for (const id of others) result[id] = share;
    } else {
      for (const id of others) result[id] = 0;
    }
  }

  for (const id of ids) result[id] = round3(result[id]);

  const total = ids.reduce((sum, id) => sum + result[id], 0);
  const drift = round3(1 - total);
  if (drift !== 0) {
    const unlockedIds = ids.filter((id) => !locked.has(id));
    const candidates = unlockedIds.length > 0 ? unlockedIds : ids;
    const target = candidates.reduce((best, id) => (result[id] > result[best] ? id : best), candidates[0]);
    result[target] = round3(result[target] + drift);
  }

  return result;
}
