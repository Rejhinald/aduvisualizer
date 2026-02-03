"use client";

import React, { useRef } from "react";
import { Rect, Group, Transformer } from "react-konva";
import type Konva from "konva";
import type { Window, Point } from "@/lib/types";
import type { CanvasConfig } from "../types";

interface WindowsProps {
  config: CanvasConfig;
  windows: Window[];
  selectedWindowId: string | null;
  selectedWindowIds?: Set<string>;
  onWindowClick: (windowId: string, e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onWindowDragEnd: (windowId: string, position: Point) => void;
  onWindowTransform: (windowId: string, newWidth: number, newPosition?: Point) => void;
  multiDragDelta?: Point;
  onMultiDragStart?: () => void;
  onMultiDragMove?: (delta: Point) => void;
  onMultiDragEnd?: (delta: Point) => void;
  transformerRef: React.RefObject<Konva.Transformer | null>;
  windowRefs: React.MutableRefObject<Map<string, Konva.Rect>>;
  zoom?: number;
}

export function Windows({
  config,
  windows,
  selectedWindowId,
  selectedWindowIds = new Set(),
  onWindowClick,
  onWindowDragEnd,
  onWindowTransform,
  multiDragDelta,
  onMultiDragStart,
  onMultiDragMove,
  onMultiDragEnd,
  transformerRef,
  windowRefs,
  zoom = 1,
}: WindowsProps) {
  const { gridSize, pixelsPerFoot, extendedCanvasSize } = config;

  // Track multi-drag start position and which window is being dragged
  const multiDragStartRef = useRef<Point | null>(null);
  const draggingWindowIdRef = useRef<string | null>(null);

  // Check if there's an active multi-selection
  const hasMultiSelection = selectedWindowIds.size > 0;

  // Snap to half-grid (0.5 foot increments)
  const halfGrid = gridSize / 2;
  const snapToGrid = (value: number) => Math.round(value / halfGrid) * halfGrid;

  // Constrain to canvas
  const constrainToCanvas = (point: Point): Point => ({
    x: Math.max(0, Math.min(point.x, extendedCanvasSize)),
    y: Math.max(0, Math.min(point.y, extendedCanvasSize)),
  });

  // Get selected window for transformer direction
  const selectedWindow = windows.find(w => w.id === selectedWindowId);
  const isWindowVertical = selectedWindow ? selectedWindow.rotation % 180 === 90 : false;

  return (
    <Group>
      {windows.map((window) => {
        const isSelected = selectedWindowId === window.id;
        const isMultiSelected = selectedWindowIds.has(window.id);
        const windowWidthPx = window.width * pixelsPerFoot;
        const windowThicknessPx = gridSize / 6;
        const isVertical = window.rotation % 180 === 90;

        // Calculate preview offset for multi-selected windows that aren't being dragged
        const isBeingDragged = draggingWindowIdRef.current === window.id;
        const previewOffset = (isMultiSelected && !isBeingDragged && multiDragDelta)
          ? multiDragDelta
          : { x: 0, y: 0 };

        // For vertical windows, swap dimensions
        const rectWidth = isVertical ? windowThicknessPx : windowWidthPx;
        const rectHeight = isVertical ? windowWidthPx : windowThicknessPx;

        // Position by top-left corner (convert from center) with preview offset
        const leftEdgeX = window.position.x + previewOffset.x - rectWidth / 2;
        const topEdgeY = window.position.y + previewOffset.y - rectHeight / 2;

        return (
          <Group key={window.id}>
            {/* Multi-selection highlight */}
            {isMultiSelected && (
              <Rect
                x={leftEdgeX - 4}
                y={topEdgeY - 4}
                width={rectWidth + 8}
                height={rectHeight + 8}
                stroke="#3b82f6"
                strokeWidth={2 / zoom}
                dash={[6 / zoom, 3 / zoom]}
                fill="transparent"
                listening={false}
              />
            )}
            <Rect
              ref={(node) => {
                if (node) {
                  windowRefs.current.set(window.id, node);
                } else {
                  windowRefs.current.delete(window.id);
                }
              }}
              x={leftEdgeX}
              y={topEdgeY}
              width={rectWidth}
              height={rectHeight}
              fill={isSelected ? "#961818" : isMultiSelected ? "#3b82f6" : "#4682B4"}
              stroke={isSelected ? "#961818" : isMultiSelected ? "#3b82f6" : "#2C5282"}
              strokeWidth={isSelected || isMultiSelected ? 2 / zoom : 1 / zoom}
              draggable
              onDragStart={() => {
                // Track start position for multi-drag
                if (isMultiSelected && onMultiDragEnd) {
                  multiDragStartRef.current = { x: window.position.x, y: window.position.y };
                  draggingWindowIdRef.current = window.id;
                  onMultiDragStart?.();
                }
              }}
              dragBoundFunc={(pos) => {
                if (isVertical) {
                  // For vertical: snap top edge to grid (leading edge of width)
                  const snappedY = snapToGrid(pos.y);
                  // Snap center X to grid (for wall alignment)
                  const centerX = pos.x + rectWidth / 2;
                  const snappedCenterX = snapToGrid(centerX);
                  return constrainToCanvas({ x: snappedCenterX - rectWidth / 2, y: snappedY });
                } else {
                  // For horizontal: snap left edge to grid
                  const snappedX = snapToGrid(pos.x);
                  // Snap center Y to grid (for wall alignment)
                  const centerY = pos.y + rectHeight / 2;
                  const snappedCenterY = snapToGrid(centerY);
                  return constrainToCanvas({ x: snappedX, y: snappedCenterY - rectHeight / 2 });
                }
              }}
              onDragMove={(e) => {
                // Update multi-drag preview delta
                if (isMultiSelected && multiDragStartRef.current && onMultiDragMove) {
                  const node = e.target;
                  let newCenterX: number, newCenterY: number;
                  if (isVertical) {
                    newCenterX = snapToGrid(node.x() + rectWidth / 2);
                    newCenterY = snapToGrid(node.y()) + rectHeight / 2;
                  } else {
                    newCenterX = snapToGrid(node.x()) + rectWidth / 2;
                    newCenterY = snapToGrid(node.y() + rectHeight / 2);
                  }
                  const delta = {
                    x: newCenterX - window.position.x,
                    y: newCenterY - window.position.y,
                  };
                  onMultiDragMove(delta);
                }
              }}
              onDragEnd={(e) => {
                const node = e.target;
                let newCenterX: number, newCenterY: number;

                if (isVertical) {
                  const newTopEdge = snapToGrid(node.y());
                  newCenterX = snapToGrid(node.x() + rectWidth / 2);
                  newCenterY = newTopEdge + rectHeight / 2;
                  node.x(newCenterX - rectWidth / 2);
                  node.y(newTopEdge);
                } else {
                  const newLeftEdge = snapToGrid(node.x());
                  newCenterY = snapToGrid(node.y() + rectHeight / 2);
                  newCenterX = newLeftEdge + rectWidth / 2;
                  node.x(newLeftEdge);
                  node.y(newCenterY - rectHeight / 2);
                }

                // Handle multi-drag
                if (isMultiSelected && onMultiDragEnd && multiDragStartRef.current) {
                  const delta = {
                    x: newCenterX - window.position.x,
                    y: newCenterY - window.position.y,
                  };
                  // Reset position (will be updated by parent) - use original position without preview offset
                  const origLeftEdgeX = window.position.x - rectWidth / 2;
                  const origTopEdgeY = window.position.y - rectHeight / 2;
                  node.x(origLeftEdgeX);
                  node.y(origTopEdgeY);
                  multiDragStartRef.current = null;
                  draggingWindowIdRef.current = null;
                  onMultiDragEnd(delta);
                } else {
                  onWindowDragEnd(window.id, { x: newCenterX, y: newCenterY });
                }
              }}
              onTransformEnd={(e) => {
                // Disable transform during multi-selection
                if (hasMultiSelection) return;
                const node = e.target;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // Get scaled dimensions
                const scaledWidth = node.width() * scaleX;
                const scaledHeight = node.height() * scaleY;

                // Width is always the "window size" (longer dimension)
                const newWindowWidthPx = isVertical ? scaledHeight : scaledWidth;
                const newWidthFeet = Math.max(1, Math.round(newWindowWidthPx / pixelsPerFoot));
                const actualWidthPx = newWidthFeet * pixelsPerFoot;

                // New rect dimensions
                const newRectWidth = isVertical ? windowThicknessPx : actualWidthPx;
                const newRectHeight = isVertical ? actualWidthPx : windowThicknessPx;

                let newCenterX: number, newCenterY: number;

                if (isVertical) {
                  const newTopEdge = snapToGrid(node.y());
                  newCenterX = snapToGrid(node.x() + scaledWidth / 2);
                  newCenterY = newTopEdge + newRectHeight / 2;
                } else {
                  const newLeftEdge = snapToGrid(node.x());
                  newCenterY = snapToGrid(node.y() + scaledHeight / 2);
                  newCenterX = newLeftEdge + newRectWidth / 2;
                }

                onWindowTransform(window.id, newWidthFeet, { x: newCenterX, y: newCenterY });

                // Reset scale and set correct dimensions
                node.scaleX(1);
                node.scaleY(1);
                node.width(newRectWidth);
                node.height(newRectHeight);
                node.x(newCenterX - newRectWidth / 2);
                node.y(newCenterY - newRectHeight / 2);
              }}
              onClick={(e) => {
                e.cancelBubble = true;
                onWindowClick(window.id, e);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onWindowClick(window.id, e);
              }}
            />
          </Group>
        );
      })}

      {/* Transformer for selected window - direction based on rotation */}
      {/* Disabled during multi-selection */}
      <Transformer
        ref={transformerRef}
        boundBoxFunc={(oldBox, newBox) => {
          if (hasMultiSelection) return oldBox; // Prevent resize during multi-selection
          // Snap the resizable dimension to grid (minimum 1 foot)
          const minSize = gridSize; // 1 foot minimum

          if (isWindowVertical) {
            // Vertical window - resize height (which is the window width)
            const snappedHeight = Math.max(minSize, snapToGrid(newBox.height));
            const snappedY = snapToGrid(newBox.y);
            return {
              ...newBox,
              x: oldBox.x,
              y: snappedY,
              width: oldBox.width,
              height: snappedHeight,
            };
          } else {
            // Horizontal window - resize width
            const snappedWidth = Math.max(minSize, snapToGrid(newBox.width));
            const snappedX = snapToGrid(newBox.x);
            return {
              ...newBox,
              x: snappedX,
              y: oldBox.y,
              width: snappedWidth,
              height: oldBox.height,
            };
          }
        }}
        enabledAnchors={hasMultiSelection ? [] : (isWindowVertical ? ['top-center', 'bottom-center'] : ['middle-left', 'middle-right'])}
        rotateEnabled={false}
        ignoreStroke={true}
        keepRatio={false}
        centeredScaling={false}
        padding={4}
        anchorSize={8}
        anchorFill="#4682B4"
        anchorStroke="#ffffff"
        borderStroke="#4682B4"
        borderStrokeWidth={1}
      />
    </Group>
  );
}
