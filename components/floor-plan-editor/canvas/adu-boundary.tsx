"use client";

import React from "react";
import { Line, Circle, Text, Group } from "react-konva";
import type Konva from "konva";
import type { Point } from "@/lib/types";
import type { CanvasConfig } from "../types";

interface ADUBoundaryProps {
  config: CanvasConfig;
  boundary: Point[];
  editMode: boolean;
  selectedPointIndex: number | null;
  onPointDrag: (index: number, newPos: Point) => void;
  onPointSelect: (index: number | null) => void;
  onAddPoint?: (afterIndex: number, point: Point) => void;
  onRemovePoint?: (index: number) => void;
}

export function ADUBoundary({
  config,
  boundary,
  editMode,
  selectedPointIndex,
  onPointDrag,
  onPointSelect,
  onAddPoint,
  onRemovePoint,
}: ADUBoundaryProps) {
  const { gridSize, pixelsPerFoot } = config;

  // Snap to half-grid (0.5 foot increments)
  const halfGrid = gridSize / 2;
  const snapToGrid = (value: number) => Math.round(value / halfGrid) * halfGrid;

  // Handle click on boundary line to add point
  const handleBoundaryClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!editMode || !onAddPoint) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Get the transform to convert stage coords to layer coords
    const transform = e.target.getAbsoluteTransform().copy().invert();
    const point = transform.point(pos);

    const x = snapToGrid(point.x);
    const y = snapToGrid(point.y);

    // Find closest edge to insert point
    let closestEdge = 0;
    let minDist = Infinity;

    for (let i = 0; i < boundary.length; i++) {
      const p1 = boundary[i];
      const p2 = boundary[(i + 1) % boundary.length];

      // Calculate distance from point to line segment
      const dist = Math.abs((p2.y - p1.y) * x - (p2.x - p1.x) * y + p2.x * p1.y - p2.y * p1.x) /
                   Math.sqrt((p2.y - p1.y) ** 2 + (p2.x - p1.x) ** 2);

      if (dist < minDist) {
        minDist = dist;
        closestEdge = i;
      }
    }

    onAddPoint(closestEdge, { x, y });
  };

  // Format feet to feet-inches string
  const formatFeetInches = (feet: number): string => {
    const wholeFeet = Math.floor(feet);
    const inches = Math.round((feet - wholeFeet) * 12);
    if (inches === 0) {
      return `${wholeFeet}'-0"`;
    }
    return `${wholeFeet}'-${inches}"`;
  };

  // Create flat array of points for Line component
  const boundaryFlatPoints = boundary.flatMap(p => [p.x, p.y]);

  return (
    <Group>
      {/* ADU Boundary polygon */}
      <Line
        points={boundaryFlatPoints}
        closed
        stroke="#dc2626"
        strokeWidth={editMode ? 4 : 2}
        dash={[10, 5]}
        listening={editMode}
        onClick={handleBoundaryClick}
        onTap={handleBoundaryClick}
        hitStrokeWidth={editMode ? 20 : 0}
      />

      {/* Boundary edge labels (dimensions) */}
      {boundary.map((point, i) => {
        const nextPoint = boundary[(i + 1) % boundary.length];
        const midX = (point.x + nextPoint.x) / 2;
        const midY = (point.y + nextPoint.y) / 2;

        // Calculate distance in feet
        const distPx = Math.sqrt(
          Math.pow(nextPoint.x - point.x, 2) +
          Math.pow(nextPoint.y - point.y, 2)
        );
        const distFeet = distPx / pixelsPerFoot;

        // Determine if edge is more horizontal or vertical
        const isHorizontal = Math.abs(nextPoint.x - point.x) > Math.abs(nextPoint.y - point.y);

        // Calculate label offset
        const labelOffset = 15;
        const labelX = isHorizontal ? midX : midX + labelOffset;
        const labelY = isHorizontal ? midY - labelOffset : midY;

        return (
          <Text
            key={`boundary-label-${i}`}
            x={labelX}
            y={labelY}
            text={formatFeetInches(distFeet)}
            fontSize={12}
            fill="#dc2626"
            fontStyle="bold"
            align="center"
            offsetX={isHorizontal ? 20 : 0}
            listening={false}
          />
        );
      })}

      {/* Edit mode: Draggable boundary points */}
      {editMode && boundary.map((point, index) => (
        <Circle
          key={`boundary-point-${index}`}
          x={point.x}
          y={point.y}
          radius={selectedPointIndex === index ? 12 : 8}
          fill={selectedPointIndex === index ? "#dc2626" : "#ef4444"}
          stroke="#ffffff"
          strokeWidth={2}
          draggable
          onClick={() => onPointSelect(index)}
          onTap={() => onPointSelect(index)}
          onDblClick={() => onRemovePoint?.(index)}
          onDblTap={() => onRemovePoint?.(index)}
          onDragMove={(e) => {
            const pos = e.target.position();
            const snapped = {
              x: snapToGrid(pos.x),
              y: snapToGrid(pos.y),
            };
            e.target.position(snapped);
            // Real-time update to parent state
            onPointDrag(index, snapped);
          }}
          onDragEnd={(e) => {
            const pos = e.target.position();
            onPointDrag(index, { x: snapToGrid(pos.x), y: snapToGrid(pos.y) });
          }}
          style={{ cursor: "move" }}
        />
      ))}
    </Group>
  );
}
