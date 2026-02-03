import { useState, useCallback, useRef } from "react";
import type { Point, DoorType, WindowType } from "@/lib/types";
import { DOOR_CONFIGS, WINDOW_CONFIGS } from "@/lib/constants";
import type { FurnitureType, CanvasConfig } from "../types";
import { FURNITURE_CONFIG } from "../constants";

interface DraggedItem {
  type: "furniture" | "door" | "window";
  subType: FurnitureType | DoorType | WindowType;
}

interface UseDragDropOptions {
  config: CanvasConfig;
  zoom: number;
  panOffset: Point;
  snapToGrid: (value: number) => number;
  onPlaceFurniture: (type: FurnitureType, position: Point) => void;
  onPlaceDoor: (position: Point, type: DoorType) => void;
  onPlaceWindow: (position: Point, type: WindowType) => void;
}

export function useDragDrop({
  config,
  zoom,
  panOffset,
  snapToGrid,
  onPlaceFurniture,
  onPlaceDoor,
  onPlaceWindow,
}: UseDragDropOptions) {
  const { displaySize, pixelsPerFoot } = config;
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Handle drag start from sidebar
  const handleDragStart = useCallback((
    e: React.DragEvent,
    type: "furniture" | "door" | "window",
    subType: FurnitureType | DoorType | WindowType
  ) => {
    setDraggedItem({ type, subType });
    e.dataTransfer.setData("application/json", JSON.stringify({ type, subType }));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  // Handle drag over canvas
  const handleCanvasDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Handle drop on canvas
  const handleCanvasDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    const data = e.dataTransfer.getData("application/json");
    if (!data) return;

    const { type, subType } = JSON.parse(data) as DraggedItem;
    const container = canvasContainerRef.current;
    if (!container) return;

    // Get mouse position relative to the canvas container
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to world coordinates (accounting for zoom and pan)
    const worldX = (mouseX - panOffset.x) / zoom;
    const worldY = (mouseY - panOffset.y) / zoom;

    // Calculate centered position based on item type and dimensions
    let centeredX = worldX;
    let centeredY = worldY;

    if (type === "furniture") {
      const furnitureConfig = FURNITURE_CONFIG[subType as FurnitureType];
      if (furnitureConfig) {
        // Subtract half the item dimensions (in pixels) to center on mouse
        centeredX = worldX - (furnitureConfig.width * pixelsPerFoot) / 2;
        centeredY = worldY - (furnitureConfig.height * pixelsPerFoot) / 2;
      }
    } else if (type === "door") {
      const doorConfig = DOOR_CONFIGS[subType as DoorType];
      if (doorConfig) {
        // Doors are centered on their position, so we keep the mouse position
        // (door position is the center/hinge point)
        centeredX = worldX;
        centeredY = worldY;
      }
    } else if (type === "window") {
      const windowConfig = WINDOW_CONFIGS[subType as WindowType];
      if (windowConfig) {
        // Windows are also centered on their position
        centeredX = worldX;
        centeredY = worldY;
      }
    }

    // Snap to grid
    const x = snapToGrid(centeredX);
    const y = snapToGrid(centeredY);

    // Place the item based on type
    if (type === "furniture") {
      onPlaceFurniture(subType as FurnitureType, { x, y });
    } else if (type === "door") {
      onPlaceDoor({ x, y }, subType as DoorType);
    } else if (type === "window") {
      onPlaceWindow({ x, y }, subType as WindowType);
    }

    setDraggedItem(null);
  }, [zoom, panOffset, snapToGrid, pixelsPerFoot, onPlaceFurniture, onPlaceDoor, onPlaceWindow]);

  return {
    draggedItem,
    canvasContainerRef,
    handleDragStart,
    handleDragEnd,
    handleCanvasDragOver,
    handleCanvasDrop,
  };
}
