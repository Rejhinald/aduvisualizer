"use client";

import React, { useMemo } from "react";
import { Line } from "react-konva";
import type { CanvasConfig } from "../types";

interface GridProps {
  config: CanvasConfig;
  showGrid: boolean;
  zoom?: number;
  panOffset?: { x: number; y: number };
  /** When true, use a more visible style for rendering over satellite imagery */
  overSatellite?: boolean;
}

/**
 * Procedural grid that generates lines based on the visible viewport.
 * This allows for infinite canvas scrolling without pre-rendering a huge grid.
 */
export function Grid({ config, showGrid, zoom = 1, panOffset = { x: 0, y: 0 }, overSatellite = false }: GridProps) {
  const { gridSize, displaySize } = config;

  const gridLines = useMemo(() => {
    if (!showGrid) return [];

    const lines: React.ReactNode[] = [];

    // Calculate visible area in canvas coordinates
    // The stage is scaled by zoom and translated by panOffset
    // So visible canvas area is: (screenCoord - panOffset) / zoom
    const viewLeft = -panOffset.x / zoom;
    const viewTop = -panOffset.y / zoom;
    const viewRight = (displaySize - panOffset.x) / zoom;
    const viewBottom = (displaySize - panOffset.y) / zoom;

    // Add buffer for smooth panning (2 grid units beyond visible area)
    const buffer = gridSize * 2;
    const startX = Math.floor((viewLeft - buffer) / gridSize) * gridSize;
    const endX = Math.ceil((viewRight + buffer) / gridSize) * gridSize;
    const startY = Math.floor((viewTop - buffer) / gridSize) * gridSize;
    const endY = Math.ceil((viewBottom + buffer) / gridSize) * gridSize;

    // Grid styling - more visible when over satellite imagery
    // Normal mode uses a darker gray for better visibility on white canvas
    const strokeColor = overSatellite ? "rgba(255, 255, 255, 0.4)" : "#c0c0c0";
    const strokeWidth = overSatellite ? 0.75 : 0.75;

    // Generate vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      lines.push(
        <Line
          key={`v-${x}`}
          points={[x, startY, x, endY]}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          listening={false}
        />
      );
    }

    // Generate horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      lines.push(
        <Line
          key={`h-${y}`}
          points={[startX, y, endX, y]}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          listening={false}
        />
      );
    }

    return lines;
  }, [showGrid, gridSize, displaySize, zoom, panOffset, overSatellite]);

  if (!showGrid) return null;

  return <>{gridLines}</>;
}
