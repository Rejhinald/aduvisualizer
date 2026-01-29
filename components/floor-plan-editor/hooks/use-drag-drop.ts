import { useState, useCallback, useRef } from "react";
import type { Point, DoorType, WindowType } from "@/lib/types";
import type { FurnitureType, CanvasConfig } from "../types";

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
  const { displaySize } = config;
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

    // Snap to grid
    const x = snapToGrid(worldX);
    const y = snapToGrid(worldY);

    // Place the item based on type
    if (type === "furniture") {
      onPlaceFurniture(subType as FurnitureType, { x, y });
    } else if (type === "door") {
      onPlaceDoor({ x, y }, subType as DoorType);
    } else if (type === "window") {
      onPlaceWindow({ x, y }, subType as WindowType);
    }

    setDraggedItem(null);
  }, [zoom, panOffset, snapToGrid, onPlaceFurniture, onPlaceDoor, onPlaceWindow]);

  return {
    draggedItem,
    canvasContainerRef,
    handleDragStart,
    handleDragEnd,
    handleCanvasDragOver,
    handleCanvasDrop,
  };
}
