"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import type { SubMuscleId } from "@/data/taxonomy";
import type { MuscleStatus } from "./color-scale";
import {
  BACK_REGIONS,
  DETAIL_LINES_BACK,
  DETAIL_LINES_FRONT,
  FRONT_REGIONS,
  SILHOUETTE_BACK,
  SILHOUETTE_FRONT,
  VIEW_BOX,
  type MuscleRegion,
  type MuscleShape,
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

const OUTLINE_COLOR = "#e2e8f0";
const OUTLINE_WIDTH = 1.1;
const SILHOUETTE_FILL = "#1c2128";
const SILHOUETTE_STROKE = "#31363f";

function shapeToSvg(shape: MuscleShape, extraProps: Record<string, unknown>) {
  return <path d={shape.d} {...extraProps} />;
}

function MuscleRegionShapes({
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
  const fill = status.isEmpty ? SILHOUETTE_FILL : status.color;
  const stroke = isHighlighted ? "#f8fafc" : status.isEmpty ? "#454b56" : "rgba(15,17,21,0.55)";
  const strokeWidth = isHighlighted ? 2.5 : status.isEmpty ? 1 : 1;

  const handleClick = () => onMuscleClick?.(region.id);
  const handleEnter = (event: MouseEvent<SVGElement>) => {
    onMuscleHover?.(region.id);
    onMuscleFocus?.(region.id, event);
  };
  const handleLeave = () => {
    onMuscleHover?.(null);
    onMuscleFocus?.(null);
  };
  const handleFocus = (event: KeyboardEvent<SVGElement>) => {
    onMuscleHover?.(region.id);
    onMuscleFocus?.(region.id, event);
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

  const shapeProps = {
    fill,
    stroke,
    strokeWidth,
    "data-muscle-id": region.id,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": region.id,
    className: "cursor-pointer outline-none transition-[stroke,stroke-width,filter] duration-150 focus-visible:stroke-white",
    style: isHighlighted ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.55))" } : undefined,
    onClick: handleClick,
    onMouseEnter: handleEnter,
    onMouseLeave: handleLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  };

  return (
    <>
      {region.shapes.map((shape, i) => (
        <g key={`${region.id}-${i}`}>{shapeToSvg(shape, shapeProps)}</g>
      ))}
      {region.mirror && (
        <g transform="translate(300,0) scale(-1,1)">
          {region.shapes.map((shape, i) => (
            <g key={`${region.id}-mirror-${i}`}>{shapeToSvg(shape, shapeProps)}</g>
          ))}
        </g>
      )}
    </>
  );
}

export function Figure({
  view,
  statusByMuscle,
  highlightedMuscleId,
  onMuscleClick,
  onMuscleHover,
  onMuscleFocus,
}: FigureProps) {
  const regions = view === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const silhouette = view === "front" ? SILHOUETTE_FRONT : SILHOUETTE_BACK;
  const detailLines = view === "front" ? DETAIL_LINES_FRONT : DETAIL_LINES_BACK;

  return (
    <svg
      viewBox={VIEW_BOX}
      className="h-auto w-full max-w-[300px]"
      role="group"
      aria-label={`${view} body map`}
    >
      {/* Background silhouette — non-interactive anatomical guide */}
      <g fill={SILHOUETTE_FILL} stroke={SILHOUETTE_STROKE} strokeWidth={OUTLINE_WIDTH} pointerEvents="none">
        {shapeToSvg(silhouette.legLeft, {})}
        <g transform="translate(300,0) scale(-1,1)">{shapeToSvg(silhouette.legLeft, {})}</g>
        {shapeToSvg(silhouette.footLeft, {})}
        <g transform="translate(300,0) scale(-1,1)">{shapeToSvg(silhouette.footLeft, {})}</g>
        {shapeToSvg(silhouette.armLeft, {})}
        <g transform="translate(300,0) scale(-1,1)">{shapeToSvg(silhouette.armLeft, {})}</g>
        {shapeToSvg(silhouette.handLeft, {})}
        <g transform="translate(300,0) scale(-1,1)">{shapeToSvg(silhouette.handLeft, {})}</g>
        {shapeToSvg(silhouette.torso, {})}
        {shapeToSvg(silhouette.neck, {})}
        {shapeToSvg(silhouette.head, {})}
        {shapeToSvg(silhouette.hair, {})}
      </g>

      {/* Addressable muscle regions */}
      <g stroke={OUTLINE_COLOR} strokeLinejoin="round">
        {regions.map((region) => (
          <MuscleRegionShapes
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

      {/* Decorative detail lines (ab segmentation, spine hint, ...) */}
      <g fill="none" stroke={SILHOUETTE_STROKE} strokeWidth={0.9} strokeLinecap="round" pointerEvents="none">
        {detailLines.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
