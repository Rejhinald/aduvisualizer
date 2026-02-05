/**
 * Floor Plan Editor v2 Constants
 * All measurements in FEET
 */

import type { CanvasConfig, EditorState } from "./types"

// ============================================
// Canvas Configuration
// ============================================

/**
 * Fixed scale: 20 pixels per foot
 * This allows direct 2D->3D coordinate mapping:
 * Canvas (x, y) pixels → (x/20, 0, y/20) Three.js world
 */
export const PIXELS_PER_FOOT = 20

/**
 * Default canvas configuration
 */
export function createCanvasConfig(
  viewportWidth = 800,
  viewportHeight = 600
): CanvasConfig {
  return {
    pixelsPerFoot: PIXELS_PER_FOOT,
    gridSizeMajor: 1,    // 1 foot
    gridSizeMinor: 0.5,  // 6 inches
    viewportWidth,
    viewportHeight,
    zoom: 1,
    panX: 0,
    panY: 0,
    minX: -50,
    maxX: 50,
    minY: -50,
    maxY: 50,
  }
}

// ============================================
// Standard Dimensions (feet)
// ============================================

export const DIMENSIONS = {
  // Walls
  WALL_THICKNESS: 0.5,       // 6 inches
  WALL_HEIGHT: 9,            // 9 feet ceiling

  // Doors
  DOOR_WIDTH_SINGLE: 3,      // 36 inches
  DOOR_WIDTH_DOUBLE: 6,      // 72 inches
  DOOR_HEIGHT: 6.67,         // 80 inches (6'8")

  // Windows
  WINDOW_WIDTH: 3,           // 36 inches
  WINDOW_HEIGHT: 4,          // 48 inches
  WINDOW_SILL_HEIGHT: 3,     // 36 inches from floor

  // Room minimums
  MIN_ROOM_DIMENSION: 3,     // 3 feet
  MIN_HALLWAY_WIDTH: 3,      // 3 feet

  // Grid
  GRID_SIZE_MAJOR: 1,        // 1 foot
  GRID_SIZE_MINOR: 0.5,      // 6 inches

  // Snap tolerance
  SNAP_CORNER_RADIUS: 0.5,   // feet
  SNAP_WALL_RADIUS: 0.25,    // feet
} as const

// ============================================
// Furniture Dimensions (feet)
// ============================================

export const FURNITURE_DIMENSIONS: Record<string, { width: number; depth: number; name: string; category: string }> = {
  // Bedroom
  bed_queen: { width: 5, depth: 6.67, name: "Queen Bed", category: "bedroom" },
  bed_king: { width: 6.33, depth: 6.67, name: "King Bed", category: "bedroom" },
  bed_twin: { width: 3.25, depth: 6.33, name: "Twin Bed", category: "bedroom" },
  dresser: { width: 5, depth: 1.5, name: "Dresser", category: "bedroom" },
  nightstand: { width: 2, depth: 1.5, name: "Nightstand", category: "bedroom" },

  // Bathroom
  toilet: { width: 1.5, depth: 2.33, name: "Toilet", category: "bathroom" },
  sink: { width: 2, depth: 1.5, name: "Sink", category: "bathroom" },
  bathtub: { width: 2.5, depth: 5, name: "Bathtub", category: "bathroom" },
  shower: { width: 3, depth: 3, name: "Shower", category: "bathroom" },

  // Kitchen
  refrigerator: { width: 3, depth: 2.5, name: "Refrigerator", category: "kitchen" },
  stove: { width: 2.5, depth: 2.5, name: "Stove", category: "kitchen" },
  dishwasher: { width: 2, depth: 2, name: "Dishwasher", category: "kitchen" },
  kitchen_sink: { width: 2.5, depth: 2, name: "Kitchen Sink", category: "kitchen" },

  // Living
  sofa_3seat: { width: 7, depth: 3, name: "3-Seat Sofa", category: "living" },
  sofa_2seat: { width: 5, depth: 3, name: "2-Seat Sofa", category: "living" },
  armchair: { width: 2.5, depth: 2.5, name: "Armchair", category: "living" },
  coffee_table: { width: 4, depth: 2, name: "Coffee Table", category: "living" },
  dining_table: { width: 6, depth: 3, name: "Dining Table", category: "living" },
  dining_chair: { width: 1.5, depth: 1.5, name: "Dining Chair", category: "living" },

  // Office
  desk: { width: 5, depth: 2.5, name: "Desk", category: "office" },
  office_chair: { width: 2, depth: 2, name: "Office Chair", category: "office" },
  bookshelf: { width: 3, depth: 1, name: "Bookshelf", category: "office" },
}

// ============================================
// Colors
// ============================================

export const COLORS = {
  // Grid - Professional blueprint style
  GRID_MAJOR: "#d4dce8",
  GRID_MINOR: "#e8eef5",
  GRID_ORIGIN: "#94a3b8",

  // Walls - Clean architectural dark gray
  WALL_FILL: "#334155",
  WALL_STROKE: "#1e293b",
  WALL_SELECTED: "#dc2626",
  WALL_HOVER: "#475569",

  // Virtual walls (room dividers) - Purple tones
  WALL_VIRTUAL: "#a78bfa",
  WALL_VIRTUAL_HOVER: "#8b5cf6",

  // Partition walls (half-height) - Amber tones
  WALL_PARTITION: "#fbbf24",
  WALL_PARTITION_HOVER: "#f59e0b",

  // Corners - Subtle but visible
  CORNER_FILL: "#1e293b",
  CORNER_STROKE: "#0f172a",
  CORNER_SELECTED: "#dc2626",
  CORNER_HOVER: "#334155",

  // Doors - Warm wood tones
  DOOR_FILL: "#a16207",
  DOOR_STROKE: "#78350f",
  DOOR_SWING: "rgba(161, 98, 7, 0.15)",
  DOOR_SELECTED: "#dc2626",

  // Windows - Clear blue glass
  WINDOW_FILL: "rgba(147, 197, 253, 0.5)",
  WINDOW_STROKE: "#3b82f6",
  WINDOW_SELECTED: "#dc2626",

  // Rooms - Light fills with room type colors
  ROOM_FILL: "rgba(226, 232, 240, 0.4)",
  ROOM_STROKE: "#94a3b8",
  ROOM_LABEL: "#475569",

  // Furniture - Modern neutral
  FURNITURE_FILL: "#e2e8f0",
  FURNITURE_STROKE: "#64748b",
  FURNITURE_SELECTED: "#dc2626",

  // Selection - Red accent
  SELECTION_STROKE: "#dc2626",
  SELECTION_FILL: "rgba(220, 38, 38, 0.1)",

  // Drawing preview - Red with transparency
  PREVIEW_STROKE: "#dc2626",
  PREVIEW_FILL: "rgba(220, 38, 38, 0.15)",

  // Lot - Green tones
  LOT_BOUNDARY: "#16a34a",
  LOT_SETBACK: "#ef4444",
  LOT_BUILDABLE: "rgba(22, 163, 74, 0.15)",

  // ADU Boundary - Primary accent
  ADU_BOUNDARY_STROKE: "#961818",
  ADU_BOUNDARY_FILL: "rgba(150, 24, 24, 0.08)",
  ADU_BOUNDARY_CORNER: "#961818",
  ADU_BOUNDARY_CORNER_HOVER: "#dc2626",
} as const

// ============================================
// ADU Boundary Helpers
// ============================================

export const ADU_SIZE_MIN = 300   // Minimum ADU size (sq ft)
export const ADU_SIZE_MAX = 1200  // Maximum ADU size (sq ft)
export const ADU_SIZE_DEFAULT = 400  // Default ADU size (sq ft)

/**
 * Create a square ADU boundary centered at origin
 * @param targetArea - Target area in square feet
 * @returns AduBoundary with corners in feet
 */
export function createAduBoundary(targetArea: number = ADU_SIZE_DEFAULT) {
  const clampedArea = Math.max(ADU_SIZE_MIN, Math.min(ADU_SIZE_MAX, targetArea))
  const side = Math.sqrt(clampedArea)
  const half = side / 2
  return {
    corners: [
      { x: -half, y: -half },
      { x: half, y: -half },
      { x: half, y: half },
      { x: -half, y: half },
    ],
    targetArea: clampedArea,
  }
}

/**
 * Calculate polygon area using Shoelace formula
 * @param corners - Array of points in feet
 * @returns Area in square feet
 */
export function calculatePolygonArea(corners: Array<{ x: number; y: number }>): number {
  if (corners.length < 3) return 0
  let area = 0
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length
    area += corners[i].x * corners[j].y
    area -= corners[j].x * corners[i].y
  }
  return Math.abs(area) / 2
}

// ============================================
// Initial Editor State
// ============================================

export const INITIAL_EDITOR_STATE: EditorState = {
  mode: "select",
  blueprintId: null,
  corners: [],
  walls: [],
  doors: [],
  windows: [],
  furniture: [],
  rooms: [],
  lot: null,
  aduBoundary: createAduBoundary(),
  showAduBoundary: true,
  selection: null,
  multiSelection: [],
  hoveredElement: null,
  isDrawing: false,
  drawingStart: null,
  drawingCorners: [],
  drawingPreview: null,
  isDragging: false,
  dragStart: null,
  dragOffset: null,
  isSelectionBoxActive: false,
  selectionBoxStart: null,
  selectionBoxEnd: null,
  placementType: null,
  placementPreview: null,
  placementPreviewAngle: 0,
  placementPreviewWallId: null,
  doorOrientations: {},
  windowOrientations: {},
  placementPreviewOrientation: 0,
  showGrid: true,
  showDimensions: true,
  snapToGrid: true,
  snapToCorner: true,
  cameraLocked: false,
  version: 0,
  isDirty: false,
}

// ============================================
// Furniture Categories
// ============================================

export const FURNITURE_CATEGORIES = [
  { id: "bedroom", label: "Bedroom", icon: "🛏️" },
  { id: "bathroom", label: "Bathroom", icon: "🚿" },
  { id: "kitchen", label: "Kitchen", icon: "🍳" },
  { id: "living", label: "Living", icon: "🛋️" },
  { id: "office", label: "Office", icon: "💼" },
] as const

// ============================================
// Door Types
// ============================================

export const DOOR_TYPES = [
  { id: "single", label: "Single Door", width: 3 },
  { id: "double", label: "Double Door", width: 6 },
  { id: "sliding", label: "Sliding Door", width: 6 },
  { id: "french", label: "French Door", width: 6 },
  { id: "opening", label: "Open Passage", width: 3 },
] as const

// ============================================
// Window Types
// ============================================

export const WINDOW_TYPES = [
  { id: "standard", label: "Standard Window", width: 3, height: 4 },
  { id: "bay", label: "Bay Window", width: 5, height: 4 },
  { id: "picture", label: "Picture Window", width: 6, height: 5 },
  { id: "sliding", label: "Sliding Window", width: 4, height: 3 },
] as const

// ============================================
// Room Type Colors
// ============================================

export const ROOM_TYPE_COLORS: Record<string, string> = {
  bedroom: "rgba(147, 197, 253, 0.35)",   // Sky blue
  bathroom: "rgba(134, 239, 172, 0.35)",  // Light green
  half_bath: "rgba(167, 243, 208, 0.35)", // Teal
  kitchen: "rgba(253, 186, 116, 0.35)",   // Warm orange
  living: "rgba(253, 224, 71, 0.35)",     // Sunny yellow
  dining: "rgba(252, 165, 165, 0.35)",    // Soft coral
  closet: "rgba(203, 213, 225, 0.35)",    // Slate
  laundry: "rgba(196, 181, 253, 0.35)",   // Lavender
  storage: "rgba(226, 232, 240, 0.35)",   // Light gray
  utility: "rgba(209, 213, 219, 0.35)",   // Gray
  entry: "rgba(254, 215, 170, 0.35)",     // Peach
  corridor: "rgba(254, 249, 195, 0.35)",  // Light yellow
  flex: "rgba(251, 207, 232, 0.35)",      // Pink
  other: "rgba(226, 232, 240, 0.35)",     // Light gray
}
