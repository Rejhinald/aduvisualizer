"use client"

import { useMemo, useCallback, useState } from "react"
import { Line, Group, Text, Rect, Circle } from "react-konva"
import type { Point, Lot, Corner, EditorAction } from "../types"
import type { CanvasConfig } from "../types"
import { PIXELS_PER_FOOT, COLORS } from "../constants"
import { SatelliteTileLayer } from "./satellite-tile-layer"
import { feetToGeo } from "./satellite-utils"
import * as api from "@/lib/api/client-v2"

interface LotOverlayProps {
  config: CanvasConfig
  lot: Lot
  visible: boolean
  showSatellite: boolean
  editMode: boolean
  corners?: Corner[] // Floor plan corners to check setback violations
  dispatch: React.Dispatch<EditorAction>
}

/**
 * Check if a point is inside a bounding box defined by polygon corners
 */
function isPointInBuildableArea(point: Point, buildableArea: Point[]): boolean {
  if (buildableArea.length < 4) return true
  const minX = Math.min(...buildableArea.map((p) => p.x))
  const maxX = Math.max(...buildableArea.map((p) => p.x))
  const minY = Math.min(...buildableArea.map((p) => p.y))
  const maxY = Math.max(...buildableArea.map((p) => p.y))
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
}

/**
 * Calculate setback boundary (inset rectangle from lot boundary)
 */
function calculateSetbackBoundary(
  lotBoundaryPixels: Point[],
  setbacks: { front: number; back: number; left: number; right: number },
  pixelsPerFoot: number
): Point[] {
  if (lotBoundaryPixels.length < 3) return []

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of lotBoundaryPixels) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) return []

  const frontPx = (setbacks.front || 0) * pixelsPerFoot
  const backPx = (setbacks.back || 0) * pixelsPerFoot
  const leftPx = (setbacks.left || 0) * pixelsPerFoot
  const rightPx = (setbacks.right || 0) * pixelsPerFoot

  // Canvas coords: minY is top (back), maxY is bottom (front/street)
  const insetMinX = minX + leftPx
  const insetMaxX = maxX - rightPx
  const insetMinY = minY + backPx
  const insetMaxY = maxY - frontPx

  if (insetMinX >= insetMaxX || insetMinY >= insetMaxY) return []

  return [
    { x: insetMinX, y: insetMinY },
    { x: insetMaxX, y: insetMinY },
    { x: insetMaxX, y: insetMaxY },
    { x: insetMinX, y: insetMaxY },
  ]
}

/**
 * Calculate lot bounding dimensions from boundary pixels
 */
function calculateLotDimensions(boundaryPixels: Point[]): { width: number; depth: number } {
  if (boundaryPixels.length < 3) return { width: 0, depth: 0 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of boundaryPixels) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { width: maxX - minX, depth: maxY - minY }
}

export function LotOverlay({
  config,
  lot,
  visible,
  showSatellite,
  editMode,
  corners = [],
  dispatch,
}: LotOverlayProps) {
  const { pixelsPerFoot, zoom } = config
  const [hoveredCorner, setHoveredCorner] = useState<number | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null)

  // Lot group position in pixels (from lot offset in feet)
  const groupX = (lot.lotOffsetX || 0) * pixelsPerFoot
  const groupY = (lot.lotOffsetY || 0) * pixelsPerFoot

  // Convert lot boundary (feet) to pixels, relative to lot center (0, 0 in group)
  const lotBoundaryPixels = useMemo(() => {
    if (!lot.boundary || lot.boundary.length < 3) return []
    return lot.boundary.map((p) => ({
      x: p.x * pixelsPerFoot,
      y: p.y * pixelsPerFoot,
    }))
  }, [lot.boundary, pixelsPerFoot])

  // Calculate setback boundary (buildable area)
  const setbackBoundaryPixels = useMemo(() => {
    if (lotBoundaryPixels.length < 3) return []
    return calculateSetbackBoundary(lotBoundaryPixels, lot.setbacks, pixelsPerFoot)
  }, [lotBoundaryPixels, lot.setbacks, pixelsPerFoot])

  // Check which floor plan corners are outside setback boundary
  // Corners are in world coords; transform into lot-local coords by subtracting lot offset
  const cornersOutsideBuildableArea = useMemo(() => {
    if (corners.length === 0 || setbackBoundaryPixels.length < 4) return []
    const lotOffX = lot.lotOffsetX || 0
    const lotOffY = lot.lotOffsetY || 0
    return corners.filter((corner) => {
      // Transform corner from world coords to lot-local pixels
      const localPx = {
        x: (corner.x - lotOffX) * pixelsPerFoot,
        y: (corner.y - lotOffY) * pixelsPerFoot,
      }
      return !isPointInBuildableArea(localPx, setbackBoundaryPixels)
    })
  }, [corners, setbackBoundaryPixels, pixelsPerFoot, lot.lotOffsetX, lot.lotOffsetY])

  const aduWithinBuildableArea = cornersOutsideBuildableArea.length === 0

  // Lot dimensions for label
  const lotDimensions = useMemo(() => {
    const dims = calculateLotDimensions(lotBoundaryPixels)
    return {
      widthFeet: dims.width / pixelsPerFoot,
      depthFeet: dims.depth / pixelsPerFoot,
    }
  }, [lotBoundaryPixels, pixelsPerFoot])

  // Label position (top-left of lot boundary)
  const lotLabelPosition = useMemo(() => {
    if (lotBoundaryPixels.length < 1) return { x: 0, y: 0 }
    let minX = Infinity, minY = Infinity
    for (const p of lotBoundaryPixels) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
    }
    return { x: minX, y: minY - 25 }
  }, [lotBoundaryPixels])

  // Edge midpoints for adding corners (only computed in edit mode)
  const edgeMidpoints = useMemo(() => {
    if (!editMode || lotBoundaryPixels.length < 3) return []
    const midpoints: Array<{ x: number; y: number; worldX: number; worldY: number }> = []
    for (let i = 0; i < lotBoundaryPixels.length; i++) {
      const next = (i + 1) % lotBoundaryPixels.length
      midpoints.push({
        x: (lotBoundaryPixels[i].x + lotBoundaryPixels[next].x) / 2,
        y: (lotBoundaryPixels[i].y + lotBoundaryPixels[next].y) / 2,
        worldX: lot.boundary ? (lot.boundary[i].x + lot.boundary[next].x) / 2 : 0,
        worldY: lot.boundary ? (lot.boundary[i].y + lot.boundary[next].y) / 2 : 0,
      })
    }
    return midpoints
  }, [editMode, lotBoundaryPixels, lot.boundary])

  // Handle lot group drag end — persist offset
  const handleDragEnd = useCallback(
    (e: any) => {
      const newX = e.target.x()
      const newY = e.target.y()
      const newOffsetX = newX / pixelsPerFoot
      const newOffsetY = newY / pixelsPerFoot

      dispatch({ type: "UPDATE_LOT_OFFSET", offsetX: newOffsetX, offsetY: newOffsetY })

      // Persist to backend (fire and forget)
      api.updateLot(lot.id, { lotOffsetX: newOffsetX, lotOffsetY: newOffsetY }).catch((err) =>
        console.error("Failed to persist lot offset:", err)
      )

      // Reset cursor
      const stage = e.target.getStage()
      if (stage) stage.container().style.cursor = "grab"
    },
    [dispatch, pixelsPerFoot, lot.id]
  )

  // Handle boundary corner drag (edit mode)
  const handleCornerDrag = useCallback(
    (index: number, e: any) => {
      e.cancelBubble = true // Prevent Group from dragging
      const pos = e.target.position()
      const worldPoint: Point = {
        x: Math.round((pos.x / pixelsPerFoot) * 2) / 2, // Snap to 0.5 feet
        y: Math.round((pos.y / pixelsPerFoot) * 2) / 2,
      }
      dispatch({ type: "UPDATE_LOT_BOUNDARY_CORNER", index, point: worldPoint })
    },
    [dispatch, pixelsPerFoot]
  )

  // Handle boundary corner drag end — persist to backend
  const handleCornerDragEnd = useCallback((e: any) => {
    e.cancelBubble = true
    if (!lot.boundary || !lot.geoLat || !lot.geoLng) return
    const center = { lat: lot.geoLat, lng: lot.geoLng }
    const newVertices = lot.boundary.map((p) => feetToGeo(p, center))
    api
      .updateLot(lot.id, { boundary: lot.boundary, boundaryVertices: newVertices })
      .catch((err) => console.error("Failed to persist boundary:", err))
  }, [lot.id, lot.boundary, lot.geoLat, lot.geoLng])

  // Handle adding a corner on edge click
  const handleEdgeClick = useCallback(
    (edgeIndex: number, e: any) => {
      e.cancelBubble = true
      const midpoint = edgeMidpoints[edgeIndex]
      const worldPoint: Point = {
        x: Math.round(midpoint.worldX * 2) / 2,
        y: Math.round(midpoint.worldY * 2) / 2,
      }
      dispatch({ type: "ADD_LOT_BOUNDARY_CORNER", afterIndex: edgeIndex, point: worldPoint })
    },
    [dispatch, edgeMidpoints]
  )

  // Handle removing a corner
  const handleRemoveCorner = useCallback(
    (index: number, e: any) => {
      e.cancelBubble = true
      if (lot.boundary && lot.boundary.length > 3) {
        dispatch({ type: "REMOVE_LOT_BOUNDARY_CORNER", index })
      }
    },
    [dispatch, lot.boundary]
  )

  if (!visible || lotBoundaryPixels.length < 3) return null

  const lotFlatPoints = lotBoundaryPixels.flatMap((p) => [p.x, p.y])
  const setbackFlatPoints = setbackBoundaryPixels.flatMap((p) => [p.x, p.y])
  const canRemoveCorners = (lot.boundary?.length ?? 0) > 3

  return (
    <Group
      x={groupX}
      y={groupY}
      draggable={!editMode}
      onDragEnd={handleDragEnd}
      onMouseDown={(e) => {
        // Stop Stage from stealing the drag
        if (!editMode) e.cancelBubble = true
      }}
      onMouseEnter={(e) => {
        if (!editMode) {
          const stage = e.target.getStage()
          if (stage) stage.container().style.cursor = "grab"
        }
      }}
      onMouseLeave={(e) => {
        if (!editMode) {
          const stage = e.target.getStage()
          if (stage) stage.container().style.cursor = "default"
        }
      }}
      onDragStart={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = "grabbing"
      }}
    >
      {/* Satellite imagery layer */}
      {showSatellite && lot.geoLat && lot.geoLng && (
        <SatelliteTileLayer lot={lot} pixelsPerFoot={pixelsPerFoot} />
      )}

      {/* Lot boundary fill — drag handle when not in edit mode */}
      <Line
        points={lotFlatPoints}
        closed
        fill={showSatellite ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.08)"}
        listening={!editMode}
      />

      {/* Lot boundary outline */}
      <Line
        points={lotFlatPoints}
        closed
        stroke={COLORS.LOT_BOUNDARY}
        strokeWidth={2 / zoom}
        dash={[15 / zoom, 8 / zoom]}
        listening={false}
      />

      {/* Setback boundary (buildable area) */}
      {setbackFlatPoints.length >= 6 && (
        <>
          <Line
            points={setbackFlatPoints}
            closed
            fill={aduWithinBuildableArea ? COLORS.LOT_BUILDABLE : "rgba(239, 68, 68, 0.05)"}
            listening={false}
          />
          <Line
            points={setbackFlatPoints}
            closed
            stroke={aduWithinBuildableArea ? COLORS.LOT_BOUNDARY : COLORS.LOT_SETBACK}
            strokeWidth={1.5 / zoom}
            dash={[8 / zoom, 4 / zoom]}
            listening={false}
          />
        </>
      )}

      {/* Single warning badge if ADU is outside buildable area (replaces per-corner labels) */}
      {!aduWithinBuildableArea && cornersOutsideBuildableArea.length > 0 && (
        <Group x={lotLabelPosition.x} y={lotLabelPosition.y + 25 / zoom}>
          <Rect
            x={0}
            y={0}
            width={160 / zoom}
            height={18 / zoom}
            fill="rgba(239, 68, 68, 0.9)"
            cornerRadius={3 / zoom}
            listening={false}
          />
          <Text
            x={5 / zoom}
            y={3 / zoom}
            text={`${cornersOutsideBuildableArea.length} corner${cornersOutsideBuildableArea.length > 1 ? "s" : ""} outside setback`}
            fontSize={10 / zoom}
            fill="#ffffff"
            fontStyle="bold"
            listening={false}
          />
        </Group>
      )}

      {/* Small dots on violating corners (no text labels) */}
      {cornersOutsideBuildableArea.map((corner) => {
        const localX = (corner.x - (lot.lotOffsetX || 0)) * pixelsPerFoot
        const localY = (corner.y - (lot.lotOffsetY || 0)) * pixelsPerFoot
        return (
          <Circle
            key={corner.id}
            x={localX}
            y={localY}
            radius={5 / zoom}
            fill="rgba(239, 68, 68, 0.4)"
            stroke={COLORS.LOT_SETBACK}
            strokeWidth={1.5 / zoom}
            listening={false}
          />
        )
      })}

      {/* Edge midpoint markers (click to add corner) - edit mode only */}
      {editMode &&
        edgeMidpoints.map((midpoint, index) => (
          <Group key={`edge-${index}`}>
            <Circle
              x={midpoint.x}
              y={midpoint.y}
              radius={12 / zoom}
              fill="transparent"
              onMouseEnter={() => setHoveredEdge(index)}
              onMouseLeave={() => setHoveredEdge(null)}
              onClick={(e) => handleEdgeClick(index, e)}
              onTap={(e) => handleEdgeClick(index, e)}
              onMouseDown={(e) => { e.cancelBubble = true }}
            />
            <Circle
              x={midpoint.x}
              y={midpoint.y}
              radius={hoveredEdge === index ? 8 / zoom : 5 / zoom}
              fill={hoveredEdge === index ? "#22c55e" : "rgba(34, 197, 94, 0.3)"}
              stroke={hoveredEdge === index ? "#ffffff" : "transparent"}
              strokeWidth={2 / zoom}
              listening={false}
            />
            {hoveredEdge === index && (
              <>
                <Line
                  points={[midpoint.x - 4 / zoom, midpoint.y, midpoint.x + 4 / zoom, midpoint.y]}
                  stroke="#ffffff"
                  strokeWidth={2 / zoom}
                  listening={false}
                />
                <Line
                  points={[midpoint.x, midpoint.y - 4 / zoom, midpoint.x, midpoint.y + 4 / zoom]}
                  stroke="#ffffff"
                  strokeWidth={2 / zoom}
                  listening={false}
                />
              </>
            )}
          </Group>
        ))}

      {/* Draggable corner handles - edit mode only */}
      {editMode &&
        lotBoundaryPixels.map((corner, index) => (
          <Circle
            key={`corner-${index}`}
            x={corner.x}
            y={corner.y}
            radius={8 / zoom}
            fill={
              hoveredCorner === index && canRemoveCorners
                ? "#ef4444"
                : COLORS.LOT_BOUNDARY
            }
            stroke="#ffffff"
            strokeWidth={2 / zoom}
            draggable
            onMouseDown={(e) => { e.cancelBubble = true }}
            onDragMove={(e) => handleCornerDrag(index, e)}
            onDragEnd={(e) => handleCornerDragEnd(e)}
            onMouseEnter={(e) => {
              setHoveredCorner(index)
              const stage = e.target.getStage()
              if (stage) stage.container().style.cursor = "move"
            }}
            onMouseLeave={(e) => {
              setHoveredCorner(null)
              const stage = e.target.getStage()
              if (stage) stage.container().style.cursor = "default"
            }}
            onDblClick={(e) => handleRemoveCorner(index, e)}
            onDblTap={(e) => handleRemoveCorner(index, e)}
          />
        ))}

      {/* Lot label */}
      <Group x={lotLabelPosition.x} y={lotLabelPosition.y}>
        <Rect
          x={0}
          y={0}
          width={120 / zoom}
          height={20 / zoom}
          fill="rgba(34, 139, 34, 0.9)"
          cornerRadius={3 / zoom}
          listening={false}
        />
        <Text
          x={5 / zoom}
          y={4 / zoom}
          text="LOT BOUNDARY"
          fontSize={11 / zoom}
          fill="#ffffff"
          fontStyle="bold"
          listening={false}
        />
      </Group>

      {/* Lot dimensions */}
      {lotDimensions.widthFeet > 0 && lotDimensions.depthFeet > 0 && (
        <Text
          x={lotLabelPosition.x + 125 / zoom}
          y={lotLabelPosition.y + 4 / zoom}
          text={`${Math.round(lotDimensions.widthFeet)}' x ${Math.round(lotDimensions.depthFeet)}'`}
          fontSize={11 / zoom}
          fill={COLORS.LOT_BOUNDARY}
          fontStyle="bold"
          listening={false}
        />
      )}

      {/* Address label */}
      {lot.address && (
        <Text
          x={lotLabelPosition.x}
          y={lotLabelPosition.y - 18 / zoom}
          text={lot.address}
          fontSize={10 / zoom}
          fill={COLORS.LOT_BOUNDARY}
          listening={false}
        />
      )}

      {/* Edit mode hint */}
      {editMode && (
        <Text
          x={lotLabelPosition.x}
          y={lotLabelPosition.y + (aduWithinBuildableArea ? 25 : 50) / zoom}
          text="Drag corners to edit • Click + to add • Double-click to remove"
          fontSize={9 / zoom}
          fill="#94a3b8"
          listening={false}
        />
      )}
    </Group>
  )
}
