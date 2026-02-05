"use client"

import { useState, useMemo, useRef } from "react"
import { Group, Circle, Line, Text } from "react-konva"
import type { CanvasProps, Corner } from "../types"
import { COLORS, PIXELS_PER_FOOT, DIMENSIONS } from "../constants"

// Merge threshold in feet (slightly larger than snap radius for easier merging)
const MERGE_THRESHOLD = 0.75

export function CornersLayer({ config, state, dispatch }: CanvasProps) {
  const { zoom } = config
  const { corners, walls, selection, multiSelection, hoveredElement, mode } = state
  // Don't multiply by zoom here - Stage already handles zoom via scaleX/scaleY
  const scale = PIXELS_PER_FOOT

  // Track locally hovered corner for showing delete X
  const [localHoveredCorner, setLocalHoveredCorner] = useState<string | null>(null)

  // Corner size scales inversely with zoom (appears constant on screen)
  const cornerRadius = 8 / zoom
  const smallCornerRadius = 6 / zoom

  // Check if corner can be deleted (not connected to more than 2 walls or has special rules)
  const canDeleteCorner = useMemo(() => {
    const map = new Map<string, number>()
    walls.forEach((wall) => {
      map.set(wall.startCornerId, (map.get(wall.startCornerId) || 0) + 1)
      map.set(wall.endCornerId, (map.get(wall.endCornerId) || 0) + 1)
    })
    return (cornerId: string) => {
      // Allow deletion if corner has 2 or fewer connections, or no walls at all
      return (map.get(cornerId) || 0) <= 2
    }
  }, [walls])

  const handleCornerClick = (cornerId: string, e: any) => {
    if (mode === "select") {
      // Stop propagation for select mode - corner handles selection
      e.cancelBubble = true
      // Check for Ctrl+click for multi-selection
      if (e.evt?.ctrlKey || e.evt?.metaKey) {
        dispatch({ type: "TOGGLE_SELECT", selection: { type: "corner", id: cornerId } })
      } else {
        dispatch({ type: "SELECT", selection: { type: "corner", id: cornerId } })
      }
    } else if (mode === "delete") {
      // Stop propagation for delete mode - corner handles deletion
      e.cancelBubble = true
      dispatch({ type: "DELETE_CORNER", id: cornerId })
    }
    // For wall/rectangle/other modes: DON'T stop propagation
    // Let the event bubble up to the canvas handler which has snap-to-corner logic
  }

  const handleCornerDoubleClick = (cornerId: string, e: any) => {
    // Stop propagation to prevent Stage's double-click handler from firing
    e.cancelBubble = true
    // Double-click deletes the corner
    dispatch({ type: "DELETE_CORNER", id: cornerId })
  }

  const handleCornerMouseEnter = (cornerId: string, e: any) => {
    setLocalHoveredCorner(cornerId)
    dispatch({ type: "HOVER", element: { type: "corner", id: cornerId } })
    // Change cursor
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = "move"
  }

  const handleCornerMouseLeave = (e: any) => {
    setLocalHoveredCorner(null)
    dispatch({ type: "HOVER", element: null })
    // Reset cursor
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = "default"
  }

  // Track which corner is being dragged for merge detection
  const draggingCornerRef = useRef<string | null>(null)

  // Find nearby corner (excluding the dragging corner)
  const findNearbyCorner = (point: { x: number; y: number }, excludeId: string): Corner | null => {
    for (const corner of corners) {
      if (corner.id === excludeId) continue
      const dx = corner.x - point.x
      const dy = corner.y - point.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= MERGE_THRESHOLD) {
        return corner
      }
    }
    return null
  }

  const handleCornerDragStart = (cornerId: string, e: any) => {
    if (mode !== "select") return

    draggingCornerRef.current = cornerId
    const pos = e.target.position()
    dispatch({
      type: "START_DRAG",
      point: { x: pos.x / scale, y: pos.y / scale },
    })
    dispatch({ type: "SELECT", selection: { type: "corner", id: cornerId } })
  }

  const handleCornerDragMove = (cornerId: string, e: any) => {
    if (mode !== "select") return

    const pos = e.target.position()
    let x = pos.x / scale
    let y = pos.y / scale

    // Check for nearby corner to show merge preview
    const nearbyCorner = findNearbyCorner({ x, y }, cornerId)
    if (nearbyCorner) {
      // Snap to nearby corner position for visual feedback
      x = nearbyCorner.x
      y = nearbyCorner.y
      e.target.position({
        x: x * scale,
        y: y * scale,
      })
    } else if (state.snapToGrid) {
      // Snap to grid if enabled
      x = Math.round(x * 2) / 2 // Snap to 0.5 feet
      y = Math.round(y * 2) / 2
      e.target.position({
        x: x * scale,
        y: y * scale,
      })
    }

    dispatch({ type: "UPDATE_CORNER", id: cornerId, x, y })
  }

  const handleCornerDragEnd = (cornerId: string, e: any) => {
    const pos = e.target.position()
    const x = pos.x / scale
    const y = pos.y / scale

    // Check if dropped on another corner - merge them
    const nearbyCorner = findNearbyCorner({ x, y }, cornerId)
    if (nearbyCorner) {
      // Merge the dragged corner into the nearby corner
      dispatch({ type: "MERGE_CORNERS", sourceId: cornerId, targetId: nearbyCorner.id })
    }

    draggingCornerRef.current = null
    dispatch({ type: "END_DRAG" })
  }

  return (
    <Group>
      {corners.map((corner) => {
        const isSelected = (selection?.type === "corner" && selection.id === corner.id) ||
          multiSelection.some((s) => s.type === "corner" && s.id === corner.id)
        const isHovered = localHoveredCorner === corner.id
        const canDelete = canDeleteCorner(corner.id)
        const showDeleteIndicator = isHovered && canDelete

        return (
          <Group key={corner.id}>
            {/* Main corner handle */}
            <Circle
              x={corner.x * scale}
              y={corner.y * scale}
              radius={isHovered ? cornerRadius : smallCornerRadius}
              fill={
                showDeleteIndicator
                  ? "#ef4444" // Red when showing delete
                  : isSelected
                  ? COLORS.CORNER_SELECTED
                  : isHovered
                  ? "#3b82f6" // Blue on hover
                  : COLORS.CORNER_FILL
              }
              stroke="#ffffff"
              strokeWidth={2 / zoom}
              shadowColor="rgba(0,0,0,0.3)"
              shadowBlur={isHovered ? 4 / zoom : 2 / zoom}
              shadowOffset={{ x: 1 / zoom, y: 1 / zoom }}
              draggable={mode === "select"}
              onClick={(e) => handleCornerClick(corner.id, e)}
              onTap={(e) => handleCornerClick(corner.id, e)}
              onDblClick={(e) => handleCornerDoubleClick(corner.id, e)}
              onDblTap={(e) => handleCornerDoubleClick(corner.id, e)}
              onMouseEnter={(e) => handleCornerMouseEnter(corner.id, e)}
              onMouseLeave={handleCornerMouseLeave}
              onDragStart={(e) => handleCornerDragStart(corner.id, e)}
              onDragMove={(e) => handleCornerDragMove(corner.id, e)}
              onDragEnd={(e) => handleCornerDragEnd(corner.id, e)}
            />

            {/* X icon on hover when deletable (double-click hint) */}
            {showDeleteIndicator && (
              <>
                <Line
                  points={[
                    corner.x * scale - 3 / zoom, corner.y * scale - 3 / zoom,
                    corner.x * scale + 3 / zoom, corner.y * scale + 3 / zoom,
                  ]}
                  stroke="#ffffff"
                  strokeWidth={2 / zoom}
                  listening={false}
                />
                <Line
                  points={[
                    corner.x * scale + 3 / zoom, corner.y * scale - 3 / zoom,
                    corner.x * scale - 3 / zoom, corner.y * scale + 3 / zoom,
                  ]}
                  stroke="#ffffff"
                  strokeWidth={2 / zoom}
                  listening={false}
                />
              </>
            )}

            {/* Coordinate label on hover */}
            {isHovered && (
              <Text
                x={corner.x * scale + 12 / zoom}
                y={corner.y * scale - 18 / zoom}
                text={`(${corner.x.toFixed(1)}', ${corner.y.toFixed(1)}')`}
                fontSize={10 / zoom}
                fill="#64748b"
                fontStyle="bold"
                listening={false}
              />
            )}
          </Group>
        )
      })}
    </Group>
  )
}
