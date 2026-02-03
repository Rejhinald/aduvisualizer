import { useState, useCallback, useRef } from "react";
import type Konva from "konva";
import type { Point, DoorType, WindowType } from "@/lib/types";
import type { FurnitureType } from "../types";

interface DraggedItem {
  type: "furniture" | "door" | "window";
  subType: FurnitureType | DoorType | WindowType;
}

interface AduTransform {
  offsetX: number;  // ADU offset in feet
  offsetY: number;
  rotation: number; // degrees
  canvasCenter: Point;
  pixelsPerFoot: number;
}

interface UseDragDropOptions {
  snapToGrid: (value: number) => number;
  stageRef: React.RefObject<Konva.Stage | null>;
  aduTransform?: AduTransform; // When lot is loaded with rotation/offset
  onPlaceFurniture: (type: FurnitureType, position: Point) => void;
  onPlaceDoor: (position: Point, type: DoorType) => void;
  onPlaceWindow: (position: Point, type: WindowType) => void;
}

export function useDragDrop({
  snapToGrid,
  stageRef,
  aduTransform,
  onPlaceFurniture,
  onPlaceDoor,
  onPlaceWindow,
}: UseDragDropOptions) {
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Transform world coordinates to ADU-local coordinates.
   * This accounts for ADU rotation and offset when a lot is loaded.
   *
   * The ADU Group transform is:
   * 1. Translate by (-offsetX, -offsetY) where offset is canvasCenter
   * 2. Rotate by rotation angle
   * 3. Translate by (x, y) where x,y = canvasCenter + aduOffset
   *
   * To get ADU-local coords, we apply the inverse transform.
   */
  const worldToAduLocal = useCallback((worldPoint: Point): Point => {
    if (!aduTransform || aduTransform.rotation === 0) {
      // No rotation, just account for offset
      if (aduTransform) {
        const offsetPx = {
          x: aduTransform.offsetX * aduTransform.pixelsPerFoot,
          y: aduTransform.offsetY * aduTransform.pixelsPerFoot,
        };
        return {
          x: worldPoint.x - offsetPx.x,
          y: worldPoint.y - offsetPx.y,
        };
      }
      return worldPoint;
    }

    const { canvasCenter, rotation, offsetX, offsetY, pixelsPerFoot: ppf } = aduTransform;
    const offsetPx = { x: offsetX * ppf, y: offsetY * ppf };

    // Group position (where the group is translated to)
    const groupX = canvasCenter.x + offsetPx.x;
    const groupY = canvasCenter.y + offsetPx.y;

    // Step 1: Translate from world to group origin
    const tx = worldPoint.x - groupX;
    const ty = worldPoint.y - groupY;

    // Step 2: Inverse rotate (negative angle)
    const angleRad = (-rotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const rx = tx * cos - ty * sin;
    const ry = tx * sin + ty * cos;

    // Step 3: Translate back by offsetX/Y (which is canvasCenter in Group)
    const localX = rx + canvasCenter.x;
    const localY = ry + canvasCenter.y;

    return { x: localX, y: localY };
  }, [aduTransform]);

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
    const stage = stageRef.current;
    if (!container || !stage) return;

    // Get mouse position relative to the canvas container
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Use Konva's built-in transform to convert screen coords to world coords
    const transform = stage.getAbsoluteTransform().copy().invert();
    const worldPoint = transform.point({ x: screenX, y: screenY });

    // Transform to ADU-local coordinates if lot is loaded with rotation/offset
    const localPoint = worldToAduLocal(worldPoint);

    // Debug logging
    console.log("[DragDrop] Screen:", { screenX, screenY });
    console.log("[DragDrop] World:", worldPoint);
    console.log("[DragDrop] ADU Local:", localPoint);
    console.log("[DragDrop] ADU Transform:", aduTransform);

    // Snap to grid
    const x = snapToGrid(localPoint.x);
    const y = snapToGrid(localPoint.y);

    console.log("[DragDrop] Final snapped:", { x, y });

    // Place the item based on type
    if (type === "furniture") {
      onPlaceFurniture(subType as FurnitureType, { x, y });
    } else if (type === "door") {
      onPlaceDoor({ x, y }, subType as DoorType);
    } else if (type === "window") {
      onPlaceWindow({ x, y }, subType as WindowType);
    }

    setDraggedItem(null);
  }, [stageRef, aduTransform, worldToAduLocal, snapToGrid, onPlaceFurniture, onPlaceDoor, onPlaceWindow]);

  return {
    draggedItem,
    canvasContainerRef,
    handleDragStart,
    handleDragEnd,
    handleCanvasDragOver,
    handleCanvasDrop,
  };
}
