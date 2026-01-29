"use client";

import React from "react";
import { Line, Circle, Text, Group } from "react-konva";
import type { Point } from "@/lib/types";
import type { CanvasConfig } from "../types";

interface ADUBoundaryProps {
  config: CanvasConfig;
  boundary: Point[];
  editMode: boolean;
  selectedPointIndex: number | null;
  onPointDrag: (index: number, newPos: Point) => void;
  onPointSelect: (index: number | null) => void;
}

export function ADUBoundary({
  config,
  boundary,
  editMode,
  selectedPointIndex,
  onPointDrag,
  onPointSelect,
}: ADUBoundaryProps) {
  const { gridSize, pixelsPerFoot } = config;

  // Snap to grid
  const snapToGrid = (value: number) => Math.round(value / gridSize) * gridSize;

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
        strokeWidth={2}
        dash={[10, 5]}
        listening={!editMode}
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
          onDragMove={(e) => {
            const pos = e.target.position();
            const snapped = {
              x: snapToGrid(pos.x),
              y: snapToGrid(pos.y),
            };
            e.target.position(snapped);
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
