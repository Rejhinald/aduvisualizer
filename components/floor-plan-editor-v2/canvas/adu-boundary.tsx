"use client"

import { useMemo, useCallback, useState } from "react"
import { Group, Line, Circle, Text, Rect } from "react-konva"
import type { AduBoundary, EditorAction, Point } from "../types"
import type { CanvasConfig } from "../types"
import { COLORS, PIXELS_PER_FOOT, calculatePolygonArea } from "../constants"

interface AduBoundaryOverlayProps {
  config: CanvasConfig
  boundary: AduBoundary
  visible: boolean
  editMode: boolean
  dispatch: React.Dispatch<EditorAction>
}

export function AduBoundaryOverlay({
  config,
  boundary,
  visible,
  editMode,
  dispatch,
}: AduBoundaryOverlayProps) {
  const { pixelsPerFoot, zoom } = config
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null)
  const [hoveredCorner, setHoveredCorner] = useState<number | null>(null)

  // Convert boundary corners to pixels
  const cornersPixels = useMemo(() => {
    return boundary.corners.map((c) => ({
      x: c.x * pixelsPerFoot,
      y: c.y * pixelsPerFoot,
    }))
  }, [boundary.corners, pixelsPerFoot])

  // Calculate edge midpoints (for adding corners)
  const edgeMidpoints = useMemo(() => {
    const midpoints: Array<{ x: number; y: number; worldX: number; worldY: number }> = []
    for (let i = 0; i < cornersPixels.length; i++) {
      const next = (i + 1) % cornersPixels.length
      midpoints.push({
        x: (cornersPixels[i].x + cornersPixels[next].x) / 2,
        y: (cornersPixels[i].y + cornersPixels[next].y) / 2,
        worldX: (boundary.corners[i].x + boundary.corners[next].x) / 2,
        worldY: (boundary.corners[i].y + boundary.corners[next].y) / 2,
      })
    }
    return midpoints
  }, [cornersPixels, boundary.corners])

  // Calculate actual area from corners
  const actualArea = useMemo(() => {
    return calculatePolygonArea(boundary.corners)
  }, [boundary.corners])

  // Calculate center for label
  const center = useMemo(() => {
    if (cornersPixels.length === 0) return { x: 0, y: 0 }
    const sumX = cornersPixels.reduce((sum, c) => sum + c.x, 0)
    const sumY = cornersPixels.reduce((sum, c) => sum + c.y, 0)
    return {
      x: sumX / cornersPixels.length,
      y: sumY / cornersPixels.length,
    }
  }, [cornersPixels])

  // Handle corner drag
  const handleCornerDrag = useCallback(
    (index: number, e: any) => {
      const pos = e.target.position()
      const worldPoint: Point = {
        x: Math.round((pos.x / pixelsPerFoot) * 2) / 2, // Snap to 0.5 feet
        y: Math.round((pos.y / pixelsPerFoot) * 2) / 2,
      }
      dispatch({ type: "UPDATE_ADU_BOUNDARY_CORNER", index, point: worldPoint })
    },
    [dispatch, pixelsPerFoot]
  )

  // Handle adding a corner on edge click
  const handleEdgeClick = useCallback(
    (edgeIndex: number) => {
      const midpoint = edgeMidpoints[edgeIndex]
      const worldPoint: Point = {
        x: Math.round(midpoint.worldX * 2) / 2, // Snap to 0.5 feet
        y: Math.round(midpoint.worldY * 2) / 2,
      }
      dispatch({ type: "ADD_ADU_BOUNDARY_CORNER", afterIndex: edgeIndex, point: worldPoint })
    },
    [dispatch, edgeMidpoints]
  )

  // Handle removing a corner
  const handleRemoveCorner = useCallback(
    (index: number, e: any) => {
      e.cancelBubble = true // Prevent drag start
      if (boundary.corners.length > 3) {
        dispatch({ type: "REMOVE_ADU_BOUNDARY_CORNER", index })
      }
    },
    [dispatch, boundary.corners.length]
  )

  if (!visible || cornersPixels.length < 3) {
    return null
  }

  // Flatten points for Line component
  const flatPoints = cornersPixels.flatMap((c) => [c.x, c.y])
  const canRemoveCorners = boundary.corners.length > 3

  return (
    <Group>
      {/* Boundary fill */}
      <Line
        points={flatPoints}
        closed
        fill={COLORS.ADU_BOUNDARY_FILL}
        listening={false}
      />

      {/* Boundary outline */}
      <Line
        points={flatPoints}
        closed
        stroke={COLORS.ADU_BOUNDARY_STROKE}
        strokeWidth={2 / zoom}
        dash={[10 / zoom, 5 / zoom]}
        listening={false}
      />

      {/* Edge midpoint markers (click to add corner) - only in edit mode */}
      {editMode && edgeMidpoints.map((midpoint, index) => (
        <Group key={`edge-${index}`}>
          {/* Larger hit area */}
          <Circle
            x={midpoint.x}
            y={midpoint.y}
            radius={12 / zoom}
            fill="transparent"
            onMouseEnter={() => setHoveredEdge(index)}
            onMouseLeave={() => setHoveredEdge(null)}
            onClick={() => handleEdgeClick(index)}
            onTap={() => handleEdgeClick(index)}
          />
          {/* Visual marker (only visible on hover or always faintly) */}
          <Circle
            x={midpoint.x}
            y={midpoint.y}
            radius={hoveredEdge === index ? 8 / zoom : 5 / zoom}
            fill={hoveredEdge === index ? "#22c55e" : "rgba(34, 197, 94, 0.3)"}
            stroke={hoveredEdge === index ? "#ffffff" : "transparent"}
            strokeWidth={2 / zoom}
            listening={false}
          />
          {/* Plus icon on hover */}
          {hoveredEdge === index && (
            <>
              <Line
                points={[
                  midpoint.x - 4 / zoom, midpoint.y,
                  midpoint.x + 4 / zoom, midpoint.y,
                ]}
                stroke="#ffffff"
                strokeWidth={2 / zoom}
                listening={false}
              />
              <Line
                points={[
                  midpoint.x, midpoint.y - 4 / zoom,
                  midpoint.x, midpoint.y + 4 / zoom,
                ]}
                stroke="#ffffff"
                strokeWidth={2 / zoom}
                listening={false}
              />
            </>
          )}
        </Group>
      ))}

      {/* Draggable corner handles - interactive only in edit mode */}
      {cornersPixels.map((corner, index) => (
        <Group key={index}>
          {/* Main corner handle */}
          <Circle
            x={corner.x}
            y={corner.y}
            radius={editMode ? 8 / zoom : 5 / zoom}
            fill={hoveredCorner === index && canRemoveCorners && editMode ? "#ef4444" : COLORS.ADU_BOUNDARY_CORNER}
            stroke="#ffffff"
            strokeWidth={2 / zoom}
            draggable={editMode}
            onDragMove={(e) => editMode && handleCornerDrag(index, e)}
            onMouseEnter={(e) => {
              if (!editMode) return
              setHoveredCorner(index)
              const stage = e.target.getStage()
              if (stage) stage.container().style.cursor = "move"
            }}
            onMouseLeave={(e) => {
              if (!editMode) return
              setHoveredCorner(null)
              const stage = e.target.getStage()
              if (stage) stage.container().style.cursor = "default"
            }}
            onDblClick={(e) => editMode && handleRemoveCorner(index, e)}
            onDblTap={(e) => editMode && handleRemoveCorner(index, e)}
          />
          {/* X icon on hover when removable (only in edit mode) */}
          {editMode && hoveredCorner === index && canRemoveCorners && (
            <>
              <Line
                points={[
                  corner.x - 3 / zoom, corner.y - 3 / zoom,
                  corner.x + 3 / zoom, corner.y + 3 / zoom,
                ]}
                stroke="#ffffff"
                strokeWidth={2 / zoom}
                listening={false}
              />
              <Line
                points={[
                  corner.x + 3 / zoom, corner.y - 3 / zoom,
                  corner.x - 3 / zoom, corner.y + 3 / zoom,
                ]}
                stroke="#ffffff"
                strokeWidth={2 / zoom}
                listening={false}
              />
            </>
          )}
        </Group>
      ))}

      {/* Corner coordinate labels */}
      {cornersPixels.map((corner, index) => (
        <Text
          key={`label-${index}`}
          x={corner.x + 12 / zoom}
          y={corner.y - 18 / zoom}
          text={`(${boundary.corners[index].x.toFixed(1)}', ${boundary.corners[index].y.toFixed(1)}')`}
          fontSize={9 / zoom}
          fill="#64748b"
          listening={false}
        />
      ))}

      {/* Instructions hint - only in edit mode */}
      {editMode && (
        <Text
          x={center.x - 70 / zoom}
          y={center.y + 20 / zoom}
          text="Click + to add corners • Double-click to remove"
          fontSize={9 / zoom}
          fill="#94a3b8"
          listening={false}
        />
      )}
    </Group>
  )
}
