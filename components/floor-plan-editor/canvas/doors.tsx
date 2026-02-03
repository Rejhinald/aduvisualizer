"use client";

import React, { useRef } from "react";
import { Rect, Line, Arc, Group, Text, Transformer, Circle } from "react-konva";
import type Konva from "konva";
import type { Door, Point } from "@/lib/types";
import type { CanvasConfig } from "../types";

interface DoorsProps {
  config: CanvasConfig;
  doors: Door[];
  selectedDoorId: string | null;
  selectedDoorIds?: Set<string>;
  onDoorClick: (doorId: string, e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDoorDragEnd: (doorId: string, position: Point) => void;
  onOpeningTransform?: (doorId: string, newWidth: number, newPosition: Point) => void;
  multiDragDelta?: Point;
  onMultiDragStart?: () => void;
  onMultiDragMove?: (delta: Point) => void;
  onMultiDragEnd?: (delta: Point) => void;
  openingTransformerRef: React.RefObject<Konva.Transformer | null>;
  openingRefs: React.MutableRefObject<Map<string, Konva.Rect>>;
  zoom?: number;
}

export function Doors({
  config,
  doors,
  selectedDoorId,
  selectedDoorIds = new Set(),
  onDoorClick,
  onDoorDragEnd,
  onOpeningTransform,
  multiDragDelta,
  onMultiDragStart,
  onMultiDragMove,
  onMultiDragEnd,
  openingTransformerRef,
  openingRefs,
  zoom = 1,
}: DoorsProps) {
  const { gridSize, pixelsPerFoot, extendedCanvasSize } = config;

  // Track multi-drag start position and which door is being dragged
  const multiDragStartRef = useRef<Point | null>(null);
  const draggingDoorIdRef = useRef<string | null>(null);

  // Check if there's an active multi-selection
  const hasMultiSelection = selectedDoorIds.size > 0;

  // Snap to half-grid (0.5 foot increments)
  const halfGrid = gridSize / 2;
  const snapToGrid = (value: number) => Math.round(value / halfGrid) * halfGrid;

  // Constrain to canvas
  const constrainToCanvas = (point: Point): Point => ({
    x: Math.max(0, Math.min(point.x, extendedCanvasSize)),
    y: Math.max(0, Math.min(point.y, extendedCanvasSize)),
  });

  // Get selected opening for transformer direction
  const selectedOpening = doors.find(d => d.id === selectedDoorId && d.type === 'opening');
  const isOpeningVertical = selectedOpening ? selectedOpening.rotation % 180 === 90 : false;

  return (
    <Group>
      {/* Regular Doors (not openings) */}
      {doors.filter(d => d.type !== "opening").map((door) => {
        const isSelected = selectedDoorId === door.id;
        const isMultiSelected = selectedDoorIds.has(door.id);
        const doorWidthPx = door.width * pixelsPerFoot;
        const doorThicknessPx = gridSize / 8;
        const isVertical = door.rotation % 180 === 90;
        const halfWidth = doorWidthPx / 2;
        const arcRadius = doorWidthPx * 0.9;

        // Calculate preview offset for multi-selected doors that aren't being dragged
        const isBeingDragged = draggingDoorIdRef.current === door.id;
        const previewOffset = (isMultiSelected && !isBeingDragged && multiDragDelta)
          ? multiDragDelta
          : { x: 0, y: 0 };

        // Determine arc angles based on door type and rotation
        // Arc represents the 90° swing path of the door
        // The door hinge is at the LEFT side in local coordinates (x = -halfWidth)
        // Arc sweeps 90° showing where the door edge travels
        const arcAngle = door.type === "sliding" ? 0 : 90;

        // Arc rotation determines swing direction:
        // - Door swings "into" the room (positive y direction in local coords)
        // This creates a consistent swing direction that rotates with the door group
        const arcRotation = 0; // Arc sweeps from 0° to 90° (counter-clockwise from local +X axis)

        return (
          <Group
            key={door.id}
            x={door.position.x + previewOffset.x}
            y={door.position.y + previewOffset.y}
            rotation={door.rotation}
            draggable
            onDragStart={(e) => {
              // Track start position for multi-drag
              if (isMultiSelected && onMultiDragEnd) {
                const group = e.target;
                multiDragStartRef.current = { x: group.x(), y: group.y() };
                draggingDoorIdRef.current = door.id;
                onMultiDragStart?.();
              }
            }}
            dragBoundFunc={(pos) => {
              const doorWidth = door.width * pixelsPerFoot;
              const isVert = door.rotation % 180 === 90;

              if (isVert) {
                const snappedTopEdge = snapToGrid(pos.y - doorWidth / 2);
                const snappedCenterY = snappedTopEdge + doorWidth / 2;
                const snappedCenterX = snapToGrid(pos.x);
                return constrainToCanvas({ x: snappedCenterX, y: snappedCenterY });
              } else {
                const snappedLeftEdge = snapToGrid(pos.x - doorWidth / 2);
                const snappedCenterX = snappedLeftEdge + doorWidth / 2;
                const snappedCenterY = snapToGrid(pos.y);
                return constrainToCanvas({ x: snappedCenterX, y: snappedCenterY });
              }
            }}
            onDragMove={(e) => {
              // Update multi-drag preview delta
              if (isMultiSelected && multiDragStartRef.current && onMultiDragMove) {
                const group = e.target;
                const delta = {
                  x: group.x() - multiDragStartRef.current.x,
                  y: group.y() - multiDragStartRef.current.y,
                };
                onMultiDragMove(delta);
              }
            }}
            onDragEnd={(e) => {
              const group = e.target;
              const doorWidth = door.width * pixelsPerFoot;
              const isVert = door.rotation % 180 === 90;

              let newX, newY;
              if (isVert) {
                const snappedTopEdge = snapToGrid(group.y() - doorWidth / 2);
                newY = snappedTopEdge + doorWidth / 2;
                newX = snapToGrid(group.x());
              } else {
                const snappedLeftEdge = snapToGrid(group.x() - doorWidth / 2);
                newX = snappedLeftEdge + doorWidth / 2;
                newY = snapToGrid(group.y());
              }

              // Handle multi-drag
              if (isMultiSelected && onMultiDragEnd && multiDragStartRef.current) {
                const delta = {
                  x: newX - door.position.x,
                  y: newY - door.position.y,
                };
                // Reset position (will be updated by parent)
                group.x(door.position.x);
                group.y(door.position.y);
                multiDragStartRef.current = null;
                draggingDoorIdRef.current = null;
                onMultiDragEnd(delta);
              } else {
                onDoorDragEnd(door.id, { x: newX, y: newY });
              }
            }}
            onClick={(e) => onDoorClick(door.id, e)}
            onTap={(e) => onDoorClick(door.id, e)}
          >
            {/* Multi-selection highlight */}
            {isMultiSelected && (
              <Rect
                x={-doorWidthPx / 2 - 4}
                y={-doorWidthPx / 2 - 4}
                width={doorWidthPx + 8}
                height={doorWidthPx + 8}
                stroke="#3b82f6"
                strokeWidth={2 / zoom}
                dash={[6 / zoom, 3 / zoom]}
                fill="transparent"
                listening={false}
              />
            )}
            {/* Hit area for interaction */}
            <Rect
              x={-doorWidthPx / 2}
              y={-doorWidthPx / 2}
              width={doorWidthPx}
              height={doorWidthPx}
              fill="transparent"
            />

            {/* Door frame/wall opening - the gap in the wall */}
            <Line
              points={[-doorWidthPx / 2, 0, doorWidthPx / 2, 0]}
              stroke={isSelected ? "#961818" : isMultiSelected ? "#3b82f6" : "#333"}
              strokeWidth={doorThicknessPx}
              lineCap="round"
              listening={false}
            />

            {/* Door panel - shown at 90° angle from hinge point (perpendicular to wall)
                Hinge is at left side (-halfWidth), door swings into room (+Y direction) */}
            {door.type === "single" && (
              <Line
                points={[
                  -doorWidthPx / 2, 0,  // Hinge point (left side)
                  -doorWidthPx / 2, doorWidthPx  // Door end (90° - straight down)
                ]}
                stroke={isSelected ? "#961818" : isMultiSelected ? "#3b82f6" : "#8B4513"}
                strokeWidth={3 / zoom}
                lineCap="round"
                listening={false}
              />
            )}

            {/* Double door / French door - two panels, each 90° from their hinges */}
            {(door.type === "double" || door.type === "french") && (
              <>
                {/* Left panel - hinges on left, swings into room (90° perpendicular) */}
                <Line
                  points={[
                    -doorWidthPx / 2, 0,
                    -doorWidthPx / 2, doorWidthPx / 2  // Straight down (90°)
                  ]}
                  stroke={isSelected ? "#961818" : isMultiSelected ? "#3b82f6" : "#8B4513"}
                  strokeWidth={3 / zoom}
                  lineCap="round"
                  listening={false}
                />
                {/* Right panel - hinges on right, swings into room (90° perpendicular) */}
                <Line
                  points={[
                    doorWidthPx / 2, 0,
                    doorWidthPx / 2, doorWidthPx / 2  // Straight down (90°)
                  ]}
                  stroke={isSelected ? "#961818" : isMultiSelected ? "#3b82f6" : "#8B4513"}
                  strokeWidth={3 / zoom}
                  lineCap="round"
                  listening={false}
                />
              </>
            )}

            {/* Door swing arc for single door - shows the 90° travel path */}
            {door.type === "single" && (
              <Arc
                x={-doorWidthPx / 2}
                y={0}
                innerRadius={0}
                outerRadius={doorWidthPx}
                angle={arcAngle}
                rotation={arcRotation}
                stroke={isSelected ? "#961818" : isMultiSelected ? "#3b82f6" : "#8B4513"}
                strokeWidth={1 / zoom}
                dash={[4 / zoom, 4 / zoom]}
                listening={false}
              />
            )}

            {/* Double/French door swing arcs - one from each hinge */}
            {(door.type === "double" || door.type === "french") && (
              <>
                {/* Left panel arc */}
                <Arc
                  x={-doorWidthPx / 2}
                  y={0}
                  innerRadius={0}
                  outerRadius={doorWidthPx / 2}
                  angle={arcAngle}
                  rotation={arcRotation}
                  stroke={isSelected ? "#961818" : isMultiSelected ? "#3b82f6" : "#8B4513"}
                  strokeWidth={1 / zoom}
                  dash={[4 / zoom, 4 / zoom]}
                  listening={false}
                />
                {/* Right panel arc - mirrored */}
                <Arc
                  x={doorWidthPx / 2}
                  y={0}
                  innerRadius={0}
                  outerRadius={doorWidthPx / 2}
                  angle={arcAngle}
                  rotation={90}
                  stroke={isSelected ? "#961818" : isMultiSelected ? "#3b82f6" : "#8B4513"}
                  strokeWidth={1 / zoom}
                  dash={[4 / zoom, 4 / zoom]}
                  listening={false}
                />
              </>
            )}

            {/* Sliding door slide indicator */}
            {door.type === "sliding" && (
              <Line
                points={[-halfWidth, 8, halfWidth, 8]}
                stroke={isSelected ? "#961818" : "#8B4513"}
                strokeWidth={1 / zoom}
                dash={[3 / zoom, 3 / zoom]}
                listening={false}
              />
            )}
          </Group>
        );
      })}

      {/* Open Passages - With rotation support and resize capability */}
      {doors.filter(d => d.type === "opening").map((opening) => {
        const isSelected = selectedDoorId === opening.id;
        const openingWidthPx = opening.width * pixelsPerFoot;
        const openingThicknessPx = gridSize / 2; // Larger hit area for easier selection
        const isVertical = opening.rotation % 180 === 90;

        // For vertical openings, swap dimensions
        const rectWidth = isVertical ? openingThicknessPx : openingWidthPx;
        const rectHeight = isVertical ? openingWidthPx : openingThicknessPx;

        // Position by leading edge (left edge for horizontal, top edge for vertical)
        const leftEdgeX = opening.position.x - rectWidth / 2;
        const topEdgeY = opening.position.y - rectHeight / 2;

        return (
          <React.Fragment key={opening.id}>
            <Rect
              ref={(node) => {
                if (node) {
                  openingRefs.current.set(opening.id, node);
                } else {
                  openingRefs.current.delete(opening.id);
                }
              }}
              x={leftEdgeX}
              y={topEdgeY}
              width={rectWidth}
              height={rectHeight}
              fill="rgba(200, 200, 200, 0.3)"
              stroke={isSelected ? "#961818" : "#999"}
              strokeWidth={isSelected ? 2 / zoom : 1 / zoom}
              dash={[6 / zoom, 4 / zoom]}
              draggable
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

                onDoorDragEnd(opening.id, { x: newCenterX, y: newCenterY });
              }}
              onTransformEnd={(e) => {
                if (!onOpeningTransform) return;

                const node = e.target;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // Get scaled dimensions
                const scaledWidth = node.width() * scaleX;
                const scaledHeight = node.height() * scaleY;

                // Width is always the "opening size" (longer dimension)
                const newOpeningWidthPx = isVertical ? scaledHeight : scaledWidth;
                const newWidthFeet = Math.max(2, Math.round(newOpeningWidthPx / pixelsPerFoot));
                const actualWidthPx = newWidthFeet * pixelsPerFoot;

                // New rect dimensions
                const newRectWidth = isVertical ? openingThicknessPx : actualWidthPx;
                const newRectHeight = isVertical ? actualWidthPx : openingThicknessPx;

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

                onOpeningTransform(opening.id, newWidthFeet, { x: newCenterX, y: newCenterY });

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
                onDoorClick(opening.id, e);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onDoorClick(opening.id, e);
              }}
            />
            {/* "OPEN" text label */}
            <Text
              x={opening.position.x}
              y={opening.position.y - (isVertical ? 0 : 14 / zoom)}
              text="OPEN"
              fontSize={10 / zoom}
              fill={isSelected ? "#961818" : "#666"}
              align="center"
              offsetX={isVertical ? 5 / zoom : 15 / zoom}
              rotation={isVertical ? 90 : 0}
              listening={false}
            />
          </React.Fragment>
        );
      })}

      {/* Transformer for selected opening - direction based on rotation */}
      <Transformer
        ref={openingTransformerRef}
        boundBoxFunc={(oldBox, newBox) => {
          // Snap the resizable dimension to grid (minimum 2 feet for openings)
          const minSize = 2 * gridSize; // 2 feet minimum

          if (isOpeningVertical) {
            // Vertical opening - resize height (which is the opening width)
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
            // Horizontal opening - resize width
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
        enabledAnchors={isOpeningVertical ? ['top-center', 'bottom-center'] : ['middle-left', 'middle-right']}
        rotateEnabled={false}
        ignoreStroke={true}
        keepRatio={false}
        centeredScaling={false}
        padding={4}
        anchorSize={8}
        anchorFill="#961818"
        anchorStroke="#ffffff"
        borderStroke="#961818"
        borderStrokeWidth={1}
      />
    </Group>
  );
}
