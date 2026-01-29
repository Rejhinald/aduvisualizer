"use client";

import React from "react";
import { Rect, Group, Image as KonvaImage } from "react-konva";
import type { Point } from "@/lib/types";
import type { Furniture as FurnitureItem, FurnitureType, CanvasConfig } from "../types";

interface FurnitureProps {
  config: CanvasConfig;
  furniture: FurnitureItem[];
  furnitureImages: Record<FurnitureType, HTMLImageElement | null>;
  selectedFurnitureId: string | null;
  snapMode: "grid" | "half" | "free";
  onFurnitureClick: (furnitureId: string) => void;
  onFurnitureDragEnd: (furnitureId: string, position: Point) => void;
}

export function Furniture({
  config,
  furniture,
  furnitureImages,
  selectedFurnitureId,
  snapMode,
  onFurnitureClick,
  onFurnitureDragEnd,
}: FurnitureProps) {
  const { gridSize, pixelsPerFoot } = config;

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
        const widthPx = item.width * pixelsPerFoot;
        const heightPx = item.height * pixelsPerFoot;
        const image = furnitureImages[item.type];

        // Adjust dimensions if rotated 90 or 270 degrees
        const isRotated90or270 = item.rotation === 90 || item.rotation === 270;
        const displayWidth = isRotated90or270 ? heightPx : widthPx;
        const displayHeight = isRotated90or270 ? widthPx : heightPx;

        return (
          <Group
            key={item.id}
            x={item.position.x}
            y={item.position.y}
            draggable
            onDragMove={(e) => {
              const node = e.target;
              node.x(snapFurniture(node.x()));
              node.y(snapFurniture(node.y()));
            }}
            onDragEnd={(e) => {
              const node = e.target;
              onFurnitureDragEnd(item.id, { x: node.x(), y: node.y() });
            }}
            onClick={() => onFurnitureClick(item.id)}
            onTap={() => onFurnitureClick(item.id)}
          >
            {/* Background rectangle */}
            <Rect
              x={-displayWidth / 2}
              y={-displayHeight / 2}
              width={displayWidth}
              height={displayHeight}
              fill="#f5f5f5"
              stroke={isSelected ? "#3b82f6" : "#999999"}
              strokeWidth={isSelected ? 2 : 1}
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

            {/* Selection indicator */}
            {isSelected && (
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
