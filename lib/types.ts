// Floor Plan Types - Aligned with LA ADU and architectural standards
export type RoomType =
  | "bedroom"     // Bedroom (min 70 sq ft per CA Building Code)
  | "bathroom"    // Full Bathroom (shower/tub, toilet, sink)
  | "half_bath"   // Half Bath/Powder Room (toilet, sink only)
  | "kitchen"     // Kitchen (required for ADU)
  | "living"      // Living Room/Great Room
  | "dining"      // Dining Area
  | "closet"      // Closet/Wardrobe
  | "laundry"     // Laundry Room/Area
  | "storage"     // Storage Room
  | "utility"     // Utility/Mechanical Room
  | "entry"       // Entry/Foyer
  | "corridor"    // Hallway/Corridor
  | "flex"        // Flex Space/Den/Office
  | "other";      // Other/Custom

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  type: RoomType;
  name: string;
  vertices: Point[];
  area: number; // in square feet
  color: string;
  description?: string; // Optional description for "other" room type
}

export type DoorType = "single" | "double" | "sliding" | "french" | "opening";
export type WindowType = "standard" | "bay" | "picture" | "sliding";

export interface Door {
  id: string;
  type: DoorType;
  position: Point; // Center position of door
  rotation: number; // 0, 90, 180, 270 degrees
  width: number; // in feet (typically 3ft single, 6ft double)
  roomId?: string; // Optional: which room the door belongs to
}

export interface Window {
  id: string;
  type: WindowType;
  position: Point; // Center position of window
  rotation: number; // 0, 90, 180, 270 degrees
  width: number; // in feet
  height: number; // in feet
  roomId?: string; // Optional: which room the window belongs to
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
}

export interface FloorPlan {
  id: string;
  rooms: Room[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  totalArea: number;
  gridSize: number; // size of each grid cell in feet
  createdAt: string;
  updatedAt: string;
}

// Finish Types
export type FlooringType = "hardwood" | "tile" | "carpet" | "vinyl" | "laminate";
export type CountertopType = "granite" | "quartz" | "marble" | "laminate";
export type CabinetStyle = "modern" | "traditional" | "shaker" | "flat-panel";
export type FixtureStyle = "modern" | "traditional" | "rustic" | "industrial";

export interface RoomFinish {
  roomId: string;
  flooring: FlooringType;
  wallColor: string;
}

export interface Finishes {
  rooms: RoomFinish[];
  kitchen: {
    cabinets: CabinetStyle;
    cabinetColor: string;
    countertops: CountertopType;
  };
  bathrooms: {
    fixtures: FixtureStyle;
    tileColor: string;
  };
  optionals: {
    smartHome: boolean;
    solarPanels: boolean;
    customLighting: boolean;
  };
}

// Complete Project Data
export interface ADUProject {
  id: string;
  name: string;
  floorPlan: FloorPlan | null;
  finishes: Finishes | null;
  visualizations: string[]; // URLs to generated images
  createdAt: string;
  updatedAt: string;
}

// Wizard State
export type WizardStep = "floorplan" | "finishes" | "visualize";

export interface WizardState {
  currentStep: WizardStep;
  floorPlan: FloorPlan | null;
  finishes: Finishes | null;
}

// Canvas Editor Types
export interface CanvasState {
  scale: number;
  offset: Point;
  gridVisible: boolean;
  snapToGrid: boolean;
}

export interface Tool {
  type: "select" | "room" | "wall" | "delete";
  roomType?: RoomType;
}

// ADU Template Types
export type TemplateType = "studio" | "oneBedroom" | "twoBedroom" | "blank";

export interface ADUTemplate {
  id: TemplateType;
  name: string;
  description: string;
  sqft: string;
  icon: string;
  rooms: Omit<Room, "id">[];
  doors: Omit<Door, "id">[];
  windows: Omit<Window, "id">[];
  boundary: Point[];
}
