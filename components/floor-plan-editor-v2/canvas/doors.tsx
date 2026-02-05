"use client"

import { useMemo, useState } from "react"
import { Group, Rect, Line, Arc, Text } from "react-konva"
import type { CanvasProps, Corner, WallWithCorners, DoorOnWall } from "../types"
import { COLORS, PIXELS_PER_FOOT, DIMENSIONS } from "../constants"

// Format width in feet and inches
function formatWidth(feet: number): string {
  const wholeFeet = Math.floor(feet)
  const inches = Math.round((feet - wholeFeet) * 12)
  if (inches === 0) return `${wholeFeet}'`
  return `${wholeFeet}'${inches}"`
}

// Get door orientation parameters from 0-3 orientation value
// Orientation: 0 = hinge left + swing down, 1 = hinge right + swing down
//              2 = hinge right + swing up, 3 = hinge left + swing up
function getDoorOrientation(orientation: number): { hingeRight: boolean; swingUp: boolean } {
  switch (orientation % 4) {
    case 0: return { hingeRight: false, swingUp: false }  // hinge left, swing down
    case 1: return { hingeRight: true, swingUp: false }   // hinge right, swing down
    case 2: return { hingeRight: true, swingUp: true }    // hinge right, swing up
    case 3: return { hingeRight: false, swingUp: true }   // hinge left, swing up
    default: return { hingeRight: false, swingUp: false }
  }
}

export function DoorsLayer({ config, state, dispatch }: CanvasProps) {
  const { zoom } = config
  const { corners, walls, doors, selection, multiSelection, hoveredElement, mode, showDimensions, doorOrientations } = state
  const scale = PIXELS_PER_FOOT

  // Track drag state for position along wall
  const [isDragging, setIsDragging] = useState(false)

  // Create corner lookup map
  const cornerMap = useMemo(() => {
    const map = new Map<string, Corner>()
    corners.forEach((c) => map.set(c.id, c))
    return map
  }, [corners])

  // Get walls with corners
  const wallsWithCorners = useMemo(() => {
    const map = new Map<string, WallWithCorners>()
    walls.forEach((wall) => {
      const startCorner = cornerMap.get(wall.startCornerId)
      const endCorner = cornerMap.get(wall.endCornerId)
      if (startCorner && endCorner) {
        map.set(wall.id, { ...wall, startCorner, endCorner })
      }
    })
    return map
  }, [walls, cornerMap])

  // Calculate door positions on walls
  const doorsOnWalls = useMemo((): DoorOnWall[] => {
    return doors
      .map((door) => {
        const wall = wallsWithCorners.get(door.wallId)
        if (!wall) return null

        const dx = wall.endCorner.x - wall.startCorner.x
        const dy = wall.endCorner.y - wall.startCorner.y

        const x = wall.startCorner.x + dx * door.position
        const y = wall.startCorner.y + dy * door.position

        return {
          ...door,
          wall,
          worldPosition: { x, y },
        }
      })
      .filter(Boolean) as DoorOnWall[]
  }, [doors, wallsWithCorners])

  const handleDoorClick = (doorId: string, e: any) => {
    // Only handle in select/delete modes - let drawing modes bubble to canvas
    if (mode === "select") {
      e.cancelBubble = true
      if (e.evt?.ctrlKey || e.evt?.metaKey) {
        dispatch({ type: "TOGGLE_SELECT", selection: { type: "door", id: doorId } })
      } else {
        dispatch({ type: "SELECT", selection: { type: "door", id: doorId } })
      }
    } else if (mode === "delete") {
      e.cancelBubble = true
      dispatch({ type: "DELETE_DOOR", id: doorId })
    }
    // For wall/rectangle/other modes: DON'T stop propagation
  }

  const handleDoorDoubleClick = (doorId: string, e: any) => {
    e.cancelBubble = true
    dispatch({ type: "DELETE_DOOR", id: doorId })
  }

  const handleDoorMouseEnter = (doorId: string, e: any) => {
    dispatch({ type: "HOVER", element: { type: "door", id: doorId } })
    const stage = e.target.getStage()
    if (stage && mode === "select") stage.container().style.cursor = "move"
  }

  const handleDoorMouseLeave = (e: any) => {
    dispatch({ type: "HOVER", element: null })
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = "default"
  }

  const handleDoorDragStart = (doorId: string, e: any) => {
    if (mode !== "select") {
      e.target.stopDrag()
      return
    }
    setIsDragging(true)
    dispatch({ type: "SELECT", selection: { type: "door", id: doorId } })
  }

  const handleDoorDragMove = (door: DoorOnWall, e: any) => {
    if (mode !== "select") return

    const stage = e.target.getStage()
    const relativePos = stage.getRelativePointerPosition()
    if (!relativePos) return

    // Convert to world coords
    const worldX = relativePos.x / scale
    const worldY = relativePos.y / scale

    // Project onto wall to get new position
    const wall = door.wall
    const dx = wall.endCorner.x - wall.startCorner.x
    const dy = wall.endCorner.y - wall.startCorner.y
    const lengthSq = dx * dx + dy * dy
    if (lengthSq === 0) return

    // Project mouse position onto wall line
    const t = ((worldX - wall.startCorner.x) * dx + (worldY - wall.startCorner.y) * dy) / lengthSq
    const doorWidthRatio = (door.width ?? DIMENSIONS.DOOR_WIDTH_SINGLE) / Math.sqrt(lengthSq)
    const newPosition = Math.max(doorWidthRatio / 2, Math.min(1 - doorWidthRatio / 2, t))

    // Update the Konva group position to follow the wall
    const newX = (wall.startCorner.x + dx * newPosition) * scale
    const newY = (wall.startCorner.y + dy * newPosition) * scale
    e.target.position({ x: newX, y: newY })

    dispatch({ type: "UPDATE_DOOR", id: door.id, position: newPosition })
  }

  const handleDoorDragEnd = () => {
    setIsDragging(false)
  }

  return (
    <Group>
      {doorsOnWalls.map((door) => {
        const isSelected = (selection?.type === "door" && selection.id === door.id) ||
          multiSelection.some((s) => s.type === "door" && s.id === door.id)
        const isHovered = hoveredElement?.type === "door" && hoveredElement.id === door.id

        const x = door.worldPosition.x * scale
        const y = door.worldPosition.y * scale
        const width = (door.width ?? DIMENSIONS.DOOR_WIDTH_SINGLE) * scale
        const thickness = 3 / zoom // Thin line thickness for clean look

        // Calculate wall angle
        const dx = door.wall.endCorner.x - door.wall.startCorner.x
        const dy = door.wall.endCorner.y - door.wall.startCorner.y
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)

        // Door swing radius (same as width)
        const swingRadius = width

        // Get orientation from state (cycles 0-3 with R key)
        const orientation = doorOrientations[door.id] || 0
        const { hingeRight, swingUp } = getDoorOrientation(orientation)

        // Hinge position: left (-width/2) or right (+width/2)
        const hingeX = hingeRight ? width / 2 : -width / 2
        // Swing direction: up (negative Y) or down (positive Y)
        const swingY = swingUp ? -swingRadius : swingRadius
        // Arc rotation based on quadrant:
        // case 0 (left, down): 0° - sweeps right to down
        // case 1 (right, down): 90° - sweeps down to left
        // case 2 (right, up): 180° - sweeps left to up
        // case 3 (left, up): -90° - sweeps up to right
        const arcRotation = swingUp
          ? (hingeRight ? 180 : -90)
          : (hingeRight ? 90 : 0)

        // Colors
        const strokeColor = isSelected ? "#dc2626" : isHovered ? "#92400e" : "#a16207"
        const fillColor = isSelected ? "rgba(220, 38, 38, 0.15)" : "rgba(161, 98, 7, 0.1)"

        return (
          <Group
            key={door.id}
            x={x}
            y={y}
            rotation={angle}
            draggable={mode === "select"}
            onClick={(e) => handleDoorClick(door.id, e)}
            onTap={(e) => handleDoorClick(door.id, e)}
            onDblClick={(e) => handleDoorDoubleClick(door.id, e)}
            onDblTap={(e) => handleDoorDoubleClick(door.id, e)}
            onMouseEnter={(e) => handleDoorMouseEnter(door.id, e)}
            onMouseLeave={handleDoorMouseLeave}
            onDragStart={(e) => handleDoorDragStart(door.id, e)}
            onDragMove={(e) => handleDoorDragMove(door, e)}
            onDragEnd={handleDoorDragEnd}
          >
            {/* Door opening - clean break line */}
            <Line
              points={[-width / 2, 0, width / 2, 0]}
              stroke="#ffffff"
              strokeWidth={6 / zoom}
              listening={false}
            />

            {/* Door panel line - thin architectural style, direction matches swing */}
            <Line
              points={[hingeX, 0, hingeX, swingY]}
              stroke={strokeColor}
              strokeWidth={2 / zoom}
              lineCap="round"
            />

            {/* Door swing arc */}
            {door.type !== "sliding" && door.type !== "opening" && (
              <Arc
                x={hingeX}
                y={0}
                innerRadius={0}
                outerRadius={swingRadius}
                angle={90}
                rotation={arcRotation}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1 / zoom}
                dash={[4, 4]}
                listening={false}
              />
            )}

            {/* Sliding door indicator */}
            {door.type === "sliding" && (
              <Line
                points={[-width / 4, swingRadius / 3, width / 4, swingRadius / 3]}
                stroke={strokeColor}
                strokeWidth={1.5 / zoom}
                dash={[3, 3]}
                listening={false}
              />
            )}

            {/* Hit area for easier selection - covers door opening and swing area */}
            <Rect
              x={-width / 2 - 5 / zoom}
              y={swingUp ? -swingRadius - 5 / zoom : -5 / zoom}
              width={width + 10 / zoom}
              height={swingRadius + 10 / zoom}
              fill="transparent"
            />

            {/* Door dimension label */}
            {showDimensions && (
              <Text
                x={-width / 2}
                y={swingUp ? swingRadius + 4 / zoom : -14 / zoom}
                width={width}
                text={formatWidth(door.width ?? DIMENSIONS.DOOR_WIDTH_SINGLE)}
                fontSize={9 / zoom}
                fontFamily="system-ui, sans-serif"
                fill={strokeColor}
                fontStyle="bold"
                align="center"
                listening={false}
              />
            )}

            {/* Selection indicator - covers door opening and swing area */}
            {isSelected && (
              <Rect
                x={-width / 2 - 3 / zoom}
                y={swingUp ? -swingRadius - 3 / zoom : -3 / zoom}
                width={width + 6 / zoom}
                height={swingRadius + 6 / zoom}
                stroke="#dc2626"
                strokeWidth={1.5 / zoom}
                dash={[4, 4]}
                fill="transparent"
                listening={false}
              />
            )}
          </Group>
        )
      })}
    </Group>
  )
}
