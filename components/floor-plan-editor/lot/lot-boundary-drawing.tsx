"use client";

import React from "react";
import { Line, Circle, Group } from "react-konva";
import type { Point } from "@/lib/types";

interface LotBoundaryDrawingProps {
  points: Point[];
  previewPoint: Point | null;
  isDrawing: boolean;
}

/**
 * Visual preview component for drawing lot boundary polygon.
 * Shows placed points, connecting lines, and preview line to cursor.
 */
export function LotBoundaryDrawing({
  points,
  previewPoint,
  isDrawing,
}: LotBoundaryDrawingProps) {
  if (!isDrawing || points.length === 0) return null;

  // Flatten points for the main line
  const linePoints = points.flatMap(p => [p.x, p.y]);

  // Add preview point to show where the next line would go
  const previewLinePoints = previewPoint
    ? [...linePoints, previewPoint.x, previewPoint.y]
    : linePoints;

  // If we have 3+ points, show a closing line preview
  const closingLinePoints = points.length >= 3 && previewPoint
    ? [previewPoint.x, previewPoint.y, points[0].x, points[0].y]
    : [];

  return (
    <Group>
      {/* Main polygon line (solid) */}
      <Line
        points={linePoints}
        stroke="#3b82f6"
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />

      {/* Preview line to cursor (dashed) */}
      {previewPoint && points.length > 0 && (
        <Line
          points={[points[points.length - 1].x, points[points.length - 1].y, previewPoint.x, previewPoint.y]}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[8, 4]}
          lineCap="round"
          listening={false}
        />
      )}

      {/* Closing line preview (if near completion) */}
      {closingLinePoints.length > 0 && (
        <Line
          points={closingLinePoints}
          stroke="#3b82f6"
          strokeWidth={1}
          dash={[4, 4]}
          opacity={0.5}
          listening={false}
        />
      )}

      {/* Vertex points */}
      {points.map((point, index) => (
        <Circle
          key={`lot-vertex-${index}`}
          x={point.x}
          y={point.y}
          radius={index === 0 ? 8 : 5}
          fill={index === 0 ? "#22c55e" : "#3b82f6"}
          stroke="#ffffff"
          strokeWidth={2}
          listening={false}
        />
      ))}

      {/* First point highlight (click to close) */}
      {points.length >= 3 && (
        <Circle
          x={points[0].x}
          y={points[0].y}
          radius={12}
          fill="transparent"
          stroke="#22c55e"
          strokeWidth={2}
          dash={[4, 2]}
          listening={false}
        />
      )}
    </Group>
  );
}
