"use client";

import React from "react";
import { Rect, Line, Arc, Group, Transformer } from "react-konva";
import type Konva from "konva";
import type { Door, Point } from "@/lib/types";
import type { CanvasConfig } from "../types";

interface DoorsProps {
  config: CanvasConfig;
  doors: Door[];
  selectedDoorId: string | null;
  onDoorClick: (doorId: string) => void;
  onDoorDragEnd: (doorId: string, position: Point) => void;
  openingTransformerRef: React.RefObject<Konva.Transformer | null>;
  openingRefs: React.MutableRefObject<Map<string, Konva.Rect>>;
}

export function Doors({
  config,
  doors,
  selectedDoorId,
  onDoorClick,
  onDoorDragEnd,
  openingTransformerRef,
  openingRefs,
}: DoorsProps) {
  const { gridSize, pixelsPerFoot } = config;

  // Snap to grid
  const snapToGrid = (value: number) => Math.round(value / gridSize) * gridSize;

  return (
    <Group>
      {doors.map((door) => {
        const isSelected = selectedDoorId === door.id;
        const doorWidthPx = door.width * pixelsPerFoot;
        const isVertical = door.rotation % 180 === 90;

        if (door.type === "opening") {
          // Open passage - just a gap with small markers
          const halfWidth = doorWidthPx / 2;
          const markerLength = 6;

          return (
            <Group
              key={door.id}
              x={door.position.x}
              y={door.position.y}
              rotation={door.rotation}
            >
              {/* Selectable invisible rect */}
              <Rect
                ref={(node) => {
                  if (node) openingRefs.current.set(door.id, node);
                }}
                x={-halfWidth}
                y={-markerLength / 2}
                width={doorWidthPx}
                height={markerLength}
                fill="transparent"
                stroke={isSelected ? "#3b82f6" : "transparent"}
                strokeWidth={2}
                dash={isSelected ? [5, 3] : undefined}
                draggable
                onClick={() => onDoorClick(door.id)}
                onTap={() => onDoorClick(door.id)}
                onDragMove={(e) => {
                  const node = e.target;
                  const parent = node.getParent();
                  if (parent) {
                    parent.x(snapToGrid(parent.x() + node.x()));
                    parent.y(snapToGrid(parent.y() + node.y()));
                    node.x(0);
                    node.y(0);
                  }
                }}
                onDragEnd={(e) => {
                  const parent = e.target.getParent();
                  if (parent) {
                    onDoorDragEnd(door.id, { x: parent.x(), y: parent.y() });
                  }
                }}
              />

              {/* End markers */}
              <Line
                points={[-halfWidth, -markerLength, -halfWidth, markerLength]}
                stroke="#666666"
                strokeWidth={2}
                listening={false}
              />
              <Line
                points={[halfWidth, -markerLength, halfWidth, markerLength]}
                stroke="#666666"
                strokeWidth={2}
                listening={false}
              />
            </Group>
          );
        } else {
          // Standard hinged or sliding door
          const halfWidth = doorWidthPx / 2;
          const arcRadius = doorWidthPx * 0.9;

          // Determine arc angles based on door type and rotation
          let arcAngle = 90;
          let arcRotation = 0;

          if (door.type === "sliding") {
            arcAngle = 0; // No swing arc for sliding doors
          }

          // Base rotation for the arc
          const rotationMod = door.rotation % 360;
          if (rotationMod === 0) arcRotation = -90;
          else if (rotationMod === 90) arcRotation = 0;
          else if (rotationMod === 180) arcRotation = 90;
          else if (rotationMod === 270) arcRotation = 180;

          return (
            <Group
              key={door.id}
              x={door.position.x}
              y={door.position.y}
              draggable
              onDragMove={(e) => {
                const node = e.target;
                node.x(snapToGrid(node.x()));
                node.y(snapToGrid(node.y()));
              }}
              onDragEnd={(e) => {
                const node = e.target;
                onDoorDragEnd(door.id, { x: node.x(), y: node.y() });
              }}
              onClick={() => onDoorClick(door.id)}
              onTap={() => onDoorClick(door.id)}
            >
              {/* Wall gap (white background) */}
              <Rect
                x={isVertical ? -3 : -halfWidth}
                y={isVertical ? -halfWidth : -3}
                width={isVertical ? 6 : doorWidthPx}
                height={isVertical ? doorWidthPx : 6}
                fill="#ffffff"
                listening={false}
              />

              {/* Door leaf */}
              <Line
                points={
                  isVertical
                    ? [0, -halfWidth, 0, halfWidth]
                    : [-halfWidth, 0, halfWidth, 0]
                }
                stroke={isSelected ? "#3b82f6" : "#8B4513"}
                strokeWidth={3}
                listening={false}
              />

              {/* Swing arc (for hinged doors: single, double, french) */}
              {(door.type === "single" || door.type === "double" || door.type === "french") && (
                <Arc
                  x={isVertical ? 0 : -halfWidth}
                  y={isVertical ? -halfWidth : 0}
                  innerRadius={arcRadius}
                  outerRadius={arcRadius}
                  angle={arcAngle}
                  rotation={arcRotation}
                  stroke={isSelected ? "#3b82f6" : "#8B4513"}
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                />
              )}

              {/* Sliding door slide indicator */}
              {door.type === "sliding" && (
                <Line
                  points={
                    isVertical
                      ? [8, -halfWidth, 8, halfWidth]
                      : [-halfWidth, 8, halfWidth, 8]
                  }
                  stroke={isSelected ? "#3b82f6" : "#8B4513"}
                  strokeWidth={1}
                  dash={[3, 3]}
                  listening={false}
                />
              )}

              {/* Selection indicator */}
              {isSelected && (
                <Rect
                  x={isVertical ? -8 : -halfWidth - 5}
                  y={isVertical ? -halfWidth - 5 : -8}
                  width={isVertical ? 16 : doorWidthPx + 10}
                  height={isVertical ? doorWidthPx + 10 : 16}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dash={[5, 3]}
                  fill="transparent"
                  listening={false}
                />
              )}
            </Group>
          );
        }
      })}

      {/* Transformer for selected opening */}
      <Transformer
        ref={openingTransformerRef}
        rotateEnabled={false}
        enabledAnchors={["middle-left", "middle-right"]}
        anchorSize={8}
        borderEnabled={false}
        anchorFill="#3b82f6"
        anchorStroke="#ffffff"
      />
    </Group>
  );
}
