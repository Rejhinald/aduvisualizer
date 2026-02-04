/**
 * Types for 3D Floor Plan Viewer
 */

import type { Point, Room, Door, Window, RoomType, DoorType, WindowType } from "@/lib/types"
import type { Furniture, FurnitureType, CanvasConfig } from "@/components/floor-plan-editor/types"
import type { VibeOption, CameraPlacement, RoomFinish } from "@/lib/api/client"

// Camera modes for the viewer
export type CameraMode = "topdown" | "firstperson"

// Coordinate conversion config
export interface CoordinateConfig {
  pixelsPerFoot: number
  canvasWidth: number
  canvasHeight: number
}

// 3D point (x = left/right, y = height, z = forward/back)
export interface Point3D {
  x: number
  y: number
  z: number
}

// Wall edge derived from room vertices
export interface WallEdge {
  id: string
  start: { x: number; z: number } // in feet (Three.js coords)
  end: { x: number; z: number }
  roomIds: string[] // rooms sharing this wall (1 = exterior, 2 = interior)
  openings: WallOpening[]
  length: number // in feet
  angle: number // radians
}

// Opening (door or window) in a wall
export interface WallOpening {
  type: "door" | "window"
  position: number // distance from wall start in feet
  width: number // feet
  height: number // feet
  bottomOffset: number // height from floor (0 for doors, sillHeight for windows)
  itemId: string // reference to door/window id
}

// Processed room data for 3D
export interface Room3D {
  id: string
  name: string
  type: RoomType
  vertices: Point3D[] // floor polygon in 3D coords
  center: Point3D
  boundingBox: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
    width: number
    depth: number
  }
  area: number // sq ft
  color: string
  vibe?: VibeOption
  tier?: string
}

// Processed door data for 3D
export interface Door3D {
  id: string
  type: DoorType
  position: Point3D
  rotation: number // radians
  width: number // feet
  height: number // feet
  wallAngle: number // angle of wall this door is on
}

// Processed window data for 3D
export interface Window3D {
  id: string
  type: WindowType
  position: Point3D
  rotation: number // radians
  width: number // feet
  height: number // feet
  sillHeight: number // height from floor
  wallAngle: number
}

// Processed furniture data for 3D
export interface Furniture3D {
  id: string
  type: FurnitureType
  position: Point3D
  rotation: number // radians
  width: number // feet
  depth: number // feet
  height: number // feet (3D height)
  color: string
}

// Material palette for a vibe
export interface VibePalette {
  wall: string // hex color
  floor: string
  ceiling: string
  trim: string
  accent: string
  roughness: number
  metalness: number
}

// Props for the main 3D viewer
export interface FloorPlan3DViewerProps {
  rooms: Room[]
  doors: Door[]
  windows: Window[]
  furniture: Furniture[]
  aduBoundary: Point[]
  roomFinishes?: RoomFinish[]
  cameraPlacement?: CameraPlacement
  pixelsPerFoot: number
  canvasWidth: number
  canvasHeight: number
  initialCameraMode?: CameraMode
  onCameraModeChange?: (mode: CameraMode) => void
}

// Re-export common types
export type { Point, Room, Door, Window, RoomType, DoorType, WindowType }
export type { Furniture, FurnitureType, CanvasConfig }
export type { VibeOption, CameraPlacement, RoomFinish }
