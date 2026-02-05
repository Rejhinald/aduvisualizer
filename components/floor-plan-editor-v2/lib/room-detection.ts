/**
 * Room Detection Algorithm
 *
 * Finds enclosed rooms from a wall/corner graph using cycle detection.
 * Based on the planar straight-line graph (PSLG) approach from blueprint.js.
 *
 * Algorithm:
 * 1. Build adjacency graph from corners and walls
 * 2. For each corner, find the "tightest" cycle using angle-based DFS
 * 3. Filter to keep only counter-clockwise (CCW) cycles (rooms)
 * 4. Remove duplicate cycles
 * 5. Calculate area and centroid for each room
 */

import type { Corner, Wall, Room, RoomType, Point } from "@/lib/api/client-v2"

interface AdjacencyEntry {
  corner: Corner
  wall: Wall
  angle: number // angle from current corner to this adjacent corner
}

/**
 * Calculate angle between two points (0 to 2π)
 */
function angle2pi(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  let angle = Math.atan2(dy, dx)
  if (angle < 0) {
    angle += 2 * Math.PI
  }
  return angle
}

/**
 * Calculate signed polygon area using shoelace formula
 * Positive = CCW, Negative = CW
 */
function signedPolygonArea(corners: Corner[]): number {
  let area = 0
  const n = corners.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += corners[i].x * corners[j].y
    area -= corners[j].x * corners[i].y
  }
  return area / 2
}

/**
 * Calculate polygon centroid
 */
function polygonCentroid(corners: Corner[]): Point {
  let cx = 0
  let cy = 0
  const n = corners.length
  for (const c of corners) {
    cx += c.x
    cy += c.y
  }
  return { x: cx / n, y: cy / n }
}

/**
 * Build adjacency map: corner ID -> list of adjacent corners with angles
 */
function buildAdjacencyMap(
  corners: Corner[],
  walls: Wall[]
): Map<string, AdjacencyEntry[]> {
  const cornerMap = new Map<string, Corner>()
  corners.forEach((c) => cornerMap.set(c.id, c))

  const adjacency = new Map<string, AdjacencyEntry[]>()

  // Initialize empty arrays for each corner
  corners.forEach((c) => adjacency.set(c.id, []))

  // Add wall connections
  for (const wall of walls) {
    const startCorner = cornerMap.get(wall.startCornerId)
    const endCorner = cornerMap.get(wall.endCornerId)

    if (!startCorner || !endCorner) continue
    if (startCorner.id === endCorner.id) continue // Skip self-loops

    // Add bidirectional connection
    const startToEnd: AdjacencyEntry = {
      corner: endCorner,
      wall,
      angle: angle2pi(startCorner, endCorner),
    }
    const endToStart: AdjacencyEntry = {
      corner: startCorner,
      wall,
      angle: angle2pi(endCorner, startCorner),
    }

    adjacency.get(startCorner.id)!.push(startToEnd)
    adjacency.get(endCorner.id)!.push(endToStart)
  }

  // Sort each corner's adjacencies by angle (for tightest cycle finding)
  for (const [, entries] of adjacency) {
    entries.sort((a, b) => a.angle - b.angle)
  }

  return adjacency
}

/**
 * Find the tightest cycle starting from a corner, coming from a specific direction
 * Uses angle-based selection to find the smallest enclosed area
 */
function findTightestCycle(
  startCorner: Corner,
  firstAdjacent: Corner,
  adjacency: Map<string, AdjacencyEntry[]>,
  cornerMap: Map<string, Corner>
): Corner[] | null {
  const visited = new Set<string>()
  const path: Corner[] = [startCorner]

  let prevCorner = startCorner
  let currentCorner = firstAdjacent

  // Maximum iterations to prevent infinite loops
  const maxIterations = 500
  let iterations = 0

  while (iterations < maxIterations) {
    iterations++

    // Check if we've completed the cycle
    if (currentCorner.id === startCorner.id) {
      return path
    }

    // Check if we've visited this corner (non-closing loop)
    if (visited.has(currentCorner.id)) {
      return null
    }

    visited.add(currentCorner.id)
    path.push(currentCorner)

    // Get adjacent corners
    const adjacentEntries = adjacency.get(currentCorner.id)
    if (!adjacentEntries || adjacentEntries.length < 2) {
      return null // Dead end or single connection
    }

    // Find the angle we came from
    const incomingAngle = angle2pi(currentCorner, prevCorner)

    // Find the next corner by choosing the "tightest" turn (smallest CCW angle)
    // This ensures we trace the smallest enclosed area
    let bestEntry: AdjacencyEntry | null = null
    let smallestAngleDiff = Infinity

    for (const entry of adjacentEntries) {
      // Skip the corner we just came from
      if (entry.corner.id === prevCorner.id) continue

      // Calculate the CCW angle difference from incoming direction
      let angleDiff = entry.angle - incomingAngle
      if (angleDiff < 0) angleDiff += 2 * Math.PI
      // We want the smallest positive angle (tightest CCW turn)
      // But we need to flip it because we're looking at outgoing vs incoming
      angleDiff = 2 * Math.PI - angleDiff
      if (angleDiff >= 2 * Math.PI) angleDiff -= 2 * Math.PI

      if (angleDiff < smallestAngleDiff) {
        smallestAngleDiff = angleDiff
        bestEntry = entry
      }
    }

    if (!bestEntry) {
      return null
    }

    prevCorner = currentCorner
    currentCorner = bestEntry.corner
  }

  return null // Exceeded max iterations
}

/**
 * Generate a unique ID for a room based on its corner IDs
 */
function roomId(corners: Corner[]): string {
  return corners
    .map((c) => c.id)
    .sort()
    .join(",")
}

/**
 * Find all rooms in the wall/corner graph
 */
export function detectRooms(corners: Corner[], walls: Wall[]): Room[] {
  if (corners.length < 3 || walls.length < 3) {
    return []
  }

  const cornerMap = new Map<string, Corner>()
  corners.forEach((c) => cornerMap.set(c.id, c))

  const adjacency = buildAdjacencyMap(corners, walls)
  const foundRoomIds = new Set<string>()
  const rooms: Room[] = []

  // For each corner, try to find cycles starting from it
  for (const corner of corners) {
    const adjacentEntries = adjacency.get(corner.id)
    if (!adjacentEntries || adjacentEntries.length < 2) continue

    // Try each adjacent corner as the first step
    for (const entry of adjacentEntries) {
      const cycle = findTightestCycle(corner, entry.corner, adjacency, cornerMap)

      if (!cycle || cycle.length < 3) continue

      // Check if this is a CCW cycle (positive area = room, negative = exterior)
      const signedArea = signedPolygonArea(cycle)
      if (signedArea <= 0) continue // Skip CW cycles

      // Check for duplicate rooms
      const id = roomId(cycle)
      if (foundRoomIds.has(id)) continue
      foundRoomIds.add(id)

      // Get walls for this room
      const roomWalls: Wall[] = []
      for (let i = 0; i < cycle.length; i++) {
        const c1 = cycle[i]
        const c2 = cycle[(i + 1) % cycle.length]

        // Find wall connecting these corners
        const wall = walls.find(
          (w) =>
            (w.startCornerId === c1.id && w.endCornerId === c2.id) ||
            (w.startCornerId === c2.id && w.endCornerId === c1.id)
        )
        if (wall) {
          roomWalls.push(wall)
        }
      }

      // Create room object
      const room: Room = {
        id,
        corners: cycle,
        walls: roomWalls,
        area: Math.abs(signedArea),
        center: polygonCentroid(cycle),
        name: `Room ${rooms.length + 1}`,
        type: "other",
      }

      rooms.push(room)
    }
  }

  // Sort rooms by area (smallest first, often more useful for assignment)
  rooms.sort((a, b) => a.area - b.area)

  return rooms
}

/**
 * Find which room contains a given point
 */
export function findRoomAtPoint(point: Point, rooms: Room[]): Room | null {
  for (const room of rooms) {
    if (isPointInRoom(point, room)) {
      return room
    }
  }
  return null
}

/**
 * Check if a point is inside a room
 */
export function isPointInRoom(point: Point, room: Room): boolean {
  const polygon = room.corners.map((c) => ({ x: c.x, y: c.y }))
  return isPointInPolygon(point, polygon)
}

/**
 * Ray casting algorithm for point-in-polygon test
 */
function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Get room type label for display
 */
export function getRoomTypeLabel(type: RoomType): string {
  const labels: Record<RoomType, string> = {
    bedroom: "Bedroom",
    bathroom: "Bathroom",
    half_bath: "Half Bath",
    kitchen: "Kitchen",
    living: "Living Room",
    dining: "Dining Room",
    closet: "Closet",
    laundry: "Laundry",
    storage: "Storage",
    utility: "Utility",
    entry: "Entry",
    corridor: "Corridor",
    flex: "Flex Space",
    other: "Other",
  }
  return labels[type] || type
}

/**
 * Suggest room type based on area and furniture
 * This is a simple heuristic - can be expanded
 */
export function suggestRoomType(room: Room): RoomType {
  const area = room.area

  // Very small rooms
  if (area < 25) {
    return "closet"
  }

  // Small rooms (25-50 sq ft)
  if (area < 50) {
    return "half_bath"
  }

  // Medium rooms (50-100 sq ft)
  if (area < 100) {
    return "bathroom"
  }

  // Standard rooms (100-200 sq ft)
  if (area < 200) {
    return "bedroom"
  }

  // Large rooms
  return "living"
}
