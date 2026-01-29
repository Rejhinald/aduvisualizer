/**
 * Convert floor plan editor data to API format
 */

import type { SaveBlueprintData, RoomData, DoorData, WindowData, FurnitureData } from "./client"

// Types matching the floor plan editor
interface EditorRoom {
  id: string
  name: string
  type: string
  color: string
  vertices: Array<{ x: number; y: number }>
  area: number
  rotation?: number
  description?: string  // For "other" room type
}

interface EditorDoor {
  id: string
  type: string
  x: number
  y: number
  width: number
  rotation?: number
}

interface EditorWindow {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

interface EditorFurniture {
  id: string
  type: string
  category?: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

interface EditorData {
  rooms: EditorRoom[]
  doors: EditorDoor[]
  windows: EditorWindow[]
  furniture: EditorFurniture[]
  aduBoundary: Array<{ x: number; y: number }>
  pixelsPerFoot?: number
  canvasWidth?: number
  canvasHeight?: number
}

// Pixels per foot (matching the editor)
const DEFAULT_PIXELS_PER_FOOT = 100

/**
 * Calculate bounding box dimensions from vertices
 */
function calculateBoundingBox(vertices: Array<{ x: number; y: number }>, pixelsPerFoot: number): { widthFeet: number; heightFeet: number } {
  if (vertices.length < 3) return { widthFeet: 0, heightFeet: 0 }

  const xs = vertices.map(v => v.x)
  const ys = vertices.map(v => v.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    widthFeet: Math.round((maxX - minX) / pixelsPerFoot * 10) / 10,  // Round to 1 decimal
    heightFeet: Math.round((maxY - minY) / pixelsPerFoot * 10) / 10,
  }
}

/**
 * Convert editor room data to API format
 */
function convertRoom(room: EditorRoom, pixelsPerFoot: number): RoomData {
  const { widthFeet, heightFeet } = calculateBoundingBox(room.vertices, pixelsPerFoot)

  return {
    name: room.name,
    type: room.type as RoomData["type"],
    description: room.description,  // Pass through description for "other" type
    color: room.color,
    vertices: room.vertices,
    widthFeet,
    heightFeet,
    areaSqFt: room.area,
    rotation: room.rotation ?? 0,
  }
}

/**
 * Map frontend door type to API door type
 * Frontend uses "opening", API expects "open_passage"
 */
function mapDoorType(frontendType: string): DoorData["type"] {
  const typeMap: Record<string, DoorData["type"]> = {
    single: "single",
    double: "double",
    sliding: "sliding",
    french: "french",
    opening: "open_passage", // Frontend "opening" -> API "open_passage"
  }
  return typeMap[frontendType] ?? "single"
}

/**
 * Convert editor door data to API format
 */
function convertDoor(door: EditorDoor): DoorData {
  return {
    type: mapDoorType(door.type),
    x: door.x,
    y: door.y,
    widthFeet: door.width,
    rotation: door.rotation ?? 0,
    isExterior: false, // TODO: Detect exterior doors
  }
}

/**
 * Convert editor window data to API format
 */
function convertWindow(win: EditorWindow): WindowData {
  return {
    type: win.type as WindowData["type"],
    x: win.x,
    y: win.y,
    widthFeet: win.width,
    heightFeet: win.height,
    rotation: win.rotation ?? 0,
  }
}

/**
 * Get furniture category from type
 */
function getFurnitureCategory(type: string): FurnitureData["category"] {
  const categoryMap: Record<string, FurnitureData["category"]> = {
    queen_bed: "bedroom",
    king_bed: "bedroom",
    twin_bed: "bedroom",
    dresser: "bedroom",
    nightstand: "bedroom",
    toilet: "bathroom",
    sink_vanity: "bathroom",
    bathtub: "bathroom",
    shower: "bathroom",
    refrigerator: "kitchen",
    stove: "kitchen",
    sink: "kitchen",
    dishwasher: "kitchen",
    kitchen_island: "kitchen",
    sofa: "living",
    loveseat: "living",
    armchair: "living",
    coffee_table: "living",
    tv_stand: "living",
    dining_table: "living",
    dining_chair: "living",
    desk: "office",
    office_chair: "office",
    bookshelf: "office",
  }
  return categoryMap[type] ?? "living"
}

/**
 * Convert editor furniture data to API format
 */
function convertFurniture(item: EditorFurniture): FurnitureData {
  return {
    type: item.type,
    category: (item.category as FurnitureData["category"]) ?? getFurnitureCategory(item.type),
    x: item.x,
    y: item.y,
    widthFeet: item.width,
    heightFeet: item.height,
    rotation: item.rotation ?? 0,
  }
}

/**
 * Calculate polygon area from vertices (in square pixels)
 */
function calculatePolygonArea(vertices: Array<{ x: number; y: number }>): number {
  if (vertices.length < 3) return 0

  let area = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    area += vertices[i].x * vertices[j].y
    area -= vertices[j].x * vertices[i].y
  }
  return Math.abs(area / 2)
}

/**
 * Convert all editor data to API SaveBlueprintData format
 */
export function convertEditorDataToApi(
  projectId: string,
  editorData: EditorData,
  options?: {
    name?: string
    isValid?: boolean
    validationErrors?: string[]
  }
): SaveBlueprintData {
  const pixelsPerFoot = editorData.pixelsPerFoot ?? DEFAULT_PIXELS_PER_FOOT
  const canvasWidth = editorData.canvasWidth ?? 800
  const canvasHeight = editorData.canvasHeight ?? 800

  // Calculate ADU area from boundary
  const aduAreaPixels = calculatePolygonArea(editorData.aduBoundary)
  const aduAreaSqFt = Math.round(aduAreaPixels / (pixelsPerFoot * pixelsPerFoot))

  // Calculate total room area
  const totalRoomAreaSqFt = editorData.rooms.reduce((sum, room) => sum + room.area, 0)

  return {
    projectId,
    name: options?.name,
    canvasWidth,
    canvasHeight,
    pixelsPerFoot,
    maxCanvasFeet: 36,
    gridSize: pixelsPerFoot,
    aduBoundary: editorData.aduBoundary,
    aduAreaSqFt,
    rooms: editorData.rooms.map((r) => convertRoom(r, pixelsPerFoot)),
    doors: editorData.doors.map(convertDoor),
    windows: editorData.windows.map(convertWindow),
    furniture: editorData.furniture.map(convertFurniture),
    totalRoomAreaSqFt,
    isValid: options?.isValid,
    validationErrors: options?.validationErrors,
  }
}

/**
 * Convert API blueprint data back to editor format
 */
export function convertApiBlueprintToEditor(
  blueprint: {
    aduBoundary: Array<{ x: number; y: number }>
    pixelsPerFoot: number
    canvasWidth: number
    canvasHeight: number
  },
  rooms: Array<{
    id: string
    name: string
    type: string
    color?: string
    vertices: Array<{ x: number; y: number }>
    areaSqFt: number
    rotation?: number
  }>,
  doors: Array<{
    id: string
    type: string
    x: number
    y: number
    widthFeet: number
    rotation?: number
  }>,
  windows: Array<{
    id: string
    type: string
    x: number
    y: number
    widthFeet: number
    heightFeet: number
    rotation?: number
  }>,
  furniture: Array<{
    id: string
    type: string
    category: string
    x: number
    y: number
    widthFeet: number
    heightFeet: number
    rotation?: number
  }>
): EditorData {
  return {
    aduBoundary: blueprint.aduBoundary,
    pixelsPerFoot: blueprint.pixelsPerFoot,
    canvasWidth: blueprint.canvasWidth,
    canvasHeight: blueprint.canvasHeight,
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      color: r.color ?? "#a8d5e5",
      vertices: r.vertices,
      area: r.areaSqFt,
      rotation: r.rotation,
    })),
    doors: doors.map((d) => ({
      id: d.id,
      type: d.type === "open_passage" ? "opening" : d.type, // API "open_passage" -> Frontend "opening"
      x: d.x,
      y: d.y,
      width: d.widthFeet,
      rotation: d.rotation,
    })),
    windows: windows.map((w) => ({
      id: w.id,
      type: w.type,
      x: w.x,
      y: w.y,
      width: w.widthFeet,
      height: w.heightFeet,
      rotation: w.rotation,
    })),
    furniture: furniture.map((f) => ({
      id: f.id,
      type: f.type,
      category: f.category,
      x: f.x,
      y: f.y,
      width: f.widthFeet,
      height: f.heightFeet,
      rotation: f.rotation,
    })),
  }
}
