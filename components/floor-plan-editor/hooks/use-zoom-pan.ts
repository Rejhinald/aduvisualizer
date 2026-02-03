import { useState, useCallback, useRef, useEffect } from "react";
import type Konva from "konva";
import type { Point, CanvasConfig } from "../types";
import { CANVAS_CONFIG } from "@/lib/constants";

interface UseZoomPanOptions {
  config: CanvasConfig;
  isCanvasLocked?: boolean;
  focusPoint?: Point; // Center point to zoom toward (e.g., ADU center)
  // Initial values for restoring saved state
  initialZoom?: number;
  initialPanOffset?: Point;
  // Callback when camera changes (for persisting settings)
  onCameraChange?: (zoom: number, panX: number, panY: number) => void;
}

export function useZoomPan({
  config,
  isCanvasLocked = false,
  focusPoint,
  initialZoom,
  initialPanOffset,
  onCameraChange,
}: UseZoomPanOptions) {
  const { displaySize, extendedCanvasSize } = config;

  const [zoom, setZoomState] = useState(initialZoom ?? 1);
  const [panOffset, setPanOffsetState] = useState<Point>(initialPanOffset ?? { x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);

  const hasSetInitialPan = useRef(false);
  const cameraChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Wrapper to set zoom and notify about camera change
  const setZoom = useCallback((newZoom: number) => {
    setZoomState(newZoom);
  }, []);

  // Wrapper to set pan offset and notify about camera change
  const setPanOffset = useCallback((newOffset: Point | ((prev: Point) => Point)) => {
    setPanOffsetState(newOffset);
  }, []);

  // Debounced camera change notification
  useEffect(() => {
    if (!onCameraChange || !hasSetInitialPan.current) return;

    if (cameraChangeTimeoutRef.current) {
      clearTimeout(cameraChangeTimeoutRef.current);
    }
    cameraChangeTimeoutRef.current = setTimeout(() => {
      onCameraChange(zoom, panOffset.x, panOffset.y);
    }, 500);

    return () => {
      if (cameraChangeTimeoutRef.current) {
        clearTimeout(cameraChangeTimeoutRef.current);
      }
    };
  }, [zoom, panOffset, onCameraChange]);

  // Set initial pan offset to center view on ADU boundary
  useEffect(() => {
    if (!hasSetInitialPan.current) {
      // Use initial values if provided, otherwise calculate default center
      if (initialPanOffset) {
        setPanOffsetState(initialPanOffset);
      } else {
        const centerOffset = (extendedCanvasSize - displaySize) / 2;
        setPanOffsetState({ x: -centerOffset, y: -centerOffset });
      }
      if (initialZoom) {
        setZoomState(initialZoom);
      }
      hasSetInitialPan.current = true;
    }
  }, [extendedCanvasSize, displaySize, initialPanOffset, initialZoom]);

  // Convert stage coordinates to world coordinates
  const stageToWorld = useCallback((point: Point): Point => ({
    x: (point.x - panOffset.x) / zoom,
    y: (point.y - panOffset.y) / zoom,
  }), [panOffset, zoom]);

  // Zoom in centered on focus point (ADU center)
  const handleZoomIn = useCallback(() => {
    const oldScale = zoom;
    const newScale = Math.min(oldScale * 1.2, CANVAS_CONFIG.MAX_SCALE);

    if (focusPoint) {
      // Calculate where the focus point appears on screen
      const screenCenterX = displaySize / 2;
      const screenCenterY = displaySize / 2;

      // Adjust pan to keep focus point centered
      const newPanX = screenCenterX - focusPoint.x * newScale;
      const newPanY = screenCenterY - focusPoint.y * newScale;

      setZoom(newScale);
      setPanOffset({ x: newPanX, y: newPanY });
    } else {
      setZoom(newScale);
    }
  }, [zoom, focusPoint, displaySize]);

  // Zoom out centered on focus point (ADU center)
  const handleZoomOut = useCallback(() => {
    const oldScale = zoom;
    const newScale = Math.max(oldScale / 1.2, CANVAS_CONFIG.MIN_SCALE);

    if (focusPoint) {
      // Calculate where the focus point appears on screen
      const screenCenterX = displaySize / 2;
      const screenCenterY = displaySize / 2;

      // Adjust pan to keep focus point centered
      const newPanX = screenCenterX - focusPoint.x * newScale;
      const newPanY = screenCenterY - focusPoint.y * newScale;

      setZoom(newScale);
      setPanOffset({ x: newPanX, y: newPanY });
    } else {
      setZoom(newScale);
    }
  }, [zoom, focusPoint, displaySize]);

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

  // Reset view to center on focus point (ADU center)
  const resetView = useCallback(() => {
    setZoom(1);
    if (focusPoint) {
      // Center the focus point in the viewport
      const screenCenterX = displaySize / 2;
      const screenCenterY = displaySize / 2;
      setPanOffset({
        x: screenCenterX - focusPoint.x,
        y: screenCenterY - focusPoint.y,
      });
    } else {
      const centerOffset = (extendedCanvasSize - displaySize) / 2;
      setPanOffset({ x: -centerOffset, y: -centerOffset });
    }
  }, [extendedCanvasSize, displaySize, focusPoint]);

  // Imperatively set camera position (used for snapshot restoration)
  // This bypasses the initial-only logic and directly sets both zoom and pan
  const setCamera = useCallback((newZoom: number, newPanX: number, newPanY: number) => {
    console.log("[useZoomPan] setCamera called:", { newZoom, newPanX, newPanY });
    setZoomState(newZoom);
    setPanOffsetState({ x: newPanX, y: newPanY });
    // Notify about the change (if callback exists)
    if (onCameraChange) {
      onCameraChange(newZoom, newPanX, newPanY);
    }
  }, [onCameraChange]);

  return {
    zoom,
    panOffset,
    isPanning,
    setZoom,
    setPanOffset,
    setCamera,
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
