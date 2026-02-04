"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { Stage, Layer } from "react-konva";
import type Konva from "konva";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Undo2, Redo2, Cloud, CloudOff, Loader2, RotateCcw, History } from "lucide-react";
import type { FloorPlan, Point, RoomType, DoorType, WindowType } from "@/lib/types";
import { DOOR_CONFIGS, WINDOW_CONFIGS } from "@/lib/constants";
import { useWizard } from "@/lib/context/wizard-context";
import { useActionLogger } from "@/lib/hooks/use-action-logger";

// Import modular components
import { useCanvasConfig, useFurnitureImages, useZoomPan, useDragDrop, useDrawing } from "./hooks";
import { Grid, ADUBoundary, Rooms, Doors, Windows, Furniture, DrawingPreview, CameraMarker } from "./canvas";
import { ModeSelector, RoomSelector, DoorSelector, WindowSelector, FurnitureSelector, FinishesPanel } from "./sidebar";
import { ADUAreaIndicator, Compass, CanvasControls } from "./overlay";
import { RoomList, DoorList, WindowList, FurnitureList } from "./lists";
import { ExportDialog } from "./export";
import { useFinishes } from "@/lib/api/hooks";
import type { CameraPlacement, RoomFinish, TemplateOption, TierOption } from "@/lib/api/client";
import type { Furniture as FurnitureItem, FurnitureType, PlacementMode } from "./types";
import { FURNITURE_CONFIG, MAX_HISTORY } from "./constants";

// Re-export types for external use
export type { FurnitureType, Furniture as FurnitureItem } from "./types";

interface FloorPlanEditorProps {
  onPlanChange: (plan: FloorPlan) => void;
}

export function FloorPlanEditor({ onPlanChange }: FloorPlanEditorProps) {
  // Wizard context for cloud save
  const { saveToCloud, isSaving, saveError, lastSavedAt, projectId, blueprintId } = useWizard();

  // Action logger for tracking all editor changes
  const { logMove, logResize, logRotate, logCreate, logDelete, logVertexMove } = useActionLogger({
    projectId,
    blueprintId,
    enabled: !!projectId,
  });

  // Finishes and 3D render management
  const {
    finishes,
    options: finishesOptions,
    renderStatus,
    loading: finishesLoading,
    rendering,
    loadFinishes,
    ensureFinishes,
    updateRoomFinish,
    updateCamera,
    applyTemplate,
    generateRender,
    updateFinishes,
  } = useFinishes(blueprintId ?? undefined);

  // Selected camera state for UI feedback
  const [isCameraSelected, setIsCameraSelected] = useState(false);

  // Canvas configuration
  const config = useCanvasConfig();
  const { pixelsPerFoot, gridSize, displaySize, extendedCanvasSize, extendedGridFeet } = config;

  // Load furniture images
  const furnitureImages = useFurnitureImages();

  // Calculate default boundary position
  const defaultBoundarySize = Math.sqrt(600) * pixelsPerFoot;
  const defaultOffset = (extendedCanvasSize - defaultBoundarySize) / 2;

  // Core state
  const [rooms, setRooms] = useState<FloorPlan["rooms"]>([]);
  const [doors, setDoors] = useState<FloorPlan["doors"]>([]);
  const [windows, setWindows] = useState<FloorPlan["windows"]>([]);
  const [furniture, setFurniture] = useState<FurnitureItem[]>([]);
  const [aduBoundary, setAduBoundary] = useState<Point[]>([
    { x: defaultOffset, y: defaultOffset },
    { x: defaultOffset + defaultBoundarySize, y: defaultOffset },
    { x: defaultOffset + defaultBoundarySize, y: defaultOffset + defaultBoundarySize },
    { x: defaultOffset, y: defaultOffset + defaultBoundarySize },
  ]);

  // Selection state
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedBoundaryPointIndex, setSelectedBoundaryPointIndex] = useState<number | null>(null);

  // Mode state
  const [placementMode, setPlacementMode] = useState<PlacementMode>("select");
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>("bedroom");
  const [drawMode, setDrawMode] = useState<"rectangle" | "polygon">("rectangle");

  // UI state
  const [showGrid, setShowGrid] = useState(true);
  const [editBoundaryMode, setEditBoundaryMode] = useState(false);
  const [isCanvasLocked, setIsCanvasLocked] = useState(false);
  const [furnitureSnapMode, setFurnitureSnapMode] = useState<"grid" | "half" | "free">("half");
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "room" | "door" | "window" | "furniture" | null;
    id: string | null;
    name: string;
  }>({ open: false, type: null, id: null, name: "" });

  // Refs
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const windowTransformerRef = useRef<Konva.Transformer | null>(null);
  const openingTransformerRef = useRef<Konva.Transformer | null>(null);
  const roomRefs = useRef<Map<string, Konva.Rect>>(new Map());
  const windowRefs = useRef<Map<string, Konva.Rect>>(new Map());
  const openingRefs = useRef<Map<string, Konva.Rect>>(new Map());

  // Zoom and pan
  const {
    zoom,
    panOffset,
    stageToWorld,
    handleZoomIn,
    handleZoomOut,
    handleWheel,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    resetView,
  } = useZoomPan({ config, isCanvasLocked });

  // Snap to grid
  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / gridSize) * gridSize;
  }, [gridSize]);

  // Constrain to canvas
  const constrainToCanvas = useCallback((point: Point): Point => {
    return {
      x: Math.max(0, Math.min(point.x, extendedCanvasSize)),
      y: Math.max(0, Math.min(point.y, extendedCanvasSize)),
    };
  }, [extendedCanvasSize]);

  // Add furniture handler
  const handleAddFurniture = useCallback((type: FurnitureType, position: Point) => {
    const furnitureConfig = FURNITURE_CONFIG[type];
    const newFurniture: FurnitureItem = {
      id: `furniture-${Date.now()}-${Math.random()}`,
      type,
      position,
      rotation: 0,
      width: furnitureConfig.width,
      height: furnitureConfig.height,
    };
    setFurniture(prev => [...prev, newFurniture]);
    setSelectedFurnitureId(newFurniture.id);
    logCreate("furniture", newFurniture.id, { type, position });
  }, [logCreate]);

  // Add door handler
  const handleAddDoor = useCallback((position: Point, doorType: DoorType) => {
    const doorWidth = DOOR_CONFIGS[doorType].width;
    const newDoor = {
      id: crypto.randomUUID(),
      type: doorType,
      position,
      rotation: 0,
      width: doorWidth,
    };
    setDoors(prev => [...prev, newDoor]);
    logCreate("door", newDoor.id, { type: doorType, position });
  }, [logCreate]);

  // Add window handler
  const handleAddWindow = useCallback((position: Point, windowType: WindowType) => {
    const windowConfig = WINDOW_CONFIGS[windowType];
    const newWindow = {
      id: crypto.randomUUID(),
      type: windowType,
      position,
      rotation: 0,
      width: windowConfig.width,
      height: windowConfig.height,
    };
    setWindows(prev => [...prev, newWindow]);
    logCreate("window", newWindow.id, { type: windowType, position });
  }, [logCreate]);

  // Drag and drop
  const {
    canvasContainerRef,
    handleDragStart,
    handleDragEnd,
    handleCanvasDragOver,
    handleCanvasDrop,
  } = useDragDrop({
    stageRef,
    snapToGrid,
    onPlaceFurniture: handleAddFurniture,
    onPlaceDoor: handleAddDoor,
    onPlaceWindow: handleAddWindow,
  });

  // Drawing
  const {
    isDrawing,
    currentRect,
    polygonPoints,
    handleMouseDown: drawingMouseDown,
    handleMouseMove: drawingMouseMove,
    handleMouseUp: drawingMouseUp,
    completePolygon,
    cancelPolygon,
    resetDrawing,
    calculatePolygonArea,
  } = useDrawing({
    config,
    drawMode,
    selectedRoomType,
    rooms,
    stageToWorld,
    snapToGrid,
    onAddRoom: (room) => {
      setRooms(prev => [...prev, room]);
    },
    logCreate,
  });

  // History state
  interface HistoryState {
    rooms: typeof rooms;
    doors: typeof doors;
    windows: typeof windows;
    furniture: FurnitureItem[];
    aduBoundary: Point[];
  }
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoingOrRedoing = useRef(false);
  const hasInitializedHistory = useRef(false);

  // Save to history
  const saveToHistory = useCallback(() => {
    if (isUndoingOrRedoing.current) return;

    const newState: HistoryState = {
      rooms: JSON.parse(JSON.stringify(rooms)),
      doors: JSON.parse(JSON.stringify(doors)),
      windows: JSON.parse(JSON.stringify(windows)),
      furniture: JSON.parse(JSON.stringify(furniture)),
      aduBoundary: JSON.parse(JSON.stringify(aduBoundary)),
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);

    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [rooms, doors, windows, furniture, aduBoundary, history, historyIndex]);

  // Undo
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
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedFurnitureId(null);
      setTimeout(() => { isUndoingOrRedoing.current = false; }, 100);
    }
  }, [historyIndex, history]);

  // Redo
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
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedFurnitureId(null);
      setTimeout(() => { isUndoingOrRedoing.current = false; }, 100);
    }
  }, [historyIndex, history]);

  // Initialize history
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

  // Save to history on changes
  useEffect(() => {
    if (!hasInitializedHistory.current || isUndoingOrRedoing.current) return;
    const timeoutId = setTimeout(() => saveToHistory(), 300);
    return () => clearTimeout(timeoutId);
  }, [rooms, doors, windows, furniture, aduBoundary, saveToHistory]);

  // Calculate total area
  const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);

  // Update parent with floor plan (including all editor data for 3D visualization)
  useEffect(() => {
    const floorPlan: FloorPlan = {
      id: crypto.randomUUID(),
      rooms,
      walls: [],
      doors,
      windows,
      totalArea,
      gridSize: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Include editor-specific fields for 3D visualization
      furniture: furniture.map(f => ({
        id: f.id,
        type: f.type,
        position: f.position,
        rotation: f.rotation,
        width: f.width,
        height: f.height,
      })),
      aduBoundary,
      pixelsPerFoot,
      canvasWidth: extendedCanvasSize,
      canvasHeight: extendedCanvasSize,
    };
    onPlanChange(floorPlan);
  }, [rooms, doors, windows, furniture, aduBoundary, totalArea, pixelsPerFoot, extendedCanvasSize, onPlanChange]);

  // Load finishes when blueprintId is available
  useEffect(() => {
    if (blueprintId) {
      loadFinishes(blueprintId);
    }
  }, [blueprintId, loadFinishes]);

  // Handle mouse events on canvas
  const handleMouseDown = useCallback(async (e: Konva.KonvaEventObject<MouseEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage();

    if (clickedOnEmpty) {
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedBoundaryPointIndex(null);
      setSelectedFurnitureId(null);
      setIsCameraSelected(false);

      if (placementMode === "room" && selectedRoomType) {
        drawingMouseDown(e);
      }

      // Camera placement in finishes mode
      if (placementMode === "finishes" && !finishes?.cameraPlacement) {
        const stage = e.target.getStage();
        if (stage) {
          const pointerPos = stage.getPointerPosition();
          if (pointerPos) {
            // Convert screen coordinates to world coordinates
            const worldPos = stageToWorld(pointerPos);
            const snappedPos = {
              x: snapToGrid(worldPos.x),
              y: snapToGrid(worldPos.y),
            };

            // Create new camera placement
            await ensureFinishes();
            updateCamera({
              position: snappedPos,
              rotation: 0,
              fov: 60,
              height: 5, // Default eye level height in feet
            });
          }
        }
      }
    }
  }, [placementMode, selectedRoomType, drawingMouseDown, finishes?.cameraPlacement, stageToWorld, snapToGrid, ensureFinishes, updateCamera]);

  // Handle room drag end
  const handleRoomDragEnd = useCallback((roomId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const x = snapToGrid(node.x());
    const y = snapToGrid(node.y());
    const previousPosition = { x: room.vertices[0].x, y: room.vertices[0].y };

    if (room.vertices.length === 4) {
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
      logMove("room", roomId, previousPosition, { x, y });
    }
  }, [rooms, snapToGrid, logMove]);

  // Handle room transform
  const handleRoomTransform = useCallback((roomId: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const room = rooms.find(r => r.id === roomId);
    const previousWidth = room ? room.vertices[1].x - room.vertices[0].x : 0;
    const previousHeight = room ? room.vertices[2].y - room.vertices[0].y : 0;

    const newWidth = snapToGrid(node.width() * scaleX);
    const newHeight = snapToGrid(node.height() * scaleY);
    const x = snapToGrid(node.x());
    const y = snapToGrid(node.y());

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

    node.scaleX(1);
    node.scaleY(1);
    node.width(newWidth);
    node.height(newHeight);
    node.position({ x, y });

    logResize("room", roomId, { width: previousWidth, height: previousHeight }, { width: newWidth, height: newHeight }, { x, y });
  }, [rooms, snapToGrid, pixelsPerFoot, logResize]);

  // Handle vertex drag
  const handleVertexDrag = useCallback((roomId: string, vertexIndex: number, newPos: Point) => {
    const room = rooms.find(r => r.id === roomId);
    const previousPos = room?.vertices[vertexIndex] || { x: 0, y: 0 };

    setRooms(rooms.map(r => {
      if (r.id === roomId) {
        const newVertices = [...r.vertices];
        newVertices[vertexIndex] = newPos;
        const newArea = calculatePolygonArea(newVertices);
        return { ...r, vertices: newVertices, area: Math.round(newArea) };
      }
      return r;
    }));
    logVertexMove(roomId, vertexIndex, previousPos, newPos);
  }, [rooms, calculatePolygonArea, logVertexMove]);

  // Handle vertex remove
  const handleVertexRemove = useCallback((roomId: string, vertexIndex: number) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room || room.vertices.length <= 3) return;

    const newVertices = room.vertices.filter((_, i) => i !== vertexIndex);
    const newArea = calculatePolygonArea(newVertices);

    setRooms(rooms.map(r =>
      r.id === roomId ? { ...r, vertices: newVertices, area: Math.round(newArea) } : r
    ));
  }, [rooms, calculatePolygonArea]);

  // Handle boundary point drag
  const handleBoundaryPointDrag = useCallback((index: number, newPos: Point) => {
    const snapped = { x: snapToGrid(newPos.x), y: snapToGrid(newPos.y) };
    const constrained = constrainToCanvas(snapped);

    setAduBoundary(prev => {
      const newBoundary = [...prev];
      newBoundary[index] = constrained;
      return newBoundary;
    });
  }, [snapToGrid, constrainToCanvas]);

  // Delete handlers
  const handleConfirmDelete = useCallback(() => {
    if (!deleteDialog.id || !deleteDialog.type) return;

    switch (deleteDialog.type) {
      case "room":
        setRooms(rooms.filter(r => r.id !== deleteDialog.id));
        if (selectedRoomId === deleteDialog.id) setSelectedRoomId(null);
        logDelete("room", deleteDialog.id, {});
        break;
      case "door":
        setDoors(doors.filter(d => d.id !== deleteDialog.id));
        if (selectedDoorId === deleteDialog.id) setSelectedDoorId(null);
        logDelete("door", deleteDialog.id, {});
        break;
      case "window":
        setWindows(windows.filter(w => w.id !== deleteDialog.id));
        if (selectedWindowId === deleteDialog.id) setSelectedWindowId(null);
        logDelete("window", deleteDialog.id, {});
        break;
      case "furniture":
        setFurniture(furniture.filter(f => f.id !== deleteDialog.id));
        if (selectedFurnitureId === deleteDialog.id) setSelectedFurnitureId(null);
        logDelete("furniture", deleteDialog.id, {});
        break;
    }
    setDeleteDialog({ open: false, type: null, id: null, name: "" });
  }, [deleteDialog, rooms, doors, windows, furniture, selectedRoomId, selectedDoorId, selectedWindowId, selectedFurnitureId, logDelete]);

  // Rotate handlers
  const rotateSelectedRoom = useCallback(() => {
    if (!selectedRoomId) return;
    setRooms(rooms.map((room) => {
      if (room.id === selectedRoomId && room.vertices.length === 4) {
        const centerX = (room.vertices[0].x + room.vertices[2].x) / 2;
        const centerY = (room.vertices[0].y + room.vertices[2].y) / 2;
        const width = room.vertices[1].x - room.vertices[0].x;
        const height = room.vertices[2].y - room.vertices[0].y;

        const newVertices = [
          { x: centerX - height / 2, y: centerY - width / 2 },
          { x: centerX + height / 2, y: centerY - width / 2 },
          { x: centerX + height / 2, y: centerY + width / 2 },
          { x: centerX - height / 2, y: centerY + width / 2 },
        ];

        return { ...room, vertices: newVertices };
      }
      return room;
    }));
  }, [selectedRoomId, rooms]);

  const rotateSelectedDoor = useCallback(() => {
    if (!selectedDoorId) return;
    setDoors(doors.map(d =>
      d.id === selectedDoorId ? { ...d, rotation: (d.rotation + 90) % 360 } : d
    ));
  }, [selectedDoorId, doors]);

  const rotateSelectedWindow = useCallback(() => {
    if (!selectedWindowId) return;
    setWindows(windows.map(w =>
      w.id === selectedWindowId ? { ...w, rotation: (w.rotation + 90) % 360 } : w
    ));
  }, [selectedWindowId, windows]);

  const rotateSelectedFurniture = useCallback(() => {
    if (!selectedFurnitureId) return;
    setFurniture(furniture.map(f =>
      f.id === selectedFurnitureId ? { ...f, rotation: (f.rotation + 90) % 360 } : f
    ));
  }, [selectedFurnitureId, furniture]);

  // ADU size slider handler
  const handleAduSizeChange = useCallback((sqFt: number) => {
    const sideLength = Math.sqrt(sqFt) * pixelsPerFoot;
    const centerX = (aduBoundary[0].x + aduBoundary[2].x) / 2;
    const centerY = (aduBoundary[0].y + aduBoundary[2].y) / 2;
    const halfSide = sideLength / 2;

    const newBoundary = [
      { x: constrainToCanvas({ x: centerX - halfSide, y: centerY - halfSide }).x, y: constrainToCanvas({ x: centerX - halfSide, y: centerY - halfSide }).y },
      { x: constrainToCanvas({ x: centerX + halfSide, y: centerY - halfSide }).x, y: constrainToCanvas({ x: centerX + halfSide, y: centerY - halfSide }).y },
      { x: constrainToCanvas({ x: centerX + halfSide, y: centerY + halfSide }).x, y: constrainToCanvas({ x: centerX + halfSide, y: centerY + halfSide }).y },
      { x: constrainToCanvas({ x: centerX - halfSide, y: centerY + halfSide }).x, y: constrainToCanvas({ x: centerX - halfSide, y: centerY + halfSide }).y },
    ];

    setAduBoundary(newBoundary);
  }, [aduBoundary, pixelsPerFoot, constrainToCanvas]);

  // Calculate ADU area
  const aduArea = calculatePolygonArea(aduBoundary);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Left Column - Controls */}
      <div className="space-y-4 h-fit">
        {/* Mode Selector */}
        <ModeSelector
          placementMode={placementMode}
          onModeChange={setPlacementMode}
          onCancelDrawing={cancelPolygon}
        />

        {/* Room Mode Controls */}
        {placementMode === "room" && (
          <RoomSelector
            selectedRoomType={selectedRoomType}
            drawMode={drawMode}
            isDrawing={isDrawing}
            polygonPointCount={polygonPoints.length}
            onRoomTypeChange={setSelectedRoomType}
            onDrawModeChange={(mode) => {
              setDrawMode(mode);
              if (mode === "rectangle") cancelPolygon();
              else resetDrawing();
            }}
            onCompletePolygon={completePolygon}
            onCancelPolygon={cancelPolygon}
          />
        )}

        {/* Door Mode Controls */}
        {placementMode === "door" && (
          <>
            <DoorSelector onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
            <DoorList
              doors={doors}
              selectedDoorId={selectedDoorId}
              onSelectDoor={setSelectedDoorId}
              onDeleteDoor={(id, name) => setDeleteDialog({ open: true, type: "door", id, name })}
              onRotateDoor={rotateSelectedDoor}
            />
          </>
        )}

        {/* Window Mode Controls */}
        {placementMode === "window" && (
          <>
            <WindowSelector onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
            <WindowList
              windows={windows}
              selectedWindowId={selectedWindowId}
              onSelectWindow={setSelectedWindowId}
              onDeleteWindow={(id, name) => setDeleteDialog({ open: true, type: "window", id, name })}
              onRotateWindow={rotateSelectedWindow}
            />
          </>
        )}

        {/* Furniture Mode Controls */}
        {placementMode === "furniture" && (
          <>
            <FurnitureSelector
              snapMode={furnitureSnapMode}
              onSnapModeChange={setFurnitureSnapMode}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
            <FurnitureList
              furniture={furniture}
              selectedFurnitureId={selectedFurnitureId}
              onSelectFurniture={setSelectedFurnitureId}
              onDeleteFurniture={(id, name) => setDeleteDialog({ open: true, type: "furniture", id, name })}
              onRotateFurniture={rotateSelectedFurniture}
            />
          </>
        )}

        {/* Finishes Mode Controls */}
        {placementMode === "finishes" && (
          <FinishesPanel
            finishes={finishes}
            options={finishesOptions}
            rooms={rooms.map(r => ({ id: r.id, name: r.name, type: r.type }))}
            renderStatus={renderStatus}
            loading={finishesLoading}
            rendering={rendering}
            onUpdateRoomFinish={async (roomFinish: RoomFinish) => {
              await ensureFinishes();
              await updateRoomFinish(roomFinish);
            }}
            onUpdateCamera={async (camera: CameraPlacement | null) => {
              await ensureFinishes();
              await updateCamera(camera);
            }}
            onApplyTemplate={async (template: TemplateOption, overwrite: boolean) => {
              await ensureFinishes();
              await applyTemplate(template, overwrite);
            }}
            onGenerateRender={async (type: "topdown" | "firstperson", quality: "preview" | "final") => {
              await generateRender(type, quality);
            }}
            onUpdateTier={async (tier: TierOption) => {
              await ensureFinishes();
              await updateFinishes({ globalTier: tier });
            }}
          />
        )}

        {/* Room List (always show when in room or select mode) */}
        {(placementMode === "room" || placementMode === "select") && (
          <RoomList
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onSelectRoom={setSelectedRoomId}
            onDeleteRoom={(id, name) => setDeleteDialog({ open: true, type: "room", id, name })}
            onRotateRoom={rotateSelectedRoom}
          />
        )}

        {/* ADU Size Control */}
        <Card className="p-3 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">ADU Size</Label>
            <span className="text-sm font-medium text-primary">{Math.round(aduArea)} sq ft</span>
          </div>
          <Slider
            value={[Math.round(aduArea)]}
            min={200}
            max={1200}
            step={25}
            onValueChange={([value]) => handleAduSizeChange(value)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>200 sq ft</span>
            <span>1200 sq ft</span>
          </div>
        </Card>

        {/* Undo/Redo and Save */}
        <Card className="p-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
                className="h-8 w-8 p-0"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="h-8 w-8 p-0"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : saveError ? (
                <CloudOff className="h-4 w-4 text-destructive" />
              ) : lastSavedAt ? (
                <Cloud className="h-4 w-4 text-green-500" />
              ) : null}
              <span className="text-[10px] text-muted-foreground">
                {historyIndex + 1} / {history.length}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Column - Canvas */}
      <div className="relative">
        <div
          ref={canvasContainerRef}
          className="relative bg-white rounded-lg border shadow-md overflow-hidden"
          style={{ width: displaySize, height: displaySize }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          {/* Floating overlays */}
          <ADUAreaIndicator config={config} boundary={aduBoundary} />
          <Compass />
          <CanvasControls
            zoom={zoom}
            showGrid={showGrid}
            isLocked={isCanvasLocked}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetView={resetView}
            onToggleGrid={setShowGrid}
            onToggleLock={setIsCanvasLocked}
            onExport={() => setShowExportDialog(true)}
          />

          {/* Konva Stage */}
          <Stage
            ref={stageRef}
            width={displaySize}
            height={displaySize}
            scaleX={zoom}
            scaleY={zoom}
            x={panOffset.x}
            y={panOffset.y}
            onMouseDown={(e) => {
              handlePanStart(e);
              handleMouseDown(e);
            }}
            onMouseMove={(e) => {
              handlePanMove(e);
              drawingMouseMove(e);
            }}
            onMouseUp={(e) => {
              handlePanEnd();
              drawingMouseUp();
            }}
            onWheel={handleWheel}
          >
            <Layer>
              {/* Grid */}
              <Grid config={config} showGrid={showGrid} />

              {/* ADU Boundary */}
              <ADUBoundary
                config={config}
                boundary={aduBoundary}
                editMode={editBoundaryMode}
                selectedPointIndex={selectedBoundaryPointIndex}
                onPointDrag={handleBoundaryPointDrag}
                onPointSelect={setSelectedBoundaryPointIndex}
              />

              {/* Rooms */}
              <Rooms
                config={config}
                rooms={rooms}
                doors={doors}
                selectedRoomId={selectedRoomId}
                onRoomClick={setSelectedRoomId}
                onRoomDragEnd={handleRoomDragEnd}
                onRoomTransform={handleRoomTransform}
                onVertexDrag={handleVertexDrag}
                onVertexRemove={handleVertexRemove}
                transformerRef={transformerRef}
                roomRefs={roomRefs}
              />

              {/* Doors */}
              <Doors
                config={config}
                doors={doors}
                selectedDoorId={selectedDoorId}
                onDoorClick={setSelectedDoorId}
                onDoorDragEnd={(id, pos) => {
                  setDoors(doors.map(d => d.id === id ? { ...d, position: pos } : d));
                }}
                openingTransformerRef={openingTransformerRef}
                openingRefs={openingRefs}
              />

              {/* Windows */}
              <Windows
                config={config}
                windows={windows}
                selectedWindowId={selectedWindowId}
                onWindowClick={setSelectedWindowId}
                onWindowDragEnd={(id, pos) => {
                  setWindows(windows.map(w => w.id === id ? { ...w, position: pos } : w));
                }}
                onWindowTransform={(id, width) => {
                  setWindows(windows.map(w => w.id === id ? { ...w, width } : w));
                }}
                transformerRef={windowTransformerRef}
                windowRefs={windowRefs}
              />

              {/* Furniture */}
              <Furniture
                config={config}
                furniture={furniture}
                furnitureImages={furnitureImages}
                selectedFurnitureId={selectedFurnitureId}
                snapMode={furnitureSnapMode}
                onFurnitureClick={setSelectedFurnitureId}
                onFurnitureDragEnd={(id, pos) => {
                  setFurniture(furniture.map(f => f.id === id ? { ...f, position: pos } : f));
                }}
              />

              {/* Camera Marker for First-Person Renders */}
              {finishes?.cameraPlacement && (
                <CameraMarker
                  camera={finishes.cameraPlacement}
                  selected={isCameraSelected}
                  onSelect={() => setIsCameraSelected(true)}
                  onDragEnd={async (position) => {
                    await ensureFinishes();
                    updateCamera({
                      ...finishes.cameraPlacement!,
                      position,
                    });
                  }}
                  onRotate={async (rotation) => {
                    await ensureFinishes();
                    updateCamera({
                      ...finishes.cameraPlacement!,
                      rotation,
                    });
                  }}
                />
              )}

              {/* Drawing Preview */}
              <DrawingPreview
                config={config}
                drawMode={drawMode}
                selectedRoomType={selectedRoomType}
                isDrawing={isDrawing}
                currentRect={currentRect}
                polygonPoints={polygonPoints}
              />
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ ...deleteDialog, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        stageRef={stageRef}
        rooms={rooms}
        doors={doors}
        windows={windows}
        furniture={furniture}
        aduBoundary={aduBoundary}
        config={config}
        blueprintId={blueprintId ?? undefined}
        projectName="ADU Floor Plan"
      />
    </div>
  );
}

// Default export for easier imports
export default FloorPlanEditor;
