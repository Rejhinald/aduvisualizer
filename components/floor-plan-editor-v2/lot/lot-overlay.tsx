"use client"

import { useMemo } from "react"
import { Line, Group, Text, Rect, Circle } from "react-konva"
import type { Point, Lot, Corner } from "../types"
import type { CanvasConfig } from "../types"
import { PIXELS_PER_FOOT, COLORS } from "../constants"

interface LotOverlayProps {
  config: CanvasConfig
  lot: Lot
  visible: boolean
  corners?: Corner[]  // Floor plan corners to check if within buildable area
}

/**
 * Check if a point is inside a rectangle defined by its corners
 */
function isPointInBuildableArea(
  point: Point,
  buildableArea: Point[]
): boolean {
  if (buildableArea.length < 4) return true  // No buildable area defined = all clear

  const minX = Math.min(...buildableArea.map(p => p.x))
  const maxX = Math.max(...buildableArea.map(p => p.x))
  const minY = Math.min(...buildableArea.map(p => p.y))
  const maxY = Math.max(...buildableArea.map(p => p.y))

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
}

/**
 * Convert lot boundary from feet to canvas pixels
 * The lot boundary is already stored in feet, centered at (0, 0)
 */
function feetToCanvasPixels(
  boundaryFeet: Point[],
  pixelsPerFoot: number
): Point[] {
  return boundaryFeet.map((point) => ({
    x: point.x * pixelsPerFoot,
    y: point.y * pixelsPerFoot,
  }))
}

/**
 * Calculate setback boundary (inset polygon from lot boundary)
 * Creates a simplified rectangular setback area
 */
function calculateSetbackBoundary(
  lotBoundaryPixels: Point[],
  setbacks: {
    front: number
    back: number
    left: number
    right: number
  },
  pixelsPerFoot: number
): Point[] {
  if (lotBoundaryPixels.length < 3) return []

  // Find bounding box of lot
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const p of lotBoundaryPixels) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  // Check for valid bounding box
  if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
    return []
  }

  // Apply setbacks (convert feet to pixels)
  const frontPx = (setbacks.front || 0) * pixelsPerFoot
  const backPx = (setbacks.back || 0) * pixelsPerFoot
  const leftPx = (setbacks.left || 0) * pixelsPerFoot
  const rightPx = (setbacks.right || 0) * pixelsPerFoot

  // Create inset rectangle
  // In canvas coords: minY is top (back), maxY is bottom (front/street)
  const insetMinX = minX + leftPx
  const insetMaxX = maxX - rightPx
  const insetMinY = minY + backPx
  const insetMaxY = maxY - frontPx

  // Ensure valid rectangle (setbacks don't exceed lot size)
  if (insetMinX >= insetMaxX || insetMinY >= insetMaxY) {
    return []
  }

  return [
    { x: insetMinX, y: insetMinY },
    { x: insetMaxX, y: insetMinY },
    { x: insetMaxX, y: insetMaxY },
    { x: insetMinX, y: insetMaxY },
  ]
}

/**
 * Calculate lot dimensions from boundary
 */
function calculateLotDimensions(boundaryPixels: Point[]): { width: number; depth: number } {
  if (boundaryPixels.length < 3) return { width: 0, depth: 0 }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const p of boundaryPixels) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  return {
    width: maxX - minX,
    depth: maxY - minY,
  }
}

export function LotOverlay({ config, lot, visible, corners = [] }: LotOverlayProps) {
  const { pixelsPerFoot } = config

  // Convert lot boundary to canvas pixels
  const lotBoundaryPixels = useMemo(() => {
    if (!lot.boundary || lot.boundary.length < 3) {
      return []
    }
    return feetToCanvasPixels(lot.boundary, pixelsPerFoot)
  }, [lot.boundary, pixelsPerFoot])

  // Calculate setback boundary (buildable area)
  const setbackBoundaryPixels = useMemo(() => {
    if (lotBoundaryPixels.length < 3) return []

    return calculateSetbackBoundary(
      lotBoundaryPixels,
      lot.setbacks,
      pixelsPerFoot
    )
  }, [lotBoundaryPixels, lot.setbacks, pixelsPerFoot])

  // Check which corners are outside the buildable area
  const cornersOutsideBuildableArea = useMemo(() => {
    if (corners.length === 0 || setbackBoundaryPixels.length < 4) return []

    return corners.filter(corner => {
      const cornerPixels = { x: corner.x * pixelsPerFoot, y: corner.y * pixelsPerFoot }
      return !isPointInBuildableArea(cornerPixels, setbackBoundaryPixels)
    })
  }, [corners, setbackBoundaryPixels, pixelsPerFoot])

  // Determine if ADU fits within buildable area
  const aduWithinBuildableArea = cornersOutsideBuildableArea.length === 0

  // Calculate lot dimensions for label
  const lotDimensions = useMemo(() => {
    const dims = calculateLotDimensions(lotBoundaryPixels)
    return {
      widthFeet: dims.width / pixelsPerFoot,
      depthFeet: dims.depth / pixelsPerFoot,
    }
  }, [lotBoundaryPixels, pixelsPerFoot])

  // Calculate lot label position
  const lotLabelPosition = useMemo(() => {
    if (lotBoundaryPixels.length < 1) return { x: 0, y: 0 }
    // Position label at top-left of lot boundary
    let minX = Infinity
    let minY = Infinity
    for (const p of lotBoundaryPixels) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
    }
    return { x: minX, y: minY - 25 }
  }, [lotBoundaryPixels])

  if (!visible || lotBoundaryPixels.length < 3) {
    return null
  }

  // Flatten points for Line component
  const lotFlatPoints = lotBoundaryPixels.flatMap((p) => [p.x, p.y])
  const setbackFlatPoints = setbackBoundaryPixels.flatMap((p) => [p.x, p.y])

  return (
    <Group>
      {/* Lot boundary fill (semi-transparent) */}
      <Line
        points={lotFlatPoints}
        closed
        fill="rgba(59, 130, 246, 0.08)"
        listening={false}
      />

      {/* Lot boundary outline */}
      <Line
        points={lotFlatPoints}
        closed
        stroke={COLORS.LOT_BOUNDARY}
        strokeWidth={2}
        dash={[15, 8]}
        listening={false}
      />

      {/* Setback boundary (buildable area) */}
      {setbackFlatPoints.length >= 6 && (
        <>
          {/* Setback fill - green if ADU fits, red tint if not */}
          <Line
            points={setbackFlatPoints}
            closed
            fill={aduWithinBuildableArea ? COLORS.LOT_BUILDABLE : "rgba(239, 68, 68, 0.1)"}
            listening={false}
          />
          {/* Setback outline - color changes based on fit */}
          <Line
            points={setbackFlatPoints}
            closed
            stroke={aduWithinBuildableArea ? COLORS.LOT_BOUNDARY : COLORS.LOT_SETBACK}
            strokeWidth={1.5}
            dash={[8, 4]}
            listening={false}
          />
        </>
      )}

      {/* Warning indicators for corners outside buildable area */}
      {cornersOutsideBuildableArea.map((corner) => (
        <Group key={corner.id} x={corner.x * pixelsPerFoot} y={corner.y * pixelsPerFoot}>
          <Circle
            x={0}
            y={0}
            radius={8}
            fill="rgba(239, 68, 68, 0.3)"
            stroke={COLORS.LOT_SETBACK}
            strokeWidth={2}
            listening={false}
          />
          <Text
            x={10}
            y={-6}
            text="Outside setback"
            fontSize={9}
            fill={COLORS.LOT_SETBACK}
            fontStyle="bold"
            listening={false}
          />
        </Group>
      ))}

      {/* Lot label */}
      <Group x={lotLabelPosition.x} y={lotLabelPosition.y}>
        <Rect
          x={0}
          y={0}
          width={120}
          height={20}
          fill="rgba(34, 139, 34, 0.9)"
          cornerRadius={3}
        />
        <Text
          x={5}
          y={4}
          text="LOT BOUNDARY"
          fontSize={11}
          fill="#ffffff"
          fontStyle="bold"
          listening={false}
        />
      </Group>

      {/* Lot dimensions */}
      {lotDimensions.widthFeet > 0 && lotDimensions.depthFeet > 0 && (
        <Text
          x={lotLabelPosition.x + 125}
          y={lotLabelPosition.y + 4}
          text={`${Math.round(lotDimensions.widthFeet)}' x ${Math.round(lotDimensions.depthFeet)}'`}
          fontSize={11}
          fill={COLORS.LOT_BOUNDARY}
          fontStyle="bold"
          listening={false}
        />
      )}

      {/* Address label if available */}
      {lot.address && (
        <Text
          x={lotLabelPosition.x}
          y={lotLabelPosition.y - 18}
          text={lot.address}
          fontSize={10}
          fill={COLORS.LOT_BOUNDARY}
          listening={false}
        />
      )}
    </Group>
  )
}
