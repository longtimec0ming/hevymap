import { NO_VOLUME_FILL, volumeToColor } from "./color-scale";

// Representative stops sampled from the ramp itself (rather than duplicated
// constants) so the legend can never drift out of sync with volumeToColor.
const STOPS: ReadonlyArray<{ label: string; sets: number }> = [
  { label: "No data", sets: 0 },
  { label: "Below target", sets: 0.4 },
  { label: "In target", sets: 1.4 },
  { label: "Above target", sets: 3 },
];
const SAMPLE_BAND: readonly [number, number] = [1, 2];

export function Legend({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-xs text-zinc-400 ${className ?? ""}`}>
      {STOPS.map(({ label, sets }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm border border-zinc-600"
            style={{
              // "No data" muscles keep the figure's neutral muscle tone rather
              // than disappearing, so the swatch has to match it.
              background: sets === 0 ? NO_VOLUME_FILL : volumeToColor(sets, SAMPLE_BAND),
            }}
            aria-hidden
          />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
