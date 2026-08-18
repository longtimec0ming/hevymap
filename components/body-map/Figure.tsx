"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import type { SubMuscleId } from "@/data/taxonomy";
import type { MuscleStatus } from "./color-scale";
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

// Line-art palette: a pale neutral body against the near-black app background
// with a single dark stroke weight, so only muscles carrying volume take a
// colour from the heat ramp. Muscles with no data keep the neutral fill —
// never invisible.
const BODY_FILL = "oklch(0.9 0 0)";
const BODY_FILL_OPACITY = 0.88;
const STROKE = "oklch(0.34 0.02 265)";
const STROKE_WIDTH = 1.2;
const OUTLINE_WIDTH = 1.9;
const DETAIL_STROKE = "oklch(0.48 0.02 265)";
const HIGHLIGHT_STROKE = "oklch(0.98 0 0)";

function MuscleShapes({
  region,
  status,
  isHighlighted,
  onMuscleClick,
  onMuscleHover,
  onMuscleFocus,
}: {
  region: MuscleRegion;
  status: MuscleStatus;
  isHighlighted: boolean;
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
    fill: status.isEmpty ? BODY_FILL : status.color,
    fillOpacity: status.isEmpty ? BODY_FILL_OPACITY : 1,
    stroke: isHighlighted ? HIGHLIGHT_STROKE : STROKE,
    strokeWidth: isHighlighted ? 2.4 : STROKE_WIDTH,
    "data-muscle-id": region.id,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": region.id,
    className:
      "cursor-pointer outline-none transition-[stroke,stroke-width] duration-150 focus-visible:stroke-white",
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
  statusByMuscle,
  highlightedMuscleId,
  onMuscleClick,
  onMuscleHover,
  onMuscleFocus,
}: { art: ViewArt } & Omit<FigureProps, "view">) {
  return (
    <>
      <g fill={BODY_FILL} fillOpacity={BODY_FILL_OPACITY} pointerEvents="none">
        {art.base.map((d, i) => (
          <path key={`base-${i}`} d={d} />
        ))}
      </g>

      <g
        fill={BODY_FILL}
        fillOpacity={BODY_FILL_OPACITY}
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
            onMuscleClick={onMuscleClick}
            onMuscleHover={onMuscleHover}
            onMuscleFocus={onMuscleFocus}
          />
        ))}
      </g>

      <g
        fill="none"
        stroke={STROKE}
        strokeWidth={OUTLINE_WIDTH}
        strokeLinejoin="round"
        pointerEvents="none"
      >
        {art.outline.map((d, i) => (
          <path key={`out-${i}`} d={d} />
        ))}
      </g>

      <g
        fill="none"
        stroke={DETAIL_STROKE}
        strokeWidth={1}
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

  return (
    <svg
      viewBox={VIEW_BOX}
      className="h-auto w-full max-w-[300px]"
      role="group"
      aria-label={`${view} body map`}
    >
      {/* Head, hair and neck are already symmetric, so they are drawn once
          (before the mirrored halves, which then overlap them at the jaw and
          shoulders) rather than as two halves with a seam down the face. */}
      <g
        fill={BODY_FILL}
        fillOpacity={BODY_FILL_OPACITY}
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        pointerEvents="none"
      >
        {art.centre.map((d, i) => (
          <path key={`centre-${i}`} d={d} />
        ))}
      </g>
      <Half art={art} {...rest} />
      <g transform={MIRROR_TRANSFORM}>
        <Half art={art} {...rest} />
      </g>
    </svg>
  );
}
