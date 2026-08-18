// Schema for data/muscle-map.json — see PLAN.md §5.

export type MappingConfidence = "high" | "medium" | "low";

export interface MuscleMapEntry {
  hevy_id: string;
  name: string;
  /** Sub-muscle ID (from data/taxonomy.ts) -> fraction of the set allocated to it. Must sum to 1.0 +/- 0.001. */
  contributions: Record<string, number>;
  confidence: MappingConfidence;
  notes?: string;
}

export type MuscleMap = MuscleMapEntry[];
