/**
 * 3D Viewer Constants - V2
 *
 * All measurements in feet (same as v2 editor)
 */

// Standard dimensions (feet)
export const DIMENSIONS = {
  // Walls
  WALL_THICKNESS: 0.5, // 6 inches
  WALL_HEIGHT: 9, // 9 feet ceiling

  // Doors
  DOOR_WIDTH: 3, // 36 inches
  DOOR_HEIGHT: 6.67, // 80 inches (6'8")

  // Windows
  WINDOW_WIDTH: 3,
  WINDOW_HEIGHT: 4,
  WINDOW_SILL_HEIGHT: 3, // 36 inches from floor
} as const

// Camera settings
export const CAMERA = {
  // Top-down (orthographic)
  TOP_DOWN_HEIGHT: 50,
  TOP_DOWN_NEAR: 1,
  TOP_DOWN_FAR: 200,

  // First-person (perspective)
  DEFAULT_EYE_HEIGHT: 5.5, // 5'6" typical eye level
  DEFAULT_FOV: 75,
  MOVE_SPEED: 10, // feet per second
  LOOK_SENSITIVITY: 0.002,

  // General
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5,
} as const

// Material colors (clean SketchUp style)
export const COLORS = {
  // Walls
  WALL: "#F5F5F5", // Light gray walls (solid)
  WALL_INTERIOR: "#FAFAFA",
  WALL_PARTITION: "#E8DFD4", // Warm beige for partition walls (half-height)

  // Floor
  FLOOR_DEFAULT: "#E8E4E1", // Warm gray
  FLOOR_BEDROOM: "#D4C8BE",
  FLOOR_BATHROOM: "#D9E2E9",
  FLOOR_KITCHEN: "#DED5C4",
  FLOOR_LIVING: "#E5DED4",

  // Doors
  DOOR_FRAME: "#8B7355", // Wood brown
  DOOR_PANEL: "#A68B5B",

  // Windows
  WINDOW_FRAME: "#6B7280", // Gray frame
  WINDOW_GLASS: "#87CEEB", // Light blue glass

  // Furniture
  FURNITURE_DEFAULT: "#D4A574",

  // Ground
  GROUND: "#C8C8C8",

  // Room type colors (floor)
  ROOM_TYPES: {
    bedroom: "#E8DFD5",
    bathroom: "#D9E7ED",
    kitchen: "#F0E6D3",
    living: "#EBE5DB",
    dining: "#E8E0D0",
    closet: "#D8D8D8",
    laundry: "#E0E6EC",
    entry: "#E5E0D8",
    corridor: "#E8E8E8",
    office: "#E5E2DD",
    other: "#E0E0E0",
  } as Record<string, string>,
} as const

// Material properties (roughness, metalness)
export const MATERIALS = {
  WALL: { roughness: 0.9, metalness: 0 },
  FLOOR: { roughness: 0.8, metalness: 0 },
  DOOR: { roughness: 0.6, metalness: 0 },
  WINDOW_FRAME: { roughness: 0.4, metalness: 0.2 },
  WINDOW_GLASS: { roughness: 0.1, metalness: 0.1, opacity: 0.4, transparent: true },
  FURNITURE: { roughness: 0.7, metalness: 0 },
} as const

// Furniture heights (for 3D box generation)
export const FURNITURE_HEIGHTS: Record<string, { height: number; color: string }> = {
  // Bedroom
  bed_queen: { height: 2.5, color: "#8B7355" },
  bed_king: { height: 2.5, color: "#8B7355" },
  bed_twin: { height: 2.5, color: "#8B7355" },
  dresser: { height: 3.5, color: "#A68B5B" },
  nightstand: { height: 2, color: "#A68B5B" },

  // Bathroom
  toilet: { height: 2.5, color: "#FFFFFF" },
  sink: { height: 3, color: "#FFFFFF" },
  bathtub: { height: 2, color: "#FFFFFF" },
  shower: { height: 7, color: "#E0E0E0" },

  // Kitchen
  refrigerator: { height: 6, color: "#C0C0C0" },
  stove: { height: 3, color: "#404040" },
  dishwasher: { height: 3, color: "#C0C0C0" },
  kitchen_sink: { height: 3, color: "#C0C0C0" },

  // Living
  sofa_3seat: { height: 2.5, color: "#6B8E9F" },
  sofa_2seat: { height: 2.5, color: "#6B8E9F" },
  armchair: { height: 2.5, color: "#6B8E9F" },
  coffee_table: { height: 1.5, color: "#8B7355" },
  dining_table: { height: 2.5, color: "#8B7355" },
  dining_chair: { height: 3, color: "#A68B5B" },

  // Office
  desk: { height: 2.5, color: "#A68B5B" },
  office_chair: { height: 3.5, color: "#404040" },
  bookshelf: { height: 6, color: "#8B7355" },
}
