/**
 * Floor Plan 3D Viewer Types - V2
 *
 * Coordinate System:
 * - v2 Canvas: X = right, Y = down (in feet)
 * - Three.js: X = right, Y = up, Z = forward (in feet)
 *
 * Direct mapping:
 * - Canvas (x, y) feet -> Three.js (x, 0, y) feet
 * - Height in Three.js uses Y axis
 *
 * Wall Types:
 * - "solid": Physical wall, renders at full height in 3D
 * - "virtual": Room divider, NOT rendered in 3D (only for room detection)
 * - "partition": Half-height wall, renders at partial height in 3D
 */

import type { Blueprint, Corner, Wall, Door, Window, Furniture, Room, WallType } from "@/lib/api/client-v2"

// Re-export for convenience
export type { Blueprint, Corner, Wall, Door, Window, Furniture, Room, WallType }

// Camera modes
export type CameraMode = "top-down" | "first-person"

// 3D point in Three.js coordinates
export interface Point3D {
  x: number // left/right
  y: number // height
  z: number // forward/back
}

// Wall segment with openings
export interface Wall3D {
  id: string
  start: Point3D
  end: Point3D
  thickness: number
  height: number
  angle: number // radians
  length: number
  openings: Opening3D[]
  wallType: WallType // "solid" | "virtual" | "partition"
}

// Opening in a wall (door or window)
export interface Opening3D {
  type: "door" | "window"
  id: string
  center: Point3D // center of opening
  width: number
  height: number
  bottomY: number // 0 for doors, sillHeight for windows
  doorType?: string
  windowType?: string
}

// Floor polygon for a room
export interface Floor3D {
  id: string
  name: string
  type: string
  vertices: Point3D[]
  color: string
}

// Furniture item
export interface Furniture3D {
  id: string
  type: string
  position: Point3D
  rotation: number // radians
  width: number
  depth: number
  height: number
  color: string
}

// Scene bounds for camera positioning
export interface SceneBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  width: number
  depth: number
  centerX: number
  centerZ: number
}

// Main viewer props
export interface FloorPlan3DViewerProps {
  blueprint: Blueprint
  initialCameraMode?: CameraMode
  onCameraModeChange?: (mode: CameraMode) => void
}
