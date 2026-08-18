// Reusable validation logic for muscle-map.json entries.
// Enforces CLAUDE.md invariants #2 and #3:
//   2. Contributions must sum to 1.0 +/- 0.001.
//   3. Only canonical sub-muscle IDs from data/taxonomy.ts may appear as keys.

import { isValidSubMuscleId } from "./taxonomy";
import type { MuscleMapEntry } from "./types";

const SUM_TOLERANCE = 0.001;

export interface MuscleMapValidationError {
  hevy_id: string;
  name: string;
  message: string;
}

export interface MuscleMapValidationResult {
  valid: boolean;
  errors: MuscleMapValidationError[];
}

/** Validates a single muscle-map entry. Returns a list of error messages (empty = valid). */
export function validateEntry(entry: MuscleMapEntry): string[] {
  const errors: string[] = [];
  const keys = Object.keys(entry.contributions);

  const invalidKeys = keys.filter((key) => !isValidSubMuscleId(key));
  if (invalidKeys.length > 0) {
    errors.push(
      `invalid contribution key(s): ${invalidKeys.join(", ")} (not canonical sub-muscle IDs)`,
    );
  }

  const sum = Object.values(entry.contributions).reduce((acc, v) => acc + v, 0);
  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    errors.push(`contributions sum to ${sum}, expected 1.0 +/- ${SUM_TOLERANCE}`);
  }

  return errors;
}

/** Validates an entire muscle-map.json array. Vacuously valid for an empty array. */
export function validateMuscleMap(entries: MuscleMapEntry[]): MuscleMapValidationResult {
  const errors: MuscleMapValidationError[] = [];

  for (const entry of entries) {
    const entryErrors = validateEntry(entry);
    for (const message of entryErrors) {
      errors.push({ hevy_id: entry.hevy_id, name: entry.name, message });
    }
  }

  return { valid: errors.length === 0, errors };
}
