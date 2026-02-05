"use client"

import { useCallback } from "react"
import type { EditorState, EditorAction, Point, Corner, Wall } from "../types"
import { PIXELS_PER_FOOT, DIMENSIONS, DOOR_TYPES, WINDOW_TYPES } from "../constants"

interface UseCanvasEventsProps {
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
  zoom: number
  panX: number
  panY: number
}

/**
 * Snap point to grid
 */
function snapToGrid(point: Point, snapEnabled: boolean): Point {
  if (!snapEnabled) return point
  return {
    x: Math.round(point.x * 2) / 2, // Snap to 0.5 feet
    y: Math.round(point.y * 2) / 2,
  }
}

/**
 * Generate a temporary ID
 */
function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Find a corner near the given point within the merge threshold
 * Returns the corner if found, null otherwise
 */
function findNearbyCorner(
  point: Point,
  corners: Corner[],
  threshold: number = DIMENSIONS.SNAP_CORNER_RADIUS
): Corner | null {
  for (const corner of corners) {
    const dx = corner.x - point.x
    const dy = corner.y - point.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance <= threshold) {
      return corner
    }
  }
  return null
}

/**
 * Check if a point is near another point within a threshold
 */
function isNearPoint(
  point: Point,
  target: Point,
  threshold: number = DIMENSIONS.SNAP_CORNER_RADIUS
): boolean {
  const dx = target.x - point.x
  const dy = target.y - point.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  return distance <= threshold
}

// Threshold for closing polygon (slightly larger than snap radius for easier targeting)
const CLOSE_POLYGON_THRESHOLD = 0.75 // feet

/**
 * Check if a line segment intersects a box (for wall selection)
 */
function lineIntersectsBox(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  box: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  // Check if line segment intersects any edge of the box
  const boxEdges: [{ x: number; y: number }, { x: number; y: number }][] = [
    [{ x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY }], // top
    [{ x: box.maxX, y: box.minY }, { x: box.maxX, y: box.maxY }], // right
    [{ x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY }], // bottom
    [{ x: box.minX, y: box.maxY }, { x: box.minX, y: box.minY }], // left
  ]

  for (const [e1, e2] of boxEdges) {
    if (lineSegmentsIntersect(p1, p2, e1, e2)) {
      return true
    }
  }
  return false
}

/**
 * Check if two line segments intersect
 */
function lineSegmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): boolean {
  const d1 = direction(p3, p4, p1)
  const d2 = direction(p3, p4, p2)
  const d3 = direction(p1, p2, p3)
  const d4 = direction(p1, p2, p4)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }

  if (d1 === 0 && onSegment(p3, p4, p1)) return true
  if (d2 === 0 && onSegment(p3, p4, p2)) return true
  if (d3 === 0 && onSegment(p1, p2, p3)) return true
  if (d4 === 0 && onSegment(p1, p2, p4)) return true

  return false
}

function direction(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
): number {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y)
}

function onSegment(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p: { x: number; y: number }
): boolean {
  return (
    Math.min(p1.x, p2.x) <= p.x && p.x <= Math.max(p1.x, p2.x) &&
    Math.min(p1.y, p2.y) <= p.y && p.y <= Math.max(p1.y, p2.y)
  )
}

/**
 * Check if a point is inside a polygon (ray casting algorithm)
 */
function isPointInPolygon(point: Point, polygon: Point[]): boolean {
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

/**
 * Find the wall closest to a point and calculate position along it
 */
function findWallAtPoint(
  point: Point,
  walls: Wall[],
  corners: Corner[],
  maxDistance: number = 1 // feet
): { wall: Wall; position: number } | null {
  const cornerMap = new Map<string, Corner>()
  corners.forEach(c => cornerMap.set(c.id, c))

  let closestWall: Wall | null = null
  let closestPosition = 0
  let closestDistance = maxDistance

  for (const wall of walls) {
    const start = cornerMap.get(wall.startCornerId)
    const end = cornerMap.get(wall.endCornerId)
    if (!start || !end) continue

    // Calculate distance from point to wall line segment
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSq = dx * dx + dy * dy
    if (lengthSq === 0) continue

    // Project point onto wall line
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq))
    const projX = start.x + t * dx
    const projY = start.y + t * dy

    // Distance from point to projection
    const distX = point.x - projX
    const distY = point.y - projY
    const distance = Math.sqrt(distX * distX + distY * distY)

    if (distance < closestDistance) {
      closestDistance = distance
      closestWall = wall
      closestPosition = t
    }
  }

  if (closestWall) {
    return { wall: closestWall, position: closestPosition }
  }
  return null
}

export function useCanvasEvents({ state, dispatch, zoom, panX, panY }: UseCanvasEventsProps) {
  /**
   * Convert stage-relative coordinates to world coordinates (feet)
   * Use this with stage.getRelativePointerPosition() which already accounts for stage transform
   */
  const stageToWorld = useCallback(
    (stageX: number, stageY: number): Point => {
      // Stage-relative coords are in pixels within the transformed stage content
      // Just divide by PIXELS_PER_FOOT to get world coordinates in feet
      return {
        x: stageX / PIXELS_PER_FOOT,
        y: stageY / PIXELS_PER_FOOT,
      }
    },
    []
  )

  /**
   * Convert screen coordinates to world coordinates (feet)
   * Accounts for pan offset and zoom level
   * @deprecated Use stageToWorld with getRelativePointerPosition() instead
   */
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point => {
      // Subtract pan offset to get coordinates relative to content origin
      // Then divide by zoom and PIXELS_PER_FOOT to get world coordinates in feet
      return {
        x: (screenX - panX) / zoom / PIXELS_PER_FOOT,
        y: (screenY - panY) / zoom / PIXELS_PER_FOOT,
      }
    },
    [zoom, panX, panY]
  )

  /**
   * Handle canvas click
   */
  const handleCanvasClick = useCallback(
    (e: any) => {
      const stage = e.target.getStage()
      // Use getRelativePointerPosition() which accounts for stage transform (pan/zoom)
      const relativePos = stage.getRelativePointerPosition()
      if (!relativePos) return

      const worldPoint = stageToWorld(relativePos.x, relativePos.y)
      const snappedPoint = snapToGrid(worldPoint, state.snapToGrid)

      // Determine wall type based on mode ("divider" creates virtual walls)
      const wallType = state.mode === "divider" ? "virtual" : "solid"

      switch (state.mode) {
        case "select":
          // Clicking on empty space deselects
          if (e.target === stage) {
            dispatch({ type: "SELECT", selection: null })
          }
          break

        case "wall":
        case "divider": {
          if (!state.isDrawing) {
            // Start drawing - find or create first corner
            // Use worldPoint (not snapped) to find nearby corners for better snapping UX
            const existingCorner = findNearbyCorner(worldPoint, state.corners, 0.75) // Larger threshold for easier clicking
            let startCornerId: string
            let cornerPoint: Point

            if (existingCorner) {
              // Snap to existing corner
              startCornerId = existingCorner.id
              cornerPoint = { x: existingCorner.x, y: existingCorner.y }
            } else {
              // Create new corner at snapped position
              startCornerId = generateTempId()
              cornerPoint = snappedPoint
              dispatch({
                type: "ADD_CORNER",
                corner: {
                  id: startCornerId,
                  x: snappedPoint.x,
                  y: snappedPoint.y,
                  elevation: 0,
                } as any,
              })
            }

            // Store point for preview - include corner ID for retrieval
            dispatch({
              type: "START_DRAWING",
              point: { ...cornerPoint, _cornerId: startCornerId } as any,
            })
          } else if (state.drawingStart) {
            // Get the first corner ID from drawingStart
            const firstCornerId: string | undefined = (state.drawingStart as any)._cornerId
            const firstCornerPoint = { x: state.drawingStart.x, y: state.drawingStart.y }

            // Check if clicking near the first corner to close the polygon
            // Use worldPoint for detection, not snapped
            const canClosePolygon = state.drawingCorners.length >= 1 &&
              isNearPoint(worldPoint, firstCornerPoint, CLOSE_POLYGON_THRESHOLD)

            if (canClosePolygon && firstCornerId) {
              // Close the polygon: connect last corner to first corner
              const prevDrawingPoint = state.drawingCorners[state.drawingCorners.length - 1]
              let prevCornerId: string | undefined = (prevDrawingPoint as any)._cornerId
              if (!prevCornerId) {
                const prevCorner = findNearbyCorner(prevDrawingPoint, state.corners)
                prevCornerId = prevCorner?.id
              }

              if (prevCornerId && prevCornerId !== firstCornerId) {
                // Check if closing wall already exists
                const wallExists = state.walls.some(
                  (w) =>
                    (w.startCornerId === prevCornerId && w.endCornerId === firstCornerId) ||
                    (w.startCornerId === firstCornerId && w.endCornerId === prevCornerId)
                )

                if (!wallExists) {
                  dispatch({
                    type: "ADD_WALL",
                    wall: {
                      id: generateTempId(),
                      blueprintId: state.blueprintId || "",
                      startCornerId: prevCornerId,
                      endCornerId: firstCornerId,
                      thickness: DIMENSIONS.WALL_THICKNESS,
                      height: DIMENSIONS.WALL_HEIGHT,
                      wallType,
                    },
                  })
                }
              }

              // End drawing - polygon is closed
              dispatch({ type: "END_DRAWING" })
            } else {
              // Normal behavior: add a new wall segment
              // Get the starting point and its corner ID
              const prevDrawingPoint = state.drawingCorners.length > 0
                ? state.drawingCorners[state.drawingCorners.length - 1]
                : state.drawingStart

              // Try to get corner ID from the stored point, or find it
              let prevCornerId: string | undefined = (prevDrawingPoint as any)._cornerId
              if (!prevCornerId) {
                const prevCorner = findNearbyCorner(prevDrawingPoint, state.corners)
                prevCornerId = prevCorner?.id
              }

              // If still no corner ID, create one at the previous point
              if (!prevCornerId) {
                prevCornerId = generateTempId()
                dispatch({
                  type: "ADD_CORNER",
                  corner: {
                    id: prevCornerId,
                    x: prevDrawingPoint.x,
                    y: prevDrawingPoint.y,
                    elevation: 0,
                  } as any,
                })
              }

              // Find or create corner at current point
              // Use worldPoint (not snapped) to find nearby corners
              let currentCornerId: string
              let currentCornerPoint: Point
              const existingCorner = findNearbyCorner(worldPoint, state.corners, 0.75)

              if (existingCorner) {
                // Snap to existing corner
                currentCornerId = existingCorner.id
                currentCornerPoint = { x: existingCorner.x, y: existingCorner.y }
              } else {
                // Create new corner at snapped position
                currentCornerId = generateTempId()
                currentCornerPoint = snappedPoint
                dispatch({
                  type: "ADD_CORNER",
                  corner: {
                    id: currentCornerId,
                    x: snappedPoint.x,
                    y: snappedPoint.y,
                    elevation: 0,
                  } as any,
                })
              }

              // Create wall between corners (if different)
              if (prevCornerId !== currentCornerId) {
                const wallExists = state.walls.some(
                  (w) =>
                    (w.startCornerId === prevCornerId && w.endCornerId === currentCornerId) ||
                    (w.startCornerId === currentCornerId && w.endCornerId === prevCornerId)
                )

                if (!wallExists) {
                  dispatch({
                    type: "ADD_WALL",
                    wall: {
                      id: generateTempId(),
                      blueprintId: state.blueprintId || "",
                      startCornerId: prevCornerId,
                      endCornerId: currentCornerId,
                      thickness: DIMENSIONS.WALL_THICKNESS,
                      height: DIMENSIONS.WALL_HEIGHT,
                      wallType,
                    },
                  })
                }
              }

              // Add point for preview with corner ID
              dispatch({
                type: "ADD_DRAWING_POINT",
                point: { ...currentCornerPoint, _cornerId: currentCornerId } as any,
              })
            }
          }
          break
        }

        case "rectangle":
          // Rectangle mode uses mouse down/up for drag behavior
          // Click handler is not used for rectangle - handled in mouseDown
          break

        case "room":
          // Find which room was clicked
          for (const room of state.rooms) {
            // Get room polygon from corners
            const polygon = room.corners.map(c => ({ x: c.x, y: c.y }))
            if (isPointInPolygon(snappedPoint, polygon)) {
              // Select this room
              dispatch({ type: "SELECT", selection: { type: "room", id: room.id } })
              break
            }
          }
          break

        case "door":
          if (state.placementType) {
            // Find wall at click position - use worldPoint (not snapped) and same maxDistance as preview
            // This ensures placement works for all wall orientations including vertical walls
            const wallResult = findWallAtPoint(worldPoint, state.walls, state.corners, 2)
            if (wallResult) {
              // Get door dimensions
              const doorConfig = DOOR_TYPES.find(d => d.id === state.placementType)
              dispatch({
                type: "ADD_DOOR",
                door: {
                  id: generateTempId(),
                  wallId: wallResult.wall.id,
                  position: wallResult.position,
                  type: state.placementType as any,
                  width: doorConfig?.width ?? DIMENSIONS.DOOR_WIDTH_SINGLE,
                  height: DIMENSIONS.DOOR_HEIGHT,
                },
              })
            }
          }
          break

        case "window":
          if (state.placementType) {
            // Find wall at click position - use worldPoint (not snapped) and same maxDistance as preview
            const wallResult = findWallAtPoint(worldPoint, state.walls, state.corners, 2)
            if (wallResult) {
              // Get window dimensions
              const windowConfig = WINDOW_TYPES.find(w => w.id === state.placementType)
              dispatch({
                type: "ADD_WINDOW",
                window: {
                  id: generateTempId(),
                  wallId: wallResult.wall.id,
                  position: wallResult.position,
                  type: state.placementType as any,
                  width: windowConfig?.width ?? DIMENSIONS.WINDOW_WIDTH,
                  height: windowConfig?.height ?? DIMENSIONS.WINDOW_HEIGHT,
                  sillHeight: DIMENSIONS.WINDOW_SILL_HEIGHT,
                },
              })
            }
          }
          break

        case "furniture":
          if (state.placementType) {
            // Place furniture
            const FURNITURE_DIMS = require("../constants").FURNITURE_DIMENSIONS
            const dims = FURNITURE_DIMS[state.placementType]
            if (dims) {
              dispatch({
                type: "ADD_FURNITURE",
                furniture: {
                  id: generateTempId(),
                  blueprintId: state.blueprintId || "",
                  type: state.placementType as any,
                  x: snappedPoint.x,
                  y: snappedPoint.y,
                  rotation: 0,
                  width: dims.width,
                  depth: dims.depth,
                },
              })
            }
          }
          break
      }
    },
    [state, dispatch, stageToWorld]
  )

  /**
   * Handle canvas mouse down (for rectangle drawing and selection box)
   */
  const handleCanvasMouseDown = useCallback(
    (e: any) => {
      const stage = e.target.getStage()
      // Use getRelativePointerPosition() which accounts for stage transform (pan/zoom)
      const relativePos = stage.getRelativePointerPosition()
      if (!relativePos) return

      const worldPoint = stageToWorld(relativePos.x, relativePos.y)
      const snappedPoint = snapToGrid(worldPoint, state.snapToGrid)

      // Rectangle mode: start drawing on mouse down
      if (state.mode === "rectangle") {
        if (!state.isDrawing) {
          // Try to snap to existing corner first
          const existingCorner = findNearbyCorner(worldPoint, state.corners, 0.75)
          const startPoint = existingCorner
            ? { x: existingCorner.x, y: existingCorner.y }
            : snappedPoint
          dispatch({ type: "START_DRAWING", point: startPoint })
        }
        return
      }

      // Select mode: start selection box when clicking on empty canvas
      if (state.mode === "select" && e.target === stage) {
        dispatch({ type: "START_SELECTION_BOX", point: worldPoint })
      }
    },
    [state, dispatch, stageToWorld]
  )

  /**
   * Handle canvas mouse move
   */
  const handleCanvasMouseMove = useCallback(
    (e: any) => {
      const stage = e.target.getStage()
      // Use getRelativePointerPosition() which accounts for stage transform (pan/zoom)
      const relativePos = stage.getRelativePointerPosition()
      if (!relativePos) return

      const worldPoint = stageToWorld(relativePos.x, relativePos.y)
      const snappedPoint = snapToGrid(worldPoint, state.snapToGrid)

      // Update selection box
      if (state.isSelectionBoxActive) {
        dispatch({ type: "UPDATE_SELECTION_BOX", point: worldPoint })
        return
      }

      // Update drawing preview
      if (state.isDrawing) {
        if (state.mode === "rectangle") {
          // Rectangle mode: check for nearby corner first, then grid snap
          const nearbyCorner = findNearbyCorner(worldPoint, state.corners, CLOSE_POLYGON_THRESHOLD)
          const previewPoint = nearbyCorner
            ? { x: nearbyCorner.x, y: nearbyCorner.y }
            : snappedPoint
          dispatch({ type: "UPDATE_DRAWING_PREVIEW", point: previewPoint })
        } else if (state.mode === "wall" || state.mode === "divider") {
          // Wall/Divider mode: snap preview to existing corners if close, otherwise grid snap
          const nearbyCorner = findNearbyCorner(worldPoint, state.corners, CLOSE_POLYGON_THRESHOLD)
          const previewPoint = nearbyCorner
            ? { x: nearbyCorner.x, y: nearbyCorner.y }
            : snappedPoint
          dispatch({ type: "UPDATE_DRAWING_PREVIEW", point: previewPoint })
        }
      }

      // Update placement preview
      if (
        (state.mode === "door" || state.mode === "window" || state.mode === "furniture") &&
        state.placementType
      ) {
        if (state.mode === "door" || state.mode === "window") {
          // For doors/windows: snap to nearest wall and show rotated preview
          const wallResult = findWallAtPoint(worldPoint, state.walls, state.corners, 2) // 2 feet max distance
          if (wallResult) {
            // Get wall corners
            const startCorner = state.corners.find((c) => c.id === wallResult.wall.startCornerId)
            const endCorner = state.corners.find((c) => c.id === wallResult.wall.endCornerId)
            if (startCorner && endCorner) {
              // Calculate point on wall
              const dx = endCorner.x - startCorner.x
              const dy = endCorner.y - startCorner.y
              const wallX = startCorner.x + dx * wallResult.position
              const wallY = startCorner.y + dy * wallResult.position
              // Calculate wall angle in degrees
              const angle = Math.atan2(dy, dx) * (180 / Math.PI)
              dispatch({
                type: "UPDATE_PLACEMENT_PREVIEW",
                point: { x: wallX, y: wallY },
                angle,
                wallId: wallResult.wall.id,
              })
            }
          } else {
            // No wall nearby - show at mouse position with no wall
            dispatch({
              type: "UPDATE_PLACEMENT_PREVIEW",
              point: snappedPoint,
              angle: 0,
              wallId: null,
            })
          }
        } else {
          // For furniture: just use snapped position
          dispatch({ type: "UPDATE_PLACEMENT_PREVIEW", point: snappedPoint })
        }
      }
    },
    [state, dispatch, stageToWorld]
  )

  /**
   * Check if a point is inside a bounding box
   */
  const isPointInBox = (point: Point, box: { minX: number; minY: number; maxX: number; maxY: number }) => {
    return point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY
  }

  /**
   * Handle canvas mouse up (for rectangle drawing and selection box)
   */
  const handleCanvasMouseUp = useCallback(
    (e: any) => {
      // Handle selection box completion
      if (state.isSelectionBoxActive && state.selectionBoxStart && state.selectionBoxEnd) {
        const start = state.selectionBoxStart
        const end = state.selectionBoxEnd

        // Calculate bounding box
        const box = {
          minX: Math.min(start.x, end.x),
          maxX: Math.max(start.x, end.x),
          minY: Math.min(start.y, end.y),
          maxY: Math.max(start.y, end.y),
        }

        // Only select if box has meaningful size (at least 0.5 feet)
        const boxWidth = box.maxX - box.minX
        const boxHeight = box.maxY - box.minY

        if (boxWidth > 0.5 || boxHeight > 0.5) {
          // Create corner lookup map
          const cornerMap = new Map<string, { x: number; y: number }>()
          state.corners.forEach((c) => cornerMap.set(c.id, { x: c.x, y: c.y }))

          // Find all corners in box
          const selectedCorners = state.corners.filter((c) =>
            isPointInBox({ x: c.x, y: c.y }, box)
          )

          // Find all walls where at least one endpoint is in box
          const selectedWalls = state.walls.filter((wall) => {
            const startCorner = cornerMap.get(wall.startCornerId)
            const endCorner = cornerMap.get(wall.endCornerId)
            if (!startCorner || !endCorner) return false
            return (
              isPointInBox(startCorner, box) ||
              isPointInBox(endCorner, box) ||
              // Also check if wall line intersects the box
              lineIntersectsBox(startCorner, endCorner, box)
            )
          })

          // Find doors/windows on selected walls or whose position is in box
          const selectedDoors = state.doors.filter((door) => {
            // Check if door's wall is selected
            if (selectedWalls.some((w) => w.id === door.wallId)) return true
            // Calculate door position and check if in box
            const wall = state.walls.find((w) => w.id === door.wallId)
            if (!wall) return false
            const startCorner = cornerMap.get(wall.startCornerId)
            const endCorner = cornerMap.get(wall.endCornerId)
            if (!startCorner || !endCorner) return false
            const doorX = startCorner.x + (endCorner.x - startCorner.x) * door.position
            const doorY = startCorner.y + (endCorner.y - startCorner.y) * door.position
            return isPointInBox({ x: doorX, y: doorY }, box)
          })

          const selectedWindows = state.windows.filter((window) => {
            // Check if window's wall is selected
            if (selectedWalls.some((w) => w.id === window.wallId)) return true
            // Calculate window position and check if in box
            const wall = state.walls.find((w) => w.id === window.wallId)
            if (!wall) return false
            const startCorner = cornerMap.get(wall.startCornerId)
            const endCorner = cornerMap.get(wall.endCornerId)
            if (!startCorner || !endCorner) return false
            const windowX = startCorner.x + (endCorner.x - startCorner.x) * window.position
            const windowY = startCorner.y + (endCorner.y - startCorner.y) * window.position
            return isPointInBox({ x: windowX, y: windowY }, box)
          })

          // Find all furniture in box (check center point)
          const selectedFurniture = state.furniture.filter((f) =>
            isPointInBox({ x: f.x, y: f.y }, box)
          )

          // Build multi-selection
          const selections: Array<{ type: "corner" | "wall" | "door" | "window" | "furniture"; id: string }> = [
            ...selectedCorners.map((c) => ({ type: "corner" as const, id: c.id })),
            ...selectedWalls.map((w) => ({ type: "wall" as const, id: w.id })),
            ...selectedDoors.map((d) => ({ type: "door" as const, id: d.id })),
            ...selectedWindows.map((w) => ({ type: "window" as const, id: w.id })),
            ...selectedFurniture.map((f) => ({ type: "furniture" as const, id: f.id })),
          ]

          // Add all items to multi-selection
          if (selections.length > 0) {
            // Clear existing and add all
            dispatch({ type: "CLEAR_SELECTION" })
            selections.forEach((sel) => {
              dispatch({ type: "ADD_TO_SELECTION", selection: sel })
            })
          }
        }

        dispatch({ type: "END_SELECTION_BOX" })
        return
      }

      if (state.mode === "rectangle" && state.isDrawing && state.drawingStart) {
        const stage = e.target.getStage()
        // Use getRelativePointerPosition() which accounts for stage transform (pan/zoom)
        const relativePos = stage.getRelativePointerPosition()
        if (!relativePos) return

        const worldPoint = stageToWorld(relativePos.x, relativePos.y)
        const snappedPoint = snapToGrid(worldPoint, state.snapToGrid)

        // For end point, try to snap to existing corner first (using worldPoint for detection)
        const nearbyEndCorner = findNearbyCorner(worldPoint, state.corners, CLOSE_POLYGON_THRESHOLD)
        const endPoint = nearbyEndCorner
          ? { x: nearbyEndCorner.x, y: nearbyEndCorner.y }
          : snappedPoint

        // Create 4 corners and 4 walls for rectangle
        const start = state.drawingStart
        const end = endPoint

        // Define the 4 corner points
        const points: Point[] = [
          { x: start.x, y: start.y },
          { x: end.x, y: start.y },
          { x: end.x, y: end.y },
          { x: start.x, y: end.y },
        ]

        // For each point, either find existing corner or create new one
        // We need to track which corners we create vs reuse
        const cornerIds: string[] = []
        const newCorners: Array<{ id: string; x: number; y: number; elevation: number }> = []

        // First pass: identify which corners to create and which to reuse
        // We use state.corners plus any new corners we've decided to create
        let currentCorners = [...state.corners]

        points.forEach((point) => {
          // Check for existing corner (including ones we're about to create)
          const existingCorner = findNearbyCorner(point, currentCorners)

          if (existingCorner) {
            // Reuse existing corner
            cornerIds.push(existingCorner.id)
          } else {
            // Create new corner
            const newCorner = {
              id: generateTempId(),
              x: point.x,
              y: point.y,
              elevation: 0,
            }
            cornerIds.push(newCorner.id)
            newCorners.push(newCorner)
            // Add to our tracking array so subsequent points can find it
            currentCorners.push(newCorner as any)
          }
        })

        // Add new corners
        newCorners.forEach((corner) => {
          dispatch({ type: "ADD_CORNER", corner: corner as any })
        })

        // Create walls for all 4 sides of the rectangle
        // We track walls we're about to create to avoid duplicates within this operation
        const wallsToCreate: Array<[string, string]> = [
          [cornerIds[0], cornerIds[1]],
          [cornerIds[1], cornerIds[2]],
          [cornerIds[2], cornerIds[3]],
          [cornerIds[3], cornerIds[0]],
        ]

        wallsToCreate.forEach(([startId, endId]) => {
          // Skip if corners are the same (can happen with merged corners)
          if (startId === endId) return

          // Check if wall already exists in state
          const wallExists = state.walls.some(
            (w) =>
              (w.startCornerId === startId && w.endCornerId === endId) ||
              (w.startCornerId === endId && w.endCornerId === startId)
          )

          if (!wallExists) {
            dispatch({
              type: "ADD_WALL",
              wall: {
                id: generateTempId(),
                blueprintId: state.blueprintId || "",
                startCornerId: startId,
                endCornerId: endId,
                thickness: DIMENSIONS.WALL_THICKNESS,
                height: DIMENSIONS.WALL_HEIGHT,
                wallType: "solid", // Rectangle mode always creates solid walls
              },
            })
          }
        })

        dispatch({ type: "END_DRAWING" })
      }
    },
    [state, dispatch, stageToWorld]
  )

  /**
   * Handle double click (finish wall drawing or close polygon)
   */
  const handleCanvasDoubleClick = useCallback(() => {
    if ((state.mode === "wall" || state.mode === "divider") && state.isDrawing) {
      // Walls are already created on each click
      // Double-click just ends drawing mode
      // Optionally, if user wants to close the polygon (connect last to first),
      // they can click back on the first corner before double-clicking
      dispatch({ type: "END_DRAWING" })
    }
  }, [state, dispatch])

  /**
   * Handle keyboard shortcuts (cancel, delete, move, rotate)
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state.isSelectionBoxActive) {
          dispatch({ type: "CANCEL_SELECTION_BOX" })
        } else if (state.isDrawing) {
          dispatch({ type: "CANCEL_DRAWING" })
        } else if (state.multiSelection.length > 0) {
          dispatch({ type: "CLEAR_SELECTION" })
        } else if (state.selection) {
          dispatch({ type: "SELECT", selection: null })
        }
      }

      // Delete selected element(s) - supports multi-selection
      if (e.key === "Delete" || e.key === "Backspace") {
        if (state.multiSelection.length > 0 || state.selection) {
          dispatch({ type: "DELETE_SELECTED" })
        }
      }

      // Arrow keys to nudge selected items (0.5 feet, or 0.1 with Shift)
      const hasSelection = state.multiSelection.length > 0 || state.selection
      if (hasSelection && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault()
        const step = e.shiftKey ? 0.1 : 0.5  // Fine control with Shift
        let offsetX = 0
        let offsetY = 0

        switch (e.key) {
          case "ArrowUp":
            offsetY = -step
            break
          case "ArrowDown":
            offsetY = step
            break
          case "ArrowLeft":
            offsetX = -step
            break
          case "ArrowRight":
            offsetX = step
            break
        }

        dispatch({ type: "MOVE_SELECTED", offsetX, offsetY })
      }

      // R key to rotate
      if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()

        // If in placement mode (door/window/furniture with type selected), rotate preview
        if ((state.mode === "door" || state.mode === "window" || state.mode === "furniture") && state.placementType) {
          dispatch({ type: "ROTATE_PLACEMENT_PREVIEW" })
        }
        // If something is selected, rotate it
        else if (hasSelection) {
          const degrees = e.shiftKey ? 15 : 90
          dispatch({ type: "ROTATE_SELECTED", degrees })
        }
      }
    },
    [state, dispatch]
  )

  return {
    handleCanvasClick,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasDoubleClick,
    handleKeyDown,
    screenToWorld,
    stageToWorld,
  }
}
