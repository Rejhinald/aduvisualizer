"use client";

import React from "react";
import { Rect, Line, Group, Transformer } from "react-konva";
import type Konva from "konva";
import type { Window, Point } from "@/lib/types";
import type { CanvasConfig } from "../types";

interface WindowsProps {
  config: CanvasConfig;
  windows: Window[];
  selectedWindowId: string | null;
  onWindowClick: (windowId: string) => void;
  onWindowDragEnd: (windowId: string, position: Point) => void;
  onWindowTransform: (windowId: string, newWidth: number) => void;
  transformerRef: React.RefObject<Konva.Transformer | null>;
  windowRefs: React.MutableRefObject<Map<string, Konva.Rect>>;
}

export function Windows({
  config,
  windows,
  selectedWindowId,
  onWindowClick,
  onWindowDragEnd,
  onWindowTransform,
  transformerRef,
  windowRefs,
}: WindowsProps) {
  const { gridSize, pixelsPerFoot } = config;

  // Snap to grid
  const snapToGrid = (value: number) => Math.round(value / gridSize) * gridSize;

  return (
    <Group>
      {windows.map((window) => {
        const isSelected = selectedWindowId === window.id;
        const windowWidthPx = window.width * pixelsPerFoot;
        const isVertical = window.rotation % 180 === 90;
        const halfWidth = windowWidthPx / 2;
        const thickness = 6; // Wall thickness representation

        return (
          <Group
            key={window.id}
            x={window.position.x}
            y={window.position.y}
            draggable
            onDragMove={(e) => {
              const node = e.target;
              node.x(snapToGrid(node.x()));
              node.y(snapToGrid(node.y()));
            }}
            onDragEnd={(e) => {
              const node = e.target;
              onWindowDragEnd(window.id, { x: node.x(), y: node.y() });
            }}
            onClick={() => onWindowClick(window.id)}
            onTap={() => onWindowClick(window.id)}
          >
            {/* Wall gap (white background) */}
            <Rect
              x={isVertical ? -thickness / 2 : -halfWidth}
              y={isVertical ? -halfWidth : -thickness / 2}
              width={isVertical ? thickness : windowWidthPx}
              height={isVertical ? windowWidthPx : thickness}
              fill="#ffffff"
              listening={false}
            />

            {/* Window frame - outer rectangle */}
            <Rect
              ref={(node) => {
                if (node) windowRefs.current.set(window.id, node);
              }}
              x={isVertical ? -thickness / 2 : -halfWidth}
              y={isVertical ? -halfWidth : -thickness / 2}
              width={isVertical ? thickness : windowWidthPx}
              height={isVertical ? windowWidthPx : thickness}
              fill="#87CEEB"
              opacity={0.5}
              stroke={isSelected ? "#3b82f6" : "#4A90D9"}
              strokeWidth={isSelected ? 3 : 2}
            />

            {/* Glass pane lines */}
            <Line
              points={
                isVertical
                  ? [0, -halfWidth + 2, 0, halfWidth - 2]
                  : [-halfWidth + 2, 0, halfWidth - 2, 0]
              }
              stroke="#4A90D9"
              strokeWidth={1}
              listening={false}
            />

            {/* Cross pane (for standard windows) */}
            {window.type === "standard" && (
              <Line
                points={
                  isVertical
                    ? [-thickness / 2 + 1, 0, thickness / 2 - 1, 0]
                    : [0, -thickness / 2 + 1, 0, thickness / 2 - 1]
                }
                stroke="#4A90D9"
                strokeWidth={1}
                listening={false}
              />
            )}

            {/* Sliding window indicator */}
            {window.type === "sliding" && (
              <>
                <Line
                  points={
                    isVertical
                      ? [-thickness / 4, -halfWidth + 4, -thickness / 4, halfWidth - 4]
                      : [-halfWidth + 4, -thickness / 4, halfWidth - 4, -thickness / 4]
                  }
                  stroke="#4A90D9"
                  strokeWidth={1.5}
                  listening={false}
                />
                <Line
                  points={
                    isVertical
                      ? [thickness / 4, -halfWidth + 4, thickness / 4, halfWidth - 4]
                      : [-halfWidth + 4, thickness / 4, halfWidth - 4, thickness / 4]
                  }
                  stroke="#4A90D9"
                  strokeWidth={1.5}
                  listening={false}
                />
              </>
            )}

            {/* Fixed window - no extra indicators, just solid glass look */}

            {/* Selection outline */}
            {isSelected && (
              <Rect
                x={isVertical ? -thickness / 2 - 4 : -halfWidth - 4}
                y={isVertical ? -halfWidth - 4 : -thickness / 2 - 4}
                width={isVertical ? thickness + 8 : windowWidthPx + 8}
                height={isVertical ? windowWidthPx + 8 : thickness + 8}
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

      {/* Transformer for selected window */}
      <Transformer
        ref={transformerRef}
        rotateEnabled={false}
        enabledAnchors={["middle-left", "middle-right"]}
        anchorSize={8}
        borderEnabled={false}
        anchorFill="#3b82f6"
        anchorStroke="#ffffff"
        boundBoxFunc={(oldBox, newBox) => {
          const minWidth = pixelsPerFoot; // Minimum 1 foot
          if (newBox.width < minWidth) {
            return oldBox;
          }
          return newBox;
        }}
        onTransformEnd={(e) => {
          const node = e.target;
          const scaleX = node.scaleX();
          const newWidthPx = node.width() * scaleX;
          const newWidthFeet = newWidthPx / pixelsPerFoot;

          // Get window id from refs
          for (const [id, ref] of windowRefs.current.entries()) {
            if (ref === node) {
              onWindowTransform(id, Math.round(newWidthFeet * 2) / 2); // Round to nearest 0.5 feet
              break;
            }
          }

          // Reset scale
          node.scaleX(1);
          node.scaleY(1);
        }}
      />
    </Group>
  );
}
