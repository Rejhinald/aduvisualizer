/**
 * Floor Plan Editor v2 Types
 * Corner/Wall Graph Model - All coordinates in FEET
 */

// Re-export API types for convenience
export type {
  Point,
  Corner,
  Wall,
  Door,
  Window,
  Furniture,
  Room,
  Lot,
  Blueprint,
  DoorType,
  WindowType,
  FurnitureType,
  RoomType,
  WallType,
  Setbacks,
  BoundaryCorner,
  BoundaryWall,
} from "@/lib/api/client-v2"

import type {
  Point,
  Corner,
  Wall,
  Door,
  Window,
  Furniture,
  Room,
  Lot,
  DoorType,
  WindowType,
  FurnitureType,
  RoomType,
  WallType,
  BoundaryCorner,
  BoundaryWall,
} from "@/lib/api/client-v2"

// ============================================
// Editor Modes
// ============================================

export type EditorMode =
  | "select"      // Select and move elements
  | "wall"        // Draw walls (creates corners and walls)
  | "rectangle"   // Draw rectangle room (4 corners, 4 walls)
  | "divider"     // Draw room dividers (virtual walls - no 3D geometry)
  | "room"        // Click to select/classify detected rooms
  | "door"        // Place doors on walls
  | "window"      // Place windows on walls
  | "furniture"   // Place furniture
  | "delete"      // Delete mode

// ============================================
// Selection State
// ============================================

export type SelectionType = "corner" | "wall" | "door" | "window" | "furniture" | "room"

export interface Selection {
  type: SelectionType
  id: string
}

// Multi-selection for batch operations
export interface MultiSelection {
  items: Selection[]
}

// ============================================
// Canvas Configuration
// ============================================

export interface CanvasConfig {
  // Coordinate system (all in feet)
  pixelsPerFoot: number      // Fixed at 20px/ft for direct 2D->3D mapping
  gridSizeMajor: number      // 1 foot
  gridSizeMinor: number      // 0.5 feet (6 inches)

  // Viewport
  viewportWidth: number      // Visible canvas width (pixels)
  viewportHeight: number     // Visible canvas height (pixels)

  // Pan/Zoom
  zoom: number               // 1.0 = 100%
  panX: number               // Pan offset X (pixels)
  panY: number               // Pan offset Y (pixels)

  // Grid bounds (in feet)
  minX: number
  maxX: number
  minY: number
  maxY: number
}

// ============================================
// ADU Boundary
// ============================================

export interface AduBoundary {
  corners: Point[]  // Boundary vertices in feet (centered at origin)
  targetArea: number  // Target area in sq ft (300-1200)
}

// ============================================
// Editor State
// ============================================

export interface EditorState {
  // Mode
  mode: EditorMode

  // Data (from API)
  blueprintId: string | null
  corners: Corner[]
  walls: Wall[]
  doors: Door[]
  windows: Window[]
  furniture: Furniture[]
  rooms: Room[]  // Computed by backend
  lot: Lot | null

  // ADU Boundary (buildable area guide)
  aduBoundary: AduBoundary
  showAduBoundary: boolean

  // Selection
  selection: Selection | null
  multiSelection: Selection[]  // For Ctrl+click batch selection
  hoveredElement: Selection | null

  // Drawing state (for wall/rectangle modes)
  isDrawing: boolean
  drawingStart: Point | null
  drawingCorners: Point[]  // Temporary corners during drawing
  drawingPreview: Point | null  // Current mouse position for preview (rectangle mode)

  // Drag state
  isDragging: boolean
  dragStart: Point | null
  dragOffset: Point | null

  // Selection box state (for drag-select)
  isSelectionBoxActive: boolean
  selectionBoxStart: Point | null
  selectionBoxEnd: Point | null

  // Placement (for door/window/furniture modes)
  placementType: DoorType | WindowType | FurnitureType | null
  placementPreview: Point | null
  placementPreviewAngle: number  // Rotation angle for door/window preview (degrees)
  placementPreviewWallId: string | null  // Wall ID for door/window placement

  // Door/window orientation state (local only, not persisted to API)
  // 0-3: cycles through 4 orientations (hinge left/right × swing direction)
  doorOrientations: Record<string, number>
  windowOrientations: Record<string, number>

  // Preview rotation for door/window placement (before placing)
  placementPreviewOrientation: number

  // UI state
  showGrid: boolean
  showDimensions: boolean
  snapToGrid: boolean
  snapToCorner: boolean
  cameraLocked: boolean  // Prevent pan/zoom when true

  // Version
  version: number
  isDirty: boolean
}

// ============================================
// Editor Actions
// ============================================

export type EditorAction =
  // Mode actions
  | { type: "SET_MODE"; mode: EditorMode }

  // Selection actions
  | { type: "SELECT"; selection: Selection | null }
  | { type: "TOGGLE_SELECT"; selection: Selection }  // Ctrl+click
  | { type: "ADD_TO_SELECTION"; selection: Selection }
  | { type: "CLEAR_SELECTION" }
  | { type: "SELECT_ALL_OF_TYPE"; selectionType: SelectionType }
  | { type: "HOVER"; element: Selection | null }

  // Data actions
  | { type: "SET_BLUEPRINT"; blueprintId: string }
  | { type: "LOAD_DATA"; data: {
      corners: Corner[]
      walls: Wall[]
      doors: Door[]
      windows: Window[]
      furniture: Furniture[]
      rooms: Room[]
      lot: Lot | null
      version: number
    }}

  // Corner actions
  | { type: "ADD_CORNER"; corner: Corner }
  | { type: "UPDATE_CORNER"; id: string; x: number; y: number }
  | { type: "DELETE_CORNER"; id: string }
  | { type: "MERGE_CORNERS"; sourceId: string; targetId: string }  // Merge source into target

  // Wall actions
  | { type: "ADD_WALL"; wall: Wall }
  | { type: "UPDATE_WALL"; id: string; thickness?: number; height?: number; wallType?: WallType }
  | { type: "DELETE_WALL"; id: string }
  | { type: "SPLIT_WALL"; wallId: string; point: Point }  // Insert corner at point, split wall into two

  // Door actions
  | { type: "ADD_DOOR"; door: Door }
  | { type: "UPDATE_DOOR"; id: string; position?: number; doorType?: DoorType; width?: number; height?: number }
  | { type: "DELETE_DOOR"; id: string }

  // Window actions
  | { type: "ADD_WINDOW"; window: Window }
  | { type: "UPDATE_WINDOW"; id: string; position?: number; windowType?: WindowType; width?: number; height?: number; sillHeight?: number }
  | { type: "DELETE_WINDOW"; id: string }

  // Furniture actions
  | { type: "ADD_FURNITURE"; furniture: Furniture }
  | { type: "UPDATE_FURNITURE"; id: string; x?: number; y?: number; rotation?: number }
  | { type: "DELETE_FURNITURE"; id: string }

  // Room actions (rotation rotates corners around room center)
  | { type: "ROTATE_ROOM"; roomId: string; degrees: number }
  | { type: "UPDATE_ROOM_TYPE"; roomId: string; roomType: RoomType }
  | { type: "UPDATE_ROOM_NAME"; roomId: string; name: string }

  // Lot actions
  | { type: "SET_LOT"; lot: Lot | null }

  // ADU Boundary actions
  | { type: "SET_ADU_BOUNDARY_SIZE"; targetArea: number }
  | { type: "LOAD_ADU_BOUNDARY"; corners: Point[]; targetArea?: number }  // Load specific corners from database
  | { type: "UPDATE_ADU_BOUNDARY_CORNER"; index: number; point: Point }
  | { type: "ADD_ADU_BOUNDARY_CORNER"; afterIndex: number; point: Point }  // Insert corner after index
  | { type: "REMOVE_ADU_BOUNDARY_CORNER"; index: number }  // Remove corner (min 3)
  | { type: "TOGGLE_ADU_BOUNDARY" }
  | { type: "RESET_ADU_BOUNDARY" }

  // Drawing actions
  | { type: "START_DRAWING"; point: Point }
  | { type: "ADD_DRAWING_POINT"; point: Point }
  | { type: "UPDATE_DRAWING_PREVIEW"; point: Point }  // Update preview position (for rectangle mode)
  | { type: "END_DRAWING" }
  | { type: "CANCEL_DRAWING" }

  // Drag actions
  | { type: "START_DRAG"; point: Point }
  | { type: "UPDATE_DRAG"; point: Point }
  | { type: "END_DRAG" }

  // Selection box actions (drag-select)
  | { type: "START_SELECTION_BOX"; point: Point }
  | { type: "UPDATE_SELECTION_BOX"; point: Point }
  | { type: "END_SELECTION_BOX" }
  | { type: "CANCEL_SELECTION_BOX" }

  // Placement actions
  | { type: "SET_PLACEMENT_TYPE"; placementType: DoorType | WindowType | FurnitureType | null }
  | { type: "UPDATE_PLACEMENT_PREVIEW"; point: Point | null; angle?: number; wallId?: string | null }
  | { type: "ROTATE_PLACEMENT_PREVIEW" }  // Cycle preview orientation (R key in placement mode)

  // UI actions
  | { type: "TOGGLE_GRID" }
  | { type: "TOGGLE_DIMENSIONS" }
  | { type: "TOGGLE_SNAP_GRID" }
  | { type: "TOGGLE_SNAP_CORNER" }
  | { type: "TOGGLE_CAMERA_LOCK" }

  // Batch actions
  | { type: "DELETE_SELECTED" }  // Delete all selected items
  | { type: "MOVE_SELECTED"; offsetX: number; offsetY: number }  // Move all selected items
  | { type: "ROTATE_SELECTED"; degrees: number }  // Rotate all selected items around centroid

  // History actions (undo/redo)
  | { type: "RESTORE_SNAPSHOT"; snapshot: {
      corners: Corner[]
      walls: Wall[]
      doors: Door[]
      windows: Window[]
      furniture: Furniture[]
      rooms: Room[]
    }}

  // Version actions
  | { type: "MARK_DIRTY" }
  | { type: "MARK_CLEAN" }
  | { type: "INCREMENT_VERSION" }

// ============================================
// Props Types
// ============================================

export interface FloorPlanEditorV2Props {
  projectId: string
  onSave?: (blueprint: { id: string; version: number }) => void
  onExport?: () => void
}

export interface CanvasProps {
  config: CanvasConfig
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
}

export interface GridLayerProps {
  config: CanvasConfig
}

export interface CornersLayerProps extends CanvasProps {}

export interface WallsLayerProps extends CanvasProps {}

export interface DoorsLayerProps extends CanvasProps {}

export interface WindowsLayerProps extends CanvasProps {}

export interface FurnitureLayerProps extends CanvasProps {}

export interface RoomsLayerProps extends CanvasProps {}

export interface DrawingPreviewProps extends CanvasProps {}

export interface SidebarProps extends CanvasProps {
  onSave: () => void
  onExport: () => void
  saving: boolean
}

// ============================================
// Utility Types
// ============================================

export interface WallWithCorners extends Wall {
  startCorner: Corner
  endCorner: Corner
}

export interface DoorOnWall extends Door {
  wall: WallWithCorners
  worldPosition: Point  // Calculated position in feet
}

export interface WindowOnWall extends Window {
  wall: WallWithCorners
  worldPosition: Point  // Calculated position in feet
}
