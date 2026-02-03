"use client";

import React, { useCallback, useRef, useState } from "react";
import { Rect, Line, Text, Group, Circle, Transformer, Label, Tag } from "react-konva";
import type Konva from "konva";
import type { Room, Door, Window, Point } from "@/lib/types";
import type { CanvasConfig } from "../types";

// Live preview state for dragging/resizing
interface LivePreviewState {
  roomId: string;
  type: 'drag' | 'resize';
  x: number;
  y: number;
  width: number;
  height: number;
  widthFeet: number;
  heightFeet: number;
  areaFeet: number;
}

// Polygon vertex drag preview state
interface PolygonVertexPreview {
  roomId: string;
  vertexIndex: number;
  originalVertices: Point[];
  previewVertices: Point[];
  previewArea: number;
  isMidpointDrag?: boolean; // True when dragging a midpoint handle to add a new vertex
  insertAfterIndex?: number; // Index of the vertex after which the new vertex is being inserted
}

interface WallSegment {
  start: Point;
  end: Point;
  lengthFeet: number;
  openings: Array<{ type: 'door' | 'window'; widthFeet: number; position: Point }>;
  effectiveLengthFeet: number;
}

interface RoomsProps {
  config: CanvasConfig;
  rooms: Room[];
  doors: Door[];
  windows?: Window[];
  selectedRoomId: string | null;
  selectedRoomIds?: Set<string>;
  onRoomClick: (roomId: string, e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: () => void; // Called when any drag/resize operation starts
  onRoomDragEnd: (roomId: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onRoomTransform: (roomId: string, e: Konva.KonvaEventObject<Event>) => void;
  onVertexDrag: (roomId: string, vertexIndex: number, newPos: Point) => void;
  onVertexRemove: (roomId: string, vertexIndex: number) => void;
  onAddVertex?: (roomId: string, afterIndex: number, newPos: Point) => void;
  multiDragDelta?: Point; // Live drag offset for preview
  onMultiDragStart?: () => void;
  onMultiDragMove?: (delta: Point) => void;
  onMultiDragEnd?: (delta: Point) => void;
  transformerRef: React.RefObject<Konva.Transformer | null>;
  roomRefs: React.MutableRefObject<Map<string, Konva.Rect>>;
  zoom?: number;
}

export function Rooms({
  config,
  rooms,
  doors,
  windows = [],
  selectedRoomId,
  selectedRoomIds = new Set(),
  onRoomClick,
  onDragStart,
  onRoomDragEnd,
  onRoomTransform,
  onVertexDrag,
  onVertexRemove,
  onAddVertex,
  multiDragDelta,
  onMultiDragStart,
  onMultiDragMove,
  onMultiDragEnd,
  transformerRef,
  roomRefs,
  zoom = 1,
}: RoomsProps) {
  const { gridSize, pixelsPerFoot, extendedCanvasSize } = config;

  // Buffer for polygon vertex drag
  const polygonDragBufferRef = useRef<{ roomId: string; vertexIndex: number; pos: Point } | null>(null);

  // Track multi-drag start position and which room is being dragged
  const multiDragStartRef = useRef<Point | null>(null);
  const draggingRoomIdRef = useRef<string | null>(null);

  // Check if there's an active multi-selection (includes any item type)
  const hasMultiSelection = selectedRoomIds.size > 0;

  // Live preview state for real-time dimension display
  const [livePreview, setLivePreview] = useState<LivePreviewState | null>(null);

  // Polygon vertex drag preview state
  const [polygonPreview, setPolygonPreview] = useState<PolygonVertexPreview | null>(null);

  // Snap to half-grid (0.5 foot increments)
  const halfGrid = gridSize / 2;
  const snapToGrid = (value: number) => Math.round(value / halfGrid) * halfGrid;

  // Calculate polygon area using shoelace formula
  const calculatePolygonArea = useCallback((vertices: Point[]): number => {
    if (vertices.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    area = Math.abs(area) / 2;
    return area / (pixelsPerFoot * pixelsPerFoot);
  }, [pixelsPerFoot]);

  // Constrain to canvas
  const constrainToCanvas = (point: Point): Point => ({
    x: Math.max(0, Math.min(point.x, extendedCanvasSize)),
    y: Math.max(0, Math.min(point.y, extendedCanvasSize)),
  });

  // Check if a point is inside a polygon using ray casting algorithm
  const isPointInPolygon = useCallback((point: Point, vertices: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }, []);

  // Find label position inside the polygon (visual center)
  const findLabelPosition = useCallback((vertices: Point[]): Point => {
    // Calculate centroid first
    const centroid = {
      x: vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length,
      y: vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length,
    };

    // If centroid is inside the polygon, use it
    if (isPointInPolygon(centroid, vertices)) {
      return centroid;
    }

    // For concave polygons where centroid is outside,
    // find the best point inside using a grid search approach
    const minX = Math.min(...vertices.map(v => v.x));
    const maxX = Math.max(...vertices.map(v => v.x));
    const minY = Math.min(...vertices.map(v => v.y));
    const maxY = Math.max(...vertices.map(v => v.y));

    // Sample points along horizontal lines through the polygon
    const samples: Point[] = [];
    const stepY = (maxY - minY) / 10;
    const stepX = (maxX - minX) / 10;

    for (let y = minY + stepY; y < maxY; y += stepY) {
      for (let x = minX + stepX; x < maxX; x += stepX) {
        const point = { x, y };
        if (isPointInPolygon(point, vertices)) {
          samples.push(point);
        }
      }
    }

    if (samples.length === 0) {
      // Fallback to centroid if no inside points found
      return centroid;
    }

    // Find the sample point with maximum distance to any edge (most "inside")
    let bestPoint = samples[0];
    let maxMinDist = 0;

    for (const sample of samples) {
      let minDist = Infinity;
      for (let i = 0; i < vertices.length; i++) {
        const j = (i + 1) % vertices.length;
        const dist = distanceToLineSegment(sample, vertices[i], vertices[j]);
        minDist = Math.min(minDist, dist);
      }
      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        bestPoint = sample;
      }
    }

    return bestPoint;
  }, [isPointInPolygon]);

  // Calculate distance from a point to a line segment
  const distanceToLineSegment = (point: Point, lineStart: Point, lineEnd: Point): number => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      // Line segment is a point
      return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
    }

    // Project point onto line
    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;

    return Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2));
  };

  // Format feet to feet-inches string
  const formatFeetInches = (feet: number): string => {
    const wholeFeet = Math.floor(feet);
    const inches = Math.round((feet - wholeFeet) * 12);
    if (inches === 0) {
      return `${wholeFeet}'-0"`;
    }
    return `${wholeFeet}'-${inches}"`;
  };

  // Darken a hex color by a percentage (0-1)
  const darkenColor = (hex: string, amount: number = 0.4): string => {
    // Remove # if present
    const color = hex.replace('#', '');
    const num = parseInt(color, 16);
    const r = Math.max(0, Math.floor((num >> 16) * (1 - amount)));
    const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - amount)));
    const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - amount)));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  };

  // Calculate dynamic font size based on room dimensions and zoom
  // Text should fit within the room and scale appropriately with zoom
  const calculateDynamicFontSize = useCallback((roomWidth: number, roomHeight: number, textLength: number): number => {
    // Calculate the smallest dimension of the room
    const minDimension = Math.min(roomWidth, roomHeight);

    // Base font size that would fit in the room (roughly 1/5 of smallest dimension for main text)
    const roomBasedSize = minDimension / 5;

    // Adjust based on text length (longer room names need smaller font)
    const textFactor = Math.min(1, 10 / Math.max(textLength, 1));

    // Calculate the size, with constraints
    const baseFontSize = 14;
    const calculatedSize = Math.min(roomBasedSize * textFactor, baseFontSize * 1.5);

    // Apply minimum and maximum bounds (in canvas units before zoom adjustment)
    const clampedSize = Math.max(8, Math.min(20, calculatedSize));

    // Divide by zoom to maintain visual consistency
    return clampedSize / zoom;
  }, [zoom]);

  // Check if an opening (door/window) is on a wall segment
  const isOpeningOnWall = useCallback((wallStart: Point, wallEnd: Point, opening: { position: Point; rotation: number; width: number }): boolean => {
    const tolerance = gridSize / 4;
    const openingPos = opening.position;

    // Check if wall is horizontal
    if (Math.abs(wallStart.y - wallEnd.y) < tolerance) {
      // Wall is horizontal - opening must be horizontal and Y-aligned
      const isHorizontal = opening.rotation % 180 === 0;
      const yAligned = Math.abs(openingPos.y - wallStart.y) < tolerance;
      const minX = Math.min(wallStart.x, wallEnd.x);
      const maxX = Math.max(wallStart.x, wallEnd.x);
      const xInRange = openingPos.x >= minX - tolerance && openingPos.x <= maxX + tolerance;
      return isHorizontal && yAligned && xInRange;
    }

    // Check if wall is vertical
    if (Math.abs(wallStart.x - wallEnd.x) < tolerance) {
      // Wall is vertical - opening must be vertical and X-aligned
      const isVertical = opening.rotation % 180 === 90;
      const xAligned = Math.abs(openingPos.x - wallStart.x) < tolerance;
      const minY = Math.min(wallStart.y, wallEnd.y);
      const maxY = Math.max(wallStart.y, wallEnd.y);
      const yInRange = openingPos.y >= minY - tolerance && openingPos.y <= maxY + tolerance;
      return isVertical && xAligned && yInRange;
    }

    return false;
  }, [gridSize]);

  // Calculate wall segments with openings for a room
  const calculateWallSegments = useCallback((room: Room): WallSegment[] => {
    const segments: WallSegment[] = [];

    for (let i = 0; i < room.vertices.length; i++) {
      const start = room.vertices[i];
      const end = room.vertices[(i + 1) % room.vertices.length];

      const lengthPx = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
      );
      const lengthFeet = lengthPx / pixelsPerFoot;

      // Find all openings on this wall
      const wallOpenings: Array<{ type: 'door' | 'window'; widthFeet: number; position: Point }> = [];

      // Check doors
      doors.forEach(door => {
        if (isOpeningOnWall(start, end, door)) {
          wallOpenings.push({ type: 'door', widthFeet: door.width, position: door.position });
        }
      });

      // Check windows
      windows.forEach(window => {
        if (isOpeningOnWall(start, end, window)) {
          wallOpenings.push({ type: 'window', widthFeet: window.width, position: window.position });
        }
      });

      // Calculate effective length
      const totalOpeningWidth = wallOpenings.reduce((sum, o) => sum + o.widthFeet, 0);
      const effectiveLengthFeet = lengthFeet - totalOpeningWidth;

      segments.push({
        start,
        end,
        lengthFeet,
        openings: wallOpenings,
        effectiveLengthFeet: Math.max(0, effectiveLengthFeet)
      });
    }

    return segments;
  }, [doors, windows, pixelsPerFoot, isOpeningOnWall]);

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
        const isMultiSelected = selectedRoomIds.has(room.id);
        const isRectangle = room.vertices.length === 4;

        // Calculate preview offset for multi-selected rooms that aren't being dragged
        const isBeingDragged = draggingRoomIdRef.current === room.id;
        const previewOffset = (isMultiSelected && !isBeingDragged && multiDragDelta)
          ? multiDragDelta
          : { x: 0, y: 0 };

        // Apply preview offset to vertices for rendering
        const renderVertices = previewOffset.x !== 0 || previewOffset.y !== 0
          ? room.vertices.map(v => ({ x: v.x + previewOffset.x, y: v.y + previewOffset.y }))
          : room.vertices;

        const wallSegments = getWallSegmentsExcludingOpenings(renderVertices, openPassages);

        // Calculate label position (always inside the shape)
        const labelPos = findLabelPosition(renderVertices);
        const centerX = labelPos.x;
        const centerY = labelPos.y;

        if (isRectangle) {
          // Calculate bounding box from vertices to handle any vertex order
          // (vertices may be reordered after rotation)
          const minX = Math.min(...renderVertices.map(v => v.x));
          const minY = Math.min(...renderVertices.map(v => v.y));
          const maxX = Math.max(...renderVertices.map(v => v.x));
          const maxY = Math.max(...renderVertices.map(v => v.y));
          const x = minX;
          const y = minY;
          const width = maxX - minX;
          const height = maxY - minY;

          return (
            <Group key={room.id}>
              {/* Multi-selection highlight */}
              {isMultiSelected && (
                <Rect
                  x={x - 4}
                  y={y - 4}
                  width={width + 8}
                  height={height + 8}
                  stroke="#3b82f6"
                  strokeWidth={2 / zoom}
                  dash={[8 / zoom, 4 / zoom]}
                  fill="transparent"
                  listening={false}
                />
              )}
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
                stroke={isSelected ? darkenColor(room.color, 0.6) : isMultiSelected ? "#3b82f6" : darkenColor(room.color, 0.3)}
                strokeWidth={isSelected || isMultiSelected ? 3 : 2}
                draggable
                onClick={(e) => onRoomClick(room.id, e)}
                onTap={(e) => onRoomClick(room.id, e)}
                onDragStart={(e) => {
                  onDragStart?.();
                  // Track start position for multi-drag
                  if (isMultiSelected && onMultiDragEnd) {
                    const node = e.target;
                    multiDragStartRef.current = { x: node.x(), y: node.y() };
                    draggingRoomIdRef.current = room.id;
                    onMultiDragStart?.();
                  }
                  const widthFeet = width / pixelsPerFoot;
                  const heightFeet = height / pixelsPerFoot;
                  setLivePreview({
                    roomId: room.id,
                    type: 'drag',
                    x, y, width, height,
                    widthFeet,
                    heightFeet,
                    areaFeet: widthFeet * heightFeet,
                  });
                }}
                onDragMove={(e) => {
                  const node = e.target;
                  const snappedX = snapToGrid(node.x());
                  const snappedY = snapToGrid(node.y());
                  node.x(snappedX);
                  node.y(snappedY);

                  // Update multi-drag preview delta
                  if (isMultiSelected && multiDragStartRef.current && onMultiDragMove) {
                    const delta = {
                      x: snappedX - multiDragStartRef.current.x,
                      y: snappedY - multiDragStartRef.current.y,
                    };
                    onMultiDragMove(delta);
                  }

                  const widthFeet = width / pixelsPerFoot;
                  const heightFeet = height / pixelsPerFoot;
                  setLivePreview({
                    roomId: room.id,
                    type: 'drag',
                    x: snappedX,
                    y: snappedY,
                    width,
                    height,
                    widthFeet,
                    heightFeet,
                    areaFeet: widthFeet * heightFeet,
                  });
                }}
                onDragEnd={(e) => {
                  setLivePreview(null);
                  // Handle multi-drag
                  if (isMultiSelected && onMultiDragEnd && multiDragStartRef.current) {
                    const node = e.target;
                    const delta = {
                      x: snapToGrid(node.x()) - multiDragStartRef.current.x,
                      y: snapToGrid(node.y()) - multiDragStartRef.current.y,
                    };
                    // Reset node position (will be updated by parent)
                    node.x(x);
                    node.y(y);
                    multiDragStartRef.current = null;
                    draggingRoomIdRef.current = null;
                    onMultiDragEnd(delta);
                  } else {
                    onRoomDragEnd(room.id, e);
                  }
                }}
                onTransformStart={() => {
                  // Disable transform during multi-selection
                  if (hasMultiSelection) return;
                  onDragStart?.();
                }}
                onTransform={(e) => {
                  // Disable transform during multi-selection
                  if (hasMultiSelection) return;
                  const node = e.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  const newWidth = snapToGrid(node.width() * scaleX);
                  const newHeight = snapToGrid(node.height() * scaleY);
                  const newX = snapToGrid(node.x());
                  const newY = snapToGrid(node.y());
                  const widthFeet = newWidth / pixelsPerFoot;
                  const heightFeet = newHeight / pixelsPerFoot;
                  setLivePreview({
                    roomId: room.id,
                    type: 'resize',
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight,
                    widthFeet,
                    heightFeet,
                    areaFeet: widthFeet * heightFeet,
                  });
                }}
                onTransformEnd={(e) => {
                  // Disable transform during multi-selection
                  if (hasMultiSelection) return;
                  setLivePreview(null);
                  onRoomTransform(room.id, e);
                }}
              />

              {/* Wall lines (excluding openings) - darker shade of room color */}
              {wallSegments.map((segment, i) => (
                <Line
                  key={`wall-${room.id}-${i}`}
                  points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                  stroke={darkenColor(room.color, 0.5)}
                  strokeWidth={4}
                  lineCap="round"
                  listening={false}
                />
              ))}

              {/* Room label */}
              {(() => {
                const dynamicFontSize = calculateDynamicFontSize(width, height, room.name.length);
                return (
                  <Text
                    x={centerX}
                    y={centerY - 10}
                    text={`${room.name}\n${room.area} sq ft`}
                    fontSize={dynamicFontSize}
                    fontStyle="bold"
                    fill="#0a0a0a"
                    align="center"
                    verticalAlign="middle"
                    offsetX={(dynamicFontSize * 0.85) * room.name.length / 2.5}
                    offsetY={dynamicFontSize * 0.7}
                    listening={false}
                    shadowColor="white"
                    shadowBlur={4 / zoom}
                    shadowOpacity={0.8}
                  />
                );
              })()}
            </Group>
          );
        } else {
          // Polygon room - use renderVertices for preview offset
          const flatPoints = renderVertices.flatMap(v => [v.x, v.y]);

          // Calculate bounding box for live preview
          const minX = Math.min(...renderVertices.map(v => v.x));
          const minY = Math.min(...renderVertices.map(v => v.y));
          const maxX = Math.max(...renderVertices.map(v => v.x));
          const maxY = Math.max(...renderVertices.map(v => v.y));
          const polyWidth = maxX - minX;
          const polyHeight = maxY - minY;

          // Render polygon Group and vertex handles as siblings (not nested)
          // This prevents coordinate system conflicts when dragging vertices
          return (
            <React.Fragment key={room.id}>
              {/* Multi-selection highlight for polygon */}
              {isMultiSelected && (
                <Rect
                  x={minX - 4}
                  y={minY - 4}
                  width={polyWidth + 8}
                  height={polyHeight + 8}
                  stroke="#3b82f6"
                  strokeWidth={2 / zoom}
                  dash={[8 / zoom, 4 / zoom]}
                  fill="transparent"
                  listening={false}
                />
              )}
              {/* Draggable group for the polygon shape (fill, walls, label only) */}
              <Group
                draggable
                onDragStart={(e) => {
                  onDragStart?.();
                  // Track start position for multi-drag
                  if (isMultiSelected && onMultiDragEnd) {
                    const group = e.target;
                    multiDragStartRef.current = { x: group.x(), y: group.y() };
                    draggingRoomIdRef.current = room.id;
                    onMultiDragStart?.();
                  }
                  const widthFeet = polyWidth / pixelsPerFoot;
                  const heightFeet = polyHeight / pixelsPerFoot;
                  setLivePreview({
                    roomId: room.id,
                    type: 'drag',
                    x: minX,
                    y: minY,
                    width: polyWidth,
                    height: polyHeight,
                    widthFeet,
                    heightFeet,
                    areaFeet: room.area,
                  });
                }}
                onDragMove={(e) => {
                  const group = e.target;
                  const snappedX = snapToGrid(group.x());
                  const snappedY = snapToGrid(group.y());
                  group.x(snappedX);
                  group.y(snappedY);

                  // Update multi-drag preview delta
                  if (isMultiSelected && multiDragStartRef.current && onMultiDragMove) {
                    const delta = {
                      x: snappedX - multiDragStartRef.current.x,
                      y: snappedY - multiDragStartRef.current.y,
                    };
                    onMultiDragMove(delta);
                  }

                  const widthFeet = polyWidth / pixelsPerFoot;
                  const heightFeet = polyHeight / pixelsPerFoot;
                  setLivePreview({
                    roomId: room.id,
                    type: 'drag',
                    x: minX + snappedX,
                    y: minY + snappedY,
                    width: polyWidth,
                    height: polyHeight,
                    widthFeet,
                    heightFeet,
                    areaFeet: room.area,
                  });
                }}
                onDragEnd={(e) => {
                  setLivePreview(null);
                  const group = e.target;
                  const deltaX = snapToGrid(group.x());
                  const deltaY = snapToGrid(group.y());

                  // Reset group position (we'll update the actual vertices)
                  group.x(0);
                  group.y(0);

                  // Handle multi-drag
                  if (isMultiSelected && onMultiDragEnd && multiDragStartRef.current) {
                    const delta = {
                      x: deltaX - multiDragStartRef.current.x,
                      y: deltaY - multiDragStartRef.current.y,
                    };
                    multiDragStartRef.current = null;
                    draggingRoomIdRef.current = null;
                    if (delta.x !== 0 || delta.y !== 0) {
                      onMultiDragEnd(delta);
                    }
                  } else {
                    // Update all vertices with the delta (-1 signals "move all")
                    if (deltaX !== 0 || deltaY !== 0) {
                      onVertexDrag(room.id, -1, { x: deltaX, y: deltaY });
                    }
                  }
                }}
              >
                {/* Room polygon fill */}
                <Line
                  points={flatPoints}
                  closed
                  fill={room.color}
                  opacity={0.6}
                  stroke={isSelected ? darkenColor(room.color, 0.6) : isMultiSelected ? "#3b82f6" : darkenColor(room.color, 0.3)}
                  strokeWidth={isSelected || isMultiSelected ? 3 : 2}
                  onClick={(e) => onRoomClick(room.id, e)}
                  onTap={(e) => onRoomClick(room.id, e)}
                />

                {/* Wall lines (excluding openings) - darker shade of room color */}
                {wallSegments.map((segment, i) => (
                  <Line
                    key={`wall-${room.id}-${i}`}
                    points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                    stroke={darkenColor(room.color, 0.5)}
                    strokeWidth={4}
                    lineCap="round"
                    listening={false}
                  />
                ))}

                {/* Room label */}
                {(() => {
                  const dynamicFontSize = calculateDynamicFontSize(polyWidth, polyHeight, room.name.length);
                  return (
                    <Text
                      x={centerX}
                      y={centerY}
                      text={`${room.name}\n${room.area} sq ft`}
                      fontSize={dynamicFontSize}
                      fontStyle="bold"
                      fill="#0a0a0a"
                      align="center"
                      verticalAlign="middle"
                      offsetX={(dynamicFontSize * 0.85) * room.name.length / 2.5}
                      offsetY={dynamicFontSize * 0.7}
                      listening={false}
                      shadowColor="white"
                      shadowBlur={4 / zoom}
                      shadowOpacity={0.8}
                    />
                  );
                })()}
              </Group>

              {/* Vertex handles OUTSIDE the draggable group - world coordinates */}
              {/* Hidden during multi-selection to prevent shape editing */}
              {isSelected && !hasMultiSelection && room.vertices.map((vertex, index) => (
                <Circle
                  key={`vertex-${room.id}-${index}`}
                  x={vertex.x}
                  y={vertex.y}
                  radius={8 / zoom}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={2 / zoom}
                  draggable
                  onDragStart={() => {
                    onDragStart?.();
                    // Initialize preview with current vertices
                    setPolygonPreview({
                      roomId: room.id,
                      vertexIndex: index,
                      originalVertices: [...room.vertices],
                      previewVertices: [...room.vertices],
                      previewArea: room.area,
                    });
                  }}
                  onDragMove={(e) => {
                    const pos = e.target.position();
                    const snappedPos = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
                    polygonDragBufferRef.current = {
                      roomId: room.id,
                      vertexIndex: index,
                      pos: snappedPos,
                    };
                    e.target.position(snappedPos);

                    // Update preview vertices
                    const newVertices = [...room.vertices];
                    newVertices[index] = snappedPos;
                    const newArea = calculatePolygonArea(newVertices);
                    setPolygonPreview({
                      roomId: room.id,
                      vertexIndex: index,
                      originalVertices: room.vertices,
                      previewVertices: newVertices,
                      previewArea: Math.round(newArea),
                    });
                  }}
                  onDragEnd={() => {
                    setPolygonPreview(null);
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

              {/* Midpoint handles OUTSIDE the draggable group - world coordinates */}
              {/* Hidden during multi-selection to prevent shape editing */}
              {isSelected && !hasMultiSelection && onAddVertex && room.vertices.map((vertex, vIndex) => {
                const nextVertex = room.vertices[(vIndex + 1) % room.vertices.length];
                const midpoint = {
                  x: (vertex.x + nextVertex.x) / 2,
                  y: (vertex.y + nextVertex.y) / 2,
                };

                return (
                  <Circle
                    key={`midpoint-${room.id}-${vIndex}`}
                    x={midpoint.x}
                    y={midpoint.y}
                    radius={6 / zoom}
                    fill="#ffffff"
                    stroke="#961818"
                    strokeWidth={2 / zoom}
                    draggable
                    onDragStart={() => {
                      onDragStart?.();
                      // Create preview with new vertex inserted at the midpoint position
                      const newVertices = [
                        ...room.vertices.slice(0, vIndex + 1),
                        { ...midpoint }, // New vertex starts at midpoint
                        ...room.vertices.slice(vIndex + 1),
                      ];
                      const newArea = calculatePolygonArea(newVertices);
                      setPolygonPreview({
                        roomId: room.id,
                        vertexIndex: vIndex + 1, // The new vertex index
                        originalVertices: [...room.vertices],
                        previewVertices: newVertices,
                        previewArea: Math.round(newArea),
                        isMidpointDrag: true,
                        insertAfterIndex: vIndex,
                      });
                    }}
                    onDragMove={(e) => {
                      const pos = e.target.position();
                      const snapped = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
                      const constrained = constrainToCanvas(snapped);
                      e.target.position(constrained);

                      // Update preview with the new vertex position
                      const newVertices = [
                        ...room.vertices.slice(0, vIndex + 1),
                        constrained, // New vertex at dragged position
                        ...room.vertices.slice(vIndex + 1),
                      ];
                      const newArea = calculatePolygonArea(newVertices);
                      setPolygonPreview({
                        roomId: room.id,
                        vertexIndex: vIndex + 1,
                        originalVertices: room.vertices,
                        previewVertices: newVertices,
                        previewArea: Math.round(newArea),
                        isMidpointDrag: true,
                        insertAfterIndex: vIndex,
                      });
                    }}
                    onDragEnd={(e) => {
                      setPolygonPreview(null);
                      const newPos = { x: snapToGrid(e.target.x()), y: snapToGrid(e.target.y()) };

                      // Only insert if actually moved from midpoint
                      const dist = Math.sqrt(
                        Math.pow(newPos.x - midpoint.x, 2) +
                        Math.pow(newPos.y - midpoint.y, 2)
                      );

                      if (dist > gridSize / 2) {
                        onAddVertex(room.id, vIndex, newPos);
                      }

                      // Reset the circle position (it will re-render at the new midpoint)
                      e.target.x(midpoint.x);
                      e.target.y(midpoint.y);
                    }}
                  />
                );
              })}
            </React.Fragment>
          );
        }
      })}

      {/* Wall Length Measurements */}
      {rooms.map((room) => {
        const segments = calculateWallSegments(room);
        const centroidY = room.vertices.reduce((sum, v) => sum + v.y, 0) / room.vertices.length;
        const centroidX = room.vertices.reduce((sum, v) => sum + v.x, 0) / room.vertices.length;

        return segments.map((segment, idx) => {
          // Calculate wall midpoint
          const midX = (segment.start.x + segment.end.x) / 2;
          const midY = (segment.start.y + segment.end.y) / 2;

          // Determine if wall is horizontal or vertical
          const isHorizontal = Math.abs(segment.start.y - segment.end.y) < 2;
          const isVertical = Math.abs(segment.start.x - segment.end.x) < 2;

          // Determine which side is "outside"
          const isTopWall = midY < centroidY;
          const isLeftWall = midX < centroidX;

          // Wall label base position
          const wallOffsetDist = 15 / zoom;
          let wallLabelX = midX;
          let wallLabelY = midY;

          if (isHorizontal) {
            wallLabelY = midY + (isTopWall ? -wallOffsetDist : wallOffsetDist);
          } else if (isVertical) {
            wallLabelX = midX + (isLeftWall ? -wallOffsetDist : wallOffsetDist);
          }

          // Collision detection function
          const checkLabelCollision = (openingPos: Point, openingOffset: number) => {
            const collisionThreshold = 70 / zoom;
            const perpendicularThreshold = 20 / zoom;

            const wallLabelX_final = wallLabelX - 30 / zoom;
            const wallLabelY_final = wallLabelY - 6 / zoom;

            let openingLabelX_final, openingLabelY_final;

            if (isHorizontal) {
              openingLabelX_final = openingPos.x - 25 / zoom;
              const offsetY = isTopWall ? -openingOffset : openingOffset;
              openingLabelY_final = openingPos.y + offsetY - 6 / zoom;
            } else {
              const offsetX = isLeftWall ? -openingOffset : openingOffset;
              openingLabelX_final = openingPos.x + offsetX - 25 / zoom;
              openingLabelY_final = openingPos.y - 6 / zoom;
            }

            if (isHorizontal) {
              const sameYLevel = Math.abs(openingLabelY_final - wallLabelY_final) < perpendicularThreshold;
              const closeInX = Math.abs(openingLabelX_final - wallLabelX_final) < collisionThreshold;
              return sameYLevel && closeInX;
            } else if (isVertical) {
              const sameXLevel = Math.abs(openingLabelX_final - wallLabelX_final) < perpendicularThreshold;
              const closeInY = Math.abs(openingLabelY_final - wallLabelY_final) < collisionThreshold;
              return sameXLevel && closeInY;
            }
            return false;
          };

          return (
            <Group key={`wall-measurement-${room.id}-${idx}`}>
              {/* Wall length label */}
              {segment.effectiveLengthFeet > 0 && (
                <Text
                  x={wallLabelX}
                  y={wallLabelY}
                  text={formatFeetInches(segment.effectiveLengthFeet)}
                  fontSize={10 / zoom}
                  fill="#444"
                  fontFamily="Arial, sans-serif"
                  align="center"
                  verticalAlign="middle"
                  offsetX={30 / zoom}
                  offsetY={6 / zoom}
                  listening={false}
                  rotation={isVertical ? 90 : 0}
                />
              )}

              {/* Opening width labels */}
              {segment.openings.map((opening, oIdx) => {
                const baseOffsetDist = 18 / zoom;
                const hasCollision = segment.effectiveLengthFeet > 0 &&
                                   checkLabelCollision(opening.position, baseOffsetDist);
                const finalOffset = hasCollision ? baseOffsetDist * 2.5 : baseOffsetDist;

                let labelX = opening.position.x;
                let labelY = opening.position.y;

                if (isHorizontal) {
                  labelY = opening.position.y + (isTopWall ? -finalOffset : finalOffset);
                } else if (isVertical) {
                  labelX = opening.position.x + (isLeftWall ? -finalOffset : finalOffset);
                }

                return (
                  <Text
                    key={`opening-${room.id}-${idx}-${oIdx}`}
                    x={labelX}
                    y={labelY}
                    text={formatFeetInches(opening.widthFeet)}
                    fontSize={9 / zoom}
                    fill="#961818"
                    fontFamily="Arial, sans-serif"
                    fontStyle="bold"
                    align="center"
                    verticalAlign="middle"
                    offsetX={25 / zoom}
                    offsetY={6 / zoom}
                    listening={false}
                    rotation={isVertical ? 90 : 0}
                  />
                );
              })}
            </Group>
          );
        });
      })}

      {/* Transformer for selected rectangle room - all 8 anchors for independent width/height */}
      {/* Disabled during multi-selection to prevent shape editing */}
      <Transformer
        ref={transformerRef}
        boundBoxFunc={(oldBox, newBox) => {
          if (hasMultiSelection) return oldBox; // Prevent resize during multi-selection
          const minSize = gridSize;
          // Enforce minimum size
          if (newBox.width < minSize || newBox.height < minSize) {
            return oldBox;
          }
          // Snap to grid
          return {
            ...newBox,
            x: snapToGrid(newBox.x),
            y: snapToGrid(newBox.y),
            width: Math.max(minSize, snapToGrid(newBox.width)),
            height: Math.max(minSize, snapToGrid(newBox.height)),
          };
        }}
        rotateEnabled={false}
        enabledAnchors={hasMultiSelection ? [] : [
          'top-left', 'top-center', 'top-right',
          'middle-left', 'middle-right',
          'bottom-left', 'bottom-center', 'bottom-right'
        ]}
        anchorSize={10}
        anchorCornerRadius={5}
        borderStroke="#1a1a1a"
        borderStrokeWidth={2}
        anchorFill="#ffffff"
        anchorStroke="#1a1a1a"
        keepRatio={false}
      />

      {/* Live Dimension Preview during drag/resize */}
      {livePreview && (
        <Group>
          {/* Top dimension line (width) */}
          <Line
            points={[
              livePreview.x, livePreview.y - 20 / zoom,
              livePreview.x + livePreview.width, livePreview.y - 20 / zoom
            ]}
            stroke="#961818"
            strokeWidth={2 / zoom}
          />
          <Line
            points={[livePreview.x, livePreview.y - 25 / zoom, livePreview.x, livePreview.y - 15 / zoom]}
            stroke="#961818"
            strokeWidth={2 / zoom}
          />
          <Line
            points={[livePreview.x + livePreview.width, livePreview.y - 25 / zoom, livePreview.x + livePreview.width, livePreview.y - 15 / zoom]}
            stroke="#961818"
            strokeWidth={2 / zoom}
          />

          {/* Width label */}
          <Label x={livePreview.x + livePreview.width / 2} y={livePreview.y - 35 / zoom}>
            <Tag
              fill="#961818"
              cornerRadius={3}
              pointerDirection="down"
              pointerWidth={8 / zoom}
              pointerHeight={6 / zoom}
            />
            <Text
              text={formatFeetInches(livePreview.widthFeet)}
              fontSize={12 / zoom}
              fontStyle="bold"
              fill="#ffffff"
              padding={4 / zoom}
            />
          </Label>

          {/* Left dimension line (height) */}
          <Line
            points={[
              livePreview.x - 20 / zoom, livePreview.y,
              livePreview.x - 20 / zoom, livePreview.y + livePreview.height
            ]}
            stroke="#961818"
            strokeWidth={2 / zoom}
          />
          <Line
            points={[livePreview.x - 25 / zoom, livePreview.y, livePreview.x - 15 / zoom, livePreview.y]}
            stroke="#961818"
            strokeWidth={2 / zoom}
          />
          <Line
            points={[livePreview.x - 25 / zoom, livePreview.y + livePreview.height, livePreview.x - 15 / zoom, livePreview.y + livePreview.height]}
            stroke="#961818"
            strokeWidth={2 / zoom}
          />

          {/* Height label */}
          <Label x={livePreview.x - 40 / zoom} y={livePreview.y + livePreview.height / 2}>
            <Tag
              fill="#961818"
              cornerRadius={3}
              pointerDirection="right"
              pointerWidth={8 / zoom}
              pointerHeight={6 / zoom}
            />
            <Text
              text={formatFeetInches(livePreview.heightFeet)}
              fontSize={12 / zoom}
              fontStyle="bold"
              fill="#ffffff"
              padding={4 / zoom}
            />
          </Label>

          {/* Center area label */}
          <Label x={livePreview.x + livePreview.width / 2} y={livePreview.y + livePreview.height / 2}>
            <Tag
              fill="rgba(0,0,0,0.8)"
              cornerRadius={4}
            />
            <Text
              text={`${Math.round(livePreview.areaFeet)} sq ft`}
              fontSize={14 / zoom}
              fontStyle="bold"
              fill="#ffffff"
              padding={6 / zoom}
              align="center"
            />
          </Label>
        </Group>
      )}

      {/* Polygon Vertex Drag Preview */}
      {polygonPreview && (
        <Group>
          {/* Preview polygon outline (dashed) */}
          <Line
            points={polygonPreview.previewVertices.flatMap(v => [v.x, v.y])}
            closed
            stroke="#3b82f6"
            strokeWidth={3 / zoom}
            dash={[10 / zoom, 5 / zoom]}
            fill="rgba(59, 130, 246, 0.15)"
            listening={false}
          />

          {/* Preview vertex positions */}
          {polygonPreview.previewVertices.map((vertex, idx) => (
            <Circle
              key={`preview-vertex-${idx}`}
              x={vertex.x}
              y={vertex.y}
              radius={idx === polygonPreview.vertexIndex ? 10 / zoom : 5 / zoom}
              fill={idx === polygonPreview.vertexIndex ? "#3b82f6" : "rgba(59, 130, 246, 0.5)"}
              stroke="#ffffff"
              strokeWidth={2 / zoom}
              listening={false}
            />
          ))}

          {/* Edge length labels for affected edges */}
          {polygonPreview.previewVertices.map((vertex, idx) => {
            const nextIdx = (idx + 1) % polygonPreview.previewVertices.length;

            // Only show labels for edges connected to the dragged vertex
            if (idx !== polygonPreview.vertexIndex && nextIdx !== polygonPreview.vertexIndex) {
              return null;
            }

            const nextVertex = polygonPreview.previewVertices[nextIdx];
            const midX = (vertex.x + nextVertex.x) / 2;
            const midY = (vertex.y + nextVertex.y) / 2;
            const lengthPx = Math.sqrt(
              Math.pow(nextVertex.x - vertex.x, 2) + Math.pow(nextVertex.y - vertex.y, 2)
            );
            const lengthFeet = lengthPx / pixelsPerFoot;

            // Determine offset direction (perpendicular to edge)
            const dx = nextVertex.x - vertex.x;
            const dy = nextVertex.y - vertex.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const offsetDist = 25 / zoom;
            const offsetX = len > 0 ? (-dy / len) * offsetDist : 0;
            const offsetY = len > 0 ? (dx / len) * offsetDist : 0;

            return (
              <Label
                key={`edge-label-${idx}`}
                x={midX + offsetX}
                y={midY + offsetY}
              >
                <Tag
                  fill="#3b82f6"
                  cornerRadius={3}
                />
                <Text
                  text={formatFeetInches(lengthFeet)}
                  fontSize={11 / zoom}
                  fontStyle="bold"
                  fill="#ffffff"
                  padding={4 / zoom}
                />
              </Label>
            );
          })}

          {/* Center area label */}
          {(() => {
            const centerX = polygonPreview.previewVertices.reduce((sum, v) => sum + v.x, 0) / polygonPreview.previewVertices.length;
            const centerY = polygonPreview.previewVertices.reduce((sum, v) => sum + v.y, 0) / polygonPreview.previewVertices.length;
            return (
              <Label x={centerX} y={centerY}>
                <Tag
                  fill="rgba(0,0,0,0.85)"
                  cornerRadius={4}
                />
                <Text
                  text={`${polygonPreview.previewArea} sq ft`}
                  fontSize={14 / zoom}
                  fontStyle="bold"
                  fill="#ffffff"
                  padding={6 / zoom}
                  align="center"
                />
              </Label>
            );
          })()}
        </Group>
      )}
    </Group>
  );
}
