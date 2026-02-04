/**
 * Hook to convert 2D floor plan data to 3D geometry data
 *
 * This hook processes rooms, doors, windows, and furniture
 * and produces data ready for Three.js rendering.
 */

import { useMemo } from "react"
import type {
  Room,
  Door,
  Window,
  Point,
  CoordinateConfig,
  WallEdge,
  WallOpening,
  Room3D,
  Door3D,
  Window3D,
  Furniture3D,
} from "../types"
import type { Furniture } from "@/components/floor-plan-editor/types"
import type { RoomFinish } from "@/lib/api/client"
import { useCoordinateConversion } from "./use-coordinate-conversion"
import { DIMENSIONS, FURNITURE_3D, DEFAULT_VIBE } from "../constants"

// Tolerance for comparing floating point coordinates
const TOLERANCE = 0.1 // feet

/**
 * Create a normalized key for a wall edge (for deduplication)
 * Ensures the same edge from two rooms gets the same key
 */
function createEdgeKey(
  start: { x: number; z: number },
  end: { x: number; z: number }
): string {
  // Round to avoid floating point issues
  const s = { x: Math.round(start.x * 100), z: Math.round(start.z * 100) }
  const e = { x: Math.round(end.x * 100), z: Math.round(end.z * 100) }

  // Always order by smaller point first
  if (s.x < e.x || (s.x === e.x && s.z < e.z)) {
    return `${s.x},${s.z}-${e.x},${e.z}`
  }
  return `${e.x},${e.z}-${s.x},${s.z}`
}

/**
 * Calculate the distance between two points
 */
function distance(
  p1: { x: number; z: number },
  p2: { x: number; z: number }
): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.z - p1.z) ** 2)
}

/**
 * Calculate the angle of a line segment
 */
function lineAngle(
  start: { x: number; z: number },
  end: { x: number; z: number }
): number {
  return Math.atan2(end.z - start.z, end.x - start.x)
}

/**
 * Project a point onto a line segment, returning the distance from start
 */
function projectPointOntoLine(
  point: { x: number; z: number },
  lineStart: { x: number; z: number },
  lineEnd: { x: number; z: number }
): number {
  const lineLen = distance(lineStart, lineEnd)
  if (lineLen === 0) return 0

  const dx = lineEnd.x - lineStart.x
  const dz = lineEnd.z - lineStart.z

  // Vector from line start to point
  const px = point.x - lineStart.x
  const pz = point.z - lineStart.z

  // Dot product divided by line length gives projection distance
  const projection = (px * dx + pz * dz) / lineLen

  return Math.max(0, Math.min(lineLen, projection))
}

/**
 * Check if a point is near a line segment
 */
function isPointNearLine(
  point: { x: number; z: number },
  lineStart: { x: number; z: number },
  lineEnd: { x: number; z: number },
  threshold: number = 1.0 // feet
): boolean {
  const lineLen = distance(lineStart, lineEnd)
  if (lineLen === 0) return distance(point, lineStart) < threshold

  // Calculate perpendicular distance to line
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) +
        (point.z - lineStart.z) * (lineEnd.z - lineStart.z)) /
        (lineLen * lineLen)
    )
  )

  const nearestX = lineStart.x + t * (lineEnd.x - lineStart.x)
  const nearestZ = lineStart.z + t * (lineEnd.z - lineStart.z)

  return distance(point, { x: nearestX, z: nearestZ }) < threshold
}

/**
 * Check if door/window rotation matches wall orientation
 */
function rotationMatchesWall(
  itemRotation: number, // degrees
  wallAngle: number // radians
): boolean {
  // Convert wall angle to degrees and normalize
  const wallDegrees = ((wallAngle * 180) / Math.PI + 360) % 360

  // Item rotation is 0, 90, 180, 270
  // Wall is considered matching if within 45 degrees
  const diff = Math.abs(((itemRotation - wallDegrees + 180) % 360) - 180)
  return diff < 45 || diff > 135 // Perpendicular to wall is also valid
}

export function useFloorPlanGeometry(
  rooms: Room[],
  doors: Door[],
  windows: Window[],
  furniture: Furniture[],
  config: CoordinateConfig,
  roomFinishes?: RoomFinish[]
) {
  const converter = useCoordinateConversion(config)

  // Process rooms into 3D data
  const rooms3D = useMemo((): Room3D[] => {
    return rooms.map((room) => {
      const vertices3D = converter.canvasPolygonToThree(room.vertices)
      const center = converter.calculateCentroid(vertices3D)
      const boundingBox = converter.calculateBoundingBox(vertices3D)

      // Find finish for this room
      const finish = roomFinishes?.find((rf) => rf.roomId === room.id)

      return {
        id: room.id,
        name: room.name,
        type: room.type,
        vertices: vertices3D,
        center,
        boundingBox,
        area: room.area,
        color: room.color,
        vibe: finish?.vibe || DEFAULT_VIBE,
        tier: finish?.tier || "standard",
      }
    })
  }, [rooms, roomFinishes, converter])

  // Generate wall edges from room vertices
  const wallEdges = useMemo((): WallEdge[] => {
    const edgeMap = new Map<string, WallEdge>()

    // Step 1: Extract all edges from room vertices
    for (const room of rooms3D) {
      const vertices = room.vertices
      for (let i = 0; i < vertices.length; i++) {
        const start = vertices[i]
        const end = vertices[(i + 1) % vertices.length]

        const edgeKey = createEdgeKey(
          { x: start.x, z: start.z },
          { x: end.x, z: end.z }
        )

        if (edgeMap.has(edgeKey)) {
          // Shared wall - add this room ID
          const existing = edgeMap.get(edgeKey)!
          if (!existing.roomIds.includes(room.id)) {
            existing.roomIds.push(room.id)
          }
        } else {
          edgeMap.set(edgeKey, {
            id: edgeKey,
            start: { x: start.x, z: start.z },
            end: { x: end.x, z: end.z },
            roomIds: [room.id],
            openings: [],
            length: distance(
              { x: start.x, z: start.z },
              { x: end.x, z: end.z }
            ),
            angle: lineAngle(
              { x: start.x, z: start.z },
              { x: end.x, z: end.z }
            ),
          })
        }
      }
    }

    const edges = Array.from(edgeMap.values())

    // Step 2: Place doors on walls
    for (const door of doors) {
      const doorPos3D = converter.canvasToThree(door.position, 0)
      const doorPos2D = { x: doorPos3D.x, z: doorPos3D.z }

      // Find the wall this door belongs to
      let bestWall: WallEdge | null = null
      let bestDistance = Infinity

      for (const edge of edges) {
        if (
          isPointNearLine(doorPos2D, edge.start, edge.end, 2.0) &&
          rotationMatchesWall(door.rotation, edge.angle)
        ) {
          const proj = projectPointOntoLine(doorPos2D, edge.start, edge.end)
          const nearestX =
            edge.start.x + (proj / edge.length) * (edge.end.x - edge.start.x)
          const nearestZ =
            edge.start.z + (proj / edge.length) * (edge.end.z - edge.start.z)
          const dist = distance(doorPos2D, { x: nearestX, z: nearestZ })

          if (dist < bestDistance) {
            bestDistance = dist
            bestWall = edge
          }
        }
      }

      if (bestWall) {
        const position = projectPointOntoLine(
          doorPos2D,
          bestWall.start,
          bestWall.end
        )
        bestWall.openings.push({
          type: "door",
          position,
          width: door.width,
          height: DIMENSIONS.DOOR_HEIGHT,
          bottomOffset: 0,
          itemId: door.id,
        })
      }
    }

    // Step 3: Place windows on walls
    for (const window of windows) {
      const windowPos3D = converter.canvasToThree(window.position, 0)
      const windowPos2D = { x: windowPos3D.x, z: windowPos3D.z }

      let bestWall: WallEdge | null = null
      let bestDistance = Infinity

      for (const edge of edges) {
        if (
          isPointNearLine(windowPos2D, edge.start, edge.end, 2.0) &&
          rotationMatchesWall(window.rotation, edge.angle)
        ) {
          const proj = projectPointOntoLine(windowPos2D, edge.start, edge.end)
          const nearestX =
            edge.start.x + (proj / edge.length) * (edge.end.x - edge.start.x)
          const nearestZ =
            edge.start.z + (proj / edge.length) * (edge.end.z - edge.start.z)
          const dist = distance(windowPos2D, { x: nearestX, z: nearestZ })

          if (dist < bestDistance) {
            bestDistance = dist
            bestWall = edge
          }
        }
      }

      if (bestWall) {
        const position = projectPointOntoLine(
          windowPos2D,
          bestWall.start,
          bestWall.end
        )
        bestWall.openings.push({
          type: "window",
          position,
          width: window.width,
          height: window.height,
          bottomOffset: DIMENSIONS.WINDOW_SILL_HEIGHT,
          itemId: window.id,
        })
      }
    }

    // Sort openings by position on each wall
    for (const edge of edges) {
      edge.openings.sort((a, b) => a.position - b.position)
    }

    return edges
  }, [rooms3D, doors, windows, converter])

  // Process doors into 3D data
  const doors3D = useMemo((): Door3D[] => {
    return doors.map((door) => {
      const pos3D = converter.canvasToThree(door.position, 0)

      // Find the wall this door is on to get the wall angle
      let wallAngle = converter.canvasRotationToThree(door.rotation)
      for (const edge of wallEdges) {
        const opening = edge.openings.find(
          (o) => o.type === "door" && o.itemId === door.id
        )
        if (opening) {
          wallAngle = edge.angle
          break
        }
      }

      return {
        id: door.id,
        type: door.type,
        position: pos3D,
        rotation: converter.canvasRotationToThree(door.rotation),
        width: door.width,
        height: DIMENSIONS.DOOR_HEIGHT,
        wallAngle,
      }
    })
  }, [doors, wallEdges, converter])

  // Process windows into 3D data
  const windows3D = useMemo((): Window3D[] => {
    return windows.map((window) => {
      const pos3D = converter.canvasToThree(
        window.position,
        DIMENSIONS.WINDOW_SILL_HEIGHT + window.height / 2
      )

      // Find the wall this window is on
      let wallAngle = converter.canvasRotationToThree(window.rotation)
      for (const edge of wallEdges) {
        const opening = edge.openings.find(
          (o) => o.type === "window" && o.itemId === window.id
        )
        if (opening) {
          wallAngle = edge.angle
          break
        }
      }

      return {
        id: window.id,
        type: window.type,
        position: pos3D,
        rotation: converter.canvasRotationToThree(window.rotation),
        width: window.width,
        height: window.height,
        sillHeight: DIMENSIONS.WINDOW_SILL_HEIGHT,
        wallAngle,
      }
    })
  }, [windows, wallEdges, converter])

  // Process furniture into 3D data
  const furniture3D = useMemo((): Furniture3D[] => {
    return furniture.map((item) => {
      const config3D = FURNITURE_3D[item.type] || { height: 2, color: "#888888" }
      const pos3D = converter.canvasToThree(item.position, config3D.height / 2)

      return {
        id: item.id,
        type: item.type,
        position: pos3D,
        rotation: converter.canvasRotationToThree(item.rotation),
        width: item.width,
        depth: item.height, // 2D height is 3D depth
        height: config3D.height,
        color: config3D.color,
      }
    })
  }, [furniture, converter])

  // Calculate overall bounds for camera positioning
  const bounds = useMemo(() => {
    if (rooms3D.length === 0) {
      return { width: 40, depth: 40, centerX: 0, centerZ: 0 }
    }

    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity

    for (const room of rooms3D) {
      minX = Math.min(minX, room.boundingBox.minX)
      maxX = Math.max(maxX, room.boundingBox.maxX)
      minZ = Math.min(minZ, room.boundingBox.minZ)
      maxZ = Math.max(maxZ, room.boundingBox.maxZ)
    }

    return {
      width: maxX - minX,
      depth: maxZ - minZ,
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
    }
  }, [rooms3D])

  return {
    rooms3D,
    wallEdges,
    doors3D,
    windows3D,
    furniture3D,
    bounds,
    converter,
  }
}

export type FloorPlanGeometry = ReturnType<typeof useFloorPlanGeometry>
