import type { RoomType, ADUTemplate } from "./types";

// ADU Size Limits (California regulations)
export const ADU_LIMITS = {
  MIN_AREA: 300, // minimum square feet
  MAX_AREA: 1200, // maximum square feet
  MIN_ROOM_SIZE: 70, // minimum room size in sq ft
  MAX_BEDROOMS: 3,
} as const;

// Grid Configuration
export const GRID_CONFIG = {
  CELL_SIZE: 20, // pixels per foot
  SHOW_GRID: true,
  SNAP_TO_GRID: true,
  GRID_COLOR: "#e4e4e7",
} as const;

// Canvas Configuration
export const CANVAS_CONFIG = {
  WIDTH: 1200,
  HEIGHT: 800,
  BACKGROUND_COLOR: "#ffffff",
  WALL_THICKNESS: 6, // inches (typical interior wall)
  MIN_SCALE: 0.1, // Allow zooming out to see large lots (10%)
  MAX_SCALE: 3,
} as const;

// Room Type Configurations - Aligned with LA ADU and architectural standards
export const ROOM_CONFIGS: Record<
  RoomType,
  {
    label: string;
    color: string;
    minSize: number; // square feet (per CA Building Code / LA ADU standards)
    icon: string;
  }
> = {
  bedroom: {
    label: "Bedroom",
    color: "#dbeafe", // light blue
    minSize: 70, // CA Building Code minimum for habitable room
    icon: "🛏️",
  },
  bathroom: {
    label: "Full Bath",
    color: "#fce7f3", // light pink
    minSize: 35, // Minimum for tub/shower, toilet, sink
    icon: "🚿",
  },
  half_bath: {
    label: "Half Bath",
    color: "#fbcfe8", // pink
    minSize: 18, // Minimum for toilet and sink only
    icon: "🚽",
  },
  kitchen: {
    label: "Kitchen",
    color: "#fef3c7", // light yellow
    minSize: 50, // Required for ADU
    icon: "🍳",
  },
  living: {
    label: "Living Room",
    color: "#dcfce7", // light green
    minSize: 120, // Recommended minimum for living space
    icon: "🛋️",
  },
  dining: {
    label: "Dining Area",
    color: "#fef9c3", // light amber
    minSize: 64, // Minimum for 4-person dining
    icon: "🍽️",
  },
  closet: {
    label: "Closet",
    color: "#e9d5ff", // light purple
    minSize: 6, // Walk-in starts at ~24 sq ft
    icon: "👔",
  },
  laundry: {
    label: "Laundry",
    color: "#a5f3fc", // light cyan
    minSize: 15, // Stacked washer/dryer minimum
    icon: "🧺",
  },
  storage: {
    label: "Storage",
    color: "#fed7aa", // light orange
    minSize: 10, // Utility storage
    icon: "📦",
  },
  utility: {
    label: "Utility Room",
    color: "#d1d5db", // gray
    minSize: 12, // Water heater, HVAC
    icon: "⚙️",
  },
  entry: {
    label: "Entry/Foyer",
    color: "#bfdbfe", // soft blue
    minSize: 16, // Small entry area
    icon: "🚪",
  },
  corridor: {
    label: "Hallway",
    color: "#e0e7ff", // light indigo
    minSize: 12, // 3ft wide minimum per code
    icon: "↔️",
  },
  flex: {
    label: "Flex Space",
    color: "#d9f99d", // lime
    minSize: 70, // Multi-purpose room
    icon: "📐",
  },
  other: {
    label: "Other",
    color: "#f3f4f6", // light gray
    minSize: 20,
    icon: "✏️",
  },
} as const;

// Door and Window Configurations
export const DOOR_CONFIGS = {
  single: {
    label: "Single Door",
    width: 3, // feet
    icon: "🚪",
    description: "Standard hinged door",
  },
  double: {
    label: "Double Door",
    width: 6, // feet
    icon: "🚪🚪",
    description: "Two doors side by side",
  },
  sliding: {
    label: "Sliding Door",
    width: 6, // feet
    icon: "↔️",
    description: "Sliding glass or pocket door",
  },
  french: {
    label: "French Door",
    width: 5, // feet
    icon: "🚪🚪",
    description: "Glass panel doors",
  },
  opening: {
    label: "Open Passage",
    width: 4, // feet
    icon: "⬜",
    description: "No door or wall - open floor plan",
  },
} as const;

export const WINDOW_CONFIGS = {
  standard: {
    label: "Standard Window",
    width: 3, // feet
    height: 4, // feet
    icon: "🪟",
  },
  bay: {
    label: "Bay Window",
    width: 6, // feet
    height: 5, // feet
    icon: "🪟",
  },
  picture: {
    label: "Picture Window",
    width: 5, // feet
    height: 5, // feet
    icon: "🖼️",
  },
  sliding: {
    label: "Sliding Window",
    width: 4, // feet
    height: 3, // feet
    icon: "↔️",
  },
} as const;

// Wizard Steps
export const WIZARD_STEPS = [
  {
    id: "floorplan" as const,
    label: "Floor Plan",
    description: "Design your ADU layout",
    path: "/create/floorplan",
  },
  {
    id: "finishes" as const,
    label: "Finishes",
    description: "Choose materials & colors",
    path: "/create/finishes",
  },
  {
    id: "visualize" as const,
    label: "Visualize",
    description: "Generate 3D renders",
    path: "/create/visualize",
  },
] as const;

// Finish Options
export const FLOORING_OPTIONS = [
  { value: "hardwood", label: "Hardwood", price: "$$$" },
  { value: "tile", label: "Tile", price: "$$" },
  { value: "carpet", label: "Carpet", price: "$" },
  { value: "vinyl", label: "Vinyl", price: "$" },
  { value: "laminate", label: "Laminate", price: "$$" },
] as const;

export const COUNTERTOP_OPTIONS = [
  { value: "granite", label: "Granite", price: "$$$" },
  { value: "quartz", label: "Quartz", price: "$$$" },
  { value: "marble", label: "Marble", price: "$$$$" },
  { value: "laminate", label: "Laminate", price: "$" },
] as const;

export const CABINET_STYLES = [
  { value: "modern", label: "Modern", description: "Clean lines, minimal hardware" },
  { value: "traditional", label: "Traditional", description: "Classic raised panels" },
  { value: "shaker", label: "Shaker", description: "Simple, versatile design" },
  { value: "flat-panel", label: "Flat Panel", description: "Contemporary flat doors" },
] as const;

export const FIXTURE_STYLES = [
  { value: "modern", label: "Modern", description: "Sleek, contemporary fixtures" },
  { value: "traditional", label: "Traditional", description: "Classic, timeless style" },
  { value: "rustic", label: "Rustic", description: "Natural, warm finishes" },
  { value: "industrial", label: "Industrial", description: "Bold, urban look" },
] as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  CURRENT_PROJECT: "adu_current_project",
  FLOOR_PLAN: "adu_floor_plan",
  FINISHES: "adu_finishes",
  WIZARD_STATE: "adu_wizard_state",
} as const;

// Validation Messages
export const VALIDATION_MESSAGES = {
  MIN_AREA: `ADU must be at least ${ADU_LIMITS.MIN_AREA} square feet`,
  MAX_AREA: `ADU cannot exceed ${ADU_LIMITS.MAX_AREA} square feet`,
  MIN_ROOM_SIZE: `Rooms must be at least ${ADU_LIMITS.MIN_ROOM_SIZE} square feet`,
  NO_ROOMS: "Please add at least one room to your floor plan",
  INVALID_SHAPE: "Room shape is invalid. Please draw a closed polygon.",
} as const;

// Room Size Recommendations (for guidance) - LA ADU standards
export const ROOM_SIZE_HINTS: Record<RoomType, { min: number; recommended: number; description: string }> = {
  bedroom: {
    min: 70,
    recommended: 120,
    description: "CA code: 70 sq ft min. Queen bed needs ~120 sq ft",
  },
  bathroom: {
    min: 35,
    recommended: 50,
    description: "Full bath with tub/shower, toilet, and sink",
  },
  half_bath: {
    min: 18,
    recommended: 25,
    description: "Powder room with toilet and sink only",
  },
  kitchen: {
    min: 50,
    recommended: 80,
    description: "ADU requirement: stove, fridge, sink, counter",
  },
  living: {
    min: 120,
    recommended: 180,
    description: "Main living area: sofa, seating, entertainment",
  },
  dining: {
    min: 64,
    recommended: 100,
    description: "Dining for 4-6 people, often combined with living",
  },
  closet: {
    min: 6,
    recommended: 24,
    description: "Reach-in: 6 sq ft, walk-in: 24+ sq ft",
  },
  laundry: {
    min: 15,
    recommended: 35,
    description: "Stacked: 15 sq ft, side-by-side: 35 sq ft",
  },
  storage: {
    min: 10,
    recommended: 30,
    description: "General storage, pantry, or mechanical chase",
  },
  utility: {
    min: 12,
    recommended: 24,
    description: "Water heater, HVAC, electrical panel",
  },
  entry: {
    min: 16,
    recommended: 36,
    description: "Foyer/entry area, coat storage",
  },
  corridor: {
    min: 12,
    recommended: 20,
    description: "Code: 36\" min width, 44\" for egress",
  },
  flex: {
    min: 70,
    recommended: 100,
    description: "Home office, den, or convertible space",
  },
  other: {
    min: 20,
    recommended: 40,
    description: "Custom room - specify in description",
  },
} as const;

// Size Comparison Labels
export const SIZE_COMPARISONS = [
  { sqft: 300, label: "Small studio apartment" },
  { sqft: 400, label: "One-car garage" },
  { sqft: 600, label: "Large studio or 1-bedroom" },
  { sqft: 800, label: "Spacious 1-bedroom" },
  { sqft: 1000, label: "Two-car garage" },
  { sqft: 1200, label: "Large 2-bedroom apartment" },
] as const;

export const getSizeComparison = (sqft: number): string => {
  const comparison = SIZE_COMPARISONS.reduce((closest, current) => {
    return Math.abs(current.sqft - sqft) < Math.abs(closest.sqft - sqft) ? current : closest;
  });
  return comparison.label;
};

// ADU Templates (placeholder for future hand-made templates)
export const ADU_TEMPLATES: ADUTemplate[] = [];
