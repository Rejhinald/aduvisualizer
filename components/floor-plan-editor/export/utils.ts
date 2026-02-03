/**
 * Export Utility Functions
 */

import type Konva from "konva"
import type {
  ExportSettings,
  BlueprintExportData,
  RoomScheduleItem,
  DoorScheduleItem,
  WindowScheduleItem,
  FurnitureScheduleItem,
} from "./types"
import type { Room, Door, Window } from "@/lib/types"
import type { Furniture, CanvasConfig } from "../types"
import type { Lot } from "@/lib/api/client"
import {
  ROOM_TYPE_LABELS,
  DOOR_TYPE_LABELS,
  WINDOW_TYPE_LABELS,
  FURNITURE_TYPE_LABELS,
} from "./constants"

/**
 * Calculate polygon area using the Shoelace formula
 */
export function calculatePolygonArea(
  vertices: Array<{ x: number; y: number }>
): number {
  if (vertices.length < 3) return 0

  let area = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    area += vertices[i].x * vertices[j].y
    area -= vertices[j].x * vertices[i].y
  }

  return Math.abs(area / 2)
}

/**
 * Convert canvas pixels to square feet
 */
export function pixelsToSqFeet(pixels: number, pixelsPerFoot: number): number {
  return pixels / (pixelsPerFoot * pixelsPerFoot)
}

/**
 * Convert rooms to export schedule format
 */
export function roomsToSchedule(
  rooms: Room[],
  pixelsPerFoot: number
): RoomScheduleItem[] {
  return rooms.map((room) => {
    // Calculate area from vertices
    const areaPixels = calculatePolygonArea(room.vertices)
    const areaSqFt = pixelsToSqFeet(areaPixels, pixelsPerFoot)

    return {
      id: room.id,
      name: room.name,
      type: room.type,
      area: Math.round(areaSqFt * 100) / 100,
      vertices: room.vertices,
    }
  })
}

/**
 * Convert doors to export schedule format
 */
export function doorsToSchedule(
  doors: Door[],
  pixelsPerFoot: number
): DoorScheduleItem[] {
  return doors.map((door) => ({
    id: door.id,
    type: door.type,
    position: { x: door.position.x, y: door.position.y },
    rotation: door.rotation,
    width: door.width / pixelsPerFoot,
  }))
}

/**
 * Convert windows to export schedule format
 */
export function windowsToSchedule(
  windows: Window[],
  pixelsPerFoot: number
): WindowScheduleItem[] {
  return windows.map((window) => ({
    id: window.id,
    type: window.type,
    position: { x: window.position.x, y: window.position.y },
    rotation: window.rotation,
    width: window.width / pixelsPerFoot,
    height: window.height / pixelsPerFoot,
  }))
}

/**
 * Convert furniture to export schedule format
 */
export function furnitureToSchedule(
  furniture: Furniture[],
  pixelsPerFoot: number
): FurnitureScheduleItem[] {
  return furniture.map((f) => ({
    id: f.id,
    type: f.type,
    position: { x: f.position.x, y: f.position.y },
    rotation: f.rotation,
    width: f.width,
    height: f.height,
  }))
}

/**
 * Build complete blueprint export data from editor state
 */
export function buildExportData(
  rooms: Room[],
  doors: Door[],
  windows: Window[],
  furniture: Furniture[],
  aduBoundary: Array<{ x: number; y: number }>,
  config: CanvasConfig,
  lot?: Lot | null
): BlueprintExportData {
  const roomSchedule = roomsToSchedule(rooms, config.pixelsPerFoot)
  const doorSchedule = doorsToSchedule(doors, config.pixelsPerFoot)
  const windowSchedule = windowsToSchedule(windows, config.pixelsPerFoot)
  const furnitureSchedule = furnitureToSchedule(furniture, config.pixelsPerFoot)

  // Calculate total room area
  const totalArea = roomSchedule.reduce((sum, room) => sum + room.area, 0)

  // Calculate ADU boundary area
  const aduAreaPixels = calculatePolygonArea(aduBoundary)
  const aduBoundaryArea = pixelsToSqFeet(aduAreaPixels, config.pixelsPerFoot)

  // Build lot data if available
  const lotData = lot
    ? {
        address: lot.address || "",
        dimensions: lot.lotWidthFeet && lot.lotDepthFeet
          ? `${lot.lotWidthFeet}' × ${lot.lotDepthFeet}'`
          : "N/A",
        area: lot.lotAreaSqFt || 0,
        setbacks: `F: ${lot.setbackFrontFeet}' | B: ${lot.setbackBackFeet}' | L: ${lot.setbackLeftFeet}' | R: ${lot.setbackRightFeet}'`,
      }
    : undefined

  return {
    rooms: roomSchedule,
    doors: doorSchedule,
    windows: windowSchedule,
    furniture: furnitureSchedule,
    aduBoundary,
    totalArea: Math.round(totalArea * 100) / 100,
    aduBoundaryArea: Math.round(aduBoundaryArea * 100) / 100,
    lotData,
  }
}

/**
 * Capture canvas as base64 image
 */
export function captureCanvasImage(
  stageRef: React.RefObject<Konva.Stage | null>,
  dpi: number = 300
): string | null {
  const stage = stageRef.current
  if (!stage) return null

  // pixelRatio for DPI: 300 DPI / 72 base DPI = ~4.17
  const pixelRatio = dpi / 72

  const dataUrl = stage.toDataURL({
    pixelRatio,
    mimeType: "image/png",
  })

  return dataUrl
}

/**
 * Export as PNG (client-side)
 */
export function exportPNG(
  stageRef: React.RefObject<Konva.Stage | null>,
  settings: ExportSettings
): void {
  const dataUrl = captureCanvasImage(stageRef, settings.dpi)
  if (!dataUrl) return

  const link = document.createElement("a")
  link.download = `${sanitizeFilename(settings.projectName)}_FloorPlan.png`
  link.href = dataUrl
  link.click()
}

/**
 * Export as JSON (client-side)
 */
export function exportJSON(
  data: BlueprintExportData,
  settings: ExportSettings
): void {
  const exportData = {
    projectName: settings.projectName,
    exportDate: new Date().toISOString(),
    units: "feet",
    totalArea: data.totalArea,
    aduBoundaryArea: data.aduBoundaryArea,
    rooms: data.rooms.map((room) => ({
      ...room,
      typeLabel: ROOM_TYPE_LABELS[room.type] || room.type,
    })),
    doors: data.doors.map((door) => ({
      ...door,
      typeLabel: DOOR_TYPE_LABELS[door.type] || door.type,
    })),
    windows: data.windows.map((window) => ({
      ...window,
      typeLabel: WINDOW_TYPE_LABELS[window.type] || window.type,
    })),
    furniture: data.furniture.map((f) => ({
      ...f,
      typeLabel: FURNITURE_TYPE_LABELS[f.type] || f.type,
    })),
    aduBoundary: data.aduBoundary,
    lot: data.lotData,
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.download = `${sanitizeFilename(settings.projectName)}_Data.json`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Sanitize filename by removing special characters
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 100)
}

/**
 * Format area with units
 */
export function formatArea(sqFt: number): string {
  return `${sqFt.toFixed(1)} SF`
}

/**
 * Format dimensions in feet and inches
 */
export function formatFeetInches(feet: number): string {
  const wholeFeet = Math.floor(feet)
  const inches = Math.round((feet - wholeFeet) * 12)
  if (inches === 0) {
    return `${wholeFeet}'-0"`
  }
  return `${wholeFeet}'-${inches}"`
}

/**
 * Aggregate items by type for schedule tables
 */
export function aggregateByType<T extends { type: string }>(
  items: T[]
): Record<string, { count: number; items: T[] }> {
  return items.reduce(
    (acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = { count: 0, items: [] }
      }
      acc[item.type].count++
      acc[item.type].items.push(item)
      return acc
    },
    {} as Record<string, { count: number; items: T[] }>
  )
}
