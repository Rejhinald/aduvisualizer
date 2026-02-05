"use client"

import { Group, Line, Text, Rect } from "react-konva"
import type { CanvasProps } from "../types"
import { PIXELS_PER_FOOT, ROOM_TYPE_COLORS, COLORS } from "../constants"

// Room type display labels
const ROOM_TYPE_LABELS: Record<string, string> = {
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
  other: "Room",
}

export function RoomsLayer({ config, state, dispatch }: CanvasProps) {
  const { zoom } = config
  const { rooms, showDimensions, selection, multiSelection, hoveredElement, mode } = state
  const scale = PIXELS_PER_FOOT

  const handleRoomClick = (roomId: string, e: any) => {
    // Handle clicks in room mode or select mode
    if (mode === "room" || mode === "select") {
      e.cancelBubble = true
      if (e.evt?.ctrlKey || e.evt?.metaKey) {
        dispatch({ type: "TOGGLE_SELECT", selection: { type: "room", id: roomId } })
      } else {
        dispatch({ type: "SELECT", selection: { type: "room", id: roomId } })
      }
    }
    // In other modes, don't stop propagation - let canvas handle it
  }

  const handleRoomMouseEnter = (roomId: string, e: any) => {
    dispatch({ type: "HOVER", element: { type: "room", id: roomId } })
    const stage = e.target.getStage()
    if (stage && (mode === "room" || mode === "select")) {
      stage.container().style.cursor = "pointer"
    }
  }

  const handleRoomMouseLeave = (e: any) => {
    dispatch({ type: "HOVER", element: null })
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = "default"
  }

  // Hide room labels during drawing to reduce clutter
  const showLabels = showDimensions && mode !== "wall" && mode !== "rectangle"

  return (
    <Group>
      {rooms.map((room) => {
        if (!room.corners || room.corners.length < 3) return null

        const isSelected =
          (selection?.type === "room" && selection.id === room.id) ||
          multiSelection.some((s) => s.type === "room" && s.id === room.id)
        const isHovered =
          hoveredElement?.type === "room" && hoveredElement.id === room.id

        // Convert corner coordinates to points array
        const points = room.corners.flatMap((corner) => [
          corner.x * scale,
          corner.y * scale,
        ])

        // Get room color based on type
        const fillColor = ROOM_TYPE_COLORS[room.type] || ROOM_TYPE_COLORS.other

        // Adjust opacity based on mode and selection state
        const baseOpacity = mode === "room" ? 0.7 : 0.5
        const opacity = isSelected ? 0.8 : isHovered ? 0.6 : baseOpacity

        // Calculate label position (centroid)
        const labelX = room.center.x * scale
        const labelY = room.center.y * scale

        // Get display label
        const typeLabel = ROOM_TYPE_LABELS[room.type] || room.type
        const displayName = room.name && room.name !== `Room ${rooms.indexOf(room) + 1}`
          ? room.name
          : typeLabel

        return (
          <Group key={room.id}>
            {/* Room fill - clickable in room/select modes */}
            <Line
              points={points}
              closed
              fill={fillColor}
              opacity={opacity}
              stroke={isSelected ? "#dc2626" : isHovered ? "#3b82f6" : COLORS.ROOM_STROKE}
              strokeWidth={isSelected ? 2 / zoom : isHovered ? 1.5 / zoom : 0.5 / zoom}
              onClick={(e) => handleRoomClick(room.id, e)}
              onTap={(e) => handleRoomClick(room.id, e)}
              onMouseEnter={(e) => handleRoomMouseEnter(room.id, e)}
              onMouseLeave={handleRoomMouseLeave}
            />

            {/* Selection indicator (dashed outline) */}
            {isSelected && (
              <Line
                points={points}
                closed
                stroke="#dc2626"
                strokeWidth={2 / zoom}
                dash={[8 / zoom, 4 / zoom]}
                listening={false}
              />
            )}

            {/* Room label with background */}
            {showLabels && (
              <Group x={labelX} y={labelY}>
                {/* Label background */}
                <Rect
                  x={-45 / zoom}
                  y={-16 / zoom}
                  width={90 / zoom}
                  height={32 / zoom}
                  fill="rgba(255, 255, 255, 0.92)"
                  cornerRadius={4 / zoom}
                  listening={false}
                />

                {/* Room name/type */}
                <Text
                  x={-40 / zoom}
                  y={-12 / zoom}
                  width={80 / zoom}
                  text={displayName}
                  fontSize={10 / zoom}
                  fontStyle="bold"
                  fill={isSelected ? "#dc2626" : "#334155"}
                  align="center"
                  listening={false}
                />

                {/* Room area */}
                <Text
                  x={-40 / zoom}
                  y={2 / zoom}
                  width={80 / zoom}
                  text={`${Math.round(room.area)} sq ft`}
                  fontSize={9 / zoom}
                  fill="#64748b"
                  align="center"
                  listening={false}
                />
              </Group>
            )}
          </Group>
        )
      })}
    </Group>
  )
}
