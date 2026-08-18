"use client";

import { useId, type KeyboardEvent, type MouseEvent } from "react";
import type { SubMuscleId } from "@/data/taxonomy";
import { NO_VOLUME_FILL, type MuscleStatus } from "./color-scale";
import {
  BACK_ART,
  FRONT_ART,
  MIRROR_TRANSFORM,
  VIEW_BOX,
  type MuscleRegion,
  type ViewArt,
} from "./muscle-regions";

interface FigureProps {
  view: "front" | "back";
  statusByMuscle: Record<SubMuscleId, MuscleStatus>;
  highlightedMuscleId: SubMuscleId | null;
  onMuscleClick?: (muscleId: SubMuscleId) => void;
  onMuscleHover?: (muscleId: SubMuscleId | null) => void;
  onMuscleFocus?: (
    muscleId: SubMuscleId | null,
    event?: MouseEvent<SVGElement> | KeyboardEvent<SVGElement>,
  ) => void;
}

// Shaded palette: a dark body base with muscles as filled, striated shapes on
// top. Muscles with no volume keep a neutral muscle tone — darker than an
// active one, but never invisible, and still clearly a muscle.
const BODY_BASE = "oklch(0.22 0.012 265)";
/** Non-interactive anatomy (tibialis, serratus, hands, head): between the
 * body base and a real muscle, so it reads as form rather than as data. */
const SILHOUETTE_FILL = "oklch(0.31 0.014 265)";
const STROKE = "oklch(0.14 0.012 265)";
const STROKE_WIDTH = 0.9;
/** Body contour: a faint rim so the silhouette separates from a black card. */
const RIM = "oklch(0.44 0.02 265)";
const FIBRE_STROKE = "oklch(0.08 0.01 265)";
const DETAIL_STROKE = "oklch(0.46 0.016 265)";
const HIGHLIGHT_STROKE = "oklch(0.98 0 0)";

function MuscleShapes({
  region,
  status,
  isHighlighted,
  sheenId,
  onMuscleClick,
  onMuscleHover,
  onMuscleFocus,
}: {
  region: MuscleRegion;
  status: MuscleStatus;
  isHighlighted: boolean;
  sheenId: string;
  onMuscleClick?: (muscleId: SubMuscleId) => void;
  onMuscleHover?: (muscleId: SubMuscleId | null) => void;
  onMuscleFocus?: (
    muscleId: SubMuscleId | null,
    event?: MouseEvent<SVGElement> | KeyboardEvent<SVGElement>,
  ) => void;
}) {
  const handleClick = () => onMuscleClick?.(region.id);
  const handleEnter = (event: MouseEvent<SVGElement>) => {
    onMuscleHover?.(region.id);
    onMuscleFocus?.(region.id, event);
  };
  const handleLeave = () => {
    onMuscleHover?.(null);
    onMuscleFocus?.(null);
  };
  // Keyboard focus carries no pointer position, so the tooltip anchors to the
  // container instead (see BodyMap's handleFocus).
  const handleFocus = () => {
    onMuscleHover?.(region.id);
    onMuscleFocus?.(region.id);
  };
  const handleBlur = () => {
    onMuscleHover?.(null);
    onMuscleFocus?.(null);
  };
  const handleKeyDown = (event: KeyboardEvent<SVGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onMuscleClick?.(region.id);
    }
  };

  const props = {
    fill: status.isEmpty ? NO_VOLUME_FILL : status.color,
    stroke: isHighlighted ? HIGHLIGHT_STROKE : STROKE,
    strokeWidth: isHighlighted ? 2 : STROKE_WIDTH,
    "data-muscle-id": region.id,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": region.id,
    className:
      "cursor-pointer outline-none transition-[stroke,stroke-width,filter] duration-150 focus-visible:stroke-white",
    style: isHighlighted ? { filter: "brightness(1.22)" } : undefined,
    onClick: handleClick,
    onMouseEnter: handleEnter,
    onMouseLeave: handleLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  };

  return (
    <>
      {region.shapes.map((d, i) => (
        <path key={`${region.id}-${i}`} d={d} {...props} />
      ))}
      {/* Rounding pass: one shared gradient, applied per path against its own
          bounding box, so every muscle gets a lit top edge and a shaded
          underside for the cost of one extra <path>. */}
      {region.shapes.map((d, i) => (
        <path key={`${region.id}-sheen-${i}`} d={d} fill={`url(#${sheenId})`} pointerEvents="none" />
      ))}
      {region.fibres && (
        <path
          d={region.fibres}
          fill="none"
          stroke={FIBRE_STROKE}
          strokeOpacity={0.26}
          strokeWidth={1}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
    </>
  );
}

/**
 * One half of the figure. The whole thing is authored for x <= 200 and this
 * is rendered twice — once as-is and once mirrored — so the two sides can
 * never drift apart. Both copies carry the same `data-muscle-id` and the same
 * handlers, and highlighting is keyed on the id, so hovering either side
 * lights up the muscle on both.
 */
function Half({
  art,
  sheenId,
  statusByMuscle,
  highlightedMuscleId,
  onMuscleClick,
  onMuscleHover,
  onMuscleFocus,
}: { art: ViewArt; sheenId: string } & Omit<FigureProps, "view">) {
  return (
    <>
      <g fill={BODY_BASE} pointerEvents="none">
        {art.base.map((d, i) => (
          <path key={`base-${i}`} d={d} />
        ))}
      </g>

      {/* Body contour, drawn under the muscles: a rim that shows only where
          no muscle covers it, so it can never cut a line across one. */}
      <g
        fill="none"
        stroke={RIM}
        strokeOpacity={0.55}
        strokeWidth={1}
        strokeLinejoin="round"
        pointerEvents="none"
      >
        {art.outline.map((d, i) => (
          <path key={`out-${i}`} d={d} />
        ))}
      </g>

      <g
        fill={SILHOUETTE_FILL}
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        pointerEvents="none"
      >
        {art.silhouette.map((d, i) => (
          <path key={`sil-${i}`} d={d} />
        ))}
      </g>

      <g strokeLinejoin="round">
        {art.regions.map((region) => (
          <MuscleShapes
            key={region.id}
            region={region}
            status={statusByMuscle[region.id]}
            isHighlighted={highlightedMuscleId === region.id}
            sheenId={sheenId}
            onMuscleClick={onMuscleClick}
            onMuscleHover={onMuscleHover}
            onMuscleFocus={onMuscleFocus}
          />
        ))}
      </g>

      <g
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth={0.9}
        strokeLinecap="round"
        pointerEvents="none"
      >
        {art.details.map((d, i) => (
          <path key={`det-${i}`} d={d} />
        ))}
      </g>
    </>
  );
}

export function Figure({ view, ...rest }: FigureProps) {
  const art = view === "front" ? FRONT_ART : BACK_ART;
  // Two figures share a document, so the gradient id has to be per-instance.
  const sheenId = `${useId()}-sheen`;

  return (
    <svg
      viewBox={VIEW_BOX}
      className="h-auto w-full max-w-[300px]"
      role="group"
      aria-label={`${view} body map`}
    >
      <defs>
        {/* objectBoundingBox units (the default), so this single gradient
            re-lights every muscle relative to its own shape. */}
        <linearGradient id={sheenId} x1="0.12" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.26" />
          <stop offset="42%" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Head, hair and neck are already symmetric, so they are drawn once
          (before the mirrored halves, which then overlap them at the jaw and
          shoulders) rather than as two halves with a seam down the face. */}
      <g
        fill={SILHOUETTE_FILL}
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        pointerEvents="none"
      >
        {art.centre.map((d, i) => (
          <path key={`centre-${i}`} d={d} />
        ))}
      </g>
      <g fill={BODY_BASE} stroke={STROKE} strokeWidth={STROKE_WIDTH} pointerEvents="none">
        {art.hair.map((d, i) => (
          <path key={`hair-${i}`} d={d} />
        ))}
      </g>
      <Half art={art} sheenId={sheenId} {...rest} />
      <g transform={MIRROR_TRANSFORM}>
        <Half art={art} sheenId={sheenId} {...rest} />
      </g>
    </svg>
  );
}
