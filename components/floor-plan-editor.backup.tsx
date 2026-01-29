"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Stage, Layer, Rect, Line, Text, Group, Circle, Transformer, Arc, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, ZoomIn, ZoomOut, Grid3x3, Maximize2, RotateCw, Square, Pentagon, Check, X, DoorOpen, RectangleHorizontal, MousePointer2, Undo2, Redo2, Armchair, Bed, Bath, ChefHat, Sofa, AlertTriangle, Cloud, CloudOff, Loader2, CloudCog } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GRID_CONFIG, CANVAS_CONFIG, ROOM_CONFIGS, ADU_LIMITS, DOOR_CONFIGS, WINDOW_CONFIGS, ROOM_SIZE_HINTS, getSizeComparison } from "@/lib/constants";
import type { FloorPlan, Room, RoomType, Point, Door, DoorType, Window, WindowType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWizard } from "@/lib/context/wizard-context";
import { useActionLogger } from "@/lib/hooks/use-action-logger";
import * as api from "@/lib/api/client";
import { RotateCcw, History } from "lucide-react";

// Furniture types
export type FurnitureType =
  | "bed-double" | "bed-single"
  | "sofa-3seat" | "sofa-2seat" | "armchair"
  | "table-dining" | "table-coffee"
  | "toilet" | "sink" | "shower" | "bathtub"
  | "stove" | "refrigerator" | "dishwasher"
  | "desk" | "chair";

export interface Furniture {
  id: string;
  type: FurnitureType;
  position: Point;
  rotation: number; // 0, 90, 180, 270
  width: number;  // in feet
  height: number; // in feet (depth)
}

interface FloorPlanEditorProps {
  onPlanChange: (plan: FloorPlan) => void;
}

export function FloorPlanEditor({ onPlanChange }: FloorPlanEditorProps) {
  // Wizard context for cloud save
  const { saveToCloud, isSaving, saveError, lastSavedAt, projectId, blueprintId } = useWizard();

  // Action logger for tracking all editor changes
  const {
    logMove,
    logResize,
    logRotate,
    logCreate,
    logDelete,
    logVertexMove,
  } = useActionLogger({
    projectId,
    blueprintId,
    enabled: !!projectId, // Only log when we have a project
  });

  const [rooms, setRooms] = useState<Room[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>("bedroom");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState<"rectangle" | "polygon">("rectangle");
  const [placementMode, setPlacementMode] = useState<"select" | "room" | "door" | "window" | "furniture">("select");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [editBoundaryMode, setEditBoundaryMode] = useState(false);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);
  const [isCanvasLocked, setIsCanvasLocked] = useState(false);
  const [selectedBoundaryPointIndex, setSelectedBoundaryPointIndex] = useState<number | null>(null);
  const [roomDescriptions, setRoomDescriptions] = useState<Map<string, string>>(new Map());

  // Furniture snap mode: "grid" = full grid, "half" = half-grid (center of cells), "free" = no snapping
  const [furnitureSnapMode, setFurnitureSnapMode] = useState<"grid" | "half" | "free">("half");

  // Drag-and-drop state for placing items from sidebar
  const [draggedItem, setDraggedItem] = useState<{
    type: "furniture" | "door" | "window";
    subType: FurnitureType | DoorType | WindowType;
  } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "room" | "door" | "window" | "furniture" | null;
    id: string | null;
    name: string;
  }>({ open: false, type: null, id: null, name: "" });

  // Restore from cloud state
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState(false);

  // Undo/Redo history
  interface HistoryState {
    rooms: Room[];
    doors: Door[];
    windows: Window[];
    furniture: Furniture[];
    aduBoundary: Point[];
  }
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoingOrRedoing = useRef(false);
  const hasInitializedHistory = useRef(false);
  const MAX_HISTORY = 50; // Limit history to 50 states

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const windowTransformerRef = useRef<Konva.Transformer | null>(null);
  const openingTransformerRef = useRef<Konva.Transformer | null>(null);
  const roomRefs = useRef<Map<string, Konva.Rect>>(new Map());
  const windowRefs = useRef<Map<string, Konva.Rect>>(new Map());
  const openingRefs = useRef<Map<string, Konva.Rect>>(new Map());

  // Refs for buffering drag positions (prevents spazzing during drag)
  const polygonDragBufferRef = useRef<{ roomId: string; vertexIndex: number; pos: Point } | null>(null);

  // Attach window transformer to selected window
  useEffect(() => {
    if (windowTransformerRef.current && selectedWindowId) {
      const node = windowRefs.current.get(selectedWindowId);
      if (node) {
        windowTransformerRef.current.nodes([node]);
        windowTransformerRef.current.getLayer()?.batchDraw();
      }
    } else if (windowTransformerRef.current) {
      windowTransformerRef.current.nodes([]);
    }
  }, [selectedWindowId]);

  // Attach opening transformer to selected opening
  useEffect(() => {
    const selectedDoor = doors.find(d => d.id === selectedDoorId);
    if (openingTransformerRef.current && selectedDoorId && selectedDoor?.type === 'opening') {
      const node = openingRefs.current.get(selectedDoorId);
      if (node) {
        openingTransformerRef.current.nodes([node]);
        openingTransformerRef.current.getLayer()?.batchDraw();
      }
    } else if (openingTransformerRef.current) {
      openingTransformerRef.current.nodes([]);
    }
  }, [selectedDoorId, doors]);

  // Canvas is 36×36 ft visible area at 1x zoom
  const maxCanvasFeet = 36;

  // Display size in pixels (visible viewport)
  const displaySize = 800;

  // Extended grid size (for zooming out - grid extends 3x beyond viewport)
  const extendedGridFeet = maxCanvasFeet * 3;

  // Pixels per foot (based on max canvas)
  const pixelsPerFoot = displaySize / maxCanvasFeet;

  // Grid size in pixels (1 foot per grid cell)
  const gridSize = pixelsPerFoot;

  // ADU boundary as editable polygon (default: centered 600 sq ft square)
  // Center it in the extended grid area so zooming out keeps it centered
  const defaultBoundarySize = Math.sqrt(600) * pixelsPerFoot; // ~24.5 ft
  const extendedCanvasSize = extendedGridFeet * gridSize;
  const defaultOffset = (extendedCanvasSize - defaultBoundarySize) / 2;

  const [aduBoundary, setAduBoundary] = useState<Point[]>([
    { x: defaultOffset, y: defaultOffset },
    { x: defaultOffset + defaultBoundarySize, y: defaultOffset },
    { x: defaultOffset + defaultBoundarySize, y: defaultOffset + defaultBoundarySize },
    { x: defaultOffset, y: defaultOffset + defaultBoundarySize },
  ]);

  // Set initial pan offset to center view on ADU boundary
  const hasSetInitialPan = useRef(false);
  useEffect(() => {
    if (!hasSetInitialPan.current) {
      // Center the view on the middle of the extended canvas
      const centerOffset = (extendedCanvasSize - displaySize) / 2;
      setPanOffset({ x: -centerOffset, y: -centerOffset });
      hasSetInitialPan.current = true;
    }
  }, [extendedCanvasSize]);

  // Auto-save functionality
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const lastSaveHashRef = useRef<string>("");

  // Generate a hash of current state to detect actual changes
  const getStateHash = useCallback(() => {
    return JSON.stringify({
      rooms: rooms.map(r => ({ id: r.id, vertices: r.vertices, name: r.name, type: r.type })),
      doors: doors.map(d => ({ id: d.id, position: d.position, width: d.width, rotation: d.rotation, type: d.type })),
      windows: windows.map(w => ({ id: w.id, position: w.position, width: w.width, rotation: w.rotation })),
      furniture: furniture.map(f => ({ id: f.id, position: f.position, width: f.width, height: f.height, rotation: f.rotation })),
      boundary: aduBoundary,
    });
  }, [rooms, doors, windows, furniture, aduBoundary]);

  // Debounced auto-save effect
  useEffect(() => {
    // Skip initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      lastSaveHashRef.current = getStateHash();
      return;
    }

    // Skip if auto-save disabled or already saving
    if (!autoSaveEnabled || isSaving) return;

    // Skip if no actual changes (compare hash)
    const currentHash = getStateHash();
    if (currentHash === lastSaveHashRef.current) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new debounced save (2 seconds after last change)
    autoSaveTimerRef.current = setTimeout(async () => {
      console.log("[AutoSave] Saving changes...");
      const success = await saveToCloud({
        rooms,
        doors,
        windows,
        furniture,
        aduBoundary,
        pixelsPerFoot,
        canvasWidth: displaySize,
        canvasHeight: displaySize,
      });
      if (success) {
        lastSaveHashRef.current = currentHash;
        console.log("[AutoSave] Saved successfully");
      }
    }, 2000);

    // Cleanup
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [rooms, doors, windows, furniture, aduBoundary, autoSaveEnabled, isSaving, saveToCloud, pixelsPerFoot, getStateHash]);

  const snapToGrid = (value: number) => {
    return Math.round(value / gridSize) * gridSize;
  };

  // Snap function for furniture with different modes
  const snapFurniture = (value: number) => {
    if (furnitureSnapMode === "free") {
      return value; // No snapping
    } else if (furnitureSnapMode === "half") {
      // Snap to half-grid (center of cells)
      const halfGrid = gridSize / 2;
      return Math.round(value / halfGrid) * halfGrid;
    } else {
      // Full grid snap
      return Math.round(value / gridSize) * gridSize;
    }
  };

  // Handle drag over to allow dropping on canvas
  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  // Format feet to feet-inches string (8.5 -> "8'-6\"")
  const formatFeetInches = (feet: number): string => {
    const wholeFeet = Math.floor(feet);
    const inches = Math.round((feet - wholeFeet) * 12);
    if (inches === 0) {
      return `${wholeFeet}'-0"`;
    }
    return `${wholeFeet}'-${inches}"`;
  };

  // Check if a door/window is on a wall segment (gridline aligned)
  const isOpeningOnWall = (
    wallStart: Point,
    wallEnd: Point,
    opening: { position: Point; rotation: number; width: number }
  ): boolean => {
    const tolerance = 2; // pixels
    const openingPos = opening.position;

    // Check if wall is horizontal (same Y)
    if (Math.abs(wallStart.y - wallEnd.y) < tolerance) {
      // Wall is horizontal - opening must be horizontal and Y-aligned
      const isHorizontal = opening.rotation % 180 === 0;
      const yAligned = Math.abs(openingPos.y - wallStart.y) < tolerance;
      const minX = Math.min(wallStart.x, wallEnd.x);
      const maxX = Math.max(wallStart.x, wallEnd.x);
      const xInRange = openingPos.x >= minX - tolerance && openingPos.x <= maxX + tolerance;
      return isHorizontal && yAligned && xInRange;
    }

    // Check if wall is vertical (same X)
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
  };

  // Calculate wall segments with openings for a room
  const calculateWallSegments = (room: Room) => {
    const segments: Array<{
      start: Point;
      end: Point;
      lengthFeet: number;
      openings: Array<{ type: 'door' | 'window'; widthFeet: number; position: Point }>;
      effectiveLengthFeet: number;
    }> = [];

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
  };

  // Convert stage coordinates (after pan/zoom) to world coordinates (grid space)
  const stageToWorld = (point: Point): Point => ({
    x: (point.x - panOffset.x) / zoom,
    y: (point.y - panOffset.y) / zoom,
  });

  const constrainToCanvas = (point: Point): Point => {
    // Constrain to the extended canvas area, not just the viewport
    return {
      x: Math.max(0, Math.min(point.x, extendedCanvasSize)),
      y: Math.max(0, Math.min(point.y, extendedCanvasSize)),
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _isPointInsideBoundary = (point: Point): boolean => {
    return isPointInPolygon(point, aduBoundary);
  };

  // Calculate area of a polygon using the shoelace formula
  const calculatePolygonArea = (vertices: Point[]): number => {
    if (vertices.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }

    area = Math.abs(area) / 2;
    // Convert from square pixels to square feet
    return area / (pixelsPerFoot * pixelsPerFoot);
  };

  // Check if a point is inside a polygon
  const isPointInPolygon = (point: Point, vertices: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y))
          && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Check if one room is fully inside another
  const isRoomInsideRoom = (innerRoom: Room, outerRoom: Room): boolean => {
    // Calculate centroid of inner room
    const innerCentroid = {
      x: innerRoom.vertices.reduce((sum, v) => sum + v.x, 0) / innerRoom.vertices.length,
      y: innerRoom.vertices.reduce((sum, v) => sum + v.y, 0) / innerRoom.vertices.length,
    };

    // First check: centroid must be inside outer room
    if (!isPointInPolygon(innerCentroid, outerRoom.vertices)) {
      return false;
    }

    // Second check: all vertices must be inside or on the boundary (with small tolerance)
    return innerRoom.vertices.every(vertex => {
      // Create a slightly inset point (move toward centroid)
      const insetVertex = {
        x: vertex.x + (innerCentroid.x - vertex.x) * 0.01, // Move 1% toward center
        y: vertex.y + (innerCentroid.y - vertex.y) * 0.01,
      };

      // Check if the inset vertex is inside the outer room
      return isPointInPolygon(insetVertex, outerRoom.vertices);
    });
  };

  // Get wall segments for a room, excluding areas where open passages exist
  type WallSegment = { start: Point; end: Point };

  const getWallSegmentsExcludingOpenings = useCallback((roomVertices: Point[], openPassages: Door[]): WallSegment[] => {
    const segments: WallSegment[] = [];
    const tolerance = gridSize / 4; // Tolerance for detecting if opening is on wall

    for (let i = 0; i < roomVertices.length; i++) {
      const start = roomVertices[i];
      const end = roomVertices[(i + 1) % roomVertices.length];

      // Determine if this is a horizontal or vertical edge
      const isHorizontalEdge = Math.abs(start.y - end.y) < tolerance;
      const isVerticalEdge = Math.abs(start.x - end.x) < tolerance;

      // Collect all openings that intersect this edge
      const edgeOpenings: { cutStart: number; cutEnd: number }[] = [];

      for (const opening of openPassages) {
        const openingCenterX = opening.position.x;
        const openingCenterY = opening.position.y;
        const isOpeningVertical = opening.rotation % 180 === 90;
        const openingHalfWidth = (opening.width * pixelsPerFoot) / 2;

        if (isHorizontalEdge && !isOpeningVertical) {
          // Horizontal edge, horizontal opening
          // Check if opening's Y is on this edge
          const edgeY = (start.y + end.y) / 2;
          if (Math.abs(openingCenterY - edgeY) < tolerance) {
            // Check if opening's X is within this edge's X range
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
          // Vertical edge, vertical opening
          // Check if opening's X is on this edge
          const edgeX = (start.x + end.x) / 2;
          if (Math.abs(openingCenterX - edgeX) < tolerance) {
            // Check if opening's Y is within this edge's Y range
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
        // No openings on this edge, draw the full edge
        segments.push({ start, end });
      } else {
        // Sort openings and merge overlapping ones
        edgeOpenings.sort((a, b) => a.cutStart - b.cutStart);

        // Create segments that exclude the openings
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
          // Add remaining segment after last opening
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
          // Add remaining segment after last opening
          if (currentPos < edgeEnd) {
            segments.push({
              start: { x, y: currentPos },
              end: { x, y: edgeEnd },
            });
          }
        } else {
          // Diagonal edge - just draw it (openings on diagonal walls are uncommon)
          segments.push({ start, end });
        }
      }
    }

    return segments;
  }, [gridSize, pixelsPerFoot]);

  // Load furniture SVG images
  const [furnitureImages, setFurnitureImages] = useState<Record<FurnitureType, HTMLImageElement | null>>({
    "bed-double": null,
    "bed-single": null,
    "sofa-3seat": null,
    "sofa-2seat": null,
    "armchair": null,
    "table-dining": null,
    "table-coffee": null,
    "toilet": null,
    "sink": null,
    "shower": null,
    "bathtub": null,
    "stove": null,
    "refrigerator": null,
    "dishwasher": null,
    "desk": null,
    "chair": null,
  });

  useEffect(() => {
    const furnitureTypes: FurnitureType[] = [
      "bed-double", "bed-single", "sofa-3seat", "sofa-2seat", "armchair",
      "table-dining", "table-coffee", "toilet", "sink", "shower", "bathtub",
      "stove", "refrigerator", "dishwasher", "desk", "chair"
    ];

    // Load SVGs and modify them for proper scaling
    furnitureTypes.forEach(async (type) => {
      try {
        const response = await fetch(`/furniture-svg/${type}.svg`);
        const svgText = await response.text();

        // Replace existing width/height with 100% for proper scaling in Konva
        const modifiedSvg = svgText
          .replace(/width="[^"]*"/, 'width="100%"')
          .replace(/height="[^"]*"/, 'height="100%"');

        // Create a blob URL from the modified SVG
        const blob = new Blob([modifiedSvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        const img = new window.Image();
        img.onload = () => {
          setFurnitureImages(prev => ({ ...prev, [type]: img }));
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          console.error(`Failed to load furniture SVG image: ${type}`);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } catch (error) {
        console.error(`Failed to fetch furniture SVG: ${type}`, error);
      }
    });
  }, []);

  // Furniture configurations with standard architectural dimensions
  const FURNITURE_CONFIG = React.useMemo<Record<FurnitureType, {
    name: string;
    width: number;   // feet
    height: number;  // feet (depth)
    category: "bedroom" | "living" | "bathroom" | "kitchen" | "office";
    icon: React.ElementType;
  }>>(() => ({
    // Bedroom
    "bed-double": { name: "Double Bed", width: 4.5, height: 6.5, category: "bedroom", icon: Bed },
    "bed-single": { name: "Single Bed", width: 3, height: 6.5, category: "bedroom", icon: Bed },

    // Living Room
    "sofa-3seat": { name: "3-Seat Sofa", width: 7, height: 3, category: "living", icon: Sofa },
    "sofa-2seat": { name: "2-Seat Sofa", width: 5, height: 3, category: "living", icon: Sofa },
    "armchair": { name: "Armchair", width: 3, height: 3, category: "living", icon: Armchair },
    "table-dining": { name: "Dining Table", width: 5, height: 3, category: "living", icon: Square },
    "table-coffee": { name: "Coffee Table", width: 4, height: 2, category: "living", icon: Square },

    // Bathroom
    "toilet": { name: "Toilet", width: 1.5, height: 2.5, category: "bathroom", icon: Bath },
    "sink": { name: "Sink", width: 2, height: 1.5, category: "bathroom", icon: Bath },
    "shower": { name: "Shower", width: 3, height: 3, category: "bathroom", icon: Bath },
    "bathtub": { name: "Bathtub", width: 5, height: 2.5, category: "bathroom", icon: Bath },

    // Kitchen
    "stove": { name: "Stove", width: 2.5, height: 2, category: "kitchen", icon: ChefHat },
    "refrigerator": { name: "Refrigerator", width: 3, height: 2.5, category: "kitchen", icon: Square },
    "dishwasher": { name: "Dishwasher", width: 2, height: 2, category: "kitchen", icon: Square },

    // Office
    "desk": { name: "Desk", width: 5, height: 2.5, category: "office", icon: Square },
    "chair": { name: "Chair", width: 2, height: 2, category: "office", icon: Armchair },
  }), []);

  // Calculate effective area accounting for nested rooms
  const calculateEffectiveArea = (room: Room): number => {
    let effectiveArea = room.area;

    // Subtract area of any rooms that are fully inside this room
    rooms.forEach(otherRoom => {
      if (otherRoom.id !== room.id && isRoomInsideRoom(otherRoom, room)) {
        effectiveArea -= otherRoom.area;
      }
    });

    return Math.max(0, effectiveArea);
  };

  // Calculate ADU area from boundary vertices
  const aduArea = calculatePolygonArea(aduBoundary);

  // Calculate total area (using effective area to account for nested rooms)
  const totalArea = rooms.reduce((sum, room) => sum + calculateEffectiveArea(room), 0);

  // Update parent with current floor plan
  useEffect(() => {
    // Update rooms with descriptions
    const roomsWithDescriptions = rooms.map(room => ({
      ...room,
      description: room.type === "other" ? roomDescriptions.get(room.id) : undefined,
    }));

    const floorPlan: FloorPlan = {
      id: crypto.randomUUID(),
      rooms: roomsWithDescriptions,
      walls: [],
      doors,
      windows,
      totalArea,
      gridSize: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onPlanChange(floorPlan);
  }, [rooms, doors, windows, totalArea, roomDescriptions, onPlanChange]);

  // Attach transformer to selected room
  useEffect(() => {
    if (selectedRoomId && transformerRef.current) {
      const selectedNode = roomRefs.current.get(selectedRoomId);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedRoomId]);

  const handleBoundaryPointDrag = (index: number, newPos: Point) => {
    const snapped = { x: snapToGrid(newPos.x), y: snapToGrid(newPos.y) };
    const constrained = constrainToCanvas(snapped);

    const newBoundary = [...aduBoundary];
    newBoundary[index] = constrained;
    setAduBoundary(newBoundary);
  };

  const handleAddBoundaryPoint = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!editBoundaryMode) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    const world = stageToWorld(pointerPosition);
    const x = snapToGrid(world.x);
    const y = snapToGrid(world.y);
    const newPoint = constrainToCanvas({ x, y });

    // Find closest edge to insert point
    let closestEdge = 0;
    let minDist = Infinity;

    for (let i = 0; i < aduBoundary.length; i++) {
      const p1 = aduBoundary[i];
      const p2 = aduBoundary[(i + 1) % aduBoundary.length];

      // Calculate distance from point to line segment
      const dist = Math.abs((p2.y - p1.y) * newPoint.x - (p2.x - p1.x) * newPoint.y + p2.x * p1.y - p2.y * p1.x) /
                   Math.sqrt((p2.y - p1.y) ** 2 + (p2.x - p1.x) ** 2);

      if (dist < minDist) {
        minDist = dist;
        closestEdge = i;
      }
    }

    // Insert point after closest edge
    const newBoundary = [...aduBoundary];
    newBoundary.splice(closestEdge + 1, 0, newPoint);
    setAduBoundary(newBoundary);
  };

  const handleRemoveBoundaryPoint = useCallback((index: number) => {
    if (aduBoundary.length <= 3) {
      alert("ADU boundary must have at least 3 points");
      return;
    }
    const newBoundary = aduBoundary.filter((_, i) => i !== index);
    setAduBoundary(newBoundary);
    setSelectedBoundaryPointIndex(null);
  }, [aduBoundary]);

  const handleRemoveRoomVertex = (roomId: string, vertexIndex: number) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    if (room.vertices.length <= 3) {
      // Can't have less than 3 vertices for a valid polygon
      return;
    }

    const newVertices = room.vertices.filter((_, i) => i !== vertexIndex);
    const newArea = calculatePolygonArea(newVertices);

    setRooms(rooms.map(r =>
      r.id === roomId
        ? { ...r, vertices: newVertices, area: Math.round(newArea) }
        : r
    ));
  };

  const handlePlaceDoor = (position: Point, doorType: DoorType) => {
    const doorWidth = DOOR_CONFIGS[doorType].width;
    const newDoor: Door = {
      id: crypto.randomUUID(),
      type: doorType,
      position,
      rotation: 0,
      width: doorWidth,
    };
    setDoors([...doors, newDoor]);
  };

  const handlePlaceWindow = (position: Point, windowType: WindowType) => {
    const windowConfig = WINDOW_CONFIGS[windowType];
    const newWindow: Window = {
      id: crypto.randomUUID(),
      type: windowType,
      position,
      rotation: 0,
      width: windowConfig.width,
      height: windowConfig.height,
    };
    setWindows([...windows, newWindow]);
  };

  const deleteDoor = (doorId: string) => {
    setDoors(doors.filter((d) => d.id !== doorId));
    if (selectedDoorId === doorId) {
      setSelectedDoorId(null);
    }
  };

  const deleteWindow = (windowId: string) => {
    setWindows(windows.filter((w) => w.id !== windowId));
    if (selectedWindowId === windowId) {
      setSelectedWindowId(null);
    }
  };

  const rotateSelectedDoor = useCallback(() => {
    if (!selectedDoorId) return;
    setDoors(doors.map(d =>
      d.id === selectedDoorId
        ? { ...d, rotation: (d.rotation + 90) % 360 }
        : d
    ));
  }, [selectedDoorId, doors]);

  const rotateSelectedWindow = useCallback(() => {
    if (!selectedWindowId) return;
    setWindows(windows.map(w =>
      w.id === selectedWindowId
        ? { ...w, rotation: (w.rotation + 90) % 360 }
        : w
    ));
  }, [selectedWindowId, windows]);

  const deleteFurniture = (furnitureId: string) => {
    setFurniture(furniture.filter((f) => f.id !== furnitureId));
    if (selectedFurnitureId === furnitureId) {
      setSelectedFurnitureId(null);
    }
  };

  const rotateSelectedFurniture = useCallback(() => {
    if (!selectedFurnitureId) return;
    setFurniture(furniture.map(f =>
      f.id === selectedFurnitureId
        ? { ...f, rotation: (f.rotation + 90) % 360 }
        : f
    ));
  }, [selectedFurnitureId, furniture]);

  // Restore blueprint from cloud
  const restoreFromCloud = useCallback(async () => {
    if (!blueprintId) {
      console.warn("No blueprint ID available to restore");
      return;
    }

    setIsRestoring(true);
    try {
      const response = await api.getBlueprint(blueprintId);
      const { blueprint, rooms: apiRooms, doors: apiDoors, windows: apiWindows, furniture: apiFurniture } = response.data;

      // Convert API data to editor format
      const restoredRooms: Room[] = (apiRooms as Array<{
        id: string;
        name: string;
        type: string;
        color?: string;
        vertices: Array<{ x: number; y: number }>;
        areaSqFt: number;
      }>).map(r => ({
        id: r.id,
        name: r.name,
        type: r.type as RoomType,
        color: r.color ?? "#a8d5e5",
        vertices: r.vertices,
        area: r.areaSqFt,
      }));

      const restoredDoors: Door[] = (apiDoors as Array<{
        id: string;
        type: string;
        x: number;
        y: number;
        widthFeet: number;
        rotation?: number;
      }>).map(d => ({
        id: d.id,
        type: (d.type === "open_passage" ? "opening" : d.type) as DoorType,
        position: { x: d.x, y: d.y },
        width: d.widthFeet,
        rotation: d.rotation ?? 0,
      }));

      const restoredWindows: Window[] = (apiWindows as Array<{
        id: string;
        type: string;
        x: number;
        y: number;
        widthFeet: number;
        heightFeet: number;
        rotation?: number;
      }>).map(w => ({
        id: w.id,
        type: w.type as WindowType,
        position: { x: w.x, y: w.y },
        width: w.widthFeet,
        height: w.heightFeet,
        rotation: w.rotation ?? 0,
      }));

      const restoredFurniture: Furniture[] = (apiFurniture as Array<{
        id: string;
        type: string;
        x: number;
        y: number;
        widthFeet: number;
        heightFeet: number;
        rotation?: number;
      }>).map(f => ({
        id: f.id,
        type: f.type as FurnitureType,
        position: { x: f.x, y: f.y },
        width: f.widthFeet,
        height: f.heightFeet,
        rotation: f.rotation ?? 0,
      }));

      // Update all state
      setRooms(restoredRooms);
      setDoors(restoredDoors);
      setWindows(restoredWindows);
      setFurniture(restoredFurniture);
      setAduBoundary(blueprint.aduBoundary);

      // Clear selections
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedFurnitureId(null);

      console.log("Blueprint restored successfully:", {
        rooms: restoredRooms.length,
        doors: restoredDoors.length,
        windows: restoredWindows.length,
        furniture: restoredFurniture.length,
      });
    } catch (error) {
      console.error("Failed to restore blueprint:", error);
    } finally {
      setIsRestoring(false);
      setRestoreDialog(false);
    }
  }, [blueprintId]);

  const addFurniture = (type: FurnitureType, position: Point) => {
    const config = FURNITURE_CONFIG[type];
    const newFurniture: Furniture = {
      id: `furniture-${Date.now()}-${Math.random()}`,
      type,
      position,
      rotation: 0,
      width: config.width,
      height: config.height,
    };
    setFurniture([...furniture, newFurniture]);
    setSelectedFurnitureId(newFurniture.id);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Check if clicking on empty area
    const clickedOnEmpty = e.target === e.target.getStage();

    if (clickedOnEmpty) {
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedBoundaryPointIndex(null);
      setSelectedFurnitureId(null);

      if (editBoundaryMode) {
        handleAddBoundaryPoint(e);
      } else if (placementMode === "select" || placementMode === "furniture" || placementMode === "door" || placementMode === "window") {
        // In select/furniture/door/window mode, clicking canvas just deselects everything
        // Furniture, doors, and windows are placed by drag-and-drop from sidebar
        return;
      } else if (placementMode === "room" && selectedRoomType) {
        const stage = e.target.getStage();
        if (!stage) return;
        const pointerPosition = stage.getPointerPosition();
        if (!pointerPosition) return;
        const world = stageToWorld(pointerPosition);
        const x = snapToGrid(world.x);
        const y = snapToGrid(world.y);

        if (drawMode === "rectangle") {
          setIsDrawing(true);
          setStartPoint({ x, y });
          setCurrentRect({ x, y, width: 0, height: 0 });
        } else if (drawMode === "polygon") {
          // Add point to polygon
          const newPoint = { x, y };
          setPolygonPoints([...polygonPoints, newPoint]);
          if (!isDrawing) {
            setIsDrawing(true);
          }
        }
      }
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !selectedRoomType) return;
    if (drawMode === "polygon") return; // Polygon mode doesn't use mouse move

    if (!startPoint) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    const world = stageToWorld(pointerPosition);
    const rawX = world.x;
    const rawY = world.y;

    const x = snapToGrid(rawX);
    const y = snapToGrid(rawY);

    // Calculate width and height, ensure they're grid-aligned
    let width = x - startPoint.x;
    let height = y - startPoint.y;

    // Snap the dimensions to grid as well
    width = snapToGrid(Math.abs(width)) * (width >= 0 ? 1 : -1);
    height = snapToGrid(Math.abs(height)) * (height >= 0 ? 1 : -1);

    setCurrentRect({
      x: width > 0 ? startPoint.x : startPoint.x + width,
      y: height > 0 ? startPoint.y : startPoint.y + height,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    if (drawMode === "polygon") return; // Polygon mode uses complete button

    if (!isDrawing || !currentRect || !selectedRoomType) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentRect(null);
      return;
    }

    // Calculate area in square feet
    const widthFeet = currentRect.width / pixelsPerFoot;
    const heightFeet = currentRect.height / pixelsPerFoot;
    const area = widthFeet * heightFeet;

    // Only create room if it has some size (at least 1 sq ft)
    if (area >= 1) {
      const newRoom: Room = {
        id: crypto.randomUUID(),
        type: selectedRoomType,
        name: `${ROOM_CONFIGS[selectedRoomType].label} ${rooms.filter((r) => r.type === selectedRoomType).length + 1}`,
        vertices: [
          { x: currentRect.x, y: currentRect.y },
          { x: currentRect.x + currentRect.width, y: currentRect.y },
          { x: currentRect.x + currentRect.width, y: currentRect.y + currentRect.height },
          { x: currentRect.x, y: currentRect.y + currentRect.height },
        ],
        area: Math.round(area),
        color: ROOM_CONFIGS[selectedRoomType].color,
      };

      setRooms([...rooms, newRoom]);
      // Log the create action
      logCreate("room", newRoom.id, { type: newRoom.type, name: newRoom.name, vertices: newRoom.vertices, area: newRoom.area });
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentRect(null);
  };

  const completePolygon = () => {
    if (!selectedRoomType || polygonPoints.length < 3) {
      alert("Please add at least 3 points to create a room");
      return;
    }

    const area = calculatePolygonArea(polygonPoints);

    // Allow any size - just create the room
    const newRoom: Room = {
      id: crypto.randomUUID(),
      type: selectedRoomType,
      name: `${ROOM_CONFIGS[selectedRoomType].label} ${rooms.filter((r) => r.type === selectedRoomType).length + 1}`,
      vertices: [...polygonPoints],
      area: Math.round(area),
      color: ROOM_CONFIGS[selectedRoomType].color,
    };

    setRooms([...rooms, newRoom]);
    // Log the create action
    logCreate("room", newRoom.id, { type: newRoom.type, name: newRoom.name, vertices: newRoom.vertices, area: newRoom.area });

    // Reset polygon drawing
    setIsDrawing(false);
    setPolygonPoints([]);
  };

  const cancelPolygon = useCallback(() => {
    setIsDrawing(false);
    setPolygonPoints([]);
  }, []);

  const handleRoomClick = (roomId: string) => {
    // Don't allow room selection during polygon drawing
    if (isDrawing && drawMode === "polygon") {
      return;
    }
    setSelectedRoomId(roomId);
  };

  const handleRoomDragEnd = (roomId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const x = snapToGrid(node.x());
    const y = snapToGrid(node.y());
    const previousPosition = { x: room.vertices[0].x, y: room.vertices[0].y };

    if (room.vertices.length === 4) {
      // Rectangle room
      const width = room.vertices[1].x - room.vertices[0].x;
      const height = room.vertices[2].y - room.vertices[0].y;

      setRooms(rooms.map((r) => {
        if (r.id === roomId) {
          return {
            ...r,
            vertices: [
              { x, y },
              { x: x + width, y },
              { x: x + width, y: y + height },
              { x, y: y + height },
            ],
          };
        }
        return r;
      }));

      node.position({ x, y });

      // Log the move action
      logMove("room", roomId, previousPosition, { x, y });
    }
  };

  const handleRoomTransform = (roomId: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const room = rooms.find(r => r.id === roomId);
    const previousWidth = room ? room.vertices[1].x - room.vertices[0].x : 0;
    const previousHeight = room ? room.vertices[2].y - room.vertices[0].y : 0;

    // Snap dimensions to grid
    const newWidth = snapToGrid(node.width() * scaleX);
    const newHeight = snapToGrid(node.height() * scaleY);
    const x = snapToGrid(node.x());
    const y = snapToGrid(node.y());

    // Calculate area in square feet
    const widthFeet = newWidth / pixelsPerFoot;
    const heightFeet = newHeight / pixelsPerFoot;
    const area = widthFeet * heightFeet;

    setRooms(rooms.map((r) => {
      if (r.id === roomId) {
        return {
          ...r,
          vertices: [
            { x, y },
            { x: x + newWidth, y },
            { x: x + newWidth, y: y + newHeight },
            { x, y: y + newHeight },
          ],
          area: Math.round(area),
        };
      }
      return r;
    }));

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);
    node.width(newWidth);
    node.height(newHeight);
    node.position({ x, y });

    // Log the resize action
    logResize(
      "room",
      roomId,
      { width: previousWidth, height: previousHeight },
      { width: newWidth, height: newHeight },
      { x, y }
    );
  };

  const rotateSelectedRoom = () => {
    if (!selectedRoomId) return;

    setRooms(rooms.map((room) => {
      if (room.id === selectedRoomId && room.vertices.length === 4) {
        const centerX = (room.vertices[0].x + room.vertices[2].x) / 2;
        const centerY = (room.vertices[0].y + room.vertices[2].y) / 2;
        const width = room.vertices[1].x - room.vertices[0].x;
        const height = room.vertices[2].y - room.vertices[0].y;

        // Rotate 90 degrees (swap width and height)
        const newVertices = [
          { x: centerX - height / 2, y: centerY - width / 2 },
          { x: centerX + height / 2, y: centerY - width / 2 },
          { x: centerX + height / 2, y: centerY + width / 2 },
          { x: centerX - height / 2, y: centerY + width / 2 },
        ];

        return {
          ...room,
          vertices: newVertices,
        };
      }
      return room;
    }));
  };

  const deleteRoom = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    setRooms(rooms.filter((r) => r.id !== roomId));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
    // Log the delete action
    if (room) {
      logDelete("room", roomId, { type: room.type, name: room.name, vertices: room.vertices, area: room.area });
    }
  };

  // Confirmation dialog handlers
  const confirmDeleteRoom = (roomId: string, roomName: string) => {
    setDeleteDialog({ open: true, type: "room", id: roomId, name: roomName });
  };

  const confirmDeleteDoor = (doorId: string, doorName: string) => {
    setDeleteDialog({ open: true, type: "door", id: doorId, name: doorName });
  };

  const confirmDeleteWindow = (windowId: string, windowName: string) => {
    setDeleteDialog({ open: true, type: "window", id: windowId, name: windowName });
  };

  const confirmDeleteFurniture = (furnitureId: string, furnitureName: string) => {
    setDeleteDialog({ open: true, type: "furniture", id: furnitureId, name: furnitureName });
  };

  const handleConfirmDelete = () => {
    if (!deleteDialog.id || !deleteDialog.type) return;

    switch (deleteDialog.type) {
      case "room":
        deleteRoom(deleteDialog.id);
        break;
      case "door":
        deleteDoor(deleteDialog.id);
        break;
      case "window":
        deleteWindow(deleteDialog.id);
        break;
      case "furniture":
        deleteFurniture(deleteDialog.id);
        break;
    }
    setDeleteDialog({ open: false, type: null, id: null, name: "" });
  };

  const handleZoomIn = () => {
    setZoom(Math.min(zoom * 1.2, CANVAS_CONFIG.MAX_SCALE));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom / 1.2, CANVAS_CONFIG.MIN_SCALE));
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (isCanvasLocked) return; // Don't zoom if canvas is locked

    // Only zoom with Alt+scroll, otherwise allow normal scroll
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
  };

  const handlePanStart = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isCanvasLocked) return; // Don't pan if canvas is locked

    // Middle mouse button (button 1)
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      setIsPanning(true);
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos) setPanStart(pos);
    }
  };

  const resetView = () => {
    setZoom(1);
    // Center view on the ADU boundary
    const centerOffset = (extendedCanvasSize - displaySize) / 2;
    setPanOffset({ x: -centerOffset, y: -centerOffset });
  };

  // Save current state to history
  const saveToHistory = useCallback(() => {
    if (isUndoingOrRedoing.current) return;

    const newState: HistoryState = {
      rooms: JSON.parse(JSON.stringify(rooms)),
      doors: JSON.parse(JSON.stringify(doors)),
      windows: JSON.parse(JSON.stringify(windows)),
      furniture: JSON.parse(JSON.stringify(furniture)),
      aduBoundary: JSON.parse(JSON.stringify(aduBoundary)),
    };

    // Remove any history after current index (when user makes a new change after undo)
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);

    // Limit history to MAX_HISTORY states
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    } else {
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [rooms, doors, windows, furniture, aduBoundary, history, historyIndex]);

  // Undo function
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoingOrRedoing.current = true;
      const previousState = history[historyIndex - 1];
      setRooms(JSON.parse(JSON.stringify(previousState.rooms)));
      setDoors(JSON.parse(JSON.stringify(previousState.doors)));
      setWindows(JSON.parse(JSON.stringify(previousState.windows)));
      setFurniture(JSON.parse(JSON.stringify(previousState.furniture)));
      setAduBoundary(JSON.parse(JSON.stringify(previousState.aduBoundary)));
      setHistoryIndex(historyIndex - 1);
      // Clear selections
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedFurnitureId(null);
      setTimeout(() => {
        isUndoingOrRedoing.current = false;
      }, 100);
    }
  }, [historyIndex, history]);

  // Redo function
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoingOrRedoing.current = true;
      const nextState = history[historyIndex + 1];
      setRooms(JSON.parse(JSON.stringify(nextState.rooms)));
      setDoors(JSON.parse(JSON.stringify(nextState.doors)));
      setWindows(JSON.parse(JSON.stringify(nextState.windows)));
      setFurniture(JSON.parse(JSON.stringify(nextState.furniture)));
      setAduBoundary(JSON.parse(JSON.stringify(nextState.aduBoundary)));
      setHistoryIndex(historyIndex + 1);
      // Clear selections
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedFurnitureId(null);
      setTimeout(() => {
        isUndoingOrRedoing.current = false;
      }, 100);
    }
  }, [historyIndex, history]);

  // Save to cloud (backend)
  const handleSaveToCloud = async () => {
    const editorData = {
      rooms,
      doors,
      windows,
      furniture,
      aduBoundary,
      pixelsPerFoot,
      canvasWidth: displaySize,
      canvasHeight: displaySize,
    };
    const success = await saveToCloud(editorData);
    if (success) {
      console.log("Blueprint saved to cloud successfully!");
    }
  };

  // Initialize history with first state on mount
  useEffect(() => {
    if (!hasInitializedHistory.current && history.length === 0) {
      hasInitializedHistory.current = true;
      const initialState: HistoryState = {
        rooms: JSON.parse(JSON.stringify(rooms)),
        doors: JSON.parse(JSON.stringify(doors)),
        windows: JSON.parse(JSON.stringify(windows)),
        furniture: JSON.parse(JSON.stringify(furniture)),
        aduBoundary: JSON.parse(JSON.stringify(aduBoundary)),
      };
      setHistory([initialState]);
      setHistoryIndex(0);
    }
  }, [rooms, doors, windows, furniture, aduBoundary, history.length]);

  // Save to history when rooms, doors, windows, furniture, or boundary change
  useEffect(() => {
    // Skip if not initialized yet or if undoing/redoing
    if (!hasInitializedHistory.current || isUndoingOrRedoing.current) return;

    const timeoutId = setTimeout(() => {
      saveToHistory();
    }, 300); // Debounce to avoid saving too frequently
    return () => clearTimeout(timeoutId);
  }, [rooms, doors, windows, furniture, aduBoundary, saveToHistory]);

  // Comprehensive keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Save: Ctrl+S
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        if (!isSaving) {
          saveToCloud({
            rooms: rooms.map(r => ({ id: r.id, name: r.name, type: r.type, color: r.color, vertices: r.vertices, area: r.area, rotation: 0 })),
            doors: doors,
            windows: windows,
            furniture: furniture,
            aduBoundary,
            pixelsPerFoot,
            canvasWidth: displaySize,
            canvasHeight: displaySize,
          });
        }
        return;
      }

      // Delete: Delete or Backspace - delete selected item or point
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        // Delete selected boundary point (in edit boundary mode)
        if (editBoundaryMode && selectedBoundaryPointIndex !== null) {
          handleRemoveBoundaryPoint(selectedBoundaryPointIndex);
          return;
        }
        // Delete selected room/door/window/furniture
        if (selectedRoomId) {
          const room = rooms.find(r => r.id === selectedRoomId);
          if (room) {
            setDeleteDialog({ open: true, type: "room", id: selectedRoomId, name: room.name });
          }
        } else if (selectedDoorId) {
          const door = doors.find(d => d.id === selectedDoorId);
          if (door) {
            setDeleteDialog({ open: true, type: "door", id: selectedDoorId, name: DOOR_CONFIGS[door.type].label });
          }
        } else if (selectedWindowId) {
          const win = windows.find(w => w.id === selectedWindowId);
          if (win) {
            setDeleteDialog({ open: true, type: "window", id: selectedWindowId, name: WINDOW_CONFIGS[win.type].label });
          }
        } else if (selectedFurnitureId) {
          const furn = furniture.find(f => f.id === selectedFurnitureId);
          if (furn) {
            setDeleteDialog({ open: true, type: "furniture", id: selectedFurnitureId, name: FURNITURE_CONFIG[furn.type].name });
          }
        }
        return;
      }

      // Escape: Deselect all / Cancel drawing
      if (key === 'escape') {
        e.preventDefault();
        setSelectedRoomId(null);
        setSelectedDoorId(null);
        setSelectedWindowId(null);
        setSelectedFurnitureId(null);
        setSelectedBoundaryPointIndex(null);
        if (isDrawing) {
          cancelPolygon();
        }
        return;
      }

      // R: Rotate selected item 90 degrees
      if (key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (selectedDoorId) {
          rotateSelectedDoor();
        } else if (selectedWindowId) {
          rotateSelectedWindow();
        } else if (selectedFurnitureId) {
          rotateSelectedFurniture();
        }
        return;
      }

      // G: Toggle grid
      if (key === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowGrid(!showGrid);
        return;
      }

      // Arrow keys: Nudge selected item
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        const nudgeAmount = e.shiftKey ? gridSize : gridSize / 2; // Shift for larger nudge
        const delta = {
          x: key === 'arrowleft' ? -nudgeAmount : key === 'arrowright' ? nudgeAmount : 0,
          y: key === 'arrowup' ? -nudgeAmount : key === 'arrowdown' ? nudgeAmount : 0,
        };

        if (selectedRoomId) {
          setRooms(rooms.map(r =>
            r.id === selectedRoomId
              ? { ...r, vertices: r.vertices.map(v => ({ x: v.x + delta.x, y: v.y + delta.y })) }
              : r
          ));
        } else if (selectedDoorId) {
          setDoors(doors.map(d =>
            d.id === selectedDoorId
              ? { ...d, position: { x: d.position.x + delta.x, y: d.position.y + delta.y } }
              : d
          ));
        } else if (selectedWindowId) {
          setWindows(windows.map(w =>
            w.id === selectedWindowId
              ? { ...w, position: { x: w.position.x + delta.x, y: w.position.y + delta.y } }
              : w
          ));
        } else if (selectedFurnitureId) {
          setFurniture(furniture.map(f =>
            f.id === selectedFurnitureId
              ? { ...f, position: { x: f.position.x + delta.x, y: f.position.y + delta.y } }
              : f
          ));
        }
        return;
      }

      // Mode shortcuts (only when no modifier keys)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        // V: Select mode (like Photoshop/Figma)
        if (key === 'v') {
          e.preventDefault();
          setPlacementMode("select");
          setIsDrawing(false);
          setCurrentRect(null);
          cancelPolygon();
          return;
        }

        // B: Build/Room mode
        if (key === 'b') {
          e.preventDefault();
          setPlacementMode("room");
          return;
        }

        // D: Door mode
        if (key === 'd') {
          e.preventDefault();
          setPlacementMode("door");
          return;
        }

        // W: Window mode
        if (key === 'w') {
          e.preventDefault();
          setPlacementMode("window");
          return;
        }

        // F: Furniture mode
        if (key === 'f') {
          e.preventDefault();
          setPlacementMode("furniture");
          return;
        }

        // +/= : Zoom in
        if (key === '+' || key === '=') {
          e.preventDefault();
          setZoom(Math.min(2, zoom + 0.1));
          return;
        }

        // -: Zoom out
        if (key === '-') {
          e.preventDefault();
          setZoom(Math.max(0.5, zoom - 0.1));
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo, redo, isSaving, saveToCloud, rooms, doors, windows, furniture, aduBoundary,
    pixelsPerFoot, displaySize, selectedRoomId, selectedDoorId, selectedWindowId,
    selectedFurnitureId, isDrawing, cancelPolygon, rotateSelectedDoor, rotateSelectedWindow,
    rotateSelectedFurniture, handleRemoveBoundaryPoint, FURNITURE_CONFIG,
    showGrid, gridSize, zoom, editBoundaryMode, selectedBoundaryPointIndex
  ]);

  // Validation helpers
  const hasBathroom = rooms.some((room) => room.type === "bathroom");
  const hasKitchen = rooms.some((room) => room.type === "kitchen");
  const validationIssues: string[] = [];

  if (rooms.length > 0) {
    if (!hasBathroom) validationIssues.push("Every ADU needs at least one bathroom");
    if (!hasKitchen) validationIssues.push("Every ADU needs a kitchen area");
  }

  // Check for undersized rooms
  const undersizedRooms = rooms.filter((room) => {
    const hint = ROOM_SIZE_HINTS[room.type];
    return room.area < hint.min;
  });

  const handlePanMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isPanning || !panStart) return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    const dx = pos.x - panStart.x;
    const dy = pos.y - panStart.y;

    setPanOffset({
      x: panOffset.x + dx,
      y: panOffset.y + dy,
    });

    setPanStart(pos);
  };

  const handlePanEnd = () => {
    setIsPanning(false);
    setPanStart(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left Column - Controls */}
          <div className="space-y-4 h-fit">
            {/* Placement Mode Selector */}
            <Card className="p-3 space-y-3 border-accent-top shadow-md transition-shadow hover:shadow-lg">
              <Label className="text-sm font-semibold text-foreground">What do you want to do?</Label>
              <div className="flex flex-col gap-2">
                <Button
                  variant={placementMode === "select" ? "default" : "outline"}
                  onClick={() => {
                    setPlacementMode("select");
                    setIsDrawing(false);
                    setCurrentRect(null);
                    cancelPolygon();
                  }}
                  className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
                >
                  <MousePointer2 className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  <span className="truncate">Select / Move</span>
                  <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">V</span>
                </Button>
                <Button
                  variant={placementMode === "room" ? "default" : "outline"}
                  onClick={() => {
                    setPlacementMode("room");
                    setSelectedDoorId(null);
                    setSelectedWindowId(null);
                  }}
                  className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
                >
                  <Square className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  <span className="truncate">Add Rooms</span>
                  <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">B</span>
                </Button>
                <Button
                  variant={placementMode === "door" ? "default" : "outline"}
                  onClick={() => {
                    setPlacementMode("door");
                    setSelectedRoomId(null);
                    setIsDrawing(false);
                    setCurrentRect(null);
                    cancelPolygon();
                  }}
                  className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
                >
                  <DoorOpen className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  <span className="truncate">Add Doors</span>
                  <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">D</span>
                </Button>
                <Button
                  variant={placementMode === "window" ? "default" : "outline"}
                  onClick={() => {
                    setPlacementMode("window");
                    setSelectedRoomId(null);
                    setIsDrawing(false);
                    setCurrentRect(null);
                    cancelPolygon();
                  }}
                  className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
                >
                  <RectangleHorizontal className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  <span className="truncate">Add Windows</span>
                  <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">W</span>
                </Button>
                <Button
                  variant={placementMode === "furniture" ? "default" : "outline"}
                  onClick={() => {
                    setPlacementMode("furniture");
                    setSelectedRoomId(null);
                    setSelectedDoorId(null);
                    setSelectedWindowId(null);
                    setIsDrawing(false);
                    setCurrentRect(null);
                    cancelPolygon();
                  }}
                  className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
                >
                  <Armchair className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  <span className="truncate">Add Furniture</span>
                  <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">F</span>
                </Button>
              </div>
            </Card>

        {placementMode === "room" && (
          <>
            <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg">
              {/* Draw Mode Selector */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">Room Shape:</Label>
                <div className="flex flex-col gap-2">
                  <Button
                    variant={drawMode === "rectangle" ? "default" : "outline"}
                    onClick={() => {
                      setDrawMode("rectangle");
                      cancelPolygon();
                    }}
                    className={cn(
                      "text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2",
                      drawMode !== "rectangle" && "hover:text-foreground"
                    )}
                  >
                    <Square className="h-4 w-4 mr-1.5 flex-shrink-0" />
                    <span className="truncate">Simple Rectangle</span>
                    <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex-shrink-0">Easy</span>
                  </Button>
                  <Button
                    variant={drawMode === "polygon" ? "default" : "outline"}
                    onClick={() => {
                      setDrawMode("polygon");
                      setIsDrawing(false);
                      setCurrentRect(null);
                    }}
                    className={cn(
                      "text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2",
                      drawMode !== "polygon" && "hover:text-foreground"
                    )}
                  >
                    <Pentagon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                    <span className="truncate">Custom Shape</span>
                    <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex-shrink-0">Advanced</span>
                  </Button>
                </div>
                {drawMode === "polygon" && isDrawing && (
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <Button
                      variant="default"
                      onClick={completePolygon}
                      disabled={polygonPoints.length < 3}
                      className="text-xs w-full h-auto py-2"
                    >
                      <Check className="h-4 w-4 mr-1.5" />
                      Complete ({polygonPoints.length} points)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelPolygon}
                      className="text-xs w-full h-auto py-2 hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                )}
                <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800 leading-relaxed">
                    {drawMode === "rectangle"
                      ? "📐 Click and drag to draw a room."
                      : "📐 Click to add corners. Complete when done (min 3)."}
                  </p>
                </div>
              </div>
            </Card>

            {/* Room Type Selector */}
            <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg">
              <Label className="text-sm font-semibold text-foreground">Choose Room Type:</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ROOM_CONFIGS) as RoomType[]).map((type) => (
                  <Button
                    key={type}
                    variant={selectedRoomType === type ? "default" : "outline"}
                    onClick={() => setSelectedRoomType(type)}
                    className={cn(
                      "text-xs justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 min-w-0",
                      selectedRoomType !== type && "hover:text-foreground"
                    )}
                    title={`${ROOM_CONFIGS[type].label} - ${ROOM_SIZE_HINTS[type].description}`}
                  >
                    <span className="mr-1.5 text-base flex-shrink-0">{ROOM_CONFIGS[type].icon}</span>
                    <span className="truncate">{ROOM_CONFIGS[type].label}</span>
                  </Button>
                ))}
              </div>
              {selectedRoomType && (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>{ROOM_CONFIGS[selectedRoomType].label}:</strong> {ROOM_SIZE_HINTS[selectedRoomType].description}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Recommended: {ROOM_SIZE_HINTS[selectedRoomType].recommended} sq ft
                  </p>
                </div>
              )}
            </Card>
          </>
        )}

        {placementMode === "door" && (
          <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg">
            <Label className="text-sm font-semibold text-foreground">Choose Door Type:</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(DOOR_CONFIGS) as DoorType[]).map((type) => (
                <Button
                  key={type}
                  variant={draggedItem?.type === "door" && draggedItem?.subType === type ? "default" : "outline"}
                  className="text-xs justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 min-w-0 cursor-grab active:cursor-grabbing hover:text-foreground"
                  title={DOOR_CONFIGS[type].description}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("itemType", "door");
                    e.dataTransfer.setData("subType", type);
                    e.dataTransfer.effectAllowed = "copy";
                    setDraggedItem({ type: "door", subType: type });
                  }}
                  onDragEnd={() => setDraggedItem(null)}
                >
                  <span className="mr-1.5 text-base flex-shrink-0">{DOOR_CONFIGS[type].icon}</span>
                  <span className="truncate">{DOOR_CONFIGS[type].label}</span>
                </Button>
              ))}
            </div>
            <div className="p-2.5 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-green-800 leading-relaxed">
                🚪 Drag a door type and drop onto the canvas to place it.
              </p>
            </div>
          </Card>
        )}

        {placementMode === "window" && (
          <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg">
            <Label className="text-sm font-semibold text-foreground">Choose Window Type:</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(WINDOW_CONFIGS) as WindowType[]).map((type) => (
                <Button
                  key={type}
                  variant={draggedItem?.type === "window" && draggedItem?.subType === type ? "default" : "outline"}
                  className="text-xs justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 min-w-0 cursor-grab active:cursor-grabbing hover:text-foreground"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("itemType", "window");
                    e.dataTransfer.setData("subType", type);
                    e.dataTransfer.effectAllowed = "copy";
                    setDraggedItem({ type: "window", subType: type });
                  }}
                  onDragEnd={() => setDraggedItem(null)}
                >
                  <span className="mr-1.5 text-base flex-shrink-0">{WINDOW_CONFIGS[type].icon}</span>
                  <span className="truncate">{WINDOW_CONFIGS[type].label}</span>
                </Button>
              ))}
            </div>
            <div className="p-2.5 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-green-800 leading-relaxed">
                🪟 Drag a window type and drop onto the canvas to place it.
              </p>
            </div>
          </Card>
        )}

        {placementMode === "furniture" && (
          <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg">
            <Label className="text-sm font-semibold text-foreground">Choose Furniture:</Label>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {/* Bedroom */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block font-medium">🛏️ Bedroom</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FURNITURE_CONFIG) as [FurnitureType, typeof FURNITURE_CONFIG[FurnitureType]][])
                    .filter(([, config]) => config.category === "bedroom")
                    .map(([type, config]) => (
                      <Button
                        key={type}
                        variant={draggedItem?.type === "furniture" && draggedItem?.subType === type ? "default" : "outline"}
                        className="flex flex-col items-center gap-1 h-auto py-2 px-2 min-w-0 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("itemType", "furniture");
                          e.dataTransfer.setData("subType", type);
                          e.dataTransfer.effectAllowed = "copy";
                          setDraggedItem({ type: "furniture", subType: type });
                        }}
                        onDragEnd={() => setDraggedItem(null)}
                      >
                        <config.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs truncate w-full text-center">{config.name}</span>
                      </Button>
                    ))}
                </div>
              </div>

              {/* Bathroom */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block font-medium">🚿 Bathroom</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FURNITURE_CONFIG) as [FurnitureType, typeof FURNITURE_CONFIG[FurnitureType]][])
                    .filter(([, config]) => config.category === "bathroom")
                    .map(([type, config]) => (
                      <Button
                        key={type}
                        variant={draggedItem?.type === "furniture" && draggedItem?.subType === type ? "default" : "outline"}
                        className="flex flex-col items-center gap-1 h-auto py-2 px-2 min-w-0 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("itemType", "furniture");
                          e.dataTransfer.setData("subType", type);
                          e.dataTransfer.effectAllowed = "copy";
                          setDraggedItem({ type: "furniture", subType: type });
                        }}
                        onDragEnd={() => setDraggedItem(null)}
                      >
                        <config.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs truncate w-full text-center">{config.name}</span>
                      </Button>
                    ))}
                </div>
              </div>

              {/* Kitchen */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block font-medium">🍳 Kitchen</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FURNITURE_CONFIG) as [FurnitureType, typeof FURNITURE_CONFIG[FurnitureType]][])
                    .filter(([, config]) => config.category === "kitchen")
                    .map(([type, config]) => (
                      <Button
                        key={type}
                        variant={draggedItem?.type === "furniture" && draggedItem?.subType === type ? "default" : "outline"}
                        className="flex flex-col items-center gap-1 h-auto py-2 px-2 min-w-0 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("itemType", "furniture");
                          e.dataTransfer.setData("subType", type);
                          e.dataTransfer.effectAllowed = "copy";
                          setDraggedItem({ type: "furniture", subType: type });
                        }}
                        onDragEnd={() => setDraggedItem(null)}
                      >
                        <config.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs truncate w-full text-center">{config.name}</span>
                      </Button>
                    ))}
                </div>
              </div>

              {/* Living Room */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block font-medium">🛋️ Living Room</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FURNITURE_CONFIG) as [FurnitureType, typeof FURNITURE_CONFIG[FurnitureType]][])
                    .filter(([, config]) => config.category === "living")
                    .map(([type, config]) => (
                      <Button
                        key={type}
                        variant={draggedItem?.type === "furniture" && draggedItem?.subType === type ? "default" : "outline"}
                        className="flex flex-col items-center gap-1 h-auto py-2 px-2 min-w-0 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("itemType", "furniture");
                          e.dataTransfer.setData("subType", type);
                          e.dataTransfer.effectAllowed = "copy";
                          setDraggedItem({ type: "furniture", subType: type });
                        }}
                        onDragEnd={() => setDraggedItem(null)}
                      >
                        <config.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs truncate w-full text-center">{config.name}</span>
                      </Button>
                    ))}
                </div>
              </div>

              {/* Office */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block font-medium">💼 Office</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FURNITURE_CONFIG) as [FurnitureType, typeof FURNITURE_CONFIG[FurnitureType]][])
                    .filter(([, config]) => config.category === "office")
                    .map(([type, config]) => (
                      <Button
                        key={type}
                        variant={draggedItem?.type === "furniture" && draggedItem?.subType === type ? "default" : "outline"}
                        className="flex flex-col items-center gap-1 h-auto py-2 px-2 min-w-0 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("itemType", "furniture");
                          e.dataTransfer.setData("subType", type);
                          e.dataTransfer.effectAllowed = "copy";
                          setDraggedItem({ type: "furniture", subType: type });
                        }}
                        onDragEnd={() => setDraggedItem(null)}
                      >
                        <config.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs truncate w-full text-center">{config.name}</span>
                      </Button>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-green-800 leading-relaxed">
                🪑 Drag furniture from above and drop onto the canvas to place it.
              </p>
            </div>

            {/* Furniture Snap Mode Toggle */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Snap Mode</Label>
              <div className="flex gap-1">
                <Button
                  variant={furnitureSnapMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFurnitureSnapMode("grid")}
                  className="flex-1 text-xs h-7"
                >
                  Grid
                </Button>
                <Button
                  variant={furnitureSnapMode === "half" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFurnitureSnapMode("half")}
                  className="flex-1 text-xs h-7"
                >
                  Half
                </Button>
                <Button
                  variant={furnitureSnapMode === "free" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFurnitureSnapMode("free")}
                  className="flex-1 text-xs h-7"
                >
                  Free
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Your ADU at a Glance */}
        <Card className="p-4 space-y-4 border-accent-top shadow-md bg-gradient-to-br from-surface to-surface-secondary">
          <Label className="text-base font-semibold text-foreground">Your ADU Summary</Label>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-surface rounded-lg border">
              <span className="text-sm text-muted-foreground font-medium">Total Room Area:</span>
              <span className={cn(
                "text-base font-bold px-3 py-1.5 rounded-lg",
                totalArea >= ADU_LIMITS.MIN_AREA && totalArea <= ADU_LIMITS.MAX_AREA
                  ? "text-green-700 bg-green-50 border border-green-200"
                  : "text-destructive bg-red-50 border border-red-200"
              )}>
                {totalArea >= ADU_LIMITS.MIN_AREA && totalArea <= ADU_LIMITS.MAX_AREA ? "✓ " : "⚠ "}
                {totalArea} sq ft
              </span>
            </div>
            {totalArea > 0 && (
              <p className="text-sm text-muted-foreground italic px-2">
                📐 About the size of a {getSizeComparison(totalArea)}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 p-3 bg-surface rounded-lg border">
              <div className="text-center">
                <div className="text-2xl">🛏️</div>
                <div className="text-lg font-bold">{rooms.filter(r => r.type === "bedroom").length}</div>
                <div className="text-xs text-muted-foreground">Bedrooms</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">🚿</div>
                <div className="text-lg font-bold">{rooms.filter(r => r.type === "bathroom").length}</div>
                <div className="text-xs text-muted-foreground">Bathrooms</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">🍳</div>
                <div className="text-lg font-bold">{rooms.filter(r => r.type === "kitchen").length}</div>
                <div className="text-xs text-muted-foreground">Kitchens</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span>🚪 {doors.length} doors</span>
              <span>•</span>
              <span>🪟 {windows.length} windows</span>
            </div>
          </div>

          {/* Validation Warnings */}
          {validationIssues.length > 0 && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 space-y-2">
              <Label className="text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Please Fix These Issues
              </Label>
              {validationIssues.map((issue, index) => (
                <p key={index} className="text-sm text-destructive">
                  • {issue}
                </p>
              ))}
            </div>
          )}

          {/* Room Size Hints */}
          {undersizedRooms.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
              <Label className="text-sm font-semibold text-amber-700">💡 Suggestions</Label>
              {undersizedRooms.map((room) => {
                const hint = ROOM_SIZE_HINTS[room.type];
                return (
                  <p key={room.id} className="text-sm text-amber-700">
                    • {room.name} is small ({room.area} sq ft). {hint.description}
                  </p>
                );
              })}
            </div>
          )}

          {/* Success Message */}
          {validationIssues.length === 0 && undersizedRooms.length === 0 && rooms.length > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                ✅ Your design looks great! You can proceed to the next step.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Right Column - Canvas and Lists */}
      <div className="space-y-6">
        {/* Tools and Boundary Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Tools */}
          <Card className="p-4 space-y-3 shadow-md bg-surface-secondary">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground">Canvas Tools</Label>
              <Button
                variant={isCanvasLocked ? "default" : "outline"}
                size="sm"
                onClick={() => setIsCanvasLocked(!isCanvasLocked)}
                className="text-sm transition-all hover:scale-105"
              >
                {isCanvasLocked ? "🔒 Locked" : "🔓 Unlocked"}
              </Button>
            </div>
            {/* Undo/Redo Row */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
                className="text-sm hover:text-foreground"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4 mr-1.5" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="text-sm hover:text-foreground"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4 mr-1.5" />
                Redo
              </Button>
            </div>
            {/* View Controls Row - now with text labels */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={isCanvasLocked} className="text-sm hover:text-foreground" title="Zoom In">
                <ZoomIn className="h-4 w-4 mr-1.5" />
                Zoom In
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={isCanvasLocked} className="text-sm hover:text-foreground" title="Zoom Out">
                <ZoomOut className="h-4 w-4 mr-1.5" />
                Zoom Out
              </Button>
              <Button variant="outline" size="sm" onClick={resetView} className="text-sm hover:text-foreground" title="Reset View">
                <Maximize2 className="h-4 w-4 mr-1.5" />
                Reset
              </Button>
              <Button
                variant={showGrid ? "default" : "outline"}
                size="sm"
                onClick={() => setShowGrid(!showGrid)}
                className={cn(
                  "text-sm",
                  !showGrid && "hover:text-foreground"
                )}
                title="Toggle Grid"
              >
                <Grid3x3 className="h-4 w-4 mr-1.5" />
                Grid
              </Button>
            </div>
            {/* Save to Cloud */}
            <div className="pt-3 border-t space-y-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveToCloud}
                disabled={isSaving || rooms.length === 0}
                className="w-full text-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4 mr-1.5" />
                    Save to Cloud
                  </>
                )}
              </Button>
              {saveError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <CloudOff className="h-3 w-3" />
                  {saveError}
                </p>
              )}
              {lastSavedAt && !saveError && (
                <p className="text-xs text-muted-foreground">
                  Last saved: {new Date(lastSavedAt).toLocaleTimeString()}
                </p>
              )}
              {/* Auto-save toggle */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  <CloudCog className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Auto-save</span>
                </div>
                <Switch
                  checked={autoSaveEnabled}
                  onCheckedChange={setAutoSaveEnabled}
                  className="scale-75"
                />
              </div>
              {autoSaveEnabled && (
                <p className="text-xs text-muted-foreground/70">
                  Changes auto-save after 2s
                </p>
              )}
              {/* Restore from Cloud */}
              {blueprintId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRestoreDialog(true)}
                  disabled={isRestoring}
                  className="w-full text-xs mt-2"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    <>
                      <History className="h-3.5 w-3.5 mr-1.5" />
                      Restore from Cloud
                    </>
                  )}
                </Button>
              )}
            </div>
            {/* Rotate Controls - shown when item is selected */}
            {(selectedRoomId || selectedDoorId || selectedWindowId || selectedFurnitureId) && (
              <div className="pt-3 border-t space-y-2">
                <Label className="text-xs text-muted-foreground">Selected Item</Label>
                {selectedRoomId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rotateSelectedRoom}
                    className="w-full text-sm hover:text-foreground"
                  >
                    <RotateCw className="h-4 w-4 mr-1.5" />
                    Rotate Room 90°
                  </Button>
                )}
                {selectedDoorId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rotateSelectedDoor}
                    className="w-full text-sm hover:text-foreground"
                  >
                    <RotateCw className="h-4 w-4 mr-1.5" />
                    Rotate Door 90°
                  </Button>
                )}
                {selectedWindowId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rotateSelectedWindow}
                    className="w-full text-sm hover:text-foreground"
                  >
                    <RotateCw className="h-4 w-4 mr-1.5" />
                    Rotate Window 90°
                  </Button>
                )}
                {selectedFurnitureId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rotateSelectedFurniture}
                    className="w-full text-sm hover:text-foreground"
                  >
                    <RotateCw className="h-4 w-4 mr-1.5" />
                    Rotate Furniture 90°
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* ADU Lot Size Editor */}
          <Card className="p-4 shadow-md bg-surface-secondary">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                Your ADU Size
              </Label>
              <span className={cn(
                "text-sm font-bold px-3 py-1 rounded",
                aduArea >= ADU_LIMITS.MIN_AREA && aduArea <= ADU_LIMITS.MAX_AREA
                  ? "text-green-700 bg-green-50 border border-green-200"
                  : "text-destructive bg-red-50 border border-red-200"
              )}>
                {aduArea >= ADU_LIMITS.MIN_AREA && aduArea <= ADU_LIMITS.MAX_AREA ? "✓ " : "⚠ "}
                {Math.round(aduArea)} sq ft
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              This is the total space your ADU can occupy. Drag the slider to resize.
            </p>

            {/* Slider */}
            <div className="space-y-2 mb-4">
              <Slider
                value={[Math.sqrt(aduArea)]}
                onValueChange={([value]) => {
                  // Calculate new square size
                  const targetArea = value * value;
                  const sideLengthPx = Math.sqrt(targetArea) * pixelsPerFoot;
                  // Center in the extended canvas area
                  const offset = (extendedCanvasSize - sideLengthPx) / 2;

                  // Create a centered square with the target area
                  setAduBoundary([
                    { x: snapToGrid(offset), y: snapToGrid(offset) },
                    { x: snapToGrid(offset + sideLengthPx), y: snapToGrid(offset) },
                    { x: snapToGrid(offset + sideLengthPx), y: snapToGrid(offset + sideLengthPx) },
                    { x: snapToGrid(offset), y: snapToGrid(offset + sideLengthPx) },
                  ]);
                }}
                min={Math.sqrt(ADU_LIMITS.MIN_AREA)}
                max={Math.sqrt(ADU_LIMITS.MAX_AREA)}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Min: {ADU_LIMITS.MIN_AREA} sq ft</span>
                <span>Max: {ADU_LIMITS.MAX_AREA} sq ft</span>
              </div>
            </div>

            {/* Edit Shape Button */}
            <div className="flex items-center justify-between pt-3 border-t">
              <div>
                <p className="text-sm font-medium">Custom Shape</p>
                <p className="text-xs text-muted-foreground">
                  {aduBoundary.length} corner points
                </p>
              </div>
              <Button
                variant={editBoundaryMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setEditBoundaryMode(!editBoundaryMode);
                  setSelectedRoomId(null);
                  setSelectedBoundaryPointIndex(null);
                }}
                className={cn(
                  "text-sm",
                  !editBoundaryMode && "hover:text-foreground"
                )}
              >
                {editBoundaryMode ? "Done Editing" : "Edit Shape"}
              </Button>
            </div>

            {/* Edit Mode Instructions */}
            {editBoundaryMode && (
              <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-foreground leading-relaxed">
                  <strong>How to edit:</strong>
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• <strong>Click canvas</strong> to add a new corner</li>
                  <li>• <strong>Drag corners</strong> to move them</li>
                  <li>• <strong>Right-click corner</strong> to remove it</li>
                </ul>
                {selectedBoundaryPointIndex !== null && (
                  <p className="text-sm text-primary font-medium mt-2">
                    Point {selectedBoundaryPointIndex + 1} selected
                  </p>
                )}
              </div>
            )}

            {/* Validation Message */}
            {(aduArea < ADU_LIMITS.MIN_AREA || aduArea > ADU_LIMITS.MAX_AREA) && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-destructive font-medium">
                  ⚠ {aduArea < ADU_LIMITS.MIN_AREA
                    ? `ADU must be at least ${ADU_LIMITS.MIN_AREA} sq ft`
                    : `ADU cannot exceed ${ADU_LIMITS.MAX_AREA} sq ft`}
                </p>
              </div>
            )}
          </Card>
        </div>

      <Card className="p-0 overflow-hidden flex items-center justify-center shadow-xl border-2">
        <div
          ref={canvasContainerRef}
          className="bg-white p-4 relative"
          onDragOver={handleCanvasDragOver}
          onDrop={(e) => {
            e.preventDefault();
            const itemType = e.dataTransfer.getData("itemType") as "furniture" | "door" | "window";
            const subType = e.dataTransfer.getData("subType");

            if (!itemType || !subType || !canvasContainerRef.current || !stageRef.current) return;

            // Get canvas container bounds
            const containerRect = canvasContainerRef.current.getBoundingClientRect();

            // Calculate position relative to the canvas container (accounting for the 16px padding)
            const padding = 16; // p-4 = 16px
            const relativeX = e.clientX - containerRect.left - padding;
            const relativeY = e.clientY - containerRect.top - padding;

            // Convert screen position to world coordinates (accounting for zoom and pan)
            const worldX = (relativeX - panOffset.x) / zoom;
            const worldY = (relativeY - panOffset.y) / zoom;

            if (itemType === "furniture") {
              const x = snapFurniture(worldX);
              const y = snapFurniture(worldY);
              addFurniture(subType as FurnitureType, { x, y });
            } else if (itemType === "door") {
              const x = snapToGrid(worldX);
              const y = snapToGrid(worldY);
              handlePlaceDoor({ x, y }, subType as DoorType);
            } else if (itemType === "window") {
              const x = snapToGrid(worldX);
              const y = snapToGrid(worldY);
              handlePlaceWindow({ x, y }, subType as WindowType);
            }

            setDraggedItem(null);
          }}
        >
          <Stage
            ref={stageRef}
            width={displaySize}
            height={displaySize}
            scaleX={zoom}
            scaleY={zoom}
            x={panOffset.x}
            y={panOffset.y}
            onWheel={handleWheel}
            onMouseDown={(e) => {
              handlePanStart(e);
              if (!isPanning) handleMouseDown(e);
            }}
            onMouseMove={(e) => {
              handlePanMove(e);
              if (!isPanning) handleMouseMove(e);
            }}
            onMouseUp={() => {
              handlePanEnd();
              if (!isPanning) handleMouseUp();
            }}
            onContextMenu={(e) => {
              // Prevent browser context menu on canvas - we use right-click for deleting points
              e.evt.preventDefault();
            }}
            className={editBoundaryMode ? "cursor-pointer" : isPanning ? "cursor-grabbing" : placementMode === "select" ? "cursor-default" : "cursor-crosshair"}
          >
            <Layer>
              {/* Grid - Architectural standard: every 5th line darker for easy counting */}
              {/* Grid extends beyond viewport for smooth zooming out */}
              {showGrid &&
                Array.from({ length: extendedGridFeet + 1 }).map((_, i) => {
                  const pos = i * gridSize;
                  const isMajorGridLine = i % 5 === 0;  // Every 5 feet is major
                  const extendedSize = extendedGridFeet * gridSize;
                  return (
                    <Line
                      key={`v-${i}`}
                      points={[pos, 0, pos, extendedSize]}
                      stroke={isMajorGridLine ? "#c0c0c0" : GRID_CONFIG.GRID_COLOR}
                      strokeWidth={isMajorGridLine ? 1.5 / zoom : 1 / zoom}
                      opacity={isMajorGridLine ? 0.6 : 0.3}
                      perfectDrawEnabled={false}
                      listening={false}
                    />
                  );
                })}
              {showGrid &&
                Array.from({ length: extendedGridFeet + 1 }).map((_, i) => {
                  const pos = i * gridSize;
                  const isMajorGridLine = i % 5 === 0;
                  const extendedSize = extendedGridFeet * gridSize;
                  return (
                    <Line
                      key={`h-${i}`}
                      points={[0, pos, extendedSize, pos]}
                      stroke={isMajorGridLine ? "#c0c0c0" : GRID_CONFIG.GRID_COLOR}
                      strokeWidth={isMajorGridLine ? 1.5 / zoom : 1 / zoom}
                      opacity={isMajorGridLine ? 0.6 : 0.3}
                      perfectDrawEnabled={false}
                      listening={false}
                    />
                  );
                })}

              {/* ADU Boundary */}
              <Line
                points={aduBoundary.flatMap(p => [p.x, p.y])}
                stroke="#961818"
                strokeWidth={3 / zoom}
                dash={[10 / zoom, 5 / zoom]}
                closed={true}
                listening={false}
                fill="transparent"
                perfectDrawEnabled={false}
              />

              {/* Boundary Points (draggable in edit mode) */}
              {editBoundaryMode && aduBoundary.map((point, index) => (
                <Circle
                  key={`boundary-point-${index}`}
                  x={point.x}
                  y={point.y}
                  radius={8 / zoom}
                  fill={selectedBoundaryPointIndex === index ? "#961818" : "#ffffff"}
                  stroke="#961818"
                  strokeWidth={2 / zoom}
                  draggable={true}
                  dragBoundFunc={(pos) => {
                    const snapped = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
                    return constrainToCanvas(snapped);
                  }}
                  onDragMove={(e) => {
                    const newPos = { x: e.target.x(), y: e.target.y() };
                    handleBoundaryPointDrag(index, newPos);
                  }}
                  onClick={() => setSelectedBoundaryPointIndex(index)}
                  onTap={() => setSelectedBoundaryPointIndex(index)}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    handleRemoveBoundaryPoint(index);
                  }}
                  shadowColor="#961818"
                  shadowBlur={selectedBoundaryPointIndex === index ? 10 : 0}
                  shadowOpacity={selectedBoundaryPointIndex === index ? 0.5 : 0}
                />
              ))}

              {/* Existing Rooms */}
              {rooms.map((room) => {
                const isRectangle = room.vertices.length === 4;
                const isSelected = selectedRoomId === room.id;
                const openPassages = doors.filter(d => d.type === "opening");
                const wallSegments = getWallSegmentsExcludingOpenings(room.vertices, openPassages);

                if (isRectangle) {
                  // Render as Rect for rectangular rooms
                  const width = room.vertices[1].x - room.vertices[0].x;
                  const height = room.vertices[2].y - room.vertices[0].y;

                  return (
                    <Group key={room.id}>
                      {/* Room fill - no stroke */}
                      <Rect
                        id={room.id}
                        ref={(node) => {
                          if (node) {
                            roomRefs.current.set(room.id, node);
                          } else {
                            roomRefs.current.delete(room.id);
                          }
                        }}
                        x={room.vertices[0].x}
                        y={room.vertices[0].y}
                        width={width}
                        height={height}
                        fill={room.color}
                        draggable={!editBoundaryMode}
                        dragBoundFunc={(pos) => {
                          const snapped = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
                          return constrainToCanvas(snapped);
                        }}
                        onClick={() => handleRoomClick(room.id)}
                        onTap={() => handleRoomClick(room.id)}
                        onDragEnd={(e) => handleRoomDragEnd(room.id, e)}
                        onTransformEnd={(e) => handleRoomTransform(room.id, e)}
                        shadowColor={isSelected ? "#961818" : undefined}
                        shadowBlur={isSelected ? 10 : 0}
                        shadowOpacity={isSelected ? 0.3 : 0}
                        perfectDrawEnabled={false}
                      />
                      {/* Wall segments - excluding open passages */}
                      {wallSegments.map((segment, segIndex) => (
                        <Line
                          key={`wall-${room.id}-${segIndex}`}
                          points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                          stroke={isSelected ? "#961818" : "#444"}
                          strokeWidth={isSelected ? 4 / zoom : 3 / zoom}
                          lineCap="round"
                          listening={false}
                        />
                      ))}
                      {/* Room label rendered separately after furniture */}
                    </Group>
                  );
                } else {
                  // Render as Line (polygon) for L-shapes and custom polygons
                  const points = room.vertices.flatMap(v => [v.x, v.y]);

                  return (
                    <Group key={room.id}>
                      {/* Room fill - no stroke */}
                      <Line
                        id={room.id}
                        points={points}
                        fill={room.color}
                        closed={true}
                        onClick={() => handleRoomClick(room.id)}
                        onTap={() => handleRoomClick(room.id)}
                        shadowColor={isSelected ? "#961818" : undefined}
                        shadowBlur={isSelected ? 10 : 0}
                        shadowOpacity={isSelected ? 0.3 : 0}
                        perfectDrawEnabled={false}
                      />
                      {/* Wall segments - excluding open passages */}
                      {wallSegments.map((segment, segIndex) => (
                        <Line
                          key={`wall-${room.id}-${segIndex}`}
                          points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                          stroke={isSelected ? "#961818" : "#444"}
                          strokeWidth={isSelected ? 4 / zoom : 3 / zoom}
                          lineCap="round"
                          listening={false}
                        />
                      ))}
                      {/* Room label rendered separately after furniture */}

                      {/* Vertex handles (only when selected) - drag to move, right-click to delete */}
                      {isSelected && room.vertices.map((vertex, vIndex) => {
                        const canDelete = room.vertices.length > 3;
                        return (
                          <Circle
                            key={`vertex-${room.id}-${vIndex}`}
                            x={vertex.x}
                            y={vertex.y}
                            radius={8 / zoom}
                            fill="#961818"
                            stroke="#ffffff"
                            strokeWidth={2 / zoom}
                            draggable={true}
                            dragBoundFunc={(pos) => {
                              const snapped = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
                              return constrainToCanvas(snapped);
                            }}
                            onDragStart={() => {
                              // Buffer the starting position
                              polygonDragBufferRef.current = { roomId: room.id, vertexIndex: vIndex, pos: vertex };
                            }}
                            onDragEnd={(e) => {
                              // Only update state on drag end - prevents spazzing
                              const newPos = { x: snapToGrid(e.target.x()), y: snapToGrid(e.target.y()) };
                              const previousPos = polygonDragBufferRef.current?.pos || vertex;
                              const newVertices = [...room.vertices];
                              newVertices[vIndex] = newPos;

                              const newArea = calculatePolygonArea(newVertices);
                              setRooms(rooms.map(r =>
                                r.id === room.id
                                  ? { ...r, vertices: newVertices, area: Math.round(newArea) }
                                  : r
                              ));

                              // Log the vertex move
                              logVertexMove(room.id, vIndex, previousPos, newPos);
                              polygonDragBufferRef.current = null;
                            }}
                            onContextMenu={(e) => {
                              e.evt.preventDefault();
                              if (canDelete) {
                                handleRemoveRoomVertex(room.id, vIndex);
                              }
                            }}
                            onMouseEnter={(e) => {
                              const stage = e.target.getStage();
                              if (stage) {
                                stage.container().style.cursor = canDelete ? 'pointer' : 'move';
                              }
                            }}
                            onMouseLeave={(e) => {
                              const stage = e.target.getStage();
                              if (stage) {
                                stage.container().style.cursor = 'default';
                              }
                            }}
                          />
                        );
                      })}

                      {/* Midpoint handles (only when selected) - for adding new vertices */}
                      {isSelected && room.vertices.map((vertex, vIndex) => {
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
                            draggable={true}
                            dragBoundFunc={(pos) => {
                              const snapped = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
                              return constrainToCanvas(snapped);
                            }}
                            onDragEnd={(e) => {
                              // Insert new vertex and update on drag end only
                              const newPos = { x: snapToGrid(e.target.x()), y: snapToGrid(e.target.y()) };

                              // Only insert if actually moved from midpoint
                              const dist = Math.sqrt(
                                Math.pow(newPos.x - midpoint.x, 2) +
                                Math.pow(newPos.y - midpoint.y, 2)
                              );

                              if (dist > gridSize / 2) {
                                const newVertices = [...room.vertices];
                                newVertices.splice(vIndex + 1, 0, newPos);
                                const newArea = calculatePolygonArea(newVertices);
                                setRooms(rooms.map(r =>
                                  r.id === room.id
                                    ? { ...r, vertices: newVertices, area: Math.round(newArea) }
                                    : r
                                ));
                              }

                              // Reset the circle position (it will re-render at the new midpoint)
                              e.target.x(midpoint.x);
                              e.target.y(midpoint.y);
                            }}
                          />
                        );
                      })}
                    </Group>
                  );
                }
              })}

              {/* Wall Length Measurements */}
              {rooms.map((room) => {
                const segments = calculateWallSegments(room);
                return segments.map((segment, idx) => {
                  // Calculate wall midpoint
                  const midX = (segment.start.x + segment.end.x) / 2;
                  const midY = (segment.start.y + segment.end.y) / 2;

                  // Determine if wall is horizontal or vertical
                  const isHorizontal = Math.abs(segment.start.y - segment.end.y) < 2;
                  const isVertical = Math.abs(segment.start.x - segment.end.x) < 2;

                  // Calculate room centroid to determine which side is "outside"
                  const centroidY = room.vertices.reduce((sum, v) => sum + v.y, 0) / room.vertices.length;
                  const centroidX = room.vertices.reduce((sum, v) => sum + v.x, 0) / room.vertices.length;
                  const isTopWall = midY < centroidY;      // Wall is above room center
                  const isLeftWall = midX < centroidX;     // Wall is left of room center

                  // Wall label base position (before text offset)
                  const wallOffsetDist = 15 / zoom;  // Distance from wall line
                  let wallLabelX = midX;
                  let wallLabelY = midY;

                  if (isHorizontal) {
                    // Horizontal wall: place label above (top wall) or below (bottom wall)
                    wallLabelY = midY + (isTopWall ? -wallOffsetDist : wallOffsetDist);
                  } else if (isVertical) {
                    // Vertical wall: place label left (left wall) or right (right wall)
                    wallLabelX = midX + (isLeftWall ? -wallOffsetDist : wallOffsetDist);
                  }

                  // Check for collisions between wall label and opening labels
                  const checkLabelCollision = (openingPos: Point, openingOffset: number) => {
                    // Collision detection logic:
                    // Since Text elements don't have explicit width/height, align/verticalAlign
                    // properties don't affect positioning. Only offsetX/offsetY matter.
                    // Text is rendered with top-left at (x - offsetX, y - offsetY)

                    // Approximate text dimensions (at zoom=1):
                    // - "8'-0"" is roughly 35-45px wide, 11-13px tall
                    // - fontSize scales with zoom, so dimensions scale too

                    const collisionThreshold = 70 / zoom; // Distance along wall threshold
                    const perpendicularThreshold = 20 / zoom;  // Perpendicular "same level" threshold

                    // Wall label position (after offsetX/offsetY applied)
                    // Text renders with top-left at (x - offsetX, y - offsetY)
                    const wallLabelX_final = wallLabelX - 30 / zoom;
                    const wallLabelY_final = wallLabelY - 6 / zoom;

                    // Opening label position (after text offset)
                    // Must account for direction (isTopWall/isLeftWall) to match actual rendering
                    let openingLabelX_final, openingLabelY_final;

                    if (isHorizontal) {
                      // Horizontal wall: opening label offset vertically
                      openingLabelX_final = openingPos.x - 25 / zoom;
                      const offsetY = isTopWall ? -openingOffset : openingOffset;
                      openingLabelY_final = openingPos.y + offsetY - 6 / zoom;
                    } else {
                      // Vertical wall: opening label offset horizontally
                      const offsetX = isLeftWall ? -openingOffset : openingOffset;
                      openingLabelX_final = openingPos.x + offsetX - 25 / zoom;
                      openingLabelY_final = openingPos.y - 6 / zoom;
                    }

                    // Check collision based on wall orientation
                    if (isHorizontal) {
                      // For horizontal walls: labels collide if on same Y level and close in X
                      const sameYLevel = Math.abs(openingLabelY_final - wallLabelY_final) < perpendicularThreshold;
                      const closeInX = Math.abs(openingLabelX_final - wallLabelX_final) < collisionThreshold;
                      return sameYLevel && closeInX;
                    } else if (isVertical) {
                      // For vertical walls: labels collide if on same X level and close in Y
                      const sameXLevel = Math.abs(openingLabelX_final - wallLabelX_final) < perpendicularThreshold;
                      const closeInY = Math.abs(openingLabelY_final - wallLabelY_final) < collisionThreshold;
                      return sameXLevel && closeInY;
                    }
                    return false;
                  };

                  return (
                    <Group key={`wall-${room.id}-${idx}`}>
                      {/* Wall length label - Architectural standard dimension style */}
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
                        // Opening label positioning logic:
                        // 1. Start at opening center position
                        // 2. Offset in same direction as wall label (outside room)
                        // 3. If collision detected, increase offset distance to avoid overlap

                        const baseOffsetDist = 18 / zoom;  // Normal distance from wall

                        // Detect collision BEFORE calculating final position
                        const hasCollision = segment.effectiveLengthFeet > 0 &&
                                           checkLabelCollision(opening.position, baseOffsetDist);

                        // Increase offset if collision detected (2.5x = ~45px at zoom=1)
                        const finalOffset = hasCollision ? baseOffsetDist * 2.5 : baseOffsetDist;

                        // Calculate final label position (same direction as wall label)
                        let labelX = opening.position.x;
                        let labelY = opening.position.y;

                        if (isHorizontal) {
                          // Horizontal wall: offset vertically in same direction as wall label
                          // Top wall: both labels go up (negative Y)
                          // Bottom wall: both labels go down (positive Y)
                          labelY = opening.position.y + (isTopWall ? -finalOffset : finalOffset);
                        } else if (isVertical) {
                          // Vertical wall: offset horizontally in same direction as wall label
                          // Left wall: both labels go left (negative X)
                          // Right wall: both labels go right (positive X)
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

              {/* Current Drawing Rectangle */}
              {isDrawing && currentRect && drawMode === "rectangle" && (
                <Rect
                  x={currentRect.x}
                  y={currentRect.y}
                  width={currentRect.width}
                  height={currentRect.height}
                  fill={selectedRoomType ? ROOM_CONFIGS[selectedRoomType].color : "#f3f4f6"}
                  stroke="#961818"
                  strokeWidth={2 / zoom}
                  opacity={0.7}
                  dash={[5 / zoom, 5 / zoom]}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              )}

              {/* Current Drawing Polygon */}
              {isDrawing && drawMode === "polygon" && polygonPoints.length > 0 && (
                <>
                  {/* Polygon lines */}
                  {polygonPoints.length >= 2 && (
                    <Line
                      points={polygonPoints.flatMap(p => [p.x, p.y])}
                      stroke="#961818"
                      strokeWidth={2 / zoom}
                      fill={selectedRoomType && polygonPoints.length >= 3 ? ROOM_CONFIGS[selectedRoomType].color : "transparent"}
                      opacity={0.7}
                      dash={[5 / zoom, 5 / zoom]}
                      closed={polygonPoints.length >= 3}
                      listening={false}
                      perfectDrawEnabled={false}
                    />
                  )}
                  {/* Vertex circles - right-click to delete */}
                  {polygonPoints.map((point, i) => (
                    <Circle
                      key={i}
                      x={point.x}
                      y={point.y}
                      radius={6 / zoom}
                      fill="#961818"
                      stroke="#ffffff"
                      strokeWidth={2 / zoom}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        e.cancelBubble = true;
                        // Remove this point from the polygon
                        const newPoints = polygonPoints.filter((_, idx) => idx !== i);
                        setPolygonPoints(newPoints);
                        // If no points left, stop drawing
                        if (newPoints.length === 0) {
                          setIsDrawing(false);
                        }
                      }}
                    />
                  ))}
                </>
              )}

              {/* Regular Doors (not openings) */}
              {doors.filter(d => d.type !== "opening").map((door) => {
                const isSelected = selectedDoorId === door.id;
                const doorWidthPx = door.width * pixelsPerFoot;
                const doorThicknessPx = gridSize / 8;

                return (
                  <Group
                    key={door.id}
                    x={door.position.x}
                    y={door.position.y}
                    rotation={door.rotation}
                    draggable={!editBoundaryMode}
                    dragBoundFunc={(pos) => {
                      const doorWidth = door.width * pixelsPerFoot;
                      const isVertical = door.rotation % 180 === 90;

                      if (isVertical) {
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
                    onDragEnd={(e) => {
                      const group = e.target;
                      const doorWidth = door.width * pixelsPerFoot;
                      const isVertical = door.rotation % 180 === 90;

                      let newX, newY;
                      if (isVertical) {
                        const snappedTopEdge = snapToGrid(group.y() - doorWidth / 2);
                        newY = snappedTopEdge + doorWidth / 2;
                        newX = snapToGrid(group.x());
                      } else {
                        const snappedLeftEdge = snapToGrid(group.x() - doorWidth / 2);
                        newX = snappedLeftEdge + doorWidth / 2;
                        newY = snapToGrid(group.y());
                      }
                      setDoors(doors.map(d => d.id === door.id ? { ...d, position: { x: newX, y: newY } } : d));
                    }}
                    onClick={() => setSelectedDoorId(door.id)}
                    onTap={() => setSelectedDoorId(door.id)}
                  >
                    {/* Hit area for interaction */}
                    <Rect
                      x={-doorWidthPx / 2}
                      y={-doorWidthPx / 2}
                      width={doorWidthPx}
                      height={doorWidthPx}
                      fill="transparent"
                    />

                    {/* Door frame/wall opening */}
                    <Line
                      points={[-doorWidthPx / 2, 0, doorWidthPx / 2, 0]}
                      stroke={isSelected ? "#961818" : "#333"}
                      strokeWidth={doorThicknessPx}
                      lineCap="round"
                      listening={false}
                    />

                    {/* Door panel */}
                    <Line
                      points={[-doorWidthPx / 2 + 2, 0, doorWidthPx / 2 - 2, 0]}
                      stroke={isSelected ? "#961818" : "#8B4513"}
                      strokeWidth={2 / zoom}
                      lineCap="butt"
                      listening={false}
                    />

                    {/* Door swing arc */}
                    <Arc
                      x={-doorWidthPx / 2}
                      y={0}
                      innerRadius={0}
                      outerRadius={doorWidthPx}
                      angle={90}
                      rotation={0}
                      stroke={isSelected ? "#961818" : "#8B4513"}
                      strokeWidth={1 / zoom}
                      dash={[4 / zoom, 4 / zoom]}
                      listening={false}
                    />
                  </Group>
                );
              })}

              {/* Open Passages - With rotation support and larger hit area */}
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
                      draggable={!editBoundaryMode}
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

                        const prevPos = { ...opening.position };
                        setDoors(doors.map(d =>
                          d.id === opening.id
                            ? { ...d, position: { x: newCenterX, y: newCenterY } }
                            : d
                        ));
                        logMove("door", opening.id, prevPos, { x: newCenterX, y: newCenterY });
                      }}
                      onTransformEnd={(e) => {
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

                        const prevWidth = opening.width;
                        setDoors(doors.map(d =>
                          d.id === opening.id
                            ? { ...d, width: newWidthFeet, position: { x: newCenterX, y: newCenterY } }
                            : d
                        ));
                        logResize("door", opening.id, { width: prevWidth }, { width: newWidthFeet }, { x: newCenterX, y: newCenterY });

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
                        setSelectedDoorId(opening.id);
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        setSelectedDoorId(opening.id);
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

              {/* Windows - With rotation support */}
              {windows.map((window) => {
                const isSelected = selectedWindowId === window.id;
                const windowWidthPx = window.width * pixelsPerFoot;
                const windowThicknessPx = gridSize / 6;
                const isVertical = window.rotation % 180 === 90;

                // For vertical windows, swap dimensions
                const rectWidth = isVertical ? windowThicknessPx : windowWidthPx;
                const rectHeight = isVertical ? windowWidthPx : windowThicknessPx;

                // Position by top-left corner (convert from center)
                const leftEdgeX = window.position.x - rectWidth / 2;
                const topEdgeY = window.position.y - rectHeight / 2;

                return (
                  <Rect
                    key={window.id}
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
                    fill={isSelected ? "#961818" : "#4682B4"}
                    stroke={isSelected ? "#961818" : "#2C5282"}
                    strokeWidth={isSelected ? 2 / zoom : 1 / zoom}
                    draggable={!editBoundaryMode}
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

                      const prevPos = { ...window.position };
                      setWindows(windows.map(w =>
                        w.id === window.id
                          ? { ...w, position: { x: newCenterX, y: newCenterY } }
                          : w
                      ));
                      logMove("window", window.id, prevPos, { x: newCenterX, y: newCenterY });
                    }}
                    onTransformEnd={(e) => {
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

                      const prevWidth = window.width;
                      setWindows(windows.map(w =>
                        w.id === window.id
                          ? { ...w, width: newWidthFeet, position: { x: newCenterX, y: newCenterY } }
                          : w
                      ));
                      logResize("window", window.id, { width: prevWidth }, { width: newWidthFeet }, { x: newCenterX, y: newCenterY });

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
                      setSelectedWindowId(window.id);
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true;
                      setSelectedWindowId(window.id);
                    }}
                  />
                );
              })}

              {/* Furniture */}
              {furniture.map((item) => {
                const isSelected = selectedFurnitureId === item.id;
                const config = FURNITURE_CONFIG[item.type];
                const furnitureWidthPx = item.width * pixelsPerFoot;
                const furnitureHeightPx = item.height * pixelsPerFoot;
                const furnitureImage = furnitureImages[item.type];

                return (
                  <Group
                    key={item.id}
                    x={item.position.x}
                    y={item.position.y}
                    rotation={item.rotation}
                    draggable={!editBoundaryMode}
                    dragBoundFunc={(pos) => {
                      const snappedX = snapFurniture(pos.x);
                      const snappedY = snapFurniture(pos.y);
                      return constrainToCanvas({ x: snappedX, y: snappedY });
                    }}
                    onDragEnd={(e) => {
                      const group = e.target;
                      const newX = snapFurniture(group.x());
                      const newY = snapFurniture(group.y());
                      setFurniture(furniture.map(f =>
                        f.id === item.id ? { ...f, position: { x: newX, y: newY } } : f
                      ));
                    }}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      setSelectedFurnitureId(item.id);
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true;
                      setSelectedFurnitureId(item.id);
                    }}
                  >
                    {/* Background fill for selection */}
                    <Rect
                      x={-furnitureWidthPx / 2}
                      y={-furnitureHeightPx / 2}
                      width={furnitureWidthPx}
                      height={furnitureHeightPx}
                      fill={isSelected ? "rgba(150, 24, 24, 0.15)" : "rgba(255, 255, 255, 0.9)"}
                      stroke={isSelected ? "#961818" : "#737373"}
                      strokeWidth={isSelected ? 3 / zoom : 2 / zoom}
                      cornerRadius={2 / zoom}
                    />

                    {/* SVG Icon */}
                    {furnitureImage && (
                      <KonvaImage
                        x={-furnitureWidthPx / 2 + 2}
                        y={-furnitureHeightPx / 2 + 2}
                        width={furnitureWidthPx - 4}
                        height={furnitureHeightPx - 4}
                        image={furnitureImage}
                        listening={false}
                      />
                    )}

                    {/* Label - only show when selected */}
                    {isSelected && (
                      <Text
                        x={-furnitureWidthPx / 2}
                        y={furnitureHeightPx / 2 + 4 / zoom}
                        width={furnitureWidthPx}
                        text={config.name}
                        fontSize={10 / zoom}
                        fontFamily="Montserrat"
                        fontStyle="bold"
                        fill="#961818"
                        align="center"
                        listening={false}
                        shadowColor="white"
                        shadowBlur={3 / zoom}
                        shadowOpacity={1}
                      />
                    )}
                  </Group>
                );
              })}

              {/* Room Labels - rendered on top of furniture */}
              {rooms.map((room) => {
                const effectiveArea = calculateEffectiveArea(room);
                const isNested = effectiveArea !== room.area;
                const isRectangle = room.vertices.length === 4 && (() => {
                  const [v0, v1, v2, v3] = room.vertices;
                  return (v0.x === v3.x && v1.x === v2.x && v0.y === v1.y && v2.y === v3.y) ||
                         (v0.y === v3.y && v1.y === v2.y && v0.x === v1.x && v2.x === v3.x);
                })();

                if (isRectangle) {
                  const width = Math.abs(room.vertices[2].x - room.vertices[0].x);
                  const height = Math.abs(room.vertices[2].y - room.vertices[0].y);
                  return (
                    <Text
                      key={`label-${room.id}`}
                      x={room.vertices[0].x + width / 2}
                      y={room.vertices[0].y + height / 2}
                      text={`${room.name}\n${Math.round(effectiveArea)} sq ft${isNested ? ` (${room.area} total)` : ''}`}
                      fontSize={14 / zoom}
                      fill="#0a0a0a"
                      fontStyle="bold"
                      align="center"
                      verticalAlign="middle"
                      offsetX={(12 / zoom) * room.name.length / 2.5}
                      offsetY={10 / zoom}
                      listening={false}
                      shadowColor="white"
                      shadowBlur={4 / zoom}
                      shadowOpacity={0.8}
                    />
                  );
                } else {
                  const centroid = {
                    x: room.vertices.reduce((sum, v) => sum + v.x, 0) / room.vertices.length,
                    y: room.vertices.reduce((sum, v) => sum + v.y, 0) / room.vertices.length,
                  };
                  return (
                    <Text
                      key={`label-${room.id}`}
                      x={centroid.x}
                      y={centroid.y}
                      text={`${room.name}\n${Math.round(effectiveArea)} sq ft${isNested ? ` (${room.area} total)` : ''}`}
                      fontSize={14 / zoom}
                      fill="#0a0a0a"
                      fontStyle="bold"
                      align="center"
                      verticalAlign="middle"
                      offsetX={(12 / zoom) * room.name.length / 2.5}
                      offsetY={10 / zoom}
                      listening={false}
                      shadowColor="white"
                      shadowBlur={4 / zoom}
                      shadowOpacity={0.8}
                    />
                  );
                }
              })}
            </Layer>

            {/* Transformer Layer for resizing rooms */}
            {selectedRoomId && !editBoundaryMode && (
              <Layer>
                <Transformer
                  ref={transformerRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Snap to grid during transform
                    const snappedWidth = snapToGrid(newBox.width);
                    const snappedHeight = snapToGrid(newBox.height);
                    const snappedX = snapToGrid(newBox.x);
                    const snappedY = snapToGrid(newBox.y);

                    // Minimum size check (at least 1 foot)
                    if (snappedWidth < gridSize || snappedHeight < gridSize) {
                      return oldBox;
                    }

                    return {
                      ...newBox,
                      x: Math.max(0, Math.min(snappedX, displaySize - snappedWidth)),
                      y: Math.max(0, Math.min(snappedY, displaySize - snappedHeight)),
                      width: snappedWidth,
                      height: snappedHeight
                    };
                  }}
                  enabledAnchors={[
                    'top-left', 'top-center', 'top-right',
                    'middle-left', 'middle-right',
                    'bottom-left', 'bottom-center', 'bottom-right'
                  ]}
                  rotateEnabled={false}
                  keepRatio={false}
                  ignoreStroke={true}
                  padding={2}
                />
              </Layer>
            )}

            {/* Transformer Layer for resizing windows - direction based on rotation */}
            {selectedWindowId && !editBoundaryMode && (() => {
              const selectedWindow = windows.find(w => w.id === selectedWindowId);
              const isWindowVertical = selectedWindow ? selectedWindow.rotation % 180 === 90 : false;

              return (
              <Layer>
                <Transformer
                  ref={windowTransformerRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Snap the resizable dimension to grid (minimum 1 foot)
                    const minSize = gridSize;

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
                  enabledAnchors={isWindowVertical ? ['top-center', 'bottom-center'] : ['middle-left', 'middle-right']}
                  rotateEnabled={false}
                  ignoreStroke={true}
                  keepRatio={false}
                  centeredScaling={false}
                  padding={4}
                />
              </Layer>
              );
            })()}

            {/* Transformer Layer for resizing openings - direction based on rotation */}
            {selectedDoorId && doors.find(d => d.id === selectedDoorId)?.type === 'opening' && !editBoundaryMode && (() => {
              const selectedOpening = doors.find(d => d.id === selectedDoorId);
              const isOpeningVertical = selectedOpening ? selectedOpening.rotation % 180 === 90 : false;

              return (
              <Layer>
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
                />
              </Layer>
              );
            })()}

          </Stage>

          {/* Floating ADU Area Indicator - top left */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-gray-200 pointer-events-none">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-bold",
                aduArea >= ADU_LIMITS.MIN_AREA && aduArea <= ADU_LIMITS.MAX_AREA
                  ? "text-green-700"
                  : "text-red-600"
              )}>
                {aduArea >= ADU_LIMITS.MIN_AREA && aduArea <= ADU_LIMITS.MAX_AREA ? "✓" : "⚠"}
              </span>
              <span className="text-sm font-semibold text-gray-700">
                ADU Area: <span className="text-primary">{Math.round(aduArea)} sq ft</span>
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Alt + Scroll to zoom
            </div>
          </div>

          {/* Floating Compass - top right */}
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 pointer-events-none w-12 h-12 flex items-center justify-center">
            <div className="relative w-8 h-8">
              {/* North Arrow SVG */}
              <svg viewBox="0 0 24 24" className="w-full h-full">
                <polygon
                  points="12,2 15,14 12,11 9,14"
                  fill="#961818"
                  stroke="#444"
                  strokeWidth="0.5"
                />
                <polygon
                  points="12,22 9,14 12,11 15,14"
                  fill="#ccc"
                  stroke="#444"
                  strokeWidth="0.5"
                />
              </svg>
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-600">N</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Lists below canvas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Room List */}
        {rooms.length > 0 && (
          <Card className="p-4 space-y-3 shadow-md">
            <Label className="text-base font-semibold text-foreground">Rooms ({rooms.length})</Label>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-md border bg-card hover:bg-accent/50 hover:shadow-sm hover:scale-[1.01] transition-all cursor-pointer",
                    selectedRoomId === room.id && "ring-2 ring-primary shadow-md scale-[1.01]"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-8 h-8 rounded flex-shrink-0 border"
                      style={{ backgroundColor: room.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{room.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(calculateEffectiveArea(room))} sq ft
                        {Math.round(calculateEffectiveArea(room)) !== room.area && (
                          <span className="text-xs"> ({room.area} total)</span>
                        )}
                      </div>
                      {room.type === "other" && (
                        <Input
                          type="text"
                          placeholder="Describe this room..."
                          value={roomDescriptions.get(room.id) || ""}
                          onChange={(e) => {
                            const newDescriptions = new Map(roomDescriptions);
                            newDescriptions.set(room.id, e.target.value);
                            setRoomDescriptions(newDescriptions);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-8 text-sm mt-2"
                        />
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDeleteRoom(room.id, room.name);
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    title="Delete room"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Door List */}
        {doors.length > 0 && (
          <Card className="p-4 space-y-3 shadow-md">
            <Label className="text-base font-semibold text-foreground">Doors ({doors.length})</Label>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {doors.map((door) => (
                <div
                  key={door.id}
                  onClick={() => setSelectedDoorId(door.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-md border bg-card hover:bg-accent/50 hover:shadow-sm hover:scale-[1.01] transition-all cursor-pointer",
                    selectedDoorId === door.id && "ring-2 ring-primary shadow-md scale-[1.01]"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xl">{DOOR_CONFIGS[door.type].icon}</span>
                    <div className="text-sm">
                      <div className="font-medium">{DOOR_CONFIGS[door.type].label}</div>
                      <div className="text-muted-foreground">{door.width}ft wide</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDeleteDoor(door.id, DOOR_CONFIGS[door.type].label);
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Delete door"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Window List */}
        {windows.length > 0 && (
          <Card className="p-4 space-y-3 shadow-md">
            <Label className="text-base font-semibold text-foreground">Windows ({windows.length})</Label>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {windows.map((window) => (
                <div
                  key={window.id}
                  onClick={() => setSelectedWindowId(window.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-md border bg-card hover:bg-accent/50 hover:shadow-sm hover:scale-[1.01] transition-all cursor-pointer",
                    selectedWindowId === window.id && "ring-2 ring-primary shadow-md scale-[1.01]"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xl">{WINDOW_CONFIGS[window.type].icon}</span>
                    <div className="text-sm">
                      <div className="font-medium">{WINDOW_CONFIGS[window.type].label}</div>
                      <div className="text-muted-foreground">{window.width}×{window.height}ft</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDeleteWindow(window.id, WINDOW_CONFIGS[window.type].label);
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Delete window"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Furniture List */}
        {furniture.length > 0 && (
          <Card className="p-4 space-y-3 shadow-md">
            <Label className="text-base font-semibold text-foreground">Furniture ({furniture.length})</Label>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {furniture.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedFurnitureId(item.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-md border bg-card hover:bg-accent/50 hover:shadow-sm hover:scale-[1.01] transition-all cursor-pointer",
                    selectedFurnitureId === item.id && "ring-2 ring-primary shadow-md scale-[1.01]"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {React.createElement(FURNITURE_CONFIG[item.type].icon, { className: "h-5 w-5" })}
                    <div className="text-sm">
                      <div className="font-medium">{FURNITURE_CONFIG[item.type].name}</div>
                      <div className="text-muted-foreground">{item.width}×{item.height}ft</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDeleteFurniture(item.id, FURNITURE_CONFIG[item.type].name);
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Delete furniture"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, type: null, id: null, name: "" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete {deleteDialog.type}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete <strong>&quot;{deleteDialog.name}&quot;</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-base">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90 text-base"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialog} onOpenChange={setRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Restore from Cloud?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              This will replace your current work with the last saved version from the cloud.
              Any unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-base">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={restoreFromCloud}
              className="text-base"
            >
              Yes, Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
