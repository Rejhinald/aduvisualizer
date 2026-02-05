/**
 * API Client v2 for ADU Visualizer Backend
 * Blueprint Engine v2 - Corner/Wall Graph Model
 * All coordinates in FEET
 */

const API_V2_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace('/v1', '/v2')}`
  : "http://localhost:3001/api/v2"

export interface ApiResponse<T> {
  status: "success" | "error"
  message: string
  data: T
  error?: Record<string, unknown> | unknown[]
}

async function fetchApiV2<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_V2_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || "API request failed")
  }

  return data
}

// ============================================
// Types - Match backend types/blueprint-v2.ts
// ============================================

export interface Point {
  x: number // feet
  y: number // feet
}

// Corner - foundation of the wall graph
export interface Corner {
  id: string
  x: number // feet
  y: number // feet
  elevation: number
  blueprintId?: string
  createdAt?: string
  updatedAt?: string
}

// Wall types for rendering behavior
export type WallType = "solid" | "virtual" | "partition"

// Wall - connects two corners
export interface Wall {
  id: string
  blueprintId: string
  startCornerId: string
  endCornerId: string
  thickness: number // feet (default 0.5 = 6 inches)
  height: number // feet (default 9)
  wallType: WallType // "solid" = physical wall, "virtual" = room divider (no 3D), "partition" = half-height
  createdAt?: string
  updatedAt?: string
}

// Door types
export type DoorType = "single" | "double" | "sliding" | "french" | "opening"

// Door - placed on a wall
export interface Door {
  id: string
  wallId: string
  position: number // 0-1 along wall length
  type: DoorType
  width: number // feet (default 3)
  height: number // feet (default 6.67)
  orientation?: number // 0-3: hinge left/right × swing direction (default 0)
  createdAt?: string
  updatedAt?: string
}

// Window types
export type WindowType = "standard" | "bay" | "picture" | "sliding"

// Window - placed on a wall
export interface Window {
  id: string
  wallId: string
  position: number // 0-1 along wall length
  type: WindowType
  width: number // feet (default 3)
  height: number // feet (default 4)
  sillHeight: number // feet from floor (default 3)
  createdAt?: string
  updatedAt?: string
}

// Furniture types
export type FurnitureType =
  // Bedroom
  | "bed_queen" | "bed_king" | "bed_twin" | "dresser" | "nightstand"
  // Bathroom
  | "toilet" | "sink" | "bathtub" | "shower"
  // Kitchen
  | "refrigerator" | "stove" | "dishwasher" | "kitchen_sink"
  // Living
  | "sofa_3seat" | "sofa_2seat" | "armchair" | "coffee_table" | "dining_table" | "dining_chair"
  // Office
  | "desk" | "office_chair" | "bookshelf"

// Furniture - free placement
export interface Furniture {
  id: string
  blueprintId: string
  type: FurnitureType
  x: number // feet
  y: number // feet
  rotation: number // degrees
  width: number // feet
  depth: number // feet
  createdAt?: string
  updatedAt?: string
}

// Boundary Corner - for ADU boundary shape
export interface BoundaryCorner {
  id: string
  blueprintId?: string
  x: number // feet
  y: number // feet
  orderIndex: number // order in polygon
  createdAt?: string
  updatedAt?: string
}

// Boundary Wall - connects two boundary corners
export interface BoundaryWall {
  id: string
  blueprintId?: string
  startCornerId: string
  endCornerId: string
  createdAt?: string
  updatedAt?: string
}

// Room types
export type RoomType =
  | "bedroom" | "bathroom" | "half_bath" | "kitchen" | "living"
  | "dining" | "closet" | "laundry" | "storage" | "utility"
  | "entry" | "corridor" | "flex" | "other"

// Room - computed from wall graph (not stored)
export interface Room {
  id: string
  corners: Corner[]
  walls: Wall[]
  area: number // sq ft
  center: Point
  name: string
  type: RoomType
}

// Setbacks
export interface Setbacks {
  front: number // feet
  back: number // feet
  left: number // feet
  right: number // feet
}

// Lot source
export type LotSource = "gis" | "manual"

// Lot
export interface Lot {
  id: string
  blueprintId: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  geoLat?: number
  geoLng?: number
  boundary?: Point[] // in feet
  setbacks: Setbacks
  source: LotSource
  createdAt?: string
  updatedAt?: string
}

// Blueprint response
export interface Blueprint {
  id: string
  projectId: string
  name: string | null
  version: number
  corners: Corner[]
  walls: Wall[]
  doors: Door[]
  windows: Window[]
  furniture: Furniture[]
  boundaryCorners: BoundaryCorner[]
  boundaryWalls: BoundaryWall[]
  rooms: Room[]
  lot?: Lot
  createdAt: string
  updatedAt: string
}

// Snapshot
export interface Snapshot {
  id: string
  blueprintId: string
  description?: string
  data: unknown
  createdAt: string
}

// Action log
export interface ActionLog {
  id: string
  blueprintId: string
  actionType: string
  entityType: string
  entityId?: string
  beforeState?: unknown
  afterState?: unknown
  createdAt: string
}

// Export record
export interface ExportRecord {
  id: string
  blueprintId: string
  type: "pdf" | "png"
  filePath?: string
  createdAt: string
}

// ============================================
// Standard Dimensions (constants)
// ============================================

export const STANDARD_DIMENSIONS = {
  WALL_THICKNESS: 0.5,         // 6 inches
  WALL_HEIGHT: 9,              // 9 feet ceiling
  DOOR_WIDTH_SINGLE: 3,        // 36 inches
  DOOR_WIDTH_DOUBLE: 6,        // 72 inches
  DOOR_HEIGHT: 6.67,           // 80 inches (6'8")
  WINDOW_WIDTH_STANDARD: 3,    // 36 inches
  WINDOW_HEIGHT_STANDARD: 4,   // 48 inches
  WINDOW_SILL_HEIGHT: 3,       // 36 inches
  GRID_SIZE_MAJOR: 1,          // 1 foot
  GRID_SIZE_MINOR: 0.5,        // 6 inches
  MIN_ROOM_DIMENSION: 3,       // 3 feet
  MIN_HALLWAY_WIDTH: 3,        // 3 feet
} as const

// Default furniture dimensions
export const FURNITURE_DIMENSIONS: Record<FurnitureType, { width: number; depth: number }> = {
  bed_queen: { width: 5, depth: 6.67 },
  bed_king: { width: 6.33, depth: 6.67 },
  bed_twin: { width: 3.25, depth: 6.33 },
  dresser: { width: 5, depth: 1.5 },
  nightstand: { width: 2, depth: 1.5 },
  toilet: { width: 1.5, depth: 2.33 },
  sink: { width: 2, depth: 1.5 },
  bathtub: { width: 2.5, depth: 5 },
  shower: { width: 3, depth: 3 },
  refrigerator: { width: 3, depth: 2.5 },
  stove: { width: 2.5, depth: 2.5 },
  dishwasher: { width: 2, depth: 2 },
  kitchen_sink: { width: 2.5, depth: 2 },
  sofa_3seat: { width: 7, depth: 3 },
  sofa_2seat: { width: 5, depth: 3 },
  armchair: { width: 2.5, depth: 2.5 },
  coffee_table: { width: 4, depth: 2 },
  dining_table: { width: 6, depth: 3 },
  dining_chair: { width: 1.5, depth: 1.5 },
  desk: { width: 5, depth: 2.5 },
  office_chair: { width: 2, depth: 2 },
  bookshelf: { width: 3, depth: 1 },
}

// ============================================
// Blueprints API
// ============================================

export interface SaveBlueprintData {
  projectId: string
  name?: string
  corners: Array<{ id?: string; x: number; y: number; elevation?: number }>
  walls: Array<{ id?: string; startCornerId: string; endCornerId: string; thickness?: number; height?: number; wallType?: WallType }>
  doors: Array<{ id?: string; wallId: string; position: number; type?: DoorType; width?: number; height?: number; orientation?: number }>
  windows: Array<{ id?: string; wallId: string; position: number; type?: WindowType; width?: number; height?: number; sillHeight?: number }>
  furniture: Array<{ id?: string; type: FurnitureType; x: number; y: number; rotation?: number; width: number; depth: number }>
  boundaryCorners?: Array<{ id?: string; x: number; y: number; orderIndex?: number }>
  boundaryWalls?: Array<{ id?: string; startCornerId: string; endCornerId: string }>
  lot?: {
    address?: string
    city?: string
    state?: string
    zipCode?: string
    geoLat?: number
    geoLng?: number
    boundary?: Point[]
    setbacks?: Setbacks
    source?: LotSource
  }
}

export async function saveBlueprint(data: SaveBlueprintData): Promise<ApiResponse<Blueprint>> {
  return fetchApiV2<Blueprint>("/blueprints/save", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getBlueprint(blueprintId: string): Promise<ApiResponse<Blueprint>> {
  return fetchApiV2<Blueprint>(`/blueprints/${blueprintId}`)
}

export async function getBlueprintByProject(projectId: string): Promise<ApiResponse<Blueprint | null>> {
  return fetchApiV2<Blueprint | null>(`/blueprints/project/${projectId}`)
}

// ============================================
// Corners API
// ============================================

export async function createCorner(data: {
  blueprintId: string
  x: number
  y: number
  elevation?: number
}): Promise<ApiResponse<Corner>> {
  return fetchApiV2<Corner>("/corners", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listCorners(blueprintId: string): Promise<ApiResponse<Corner[]>> {
  return fetchApiV2<Corner[]>(`/corners/blueprint/${blueprintId}`)
}

export async function updateCorner(cornerId: string, data: {
  x?: number
  y?: number
  elevation?: number
}): Promise<ApiResponse<Corner>> {
  return fetchApiV2<Corner>(`/corners/${cornerId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteCorner(cornerId: string): Promise<ApiResponse<{ id: string }>> {
  return fetchApiV2<{ id: string }>(`/corners/${cornerId}`, {
    method: "DELETE",
  })
}

// ============================================
// Walls API
// ============================================

export async function createWall(data: {
  blueprintId: string
  startCornerId: string
  endCornerId: string
  thickness?: number
  height?: number
  wallType?: WallType
}): Promise<ApiResponse<Wall>> {
  return fetchApiV2<Wall>("/walls", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listWalls(blueprintId: string): Promise<ApiResponse<Wall[]>> {
  return fetchApiV2<Wall[]>(`/walls/blueprint/${blueprintId}`)
}

export async function updateWall(wallId: string, data: {
  thickness?: number
  height?: number
  wallType?: WallType
}): Promise<ApiResponse<Wall>> {
  return fetchApiV2<Wall>(`/walls/${wallId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteWall(wallId: string): Promise<ApiResponse<{ id: string }>> {
  return fetchApiV2<{ id: string }>(`/walls/${wallId}`, {
    method: "DELETE",
  })
}

// ============================================
// Doors API
// ============================================

export async function createDoor(data: {
  wallId: string
  position: number
  type?: DoorType
  width?: number
  height?: number
}): Promise<ApiResponse<Door>> {
  return fetchApiV2<Door>("/doors", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listDoors(wallId: string): Promise<ApiResponse<Door[]>> {
  return fetchApiV2<Door[]>(`/doors/wall/${wallId}`)
}

export async function updateDoor(doorId: string, data: {
  position?: number
  type?: DoorType
  width?: number
  height?: number
}): Promise<ApiResponse<Door>> {
  return fetchApiV2<Door>(`/doors/${doorId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteDoor(doorId: string): Promise<ApiResponse<{ id: string }>> {
  return fetchApiV2<{ id: string }>(`/doors/${doorId}`, {
    method: "DELETE",
  })
}

// ============================================
// Windows API
// ============================================

export async function createWindow(data: {
  wallId: string
  position: number
  type?: WindowType
  width?: number
  height?: number
  sillHeight?: number
}): Promise<ApiResponse<Window>> {
  return fetchApiV2<Window>("/windows", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listWindows(wallId: string): Promise<ApiResponse<Window[]>> {
  return fetchApiV2<Window[]>(`/windows/wall/${wallId}`)
}

export async function updateWindow(windowId: string, data: {
  position?: number
  type?: WindowType
  width?: number
  height?: number
  sillHeight?: number
}): Promise<ApiResponse<Window>> {
  return fetchApiV2<Window>(`/windows/${windowId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteWindow(windowId: string): Promise<ApiResponse<{ id: string }>> {
  return fetchApiV2<{ id: string }>(`/windows/${windowId}`, {
    method: "DELETE",
  })
}

// ============================================
// Furniture API
// ============================================

export async function createFurniture(data: {
  blueprintId: string
  type: FurnitureType
  x: number
  y: number
  rotation?: number
  width: number
  depth: number
}): Promise<ApiResponse<Furniture>> {
  return fetchApiV2<Furniture>("/furniture", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listFurniture(blueprintId: string): Promise<ApiResponse<Furniture[]>> {
  return fetchApiV2<Furniture[]>(`/furniture/blueprint/${blueprintId}`)
}

export async function updateFurniture(furnitureId: string, data: {
  x?: number
  y?: number
  rotation?: number
  width?: number
  depth?: number
}): Promise<ApiResponse<Furniture>> {
  return fetchApiV2<Furniture>(`/furniture/${furnitureId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteFurniture(furnitureId: string): Promise<ApiResponse<{ id: string }>> {
  return fetchApiV2<{ id: string }>(`/furniture/${furnitureId}`, {
    method: "DELETE",
  })
}

// ============================================
// Lots API
// ============================================

export async function searchAddress(query: string, limit: number = 5): Promise<ApiResponse<{ results: Array<{
  placeId: string
  displayName: string
  lat: number
  lng: number
  boundingBox?: number[]
  addressComponents?: {
    houseNumber?: string
    road?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
  }
}> }>> {
  return fetchApiV2("/lots/search-address", {
    method: "POST",
    body: JSON.stringify({ query, limit }),
  })
}

export async function getParcelData(lat: number, lng: number): Promise<ApiResponse<{ parcel: {
  parcelNumber: string
  situsAddress?: string
  ownerName?: string
  boundaryVertices: Array<{ lat: number; lng: number }>
  areaSqFt?: number
  bounds?: { north: number; south: number; east: number; west: number }
} }>> {
  return fetchApiV2(`/lots/parcel?lat=${lat}&lng=${lng}`)
}

export async function createLot(data: {
  blueprintId: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  geoLat?: number
  geoLng?: number
  boundary?: Point[]
  setbacks?: Setbacks
  source?: LotSource
}): Promise<ApiResponse<Lot>> {
  return fetchApiV2<Lot>("/lots", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getLot(blueprintId: string): Promise<ApiResponse<Lot | null>> {
  return fetchApiV2<Lot | null>(`/lots/blueprint/${blueprintId}`)
}

export async function updateLot(lotId: string, data: {
  address?: string
  city?: string
  state?: string
  zipCode?: string
  geoLat?: number
  geoLng?: number
  boundary?: Point[]
  setbacks?: Setbacks
  source?: LotSource
}): Promise<ApiResponse<Lot>> {
  return fetchApiV2<Lot>(`/lots/${lotId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteLot(lotId: string): Promise<ApiResponse<{ id: string }>> {
  return fetchApiV2<{ id: string }>(`/lots/${lotId}`, {
    method: "DELETE",
  })
}

// ============================================
// Snapshots API
// ============================================

export async function createSnapshot(data: {
  blueprintId: string
  description?: string
}): Promise<ApiResponse<Snapshot>> {
  return fetchApiV2<Snapshot>("/snapshots", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listSnapshots(blueprintId: string): Promise<ApiResponse<Array<{
  id: string
  blueprintId: string
  description?: string
  createdAt: string
}>>> {
  return fetchApiV2(`/snapshots/blueprint/${blueprintId}`)
}

export async function getSnapshot(snapshotId: string): Promise<ApiResponse<Snapshot>> {
  return fetchApiV2<Snapshot>(`/snapshots/${snapshotId}`)
}

export async function restoreSnapshot(snapshotId: string): Promise<ApiResponse<{ snapshotId: string; blueprintId: string }>> {
  return fetchApiV2<{ snapshotId: string; blueprintId: string }>(`/snapshots/${snapshotId}/restore`, {
    method: "POST",
  })
}

export async function deleteSnapshot(snapshotId: string): Promise<ApiResponse<{ id: string }>> {
  return fetchApiV2<{ id: string }>(`/snapshots/${snapshotId}`, {
    method: "DELETE",
  })
}

// ============================================
// Action Logs API
// ============================================

export async function listActionLogs(blueprintId: string, limit?: number): Promise<ApiResponse<ActionLog[]>> {
  const query = limit ? `?limit=${limit}` : ""
  return fetchApiV2<ActionLog[]>(`/action-logs/blueprint/${blueprintId}${query}`)
}

export async function getActionLog(logId: string): Promise<ApiResponse<ActionLog>> {
  return fetchApiV2<ActionLog>(`/action-logs/${logId}`)
}

// ============================================
// Exports API
// ============================================

export async function createExport(data: {
  blueprintId: string
  type: "pdf" | "png"
}): Promise<ApiResponse<{ export: ExportRecord; blueprint: Blueprint }>> {
  return fetchApiV2<{ export: ExportRecord; blueprint: Blueprint }>("/exports", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listExports(blueprintId: string): Promise<ApiResponse<ExportRecord[]>> {
  return fetchApiV2<ExportRecord[]>(`/exports/blueprint/${blueprintId}`)
}

export async function getExport(exportId: string): Promise<ApiResponse<ExportRecord>> {
  return fetchApiV2<ExportRecord>(`/exports/${exportId}`)
}

export async function deleteExport(exportId: string): Promise<ApiResponse<{ id: string }>> {
  return fetchApiV2<{ id: string }>(`/exports/${exportId}`, {
    method: "DELETE",
  })
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert feet to display string (e.g., 12.5 -> "12' 6\"")
 */
export function feetToDisplayString(feet: number): string {
  const wholeFeet = Math.floor(feet)
  const inches = Math.round((feet - wholeFeet) * 12)
  if (inches === 0) return `${wholeFeet}'`
  if (wholeFeet === 0) return `${inches}"`
  return `${wholeFeet}' ${inches}"`
}

/**
 * Parse display string to feet (e.g., "12' 6\"" -> 12.5)
 */
export function displayStringToFeet(str: string): number {
  const normalized = str.replace(/'/g, " ").replace(/"/g, "").replace(/\s+/g, " ").trim()
  const parts = normalized.split(" ")

  if (parts.length === 1) {
    const num = parseFloat(parts[0])
    if (str.includes('"')) {
      // inches only
      return num / 12
    }
    // feet only
    return num
  }

  // feet and inches
  const feet = parseFloat(parts[0]) || 0
  const inches = parseFloat(parts[1]) || 0
  return feet + inches / 12
}

/**
 * Calculate distance between two points (in feet)
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate angle between two points (in radians)
 */
export function angle(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x)
}

/**
 * Calculate polygon area (in square feet)
 * Using shoelace formula
 */
export function polygonArea(vertices: Point[]): number {
  let area = 0
  const n = vertices.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += vertices[i].x * vertices[j].y
    area -= vertices[j].x * vertices[i].y
  }
  return Math.abs(area) / 2
}

/**
 * Calculate polygon centroid
 */
export function polygonCentroid(vertices: Point[]): Point {
  let cx = 0
  let cy = 0
  const n = vertices.length
  for (const v of vertices) {
    cx += v.x
    cy += v.y
  }
  return { x: cx / n, y: cy / n }
}

/**
 * Check if point is inside polygon
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    if ((yi > point.y) !== (yj > point.y) && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}
