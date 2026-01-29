"use client";

import React from "react";
import { Line } from "react-konva";
import type { CanvasConfig } from "../types";

interface GridProps {
  config: CanvasConfig;
  showGrid: boolean;
}

export function Grid({ config, showGrid }: GridProps) {
  const { gridSize, extendedGridFeet } = config;

  if (!showGrid) return null;

  const gridLines: React.ReactNode[] = [];
  const totalGridLines = extendedGridFeet;

  // Vertical lines
  for (let i = 0; i <= totalGridLines; i++) {
    const x = i * gridSize;
    gridLines.push(
      <Line
        key={`v-${i}`}
        points={[x, 0, x, totalGridLines * gridSize]}
        stroke="#e0e0e0"
        strokeWidth={0.5}
        listening={false}
      />
    );
  }

  // Horizontal lines
  for (let i = 0; i <= totalGridLines; i++) {
    const y = i * gridSize;
    gridLines.push(
      <Line
        key={`h-${i}`}
        points={[0, y, totalGridLines * gridSize, y]}
        stroke="#e0e0e0"
        strokeWidth={0.5}
        listening={false}
      />
    );
  }

  return <>{gridLines}</>;
}
