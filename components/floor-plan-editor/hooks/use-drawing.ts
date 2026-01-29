import { useState, useCallback } from "react";
import type Konva from "konva";
import type { Room, RoomType, Point } from "@/lib/types";
import type { CanvasConfig } from "../types";
import { ROOM_CONFIGS } from "@/lib/constants";

type EntityType = "room" | "door" | "window" | "furniture" | "boundary";

interface UseDrawingOptions {
  config: CanvasConfig;
  drawMode: "rectangle" | "polygon";
  selectedRoomType: RoomType | null;
  rooms: Room[];
  stageToWorld: (point: Point) => Point;
  snapToGrid: (value: number) => number;
  onAddRoom: (room: Room) => void;
  logCreate?: (type: EntityType, id: string, data: Record<string, unknown>) => void;
}

export function useDrawing({
  config,
  drawMode,
  selectedRoomType,
  rooms,
  stageToWorld,
  snapToGrid,
  onAddRoom,
  logCreate,
}: UseDrawingOptions) {
  const { pixelsPerFoot } = config;

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);

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

  // Handle mouse down for drawing
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!selectedRoomType) return;

    const clickedOnEmpty = e.target === e.target.getStage();
    if (!clickedOnEmpty) return;

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
      const newPoint = { x, y };
      setPolygonPoints(prev => [...prev, newPoint]);
      if (!isDrawing) {
        setIsDrawing(true);
      }
    }
  }, [selectedRoomType, drawMode, stageToWorld, snapToGrid, isDrawing]);

  // Handle mouse move for rectangle drawing
  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !selectedRoomType || drawMode === "polygon" || !startPoint) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    const world = stageToWorld(pointerPosition);

    const x = snapToGrid(world.x);
    const y = snapToGrid(world.y);

    let width = x - startPoint.x;
    let height = y - startPoint.y;

    width = snapToGrid(Math.abs(width)) * (width >= 0 ? 1 : -1);
    height = snapToGrid(Math.abs(height)) * (height >= 0 ? 1 : -1);

    setCurrentRect({
      x: width > 0 ? startPoint.x : startPoint.x + width,
      y: height > 0 ? startPoint.y : startPoint.y + height,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  }, [isDrawing, selectedRoomType, drawMode, startPoint, stageToWorld, snapToGrid]);

  // Handle mouse up for rectangle drawing
  const handleMouseUp = useCallback(() => {
    if (drawMode === "polygon") return;

    if (!isDrawing || !currentRect || !selectedRoomType) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentRect(null);
      return;
    }

    const widthFeet = currentRect.width / pixelsPerFoot;
    const heightFeet = currentRect.height / pixelsPerFoot;
    const area = widthFeet * heightFeet;

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

      onAddRoom(newRoom);
      logCreate?.("room", newRoom.id, { type: newRoom.type, name: newRoom.name, vertices: newRoom.vertices, area: newRoom.area });
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentRect(null);
  }, [drawMode, isDrawing, currentRect, selectedRoomType, pixelsPerFoot, rooms, onAddRoom, logCreate]);

  // Complete polygon drawing
  const completePolygon = useCallback(() => {
    if (!selectedRoomType || polygonPoints.length < 3) {
      return false;
    }

    const area = calculatePolygonArea(polygonPoints);

    const newRoom: Room = {
      id: crypto.randomUUID(),
      type: selectedRoomType,
      name: `${ROOM_CONFIGS[selectedRoomType].label} ${rooms.filter((r) => r.type === selectedRoomType).length + 1}`,
      vertices: [...polygonPoints],
      area: Math.round(area),
      color: ROOM_CONFIGS[selectedRoomType].color,
    };

    onAddRoom(newRoom);
    logCreate?.("room", newRoom.id, { type: newRoom.type, name: newRoom.name, vertices: newRoom.vertices, area: newRoom.area });

    setIsDrawing(false);
    setPolygonPoints([]);
    return true;
  }, [selectedRoomType, polygonPoints, rooms, calculatePolygonArea, onAddRoom, logCreate]);

  // Cancel polygon drawing
  const cancelPolygon = useCallback(() => {
    setIsDrawing(false);
    setPolygonPoints([]);
  }, []);

  // Reset drawing state
  const resetDrawing = useCallback(() => {
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentRect(null);
    setPolygonPoints([]);
  }, []);

  return {
    isDrawing,
    currentRect,
    polygonPoints,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    completePolygon,
    cancelPolygon,
    resetDrawing,
    calculatePolygonArea,
  };
}
