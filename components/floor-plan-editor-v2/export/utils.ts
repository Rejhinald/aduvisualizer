/**
 * Export Utility Functions for V2 Floor Plan Editor
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
import type { EditorState, CanvasConfig } from "../types"
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
 * Build complete blueprint export data from editor state
 */
export function buildExportData(
  state: EditorState,
  config: CanvasConfig
): BlueprintExportData {
  // Room uses corners array, convert to vertices for export
  const rooms: RoomScheduleItem[] = state.rooms.map((room) => ({
    id: room.id,
    name: room.name || room.type,
    type: room.type,
    area: room.area,
    vertices: room.corners.map((c) => ({
      x: c.x,
      y: c.y,
    })),
  }))

  const doors: DoorScheduleItem[] = state.doors.map((door) => ({
    id: door.id,
    type: door.type,
    wallId: door.wallId,
    position: door.position,
    width: door.width,
    height: door.height,
  }))

  const windows: WindowScheduleItem[] = state.windows.map((window) => ({
    id: window.id,
    type: window.type,
    wallId: window.wallId,
    position: window.position,
    width: window.width,
    height: window.height,
    sillHeight: window.sillHeight,
  }))

  const furniture: FurnitureScheduleItem[] = state.furniture.map((f) => ({
    id: f.id,
    type: f.type,
    x: f.x,
    y: f.y,
    rotation: f.rotation,
    width: f.width,
    depth: f.depth,
  }))

  const totalArea = rooms.reduce((sum, room) => sum + room.area, 0)

  // Lot uses setbacks object
  const lotData = state.lot
    ? {
        address: state.lot.address || "",
        dimensions: "N/A",  // Lot boundary-based, no fixed dimensions
        area: 0,  // Could calculate from boundary if needed
        setbacks: `F: ${state.lot.setbacks.front}' | B: ${state.lot.setbacks.back}' | L: ${state.lot.setbacks.left}' | R: ${state.lot.setbacks.right}'`,
      }
    : undefined

  return {
    rooms,
    doors,
    windows,
    furniture,
    totalArea: Math.round(totalArea * 100) / 100,
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
