"use client";

import React from "react";
import { Rect, Line, Circle, Group, Text } from "react-konva";
import type { Point, RoomType } from "@/lib/types";
import type { CanvasConfig } from "../types";
import { ROOM_CONFIGS } from "@/lib/constants";

interface DrawingPreviewProps {
  config: CanvasConfig;
  drawMode: "rectangle" | "polygon";
  selectedRoomType: RoomType | null;
  isDrawing: boolean;
  currentRect: { x: number; y: number; width: number; height: number } | null;
  polygonPoints: Point[];
}

export function DrawingPreview({
  config,
  drawMode,
  selectedRoomType,
  isDrawing,
  currentRect,
  polygonPoints,
}: DrawingPreviewProps) {
  const { pixelsPerFoot } = config;

  // Format feet to feet-inches string
  const formatFeetInches = (feet: number): string => {
    const wholeFeet = Math.floor(feet);
    const inches = Math.round((feet - wholeFeet) * 12);
    if (inches === 0) {
      return `${wholeFeet}'-0"`;
    }
    return `${wholeFeet}'-${inches}"`;
  };

  if (!isDrawing || !selectedRoomType) return null;

  const roomColor = ROOM_CONFIGS[selectedRoomType].color;

  if (drawMode === "rectangle" && currentRect) {
    const widthFeet = currentRect.width / pixelsPerFoot;
    const heightFeet = currentRect.height / pixelsPerFoot;
    const area = widthFeet * heightFeet;

    return (
      <Group>
        {/* Preview rectangle */}
        <Rect
          x={currentRect.x}
          y={currentRect.y}
          width={currentRect.width}
          height={currentRect.height}
          fill={roomColor}
          opacity={0.4}
          stroke="#666666"
          strokeWidth={2}
          dash={[5, 5]}
          listening={false}
        />

        {/* Dimension labels */}
        {currentRect.width > 0 && currentRect.height > 0 && (
          <>
            {/* Width label (top) */}
            <Text
              x={currentRect.x + currentRect.width / 2 - 30}
              y={currentRect.y - 20}
              text={formatFeetInches(widthFeet)}
              fontSize={12}
              fill="#333333"
              fontStyle="bold"
              listening={false}
            />

            {/* Height label (left) */}
            <Text
              x={currentRect.x - 45}
              y={currentRect.y + currentRect.height / 2 - 6}
              text={formatFeetInches(heightFeet)}
              fontSize={12}
              fill="#333333"
              fontStyle="bold"
              listening={false}
            />

            {/* Area label (center) */}
            <Text
              x={currentRect.x + currentRect.width / 2 - 25}
              y={currentRect.y + currentRect.height / 2 - 6}
              text={`${Math.round(area)} sq ft`}
              fontSize={12}
              fill="#333333"
              fontStyle="bold"
              listening={false}
            />
          </>
        )}
      </Group>
    );
  }

  if (drawMode === "polygon" && polygonPoints.length > 0) {
    const flatPoints = polygonPoints.flatMap(p => [p.x, p.y]);

    return (
      <Group>
        {/* Polygon lines */}
        <Line
          points={flatPoints}
          stroke={roomColor}
          strokeWidth={2}
          dash={[5, 5]}
          closed={false}
          listening={false}
        />

        {/* Polygon points */}
        {polygonPoints.map((point, index) => (
          <Circle
            key={`preview-point-${index}`}
            x={point.x}
            y={point.y}
            radius={6}
            fill={index === 0 ? "#22c55e" : roomColor}
            stroke="#ffffff"
            strokeWidth={2}
            listening={false}
          />
        ))}

        {/* Close line preview (from last point to first) */}
        {polygonPoints.length >= 3 && (
          <Line
            points={[
              polygonPoints[polygonPoints.length - 1].x,
              polygonPoints[polygonPoints.length - 1].y,
              polygonPoints[0].x,
              polygonPoints[0].y,
            ]}
            stroke={roomColor}
            strokeWidth={1}
            dash={[3, 3]}
            opacity={0.5}
            listening={false}
          />
        )}

        {/* Point count indicator */}
        <Text
          x={polygonPoints[polygonPoints.length - 1].x + 10}
          y={polygonPoints[polygonPoints.length - 1].y - 20}
          text={`${polygonPoints.length} points`}
          fontSize={11}
          fill="#666666"
          listening={false}
        />
      </Group>
    );
  }

  return null;
}
