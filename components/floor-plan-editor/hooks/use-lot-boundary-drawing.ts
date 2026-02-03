"use client";

import { useState, useCallback } from "react";
import type Konva from "konva";
import type { Point } from "@/lib/types";

interface UseLotBoundaryDrawingOptions {
  pixelsPerFoot: number;
  canvasCenter: Point;
  snapToGrid: (value: number) => number;
  onComplete: (boundaryVertices: Point[]) => void;
}

/**
 * Hook for drawing custom lot boundary polygons.
 * Coordinates are stored relative to canvas center in feet.
 */
export function useLotBoundaryDrawing({
  pixelsPerFoot,
  canvasCenter,
  snapToGrid,
  onComplete,
}: UseLotBoundaryDrawingOptions) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null);

  // Convert stage coordinates to world coordinates (accounting for zoom/pan)
  const stageToWorld = useCallback((stagePoint: Point, zoom: number, panOffset: Point): Point => {
    return {
      x: (stagePoint.x - panOffset.x) / zoom,
      y: (stagePoint.y - panOffset.y) / zoom,
    };
  }, []);

  // Start drawing mode
  const startDrawing = useCallback(() => {
    setIsDrawing(true);
    setPoints([]);
    setPreviewPoint(null);
  }, []);

  // Cancel drawing
  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setPoints([]);
    setPreviewPoint(null);
  }, []);

  // Handle click to add point
  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>, zoom: number, panOffset: Point) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    const world = stageToWorld(pointerPosition, zoom, panOffset);
    const snapped = {
      x: snapToGrid(world.x),
      y: snapToGrid(world.y),
    };

    // Check if clicking near the first point to close the polygon
    if (points.length >= 3) {
      const firstPoint = points[0];
      const distance = Math.sqrt(
        Math.pow(snapped.x - firstPoint.x, 2) + Math.pow(snapped.y - firstPoint.y, 2)
      );
      const closeThreshold = pixelsPerFoot; // 1 foot threshold

      if (distance < closeThreshold) {
        // Complete the polygon
        completeDrawing();
        return;
      }
    }

    setPoints(prev => [...prev, snapped]);
  }, [isDrawing, points, stageToWorld, snapToGrid, pixelsPerFoot]);

  // Handle mouse move for preview line
  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>, zoom: number, panOffset: Point) => {
    if (!isDrawing || points.length === 0) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    const world = stageToWorld(pointerPosition, zoom, panOffset);
    setPreviewPoint({
      x: snapToGrid(world.x),
      y: snapToGrid(world.y),
    });
  }, [isDrawing, points.length, stageToWorld, snapToGrid]);

  // Complete the polygon and convert to relative coordinates
  const completeDrawing = useCallback(() => {
    if (points.length < 3) {
      cancelDrawing();
      return;
    }

    // Convert points from canvas pixels to feet relative to canvas center
    const boundaryInFeet = points.map(p => ({
      x: (p.x - canvasCenter.x) / pixelsPerFoot,
      y: (p.y - canvasCenter.y) / pixelsPerFoot,
    }));

    onComplete(boundaryInFeet);
    setIsDrawing(false);
    setPoints([]);
    setPreviewPoint(null);
  }, [points, canvasCenter, pixelsPerFoot, onComplete, cancelDrawing]);

  return {
    isDrawing,
    points,
    previewPoint,
    startDrawing,
    cancelDrawing,
    handleClick,
    handleMouseMove,
    completeDrawing,
  };
}
