// Shared color ramp for the 7 coarse muscle regions (Shoulders, Chest, Back,
// Traps, Arms, Core, Legs — data/taxonomy.ts's region order), so every
// chart/UI piece that breaks volume down by region uses the same color for
// the same region. One accent hue with tints (PLAN.md §12): the theme's
// chart-1..5 ramp, the brand color, and one more tint (--chart-6, added
// alongside taxonomy v2's Traps region) cover the 7 regions.

export const REGION_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-6)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--brand)",
];
