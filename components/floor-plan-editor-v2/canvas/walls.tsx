"use client"

import { useMemo, useState } from "react"
import { Group, Line, Text, Circle } from "react-konva"
import type { CanvasProps, Corner, WallWithCorners, Door, Window as WindowType } from "../types"
import { COLORS, PIXELS_PER_FOOT, DIMENSIONS } from "../constants"

// Format length in feet and inches (e.g., "12' 6\"")
function formatLength(feet: number): string {
  if (feet < 0.1) return ""
  const wholeFeet = Math.floor(feet)
  const inches = Math.round((feet - wholeFeet) * 12)
  if (inches === 0) return `${wholeFeet}'`
  if (wholeFeet === 0) return `${inches}"`
  return `${wholeFeet}'${inches}"`
}

// Opening on a wall (door or window) with calculated bounds
interface WallOpening {
  id: string
  type: "door" | "window"
  position: number  // 0-1 along wall
  width: number     // in feet
  startPos: number  // start position (0-1)
  endPos: number    // end position (0-1)
}

// Calculate wall segments between openings
function calculateWallSegments(
  wallLengthFeet: number,
  wallDoors: Door[],
  wallWindows: WindowType[]
): { start: number; end: number; length: number }[] {
  // Create list of all openings with their bounds
  const openings: WallOpening[] = []

  wallDoors.forEach((door) => {
    const widthFeet = door.width ?? DIMENSIONS.DOOR_WIDTH_SINGLE
    const halfWidthRatio = (widthFeet / 2) / wallLengthFeet
    openings.push({
      id: door.id,
      type: "door",
      position: door.position,
      width: widthFeet,
      startPos: Math.max(0, door.position - halfWidthRatio),
      endPos: Math.min(1, door.position + halfWidthRatio),
    })
  })

  wallWindows.forEach((window) => {
    const widthFeet = window.width ?? DIMENSIONS.WINDOW_WIDTH
    const halfWidthRatio = (widthFeet / 2) / wallLengthFeet
    openings.push({
      id: window.id,
      type: "window",
      position: window.position,
      width: widthFeet,
      startPos: Math.max(0, window.position - halfWidthRatio),
      endPos: Math.min(1, window.position + halfWidthRatio),
    })
  })

  // Sort openings by start position
  openings.sort((a, b) => a.startPos - b.startPos)

  // Calculate segments between openings
  const segments: { start: number; end: number; length: number }[] = []
  let currentPos = 0

  for (const opening of openings) {
    // Add segment before this opening (if there's space)
    if (opening.startPos > currentPos + 0.01) {
      const segmentLength = (opening.startPos - currentPos) * wallLengthFeet
      segments.push({
        start: currentPos,
        end: opening.startPos,
        length: segmentLength,
      })
    }
    currentPos = Math.max(currentPos, opening.endPos)
  }

  // Add final segment after last opening
  if (currentPos < 0.99) {
    const segmentLength = (1 - currentPos) * wallLengthFeet
    segments.push({
      start: currentPos,
      end: 1,
      length: segmentLength,
    })
  }

  return segments
}

export function WallsLayer({ config, state, dispatch }: CanvasProps) {
  const { zoom } = config
  const { corners, walls, doors, windows, selection, multiSelection, hoveredElement, mode, showDimensions } = state
  // Don't multiply by zoom - Stage handles scaling
  const scale = PIXELS_PER_FOOT

  // Track hovered wall and midpoint
  const [hoveredMidpoint, setHoveredMidpoint] = useState<string | null>(null)

  // Create corner lookup map
  const cornerMap = useMemo(() => {
    const map = new Map<string, Corner>()
    corners.forEach((c) => map.set(c.id, c))
    return map
  }, [corners])

  // Get walls with their corner data
  const wallsWithCorners = useMemo((): WallWithCorners[] => {
    return walls
      .map((wall) => {
        const startCorner = cornerMap.get(wall.startCornerId)
        const endCorner = cornerMap.get(wall.endCornerId)
        if (!startCorner || !endCorner) return null
        return { ...wall, startCorner, endCorner }
      })
      .filter(Boolean) as WallWithCorners[]
  }, [walls, cornerMap])

  const handleWallClick = (wallId: string, e: any) => {
    // Only handle in select/delete modes - let drawing modes bubble to canvas
    if (mode === "select") {
      e.cancelBubble = true
      if (e.evt?.ctrlKey || e.evt?.metaKey) {
        dispatch({ type: "TOGGLE_SELECT", selection: { type: "wall", id: wallId } })
      } else {
        dispatch({ type: "SELECT", selection: { type: "wall", id: wallId } })
      }
    } else if (mode === "delete") {
      e.cancelBubble = true
      dispatch({ type: "DELETE_WALL", id: wallId })
    }
    // For wall/rectangle/other modes: DON'T stop propagation
    // Let the event bubble up to the canvas handler
  }

  const handleWallDoubleClick = (wallId: string, e: any) => {
    // Stop propagation to prevent Stage's double-click handler from firing
    e.cancelBubble = true

    // Get the click position to insert a corner
    const stage = e.target.getStage()
    if (!stage) return

    const relativePos = stage.getRelativePointerPosition()
    if (!relativePos) return

    // Convert to world coordinates (feet)
    const worldX = relativePos.x / scale
    const worldY = relativePos.y / scale

    // Snap to grid
    const snappedX = Math.round(worldX * 2) / 2
    const snappedY = Math.round(worldY * 2) / 2

    // Split the wall at this point
    dispatch({
      type: "SPLIT_WALL",
      wallId,
      point: { x: snappedX, y: snappedY },
    })
  }

  const handleMidpointClick = (wallId: string, midX: number, midY: number, e: any) => {
    e.cancelBubble = true

    // Snap to grid
    const snappedX = Math.round(midX * 2) / 2
    const snappedY = Math.round(midY * 2) / 2

    // Split the wall at this point
    dispatch({
      type: "SPLIT_WALL",
      wallId,
      point: { x: snappedX, y: snappedY },
    })
  }

  const handleWallMouseEnter = (wallId: string) => {
    dispatch({ type: "HOVER", element: { type: "wall", id: wallId } })
  }

  const handleWallMouseLeave = () => {
    dispatch({ type: "HOVER", element: null })
  }

  return (
    <Group>
      {wallsWithCorners.map((wall) => {
        const isSelected = (selection?.type === "wall" && selection.id === wall.id) ||
          multiSelection.some((s) => s.type === "wall" && s.id === wall.id)
        const isHovered = hoveredElement?.type === "wall" && hoveredElement.id === wall.id

        const x1 = wall.startCorner.x * scale
        const y1 = wall.startCorner.y * scale
        const x2 = wall.endCorner.x * scale
        const y2 = wall.endCorner.y * scale

        // Calculate perpendicular offset for wall thickness (visual only - much thinner)
        const dx = x2 - x1
        const dy = y2 - y1
        const length = Math.sqrt(dx * dx + dy * dy)
        if (length === 0) return null

        // Normal vector (perpendicular)
        const nx = -dy / length
        const ny = dx / length

        // Calculate wall length in feet
        const wallLengthFeet = length / scale

        // Calculate midpoint for add-corner button and label
        const midX = (wall.startCorner.x + wall.endCorner.x) / 2
        const midY = (wall.startCorner.y + wall.endCorner.y) / 2
        const midXPx = midX * scale
        const midYPx = midY * scale
        const midpointKey = `mid-${wall.id}`
        const isMidpointHovered = hoveredMidpoint === midpointKey

        // Calculate angle for label rotation
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)
        // Normalize angle to keep text readable (not upside down)
        const normalizedAngle = angle > 90 || angle < -90 ? angle + 180 : angle

        // Get openings on this wall
        const wallDoors = doors.filter((d) => d.wallId === wall.id)
        const wallWindows = windows.filter((w) => w.wallId === wall.id)
        const hasOpenings = wallDoors.length > 0 || wallWindows.length > 0

        // Calculate wall segments between openings
        const segments = hasOpenings
          ? calculateWallSegments(wallLengthFeet, wallDoors, wallWindows)
          : [{ start: 0, end: 1, length: wallLengthFeet }]

        // Offset label perpendicular to wall
        const labelOffset = 15 / zoom

        // Direction vector (normalized)
        const dirX = dx / length
        const dirY = dy / length

        // Wall type determines rendering style
        const isVirtual = wall.wallType === "virtual"
        const isPartition = wall.wallType === "partition"

        // Wall line thickness (thinner, cleaner look)
        const wallStrokeWidth = isVirtual
          ? (isSelected ? 2.5 / zoom : 2 / zoom)
          : (isSelected ? 4 / zoom : 3 / zoom)

        // Colors based on wall type
        const getWallColor = () => {
          if (isSelected) return "#dc2626"
          if (isVirtual) return isHovered ? "#8b5cf6" : "#a78bfa" // Purple for virtual walls
          if (isPartition) return isHovered ? "#f59e0b" : "#fbbf24" // Amber for partitions
          return isHovered ? "#475569" : "#334155" // Default dark for solid
        }

        return (
          <Group key={wall.id}>
            {/* Wall line - style based on wall type */}
            <Line
              points={[x1, y1, x2, y2]}
              stroke={getWallColor()}
              strokeWidth={wallStrokeWidth}
              lineCap="round"
              lineJoin="round"
              dash={isVirtual ? [8 / zoom, 6 / zoom] : isPartition ? [12 / zoom, 4 / zoom] : undefined}
              hitStrokeWidth={12 / zoom}
              onClick={(e) => handleWallClick(wall.id, e)}
              onTap={(e) => handleWallClick(wall.id, e)}
              onDblClick={(e) => handleWallDoubleClick(wall.id, e)}
              onDblTap={(e) => handleWallDoubleClick(wall.id, e)}
              onMouseEnter={() => handleWallMouseEnter(wall.id)}
              onMouseLeave={handleWallMouseLeave}
            />

            {/* Midpoint marker (click to add corner - like ADU boundary) */}
            {wallLengthFeet > 2 && ( // Only show for walls longer than 2 feet
              <Group>
                {/* Larger hit area */}
                <Circle
                  x={midXPx}
                  y={midYPx}
                  radius={14 / zoom}
                  fill="transparent"
                  onMouseEnter={() => setHoveredMidpoint(midpointKey)}
                  onMouseLeave={() => setHoveredMidpoint(null)}
                  onClick={(e) => handleMidpointClick(wall.id, midX, midY, e)}
                  onTap={(e) => handleMidpointClick(wall.id, midX, midY, e)}
                />
                {/* Visual marker */}
                <Circle
                  x={midXPx}
                  y={midYPx}
                  radius={isMidpointHovered ? 10 / zoom : 6 / zoom}
                  fill={isMidpointHovered ? "#22c55e" : "rgba(34, 197, 94, 0.4)"}
                  stroke={isMidpointHovered ? "#ffffff" : "transparent"}
                  strokeWidth={2 / zoom}
                  listening={false}
                />
                {/* Plus icon */}
                {isMidpointHovered && (
                  <>
                    <Line
                      points={[
                        midXPx - 5 / zoom, midYPx,
                        midXPx + 5 / zoom, midYPx,
                      ]}
                      stroke="#ffffff"
                      strokeWidth={2 / zoom}
                      listening={false}
                    />
                    <Line
                      points={[
                        midXPx, midYPx - 5 / zoom,
                        midXPx, midYPx + 5 / zoom,
                      ]}
                      stroke="#ffffff"
                      strokeWidth={2 / zoom}
                      listening={false}
                    />
                  </>
                )}
              </Group>
            )}

            {/* Segmented dimension labels */}
            {showDimensions && wallLengthFeet > 1 && segments.map((segment, i) => {
              // Calculate segment midpoint position along wall
              const segmentMidPos = (segment.start + segment.end) / 2
              const segX = x1 + dirX * length * segmentMidPos
              const segY = y1 + dirY * length * segmentMidPos

              // Only show if segment is at least 0.5 feet
              if (segment.length < 0.5) return null

              return (
                <Group
                  key={`seg-${i}`}
                  x={segX + nx * labelOffset}
                  y={segY + ny * labelOffset}
                  rotation={normalizedAngle}
                >
                  <Text
                    text={formatLength(segment.length)}
                    fontSize={10 / zoom}
                    fontFamily="system-ui, sans-serif"
                    fill="#1f2937"
                    fontStyle="bold"
                    align="center"
                    offsetX={18 / zoom}
                    offsetY={5 / zoom}
                  />
                </Group>
              )
            })}

            {/* Total wall length (shown smaller, below segments when there are openings) */}
            {showDimensions && hasOpenings && wallLengthFeet > 1 && (
              <Group
                x={midXPx + nx * labelOffset * 2.5}
                y={midYPx + ny * labelOffset * 2.5}
                rotation={normalizedAngle}
              >
                <Text
                  text={`(${formatLength(wallLengthFeet)} total)`}
                  fontSize={8 / zoom}
                  fontFamily="system-ui, sans-serif"
                  fill="#9ca3af"
                  align="center"
                  offsetX={25 / zoom}
                  offsetY={4 / zoom}
                />
              </Group>
            )}
          </Group>
        )
      })}
    </Group>
  )
}
