"use client"

import { useMemo } from "react"
import { Group, Line, Text } from "react-konva"
import type { CanvasConfig } from "../types"
import { COLORS, PIXELS_PER_FOOT } from "../constants"

interface GridLayerProps {
  config: CanvasConfig
}

/**
 * Calculate adaptive grid sizes based on zoom level
 * Returns { major, minor, label } in feet
 */
function getAdaptiveGridSizes(zoom: number): { major: number; minor: number; label: number } {
  // Very zoomed out (big picture view)
  if (zoom < 0.3) {
    return { major: 10, minor: 5, label: 20 }
  }
  // Zoomed out (overview)
  if (zoom < 0.5) {
    return { major: 5, minor: 1, label: 10 }
  }
  // Slightly zoomed out
  if (zoom < 0.8) {
    return { major: 2, minor: 1, label: 5 }
  }
  // Normal view
  if (zoom < 1.5) {
    return { major: 1, minor: 0.5, label: 2 }
  }
  // Zoomed in
  if (zoom < 2.5) {
    return { major: 1, minor: 0.25, label: 1 }
  }
  // Very zoomed in (detail view)
  return { major: 0.5, minor: 0.125, label: 0.5 }
}

export function GridLayer({ config }: GridLayerProps) {
  const { zoom, panX, panY, viewportWidth, viewportHeight } = config

  // Get adaptive grid sizes based on zoom
  const gridSizes = useMemo(() => getAdaptiveGridSizes(zoom), [zoom])

  // Calculate visible area in feet
  const visibleBounds = useMemo(() => {
    const scale = zoom * PIXELS_PER_FOOT
    const minXFeet = (-panX) / scale
    const maxXFeet = (viewportWidth - panX) / scale
    const minYFeet = (-panY) / scale
    const maxYFeet = (viewportHeight - panY) / scale

    // Extend bounds for smooth scrolling
    const major = gridSizes.major
    return {
      minX: Math.floor(minXFeet / major) * major - major * 2,
      maxX: Math.ceil(maxXFeet / major) * major + major * 2,
      minY: Math.floor(minYFeet / major) * major - major * 2,
      maxY: Math.ceil(maxYFeet / major) * major + major * 2,
    }
  }, [zoom, panX, panY, viewportWidth, viewportHeight, gridSizes.major])

  // Generate grid lines
  const gridLines = useMemo(() => {
    const lines: Array<{
      key: string
      points: number[]
      stroke: string
      strokeWidth: number
    }> = []

    // Don't multiply by zoom - Stage handles scaling
    const scale = PIXELS_PER_FOOT
    const { major, minor } = gridSizes

    // Minor grid lines (adaptive)
    // Use a tolerance for floating point comparison
    const isMultipleOf = (value: number, base: number) => {
      const ratio = value / base
      return Math.abs(ratio - Math.round(ratio)) < 0.001
    }

    for (let x = visibleBounds.minX; x <= visibleBounds.maxX; x += minor) {
      if (!isMultipleOf(x, major)) {
        const px = x * scale
        lines.push({
          key: `minor-v-${x.toFixed(3)}`,
          points: [px, visibleBounds.minY * scale, px, visibleBounds.maxY * scale],
          stroke: COLORS.GRID_MINOR,
          strokeWidth: 0.5 / zoom,
        })
      }
    }

    for (let y = visibleBounds.minY; y <= visibleBounds.maxY; y += minor) {
      if (!isMultipleOf(y, major)) {
        const py = y * scale
        lines.push({
          key: `minor-h-${y.toFixed(3)}`,
          points: [visibleBounds.minX * scale, py, visibleBounds.maxX * scale, py],
          stroke: COLORS.GRID_MINOR,
          strokeWidth: 0.5 / zoom,
        })
      }
    }

    // Major grid lines (adaptive)
    for (let x = visibleBounds.minX; x <= visibleBounds.maxX; x += major) {
      const px = x * scale
      const isOrigin = Math.abs(x) < 0.001
      lines.push({
        key: `major-v-${x.toFixed(3)}`,
        points: [px, visibleBounds.minY * scale, px, visibleBounds.maxY * scale],
        stroke: isOrigin ? COLORS.GRID_ORIGIN : COLORS.GRID_MAJOR,
        strokeWidth: isOrigin ? 1.5 / zoom : 1 / zoom,
      })
    }

    for (let y = visibleBounds.minY; y <= visibleBounds.maxY; y += major) {
      const py = y * scale
      const isOrigin = Math.abs(y) < 0.001
      lines.push({
        key: `major-h-${y.toFixed(3)}`,
        points: [visibleBounds.minX * scale, py, visibleBounds.maxX * scale, py],
        stroke: isOrigin ? COLORS.GRID_ORIGIN : COLORS.GRID_MAJOR,
        strokeWidth: isOrigin ? 1.5 / zoom : 1 / zoom,
      })
    }

    return lines
  }, [visibleBounds, zoom, gridSizes])

  // Grid labels (feet) - adaptive intervals
  const gridLabels = useMemo(() => {
    const labels: Array<{
      key: string
      x: number
      y: number
      text: string
    }> = []

    // Don't multiply by zoom - Stage handles scaling
    const scale = PIXELS_PER_FOOT
    const labelInterval = gridSizes.label

    // Format label text (show decimal only if needed)
    const formatLabel = (value: number): string => {
      if (Number.isInteger(value)) {
        return `${value}'`
      }
      return `${value.toFixed(1)}'`
    }

    // X axis labels
    for (let x = visibleBounds.minX; x <= visibleBounds.maxX; x += labelInterval) {
      if (Math.abs(x) < 0.001) continue
      labels.push({
        key: `label-x-${x.toFixed(3)}`,
        x: x * scale,
        y: 5,
        text: formatLabel(x),
      })
    }

    // Y axis labels
    for (let y = visibleBounds.minY; y <= visibleBounds.maxY; y += labelInterval) {
      if (Math.abs(y) < 0.001) continue
      labels.push({
        key: `label-y-${y.toFixed(3)}`,
        x: 5,
        y: y * scale,
        text: formatLabel(y),
      })
    }

    return labels
  }, [visibleBounds, zoom, gridSizes.label])

  return (
    <Group>
      {/* Grid lines */}
      {gridLines.map(({ key, points, stroke, strokeWidth }) => (
        <Line
          key={key}
          points={points}
          stroke={stroke}
          strokeWidth={strokeWidth}
          listening={false}
        />
      ))}

      {/* Grid labels */}
      {gridLabels.map(({ key, x, y, text }) => (
        <Text
          key={key}
          x={x}
          y={y}
          text={text}
          fontSize={10 / zoom}
          fill="#94a3b8"
          listening={false}
        />
      ))}
    </Group>
  )
}
