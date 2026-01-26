"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Stage, Layer, Rect, Line, Text, Group, Circle, Transformer, Arc, Path } from "react-konva";
import Konva from "konva";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Trash2, ZoomIn, ZoomOut, Grid3x3, Maximize2, RotateCw, Square, Pentagon, Check, X, DoorOpen, RectangleHorizontal, MousePointer2, Undo2, Redo2, Armchair, Bed, Bath, ChefHat, Sofa } from "lucide-react";
import { GRID_CONFIG, CANVAS_CONFIG, ROOM_CONFIGS, ADU_LIMITS, DOOR_CONFIGS, WINDOW_CONFIGS, ROOM_SIZE_HINTS, getSizeComparison } from "@/lib/constants";
import type { FloorPlan, Room, RoomType, Point, Door, DoorType, Window, WindowType } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const [selectedDoorType, setSelectedDoorType] = useState<DoorType>("single");
  const [selectedWindowType, setSelectedWindowType] = useState<WindowType>("standard");
  const [selectedFurnitureType, setSelectedFurnitureType] = useState<FurnitureType | null>(null);
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
  const MAX_HISTORY = 50; // Limit history to 50 states

  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const windowTransformerRef = useRef<any>(null);
  const doorTransformerRef = useRef<any>(null);
  const roomRefs = useRef<Map<string, any>>(new Map());
  const windowRefs = useRef<Map<string, any>>(new Map());
  const doorRefs = useRef<Map<string, any>>(new Map());

  // Update window transformer when selection changes or window dimensions change
  useEffect(() => {
    if (windowTransformerRef.current && selectedWindowId) {
      const node = windowRefs.current.get(selectedWindowId);
      if (node) {
        windowTransformerRef.current.nodes([node]);
        windowTransformerRef.current.forceUpdate();
        windowTransformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedWindowId, windows]);

  // Update door transformer when selection changes or door dimensions change
  useEffect(() => {
    if (doorTransformerRef.current && selectedDoorId) {
      const node = doorRefs.current.get(selectedDoorId);
      if (node) {
        doorTransformerRef.current.nodes([node]);
        doorTransformerRef.current.forceUpdate();
        doorTransformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedDoorId, doors]);

  // Canvas is always 36×36 ft (1296 sq ft) to give leeway
  const maxCanvasFeet = 36;

  // Display size in pixels (fixed)
  const displaySize = 800;

  // Pixels per foot (based on max canvas)
  const pixelsPerFoot = displaySize / maxCanvasFeet;

  // Grid size in pixels (1 foot per grid cell)
  const gridSize = pixelsPerFoot;

  // ADU boundary as editable polygon (default: centered 600 sq ft square)
  const defaultBoundarySize = Math.sqrt(600) * pixelsPerFoot; // ~24.5 ft
  const defaultOffset = (displaySize - defaultBoundarySize) / 2;

  const [aduBoundary, setAduBoundary] = useState<Point[]>([
    { x: defaultOffset, y: defaultOffset },
    { x: defaultOffset + defaultBoundarySize, y: defaultOffset },
    { x: defaultOffset + defaultBoundarySize, y: defaultOffset + defaultBoundarySize },
    { x: defaultOffset, y: defaultOffset + defaultBoundarySize },
  ]);

  const snapToGrid = (value: number) => {
    return Math.round(value / gridSize) * gridSize;
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
    return {
      x: Math.max(0, Math.min(point.x, displaySize)),
      y: Math.max(0, Math.min(point.y, displaySize)),
    };
  };

  const isPointInsideBoundary = (point: Point): boolean => {
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
    const epsilon = 2; // 2 pixels tolerance for boundary detection
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

  // Furniture configurations with standard architectural dimensions
  const FURNITURE_CONFIG: Record<FurnitureType, {
    name: string;
    width: number;   // feet
    height: number;  // feet (depth)
    category: "bedroom" | "living" | "bathroom" | "kitchen" | "office";
    icon: any;
  }> = {
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
  };

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

  const handleAddBoundaryPoint = (e: any) => {
    if (!editBoundaryMode) return;

    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
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

  const handleRemoveBoundaryPoint = (index: number) => {
    if (aduBoundary.length <= 3) {
      alert("ADU boundary must have at least 3 points");
      return;
    }
    const newBoundary = aduBoundary.filter((_, i) => i !== index);
    setAduBoundary(newBoundary);
    setSelectedBoundaryPointIndex(null);
  };

  const handlePlaceDoor = (position: Point) => {
    const doorWidth = DOOR_CONFIGS[selectedDoorType].width;
    const newDoor: Door = {
      id: crypto.randomUUID(),
      type: selectedDoorType,
      position,
      rotation: 0,
      width: doorWidth,
    };
    setDoors([...doors, newDoor]);
  };

  const handlePlaceWindow = (position: Point) => {
    const windowConfig = WINDOW_CONFIGS[selectedWindowType];
    const newWindow: Window = {
      id: crypto.randomUUID(),
      type: selectedWindowType,
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

  const rotateSelectedDoor = () => {
    if (!selectedDoorId) return;
    setDoors(doors.map(d =>
      d.id === selectedDoorId
        ? { ...d, rotation: (d.rotation + 90) % 360 }
        : d
    ));
  };

  const rotateSelectedWindow = () => {
    if (!selectedWindowId) return;
    setWindows(windows.map(w =>
      w.id === selectedWindowId
        ? { ...w, rotation: (w.rotation + 90) % 360 }
        : w
    ));
  };

  const deleteFurniture = (furnitureId: string) => {
    setFurniture(furniture.filter((f) => f.id !== furnitureId));
    if (selectedFurnitureId === furnitureId) {
      setSelectedFurnitureId(null);
    }
  };

  const rotateSelectedFurniture = () => {
    if (!selectedFurnitureId) return;
    setFurniture(furniture.map(f =>
      f.id === selectedFurnitureId
        ? { ...f, rotation: (f.rotation + 90) % 360 }
        : f
    ));
  };

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

  const handleMouseDown = (e: any) => {
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
      } else if (selectedFurnitureType) {
        // Furniture placement mode
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        const world = stageToWorld(pointerPosition);
        const x = snapToGrid(world.x);
        const y = snapToGrid(world.y);
        addFurniture(selectedFurnitureType, { x, y });
        setSelectedFurnitureType(null); // Clear selection after placement
      } else if (placementMode === "select") {
        // In select mode, just deselect everything (no placement)
        return;
      } else if (placementMode === "door") {
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        const world = stageToWorld(pointerPosition);
        const x = snapToGrid(world.x);
        const y = snapToGrid(world.y);
        handlePlaceDoor({ x, y });
      } else if (placementMode === "window") {
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        const world = stageToWorld(pointerPosition);
        const x = snapToGrid(world.x);
        const y = snapToGrid(world.y);
        handlePlaceWindow({ x, y });
      } else if (placementMode === "room" && selectedRoomType) {
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
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

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !selectedRoomType) return;
    if (drawMode === "polygon") return; // Polygon mode doesn't use mouse move

    if (!startPoint) return;

    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
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

    // Reset polygon drawing
    setIsDrawing(false);
    setPolygonPoints([]);
  };

  const cancelPolygon = () => {
    setIsDrawing(false);
    setPolygonPoints([]);
  };

  const handleRoomClick = (roomId: string) => {
    // Don't allow room selection during polygon drawing
    if (isDrawing && drawMode === "polygon") {
      return;
    }
    setSelectedRoomId(roomId);
  };

  const handleRoomDragEnd = (roomId: string, e: any) => {
    const node = e.target;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    let x = snapToGrid(node.x());
    let y = snapToGrid(node.y());

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
    }
  };

  const handleRoomTransform = (roomId: string, e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Snap dimensions to grid
    let newWidth = snapToGrid(node.width() * scaleX);
    let newHeight = snapToGrid(node.height() * scaleY);
    let x = snapToGrid(node.x());
    let y = snapToGrid(node.y());

    // Calculate area in square feet
    const widthFeet = newWidth / pixelsPerFoot;
    const heightFeet = newHeight / pixelsPerFoot;
    const area = widthFeet * heightFeet;

    setRooms(rooms.map((room) => {
      if (room.id === roomId) {
        return {
          ...room,
          vertices: [
            { x, y },
            { x: x + newWidth, y },
            { x: x + newWidth, y: y + newHeight },
            { x, y: y + newHeight },
          ],
          area: Math.round(area),
        };
      }
      return room;
    }));

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);
    node.width(newWidth);
    node.height(newHeight);
    node.position({ x, y });
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
    setRooms(rooms.filter((r) => r.id !== roomId));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
  };

  const handleZoomIn = () => {
    setZoom(Math.min(zoom * 1.2, CANVAS_CONFIG.MAX_SCALE));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom / 1.2, CANVAS_CONFIG.MIN_SCALE));
  };

  const handleWheel = (e: any) => {
    if (isCanvasLocked) return; // Don't zoom if canvas is locked

    e.evt.preventDefault();

    const stage = e.target.getStage();
    const oldScale = zoom;
    const pointer = stage.getPointerPosition();

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

  const handlePanStart = (e: any) => {
    if (isCanvasLocked) return; // Don't pan if canvas is locked

    // Middle mouse button (button 1)
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      setIsPanning(true);
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      setPanStart(pos);
    }
  };

  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
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
  const undo = () => {
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
  };

  // Redo function
  const redo = () => {
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
  };

  // Save to history when rooms, doors, windows, furniture, or boundary change
  useEffect(() => {
    if (!isUndoingOrRedoing.current) {
      const timeoutId = setTimeout(() => {
        saveToHistory();
      }, 300); // Debounce to avoid saving too frequently
      return () => clearTimeout(timeoutId);
    }
  }, [rooms, doors, windows, furniture, aduBoundary, saveToHistory]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

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

  const handlePanMove = (e: any) => {
    if (!isPanning || !panStart) return;

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

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
            <Card className="p-4 space-y-3 border-accent-top shadow-md transition-shadow hover:shadow-lg">
              <Label className="text-sm font-semibold text-foreground">What do you want to do?</Label>
          <div className="flex flex-col gap-2">
            <Button
              variant={placementMode === "select" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setPlacementMode("select");
                setIsDrawing(false);
                setCurrentRect(null);
                cancelPolygon();
              }}
              className="text-xs w-full justify-start transition-all hover:translate-x-1 hover:shadow-sm [&:not([data-state='active'])]:hover:text-foreground"
            >
              <MousePointer2 className="h-4 w-4 mr-2" />
              Select / Move
            </Button>
            <Button
              variant={placementMode === "room" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setPlacementMode("room");
                setSelectedDoorId(null);
                setSelectedWindowId(null);
              }}
              className="text-xs w-full justify-start transition-all hover:translate-x-1 hover:shadow-sm [&:not([data-state='active'])]:hover:text-foreground"
            >
              <Square className="h-4 w-4 mr-2" />
              Rooms
            </Button>
            <Button
              variant={placementMode === "door" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setPlacementMode("door");
                setSelectedRoomId(null);
                setIsDrawing(false);
                setCurrentRect(null);
                cancelPolygon();
              }}
              className="text-xs w-full justify-start transition-all hover:translate-x-1 hover:shadow-sm [&:not([data-state='active'])]:hover:text-foreground"
            >
              <DoorOpen className="h-4 w-4 mr-2" />
              Doors
            </Button>
            <Button
              variant={placementMode === "window" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setPlacementMode("window");
                setSelectedRoomId(null);
                setIsDrawing(false);
                setCurrentRect(null);
                cancelPolygon();
              }}
              className="text-xs w-full justify-start transition-all hover:translate-x-1 hover:shadow-sm [&:not([data-state='active'])]:hover:text-foreground"
            >
              <RectangleHorizontal className="h-4 w-4 mr-2" />
              Windows
            </Button>
          </div>
        </Card>

        {placementMode === "room" && (
          <>
            <Card className="p-4 space-y-4 shadow-md transition-shadow hover:shadow-lg">
              {/* Draw Mode Selector */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">Room Shape:</Label>
                <div className="flex flex-col gap-2">
                  <Button
                    variant={drawMode === "rectangle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setDrawMode("rectangle");
                      cancelPolygon();
                    }}
                    className={cn(
                      "text-xs w-full justify-start transition-all hover:translate-x-1 hover:shadow-sm",
                      drawMode !== "rectangle" && "hover:text-foreground"
                    )}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Simple Rectangle <span className="ml-auto text-[10px] text-muted-foreground">(Easy)</span>
                  </Button>
                  <Button
                    variant={drawMode === "polygon" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setDrawMode("polygon");
                      setIsDrawing(false);
                      setCurrentRect(null);
                    }}
                    className={cn(
                      "text-xs w-full justify-start transition-all hover:translate-x-1 hover:shadow-sm",
                      drawMode !== "polygon" && "hover:text-foreground"
                    )}
                  >
                    <Pentagon className="h-4 w-4 mr-2" />
                    Custom Shape <span className="ml-auto text-[10px] text-muted-foreground">(Advanced)</span>
                  </Button>
                </div>
                {drawMode === "polygon" && isDrawing && (
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={completePolygon}
                      disabled={polygonPoints.length < 3}
                      className="text-xs w-full"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Complete ({polygonPoints.length} points)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelPolygon}
                      className="text-xs w-full hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-2">
                  {drawMode === "rectangle"
                    ? "Click and drag on the canvas to draw a rectangular room."
                    : "Click on the canvas to add points. Click Complete when done (minimum 3 points for L-shapes)."}
                </p>
              </div>
            </Card>

            {/* Room Type Selector */}
            <Card className="p-4 space-y-3 shadow-md transition-shadow hover:shadow-lg">
              <Label className="text-sm font-semibold text-foreground">Choose Room Type:</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ROOM_CONFIGS) as RoomType[]).map((type) => (
                  <Button
                    key={type}
                    variant={selectedRoomType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRoomType(type)}
                    className={cn(
                      "text-xs justify-start transition-all hover:scale-105 hover:shadow-sm",
                      selectedRoomType !== type && "hover:text-foreground"
                    )}
                    title={`${ROOM_CONFIGS[type].label} - ${ROOM_SIZE_HINTS[type].description}`}
                  >
                    <span className="mr-2">{ROOM_CONFIGS[type].icon}</span>
                    {ROOM_CONFIGS[type].label}
                  </Button>
                ))}
              </div>
              {selectedRoomType && (
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  💡 <strong>{ROOM_CONFIGS[selectedRoomType].label}:</strong> {ROOM_SIZE_HINTS[selectedRoomType].description}
                  <br />
                  <span className="text-[10px]">Recommended: {ROOM_SIZE_HINTS[selectedRoomType].recommended} sq ft</span>
                </p>
              )}
            </Card>
          </>
        )}

        {placementMode === "door" && (
          <Card className="p-4 space-y-3 shadow-md transition-shadow hover:shadow-lg">
            <Label className="text-sm font-semibold text-foreground">Choose Connection Type:</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(DOOR_CONFIGS) as DoorType[]).map((type) => (
                <Button
                  key={type}
                  variant={selectedDoorType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDoorType(type)}
                  className={cn(
                    "text-xs justify-start transition-all hover:scale-105 hover:shadow-sm",
                    selectedDoorType !== type && "hover:text-foreground"
                  )}
                  title={DOOR_CONFIGS[type].description}
                >
                  <span className="mr-2">{DOOR_CONFIGS[type].icon}</span>
                  {DOOR_CONFIGS[type].label}
                </Button>
              ))}
            </div>
            {selectedDoorType && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                <strong>{DOOR_CONFIGS[selectedDoorType].label}:</strong> {DOOR_CONFIGS[selectedDoorType].description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              💡 Click on canvas to place. Use <strong>Open Passage</strong> for kitchen to dining, living to hallway, etc.
            </p>
          </Card>
        )}

        {placementMode === "window" && (
          <Card className="p-4 space-y-3 shadow-md transition-shadow hover:shadow-lg">
            <Label className="text-sm font-semibold text-foreground">Window Type:</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(WINDOW_CONFIGS) as WindowType[]).map((type) => (
                <Button
                  key={type}
                  variant={selectedWindowType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedWindowType(type)}
                  className={cn(
                    "text-xs justify-start transition-all hover:scale-105 hover:shadow-sm",
                    selectedWindowType !== type && "hover:text-foreground"
                  )}
                >
                  <span className="mr-2">{WINDOW_CONFIGS[type].icon}</span>
                  {WINDOW_CONFIGS[type].label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Click on the canvas to place a window. Windows snap to grid.
            </p>
          </Card>
        )}

        {/* Your ADU at a Glance */}
        <Card className="p-4 space-y-3 border-accent-top shadow-md bg-gradient-to-br from-surface to-surface-secondary">
          <Label className="text-sm font-semibold text-foreground">Your ADU at a Glance</Label>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-2 bg-surface rounded-md border">
              <span className="text-sm text-muted-foreground font-medium">Total Size:</span>
              <span className={cn(
                "text-sm font-bold px-2 py-1 rounded",
                totalArea >= ADU_LIMITS.MIN_AREA && totalArea <= ADU_LIMITS.MAX_AREA
                  ? "text-green-700 bg-green-50"
                  : "text-destructive bg-red-50"
              )}>
                {totalArea} sq ft
              </span>
            </div>
            {totalArea > 0 && (
              <p className="text-xs text-muted-foreground italic px-2">
                📐 About the size of a {getSizeComparison(totalArea)}
              </p>
            )}
            <div className="flex items-center gap-3 text-sm flex-wrap px-2">
              <span className="font-medium">{rooms.filter(r => r.type === "bedroom").length} 🛏️</span>
              <span className="font-medium">{rooms.filter(r => r.type === "bathroom").length} 🚿</span>
              <span className="font-medium">{rooms.filter(r => r.type === "kitchen").length} 🍳</span>
              <span className="text-muted-foreground text-xs">• {doors.length} doors • {windows.length} windows</span>
            </div>
          </div>

          {/* Validation Warnings */}
          {validationIssues.length > 0 && (
            <div className="pt-3 border-t space-y-2">
              <Label className="text-xs font-medium text-destructive">⚠️ Important</Label>
              {validationIssues.map((issue, index) => (
                <p key={index} className="text-xs text-destructive">
                  • {issue}
                </p>
              ))}
            </div>
          )}

          {/* Room Size Hints */}
          {undersizedRooms.length > 0 && (
            <div className="pt-3 border-t space-y-2">
              <Label className="text-xs font-medium text-amber-600">💡 Suggestions</Label>
              {undersizedRooms.map((room) => {
                const hint = ROOM_SIZE_HINTS[room.type];
                return (
                  <p key={room.id} className="text-xs text-amber-600">
                    • {room.name} is small ({room.area} sq ft). {hint.description}
                  </p>
                );
              })}
            </div>
          )}

          {/* Success Message */}
          {validationIssues.length === 0 && undersizedRooms.length === 0 && rooms.length > 0 && (
            <div className="pt-3 border-t">
              <p className="text-xs text-green-600 flex items-center gap-2">
                ✅ <span>Your design looks great!</span>
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
          <Card className="p-3 space-y-2 shadow-md bg-surface-secondary">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">Tools</Label>
              <Button
                variant={isCanvasLocked ? "default" : "outline"}
                size="sm"
                onClick={() => setIsCanvasLocked(!isCanvasLocked)}
                className="text-[10px] h-6 px-2 transition-all hover:scale-105"
              >
                {isCanvasLocked ? "🔒 Locked" : "🔓 Unlocked"}
              </Button>
            </div>
            {/* Undo/Redo Row */}
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
                className="text-xs h-8 px-2 hover:text-foreground"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="text-xs h-8 px-2 hover:text-foreground"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-3.5 w-3.5 mr-1" />
                Redo
              </Button>
            </div>
            {/* View Controls Row */}
            <div className="grid grid-cols-4 gap-1.5">
              <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={isCanvasLocked} className="text-xs h-8 px-2 hover:text-foreground" title="Zoom In">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={isCanvasLocked} className="text-xs h-8 px-2 hover:text-foreground" title="Zoom Out">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={resetView} className="text-[10px] h-8 px-2 hover:text-foreground" title="Reset View">
                Reset
              </Button>
              <Button
                variant={showGrid ? "default" : "outline"}
                size="sm"
                onClick={() => setShowGrid(!showGrid)}
                className={cn(
                  "text-xs h-8 px-2",
                  !showGrid && "hover:text-foreground"
                )}
                title="Toggle Grid"
              >
                <Grid3x3 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {/* Rotate Controls - shown when item is selected */}
            {(selectedRoomId || selectedDoorId || selectedWindowId) && (
              <div className="pt-2 border-t">
                {selectedRoomId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rotateSelectedRoom}
                    className="w-full text-[10px] h-7 hover:text-foreground"
                  >
                    <RotateCw className="h-3 w-3 mr-1" />
                    Rotate Room 90°
                  </Button>
                )}
                {selectedDoorId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rotateSelectedDoor}
                    className="w-full text-[10px] h-7 hover:text-foreground"
                  >
                    <RotateCw className="h-3 w-3 mr-1" />
                    Rotate Door 90°
                  </Button>
                )}
                {selectedWindowId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rotateSelectedWindow}
                    className="w-full text-[10px] h-7 hover:text-foreground"
                  >
                    <RotateCw className="h-3 w-3 mr-1" />
                    Rotate Window 90°
                  </Button>
                )}
                {selectedFurnitureId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rotateSelectedFurniture}
                    className="w-full text-[10px] h-7 hover:text-foreground"
                  >
                    <RotateCw className="h-3 w-3 mr-1" />
                    Rotate Furniture 90°
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* ADU Lot Size Editor */}
          <Card className="p-3 shadow-md bg-surface-secondary">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Maximize2 className="h-3 w-3" />
                Your Lot Size
              </Label>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded",
                aduArea >= ADU_LIMITS.MIN_AREA && aduArea <= ADU_LIMITS.MAX_AREA
                  ? "text-green-700 bg-green-50"
                  : "text-destructive bg-red-50"
              )}>
                {Math.round(aduArea)} sq ft
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground mb-2">
              This is the total space your ADU can take up
            </p>

            {/* 2-Column Layout: Edit Button | Slider */}
            <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
              {/* Left Column: Edit Shape Button */}
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant={editBoundaryMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setEditBoundaryMode(!editBoundaryMode);
                    setSelectedRoomId(null);
                    setSelectedBoundaryPointIndex(null);
                  }}
                  className={cn(
                    "text-[10px] h-7 px-2 whitespace-nowrap",
                    !editBoundaryMode && "hover:text-foreground"
                  )}
                >
                  {editBoundaryMode ? "Exit Edit" : "Edit Shape"}
                </Button>
                <div className="text-[9px] text-muted-foreground">
                  {aduBoundary.length} pts
                </div>
              </div>

              {/* Right Column: Slider */}
              <div className="space-y-1">
                <Slider
                  value={[Math.sqrt(aduArea)]}
                  onValueChange={([value]) => {
                    // Calculate new square size
                    const targetArea = value * value;
                    const sideLengthPx = Math.sqrt(targetArea) * pixelsPerFoot;
                    const offset = (displaySize - sideLengthPx) / 2;

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
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>{ADU_LIMITS.MIN_AREA} sq ft</span>
                  <span>{ADU_LIMITS.MAX_AREA} sq ft</span>
                </div>
              </div>
            </div>

            {/* Edit Mode Instructions */}
            {editBoundaryMode && (
              <p className="text-[9px] text-muted-foreground leading-tight mt-2">
                <strong>Click</strong> to add • <strong>Drag</strong> to move • <strong>Right-click</strong> to delete
                {selectedBoundaryPointIndex !== null && <span className="text-primary"> • Point {selectedBoundaryPointIndex + 1} selected</span>}
              </p>
            )}

            {/* Validation Message */}
            {(aduArea < ADU_LIMITS.MIN_AREA || aduArea > ADU_LIMITS.MAX_AREA) && (
              <p className="text-[9px] text-destructive mt-2">
                {aduArea < ADU_LIMITS.MIN_AREA
                  ? `Min ${ADU_LIMITS.MIN_AREA} sq ft`
                  : `Max ${ADU_LIMITS.MAX_AREA} sq ft`}
              </p>
            )}
          </Card>
        </div>

      <Card className="p-0 overflow-hidden flex items-center justify-center shadow-xl border-2">
        <div className="bg-white p-4">
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
            onMouseUp={(e) => {
              handlePanEnd();
              if (!isPanning) handleMouseUp();
            }}
            className={editBoundaryMode ? "cursor-pointer" : isPanning ? "cursor-grabbing" : placementMode === "select" ? "cursor-default" : "cursor-crosshair"}
          >
            <Layer>
              {/* Grid - Architectural standard: every 5th line darker for easy counting */}
              {showGrid &&
                Array.from({ length: maxCanvasFeet + 1 }).map((_, i) => {
                  const pos = i * gridSize;
                  const isMajorGridLine = i % 5 === 0;  // Every 5 feet is major
                  return (
                    <Line
                      key={`v-${i}`}
                      points={[pos, 0, pos, displaySize]}
                      stroke={isMajorGridLine ? "#c0c0c0" : GRID_CONFIG.GRID_COLOR}
                      strokeWidth={isMajorGridLine ? 1.5 / zoom : 1 / zoom}
                      opacity={isMajorGridLine ? 0.6 : 0.3}
                      perfectDrawEnabled={false}
                      listening={false}
                    />
                  );
                })}
              {showGrid &&
                Array.from({ length: maxCanvasFeet + 1 }).map((_, i) => {
                  const pos = i * gridSize;
                  const isMajorGridLine = i % 5 === 0;
                  return (
                    <Line
                      key={`h-${i}`}
                      points={[0, pos, displaySize, pos]}
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

              <Text
                x={10}
                y={10}
                text={`ADU Area: ${Math.round(aduArea)} sq ft`}
                fontSize={14 / zoom}
                fill="#961818"
                fontStyle="bold"
                listening={false}
              />

              {/* Existing Rooms */}
              {rooms.map((room) => {
                const isRectangle = room.vertices.length === 4;
                const isSelected = selectedRoomId === room.id;
                const effectiveArea = calculateEffectiveArea(room);
                const isNested = effectiveArea !== room.area;

                if (isRectangle) {
                  // Render as Rect for rectangular rooms
                  const width = room.vertices[1].x - room.vertices[0].x;
                  const height = room.vertices[2].y - room.vertices[0].y;

                  return (
                    <Group key={room.id}>
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
                        stroke={isSelected ? "#961818" : "#444"}
                        strokeWidth={isSelected ? 4 / zoom : 3 / zoom}
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
                      <Text
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
                    </Group>
                  );
                } else {
                  // Render as Line (polygon) for L-shapes and custom polygons
                  const points = room.vertices.flatMap(v => [v.x, v.y]);
                  const centroid = {
                    x: room.vertices.reduce((sum, v) => sum + v.x, 0) / room.vertices.length,
                    y: room.vertices.reduce((sum, v) => sum + v.y, 0) / room.vertices.length,
                  };

                  return (
                    <Group key={room.id}>
                      <Line
                        id={room.id}
                        points={points}
                        fill={room.color}
                        stroke={isSelected ? "#961818" : "#444"}
                        strokeWidth={isSelected ? 4 / zoom : 3 / zoom}
                        closed={true}
                        onClick={() => handleRoomClick(room.id)}
                        onTap={() => handleRoomClick(room.id)}
                        shadowColor={isSelected ? "#961818" : undefined}
                        shadowBlur={isSelected ? 10 : 0}
                        shadowOpacity={isSelected ? 0.3 : 0}
                        perfectDrawEnabled={false}
                      />
                      <Text
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

                      {/* Vertex handles (only when selected) */}
                      {isSelected && room.vertices.map((vertex, vIndex) => (
                        <Circle
                          key={`vertex-${room.id}-${vIndex}`}
                          x={vertex.x}
                          y={vertex.y}
                          radius={6 / zoom}
                          fill="#961818"
                          stroke="#ffffff"
                          strokeWidth={2 / zoom}
                          draggable={true}
                          dragBoundFunc={(pos) => {
                            const snapped = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
                            return constrainToCanvas(snapped);
                          }}
                          onDragMove={(e) => {
                            const newPos = { x: e.target.x(), y: e.target.y() };
                            const newVertices = [...room.vertices];
                            newVertices[vIndex] = newPos;

                            // Update room with new vertices
                            const newArea = calculatePolygonArea(newVertices);
                            setRooms(rooms.map(r =>
                              r.id === room.id
                                ? { ...r, vertices: newVertices, area: Math.round(newArea) }
                                : r
                            ));
                          }}
                        />
                      ))}

                      {/* Midpoint handles (only when selected) */}
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
                            radius={5 / zoom}
                            fill="#ffffff"
                            stroke="#961818"
                            strokeWidth={2 / zoom}
                            draggable={true}
                            dragBoundFunc={(pos) => {
                              const snapped = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
                              return constrainToCanvas(snapped);
                            }}
                            onDragStart={() => {
                              // Insert a new vertex at this midpoint
                              const newVertices = [...room.vertices];
                              newVertices.splice(vIndex + 1, 0, midpoint);
                              const newArea = calculatePolygonArea(newVertices);
                              setRooms(rooms.map(r =>
                                r.id === room.id
                                  ? { ...r, vertices: newVertices, area: Math.round(newArea) }
                                  : r
                              ));
                            }}
                            onDragMove={(e) => {
                              const newPos = { x: e.target.x(), y: e.target.y() };
                              // Update the newly created vertex (which is now at vIndex + 1)
                              const newVertices = [...room.vertices];
                              newVertices[vIndex + 1] = newPos;
                              const newArea = calculatePolygonArea(newVertices);
                              setRooms(rooms.map(r =>
                                r.id === room.id
                                  ? { ...r, vertices: newVertices, area: Math.round(newArea) }
                                  : r
                              ));
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
                  {/* Vertex circles */}
                  {polygonPoints.map((point, i) => (
                    <Circle
                      key={i}
                      x={point.x}
                      y={point.y}
                      radius={5 / zoom}
                      fill="#961818"
                      stroke="#ffffff"
                      strokeWidth={1 / zoom}
                      listening={false}
                    />
                  ))}
                </>
              )}

              {/* Doors */}
              {doors.map((door) => {
                const isSelected = selectedDoorId === door.id;
                const doorWidthPx = door.width * pixelsPerFoot;
                const doorThicknessPx = gridSize / 8;
                const isOpening = door.type === "opening";

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
                        // Vertical: snap top/bottom edges to grid, center X to grid line
                        const snappedTopEdge = snapToGrid(pos.y - doorWidth / 2);
                        const snappedCenterY = snappedTopEdge + doorWidth / 2;
                        const snappedCenterX = snapToGrid(pos.x);
                        return constrainToCanvas({ x: snappedCenterX, y: snappedCenterY });
                      } else {
                        // Horizontal: snap left/right edges to grid, center Y to grid line
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
                      y={isOpening ? -gridSize / 4 : -doorWidthPx / 2}
                      width={doorWidthPx}
                      height={isOpening ? gridSize / 2 : doorWidthPx}
                      fill="transparent"
                    />

                    {isOpening ? (
                      /* Open Passage - No door, just gap indicator */
                      <>
                        {/* Dashed lines to show opening */}
                        <Line
                          ref={(node) => {
                            if (node && isSelected) {
                              doorRefs.current.set(door.id, node.getParent());
                            }
                          }}
                          points={[-doorWidthPx / 2, 0, doorWidthPx / 2, 0]}
                          stroke={isSelected ? "#961818" : "#999"}
                          strokeWidth={2 / zoom}
                          dash={[6 / zoom, 4 / zoom]}
                          lineCap="round"
                          listening={false}
                        />
                        {/* "OPEN" text label */}
                        <Text
                          x={0}
                          y={-8 / zoom}
                          text="OPEN"
                          fontSize={10 / zoom}
                          fill={isSelected ? "#961818" : "#666"}
                          align="center"
                          offsetX={15 / zoom}
                          listening={false}
                        />
                      </>
                    ) : (
                      /* Regular Door */
                      <>
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
                      </>
                    )}
                  </Group>
                );
              })}

              {/* Windows */}
              {windows.map((window) => {
                const isSelected = selectedWindowId === window.id;
                const windowWidthPx = window.width * pixelsPerFoot;
                const windowThicknessPx = gridSize / 6; // Window thickness

                return (
                  <Group
                    key={window.id}
                    x={window.position.x}
                    y={window.position.y}
                    rotation={window.rotation}
                    draggable={!editBoundaryMode}
                    dragBoundFunc={(pos) => {
                      const windowWidth = window.width * pixelsPerFoot;
                      const isVertical = window.rotation % 180 === 90;

                      if (isVertical) {
                        // Vertical: snap top/bottom edges to grid, center X to grid line
                        const snappedTopEdge = snapToGrid(pos.y - windowWidth / 2);
                        const snappedCenterY = snappedTopEdge + windowWidth / 2;
                        const snappedCenterX = snapToGrid(pos.x);
                        return constrainToCanvas({ x: snappedCenterX, y: snappedCenterY });
                      } else {
                        // Horizontal: snap left/right edges to grid, center Y to grid line
                        const snappedLeftEdge = snapToGrid(pos.x - windowWidth / 2);
                        const snappedCenterX = snappedLeftEdge + windowWidth / 2;
                        const snappedCenterY = snapToGrid(pos.y);
                        return constrainToCanvas({ x: snappedCenterX, y: snappedCenterY });
                      }
                    }}
                    onDragEnd={(e) => {
                      const group = e.target;
                      const windowWidth = window.width * pixelsPerFoot;
                      const isVertical = window.rotation % 180 === 90;

                      let newX, newY;
                      if (isVertical) {
                        const snappedTopEdge = snapToGrid(group.y() - windowWidth / 2);
                        newY = snappedTopEdge + windowWidth / 2;
                        newX = snapToGrid(group.x());
                      } else {
                        const snappedLeftEdge = snapToGrid(group.x() - windowWidth / 2);
                        newX = snappedLeftEdge + windowWidth / 2;
                        newY = snapToGrid(group.y());
                      }
                      setWindows(windows.map(w => w.id === window.id ? { ...w, position: { x: newX, y: newY } } : w));
                    }}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      setSelectedWindowId(window.id);
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true;
                      setSelectedWindowId(window.id);
                    }}
                  >
                    {/* Hit area for interaction */}
                    <Rect
                      x={-windowWidthPx / 2 - 5}
                      y={-windowThicknessPx / 2 - 5}
                      width={windowWidthPx + 10}
                      height={windowThicknessPx + 10}
                      fill="transparent"
                    />

                    {/* Window frame */}
                    <Rect
                      x={-windowWidthPx / 2}
                      y={-windowThicknessPx / 2}
                      width={windowWidthPx}
                      height={windowThicknessPx}
                      fill={isSelected ? "#961818" : "#4682B4"}
                      stroke={isSelected ? "#961818" : "#2C5282"}
                      strokeWidth={1 / zoom}
                      listening={false}
                    />

                    {/* Window panes (parallel lines) */}
                    <Line
                      points={[-windowWidthPx / 2 + 4, -windowThicknessPx / 2, -windowWidthPx / 2 + 4, windowThicknessPx / 2]}
                      stroke="#ffffff"
                      strokeWidth={1 / zoom}
                      listening={false}
                    />
                    <Line
                      points={[windowWidthPx / 2 - 4, -windowThicknessPx / 2, windowWidthPx / 2 - 4, windowThicknessPx / 2]}
                      stroke="#ffffff"
                      strokeWidth={1 / zoom}
                      listening={false}
                    />

                    {/* Glass indicator (lighter fill) */}
                    <Rect
                      ref={(node) => {
                        if (node && isSelected) {
                          windowRefs.current.set(window.id, node.getParent());
                        }
                      }}
                      x={-windowWidthPx / 2 + 2}
                      y={-windowThicknessPx / 2 + 2}
                      width={windowWidthPx - 4}
                      height={windowThicknessPx - 4}
                      fill="#B0E0E6"
                      opacity={0.5}
                      listening={false}
                    />
                  </Group>
                );
              })}

              {/* Furniture */}
              {furniture.map((item) => {
                const isSelected = selectedFurnitureId === item.id;
                const config = FURNITURE_CONFIG[item.type];
                const furnitureWidthPx = item.width * pixelsPerFoot;
                const furnitureHeightPx = item.height * pixelsPerFoot;

                return (
                  <Group
                    key={item.id}
                    x={item.position.x}
                    y={item.position.y}
                    rotation={item.rotation}
                    draggable={!editBoundaryMode}
                    dragBoundFunc={(pos) => {
                      const snappedX = snapToGrid(pos.x);
                      const snappedY = snapToGrid(pos.y);
                      return constrainToCanvas({ x: snappedX, y: snappedY });
                    }}
                    onDragEnd={(e) => {
                      const group = e.target;
                      const newX = snapToGrid(group.x());
                      const newY = snapToGrid(group.y());
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
                    {/* Base rectangle for all furniture */}
                    <Rect
                      x={-furnitureWidthPx / 2}
                      y={-furnitureHeightPx / 2}
                      width={furnitureWidthPx}
                      height={furnitureHeightPx}
                      fill={isSelected ? "#961818" : "#e5e5e5"}
                      stroke={isSelected ? "#961818" : "#737373"}
                      strokeWidth={2 / zoom}
                      cornerRadius={2 / zoom}
                    />

                    {/* Type-specific details */}
                    {/* Beds - with pillow indicator */}
                    {(item.type === "bed-double" || item.type === "bed-single") && (
                      <>
                        <Rect
                          x={-furnitureWidthPx / 2 + 3}
                          y={-furnitureHeightPx / 2 + 3}
                          width={furnitureWidthPx - 6}
                          height={furnitureHeightPx * 0.25}
                          fill="#ffffff"
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                        />
                      </>
                    )}

                    {/* Sofas - with cushion lines */}
                    {(item.type === "sofa-3seat" || item.type === "sofa-2seat") && (
                      <>
                        <Line
                          points={[
                            -furnitureWidthPx / 2 + furnitureWidthPx * 0.33, -furnitureHeightPx / 2 + 5,
                            -furnitureWidthPx / 2 + furnitureWidthPx * 0.33, furnitureHeightPx / 2 - 5,
                          ]}
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                        />
                        <Line
                          points={[
                            -furnitureWidthPx / 2 + furnitureWidthPx * 0.66, -furnitureHeightPx / 2 + 5,
                            -furnitureWidthPx / 2 + furnitureWidthPx * 0.66, furnitureHeightPx / 2 - 5,
                          ]}
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                        />
                      </>
                    )}

                    {/* Toilet - with bowl circle */}
                    {item.type === "toilet" && (
                      <>
                        <Circle
                          x={0}
                          y={furnitureHeightPx * 0.15}
                          radius={Math.min(furnitureWidthPx, furnitureHeightPx) * 0.3}
                          fill="#ffffff"
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                        />
                        <Rect
                          x={-furnitureWidthPx * 0.3}
                          y={-furnitureHeightPx / 2 + 5}
                          width={furnitureWidthPx * 0.6}
                          height={furnitureHeightPx * 0.25}
                          fill="#ffffff"
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                        />
                      </>
                    )}

                    {/* Sink - with basin circle */}
                    {item.type === "sink" && (
                      <Circle
                        x={0}
                        y={0}
                        radius={Math.min(furnitureWidthPx, furnitureHeightPx) * 0.3}
                        fill="#B0E0E6"
                        stroke="#737373"
                        strokeWidth={1 / zoom}
                        listening={false}
                      />
                    )}

                    {/* Shower - with corner drain */}
                    {item.type === "shower" && (
                      <>
                        <Rect
                          x={-furnitureWidthPx / 2 + 3}
                          y={-furnitureHeightPx / 2 + 3}
                          width={furnitureWidthPx - 6}
                          height={furnitureHeightPx - 6}
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                          fill="transparent"
                        />
                        <Circle
                          x={furnitureWidthPx / 2 - 10}
                          y={furnitureHeightPx / 2 - 10}
                          radius={3 / zoom}
                          fill="#737373"
                          listening={false}
                        />
                      </>
                    )}

                    {/* Bathtub - with oval shape */}
                    {item.type === "bathtub" && (
                      <Rect
                        x={-furnitureWidthPx / 2 + 5}
                        y={-furnitureHeightPx / 2 + 5}
                        width={furnitureWidthPx - 10}
                        height={furnitureHeightPx - 10}
                        fill="#B0E0E6"
                        stroke="#737373"
                        strokeWidth={1 / zoom}
                        cornerRadius={furnitureHeightPx / 4}
                        listening={false}
                        opacity={0.5}
                      />
                    )}

                    {/* Stove - with burners */}
                    {item.type === "stove" && (
                      <>
                        <Circle
                          x={-furnitureWidthPx * 0.25}
                          y={-furnitureHeightPx * 0.25}
                          radius={8 / zoom}
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                          fill="transparent"
                        />
                        <Circle
                          x={furnitureWidthPx * 0.25}
                          y={-furnitureHeightPx * 0.25}
                          radius={8 / zoom}
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                          fill="transparent"
                        />
                        <Circle
                          x={-furnitureWidthPx * 0.25}
                          y={furnitureHeightPx * 0.25}
                          radius={8 / zoom}
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                          fill="transparent"
                        />
                        <Circle
                          x={furnitureWidthPx * 0.25}
                          y={furnitureHeightPx * 0.25}
                          radius={8 / zoom}
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                          fill="transparent"
                        />
                      </>
                    )}

                    {/* Refrigerator - with door line */}
                    {item.type === "refrigerator" && (
                      <Line
                        points={[
                          0, -furnitureHeightPx / 2 + 5,
                          0, furnitureHeightPx / 2 - 5,
                        ]}
                        stroke="#737373"
                        strokeWidth={1 / zoom}
                        listening={false}
                      />
                    )}

                    {/* Tables - with cross pattern */}
                    {(item.type === "table-dining" || item.type === "table-coffee") && (
                      <>
                        <Line
                          points={[
                            -furnitureWidthPx / 2 + 10, -furnitureHeightPx / 2 + 10,
                            furnitureWidthPx / 2 - 10, furnitureHeightPx / 2 - 10,
                          ]}
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                          opacity={0.3}
                        />
                        <Line
                          points={[
                            furnitureWidthPx / 2 - 10, -furnitureHeightPx / 2 + 10,
                            -furnitureWidthPx / 2 + 10, furnitureHeightPx / 2 - 10,
                          ]}
                          stroke="#737373"
                          strokeWidth={1 / zoom}
                          listening={false}
                          opacity={0.3}
                        />
                      </>
                    )}

                    {/* Label */}
                    <Text
                      x={-furnitureWidthPx / 2}
                      y={0}
                      width={furnitureWidthPx}
                      text={config.name}
                      fontSize={10 / zoom}
                      fontFamily="Montserrat"
                      fill={isSelected ? "#ffffff" : "#404040"}
                      align="center"
                      verticalAlign="middle"
                      listening={false}
                    />
                  </Group>
                );
              })}
            </Layer>

            {/* Window Transformer Layer */}
            <Layer>
              {selectedWindowId && (
                <Transformer
                  ref={windowTransformerRef}
                  enabledAnchors={['middle-left', 'middle-right']}
                  rotateEnabled={false}
                  ignoreStroke={true}
                  keepRatio={false}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Get the current window to know its position
                    const currentWindow = windows.find(w => w.id === selectedWindowId);
                    if (!currentWindow) return oldBox;

                    // Calculate new width in pixels from the scaled box
                    const scale = newBox.width / oldBox.width;
                    const newWidthPx = currentWindow.width * pixelsPerFoot * scale;

                    // Snap to whole feet (minimum 1 foot)
                    const newWidthFeet = Math.max(1, Math.round(newWidthPx / pixelsPerFoot));
                    const snappedWidthPx = newWidthFeet * pixelsPerFoot;

                    // Only allow width to change, keep everything else the same
                    return {
                      x: oldBox.x,
                      y: oldBox.y,
                      width: snappedWidthPx,
                      height: oldBox.height,
                      rotation: oldBox.rotation,
                    };
                  }}
                  onTransformEnd={() => {
                    const node = windowRefs.current.get(selectedWindowId!);
                    if (node) {
                      const currentWindow = windows.find(w => w.id === selectedWindowId);
                      if (currentWindow) {
                        // Calculate final width from transform
                        const scaleX = node.scaleX();
                        const newWidthPx = currentWindow.width * pixelsPerFoot * scaleX;
                        const newWidthFeet = Math.max(1, Math.round(newWidthPx / pixelsPerFoot));
                        const windowWidthPx = newWidthFeet * pixelsPerFoot;

                        const isVertical = currentWindow.rotation % 180 === 90;
                        let snappedX, snappedY;

                        if (isVertical) {
                          // Vertical: snap top/bottom edges to grid, center X to grid line
                          const snappedTopEdge = snapToGrid(node.y() - windowWidthPx / 2);
                          snappedY = snappedTopEdge + windowWidthPx / 2;
                          snappedX = snapToGrid(node.x());
                        } else {
                          // Horizontal: snap left/right edges to grid, center Y to grid line
                          const snappedLeftEdge = snapToGrid(node.x() - windowWidthPx / 2);
                          snappedX = snappedLeftEdge + windowWidthPx / 2;
                          snappedY = snapToGrid(node.y());
                        }

                        setWindows(prev => prev.map(w =>
                          w.id === selectedWindowId ? {
                            ...w,
                            width: newWidthFeet,
                            position: { x: snappedX, y: snappedY }
                          } : w
                        ));

                        // Update node position
                        node.position({ x: snappedX, y: snappedY });

                        // Reset transform
                        node.scaleX(1);
                        node.scaleY(1);

                        // Force transformer to update
                        if (windowTransformerRef.current) {
                          windowTransformerRef.current.forceUpdate();
                          windowTransformerRef.current.getLayer()?.batchDraw();
                        }
                      }
                    }
                  }}
                />
              )}
            </Layer>

            {/* Door/Opening Transformer Layer */}
            <Layer>
              {selectedDoorId && doors.find(d => d.id === selectedDoorId)?.type === 'opening' && (
                <Transformer
                  ref={doorTransformerRef}
                  enabledAnchors={['middle-left', 'middle-right']}
                  rotateEnabled={false}
                  ignoreStroke={true}
                  keepRatio={false}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Get the current opening to know its position
                    const currentDoor = doors.find(d => d.id === selectedDoorId);
                    if (!currentDoor) return oldBox;

                    // Calculate new width in pixels from the scaled box
                    const scale = newBox.width / oldBox.width;
                    const newWidthPx = currentDoor.width * pixelsPerFoot * scale;

                    // Snap to whole feet (minimum 2 feet for openings)
                    const newWidthFeet = Math.max(2, Math.round(newWidthPx / pixelsPerFoot));
                    const snappedWidthPx = newWidthFeet * pixelsPerFoot;

                    // Only allow width to change, keep everything else the same
                    return {
                      x: oldBox.x,
                      y: oldBox.y,
                      width: snappedWidthPx,
                      height: oldBox.height,
                      rotation: oldBox.rotation,
                    };
                  }}
                  onTransformEnd={() => {
                    const node = doorRefs.current.get(selectedDoorId!);
                    if (node) {
                      const currentDoor = doors.find(d => d.id === selectedDoorId);
                      if (currentDoor) {
                        // Calculate final width from transform
                        const scaleX = node.scaleX();
                        const newWidthPx = currentDoor.width * pixelsPerFoot * scaleX;
                        const newWidthFeet = Math.max(2, Math.round(newWidthPx / pixelsPerFoot));
                        const doorWidthPx = newWidthFeet * pixelsPerFoot;

                        const isVertical = currentDoor.rotation % 180 === 90;
                        let snappedX, snappedY;

                        if (isVertical) {
                          // Vertical: snap top/bottom edges to grid, center X to grid line
                          const snappedTopEdge = snapToGrid(node.y() - doorWidthPx / 2);
                          snappedY = snappedTopEdge + doorWidthPx / 2;
                          snappedX = snapToGrid(node.x());
                        } else {
                          // Horizontal: snap left/right edges to grid, center Y to grid line
                          const snappedLeftEdge = snapToGrid(node.x() - doorWidthPx / 2);
                          snappedX = snappedLeftEdge + doorWidthPx / 2;
                          snappedY = snapToGrid(node.y());
                        }

                        setDoors(prev => prev.map(d =>
                          d.id === selectedDoorId ? {
                            ...d,
                            width: newWidthFeet,
                            position: { x: snappedX, y: snappedY }
                          } : d
                        ));

                        // Update node position
                        node.position({ x: snappedX, y: snappedY });

                        // Reset transform
                        node.scaleX(1);
                        node.scaleY(1);

                        // Force transformer to update
                        if (doorTransformerRef.current) {
                          doorTransformerRef.current.forceUpdate();
                          doorTransformerRef.current.getLayer()?.batchDraw();
                        }
                      }
                    }
                  }}
                />
              )}
            </Layer>

            {/* Transformer Layer for resizing */}
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

                    // Minimum size check
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
                />
              </Layer>
            )}

            {/* Scale Indicator and North Arrow - Architectural Standard */}
            <Layer>
              {/* Scale Indicator - Bottom Left */}
              <Group x={20 / zoom} y={displaySize - 60 / zoom}>
                {/* Scale bar background */}
                <Rect
                  x={0}
                  y={0}
                  width={120 / zoom}
                  height={50 / zoom}
                  fill="white"
                  opacity={0.9}
                  cornerRadius={4 / zoom}
                  shadowColor="black"
                  shadowBlur={4 / zoom}
                  shadowOpacity={0.1}
                  listening={false}
                />

                {/* Scale text */}
                <Text
                  x={10 / zoom}
                  y={8 / zoom}
                  text="SCALE"
                  fontSize={9 / zoom}
                  fill="#666"
                  fontStyle="bold"
                  listening={false}
                />

                {/* Scale bar - 5 feet */}
                <Line
                  points={[10 / zoom, 30 / zoom, 110 / zoom, 30 / zoom]}
                  stroke="#444"
                  strokeWidth={2 / zoom}
                  listening={false}
                />
                <Line
                  points={[10 / zoom, 26 / zoom, 10 / zoom, 34 / zoom]}
                  stroke="#444"
                  strokeWidth={2 / zoom}
                  listening={false}
                />
                <Line
                  points={[110 / zoom, 26 / zoom, 110 / zoom, 34 / zoom]}
                  stroke="#444"
                  strokeWidth={2 / zoom}
                  listening={false}
                />

                {/* Scale dimension */}
                <Text
                  x={60 / zoom}
                  y={36 / zoom}
                  text={`5'-0"`}
                  fontSize={8 / zoom}
                  fill="#444"
                  align="center"
                  offsetX={15 / zoom}
                  listening={false}
                />
              </Group>

              {/* North Arrow - Top Right */}
              <Group x={displaySize - 60 / zoom} y={20 / zoom}>
                {/* Background circle */}
                <Circle
                  x={30 / zoom}
                  y={30 / zoom}
                  radius={28 / zoom}
                  fill="white"
                  opacity={0.9}
                  shadowColor="black"
                  shadowBlur={4 / zoom}
                  shadowOpacity={0.1}
                  listening={false}
                />

                {/* North arrow */}
                <Line
                  points={[
                    30 / zoom, 12 / zoom,  // Top point
                    38 / zoom, 38 / zoom,  // Right point
                    30 / zoom, 30 / zoom,  // Center
                    22 / zoom, 38 / zoom,  // Left point
                    30 / zoom, 12 / zoom   // Back to top
                  ]}
                  fill="#961818"
                  stroke="#444"
                  strokeWidth={1 / zoom}
                  closed={true}
                  listening={false}
                />

                {/* N label */}
                <Text
                  x={30 / zoom}
                  y={44 / zoom}
                  text="N"
                  fontSize={12 / zoom}
                  fill="#444"
                  fontStyle="bold"
                  align="center"
                  offsetX={4 / zoom}
                  listening={false}
                />
              </Group>
            </Layer>
          </Stage>
        </div>
      </Card>

      {/* Lists below canvas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Room List */}
        {rooms.length > 0 && (
          <Card className="p-4 space-y-3 shadow-md">
            <Label className="text-sm font-semibold text-foreground">Rooms ({rooms.length})</Label>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 hover:shadow-sm hover:scale-[1.02] transition-all cursor-pointer",
                    selectedRoomId === room.id && "ring-2 ring-primary shadow-md scale-[1.02]"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-6 h-6 rounded flex-shrink-0"
                      style={{ backgroundColor: room.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs truncate">{room.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(calculateEffectiveArea(room))} sq ft
                        {Math.round(calculateEffectiveArea(room)) !== room.area && (
                          <span className="text-[10px]"> ({room.area} total)</span>
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
                          className="h-6 text-xs mt-1"
                        />
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoom(room.id);
                    }}
                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Door List */}
        {doors.length > 0 && (
          <Card className="p-4 space-y-3 shadow-md">
            <Label className="text-sm font-semibold text-foreground">Doors ({doors.length})</Label>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {doors.map((door) => (
                <div
                  key={door.id}
                  onClick={() => setSelectedDoorId(door.id)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 hover:shadow-sm hover:scale-[1.02] transition-all cursor-pointer",
                    selectedDoorId === door.id && "ring-2 ring-primary shadow-md scale-[1.02]"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span>{DOOR_CONFIGS[door.type].icon}</span>
                    <div className="text-xs">
                      <div className="font-medium">{DOOR_CONFIGS[door.type].label}</div>
                      <div className="text-muted-foreground">{door.width}ft wide</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDoor(door.id);
                    }}
                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Window List */}
        {windows.length > 0 && (
          <Card className="p-4 space-y-3 shadow-md">
            <Label className="text-sm font-semibold text-foreground">Windows ({windows.length})</Label>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {windows.map((window) => (
                <div
                  key={window.id}
                  onClick={() => setSelectedWindowId(window.id)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 hover:shadow-sm hover:scale-[1.02] transition-all cursor-pointer",
                    selectedWindowId === window.id && "ring-2 ring-primary shadow-md scale-[1.02]"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span>{WINDOW_CONFIGS[window.type].icon}</span>
                    <div className="text-xs">
                      <div className="font-medium">{WINDOW_CONFIGS[window.type].label}</div>
                      <div className="text-muted-foreground">{window.width}×{window.height}ft</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWindow(window.id);
                    }}
                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Furniture Library */}
        <Card className="p-4 space-y-3 shadow-md">
          <Label className="text-sm font-semibold text-foreground">Furniture Library</Label>
          <div className="space-y-3">
            {/* Bedroom */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Bedroom</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(FURNITURE_CONFIG) as [FurnitureType, typeof FURNITURE_CONFIG[FurnitureType]][])
                  .filter(([, config]) => config.category === "bedroom")
                  .map(([type, config]) => (
                    <Button
                      key={type}
                      variant={selectedFurnitureType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFurnitureType(type)}
                      className="flex flex-col items-center gap-1 h-auto py-2"
                    >
                      <config.icon className="h-4 w-4" />
                      <span className="text-xs">{config.name}</span>
                    </Button>
                  ))}
              </div>
            </div>

            {/* Bathroom */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Bathroom</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(FURNITURE_CONFIG) as [FurnitureType, typeof FURNITURE_CONFIG[FurnitureType]][])
                  .filter(([, config]) => config.category === "bathroom")
                  .map(([type, config]) => (
                    <Button
                      key={type}
                      variant={selectedFurnitureType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFurnitureType(type)}
                      className="flex flex-col items-center gap-1 h-auto py-2"
                    >
                      <config.icon className="h-4 w-4" />
                      <span className="text-xs">{config.name}</span>
                    </Button>
                  ))}
              </div>
            </div>

            {/* Kitchen */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Kitchen</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(FURNITURE_CONFIG) as [FurnitureType, typeof FURNITURE_CONFIG[FurnitureType]][])
                  .filter(([_, config]) => config.category === "kitchen")
                  .map(([type, config]) => (
                    <Button
                      key={type}
                      variant={selectedFurnitureType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFurnitureType(type)}
                      className="flex flex-col items-center gap-1 h-auto py-2"
                    >
                      <config.icon className="h-4 w-4" />
                      <span className="text-xs">{config.name}</span>
                    </Button>
                  ))}
              </div>
            </div>

            {/* Living Room */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Living Room</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(FURNITURE_CONFIG) as [FurnitureType, typeof FURNITURE_CONFIG[FurnitureType]][])
                  .filter(([_, config]) => config.category === "living")
                  .map(([type, config]) => (
                    <Button
                      key={type}
                      variant={selectedFurnitureType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFurnitureType(type)}
                      className="flex flex-col items-center gap-1 h-auto py-2"
                    >
                      <config.icon className="h-4 w-4" />
                      <span className="text-xs">{config.name}</span>
                    </Button>
                  ))}
              </div>
            </div>

            {/* Office */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Office</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(FURNITURE_CONFIG) as [FurnitureType, typeof FURNITURE_CONFIG[FurnitureType]][])
                  .filter(([_, config]) => config.category === "office")
                  .map(([type, config]) => (
                    <Button
                      key={type}
                      variant={selectedFurnitureType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFurnitureType(type)}
                      className="flex flex-col items-center gap-1 h-auto py-2"
                    >
                      <config.icon className="h-4 w-4" />
                      <span className="text-xs">{config.name}</span>
                    </Button>
                  ))}
              </div>
            </div>

            {selectedFurnitureType && (
              <div className="text-xs text-muted-foreground p-2 bg-accent/50 rounded-md">
                Click on the canvas to place {FURNITURE_CONFIG[selectedFurnitureType].name}
              </div>
            )}
          </div>
        </Card>

        {/* Furniture List */}
        {furniture.length > 0 && (
          <Card className="p-4 space-y-3 shadow-md">
            <Label className="text-sm font-semibold text-foreground">Furniture ({furniture.length})</Label>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {furniture.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedFurnitureId(item.id)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 hover:shadow-sm hover:scale-[1.02] transition-all cursor-pointer",
                    selectedFurnitureId === item.id && "ring-2 ring-primary shadow-md scale-[1.02]"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {React.createElement(FURNITURE_CONFIG[item.type].icon, { className: "h-4 w-4" })}
                    <div className="text-xs">
                      <div className="font-medium">{FURNITURE_CONFIG[item.type].name}</div>
                      <div className="text-muted-foreground">{item.width}×{item.height}ft</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFurniture(item.id);
                    }}
                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
