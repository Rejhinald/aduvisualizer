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
  MIN_SCALE: 0.5,
  MAX_SCALE: 3,
} as const;

// Room Type Configurations
export const ROOM_CONFIGS: Record<
  RoomType,
  {
    label: string;
    color: string;
    minSize: number; // square feet
    icon: string;
  }
> = {
  bedroom: {
    label: "Bedroom",
    color: "#dbeafe", // light blue
    minSize: 70,
    icon: "🛏️",
  },
  bathroom: {
    label: "Bathroom",
    color: "#fce7f3", // light pink
    minSize: 35,
    icon: "🚿",
  },
  kitchen: {
    label: "Kitchen",
    color: "#fef3c7", // light yellow
    minSize: 50,
    icon: "🍳",
  },
  living: {
    label: "Living Room",
    color: "#dcfce7", // light green
    minSize: 100,
    icon: "🛋️",
  },
  dining: {
    label: "Dining Room",
    color: "#fef9c3", // light amber
    minSize: 80,
    icon: "🍽️",
  },
  corridor: {
    label: "Corridor/Hallway",
    color: "#e0e7ff", // light indigo
    minSize: 20,
    icon: "🚪",
  },
  other: {
    label: "Other",
    color: "#f3f4f6", // light gray
    minSize: 40,
    icon: "📦",
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

// Room Size Recommendations (for guidance)
export const ROOM_SIZE_HINTS: Record<RoomType, { min: number; recommended: number; description: string }> = {
  bedroom: {
    min: 70,
    recommended: 120,
    description: "A queen bed needs about 120 sq ft",
  },
  bathroom: {
    min: 35,
    recommended: 50,
    description: "Comfortable for shower, toilet, and sink",
  },
  kitchen: {
    min: 50,
    recommended: 80,
    description: "Enough space for stove, fridge, and counter",
  },
  living: {
    min: 100,
    recommended: 150,
    description: "Fits a sofa, TV, and coffee table",
  },
  dining: {
    min: 80,
    recommended: 100,
    description: "Table for 4-6 people",
  },
  corridor: {
    min: 20,
    recommended: 30,
    description: "3 feet wide minimum for hallways",
  },
  other: {
    min: 40,
    recommended: 60,
    description: "Storage, utility, or flex space",
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
