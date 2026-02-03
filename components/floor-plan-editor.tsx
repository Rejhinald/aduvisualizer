"use client";

/**
 * Floor Plan Editor - Modular Version
 *
 * This component is composed of modular parts located in:
 * - components/floor-plan-editor/types.ts - Type definitions
 * - components/floor-plan-editor/constants.ts - Constants and configs
 * - components/floor-plan-editor/hooks/ - Custom hooks
 * - components/floor-plan-editor/canvas/ - Canvas components
 * - components/floor-plan-editor/sidebar/ - Sidebar components
 * - components/floor-plan-editor/overlay/ - Floating overlay components
 * - components/floor-plan-editor/lists/ - List components
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { Stage, Layer, Group, Rect } from "react-konva";
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
import { Switch } from "@/components/ui/switch";
import { Undo2, Redo2, Cloud, CloudOff, Loader2, AlertTriangle, Save } from "lucide-react";
import type { FloorPlan, Point, RoomType, DoorType, WindowType } from "@/lib/types";
import { DOOR_CONFIGS, WINDOW_CONFIGS } from "@/lib/constants";
import { useWizard } from "@/lib/context/wizard-context";
import { useActionLogger } from "@/lib/hooks/use-action-logger";

// Import modular components
import {
  useCanvasConfig,
  useFurnitureImages,
  useZoomPan,
  useDragDrop,
  useDrawing,
  useAutoSave,
  useVersionHistory,
  useLotBoundaryDrawing,
  useEditorSettings,
} from "./floor-plan-editor/hooks";
import {
  Grid,
  ADUBoundary,
  Rooms,
  Doors,
  Windows,
  Furniture,
  DrawingPreview,
  MarqueeSelection,
  getBoundingBox,
  rectsIntersect,
} from "./floor-plan-editor/canvas";
import { LotOverlay, LotBoundaryDrawing } from "./floor-plan-editor/lot";
import * as api from "@/lib/api/client";
import type { AddressResult } from "@/lib/api/client";
import { useLot } from "@/lib/api/hooks";
import {
  ModeSelector,
  RoomSelector,
  DoorSelector,
  WindowSelector,
  FurnitureSelector,
  LotSelector,
  DraggablePanelContainer,
} from "./floor-plan-editor/sidebar";
import {
  ADUAreaIndicator,
  Compass,
  CanvasControls,
  RestoreDropdown,
} from "./floor-plan-editor/overlay";
import {
  RoomList,
  DoorList,
  WindowList,
  FurnitureList,
  ADUSummary,
} from "./floor-plan-editor/lists";
import { ExportDialog } from "./floor-plan-editor/export";
import type {
  Furniture as FurnitureItem,
  FurnitureType,
  PlacementMode,
} from "./floor-plan-editor/types";
import { FURNITURE_CONFIG, MAX_HISTORY } from "./floor-plan-editor/constants";

// Re-export types for external use
export type { FurnitureType };
export type { FurnitureItem as Furniture };

interface FloorPlanEditorProps {
  onPlanChange: (plan: FloorPlan) => void;
}

export function FloorPlanEditor({ onPlanChange }: FloorPlanEditorProps) {
  // Wizard context for cloud save
  const { isSaving, saveError, lastSavedAt, projectId, blueprintId, saveToCloud } = useWizard();

  // Editor settings persistence (localStorage)
  const {
    settings: editorSettings,
    setShowLotOverlay,
    setShowSatelliteView,
    setShowLotBoundary,
    setShowGrid: saveShowGrid,
    setCameraSettings,
  } = useEditorSettings(blueprintId ?? undefined);

  // Lot overlay hook
  const {
    lot,
    loading: lotLoading,
    error: lotError,
    addressResults,
    searchAddresses,
    fetchParcelData,
    loadLot,
    saveLot,
    updateAduPosition,
    updateSetbacks,
    updateLotDimensions,
    updateLotCustomBoundary,
    removeLot,
    clearAddressResults,
  } = useLot(blueprintId ?? undefined);

  // Lot overlay visibility (from persisted settings)
  const showLotOverlay = editorSettings.showLotOverlay;
  const showSatelliteView = editorSettings.showSatelliteView;
  const showLotBoundary = editorSettings.showLotBoundary;

  // Live preview state for ADU position/rotation (updates immediately, debounces server sync)
  const [previewOffsetX, setPreviewOffsetX] = useState<number | null>(null);
  const [previewOffsetY, setPreviewOffsetY] = useState<number | null>(null);
  const [previewRotation, setPreviewRotation] = useState<number | null>(null);

  // Ref to hold setCamera function (from useZoomPan) for use in handleRestoreSnapshot
  // This is needed because handleRestoreSnapshot is defined before useZoomPan is called
  const setCameraRef = useRef<((zoom: number, panX: number, panY: number) => void) | null>(null);

  // Load existing lot on mount
  const lotLoadedRef = useRef(false);
  useEffect(() => {
    if (blueprintId && !lotLoadedRef.current) {
      lotLoadedRef.current = true;
      loadLot().then((loadedLot) => {
        if (loadedLot) {
          setShowLotOverlay(true);
        }
      }).catch(() => {
        // Ignore - lot may not exist yet
      });
    }
  }, [blueprintId, loadLot, setShowLotOverlay]);

  // Action logger for tracking all editor changes
  const { logMove, logResize, logCreate, logDelete, logVertexMove } = useActionLogger({
    projectId,
    blueprintId,
    enabled: !!projectId,
  });

  // Canvas configuration
  const config = useCanvasConfig();
  const { pixelsPerFoot, gridSize, displaySize, extendedCanvasSize } = config;

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

  // Selection state (single selection)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedBoundaryPointIndex, setSelectedBoundaryPointIndex] = useState<number | null>(null);

  // Multi-selection state (for batch operations)
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [selectedDoorIds, setSelectedDoorIds] = useState<Set<string>>(new Set());
  const [selectedWindowIds, setSelectedWindowIds] = useState<Set<string>>(new Set());
  const [selectedFurnitureIds, setSelectedFurnitureIds] = useState<Set<string>>(new Set());

  // Marquee selection state
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<Point | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<Point | null>(null);

  // Multi-drag preview state - tracks live offset during drag for visual feedback
  const [multiDragDelta, setMultiDragDelta] = useState<Point>({ x: 0, y: 0 });
  const [isDraggingMulti, setIsDraggingMulti] = useState(false);

  // Mode state
  const [placementMode, setPlacementMode] = useState<PlacementMode>("select");
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>("bedroom");
  const [drawMode, setDrawMode] = useState<"rectangle" | "polygon">("rectangle");

  // UI state - showGrid is persisted via editorSettings
  const showGrid = editorSettings.showGrid;
  const setShowGrid = saveShowGrid;
  const [editBoundaryMode, setEditBoundaryMode] = useState(false);
  const [isCanvasLocked, setIsCanvasLocked] = useState(false);
  const [furnitureSnapMode, setFurnitureSnapMode] = useState<"grid" | "half" | "free">("half");
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Delete confirmation dialog (supports single and batch delete)
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "room" | "door" | "window" | "furniture" | "batch" | null;
    id: string | null;
    ids?: { rooms: string[]; doors: string[]; windows: string[]; furniture: string[] };
    name: string;
  }>({ open: false, type: null, id: null, name: "" });

  // Room descriptions for "other" room type
  const [roomDescriptions, setRoomDescriptions] = useState<Map<string, string>>(new Map());

  // Auto-save hook
  const { autoSaveEnabled, setAutoSaveEnabled, saveNow } = useAutoSave({
    rooms,
    doors,
    windows,
    furniture,
    aduBoundary,
    config,
    isSaving,
    saveToCloud,
  });

  // Version history hook for restore functionality
  const handleRestoreSnapshot = useCallback(async (data: {
    rooms: FloorPlan["rooms"];
    doors: FloorPlan["doors"];
    windows: FloorPlan["windows"];
    furniture: FurnitureItem[];
    aduBoundary: Point[];
    editorSettings?: {
      showLotOverlay: boolean;
      showSatelliteView: boolean;
      showLotBoundary: boolean;
      showGrid: boolean;
      zoom: number;
      panOffsetX: number;
      panOffsetY: number;
    };
    lotData?: {
      parcelNumber?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      geoLat: number;
      geoLng: number;
      geoRotation: number;
      boundaryVertices?: Array<{ lat: number; lng: number }>;
      lotWidthFeet?: number;
      lotDepthFeet?: number;
      lotAreaSqFt?: number;
      aduOffsetX: number;
      aduOffsetY: number;
      aduRotation: number;
      setbackFrontFeet: number;
      setbackBackFeet: number;
      setbackLeftFeet: number;
      setbackRightFeet: number;
      dataSource?: string;
    };
  }) => {
    console.log("[FloorPlanEditor] Restoring snapshot, lotData:", data.lotData ? "present" : "missing", data.lotData);
    console.log("[FloorPlanEditor] Restoring snapshot, editorSettings:", data.editorSettings);

    setRooms(data.rooms);
    setDoors(data.doors);
    setWindows(data.windows);
    setFurniture(data.furniture);
    setAduBoundary(data.aduBoundary);
    // Restore editor settings if present in snapshot
    if (data.editorSettings) {
      setShowLotOverlay(data.editorSettings.showLotOverlay);
      setShowSatelliteView(data.editorSettings.showSatelliteView);
      setShowLotBoundary(data.editorSettings.showLotBoundary);
      saveShowGrid(data.editorSettings.showGrid);
      // Persist camera settings to localStorage
      setCameraSettings(
        data.editorSettings.zoom,
        data.editorSettings.panOffsetX,
        data.editorSettings.panOffsetY
      );
      // Directly set the camera position in useZoomPan state (via ref)
      if (setCameraRef.current) {
        setCameraRef.current(
          data.editorSettings.zoom,
          data.editorSettings.panOffsetX,
          data.editorSettings.panOffsetY
        );
      }
    }
    // Restore lot data if present in snapshot
    if (data.lotData) {
      try {
        console.log("[FloorPlanEditor] Saving lot data from snapshot...");
        // Save lot data to backend (this will update the lot state via useLot hook)
        const restoredLot = await saveLot({
          address: data.lotData.address,
          city: data.lotData.city,
          state: data.lotData.state,
          zipCode: data.lotData.zipCode,
          geoLat: data.lotData.geoLat,
          geoLng: data.lotData.geoLng,
          geoRotation: data.lotData.geoRotation,
          boundaryVertices: data.lotData.boundaryVertices,
          lotWidthFeet: data.lotData.lotWidthFeet,
          lotDepthFeet: data.lotData.lotDepthFeet,
          lotAreaSqFt: data.lotData.lotAreaSqFt,
          aduOffsetX: data.lotData.aduOffsetX,
          aduOffsetY: data.lotData.aduOffsetY,
          aduRotation: data.lotData.aduRotation,
          setbackFrontFeet: data.lotData.setbackFrontFeet,
          setbackBackFeet: data.lotData.setbackBackFeet,
          setbackLeftFeet: data.lotData.setbackLeftFeet,
          setbackRightFeet: data.lotData.setbackRightFeet,
          parcelNumber: data.lotData.parcelNumber,
          dataSource: data.lotData.dataSource as "orange_county_gis" | "manual" | "nominatim" | undefined,
        });
        console.log("[FloorPlanEditor] Lot data restored successfully:", restoredLot);
        // Clear preview states
        setPreviewOffsetX(null);
        setPreviewOffsetY(null);
        setPreviewRotation(null);
        // Ensure lot overlay is visible after restore
        setShowLotOverlay(true);
      } catch (err) {
        console.error("[FloorPlanEditor] Error restoring lot data:", err);
      }
    }
    // Clear selections
    setSelectedRoomId(null);
    setSelectedDoorId(null);
    setSelectedWindowId(null);
    setSelectedFurnitureId(null);
  }, [setShowLotOverlay, setShowSatelliteView, setShowLotBoundary, saveShowGrid, setCameraSettings, saveLot]);

  const {
    autoSaves,
    manualSaves,
    saveAutoSnapshot,
    saveManualSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    formatTimestamp,
    getTimeAgo,
  } = useVersionHistory({
    projectId: projectId ?? undefined,
    blueprintId: blueprintId ?? undefined,
    rooms,
    doors,
    windows,
    furniture,
    aduBoundary,
    editorSettings: {
      showLotOverlay: editorSettings.showLotOverlay,
      showSatelliteView: editorSettings.showSatelliteView,
      showLotBoundary: editorSettings.showLotBoundary,
      showGrid: editorSettings.showGrid,
      zoom: editorSettings.zoom,
      panOffsetX: editorSettings.panOffsetX,
      panOffsetY: editorSettings.panOffsetY,
    },
    // Include lot data in snapshots (only if lot exists)
    lotData: lot ? {
      parcelNumber: lot.parcelNumber,
      address: lot.address,
      city: lot.city,
      state: lot.state,
      zipCode: lot.zipCode,
      geoLat: lot.geoLat,
      geoLng: lot.geoLng,
      geoRotation: lot.geoRotation,
      boundaryVertices: lot.boundaryVertices,
      lotWidthFeet: lot.lotWidthFeet,
      lotDepthFeet: lot.lotDepthFeet,
      lotAreaSqFt: lot.lotAreaSqFt,
      aduOffsetX: lot.aduOffsetX,
      aduOffsetY: lot.aduOffsetY,
      aduRotation: lot.aduRotation,
      setbackFrontFeet: lot.setbackFrontFeet,
      setbackBackFeet: lot.setbackBackFeet,
      setbackLeftFeet: lot.setbackLeftFeet,
      setbackRightFeet: lot.setbackRightFeet,
      dataSource: lot.dataSource,
    } : undefined,
    onRestore: handleRestoreSnapshot,
  });

  // Auto-save snapshot every 10 minutes when auto-save is enabled
  useEffect(() => {
    if (!autoSaveEnabled) return;

    const interval = setInterval(() => {
      saveAutoSnapshot();
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [autoSaveEnabled, saveAutoSnapshot]);

  // Refs
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const windowTransformerRef = useRef<Konva.Transformer | null>(null);
  const openingTransformerRef = useRef<Konva.Transformer | null>(null);
  const roomRefs = useRef<Map<string, Konva.Rect>>(new Map());
  const windowRefs = useRef<Map<string, Konva.Rect>>(new Map());
  const openingRefs = useRef<Map<string, Konva.Rect>>(new Map());

  // Calculate ADU center for zoom focus
  const aduCenter = useMemo(() => ({
    x: (aduBoundary[0].x + aduBoundary[2].x) / 2,
    y: (aduBoundary[0].y + aduBoundary[2].y) / 2,
  }), [aduBoundary]);

  // Canvas center for lot overlay positioning
  const canvasCenter = useMemo(() => ({
    x: extendedCanvasSize / 2,
    y: extendedCanvasSize / 2,
  }), [extendedCanvasSize]);

  // Handle address selection - fetch parcel and save lot
  const handleSelectAddress = useCallback(async (address: AddressResult) => {
    // Try to fetch parcel data for the selected address
    let parcel = null;
    try {
      parcel = await fetchParcelData(address.lat, address.lng);
    } catch (e) {
      console.warn("Could not fetch parcel data:", e);
      // Continue without parcel data - we can still use address coordinates
    }

    // Calculate lot dimensions from boundary or bounding box
    let lotWidthFeet: number | undefined;
    let lotDepthFeet: number | undefined;

    if (parcel?.boundaryVertices && parcel.boundaryVertices.length >= 4) {
      // Use parcel boundary if available
      const lats = parcel.boundaryVertices.map(v => v.lat);
      const lngs = parcel.boundaryVertices.map(v => v.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const feetPerDegreeLat = 364000;
      const feetPerDegreeLng = 364000 * Math.cos((address.lat * Math.PI) / 180);
      lotWidthFeet = Math.abs(maxLng - minLng) * feetPerDegreeLng;
      lotDepthFeet = Math.abs(maxLat - minLat) * feetPerDegreeLat;
    } else if (address.boundingBox && address.boundingBox.length >= 4) {
      // Fallback: use Nominatim bounding box if available
      // boundingBox format: [minLat, maxLat, minLng, maxLng]
      const [minLat, maxLat, minLng, maxLng] = address.boundingBox;

      const feetPerDegreeLat = 364000;
      const feetPerDegreeLng = 364000 * Math.cos((address.lat * Math.PI) / 180);
      lotWidthFeet = Math.abs(maxLng - minLng) * feetPerDegreeLng;
      lotDepthFeet = Math.abs(maxLat - minLat) * feetPerDegreeLat;
    } else {
      // Default fallback: typical residential lot size (50x100 ft)
      lotWidthFeet = 50;
      lotDepthFeet = 100;
    }

    // Save lot with address and parcel data (if available)
    await saveLot({
      address: address.displayName.split(",")[0],
      city: address.displayName.split(",")[1]?.trim(),
      geoLat: address.lat,
      geoLng: address.lng,
      lotWidthFeet,
      lotDepthFeet,
      ...(parcel && {
        parcelNumber: parcel.parcelNumber,
        boundaryVertices: parcel.boundaryVertices,
        lotAreaSqFt: parcel.areaSqFt,
        dataSource: "orange_county_gis",
      }),
      ...(!parcel && {
        dataSource: "nominatim",
      }),
    });

    // Show overlay after selecting address
    setShowLotOverlay(true);
  }, [fetchParcelData, saveLot, setShowLotOverlay]);

  // Calculate zoom focus point - always zoom centered on the ADU (accounting for offset when lot is loaded)
  const zoomFocusPoint = useMemo(() => {
    if (lot && showLotOverlay) {
      // When lot is visible, zoom around ADU position (lot center + offset)
      const offsetX = previewOffsetX ?? lot.aduOffsetX ?? 0;
      const offsetY = previewOffsetY ?? lot.aduOffsetY ?? 0;
      return {
        x: canvasCenter.x + offsetX * pixelsPerFoot,
        y: canvasCenter.y + offsetY * pixelsPerFoot,
      };
    }
    // Otherwise, zoom around ADU center
    return aduCenter;
  }, [lot, showLotOverlay, canvasCenter, aduCenter, pixelsPerFoot, previewOffsetX, previewOffsetY]);

  // Zoom and pan (centered on lot/ADU) - with persisted camera settings
  const {
    zoom,
    panOffset,
    stageToWorld,
    setCamera,
    handleZoomIn,
    handleZoomOut,
    handleWheel,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    resetView,
  } = useZoomPan({
    config,
    isCanvasLocked,
    focusPoint: zoomFocusPoint,
    initialZoom: editorSettings.zoom,
    initialPanOffset: { x: editorSettings.panOffsetX, y: editorSettings.panOffsetY },
    onCameraChange: setCameraSettings,
  });

  // Store setCamera in ref for use by handleRestoreSnapshot (defined before useZoomPan)
  useEffect(() => {
    setCameraRef.current = setCamera;
  }, [setCamera]);

  // Snap to half-grid (0.5 foot increments)
  const halfGrid = gridSize / 2;
  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / halfGrid) * halfGrid;
  }, [halfGrid]);

  // Handle lot boundary drawing completion
  const handleLotBoundaryComplete = useCallback(async (boundaryInFeet: Point[]) => {
    if (!lot) return;

    // Save the actual polygon vertices (not just dimensions)
    // This preserves the drawn shape and converts to geo coordinates
    try {
      await updateLotCustomBoundary(boundaryInFeet);
      // The lot overlay will use boundaryVertices to render the actual polygon
    } catch (e) {
      console.error("Failed to save lot boundary:", e);
    }
  }, [lot, updateLotCustomBoundary]);

  // Lot boundary drawing hook
  const {
    isDrawing: isDrawingLotBoundary,
    points: lotBoundaryPoints,
    previewPoint: lotBoundaryPreviewPoint,
    startDrawing: startLotBoundaryDrawing,
    cancelDrawing: cancelLotBoundaryDrawing,
    handleClick: handleLotBoundaryClick,
    handleMouseMove: handleLotBoundaryMouseMove,
  } = useLotBoundaryDrawing({
    pixelsPerFoot,
    canvasCenter,
    snapToGrid,
    onComplete: handleLotBoundaryComplete,
  });

  // Constrain to canvas
  const constrainToCanvas = useCallback((point: Point): Point => {
    return {
      x: Math.max(0, Math.min(point.x, extendedCanvasSize)),
      y: Math.max(0, Math.min(point.y, extendedCanvasSize)),
    };
  }, [extendedCanvasSize]);

  // Calculate polygon area
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

  // Add furniture handler
  const handleAddFurniture = useCallback((type: FurnitureType, position: Point) => {
    const furnitureConfig = FURNITURE_CONFIG[type];
    const newFurniture: FurnitureItem = {
      id: crypto.randomUUID(),
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

  // ADU transform for coordinate conversion when lot is loaded with rotation
  const aduTransform = useMemo(() => {
    if (!lot || !showLotOverlay) return undefined;
    return {
      offsetX: previewOffsetX ?? lot.aduOffsetX ?? 0,
      offsetY: previewOffsetY ?? lot.aduOffsetY ?? 0,
      rotation: previewRotation ?? lot.aduRotation ?? 0,
      canvasCenter,
      pixelsPerFoot,
    };
  }, [lot, showLotOverlay, canvasCenter, pixelsPerFoot, previewOffsetX, previewOffsetY, previewRotation]);

  // Drag and drop
  const {
    canvasContainerRef,
    handleDragStart,
    handleDragEnd,
    handleCanvasDragOver,
    handleCanvasDrop,
  } = useDragDrop({
    snapToGrid,
    stageRef,
    aduTransform,
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
    aduTransform,
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
  const isDraggingOrResizing = useRef(false); // Track drag/resize operations

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

    // Skip if state is identical to the last history entry (prevents duplicate entries)
    if (historyIndex >= 0 && history[historyIndex]) {
      const lastState = history[historyIndex];
      const newStateStr = JSON.stringify(newState);
      const lastStateStr = JSON.stringify(lastState);
      if (newStateStr === lastStateStr) {
        return; // State hasn't changed, skip saving
      }
    }

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

  // Initialize history on mount
  useEffect(() => {
    if (!hasInitializedHistory.current) {
      hasInitializedHistory.current = true;
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        const initialState: HistoryState = {
          rooms: [],
          doors: [],
          windows: [],
          furniture: [],
          aduBoundary: [
            { x: defaultOffset, y: defaultOffset },
            { x: defaultOffset + defaultBoundarySize, y: defaultOffset },
            { x: defaultOffset + defaultBoundarySize, y: defaultOffset + defaultBoundarySize },
            { x: defaultOffset, y: defaultOffset + defaultBoundarySize },
          ],
        };
        setHistory([initialState]);
        setHistoryIndex(0);
      }, 0);
    }
  }, [defaultOffset, defaultBoundarySize]);

  // Save to history on changes (but not during drag/resize operations)
  useEffect(() => {
    if (!hasInitializedHistory.current || isUndoingOrRedoing.current || isDraggingOrResizing.current) return;
    const timeoutId = setTimeout(() => saveToHistory(), 300);
    return () => clearTimeout(timeoutId);
  }, [rooms, doors, windows, furniture, aduBoundary, saveToHistory]);

  // Calculate total area
  const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);

  // Attach transformer to selected room
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    if (selectedRoomId) {
      const selectedRoom = rooms.find(r => r.id === selectedRoomId);
      const node = roomRefs.current.get(selectedRoomId);

      // Only attach transformer to rectangle rooms
      if (selectedRoom && selectedRoom.vertices.length === 4 && node) {
        transformer.nodes([node]);
        transformer.getLayer()?.batchDraw();
      } else {
        transformer.nodes([]);
        transformer.getLayer()?.batchDraw();
      }
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedRoomId, rooms]);

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

  // Attach opening transformer to selected opening (doors with type "opening")
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


  // Update parent with floor plan (including room descriptions for "other" type)
  useEffect(() => {
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

  // Handle mouse events on canvas
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Check if clicked on empty space (Stage, Layer, or click-catcher)
    const target = e.target;
    const isStage = target === target.getStage();
    const isClickCatcher = target.name?.() === "click-catcher";
    const clickedOnEmpty = isStage || isClickCatcher;

    if (clickedOnEmpty) {
      // Clear single selections
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedBoundaryPointIndex(null);
      setSelectedFurnitureId(null);

      // Start marquee selection in select mode
      if (placementMode === "select") {
        const stage = e.target.getStage();
        if (stage) {
          const pos = stage.getPointerPosition();
          if (pos) {
            // Convert to canvas coordinates (accounting for zoom/pan)
            const canvasPos = {
              x: (pos.x - panOffset.x) / zoom,
              y: (pos.y - panOffset.y) / zoom,
            };
            setMarqueeStart(canvasPos);
            setMarqueeEnd(canvasPos);
            setIsMarqueeSelecting(true);
            // Clear multi-selection when starting new marquee
            setSelectedRoomIds(new Set());
            setSelectedDoorIds(new Set());
            setSelectedWindowIds(new Set());
            setSelectedFurnitureIds(new Set());
          }
        }
      } else if (placementMode === "room" && selectedRoomType) {
        drawingMouseDown(e);
      }
    }
  }, [placementMode, selectedRoomType, drawingMouseDown, zoom, panOffset]);

  // Handle marquee selection move
  const handleMarqueeMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isMarqueeSelecting) return;

    const stage = e.target.getStage();
    if (stage) {
      const pos = stage.getPointerPosition();
      if (pos) {
        const canvasPos = {
          x: (pos.x - panOffset.x) / zoom,
          y: (pos.y - panOffset.y) / zoom,
        };
        setMarqueeEnd(canvasPos);
      }
    }
  }, [isMarqueeSelecting, zoom, panOffset]);

  // Complete marquee selection
  const handleMarqueeEnd = useCallback(() => {
    if (!isMarqueeSelecting || !marqueeStart || !marqueeEnd) {
      setIsMarqueeSelecting(false);
      return;
    }

    // Transform world coords to ADU-local coords when lot is loaded
    const worldToLocal = (point: Point): Point => {
      if (!aduTransform) return point;

      if (aduTransform.rotation === 0) {
        // No rotation, just offset
        const offsetPx = {
          x: aduTransform.offsetX * aduTransform.pixelsPerFoot,
          y: aduTransform.offsetY * aduTransform.pixelsPerFoot,
        };
        return {
          x: point.x - offsetPx.x,
          y: point.y - offsetPx.y,
        };
      }

      const { canvasCenter, rotation, offsetX, offsetY, pixelsPerFoot: ppf } = aduTransform;
      const offsetPx = { x: offsetX * ppf, y: offsetY * ppf };
      const groupX = canvasCenter.x + offsetPx.x;
      const groupY = canvasCenter.y + offsetPx.y;
      const tx = point.x - groupX;
      const ty = point.y - groupY;
      const angleRad = (-rotation * Math.PI) / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const rx = tx * cos - ty * sin;
      const ry = tx * sin + ty * cos;
      return { x: rx + canvasCenter.x, y: ry + canvasCenter.y };
    };

    // Transform marquee corners to ADU-local space
    const localStart = worldToLocal(marqueeStart);
    const localEnd = worldToLocal(marqueeEnd);

    // Calculate selection rect in ADU-local space
    const selectionRect = {
      x: Math.min(localStart.x, localEnd.x),
      y: Math.min(localStart.y, localEnd.y),
      width: Math.abs(localEnd.x - localStart.x),
      height: Math.abs(localEnd.y - localStart.y),
    };

    // Only select if dragged a meaningful distance
    if (selectionRect.width > 5 && selectionRect.height > 5) {
      // Find items within selection
      const selectedRooms = new Set<string>();
      const selectedDoors = new Set<string>();
      const selectedWindows = new Set<string>();
      const selectedFurn = new Set<string>();

      // Check rooms
      rooms.forEach(room => {
        const roomBounds = getBoundingBox(room.vertices);
        if (rectsIntersect(selectionRect, roomBounds)) {
          selectedRooms.add(room.id);
        }
      });

      // Check doors
      doors.forEach(door => {
        const doorBounds = {
          x: door.position.x - (door.width * pixelsPerFoot) / 2,
          y: door.position.y - 10,
          width: door.width * pixelsPerFoot,
          height: 20,
        };
        if (rectsIntersect(selectionRect, doorBounds)) {
          selectedDoors.add(door.id);
        }
      });

      // Check windows
      windows.forEach(win => {
        const winBounds = {
          x: win.position.x - (win.width * pixelsPerFoot) / 2,
          y: win.position.y - 10,
          width: win.width * pixelsPerFoot,
          height: 20,
        };
        if (rectsIntersect(selectionRect, winBounds)) {
          selectedWindows.add(win.id);
        }
      });

      // Check furniture
      furniture.forEach(furn => {
        const furnBounds = {
          x: furn.position.x,
          y: furn.position.y,
          width: furn.width * pixelsPerFoot,
          height: furn.height * pixelsPerFoot,
        };
        if (rectsIntersect(selectionRect, furnBounds)) {
          selectedFurn.add(furn.id);
        }
      });

      setSelectedRoomIds(selectedRooms);
      setSelectedDoorIds(selectedDoors);
      setSelectedWindowIds(selectedWindows);
      setSelectedFurnitureIds(selectedFurn);
    }

    setIsMarqueeSelecting(false);
    setMarqueeStart(null);
    setMarqueeEnd(null);
  }, [isMarqueeSelecting, marqueeStart, marqueeEnd, rooms, doors, windows, furniture, pixelsPerFoot, aduTransform]);

  // Check if there's an active multi-selection
  const hasMultiSelection = selectedRoomIds.size + selectedDoorIds.size + selectedWindowIds.size + selectedFurnitureIds.size > 0;

  // Handle multi-drag start - initialize preview state
  const handleMultiDragStart = useCallback(() => {
    setIsDraggingMulti(true);
    setMultiDragDelta({ x: 0, y: 0 });
  }, []);

  // Handle multi-drag move - update preview delta for live visual feedback
  const handleMultiDragMove = useCallback((delta: Point) => {
    setMultiDragDelta(delta);
  }, []);

  // Handle multi-item drag end - applies delta to all selected items
  const handleMultiDragEnd = useCallback((delta: Point) => {
    // Clear preview state
    setIsDraggingMulti(false);
    setMultiDragDelta({ x: 0, y: 0 });

    if (delta.x === 0 && delta.y === 0) return;

    // Update all selected rooms
    if (selectedRoomIds.size > 0) {
      setRooms(prevRooms => prevRooms.map(room => {
        if (selectedRoomIds.has(room.id)) {
          return {
            ...room,
            vertices: room.vertices.map(v => ({
              x: snapToGrid(v.x + delta.x),
              y: snapToGrid(v.y + delta.y),
            })),
          };
        }
        return room;
      }));
    }

    // Update all selected doors
    if (selectedDoorIds.size > 0) {
      setDoors(prevDoors => prevDoors.map(door => {
        if (selectedDoorIds.has(door.id)) {
          return {
            ...door,
            position: {
              x: snapToGrid(door.position.x + delta.x),
              y: snapToGrid(door.position.y + delta.y),
            },
          };
        }
        return door;
      }));
    }

    // Update all selected windows
    if (selectedWindowIds.size > 0) {
      setWindows(prevWindows => prevWindows.map(win => {
        if (selectedWindowIds.has(win.id)) {
          return {
            ...win,
            position: {
              x: snapToGrid(win.position.x + delta.x),
              y: snapToGrid(win.position.y + delta.y),
            },
          };
        }
        return win;
      }));
    }

    // Update all selected furniture
    if (selectedFurnitureIds.size > 0) {
      setFurniture(prevFurniture => prevFurniture.map(furn => {
        if (selectedFurnitureIds.has(furn.id)) {
          return {
            ...furn,
            position: {
              x: snapToGrid(furn.position.x + delta.x),
              y: snapToGrid(furn.position.y + delta.y),
            },
          };
        }
        return furn;
      }));
    }

    isDraggingOrResizing.current = false;
    setTimeout(() => saveToHistory(), 50);
  }, [selectedRoomIds, selectedDoorIds, selectedWindowIds, selectedFurnitureIds, snapToGrid, saveToHistory]);

  // Handle room drag start
  const handleRoomDragStart = useCallback(() => {
    isDraggingOrResizing.current = true;
  }, []);

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

    // End drag and save history
    isDraggingOrResizing.current = false;
    setTimeout(() => saveToHistory(), 50);
  }, [rooms, snapToGrid, logMove, saveToHistory]);

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

    // End resize and save history
    isDraggingOrResizing.current = false;
    setTimeout(() => saveToHistory(), 50);
  }, [rooms, snapToGrid, pixelsPerFoot, logResize, saveToHistory]);

  // Handle vertex drag (vertexIndex === -1 means move all vertices by delta)
  const handleVertexDrag = useCallback((roomId: string, vertexIndex: number, newPos: Point) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    // Special case: vertexIndex === -1 means move entire polygon by delta
    if (vertexIndex === -1) {
      const delta = newPos; // newPos contains the delta {x, y}
      const previousPos = room.vertices[0];
      setRooms(rooms.map(r => {
        if (r.id === roomId) {
          const newVertices = r.vertices.map(v => ({
            x: v.x + delta.x,
            y: v.y + delta.y,
          }));
          return { ...r, vertices: newVertices };
        }
        return r;
      }));
      logMove("room", roomId, previousPos, { x: previousPos.x + delta.x, y: previousPos.y + delta.y });
      // Save history after polygon move
      isDraggingOrResizing.current = false;
      setTimeout(() => saveToHistory(), 50);
      return;
    }

    const previousPos = room.vertices[vertexIndex] || { x: 0, y: 0 };

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
    // Save history after vertex move
    isDraggingOrResizing.current = false;
    setTimeout(() => saveToHistory(), 50);
  }, [rooms, calculatePolygonArea, logVertexMove, logMove, saveToHistory]);

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

  // Add boundary point
  const handleAddBoundaryPoint = useCallback((afterIndex: number, point: Point) => {
    const snapped = { x: snapToGrid(point.x), y: snapToGrid(point.y) };
    const constrained = constrainToCanvas(snapped);

    setAduBoundary(prev => {
      const newBoundary = [...prev];
      newBoundary.splice(afterIndex + 1, 0, constrained);
      return newBoundary;
    });
  }, [snapToGrid, constrainToCanvas]);

  // Remove boundary point (on double-click)
  const handleRemoveBoundaryPoint = useCallback((index: number) => {
    setAduBoundary(prev => {
      if (prev.length <= 3) return prev; // Must have at least 3 points
      return prev.filter((_, i) => i !== index);
    });
    setSelectedBoundaryPointIndex(null);
  }, []);

  // Delete handlers - supports single and batch delete with backend API
  const handleConfirmDelete = useCallback(async () => {
    // Batch delete
    if (deleteDialog.type === "batch" && deleteDialog.ids) {
      const { rooms: roomIds, doors: doorIds, windows: windowIds, furniture: furnitureIds } = deleteDialog.ids;

      // Delete from backend (fire and forget, don't block UI)
      if (blueprintId) {
        roomIds.forEach(id => api.deleteRoom(id).catch(console.error));
        doorIds.forEach(id => api.deleteDoor(id).catch(console.error));
        windowIds.forEach(id => api.deleteWindow(id).catch(console.error));
        furnitureIds.forEach(id => api.deleteFurniture(id).catch(console.error));
      }

      // Update local state
      if (roomIds.length > 0) {
        setRooms(rooms.filter(r => !roomIds.includes(r.id)));
        roomIds.forEach(id => logDelete("room", id, {}));
      }
      if (doorIds.length > 0) {
        setDoors(doors.filter(d => !doorIds.includes(d.id)));
        doorIds.forEach(id => logDelete("door", id, {}));
      }
      if (windowIds.length > 0) {
        setWindows(windows.filter(w => !windowIds.includes(w.id)));
        windowIds.forEach(id => logDelete("window", id, {}));
      }
      if (furnitureIds.length > 0) {
        setFurniture(furniture.filter(f => !furnitureIds.includes(f.id)));
        furnitureIds.forEach(id => logDelete("furniture", id, {}));
      }

      // Clear selections
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedFurnitureId(null);
      setSelectedRoomIds(new Set());
      setSelectedDoorIds(new Set());
      setSelectedWindowIds(new Set());
      setSelectedFurnitureIds(new Set());

      setDeleteDialog({ open: false, type: null, id: null, name: "" });
      return;
    }

    // Single delete
    if (!deleteDialog.id || !deleteDialog.type) return;

    switch (deleteDialog.type) {
      case "room":
        if (blueprintId) api.deleteRoom(deleteDialog.id).catch(console.error);
        setRooms(rooms.filter(r => r.id !== deleteDialog.id));
        if (selectedRoomId === deleteDialog.id) setSelectedRoomId(null);
        selectedRoomIds.delete(deleteDialog.id);
        setSelectedRoomIds(new Set(selectedRoomIds));
        logDelete("room", deleteDialog.id, {});
        break;
      case "door":
        if (blueprintId) api.deleteDoor(deleteDialog.id).catch(console.error);
        setDoors(doors.filter(d => d.id !== deleteDialog.id));
        if (selectedDoorId === deleteDialog.id) setSelectedDoorId(null);
        selectedDoorIds.delete(deleteDialog.id);
        setSelectedDoorIds(new Set(selectedDoorIds));
        logDelete("door", deleteDialog.id, {});
        break;
      case "window":
        if (blueprintId) api.deleteWindow(deleteDialog.id).catch(console.error);
        setWindows(windows.filter(w => w.id !== deleteDialog.id));
        if (selectedWindowId === deleteDialog.id) setSelectedWindowId(null);
        selectedWindowIds.delete(deleteDialog.id);
        setSelectedWindowIds(new Set(selectedWindowIds));
        logDelete("window", deleteDialog.id, {});
        break;
      case "furniture":
        if (blueprintId) api.deleteFurniture(deleteDialog.id).catch(console.error);
        setFurniture(furniture.filter(f => f.id !== deleteDialog.id));
        if (selectedFurnitureId === deleteDialog.id) setSelectedFurnitureId(null);
        selectedFurnitureIds.delete(deleteDialog.id);
        setSelectedFurnitureIds(new Set(selectedFurnitureIds));
        logDelete("furniture", deleteDialog.id, {});
        break;
    }
    setDeleteDialog({ open: false, type: null, id: null, name: "" });
  }, [deleteDialog, rooms, doors, windows, furniture, selectedRoomId, selectedDoorId, selectedWindowId, selectedFurnitureId, selectedRoomIds, selectedDoorIds, selectedWindowIds, selectedFurnitureIds, blueprintId, logDelete]);

  // Rotate handlers - supports both rectangles and polygons
  const rotateSelectedRoom = useCallback(() => {
    if (!selectedRoomId) return;
    setRooms(rooms.map((room) => {
      if (room.id !== selectedRoomId) return room;

      // Calculate centroid
      const centerX = room.vertices.reduce((sum, v) => sum + v.x, 0) / room.vertices.length;
      const centerY = room.vertices.reduce((sum, v) => sum + v.y, 0) / room.vertices.length;

      // Rotate all vertices 90 degrees clockwise around centroid
      const rotatedVertices = room.vertices.map(v => {
        // Translate to origin
        const dx = v.x - centerX;
        const dy = v.y - centerY;
        // Rotate 90 degrees clockwise: (x, y) -> (y, -x)
        const rotatedX = dy;
        const rotatedY = -dx;
        // Translate back and snap to grid
        return {
          x: snapToGrid(centerX + rotatedX),
          y: snapToGrid(centerY + rotatedY),
        };
      });

      // For rectangles, normalize vertex order to: top-left, top-right, bottom-right, bottom-left
      // This ensures consistent rendering and prevents negative width/height after rotation
      let newVertices = rotatedVertices;
      if (room.vertices.length === 4) {
        const minX = Math.min(...rotatedVertices.map(v => v.x));
        const minY = Math.min(...rotatedVertices.map(v => v.y));
        const maxX = Math.max(...rotatedVertices.map(v => v.x));
        const maxY = Math.max(...rotatedVertices.map(v => v.y));
        newVertices = [
          { x: minX, y: minY }, // top-left
          { x: maxX, y: minY }, // top-right
          { x: maxX, y: maxY }, // bottom-right
          { x: minX, y: maxY }, // bottom-left
        ];
      }

      return { ...room, vertices: newVertices };
    }));
  }, [selectedRoomId, rooms, snapToGrid]);

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

  // ADU size slider handler - snaps to grid while maintaining center
  const handleAduSizeChange = useCallback((sqFt: number) => {
    // Calculate the true center (don't snap it - this prevents drift)
    const centerX = (aduBoundary[0].x + aduBoundary[2].x) / 2;
    const centerY = (aduBoundary[0].y + aduBoundary[2].y) / 2;

    // Snap the side length to grid increments
    const sideLength = Math.sqrt(sqFt) * pixelsPerFoot;
    const snappedSideLength = snapToGrid(sideLength);
    const halfSide = snappedSideLength / 2;

    // Build boundary from center outward (symmetric expansion)
    const newBoundary = [
      constrainToCanvas({ x: centerX - halfSide, y: centerY - halfSide }),
      constrainToCanvas({ x: centerX + halfSide, y: centerY - halfSide }),
      constrainToCanvas({ x: centerX + halfSide, y: centerY + halfSide }),
      constrainToCanvas({ x: centerX - halfSide, y: centerY + halfSide }),
    ];

    setAduBoundary(newBoundary);
  }, [aduBoundary, pixelsPerFoot, constrainToCanvas, snapToGrid]);

  // Calculate ADU area
  const aduArea = calculatePolygonArea(aduBoundary);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      // Delete selected items (batch or single)
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();

        // Check for multi-selection first
        const totalSelected = selectedRoomIds.size + selectedDoorIds.size + selectedWindowIds.size + selectedFurnitureIds.size;
        if (totalSelected > 0) {
          const itemCount = totalSelected;
          setDeleteDialog({
            open: true,
            type: "batch",
            id: null,
            ids: {
              rooms: Array.from(selectedRoomIds),
              doors: Array.from(selectedDoorIds),
              windows: Array.from(selectedWindowIds),
              furniture: Array.from(selectedFurnitureIds),
            },
            name: `${itemCount} item${itemCount > 1 ? 's' : ''}`,
          });
          return;
        }

        // Single selection delete
        if (selectedRoomId) {
          const room = rooms.find(r => r.id === selectedRoomId);
          if (room) setDeleteDialog({ open: true, type: "room", id: selectedRoomId, name: room.name });
        } else if (selectedDoorId) {
          const door = doors.find(d => d.id === selectedDoorId);
          if (door) setDeleteDialog({ open: true, type: "door", id: selectedDoorId, name: DOOR_CONFIGS[door.type].label });
        } else if (selectedWindowId) {
          const win = windows.find(w => w.id === selectedWindowId);
          if (win) setDeleteDialog({ open: true, type: "window", id: selectedWindowId, name: WINDOW_CONFIGS[win.type].label });
        } else if (selectedFurnitureId) {
          const furn = furniture.find(f => f.id === selectedFurnitureId);
          if (furn) setDeleteDialog({ open: true, type: "furniture", id: selectedFurnitureId, name: FURNITURE_CONFIG[furn.type].name });
        }
        return;
      }

      // Escape: Deselect / Cancel
      if (key === 'escape') {
        e.preventDefault();
        setSelectedRoomId(null);
        setSelectedDoorId(null);
        setSelectedWindowId(null);
        setSelectedFurnitureId(null);
        setSelectedBoundaryPointIndex(null);
        if (isDrawing) cancelPolygon();
        return;
      }

      // R: Rotate selected (rooms, doors, windows, furniture)
      if (key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (selectedRoomId) rotateSelectedRoom();
        else if (selectedDoorId) rotateSelectedDoor();
        else if (selectedWindowId) rotateSelectedWindow();
        else if (selectedFurnitureId) rotateSelectedFurniture();
        return;
      }

      // G: Toggle grid
      if (key === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowGrid(!showGrid);
        return;
      }

      // Mode shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (key === 'v') { e.preventDefault(); setPlacementMode("select"); cancelPolygon(); }
        if (key === 'b') { e.preventDefault(); setPlacementMode("room"); }
        if (key === 'd') { e.preventDefault(); setPlacementMode("door"); }
        if (key === 'w') { e.preventDefault(); setPlacementMode("window"); }
        if (key === 'f') { e.preventDefault(); setPlacementMode("furniture"); }
      }

      // Arrow keys: Nudge
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        const nudgeAmount = e.shiftKey ? gridSize : gridSize / 2;
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo, redo, rooms, doors, windows, furniture, selectedRoomId, selectedDoorId,
    selectedWindowId, selectedFurnitureId, selectedRoomIds, selectedDoorIds,
    selectedWindowIds, selectedFurnitureIds, isDrawing, cancelPolygon, rotateSelectedRoom,
    rotateSelectedDoor, rotateSelectedWindow, rotateSelectedFurniture, showGrid, gridSize
  ]);

  return (
    <div className="flex justify-center">
      <div className="space-y-3">
        {/* Top Toolbar - spans full width aligned with grid */}
        <Card className="p-3 shadow-md">
          <div className="flex items-center gap-4 flex-wrap">
            {/* ADU Size */}
            <div className="flex items-center gap-3 flex-1 min-w-[300px]">
              <Label className="text-sm font-semibold whitespace-nowrap">ADU Size</Label>
              <Slider
                value={[Math.round(aduArea)]}
                min={200}
                max={1200}
                step={50}
                onValueChange={([value]) => handleAduSizeChange(value)}
                className="flex-1"
              />
              <span className="text-sm font-medium text-primary w-16 text-right">{Math.round(aduArea)} sf</span>
              <Button
                variant={editBoundaryMode ? "default" : "outline"}
                size="sm"
                onClick={() => setEditBoundaryMode(!editBoundaryMode)}
                className="text-xs"
              >
                {editBoundaryMode ? "Done" : "Edit Shape"}
              </Button>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-border hidden sm:block" />

            {/* Undo/Redo */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
                className="h-8 w-8 p-0"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="h-8 w-8 p-0"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-border hidden sm:block" />

            {/* Save & Cloud Status */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  saveNow(); // Save to cloud
                  saveManualSnapshot("Manual save"); // Also create local snapshot
                }}
                disabled={isSaving}
                className="h-8 w-8 p-0"
                title="Save now"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
              <RestoreDropdown
                autoSaves={autoSaves}
                manualSaves={manualSaves}
                onRestore={restoreSnapshot}
                onSaveManual={saveManualSnapshot}
                onDelete={deleteSnapshot}
                formatTimestamp={formatTimestamp}
                getTimeAgo={getTimeAgo}
              />
              <div className="flex items-center gap-1.5">
                {saveError ? (
                  <CloudOff className="h-4 w-4 text-destructive" />
                ) : lastSavedAt ? (
                  <Cloud className="h-4 w-4 text-green-500" />
                ) : (
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">
                  {isSaving ? "Saving..." : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Not saved"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Auto</Label>
                <Switch
                  checked={autoSaveEnabled}
                  onCheckedChange={setAutoSaveEnabled}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Main 3-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_auto_280px] gap-4 items-start">
          {/* Left Column - Tools/Controls */}
          <DraggablePanelContainer
          storageKey="floor-plan-left-sidebar-order"
          panelIds={["mode", "tool", "lot"]}
          className="space-y-3"
        >
          {/* Mode Selector */}
          <div key="mode">
            <ModeSelector
              placementMode={placementMode}
              onModeChange={setPlacementMode}
              onCancelDrawing={cancelPolygon}
            />
          </div>

          {/* Tool Selector - Shows based on current mode */}
          <div key="tool">
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
              <DoorSelector onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
            )}

            {/* Window Mode Controls */}
            {placementMode === "window" && (
              <WindowSelector onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
            )}

            {/* Furniture Mode Controls */}
            {placementMode === "furniture" && (
              <FurnitureSelector
                snapMode={furnitureSnapMode}
                onSnapModeChange={setFurnitureSnapMode}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            )}
          </div>

          {/* Lot Selector - Always visible */}
          <div key="lot">
            <LotSelector
              lot={lot}
              showOverlay={showLotOverlay}
              showSatellite={showSatelliteView}
              showLotBoundary={showLotBoundary}
              loading={lotLoading}
              error={lotError}
              addressResults={addressResults}
              onToggleOverlay={setShowLotOverlay}
              onToggleSatellite={setShowSatelliteView}
              onToggleLotBoundary={setShowLotBoundary}
              onSearchAddress={searchAddresses}
              onSelectAddress={handleSelectAddress}
              onFetchParcel={fetchParcelData}
              onUpdatePosition={(x, y, r) => {
                // Clear preview when server update happens
                setPreviewOffsetX(null);
                setPreviewOffsetY(null);
                if (r !== undefined) setPreviewRotation(null);
                updateAduPosition(x, y, r);
              }}
              onUpdateSetbacks={updateSetbacks}
              onUpdateLotDimensions={updateLotDimensions}
              onRemoveLot={removeLot}
              onClearAddressResults={clearAddressResults}
              onPreviewPosition={(x, y) => {
                setPreviewOffsetX(x);
                setPreviewOffsetY(y);
              }}
              onPreviewRotation={setPreviewRotation}
              isDrawingLotBoundary={isDrawingLotBoundary}
              onStartDrawingLotBoundary={startLotBoundaryDrawing}
              onCancelDrawingLotBoundary={cancelLotBoundaryDrawing}
            />
          </div>
        </DraggablePanelContainer>

        {/* Center Column - Canvas */}
        <div className="flex justify-center">
          <div
          ref={canvasContainerRef}
          className="relative bg-white rounded-lg border shadow-md overflow-hidden"
          style={{ width: displaySize, height: displaySize }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onContextMenu={(e) => e.preventDefault()}
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
              if (isDrawingLotBoundary) {
                handleLotBoundaryClick(e, zoom, panOffset);
              } else {
                handlePanStart(e);
                handleMouseDown(e);
              }
            }}
            onMouseMove={(e) => {
              if (isDrawingLotBoundary) {
                handleLotBoundaryMouseMove(e, zoom, panOffset);
              } else {
                handlePanMove(e);
                handleMarqueeMove(e);
                drawingMouseMove(e);
              }
            }}
            onMouseUp={() => {
              if (!isDrawingLotBoundary) {
                handlePanEnd();
                handleMarqueeEnd();
                drawingMouseUp();
              }
            }}
            onWheel={handleWheel}
          >
            <Layer>
              {/* Click catcher - invisible rect to catch clicks on empty canvas space */}
              <Rect
                x={-10000}
                y={-10000}
                width={20000}
                height={20000}
                fill="transparent"
                name="click-catcher"
              />

              {/* Grid - behind satellite when not in satellite mode */}
              {!showSatelliteView && (
                <Grid config={config} showGrid={showGrid} zoom={zoom} panOffset={panOffset} />
              )}

              {/* Lot Overlay (behind ADU boundary) */}
              {lot && showLotOverlay && (
                <LotOverlay
                  config={config}
                  lot={lot}
                  aduBoundary={aduBoundary}
                  canvasCenter={canvasCenter}
                  visible={showLotOverlay}
                  showSatellite={showSatelliteView}
                  showLotBoundary={showLotBoundary}
                />
              )}

              {/* Grid - on top of satellite when in satellite mode (more visible styling) */}
              {showSatelliteView && (
                <Grid config={config} showGrid={showGrid} zoom={zoom} panOffset={panOffset} overSatellite />
              )}

              {/* Lot Boundary Drawing Preview */}
              {isDrawingLotBoundary && (
                <LotBoundaryDrawing
                  points={lotBoundaryPoints}
                  previewPoint={lotBoundaryPreviewPoint}
                  isDrawing={isDrawingLotBoundary}
                />
              )}

              {/* ADU Content Group - offset and rotated when lot is loaded */}
              <Group
                x={lot ? canvasCenter.x + (previewOffsetX ?? lot.aduOffsetX ?? 0) * pixelsPerFoot : 0}
                y={lot ? canvasCenter.y + (previewOffsetY ?? lot.aduOffsetY ?? 0) * pixelsPerFoot : 0}
                rotation={lot ? (previewRotation ?? lot.aduRotation ?? 0) : 0}
                offsetX={lot ? canvasCenter.x : 0}
                offsetY={lot ? canvasCenter.y : 0}
              >
                {/* ADU Boundary */}
                <ADUBoundary
                  config={config}
                  boundary={aduBoundary}
                  editMode={editBoundaryMode}
                  selectedPointIndex={selectedBoundaryPointIndex}
                  onPointDrag={handleBoundaryPointDrag}
                  onPointSelect={setSelectedBoundaryPointIndex}
                  onAddPoint={handleAddBoundaryPoint}
                  onRemovePoint={handleRemoveBoundaryPoint}
                />

                {/* Rooms */}
                <Rooms
                config={config}
                rooms={rooms}
                doors={doors}
                windows={windows}
                selectedRoomId={selectedRoomId}
                selectedRoomIds={selectedRoomIds}
                onRoomClick={(id, e) => {
                  // Prevent selection when drawing polygon
                  if (placementMode === "room" && drawMode === "polygon") return;

                  // Check for Ctrl/Cmd click for multi-selection
                  const isCtrlClick = e?.evt && ('ctrlKey' in e.evt || 'metaKey' in e.evt)
                    && (e.evt.ctrlKey || e.evt.metaKey);

                  if (isCtrlClick) {
                    // Toggle in multi-selection
                    setSelectedRoomIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) {
                        next.delete(id);
                      } else {
                        next.add(id);
                      }
                      return next;
                    });
                    // Clear single selection when using multi-select
                    setSelectedRoomId(null);
                  } else {
                    // Normal click - clear multi-selection and set single
                    setSelectedRoomIds(new Set());
                    setSelectedDoorIds(new Set());
                    setSelectedWindowIds(new Set());
                    setSelectedFurnitureIds(new Set());
                    setSelectedRoomId(id);
                  }
                }}
                onDragStart={handleRoomDragStart}
                onRoomDragEnd={handleRoomDragEnd}
                onRoomTransform={handleRoomTransform}
                onVertexDrag={handleVertexDrag}
                onVertexRemove={handleVertexRemove}
                onAddVertex={(roomId, afterIndex, newPos) => {
                  const room = rooms.find(r => r.id === roomId);
                  if (!room) return;
                  const newVertices = [...room.vertices];
                  newVertices.splice(afterIndex + 1, 0, newPos);
                  const newArea = calculatePolygonArea(newVertices);
                  setRooms(rooms.map(r =>
                    r.id === roomId
                      ? { ...r, vertices: newVertices, area: Math.round(newArea) }
                      : r
                  ));
                }}
                multiDragDelta={isDraggingMulti ? multiDragDelta : undefined}
                onMultiDragStart={handleMultiDragStart}
                onMultiDragMove={handleMultiDragMove}
                onMultiDragEnd={handleMultiDragEnd}
                transformerRef={transformerRef}
                roomRefs={roomRefs}
                zoom={zoom}
              />

              {/* Doors */}
              <Doors
                config={config}
                doors={doors}
                selectedDoorId={selectedDoorId}
                selectedDoorIds={selectedDoorIds}
                onDoorClick={(id, e) => {
                  // Prevent selection when drawing polygon
                  if (placementMode === "room" && drawMode === "polygon") return;

                  // Check for Ctrl/Cmd click for multi-selection
                  const isCtrlClick = e?.evt && ('ctrlKey' in e.evt || 'metaKey' in e.evt)
                    && (e.evt.ctrlKey || e.evt.metaKey);

                  if (isCtrlClick) {
                    // Toggle in multi-selection
                    setSelectedDoorIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) {
                        next.delete(id);
                      } else {
                        next.add(id);
                      }
                      return next;
                    });
                    // Clear single selection when using multi-select
                    setSelectedDoorId(null);
                  } else {
                    // Normal click - clear multi-selection and set single
                    setSelectedRoomIds(new Set());
                    setSelectedDoorIds(new Set());
                    setSelectedWindowIds(new Set());
                    setSelectedFurnitureIds(new Set());
                    setSelectedDoorId(id);
                  }
                }}
                onDoorDragEnd={(id, pos) => {
                  setDoors(doors.map(d => d.id === id ? { ...d, position: pos } : d));
                  isDraggingOrResizing.current = false;
                  setTimeout(() => saveToHistory(), 50);
                }}
                onOpeningTransform={(id, newWidth, newPosition) => {
                  setDoors(doors.map(d => d.id === id ? { ...d, width: newWidth, position: newPosition } : d));
                  isDraggingOrResizing.current = false;
                  setTimeout(() => saveToHistory(), 50);
                }}
                multiDragDelta={isDraggingMulti ? multiDragDelta : undefined}
                onMultiDragStart={handleMultiDragStart}
                onMultiDragMove={handleMultiDragMove}
                onMultiDragEnd={handleMultiDragEnd}
                openingTransformerRef={openingTransformerRef}
                openingRefs={openingRefs}
                zoom={zoom}
              />

              {/* Windows */}
              <Windows
                config={config}
                windows={windows}
                selectedWindowId={selectedWindowId}
                selectedWindowIds={selectedWindowIds}
                onWindowClick={(id, e) => {
                  // Prevent selection when drawing polygon
                  if (placementMode === "room" && drawMode === "polygon") return;

                  // Check for Ctrl/Cmd click for multi-selection
                  const isCtrlClick = e?.evt && ('ctrlKey' in e.evt || 'metaKey' in e.evt)
                    && (e.evt.ctrlKey || e.evt.metaKey);

                  if (isCtrlClick) {
                    // Toggle in multi-selection
                    setSelectedWindowIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) {
                        next.delete(id);
                      } else {
                        next.add(id);
                      }
                      return next;
                    });
                    // Clear single selection when using multi-select
                    setSelectedWindowId(null);
                  } else {
                    // Normal click - clear multi-selection and set single
                    setSelectedRoomIds(new Set());
                    setSelectedDoorIds(new Set());
                    setSelectedWindowIds(new Set());
                    setSelectedFurnitureIds(new Set());
                    setSelectedWindowId(id);
                  }
                }}
                onWindowDragEnd={(id, pos) => {
                  setWindows(windows.map(w => w.id === id ? { ...w, position: pos } : w));
                  isDraggingOrResizing.current = false;
                  setTimeout(() => saveToHistory(), 50);
                }}
                onWindowTransform={(id, width, pos) => {
                  setWindows(windows.map(w => w.id === id ? { ...w, width, ...(pos && { position: pos }) } : w));
                  isDraggingOrResizing.current = false;
                  setTimeout(() => saveToHistory(), 50);
                }}
                multiDragDelta={isDraggingMulti ? multiDragDelta : undefined}
                onMultiDragStart={handleMultiDragStart}
                onMultiDragMove={handleMultiDragMove}
                onMultiDragEnd={handleMultiDragEnd}
                transformerRef={windowTransformerRef}
                windowRefs={windowRefs}
                zoom={zoom}
              />

              {/* Furniture */}
              <Furniture
                config={config}
                furniture={furniture}
                furnitureImages={furnitureImages}
                selectedFurnitureId={selectedFurnitureId}
                selectedFurnitureIds={selectedFurnitureIds}
                snapMode={furnitureSnapMode}
                onFurnitureClick={(id, e) => {
                  // Prevent selection when drawing polygon
                  if (placementMode === "room" && drawMode === "polygon") return;

                  // Check for Ctrl/Cmd click for multi-selection
                  const isCtrlClick = e?.evt && ('ctrlKey' in e.evt || 'metaKey' in e.evt)
                    && (e.evt.ctrlKey || e.evt.metaKey);

                  if (isCtrlClick) {
                    // Toggle in multi-selection
                    setSelectedFurnitureIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) {
                        next.delete(id);
                      } else {
                        next.add(id);
                      }
                      return next;
                    });
                    // Clear single selection when using multi-select
                    setSelectedFurnitureId(null);
                  } else {
                    // Normal click - clear multi-selection and set single
                    setSelectedRoomIds(new Set());
                    setSelectedDoorIds(new Set());
                    setSelectedWindowIds(new Set());
                    setSelectedFurnitureIds(new Set());
                    setSelectedFurnitureId(id);
                  }
                }}
                onFurnitureDragEnd={(id, pos) => {
                  setFurniture(furniture.map(f => f.id === id ? { ...f, position: pos } : f));
                  isDraggingOrResizing.current = false;
                  setTimeout(() => saveToHistory(), 50);
                }}
                multiDragDelta={isDraggingMulti ? multiDragDelta : undefined}
                onMultiDragStart={handleMultiDragStart}
                onMultiDragMove={handleMultiDragMove}
                onMultiDragEnd={handleMultiDragEnd}
                zoom={zoom}
              />

                {/* Drawing Preview */}
                <DrawingPreview
                  config={config}
                  drawMode={drawMode}
                  selectedRoomType={selectedRoomType}
                  isDrawing={isDrawing}
                  currentRect={currentRect}
                  polygonPoints={polygonPoints}
                />
              </Group>

              {/* Marquee Selection */}
              <MarqueeSelection
                isSelecting={isMarqueeSelecting}
                startPoint={marqueeStart}
                endPoint={marqueeEnd}
              />
            </Layer>
          </Stage>
        </div>
      </div>

        {/* Right Column - Lists */}
        <div className="space-y-3">
          {/* Multi-selection indicator and batch delete - not draggable */}
          {(selectedRoomIds.size + selectedDoorIds.size + selectedWindowIds.size + selectedFurnitureIds.size) > 0 && (
            <Card className="p-3 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium text-blue-700">
                    {selectedRoomIds.size + selectedDoorIds.size + selectedWindowIds.size + selectedFurnitureIds.size} items selected
                  </span>
                  <span className="text-blue-600 text-xs block">
                    Press DEL to delete or drag-select more
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedRoomIds(new Set());
                      setSelectedDoorIds(new Set());
                      setSelectedWindowIds(new Set());
                      setSelectedFurnitureIds(new Set());
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const totalSelected = selectedRoomIds.size + selectedDoorIds.size + selectedWindowIds.size + selectedFurnitureIds.size;
                      setDeleteDialog({
                        open: true,
                        type: "batch",
                        id: null,
                        ids: {
                          rooms: Array.from(selectedRoomIds),
                          doors: Array.from(selectedDoorIds),
                          windows: Array.from(selectedWindowIds),
                          furniture: Array.from(selectedFurnitureIds),
                        },
                        name: `${totalSelected} item${totalSelected > 1 ? 's' : ''}`,
                      });
                    }}
                  >
                    Delete All
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Draggable panel container for right sidebar lists */}
          <DraggablePanelContainer
            storageKey={`editor-right-sidebar-order-${blueprintId ?? 'default'}`}
            panelIds={['adu-summary', 'room-list', 'door-list', 'window-list', 'furniture-list']}
            className="space-y-3"
          >
            {/* ADU Summary */}
            <div key="adu-summary">
              <ADUSummary
                rooms={rooms}
                doors={doors}
                windows={windows}
                totalArea={totalArea}
                aduBoundaryArea={aduArea}
              />
            </div>

            {/* Room List */}
            <div key="room-list">
              <RoomList
                rooms={rooms}
                selectedRoomId={selectedRoomId}
                selectedRoomIds={selectedRoomIds}
                onSelectRoom={(id, e) => {
                  const isCtrlClick = e && (e.ctrlKey || e.metaKey);
                  if (isCtrlClick) {
                    setSelectedRoomIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                    setSelectedRoomId(null);
                  } else {
                    setSelectedRoomIds(new Set());
                    setSelectedDoorIds(new Set());
                    setSelectedWindowIds(new Set());
                    setSelectedFurnitureIds(new Set());
                    setSelectedRoomId(id);
                  }
                }}
                onDeleteRoom={(id, name) => setDeleteDialog({ open: true, type: "room", id, name })}
                onRotateRoom={rotateSelectedRoom}
                roomDescriptions={roomDescriptions}
                onRoomDescriptionChange={(roomId, description) => {
                  const newDescriptions = new Map(roomDescriptions);
                  newDescriptions.set(roomId, description);
                  setRoomDescriptions(newDescriptions);
                }}
              />
            </div>

            {/* Door List */}
            <div key="door-list">
              <DoorList
                doors={doors}
                selectedDoorId={selectedDoorId}
                selectedDoorIds={selectedDoorIds}
                onSelectDoor={(id, e) => {
                  const isCtrlClick = e && (e.ctrlKey || e.metaKey);
                  if (isCtrlClick) {
                    setSelectedDoorIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                    setSelectedDoorId(null);
                  } else {
                    setSelectedRoomIds(new Set());
                    setSelectedDoorIds(new Set());
                    setSelectedWindowIds(new Set());
                    setSelectedFurnitureIds(new Set());
                    setSelectedDoorId(id);
                  }
                }}
                onDeleteDoor={(id, name) => setDeleteDialog({ open: true, type: "door", id, name })}
                onRotateDoor={rotateSelectedDoor}
              />
            </div>

            {/* Window List */}
            <div key="window-list">
              <WindowList
                windows={windows}
                selectedWindowId={selectedWindowId}
                selectedWindowIds={selectedWindowIds}
                onSelectWindow={(id, e) => {
                  const isCtrlClick = e && (e.ctrlKey || e.metaKey);
                  if (isCtrlClick) {
                    setSelectedWindowIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                    setSelectedWindowId(null);
                  } else {
                    setSelectedRoomIds(new Set());
                    setSelectedDoorIds(new Set());
                    setSelectedWindowIds(new Set());
                    setSelectedFurnitureIds(new Set());
                    setSelectedWindowId(id);
                  }
                }}
                onDeleteWindow={(id, name) => setDeleteDialog({ open: true, type: "window", id, name })}
                onRotateWindow={rotateSelectedWindow}
              />
            </div>

            {/* Furniture List */}
            <div key="furniture-list">
              <FurnitureList
                furniture={furniture}
                selectedFurnitureId={selectedFurnitureId}
                selectedFurnitureIds={selectedFurnitureIds}
                onSelectFurniture={(id, e) => {
                  const isCtrlClick = e && (e.ctrlKey || e.metaKey);
                  if (isCtrlClick) {
                    setSelectedFurnitureIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                    setSelectedFurnitureId(null);
                  } else {
                    setSelectedRoomIds(new Set());
                    setSelectedDoorIds(new Set());
                    setSelectedWindowIds(new Set());
                    setSelectedFurnitureIds(new Set());
                    setSelectedFurnitureId(id);
                  }
                }}
                onDeleteFurniture={(id, name) => setDeleteDialog({ open: true, type: "furniture", id, name })}
                onRotateFurniture={rotateSelectedFurniture}
              />
            </div>
          </DraggablePanelContainer>
        </div>
      </div>
    </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ ...deleteDialog, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {deleteDialog.type === "batch" ? "Delete selected items?" : `Delete ${deleteDialog.type}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.type === "batch" && deleteDialog.ids ? (
                <>
                  Are you sure you want to delete {deleteDialog.name}?
                  {deleteDialog.ids.rooms.length > 0 && <span className="block text-sm">• {deleteDialog.ids.rooms.length} room(s)</span>}
                  {deleteDialog.ids.doors.length > 0 && <span className="block text-sm">• {deleteDialog.ids.doors.length} door(s)</span>}
                  {deleteDialog.ids.windows.length > 0 && <span className="block text-sm">• {deleteDialog.ids.windows.length} window(s)</span>}
                  {deleteDialog.ids.furniture.length > 0 && <span className="block text-sm">• {deleteDialog.ids.furniture.length} furniture item(s)</span>}
                  <span className="block mt-2">This action cannot be undone.</span>
                </>
              ) : (
                <>Are you sure you want to delete &quot;{deleteDialog.name}&quot;? This action cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Delete
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
        lot={lot}
        blueprintId={blueprintId ?? undefined}
        projectName="ADU Floor Plan"
        address={lot?.address}
      />

    </div>
  );
}

export default FloorPlanEditor;
