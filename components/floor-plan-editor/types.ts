import type { Point, Room, Door, Window, DoorType, WindowType, RoomType } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

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

export interface FurnitureConfig {
  name: string;
  width: number;   // feet
  height: number;  // feet (depth)
  category: "bedroom" | "living" | "bathroom" | "kitchen" | "office";
  icon: LucideIcon;
}

export type PlacementMode = "select" | "room" | "door" | "window" | "furniture" | "finishes";
export type DrawMode = "rectangle" | "polygon";
export type FurnitureSnapMode = "grid" | "half" | "free";

export interface DraggedItem {
  type: "furniture" | "door" | "window";
  subType: FurnitureType | DoorType | WindowType;
}

export interface DeleteDialogState {
  open: boolean;
  type: "room" | "door" | "window" | "furniture" | null;
  id: string | null;
  name: string;
}

export interface HistoryState {
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  furniture: Furniture[];
  aduBoundary: Point[];
}

export interface FloorPlanEditorProps {
  onPlanChange: (plan: {
    rooms: Room[];
    doors: Door[];
    windows: Window[];
    furniture: Furniture[];
    aduBoundary: Point[];
    canvasWidth: number;
    canvasHeight: number;
  }) => void;
}

// Canvas configuration
export interface CanvasConfig {
  maxCanvasFeet: number;
  displaySize: number;
  extendedGridFeet: number;
  pixelsPerFoot: number;
  gridSize: number;
  extendedCanvasSize: number;
}

// Re-export types from lib for convenience
export type { Point, Room, Door, Window, DoorType, WindowType, RoomType };
