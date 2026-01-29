"use client";

import React, { useCallback, useRef } from "react";
import { Rect, Line, Text, Group, Circle, Transformer } from "react-konva";
import type Konva from "konva";
import type { Room, Door, Point } from "@/lib/types";
import type { CanvasConfig } from "../types";

interface RoomsProps {
  config: CanvasConfig;
  rooms: Room[];
  doors: Door[];
  selectedRoomId: string | null;
  onRoomClick: (roomId: string) => void;
  onRoomDragEnd: (roomId: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onRoomTransform: (roomId: string, e: Konva.KonvaEventObject<Event>) => void;
  onVertexDrag: (roomId: string, vertexIndex: number, newPos: Point) => void;
  onVertexRemove: (roomId: string, vertexIndex: number) => void;
  transformerRef: React.RefObject<Konva.Transformer | null>;
  roomRefs: React.MutableRefObject<Map<string, Konva.Rect>>;
}

export function Rooms({
  config,
  rooms,
  doors,
  selectedRoomId,
  onRoomClick,
  onRoomDragEnd,
  onRoomTransform,
  onVertexDrag,
  onVertexRemove,
  transformerRef,
  roomRefs,
}: RoomsProps) {
  const { gridSize, pixelsPerFoot } = config;

  // Buffer for polygon vertex drag
  const polygonDragBufferRef = useRef<{ roomId: string; vertexIndex: number; pos: Point } | null>(null);

  // Snap to grid
  const snapToGrid = (value: number) => Math.round(value / gridSize) * gridSize;

  // Format feet to feet-inches string
  const formatFeetInches = (feet: number): string => {
    const wholeFeet = Math.floor(feet);
    const inches = Math.round((feet - wholeFeet) * 12);
    if (inches === 0) {
      return `${wholeFeet}'-0"`;
    }
    return `${wholeFeet}'-${inches}"`;
  };

  // Calculate polygon area
  const calculatePolygonArea = (vertices: Point[]): number => {
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

  // Get wall segments excluding openings (for room outlines)
  const getWallSegmentsExcludingOpenings = useCallback((roomVertices: Point[], openPassages: Door[]) => {
    const segments: { start: Point; end: Point }[] = [];
    const tolerance = gridSize / 4;

    for (let i = 0; i < roomVertices.length; i++) {
      const start = roomVertices[i];
      const end = roomVertices[(i + 1) % roomVertices.length];

      const isHorizontalEdge = Math.abs(start.y - end.y) < tolerance;
      const isVerticalEdge = Math.abs(start.x - end.x) < tolerance;

      const edgeOpenings: { cutStart: number; cutEnd: number }[] = [];

      for (const opening of openPassages) {
        const openingCenterX = opening.position.x;
        const openingCenterY = opening.position.y;
        const isOpeningVertical = opening.rotation % 180 === 90;
        const openingHalfWidth = (opening.width * pixelsPerFoot) / 2;

        if (isHorizontalEdge && !isOpeningVertical) {
          const edgeY = (start.y + end.y) / 2;
          if (Math.abs(openingCenterY - edgeY) < tolerance) {
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            if (openingCenterX >= minX - tolerance && openingCenterX <= maxX + tolerance) {
              edgeOpenings.push({
                cutStart: openingCenterX - openingHalfWidth,
                cutEnd: openingCenterX + openingHalfWidth,
              });
            }
          }
        } else if (isVerticalEdge && isOpeningVertical) {
          const edgeX = (start.x + end.x) / 2;
          if (Math.abs(openingCenterX - edgeX) < tolerance) {
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);
            if (openingCenterY >= minY - tolerance && openingCenterY <= maxY + tolerance) {
              edgeOpenings.push({
                cutStart: openingCenterY - openingHalfWidth,
                cutEnd: openingCenterY + openingHalfWidth,
              });
            }
          }
        }
      }

      if (edgeOpenings.length === 0) {
        segments.push({ start, end });
      } else {
        edgeOpenings.sort((a, b) => a.cutStart - b.cutStart);

        if (isHorizontalEdge) {
          const edgeStart = Math.min(start.x, end.x);
          const edgeEnd = Math.max(start.x, end.x);
          const y = start.y;

          let currentPos = edgeStart;
          for (const opening of edgeOpenings) {
            if (opening.cutStart > currentPos) {
              segments.push({
                start: { x: currentPos, y },
                end: { x: Math.min(opening.cutStart, edgeEnd), y },
              });
            }
            currentPos = Math.max(currentPos, opening.cutEnd);
          }
          if (currentPos < edgeEnd) {
            segments.push({
              start: { x: currentPos, y },
              end: { x: edgeEnd, y },
            });
          }
        } else if (isVerticalEdge) {
          const edgeStart = Math.min(start.y, end.y);
          const edgeEnd = Math.max(start.y, end.y);
          const x = start.x;

          let currentPos = edgeStart;
          for (const opening of edgeOpenings) {
            if (opening.cutStart > currentPos) {
              segments.push({
                start: { x, y: currentPos },
                end: { x, y: Math.min(opening.cutStart, edgeEnd) },
              });
            }
            currentPos = Math.max(currentPos, opening.cutEnd);
          }
          if (currentPos < edgeEnd) {
            segments.push({
              start: { x, y: currentPos },
              end: { x, y: edgeEnd },
            });
          }
        } else {
          segments.push({ start, end });
        }
      }
    }

    return segments;
  }, [gridSize, pixelsPerFoot]);

  // Get open passages (doors with type "opening")
  const openPassages = doors.filter(d => d.type === "opening");

  return (
    <Group>
      {rooms.map((room) => {
        const isSelected = selectedRoomId === room.id;
        const isRectangle = room.vertices.length === 4;
        const wallSegments = getWallSegmentsExcludingOpenings(room.vertices, openPassages);

        // Calculate dimensions for label
        let widthFeet = 0;
        let heightFeet = 0;
        if (isRectangle) {
          const width = room.vertices[1].x - room.vertices[0].x;
          const height = room.vertices[2].y - room.vertices[0].y;
          widthFeet = Math.abs(width) / pixelsPerFoot;
          heightFeet = Math.abs(height) / pixelsPerFoot;
        }

        // Calculate center for labels
        const centerX = room.vertices.reduce((sum, v) => sum + v.x, 0) / room.vertices.length;
        const centerY = room.vertices.reduce((sum, v) => sum + v.y, 0) / room.vertices.length;

        if (isRectangle) {
          const x = room.vertices[0].x;
          const y = room.vertices[0].y;
          const width = room.vertices[1].x - room.vertices[0].x;
          const height = room.vertices[2].y - room.vertices[0].y;

          return (
            <Group key={room.id}>
              {/* Room rectangle */}
              <Rect
                ref={(node) => {
                  if (node) roomRefs.current.set(room.id, node);
                }}
                x={x}
                y={y}
                width={width}
                height={height}
                fill={room.color}
                opacity={0.6}
                stroke={isSelected ? "#1a1a1a" : "#666666"}
                strokeWidth={isSelected ? 3 : 2}
                draggable
                onClick={() => onRoomClick(room.id)}
                onTap={() => onRoomClick(room.id)}
                onDragEnd={(e) => onRoomDragEnd(room.id, e)}
                onTransformEnd={(e) => onRoomTransform(room.id, e)}
                onDragMove={(e) => {
                  const node = e.target;
                  node.x(snapToGrid(node.x()));
                  node.y(snapToGrid(node.y()));
                }}
              />

              {/* Wall lines (excluding openings) */}
              {wallSegments.map((segment, i) => (
                <Line
                  key={`wall-${room.id}-${i}`}
                  points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                  stroke="#333333"
                  strokeWidth={4}
                  lineCap="round"
                  listening={false}
                />
              ))}

              {/* Room label */}
              <Text
                x={centerX}
                y={centerY - 20}
                text={room.name}
                fontSize={14}
                fontStyle="bold"
                fill="#333333"
                align="center"
                offsetX={room.name.length * 3.5}
                listening={false}
              />

              {/* Dimensions label */}
              <Text
                x={centerX}
                y={centerY}
                text={`${formatFeetInches(widthFeet)} × ${formatFeetInches(heightFeet)}`}
                fontSize={11}
                fill="#666666"
                align="center"
                offsetX={40}
                listening={false}
              />

              {/* Area label */}
              <Text
                x={centerX}
                y={centerY + 16}
                text={`${room.area} sq ft`}
                fontSize={11}
                fill="#666666"
                align="center"
                offsetX={25}
                listening={false}
              />
            </Group>
          );
        } else {
          // Polygon room
          const flatPoints = room.vertices.flatMap(v => [v.x, v.y]);

          return (
            <Group key={room.id}>
              {/* Room polygon fill */}
              <Line
                points={flatPoints}
                closed
                fill={room.color}
                opacity={0.6}
                stroke={isSelected ? "#1a1a1a" : "#666666"}
                strokeWidth={isSelected ? 3 : 2}
                onClick={() => onRoomClick(room.id)}
                onTap={() => onRoomClick(room.id)}
              />

              {/* Wall lines (excluding openings) */}
              {wallSegments.map((segment, i) => (
                <Line
                  key={`wall-${room.id}-${i}`}
                  points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                  stroke="#333333"
                  strokeWidth={4}
                  lineCap="round"
                  listening={false}
                />
              ))}

              {/* Room label */}
              <Text
                x={centerX}
                y={centerY - 10}
                text={room.name}
                fontSize={14}
                fontStyle="bold"
                fill="#333333"
                align="center"
                offsetX={room.name.length * 3.5}
                listening={false}
              />

              {/* Area label */}
              <Text
                x={centerX}
                y={centerY + 6}
                text={`${room.area} sq ft`}
                fontSize={11}
                fill="#666666"
                align="center"
                offsetX={25}
                listening={false}
              />

              {/* Vertex handles for selected polygon */}
              {isSelected && room.vertices.map((vertex, index) => (
                <Circle
                  key={`vertex-${room.id}-${index}`}
                  x={vertex.x}
                  y={vertex.y}
                  radius={8}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={2}
                  draggable
                  onDragMove={(e) => {
                    const pos = e.target.position();
                    polygonDragBufferRef.current = {
                      roomId: room.id,
                      vertexIndex: index,
                      pos: { x: snapToGrid(pos.x), y: snapToGrid(pos.y) },
                    };
                    e.target.position({ x: snapToGrid(pos.x), y: snapToGrid(pos.y) });
                  }}
                  onDragEnd={() => {
                    if (polygonDragBufferRef.current) {
                      const { roomId, vertexIndex, pos } = polygonDragBufferRef.current;
                      onVertexDrag(roomId, vertexIndex, pos);
                      polygonDragBufferRef.current = null;
                    }
                  }}
                  onDblClick={() => onVertexRemove(room.id, index)}
                  onDblTap={() => onVertexRemove(room.id, index)}
                  style={{ cursor: "move" }}
                />
              ))}
            </Group>
          );
        }
      })}

      {/* Transformer for selected rectangle room */}
      <Transformer
        ref={transformerRef}
        boundBoxFunc={(oldBox, newBox) => {
          const minSize = gridSize;
          if (newBox.width < minSize || newBox.height < minSize) {
            return oldBox;
          }
          return newBox;
        }}
        rotateEnabled={false}
        enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
        anchorSize={10}
        anchorCornerRadius={5}
        borderStroke="#1a1a1a"
        borderStrokeWidth={2}
        anchorFill="#ffffff"
        anchorStroke="#1a1a1a"
      />
    </Group>
  );
}
