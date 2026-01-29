import { useState, useCallback } from "react";
import type { Room, Door, Window, Point, RoomType, DoorType, WindowType } from "@/lib/types";
import type { Furniture, FurnitureType, CanvasConfig, PlacementMode } from "../types";
import { ROOM_CONFIGS, DOOR_CONFIGS, WINDOW_CONFIGS } from "@/lib/constants";
import { FURNITURE_CONFIG } from "../constants";

interface UseFloorPlanStateOptions {
  config: CanvasConfig;
}

export function useFloorPlanState({ config }: UseFloorPlanStateOptions) {
  const { pixelsPerFoot, extendedCanvasSize } = config;

  // Calculate default boundary position (centered in extended canvas)
  const defaultBoundarySize = Math.sqrt(600) * pixelsPerFoot;
  const defaultOffset = (extendedCanvasSize - defaultBoundarySize) / 2;

  // Core state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
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

  // Room descriptions for "other" type
  const [roomDescriptions, setRoomDescriptions] = useState<Map<string, string>>(new Map());

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedRoomId(null);
    setSelectedDoorId(null);
    setSelectedWindowId(null);
    setSelectedFurnitureId(null);
    setSelectedBoundaryPointIndex(null);
  }, []);

  // Add room
  const addRoom = useCallback((room: Room) => {
    setRooms(prev => [...prev, room]);
  }, []);

  // Update room
  const updateRoom = useCallback((roomId: string, updates: Partial<Room>) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, ...updates } : r));
  }, []);

  // Delete room
  const deleteRoom = useCallback((roomId: string) => {
    setRooms(prev => prev.filter(r => r.id !== roomId));
    if (selectedRoomId === roomId) setSelectedRoomId(null);
  }, [selectedRoomId]);

  // Add door
  const addDoor = useCallback((position: Point, doorType: DoorType) => {
    const doorWidth = DOOR_CONFIGS[doorType].width;
    const newDoor: Door = {
      id: crypto.randomUUID(),
      type: doorType,
      position,
      rotation: 0,
      width: doorWidth,
    };
    setDoors(prev => [...prev, newDoor]);
    return newDoor;
  }, []);

  // Update door
  const updateDoor = useCallback((doorId: string, updates: Partial<Door>) => {
    setDoors(prev => prev.map(d => d.id === doorId ? { ...d, ...updates } : d));
  }, []);

  // Delete door
  const deleteDoor = useCallback((doorId: string) => {
    setDoors(prev => prev.filter(d => d.id !== doorId));
    if (selectedDoorId === doorId) setSelectedDoorId(null);
  }, [selectedDoorId]);

  // Rotate door
  const rotateDoor = useCallback((doorId: string) => {
    setDoors(prev => prev.map(d =>
      d.id === doorId ? { ...d, rotation: (d.rotation + 90) % 360 } : d
    ));
  }, []);

  // Add window
  const addWindow = useCallback((position: Point, windowType: WindowType) => {
    const windowConfig = WINDOW_CONFIGS[windowType];
    const newWindow: Window = {
      id: crypto.randomUUID(),
      type: windowType,
      position,
      rotation: 0,
      width: windowConfig.width,
      height: windowConfig.height,
    };
    setWindows(prev => [...prev, newWindow]);
    return newWindow;
  }, []);

  // Update window
  const updateWindow = useCallback((windowId: string, updates: Partial<Window>) => {
    setWindows(prev => prev.map(w => w.id === windowId ? { ...w, ...updates } : w));
  }, []);

  // Delete window
  const deleteWindow = useCallback((windowId: string) => {
    setWindows(prev => prev.filter(w => w.id !== windowId));
    if (selectedWindowId === windowId) setSelectedWindowId(null);
  }, [selectedWindowId]);

  // Rotate window
  const rotateWindow = useCallback((windowId: string) => {
    setWindows(prev => prev.map(w =>
      w.id === windowId ? { ...w, rotation: (w.rotation + 90) % 360 } : w
    ));
  }, []);

  // Add furniture
  const addFurniture = useCallback((type: FurnitureType, position: Point) => {
    const furnitureConfig = FURNITURE_CONFIG[type];
    const newFurniture: Furniture = {
      id: `furniture-${Date.now()}-${Math.random()}`,
      type,
      position,
      rotation: 0,
      width: furnitureConfig.width,
      height: furnitureConfig.height,
    };
    setFurniture(prev => [...prev, newFurniture]);
    setSelectedFurnitureId(newFurniture.id);
    return newFurniture;
  }, []);

  // Update furniture
  const updateFurniture = useCallback((furnitureId: string, updates: Partial<Furniture>) => {
    setFurniture(prev => prev.map(f => f.id === furnitureId ? { ...f, ...updates } : f));
  }, []);

  // Delete furniture
  const deleteFurniture = useCallback((furnitureId: string) => {
    setFurniture(prev => prev.filter(f => f.id !== furnitureId));
    if (selectedFurnitureId === furnitureId) setSelectedFurnitureId(null);
  }, [selectedFurnitureId]);

  // Rotate furniture
  const rotateFurniture = useCallback((furnitureId: string) => {
    setFurniture(prev => prev.map(f =>
      f.id === furnitureId ? { ...f, rotation: (f.rotation + 90) % 360 } : f
    ));
  }, []);

  // Update boundary point
  const updateBoundaryPoint = useCallback((index: number, point: Point) => {
    setAduBoundary(prev => {
      const newBoundary = [...prev];
      newBoundary[index] = point;
      return newBoundary;
    });
  }, []);

  // Add boundary point
  const addBoundaryPoint = useCallback((afterIndex: number, point: Point) => {
    setAduBoundary(prev => {
      const newBoundary = [...prev];
      newBoundary.splice(afterIndex + 1, 0, point);
      return newBoundary;
    });
  }, []);

  // Remove boundary point
  const removeBoundaryPoint = useCallback((index: number) => {
    if (aduBoundary.length <= 3) {
      return false;
    }
    setAduBoundary(prev => prev.filter((_, i) => i !== index));
    setSelectedBoundaryPointIndex(null);
    return true;
  }, [aduBoundary.length]);

  // Set room description
  const setRoomDescription = useCallback((roomId: string, description: string) => {
    setRoomDescriptions(prev => {
      const newMap = new Map(prev);
      newMap.set(roomId, description);
      return newMap;
    });
  }, []);

  // Restore state from saved data
  const restoreState = useCallback((data: {
    rooms: Room[];
    doors: Door[];
    windows: Window[];
    furniture: Furniture[];
    aduBoundary: Point[];
  }) => {
    setRooms(data.rooms);
    setDoors(data.doors);
    setWindows(data.windows);
    setFurniture(data.furniture);
    setAduBoundary(data.aduBoundary);
    clearSelections();
  }, [clearSelections]);

  return {
    // Core state
    rooms,
    doors,
    windows,
    furniture,
    aduBoundary,

    // Selection state
    selectedRoomId,
    selectedDoorId,
    selectedWindowId,
    selectedFurnitureId,
    selectedBoundaryPointIndex,

    // Mode state
    placementMode,
    selectedRoomType,
    drawMode,
    roomDescriptions,

    // Setters
    setRooms,
    setDoors,
    setWindows,
    setFurniture,
    setAduBoundary,
    setSelectedRoomId,
    setSelectedDoorId,
    setSelectedWindowId,
    setSelectedFurnitureId,
    setSelectedBoundaryPointIndex,
    setPlacementMode,
    setSelectedRoomType,
    setDrawMode,
    setRoomDescription,

    // Actions
    clearSelections,
    addRoom,
    updateRoom,
    deleteRoom,
    addDoor,
    updateDoor,
    deleteDoor,
    rotateDoor,
    addWindow,
    updateWindow,
    deleteWindow,
    rotateWindow,
    addFurniture,
    updateFurniture,
    deleteFurniture,
    rotateFurniture,
    updateBoundaryPoint,
    addBoundaryPoint,
    removeBoundaryPoint,
    restoreState,
  };
}

export type FloorPlanState = ReturnType<typeof useFloorPlanState>;
