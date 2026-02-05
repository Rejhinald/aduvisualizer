"use client"

import { Group, Line, Circle, Rect, Text, Arc } from "react-konva"
import type { CanvasProps } from "../types"
import { COLORS, PIXELS_PER_FOOT, DIMENSIONS, FURNITURE_DIMENSIONS } from "../constants"

// Format feet to feet-inches string
function formatFeetInches(feet: number): string {
  if (feet < 0.1) return ""
  const wholeFeet = Math.floor(Math.abs(feet))
  const inches = Math.round((Math.abs(feet) - wholeFeet) * 12)
  if (inches === 0) return `${wholeFeet}'-0"`
  return `${wholeFeet}'-${inches}"`
}

// Get door orientation from 0-3 state
function getDoorOrientation(orientation: number): { hingeRight: boolean; swingUp: boolean } {
  switch (orientation % 4) {
    case 0: return { hingeRight: false, swingUp: false }  // hinge left, swing down
    case 1: return { hingeRight: true, swingUp: false }   // hinge right, swing down
    case 2: return { hingeRight: true, swingUp: true }    // hinge right, swing up
    case 3: return { hingeRight: false, swingUp: true }   // hinge left, swing up
    default: return { hingeRight: false, swingUp: false }
  }
}

export function DrawingPreview({ config, state }: CanvasProps) {
  const { zoom } = config
  const {
    mode,
    isDrawing,
    drawingStart,
    drawingCorners,
    drawingPreview,
    placementPreview,
    placementType,
    placementPreviewAngle,
    placementPreviewWallId,
    placementPreviewOrientation,
    isSelectionBoxActive,
    selectionBoxStart,
    selectionBoxEnd,
  } = state
  // Don't multiply by zoom - Stage handles scaling
  const scale = PIXELS_PER_FOOT

  // Selection box preview - modern blue style
  if (isSelectionBoxActive && selectionBoxStart && selectionBoxEnd) {
    const x1 = Math.min(selectionBoxStart.x, selectionBoxEnd.x) * scale
    const y1 = Math.min(selectionBoxStart.y, selectionBoxEnd.y) * scale
    const width = Math.abs(selectionBoxEnd.x - selectionBoxStart.x) * scale
    const height = Math.abs(selectionBoxEnd.y - selectionBoxStart.y) * scale

    return (
      <Group>
        {/* Selection box fill */}
        <Rect
          x={x1}
          y={y1}
          width={width}
          height={height}
          fill="rgba(59, 130, 246, 0.12)"
          listening={false}
        />
        {/* Selection box border - solid blue line */}
        <Rect
          x={x1}
          y={y1}
          width={width}
          height={height}
          stroke="#3b82f6"
          strokeWidth={2 / zoom}
          listening={false}
        />
        {/* Corner markers for better visibility */}
        {[
          { x: x1, y: y1 },
          { x: x1 + width, y: y1 },
          { x: x1 + width, y: y1 + height },
          { x: x1, y: y1 + height },
        ].map((corner, i) => (
          <Circle
            key={i}
            x={corner.x}
            y={corner.y}
            radius={4 / zoom}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={1.5 / zoom}
            listening={false}
          />
        ))}
      </Group>
    )
  }

  // Wall/Divider drawing preview
  // Dividers use purple color to distinguish from solid walls
  if ((mode === "wall" || mode === "divider") && isDrawing && drawingStart) {
    const isVirtual = mode === "divider"
    const drawColor = isVirtual ? "#a78bfa" : "#3b82f6" // Purple for dividers, blue for walls
    const closeColor = "#22c55e"

    // Committed points: start + all corners added so far
    const committedPoints = [drawingStart, ...drawingCorners]

    // Build the line points including preview (rubber-band to current mouse)
    const points = committedPoints.flatMap((p) => [p.x * scale, p.y * scale])

    // Add preview point (current mouse position) if available
    if (drawingPreview) {
      points.push(drawingPreview.x * scale, drawingPreview.y * scale)
    }

    // Calculate if near first point (for close polygon visual cue)
    const closeThreshold = 0.75 // feet
    const isNearFirstPoint = drawingPreview && committedPoints.length >= 2 &&
      Math.sqrt(
        Math.pow(drawingPreview.x - drawingStart.x, 2) +
        Math.pow(drawingPreview.y - drawingStart.y, 2)
      ) <= closeThreshold

    return (
      <Group>
        {/* Preview line - solid color (dashed for dividers) */}
        <Line
          points={points}
          stroke={drawColor}
          strokeWidth={3 / zoom}
          lineCap="round"
          lineJoin="round"
          dash={isVirtual ? [8 / zoom, 6 / zoom] : undefined}
          listening={false}
        />

        {/* Close line preview (from last point back to first) - shown when 2+ points */}
        {committedPoints.length >= 2 && (
          <Line
            points={[
              committedPoints[committedPoints.length - 1].x * scale,
              committedPoints[committedPoints.length - 1].y * scale,
              drawingStart.x * scale,
              drawingStart.y * scale,
            ]}
            stroke={isNearFirstPoint ? closeColor : drawColor}
            strokeWidth={1.5 / zoom}
            dash={[6, 4]}
            opacity={0.6}
            listening={false}
          />
        )}

        {/* Committed corners - first point is green (close target) */}
        {committedPoints.map((point, i) => (
          <Circle
            key={i}
            x={point.x * scale}
            y={point.y * scale}
            radius={5 / zoom}
            fill={i === 0 ? closeColor : drawColor}
            stroke="#ffffff"
            strokeWidth={1.5 / zoom}
            listening={false}
          />
        ))}

        {/* Preview corner (current mouse position) */}
        {drawingPreview && (
          <Circle
            x={drawingPreview.x * scale}
            y={drawingPreview.y * scale}
            radius={4 / zoom}
            fill={isNearFirstPoint ? closeColor : drawColor}
            stroke="#ffffff"
            strokeWidth={1 / zoom}
            opacity={0.7}
            listening={false}
          />
        )}

        {/* Point count indicator */}
        {drawingPreview && (
          <Text
            x={drawingPreview.x * scale + 12 / zoom}
            y={drawingPreview.y * scale - 16 / zoom}
            text={isNearFirstPoint ? "Click to close" : (isVirtual ? `Divider: ${committedPoints.length} pts` : `${committedPoints.length} pts`)}
            fontSize={10 / zoom}
            fill={isNearFirstPoint ? closeColor : "#64748b"}
            fontStyle="bold"
            listening={false}
          />
        )}
      </Group>
    )
  }

  // Rectangle drawing preview - clean minimal style
  if (mode === "rectangle" && isDrawing && drawingStart && drawingPreview) {
    const x1 = Math.min(drawingStart.x, drawingPreview.x) * scale
    const y1 = Math.min(drawingStart.y, drawingPreview.y) * scale
    const width = Math.abs(drawingPreview.x - drawingStart.x) * scale
    const height = Math.abs(drawingPreview.y - drawingStart.y) * scale

    // Calculate dimensions in feet for labels
    const widthFeet = Math.abs(drawingPreview.x - drawingStart.x)
    const heightFeet = Math.abs(drawingPreview.y - drawingStart.y)
    const areaFeet = widthFeet * heightFeet

    return (
      <Group>
        {/* Preview rectangle - subtle fill */}
        <Rect
          x={x1}
          y={y1}
          width={width}
          height={height}
          fill="rgba(59, 130, 246, 0.08)"
          listening={false}
        />
        {/* Preview rectangle - thin solid border */}
        <Rect
          x={x1}
          y={y1}
          width={width}
          height={height}
          stroke="#3b82f6"
          strokeWidth={2 / zoom}
          listening={false}
        />

        {/* Dimension labels - only show if rectangle has some size */}
        {widthFeet > 0.5 && heightFeet > 0.5 && (
          <>
            {/* Width label (top) */}
            <Text
              x={x1 + width / 2}
              y={y1 - 18 / zoom}
              text={formatFeetInches(widthFeet)}
              fontSize={11 / zoom}
              fill="#3b82f6"
              fontStyle="bold"
              align="center"
              offsetX={25 / zoom}
              listening={false}
            />

            {/* Height label (left) */}
            <Text
              x={x1 - 45 / zoom}
              y={y1 + height / 2 - 5 / zoom}
              text={formatFeetInches(heightFeet)}
              fontSize={11 / zoom}
              fill="#3b82f6"
              fontStyle="bold"
              listening={false}
            />

            {/* Area label (center) */}
            <Text
              x={x1 + width / 2}
              y={y1 + height / 2 - 5 / zoom}
              text={`${Math.round(areaFeet)} sq ft`}
              fontSize={11 / zoom}
              fill="#64748b"
              fontStyle="bold"
              align="center"
              offsetX={25 / zoom}
              listening={false}
            />
          </>
        )}

        {/* Corner markers - small and subtle */}
        {[
          { x: x1, y: y1 },
          { x: x1 + width, y: y1 },
          { x: x1 + width, y: y1 + height },
          { x: x1, y: y1 + height },
        ].map((point, i) => (
          <Circle
            key={i}
            x={point.x}
            y={point.y}
            radius={5 / zoom}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={1.5 / zoom}
            listening={false}
          />
        ))}
      </Group>
    )
  }

  // Placement preview (door/window/furniture) - thin architectural style
  if (placementPreview && placementType) {
    const x = placementPreview.x * scale
    const y = placementPreview.y * scale

    if (mode === "furniture") {
      const dims = FURNITURE_DIMENSIONS[placementType]
      if (dims) {
        const width = dims.width * scale
        const depth = dims.depth * scale

        return (
          <Group x={x} y={y}>
            {/* Furniture outline - clean minimal style */}
            <Rect
              x={-width / 2}
              y={-depth / 2}
              width={width}
              height={depth}
              fill="rgba(100, 116, 139, 0.15)"
              stroke="#64748b"
              strokeWidth={1.5 / zoom}
              dash={[4, 4]}
              cornerRadius={2 / zoom}
              listening={false}
            />
            {/* Direction indicator */}
            <Line
              points={[-width / 4, -depth / 2, width / 4, -depth / 2]}
              stroke="#64748b"
              strokeWidth={2 / zoom}
              lineCap="round"
              dash={[4, 4]}
              listening={false}
            />
          </Group>
        )
      }
    }

    if (mode === "door") {
      const width = DIMENSIONS.DOOR_WIDTH_SINGLE * scale
      const swingRadius = width // Door swing radius same as width
      const onWall = placementPreviewWallId !== null
      const strokeColor = onWall ? "#f59e0b" : "#94a3b8"
      const fillColor = onWall ? "rgba(245, 158, 11, 0.2)" : "rgba(148, 163, 184, 0.2)"

      // Get orientation from preview state (cycles with R key)
      const { hingeRight, swingUp } = getDoorOrientation(placementPreviewOrientation)
      const hingeX = hingeRight ? width / 2 : -width / 2
      const swingY = swingUp ? -swingRadius : swingRadius
      // Arc rotation based on quadrant:
      // case 0 (left, down): 0° - sweeps right to down
      // case 1 (right, down): 90° - sweeps down to left
      // case 2 (right, up): 180° - sweeps left to up
      // case 3 (left, up): -90° - sweeps up to right
      const arcRotation = swingUp
        ? (hingeRight ? 180 : -90)
        : (hingeRight ? 90 : 0)

      return (
        <Group x={x} y={y} rotation={placementPreviewAngle}>
          {/* Door opening in wall - white gap */}
          <Line
            points={[-width / 2, 0, width / 2, 0]}
            stroke="#ffffff"
            strokeWidth={6 / zoom}
            listening={false}
          />
          {/* Door panel line - from hinge to swing end */}
          <Line
            points={[hingeX, 0, hingeX, swingY]}
            stroke={strokeColor}
            strokeWidth={2 / zoom}
            lineCap="round"
            dash={[4, 4]}
            listening={false}
          />
          {/* Door swing arc - quarter circle */}
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
            dash={[3, 3]}
            listening={false}
          />
          {/* Hinge point */}
          <Circle
            x={hingeX}
            y={0}
            radius={3 / zoom}
            fill={strokeColor}
            stroke="#ffffff"
            strokeWidth={1 / zoom}
            listening={false}
          />
          {/* Orientation indicator */}
          {onWall && (
            <Text
              x={-width / 2}
              y={swingUp ? -swingRadius - 16 / zoom : swingRadius + 8 / zoom}
              width={width}
              text={`R to rotate (${placementPreviewOrientation + 1}/4)`}
              fontSize={8 / zoom}
              fill="#64748b"
              align="center"
              listening={false}
            />
          )}
          {/* "No wall" indicator when not on a wall */}
          {!onWall && (
            <Text
              x={-width / 2}
              y={swingRadius + 8 / zoom}
              width={width}
              text="Move to wall"
              fontSize={9 / zoom}
              fill="#94a3b8"
              align="center"
              listening={false}
            />
          )}
        </Group>
      )
    }

    if (mode === "window") {
      const width = DIMENSIONS.WINDOW_WIDTH * scale
      const frameDepth = 4 / zoom
      const onWall = placementPreviewWallId !== null
      const strokeColor = onWall ? "#3b82f6" : "#94a3b8"
      const fillColor = onWall ? "rgba(147, 197, 253, 0.3)" : "rgba(148, 163, 184, 0.2)"

      return (
        <Group x={x} y={y} rotation={placementPreviewAngle}>
          {/* Window frame - thin rectangle */}
          <Rect
            x={-width / 2}
            y={-frameDepth / 2}
            width={width}
            height={frameDepth}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={1.5 / zoom}
            dash={[4, 4]}
            listening={false}
          />
          {/* Center mullion */}
          <Line
            points={[0, -frameDepth / 2, 0, frameDepth / 2]}
            stroke={strokeColor}
            strokeWidth={1 / zoom}
            dash={[2, 2]}
            listening={false}
          />
          {/* End markers */}
          <Line
            points={[-width / 2, -frameDepth, -width / 2, frameDepth]}
            stroke={strokeColor}
            strokeWidth={1.5 / zoom}
            lineCap="round"
            dash={[3, 3]}
            listening={false}
          />
          <Line
            points={[width / 2, -frameDepth, width / 2, frameDepth]}
            stroke={strokeColor}
            strokeWidth={1.5 / zoom}
            lineCap="round"
            dash={[3, 3]}
            listening={false}
          />
          {/* "No wall" indicator when not on a wall */}
          {!onWall && (
            <Text
              x={-width / 2}
              y={frameDepth + 8 / zoom}
              width={width}
              text="Move to wall"
              fontSize={9 / zoom}
              fill="#94a3b8"
              align="center"
              listening={false}
            />
          )}
        </Group>
      )
    }
  }

  return null
}
