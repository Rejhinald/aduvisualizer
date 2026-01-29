import { useState, useCallback, useRef, useEffect } from "react";
import type Konva from "konva";
import type { Point, CanvasConfig } from "../types";
import { CANVAS_CONFIG } from "@/lib/constants";

interface UseZoomPanOptions {
  config: CanvasConfig;
  isCanvasLocked?: boolean;
}

export function useZoomPan({ config, isCanvasLocked = false }: UseZoomPanOptions) {
  const { displaySize, extendedCanvasSize } = config;

  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);

  const hasSetInitialPan = useRef(false);

  // Set initial pan offset to center view on ADU boundary
  useEffect(() => {
    if (!hasSetInitialPan.current) {
      const centerOffset = (extendedCanvasSize - displaySize) / 2;
      setPanOffset({ x: -centerOffset, y: -centerOffset });
      hasSetInitialPan.current = true;
    }
  }, [extendedCanvasSize, displaySize]);

  // Convert stage coordinates to world coordinates
  const stageToWorld = useCallback((point: Point): Point => ({
    x: (point.x - panOffset.x) / zoom,
    y: (point.y - panOffset.y) / zoom,
  }), [panOffset, zoom]);

  // Zoom in
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.2, CANVAS_CONFIG.MAX_SCALE));
  }, []);

  // Zoom out
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.2, CANVAS_CONFIG.MIN_SCALE));
  }, []);

  // Handle mouse wheel zoom (Alt + scroll)
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    if (isCanvasLocked) return;

    // Only zoom with Alt+scroll
    if (!e.evt.altKey) return;

    e.evt.preventDefault();

    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = zoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - panOffset.x) / oldScale,
      y: (pointer.y - panOffset.y) / oldScale,
    };

    const newScale = e.evt.deltaY < 0
      ? Math.min(oldScale * 1.1, CANVAS_CONFIG.MAX_SCALE)
      : Math.max(oldScale / 1.1, CANVAS_CONFIG.MIN_SCALE);

    setZoom(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setPanOffset(newPos);
  }, [isCanvasLocked, zoom, panOffset]);

  // Handle pan start (middle mouse button)
  const handlePanStart = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isCanvasLocked) return;

    if (e.evt.button === 1) {
      e.evt.preventDefault();
      setIsPanning(true);
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos) setPanStart(pos);
    }
  }, [isCanvasLocked]);

  // Handle pan move
  const handlePanMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isPanning || !panStart) return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    const dx = pos.x - panStart.x;
    const dy = pos.y - panStart.y;

    setPanOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));

    setPanStart(pos);
  }, [isPanning, panStart]);

  // Handle pan end
  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  // Reset view to center
  const resetView = useCallback(() => {
    setZoom(1);
    const centerOffset = (extendedCanvasSize - displaySize) / 2;
    setPanOffset({ x: -centerOffset, y: -centerOffset });
  }, [extendedCanvasSize, displaySize]);

  return {
    zoom,
    panOffset,
    isPanning,
    setZoom,
    setPanOffset,
    stageToWorld,
    handleZoomIn,
    handleZoomOut,
    handleWheel,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    resetView,
  };
}
