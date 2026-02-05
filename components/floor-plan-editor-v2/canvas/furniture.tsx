"use client"

import { Group, Rect, Text, Line, Circle } from "react-konva"
import type { CanvasProps } from "../types"
import { PIXELS_PER_FOOT, FURNITURE_DIMENSIONS } from "../constants"

export function FurnitureLayer({ config, state, dispatch }: CanvasProps) {
  const { zoom } = config
  const { furniture, selection, multiSelection, hoveredElement, mode } = state
  const scale = PIXELS_PER_FOOT

  const handleFurnitureClick = (furnitureId: string, e: any) => {
    // Only handle in select/delete modes - let drawing modes bubble to canvas
    if (mode === "select") {
      e.cancelBubble = true
      if (e.evt?.ctrlKey || e.evt?.metaKey) {
        dispatch({ type: "TOGGLE_SELECT", selection: { type: "furniture", id: furnitureId } })
      } else {
        dispatch({ type: "SELECT", selection: { type: "furniture", id: furnitureId } })
      }
    } else if (mode === "delete") {
      e.cancelBubble = true
      dispatch({ type: "DELETE_FURNITURE", id: furnitureId })
    }
    // For wall/rectangle/other modes: DON'T stop propagation
  }

  const handleFurnitureDoubleClick = (furnitureId: string, e: any) => {
    e.cancelBubble = true
    dispatch({ type: "DELETE_FURNITURE", id: furnitureId })
  }

  const handleFurnitureMouseEnter = (furnitureId: string, e: any) => {
    dispatch({ type: "HOVER", element: { type: "furniture", id: furnitureId } })
    const stage = e.target.getStage()
    if (stage && mode === "select") stage.container().style.cursor = "move"
  }

  const handleFurnitureMouseLeave = (e: any) => {
    dispatch({ type: "HOVER", element: null })
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = "default"
  }

  const handleFurnitureDragStart = (furnitureId: string, e: any) => {
    if (mode !== "select") {
      e.target.stopDrag()
      return
    }

    const pos = e.target.position()
    dispatch({
      type: "START_DRAG",
      point: { x: pos.x / scale, y: pos.y / scale },
    })
    dispatch({ type: "SELECT", selection: { type: "furniture", id: furnitureId } })
  }

  const handleFurnitureDragMove = (furnitureId: string, e: any) => {
    if (mode !== "select") return

    const pos = e.target.position()
    let x = pos.x / scale
    let y = pos.y / scale

    // Snap to grid if enabled
    if (state.snapToGrid) {
      x = Math.round(x * 2) / 2 // Snap to 0.5 feet
      y = Math.round(y * 2) / 2

      // Update visual position to snapped value
      e.target.position({
        x: x * scale,
        y: y * scale,
      })
    }

    dispatch({ type: "UPDATE_FURNITURE", id: furnitureId, x, y })
  }

  const handleFurnitureDragEnd = () => {
    dispatch({ type: "END_DRAG" })
  }

  return (
    <Group>
      {furniture.map((item) => {
        const isSelected = (selection?.type === "furniture" && selection.id === item.id) ||
          multiSelection.some((s) => s.type === "furniture" && s.id === item.id)
        const isHovered = hoveredElement?.type === "furniture" && hoveredElement.id === item.id

        const x = item.x * scale
        const y = item.y * scale
        const width = item.width * scale
        const depth = item.depth * scale
        const rotation = item.rotation

        // Colors - cleaner modern style
        const fillColor = isSelected
          ? "rgba(220, 38, 38, 0.15)"
          : isHovered
          ? "rgba(148, 163, 184, 0.4)"
          : "rgba(226, 232, 240, 0.6)"
        const strokeColor = isSelected ? "#dc2626" : isHovered ? "#475569" : "#94a3b8"

        // Get furniture name
        const furnitureDef = FURNITURE_DIMENSIONS[item.type]
        const name = furnitureDef?.name || item.type

        return (
          <Group
            key={item.id}
            x={x}
            y={y}
            rotation={rotation}
            draggable={mode === "select"}
            onClick={(e) => handleFurnitureClick(item.id, e)}
            onTap={(e) => handleFurnitureClick(item.id, e)}
            onDblClick={(e) => handleFurnitureDoubleClick(item.id, e)}
            onDblTap={(e) => handleFurnitureDoubleClick(item.id, e)}
            onMouseEnter={(e) => handleFurnitureMouseEnter(item.id, e)}
            onMouseLeave={handleFurnitureMouseLeave}
            onDragStart={(e) => handleFurnitureDragStart(item.id, e)}
            onDragMove={(e) => handleFurnitureDragMove(item.id, e)}
            onDragEnd={handleFurnitureDragEnd}
          >
            {/* Furniture body - clean rectangle */}
            <Rect
              x={-width / 2}
              y={-depth / 2}
              width={width}
              height={depth}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={1.5 / zoom}
              cornerRadius={3 / zoom}
            />

            {/* Direction indicator (front of furniture) - small notch at top */}
            <Line
              points={[-width / 4, -depth / 2, width / 4, -depth / 2]}
              stroke={strokeColor}
              strokeWidth={3 / zoom}
              lineCap="round"
              listening={false}
            />

            {/* Furniture label */}
            {zoom >= 0.5 && (
              <Text
                x={-width / 2}
                y={-depth / 2 + depth / 2 - 5 / zoom}
                width={width}
                text={name}
                fontSize={Math.min(9, width / 8) / zoom}
                fontFamily="system-ui, sans-serif"
                fill={isSelected ? "#dc2626" : "#475569"}
                fontStyle="bold"
                align="center"
                listening={false}
              />
            )}

            {/* Selection indicator with rotation hint */}
            {isSelected && (
              <>
                <Rect
                  x={-width / 2 - 3 / zoom}
                  y={-depth / 2 - 3 / zoom}
                  width={width + 6 / zoom}
                  height={depth + 6 / zoom}
                  stroke="#dc2626"
                  strokeWidth={1.5 / zoom}
                  dash={[4, 4]}
                  fill="transparent"
                  cornerRadius={4 / zoom}
                  listening={false}
                />
                {/* Rotation handle indicator (corner circle) */}
                <Circle
                  x={width / 2 + 3 / zoom}
                  y={-depth / 2 - 3 / zoom}
                  radius={4 / zoom}
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth={1 / zoom}
                  listening={false}
                />
              </>
            )}

            {/* Hover hint text */}
            {isHovered && !isSelected && (
              <Text
                x={-width / 2}
                y={depth / 2 + 4 / zoom}
                width={width}
                text="R to rotate"
                fontSize={8 / zoom}
                fill="#64748b"
                align="center"
                listening={false}
              />
            )}
          </Group>
        )
      })}
    </Group>
  )
}
