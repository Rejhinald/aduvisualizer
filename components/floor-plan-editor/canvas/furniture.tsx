"use client";

import React, { useRef } from "react";
import { Rect, Group, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { Point } from "@/lib/types";
import type { Furniture as FurnitureItem, FurnitureType, CanvasConfig } from "../types";

interface FurnitureProps {
  config: CanvasConfig;
  furniture: FurnitureItem[];
  furnitureImages: Record<FurnitureType, HTMLImageElement | null>;
  selectedFurnitureId: string | null;
  selectedFurnitureIds?: Set<string>;
  snapMode: "grid" | "half" | "free";
  onFurnitureClick: (furnitureId: string, e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onFurnitureDragEnd: (furnitureId: string, position: Point) => void;
  multiDragDelta?: Point;
  onMultiDragStart?: () => void;
  onMultiDragMove?: (delta: Point) => void;
  onMultiDragEnd?: (delta: Point) => void;
  zoom?: number;
}

export function Furniture({
  config,
  furniture,
  furnitureImages,
  selectedFurnitureId,
  selectedFurnitureIds = new Set(),
  snapMode,
  onFurnitureClick,
  onFurnitureDragEnd,
  multiDragDelta,
  onMultiDragStart,
  onMultiDragMove,
  onMultiDragEnd,
  zoom = 1,
}: FurnitureProps) {
  const { gridSize, pixelsPerFoot } = config;

  // Track multi-drag start position and which furniture is being dragged
  const multiDragStartRef = useRef<Point | null>(null);
  const draggingFurnitureIdRef = useRef<string | null>(null);

  // Snap function based on mode
  const snapFurniture = (value: number) => {
    if (snapMode === "free") {
      return value;
    } else if (snapMode === "half") {
      const halfGrid = gridSize / 2;
      return Math.round(value / halfGrid) * halfGrid;
    } else {
      return Math.round(value / gridSize) * gridSize;
    }
  };

  return (
    <Group>
      {furniture.map((item) => {
        const isSelected = selectedFurnitureId === item.id;
        const isMultiSelected = selectedFurnitureIds.has(item.id);
        const widthPx = item.width * pixelsPerFoot;
        const heightPx = item.height * pixelsPerFoot;
        const image = furnitureImages[item.type];

        // Calculate preview offset for multi-selected furniture that isn't being dragged
        const isBeingDragged = draggingFurnitureIdRef.current === item.id;
        const previewOffset = (isMultiSelected && !isBeingDragged && multiDragDelta)
          ? multiDragDelta
          : { x: 0, y: 0 };

        // Adjust dimensions if rotated 90 or 270 degrees
        const isRotated90or270 = item.rotation === 90 || item.rotation === 270;
        const displayWidth = isRotated90or270 ? heightPx : widthPx;
        const displayHeight = isRotated90or270 ? widthPx : heightPx;

        return (
          <Group
            key={item.id}
            x={item.position.x + previewOffset.x}
            y={item.position.y + previewOffset.y}
            draggable
            onDragStart={(e) => {
              // Track start position for multi-drag
              if (isMultiSelected && onMultiDragEnd) {
                const group = e.target;
                multiDragStartRef.current = { x: group.x(), y: group.y() };
                draggingFurnitureIdRef.current = item.id;
                onMultiDragStart?.();
              }
            }}
            onDragMove={(e) => {
              const node = e.target;
              node.x(snapFurniture(node.x()));
              node.y(snapFurniture(node.y()));

              // Update multi-drag preview delta
              if (isMultiSelected && multiDragStartRef.current && onMultiDragMove) {
                const delta = {
                  x: node.x() - multiDragStartRef.current.x,
                  y: node.y() - multiDragStartRef.current.y,
                };
                onMultiDragMove(delta);
              }
            }}
            onDragEnd={(e) => {
              const node = e.target;
              const newPos = { x: node.x(), y: node.y() };

              // Handle multi-drag
              if (isMultiSelected && onMultiDragEnd && multiDragStartRef.current) {
                const delta = {
                  x: newPos.x - item.position.x,
                  y: newPos.y - item.position.y,
                };
                // Reset position (will be updated by parent)
                node.x(item.position.x);
                node.y(item.position.y);
                multiDragStartRef.current = null;
                draggingFurnitureIdRef.current = null;
                onMultiDragEnd(delta);
              } else {
                onFurnitureDragEnd(item.id, newPos);
              }
            }}
            onClick={(e) => onFurnitureClick(item.id, e)}
            onTap={(e) => onFurnitureClick(item.id, e)}
          >
            {/* Multi-selection highlight */}
            {isMultiSelected && (
              <Rect
                x={-displayWidth / 2 - 6}
                y={-displayHeight / 2 - 6}
                width={displayWidth + 12}
                height={displayHeight + 12}
                stroke="#3b82f6"
                strokeWidth={2 / zoom}
                dash={[6 / zoom, 3 / zoom]}
                fill="transparent"
                listening={false}
              />
            )}
            {/* Background rectangle */}
            <Rect
              x={-displayWidth / 2}
              y={-displayHeight / 2}
              width={displayWidth}
              height={displayHeight}
              fill="#f5f5f5"
              stroke={isSelected ? "#3b82f6" : isMultiSelected ? "#3b82f6" : "#999999"}
              strokeWidth={isSelected || isMultiSelected ? 2 : 1}
              cornerRadius={2}
            />

            {/* Furniture SVG image */}
            {image && (
              <KonvaImage
                image={image}
                x={-displayWidth / 2}
                y={-displayHeight / 2}
                width={displayWidth}
                height={displayHeight}
                rotation={item.rotation}
                offsetX={item.rotation === 90 ? 0 : item.rotation === 180 ? displayWidth : item.rotation === 270 ? displayHeight : 0}
                offsetY={item.rotation === 90 ? displayWidth : item.rotation === 180 ? displayHeight : item.rotation === 270 ? 0 : 0}
                listening={false}
              />
            )}

            {/* Selection indicator (only for single selection, not multi) */}
            {isSelected && !isMultiSelected && (
              <Rect
                x={-displayWidth / 2 - 4}
                y={-displayHeight / 2 - 4}
                width={displayWidth + 8}
                height={displayHeight + 8}
                stroke="#3b82f6"
                strokeWidth={2}
                dash={[5, 3]}
                fill="transparent"
                listening={false}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
