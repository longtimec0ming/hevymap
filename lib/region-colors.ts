// Shared color ramp for the 6 coarse muscle regions (Shoulders, Chest, Back,
// Arms, Core, Legs — data/taxonomy.ts's region order), so every chart/UI
// piece that breaks volume down by region uses the same color for the same
// region. One accent hue with tints (PLAN.md §12): the theme's chart-1..5
// ramp plus the brand color itself cover the 6 regions.

export const REGION_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--brand)",
];
