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
  type: "bedroom" | "bathroom" | "kitchen" | "living" | "dining" | "corridor" | "other"
  description?: string
  color?: string
  vertices: Vertex[]
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
