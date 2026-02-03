/**
 * Export Feature Types
 */

export type ExportFormat = "pdf" | "png" | "json"

export type SheetSize = "ARCH_D" | "ARCH_C" | "LETTER" | "A4"

export type Scale = "1/4" | "1/8" | "3/16" | "1/16" | "auto"

export interface ExportSettings {
  format: ExportFormat
  sheetSize: SheetSize
  scale: Scale
  dpi: number
  includeSchedules: boolean
  includeDimensions: boolean
  includeNorthArrow: boolean
  includeLegend: boolean
  includeTitleBlock: boolean
  includeLotOverlay: boolean
  includeSatellite: boolean
  projectName: string
  preparedBy: string
  address: string
}

export interface RoomScheduleItem {
  id: string
  name: string
  type: string
  area: number
  vertices: Array<{ x: number; y: number }>
}

export interface DoorScheduleItem {
  id: string
  type: string
  position: { x: number; y: number }
  rotation: number
  width: number
}

export interface WindowScheduleItem {
  id: string
  type: string
  position: { x: number; y: number }
  rotation: number
  width: number
  height: number
}

export interface FurnitureScheduleItem {
  id: string
  type: string
  position: { x: number; y: number }
  rotation: number
  width: number
  height: number
}

export interface LotScheduleData {
  address: string
  dimensions: string
  area: number
  setbacks: string
}

export interface BlueprintExportData {
  rooms: RoomScheduleItem[]
  doors: DoorScheduleItem[]
  windows: WindowScheduleItem[]
  furniture: FurnitureScheduleItem[]
  aduBoundary: Array<{ x: number; y: number }>
  totalArea: number
  aduBoundaryArea: number
  lotData?: LotScheduleData
}

export interface ExportRecord {
  id: string
  blueprintId: string
  format: ExportFormat
  fileName: string
  fileUrl: string | null
  fileSizeBytes: number | null
  settings: ExportSettings
  pageCount: number | null
  sheetSize: string | null
  scale: string | null
  createdAt: string
  expiresAt: string | null
  isDeleted: boolean
}
