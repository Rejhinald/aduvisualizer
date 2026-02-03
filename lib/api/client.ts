/**
 * API Client for ADU Visualizer Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"

export interface ApiResponse<T> {
  status: "success" | "error"
  message: string
  data: T
  error: Record<string, unknown> | unknown[]
  meta: {
    pagination: {
      total: number
      limit: number
      page: number
      pages: number
      prev: boolean
      next: boolean
    } | null
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`

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

// ============ Projects API ============

export interface Project {
  id: string
  name: string
  description?: string
  geoLat?: number
  geoLng?: number
  geoRotation?: number
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  lotWidthFeet?: number
  lotDepthFeet?: number
  status: string
  createdAt: string
  updatedAt: string
}

export async function createProject(data: {
  name: string
  description?: string
}): Promise<ApiResponse<Project>> {
  return fetchApi<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getProject(id: string): Promise<ApiResponse<Project>> {
  return fetchApi<Project>(`/projects/${id}`)
}

export async function listProjects(): Promise<ApiResponse<Project[]>> {
  return fetchApi<Project[]>("/projects")
}

export async function setProjectGeoLocation(
  projectId: string,
  data: {
    lat: number
    lng: number
    rotation?: number
    address?: string
    city?: string
    state?: string
    zipCode?: string
    lotWidthFeet?: number
    lotDepthFeet?: number
  }
): Promise<ApiResponse<unknown>> {
  return fetchApi(`/projects/${projectId}/geo-location`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// ============ Blueprints API ============

export interface Vertex {
  x: number
  y: number
}

export interface RoomData {
  name: string
  type: "bedroom" | "bathroom" | "half_bath" | "kitchen" | "living" | "dining" | "closet" | "laundry" | "storage" | "utility" | "entry" | "corridor" | "flex" | "other"
  description?: string
  color?: string
  vertices: Vertex[]
  widthFeet?: number
  heightFeet?: number
  areaSqFt: number
  rotation?: number
}

export interface DoorData {
  type: "single" | "double" | "sliding" | "french" | "open_passage"
  x: number
  y: number
  widthFeet: number
  rotation?: number
  isExterior?: boolean
}

export interface WindowData {
  type: "standard" | "bay" | "picture" | "sliding"
  x: number
  y: number
  widthFeet: number
  heightFeet: number
  rotation?: number
}

export interface FurnitureData {
  type: string
  category: "bedroom" | "bathroom" | "kitchen" | "living" | "office"
  name?: string
  x: number
  y: number
  widthFeet: number
  heightFeet: number
  rotation?: number
}

export interface SaveBlueprintData {
  projectId: string
  name?: string
  canvasWidth?: number
  canvasHeight?: number
  pixelsPerFoot?: number
  maxCanvasFeet?: number
  gridSize?: number
  aduBoundary: Vertex[]
  aduAreaSqFt: number
  rooms: RoomData[]
  doors: DoorData[]
  windows: WindowData[]
  furniture?: FurnitureData[]
  totalRoomAreaSqFt?: number
  isValid?: boolean
  validationErrors?: string[]
}

export interface Blueprint {
  id: string
  projectId: string
  version: number
  name?: string
  canvasWidth: number
  canvasHeight: number
  pixelsPerFoot: number
  aduBoundary: Vertex[]
  aduAreaSqFt: number
  totalRoomAreaSqFt: number
  isValid: boolean
  createdAt: string
}

export interface SaveBlueprintResponse {
  blueprint: Blueprint
  rooms: unknown[]
  doors: unknown[]
  windows: unknown[]
  furniture: unknown[]
  summary: {
    version: number
    totalRooms: number
    totalDoors: number
    totalWindows: number
    totalFurniture: number
    totalAreaSqFt: number
    aduAreaSqFt: number
  }
}

export async function saveBlueprint(
  data: SaveBlueprintData
): Promise<ApiResponse<SaveBlueprintResponse>> {
  return fetchApi<SaveBlueprintResponse>("/blueprints/save", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getBlueprint(id: string): Promise<ApiResponse<{
  blueprint: Blueprint
  rooms: unknown[]
  doors: unknown[]
  windows: unknown[]
  furniture: unknown[]
}>> {
  return fetchApi(`/blueprints/${id}`)
}

export async function getBlueprintWithGeo(id: string): Promise<ApiResponse<{
  blueprint: Blueprint & { aduBoundaryGeo: Array<{ lat: number; lng: number }> }
  project: {
    id: string
    name: string
    geoLocation: { lat: number; lng: number; rotation: number }
  }
  geoBounds: {
    north: number
    south: number
    east: number
    west: number
    center: { lat: number; lng: number }
  }
  rooms: unknown[]
  doors: unknown[]
  windows: unknown[]
  furniture: unknown[]
  geoConfig: unknown
}>> {
  return fetchApi(`/blueprints/${id}/geo`)
}

export async function listBlueprintsForProject(
  projectId: string
): Promise<ApiResponse<Blueprint[]>> {
  return fetchApi<Blueprint[]>(`/blueprints/project/${projectId}`)
}

// ============ Visualizations API ============

export interface GenerateVisualizationData {
  blueprintId: string
  viewType:
    | "exterior_front"
    | "exterior_back"
    | "exterior_side"
    | "exterior_aerial"
    | "interior_living"
    | "interior_bedroom"
    | "interior_bathroom"
    | "interior_kitchen"
    | "floor_plan_3d"
    | "custom"
  name?: string
  style?: string
  timeOfDay?: string
  weather?: string
}

export interface Visualization {
  id: string
  blueprintId: string
  type: string
  name?: string
  status: string
  prompt?: string
  promptData?: unknown
  imageUrl?: string
  thumbnailUrl?: string
  createdAt: string
}

export interface GenerateVisualizationResponse {
  visualization: Visualization
  prompt: {
    natural: string
    structured: unknown
  }
  apiConfigured: boolean
  message: string
}

export async function generateVisualization(
  data: GenerateVisualizationData
): Promise<ApiResponse<GenerateVisualizationResponse>> {
  return fetchApi<GenerateVisualizationResponse>("/visualizations/generate", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getVisualization(
  id: string
): Promise<ApiResponse<Visualization>> {
  return fetchApi<Visualization>(`/visualizations/${id}`)
}

export async function listVisualizationsForBlueprint(
  blueprintId: string
): Promise<ApiResponse<Visualization[]>> {
  return fetchApi<Visualization[]>(`/visualizations/blueprint/${blueprintId}`)
}

// ============ Actions/Session API ============

export interface EditorSession {
  sessionId: string
  projectId: string
  blueprintId?: string
  startedAt: string
}

export interface ActionLogData {
  sessionId: string
  action: string // e.g., "room.move", "window.resize", "furniture.rotate"
  entityType: "room" | "door" | "window" | "furniture" | "boundary"
  entityId?: string
  previousState?: Record<string, unknown>
  newState?: Record<string, unknown>
  positionX?: number
  positionY?: number
  width?: number
  height?: number
  rotation?: number
}

export interface BatchActionData {
  sessionId: string
  actions: Omit<ActionLogData, "sessionId">[]
}

export interface SessionDetails {
  session: {
    id: string
    projectId: string
    blueprintId?: string
    status: string
    actionCount: number
    startedAt: string
    lastActivityAt: string
    closedAt?: string
  }
  actions: Array<{
    id: string
    action: string
    entityType: string
    entityId?: string
    previousState?: Record<string, unknown>
    newState?: Record<string, unknown>
    positionX?: number
    positionY?: number
    width?: number
    height?: number
    rotation?: number
    createdAt: string
  }>
}

/**
 * Start a new editor session
 */
export async function startEditorSession(data: {
  projectId: string
  blueprintId?: string
}): Promise<ApiResponse<EditorSession>> {
  return fetchApi<EditorSession>("/actions/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

/**
 * End an editor session
 */
export async function endEditorSession(
  sessionId: string
): Promise<ApiResponse<{
  sessionId: string
  status: string
  actionCount: number
  duration?: number
}>> {
  return fetchApi(`/actions/sessions/${sessionId}/end`, {
    method: "POST",
  })
}

/**
 * Log a single action
 */
export async function logAction(
  data: ActionLogData
): Promise<ApiResponse<{ id: string; action: string; createdAt: string }>> {
  return fetchApi("/actions/log", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

/**
 * Log multiple actions in batch (more efficient)
 */
export async function logActionBatch(
  data: BatchActionData
): Promise<ApiResponse<{ logged: number; sessionId: string }>> {
  return fetchApi("/actions/log-batch", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

/**
 * Get session details with all actions
 */
export async function getEditorSession(
  sessionId: string
): Promise<ApiResponse<SessionDetails>> {
  return fetchApi<SessionDetails>(`/actions/sessions/${sessionId}`)
}

/**
 * List sessions for a project
 */
export async function listProjectSessions(
  projectId: string
): Promise<ApiResponse<Array<{
  id: string
  blueprintId?: string
  status: string
  actionCount: number
  startedAt: string
  lastActivityAt: string
  closedAt?: string
}>>> {
  return fetchApi(`/actions/sessions/project/${projectId}`)
}

// ============ Individual Room CRUD API ============

export interface Room {
  id: string
  blueprintId: string
  name: string
  type: "bedroom" | "bathroom" | "half_bath" | "kitchen" | "living" | "dining" | "closet" | "laundry" | "storage" | "utility" | "entry" | "corridor" | "flex" | "other"
  description?: string
  color?: string
  vertices: Vertex[]
  areaSqFt: number
  widthFeet?: number
  heightFeet?: number
  rotation: number
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export async function createRoom(
  blueprintId: string,
  data: Omit<RoomData, "id">
): Promise<ApiResponse<{ room: Room }>> {
  return fetchApi(`/blueprints/${blueprintId}/rooms`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listRooms(
  blueprintId: string
): Promise<ApiResponse<{ rooms: Room[]; count: number }>> {
  return fetchApi(`/blueprints/${blueprintId}/rooms`)
}

export async function getRoom(
  roomId: string
): Promise<ApiResponse<{ room: Room }>> {
  return fetchApi(`/blueprints/rooms/${roomId}`)
}

export async function updateRoom(
  roomId: string,
  data: Partial<RoomData>
): Promise<ApiResponse<{ room: Room }>> {
  return fetchApi(`/blueprints/rooms/${roomId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteRoom(
  roomId: string
): Promise<ApiResponse<{ id: string }>> {
  return fetchApi(`/blueprints/rooms/${roomId}`, {
    method: "DELETE",
  })
}

// ============ Individual Door CRUD API ============

export interface Door {
  id: string
  blueprintId: string
  type: "single" | "double" | "sliding" | "french" | "opening"
  x: number
  y: number
  widthFeet: number
  heightFeet?: number
  rotation: number
  isExterior: boolean
  connectsRoomId1?: string
  connectsRoomId2?: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export async function createDoor(
  blueprintId: string,
  data: Omit<DoorData, "id">
): Promise<ApiResponse<{ door: Door }>> {
  return fetchApi(`/blueprints/${blueprintId}/doors`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listDoors(
  blueprintId: string
): Promise<ApiResponse<{ doors: Door[]; count: number }>> {
  return fetchApi(`/blueprints/${blueprintId}/doors`)
}

export async function getDoor(
  doorId: string
): Promise<ApiResponse<{ door: Door }>> {
  return fetchApi(`/blueprints/doors/${doorId}`)
}

export async function updateDoor(
  doorId: string,
  data: Partial<DoorData>
): Promise<ApiResponse<{ door: Door }>> {
  return fetchApi(`/blueprints/doors/${doorId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteDoor(
  doorId: string
): Promise<ApiResponse<{ id: string }>> {
  return fetchApi(`/blueprints/doors/${doorId}`, {
    method: "DELETE",
  })
}

// ============ Individual Window CRUD API ============

export interface Window {
  id: string
  blueprintId: string
  type: "standard" | "bay" | "picture" | "sliding"
  x: number
  y: number
  widthFeet: number
  heightFeet: number
  sillHeightFeet?: number
  rotation: number
  roomId?: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export async function createWindow(
  blueprintId: string,
  data: Omit<WindowData, "id">
): Promise<ApiResponse<{ window: Window }>> {
  return fetchApi(`/blueprints/${blueprintId}/windows`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listWindows(
  blueprintId: string
): Promise<ApiResponse<{ windows: Window[]; count: number }>> {
  return fetchApi(`/blueprints/${blueprintId}/windows`)
}

export async function getWindow(
  windowId: string
): Promise<ApiResponse<{ window: Window }>> {
  return fetchApi(`/blueprints/windows/${windowId}`)
}

export async function updateWindow(
  windowId: string,
  data: Partial<WindowData>
): Promise<ApiResponse<{ window: Window }>> {
  return fetchApi(`/blueprints/windows/${windowId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteWindow(
  windowId: string
): Promise<ApiResponse<{ id: string }>> {
  return fetchApi(`/blueprints/windows/${windowId}`, {
    method: "DELETE",
  })
}

// ============ Individual Furniture CRUD API ============

export interface Furniture {
  id: string
  blueprintId: string
  type: string
  category: "bedroom" | "bathroom" | "kitchen" | "living" | "office"
  name?: string
  x: number
  y: number
  widthFeet: number
  heightFeet: number
  actualHeightFeet?: number
  rotation: number
  roomId?: string
  zIndex: number
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export async function createFurniture(
  blueprintId: string,
  data: Omit<FurnitureData, "id">
): Promise<ApiResponse<{ furniture: Furniture }>> {
  return fetchApi(`/blueprints/${blueprintId}/furniture`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function bulkCreateFurniture(
  blueprintId: string,
  items: Omit<FurnitureData, "id">[]
): Promise<ApiResponse<{ furniture: Furniture[]; count: number }>> {
  return fetchApi(`/blueprints/${blueprintId}/furniture/bulk`, {
    method: "POST",
    body: JSON.stringify({ items }),
  })
}

export async function listFurniture(
  blueprintId: string,
  category?: string
): Promise<ApiResponse<{ furniture: Furniture[]; count: number }>> {
  const query = category ? `?category=${category}` : ""
  return fetchApi(`/blueprints/${blueprintId}/furniture${query}`)
}

export async function getFurniture(
  furnitureId: string
): Promise<ApiResponse<{ furniture: Furniture }>> {
  return fetchApi(`/blueprints/furniture/${furnitureId}`)
}

export async function updateFurniture(
  furnitureId: string,
  data: Partial<FurnitureData>
): Promise<ApiResponse<{ furniture: Furniture }>> {
  return fetchApi(`/blueprints/furniture/${furnitureId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteFurniture(
  furnitureId: string
): Promise<ApiResponse<{ id: string }>> {
  return fetchApi(`/blueprints/furniture/${furnitureId}`, {
    method: "DELETE",
  })
}

// ============ ADU Boundary API ============

export interface ADUBoundary {
  blueprintId: string
  aduBoundary: Vertex[]
  aduAreaSqFt: number
  pixelsPerFoot?: number
  canvasWidth?: number
  canvasHeight?: number
}

export async function getADUBoundary(
  blueprintId: string
): Promise<ApiResponse<ADUBoundary>> {
  return fetchApi(`/blueprints/${blueprintId}/adu-boundary`)
}

export async function updateADUBoundary(
  blueprintId: string,
  data: { aduBoundary: Vertex[]; aduAreaSqFt?: number }
): Promise<ApiResponse<ADUBoundary>> {
  return fetchApi(`/blueprints/${blueprintId}/adu-boundary`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function resetADUBoundary(
  blueprintId: string
): Promise<ApiResponse<ADUBoundary>> {
  return fetchApi(`/blueprints/${blueprintId}/adu-boundary/reset`, {
    method: "POST",
  })
}

export async function validateADUBoundary(
  blueprintId: string
): Promise<ApiResponse<{
  blueprintId: string
  isValid: boolean
  validationErrors: string[]
  aduAreaSqFt: number
}>> {
  return fetchApi(`/blueprints/${blueprintId}/adu-boundary/validate`, {
    method: "POST",
  })
}

// ============ Snapshots / Version History API ============

// Editor view settings saved with snapshots
export interface SnapshotEditorSettings {
  showLotOverlay: boolean
  showSatelliteView: boolean
  showLotBoundary: boolean
  showGrid: boolean
  zoom: number
  panOffsetX: number
  panOffsetY: number
}

// Lot data saved with snapshots
export interface SnapshotLotData {
  parcelNumber?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  geoLat: number
  geoLng: number
  geoRotation: number
  boundaryVertices?: GeoVertex[]
  lotWidthFeet?: number
  lotDepthFeet?: number
  lotAreaSqFt?: number
  aduOffsetX: number
  aduOffsetY: number
  aduRotation: number
  setbackFrontFeet: number
  setbackBackFeet: number
  setbackLeftFeet: number
  setbackRightFeet: number
  dataSource?: string
}

export interface SnapshotData {
  rooms: RoomData[]
  doors: DoorData[]
  windows: WindowData[]
  furniture: FurnitureData[]
  aduBoundary: Vertex[]
  // Optional fields for backward compatibility with old snapshots
  editorSettings?: SnapshotEditorSettings
  lotData?: SnapshotLotData
}

export interface Snapshot {
  id: string
  projectId: string
  blueprintId?: string
  type: "auto" | "manual"
  label?: string
  data: SnapshotData
  roomCount?: string
  doorCount?: string
  windowCount?: string
  furnitureCount?: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export async function createSnapshot(data: {
  projectId: string
  blueprintId?: string
  type: "auto" | "manual"
  label?: string
  data: SnapshotData
}): Promise<ApiResponse<{ snapshot: Snapshot }>> {
  return fetchApi("/snapshots", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listSnapshots(
  projectId: string,
  type?: "auto" | "manual"
): Promise<ApiResponse<{
  autoSaves: Snapshot[]
  manualSaves: Snapshot[]
  totalCount: number
}>> {
  const query = type ? `?type=${type}` : ""
  return fetchApi(`/snapshots/project/${projectId}${query}`)
}

export async function getSnapshot(
  snapshotId: string
): Promise<ApiResponse<{ snapshot: Snapshot }>> {
  return fetchApi(`/snapshots/${snapshotId}`)
}

export async function deleteSnapshot(
  snapshotId: string
): Promise<ApiResponse<{ id: string }>> {
  return fetchApi(`/snapshots/${snapshotId}`, {
    method: "DELETE",
  })
}

// ============ Lots API ============

export interface GeoVertex {
  lat: number
  lng: number
}

export interface LotData {
  blueprintId: string
  parcelNumber?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  geoLat: number
  geoLng: number
  geoRotation?: number
  boundaryVertices?: GeoVertex[]
  lotWidthFeet?: number
  lotDepthFeet?: number
  lotAreaSqFt?: number
  aduOffsetX?: number
  aduOffsetY?: number
  aduRotation?: number
  setbackFrontFeet?: number
  setbackBackFeet?: number
  setbackLeftFeet?: number
  setbackRightFeet?: number
  dataSource?: "orange_county_gis" | "manual" | "nominatim"
}

export interface Lot {
  id: string
  blueprintId: string
  parcelNumber?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  geoLat: number
  geoLng: number
  geoRotation: number
  boundaryVertices?: GeoVertex[]
  lotWidthFeet?: number
  lotDepthFeet?: number
  lotAreaSqFt?: number
  aduOffsetX: number
  aduOffsetY: number
  aduRotation: number
  setbackFrontFeet: number
  setbackBackFeet: number
  setbackLeftFeet: number
  setbackRightFeet: number
  dataSource?: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface AddressResult {
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
}

export interface ParcelData {
  parcelNumber: string
  situsAddress?: string
  ownerName?: string
  boundaryVertices: GeoVertex[]
  areaSqFt?: number
  bounds?: {
    north: number
    south: number
    east: number
    west: number
  }
}

/**
 * Search for addresses using Nominatim geocoding
 */
export async function searchAddress(
  query: string,
  limit: number = 5
): Promise<ApiResponse<{ results: AddressResult[] }>> {
  return fetchApi("/lots/search-address", {
    method: "POST",
    body: JSON.stringify({ query, limit }),
  })
}

/**
 * Get parcel data from Orange County GIS for a lat/lng point
 */
export async function getParcelData(
  lat: number,
  lng: number
): Promise<ApiResponse<{ parcel: ParcelData }>> {
  return fetchApi(`/lots/parcel?lat=${lat}&lng=${lng}`)
}

/**
 * Create a lot for a blueprint
 */
export async function createLot(
  data: LotData
): Promise<ApiResponse<{ lot: Lot }>> {
  return fetchApi("/lots", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

/**
 * Get lot for a blueprint
 */
export async function getLot(
  blueprintId: string
): Promise<ApiResponse<{ lot: Lot | null }>> {
  return fetchApi(`/lots/blueprint/${blueprintId}`)
}

/**
 * Update a lot
 */
export async function updateLot(
  lotId: string,
  data: Partial<Omit<LotData, "blueprintId">>
): Promise<ApiResponse<{ lot: Lot }>> {
  return fetchApi(`/lots/${lotId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

/**
 * Delete a lot
 */
export async function deleteLot(
  lotId: string
): Promise<ApiResponse<{ id: string }>> {
  return fetchApi(`/lots/${lotId}`, {
    method: "DELETE",
  })
}
