"use client";

import React from "react";
import type { Point } from "@/lib/types";
import type { CanvasConfig } from "../types";

interface ADUAreaIndicatorProps {
  config: CanvasConfig;
  boundary: Point[];
}

export function ADUAreaIndicator({ config, boundary }: ADUAreaIndicatorProps) {
  const { pixelsPerFoot } = config;

  // Calculate area using shoelace formula
  const calculateArea = (vertices: Point[]): number => {
    if (vertices.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }

    area = Math.abs(area) / 2;
    return area / (pixelsPerFoot * pixelsPerFoot);
  };

  const aduArea = Math.round(calculateArea(boundary));

  return (
    <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <span className="text-sm font-semibold text-gray-700">
          ADU Area: <span className="text-red-600">{aduArea}</span> sq ft
        </span>
      </div>
    </div>
  );
}
