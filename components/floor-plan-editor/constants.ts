import { Bed, Sofa, Armchair, Square, Bath, ChefHat } from "lucide-react";
import type { FurnitureType, FurnitureConfig, CanvasConfig } from "./types";

// Furniture configurations with standard architectural dimensions
export const FURNITURE_CONFIG: Record<FurnitureType, FurnitureConfig> = {
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

// All furniture types for iteration
export const FURNITURE_TYPES: FurnitureType[] = [
  "bed-double", "bed-single", "sofa-3seat", "sofa-2seat", "armchair",
  "table-dining", "table-coffee", "toilet", "sink", "shower", "bathtub",
  "stove", "refrigerator", "dishwasher", "desk", "chair"
];

// Canvas configuration factory
export function createCanvasConfig(): CanvasConfig {
  const maxCanvasFeet = 36;
  const displaySize = 800;
  const extendedGridFeet = maxCanvasFeet * 3;
  const pixelsPerFoot = displaySize / maxCanvasFeet;
  const gridSize = pixelsPerFoot;
  const extendedCanvasSize = extendedGridFeet * gridSize;

  return {
    maxCanvasFeet,
    displaySize,
    extendedGridFeet,
    pixelsPerFoot,
    gridSize,
    extendedCanvasSize,
  };
}

// Default canvas config
export const CANVAS_DEFAULTS = createCanvasConfig();

// History limit
export const MAX_HISTORY = 50;

// Furniture categories for sidebar grouping
export const FURNITURE_CATEGORIES = [
  { id: "bedroom", label: "Bedroom", icon: "🛏️" },
  { id: "bathroom", label: "Bathroom", icon: "🚿" },
  { id: "kitchen", label: "Kitchen", icon: "🍳" },
  { id: "living", label: "Living Room", icon: "🛋️" },
  { id: "office", label: "Office", icon: "💼" },
] as const;
