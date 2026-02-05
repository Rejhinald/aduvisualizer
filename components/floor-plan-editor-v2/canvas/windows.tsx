"use client"

import { useMemo, useState } from "react"
import { Group, Rect, Line, Text } from "react-konva"
import type { CanvasProps, Corner, WallWithCorners, WindowOnWall } from "../types"
import { PIXELS_PER_FOOT, DIMENSIONS } from "../constants"

// Format width in feet
function formatWidth(feet: number): string {
  const wholeFeet = Math.floor(feet)
  const inches = Math.round((feet - wholeFeet) * 12)
  if (inches === 0) return `${wholeFeet}'`
  return `${wholeFeet}'${inches}"`
}

export function WindowsLayer({ config, state, dispatch }: CanvasProps) {
  const { zoom } = config
  const { corners, walls, windows, selection, multiSelection, hoveredElement, mode, showDimensions, windowOrientations } = state
  const scale = PIXELS_PER_FOOT

  // Track drag state
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

  // Calculate window positions on walls
  const windowsOnWalls = useMemo((): WindowOnWall[] => {
    return windows
      .map((window) => {
        const wall = wallsWithCorners.get(window.wallId)
        if (!wall) return null

        const dx = wall.endCorner.x - wall.startCorner.x
        const dy = wall.endCorner.y - wall.startCorner.y

        const x = wall.startCorner.x + dx * window.position
        const y = wall.startCorner.y + dy * window.position

        return {
          ...window,
          wall,
          worldPosition: { x, y },
        }
      })
      .filter(Boolean) as WindowOnWall[]
  }, [windows, wallsWithCorners])

  const handleWindowClick = (windowId: string, e: any) => {
    // Only handle in select/delete modes - let drawing modes bubble to canvas
    if (mode === "select") {
      e.cancelBubble = true
      if (e.evt?.ctrlKey || e.evt?.metaKey) {
        dispatch({ type: "TOGGLE_SELECT", selection: { type: "window", id: windowId } })
      } else {
        dispatch({ type: "SELECT", selection: { type: "window", id: windowId } })
      }
    } else if (mode === "delete") {
      e.cancelBubble = true
      dispatch({ type: "DELETE_WINDOW", id: windowId })
    }
    // For wall/rectangle/other modes: DON'T stop propagation
  }

  const handleWindowDoubleClick = (windowId: string, e: any) => {
    e.cancelBubble = true
    dispatch({ type: "DELETE_WINDOW", id: windowId })
  }

  const handleWindowMouseEnter = (windowId: string, e: any) => {
    dispatch({ type: "HOVER", element: { type: "window", id: windowId } })
    const stage = e.target.getStage()
    if (stage && mode === "select") stage.container().style.cursor = "move"
  }

  const handleWindowMouseLeave = (e: any) => {
    dispatch({ type: "HOVER", element: null })
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = "default"
  }

  const handleWindowDragStart = (windowId: string, e: any) => {
    if (mode !== "select") {
      e.target.stopDrag()
      return
    }
    setIsDragging(true)
    dispatch({ type: "SELECT", selection: { type: "window", id: windowId } })
  }

  const handleWindowDragMove = (window: WindowOnWall, e: any) => {
    if (mode !== "select") return

    const stage = e.target.getStage()
    const relativePos = stage.getRelativePointerPosition()
    if (!relativePos) return

    // Convert to world coords
    const worldX = relativePos.x / scale
    const worldY = relativePos.y / scale

    // Project onto wall to get new position
    const wall = window.wall
    const dx = wall.endCorner.x - wall.startCorner.x
    const dy = wall.endCorner.y - wall.startCorner.y
    const lengthSq = dx * dx + dy * dy
    if (lengthSq === 0) return

    // Project mouse position onto wall line
    const t = ((worldX - wall.startCorner.x) * dx + (worldY - wall.startCorner.y) * dy) / lengthSq
    const windowWidthRatio = (window.width ?? DIMENSIONS.WINDOW_WIDTH) / Math.sqrt(lengthSq)
    const newPosition = Math.max(windowWidthRatio / 2, Math.min(1 - windowWidthRatio / 2, t))

    // Update the Konva group position to follow the wall
    const newX = (wall.startCorner.x + dx * newPosition) * scale
    const newY = (wall.startCorner.y + dy * newPosition) * scale
    e.target.position({ x: newX, y: newY })

    dispatch({ type: "UPDATE_WINDOW", id: window.id, position: newPosition })
  }

  const handleWindowDragEnd = () => {
    setIsDragging(false)
  }

  return (
    <Group>
      {windowsOnWalls.map((window) => {
        const isSelected = (selection?.type === "window" && selection.id === window.id) ||
          multiSelection.some((s) => s.type === "window" && s.id === window.id)
        const isHovered = hoveredElement?.type === "window" && hoveredElement.id === window.id

        const x = window.worldPosition.x * scale
        const y = window.worldPosition.y * scale
        const width = (window.width ?? DIMENSIONS.WINDOW_WIDTH) * scale
        const frameDepth = 4 / zoom // Thin frame depth

        // Calculate wall angle
        const dx = window.wall.endCorner.x - window.wall.startCorner.x
        const dy = window.wall.endCorner.y - window.wall.startCorner.y
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)

        // Window orientation (0-3, cycles with R key) - for consistency with doors
        const orientation = windowOrientations[window.id] || 0
        // Windows are visually symmetric, but orientation can affect future features

        // Colors
        const strokeColor = isSelected ? "#dc2626" : isHovered ? "#0284c7" : "#3b82f6"
        const glassColor = isSelected ? "rgba(220, 38, 38, 0.2)" : "rgba(147, 197, 253, 0.4)"

        return (
          <Group
            key={window.id}
            x={x}
            y={y}
            rotation={angle}
            draggable={mode === "select"}
            onClick={(e) => handleWindowClick(window.id, e)}
            onTap={(e) => handleWindowClick(window.id, e)}
            onDblClick={(e) => handleWindowDoubleClick(window.id, e)}
            onDblTap={(e) => handleWindowDoubleClick(window.id, e)}
            onMouseEnter={(e) => handleWindowMouseEnter(window.id, e)}
            onMouseLeave={handleWindowMouseLeave}
            onDragStart={(e) => handleWindowDragStart(window.id, e)}
            onDragMove={(e) => handleWindowDragMove(window, e)}
            onDragEnd={handleWindowDragEnd}
          >
            {/* Window opening - clean break in wall */}
            <Line
              points={[-width / 2, 0, width / 2, 0]}
              stroke="#ffffff"
              strokeWidth={6 / zoom}
              listening={false}
            />

            {/* Window frame - outer rectangle */}
            <Rect
              x={-width / 2}
              y={-frameDepth / 2}
              width={width}
              height={frameDepth}
              fill={glassColor}
              stroke={strokeColor}
              strokeWidth={1.5 / zoom}
            />

            {/* Window mullion - center vertical line */}
            <Line
              points={[0, -frameDepth / 2, 0, frameDepth / 2]}
              stroke={strokeColor}
              strokeWidth={1 / zoom}
              listening={false}
            />

            {/* Window sill indicators - small lines at ends */}
            <Line
              points={[-width / 2, -frameDepth, -width / 2, frameDepth]}
              stroke={strokeColor}
              strokeWidth={1.5 / zoom}
              lineCap="round"
              listening={false}
            />
            <Line
              points={[width / 2, -frameDepth, width / 2, frameDepth]}
              stroke={strokeColor}
              strokeWidth={1.5 / zoom}
              lineCap="round"
              listening={false}
            />

            {/* Hit area for easier selection */}
            <Rect
              x={-width / 2 - 5 / zoom}
              y={-frameDepth - 5 / zoom}
              width={width + 10 / zoom}
              height={frameDepth * 2 + 10 / zoom}
              fill="transparent"
            />

            {/* Window dimension label */}
            {showDimensions && (
              <Text
                x={-width / 2}
                y={-frameDepth - 12 / zoom}
                width={width}
                text={formatWidth(window.width ?? DIMENSIONS.WINDOW_WIDTH)}
                fontSize={9 / zoom}
                fontFamily="system-ui, sans-serif"
                fill={strokeColor}
                fontStyle="bold"
                align="center"
                listening={false}
              />
            )}

            {/* Selection indicator */}
            {isSelected && (
              <Rect
                x={-width / 2 - 3 / zoom}
                y={-frameDepth - 3 / zoom}
                width={width + 6 / zoom}
                height={frameDepth * 2 + 6 / zoom}
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
