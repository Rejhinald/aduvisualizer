/**
 * Export Constants
 *
 * Architectural sheet sizes and scales based on California ADU permit requirements.
 * ARCH D (24"x36") is the minimum for LA County permit drawings.
 */

import type { SheetSize, Scale, ExportSettings } from "./types"

/**
 * Sheet size configurations
 * Dimensions in inches, margins in inches
 */
export interface SheetConfig {
  name: string
  label: string
  widthInches: number
  heightInches: number
  marginInches: number
  titleBlockHeight: number
  description: string
}

export const SHEET_CONFIGS: Record<SheetSize, SheetConfig> = {
  ARCH_D: {
    name: "ARCH D",
    label: 'ARCH D (24" × 36")',
    widthInches: 36,
    heightInches: 24,
    marginInches: 0.5,
    titleBlockHeight: 2.5,
    description: "Standard permit drawings - Required for LA County ADU permits",
  },
  ARCH_C: {
    name: "ARCH C",
    label: 'ARCH C (18" × 24")',
    widthInches: 24,
    heightInches: 18,
    marginInches: 0.5,
    titleBlockHeight: 2,
    description: "Medium format - Good for presentations",
  },
  LETTER: {
    name: "Letter",
    label: 'Letter (8.5" × 11")',
    widthInches: 11,
    heightInches: 8.5,
    marginInches: 0.5,
    titleBlockHeight: 1.5,
    description: "Standard paper - For personal reference",
  },
  A4: {
    name: "A4",
    label: "A4 (210mm × 297mm)",
    widthInches: 11.69,
    heightInches: 8.27,
    marginInches: 0.5,
    titleBlockHeight: 1.5,
    description: "International standard",
  },
}

/**
 * Scale options for architectural drawings
 * Format: scale value = drawing inches per real foot
 */
export interface ScaleConfig {
  value: Scale
  label: string
  inchesPerFoot: number
  description: string
}

export const SCALE_OPTIONS: ScaleConfig[] = [
  {
    value: "1/4",
    label: '1/4" = 1\'-0"',
    inchesPerFoot: 0.25,
    description: "Standard residential scale",
  },
  {
    value: "1/8",
    label: '1/8" = 1\'-0"',
    inchesPerFoot: 0.125,
    description: "For larger floor plans",
  },
  {
    value: "3/16",
    label: '3/16" = 1\'-0"',
    inchesPerFoot: 0.1875,
    description: "Intermediate scale",
  },
  {
    value: "1/16",
    label: '1/16" = 1\'-0"',
    inchesPerFoot: 0.0625,
    description: "For site plans",
  },
  {
    value: "auto",
    label: "Auto (fit to sheet)",
    inchesPerFoot: 0, // Calculated based on content
    description: "Automatically scale to fit drawing",
  },
]

/**
 * DPI options
 */
export const DPI_OPTIONS = [
  { value: 150, label: "150 DPI", description: "Draft quality" },
  { value: 300, label: "300 DPI", description: "Print quality (recommended)" },
  { value: 600, label: "600 DPI", description: "High resolution" },
]

/**
 * Default export settings
 */
export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: "pdf",
  sheetSize: "ARCH_D",
  scale: "1/4",
  dpi: 300,
  includeSchedules: true,
  includeDimensions: true,
  includeNorthArrow: true,
  includeLegend: true,
  includeTitleBlock: true,
  includeLotOverlay: false,
  includeSatellite: false,
  projectName: "ADU Floor Plan",
  preparedBy: "",
  address: "",
}

/**
 * Room type labels for schedules
 */
export const ROOM_TYPE_LABELS: Record<string, string> = {
  bedroom: "Bedroom",
  bathroom: "Full Bath",
  half_bath: "Half Bath",
  kitchen: "Kitchen",
  living: "Living Room",
  dining: "Dining",
  closet: "Closet",
  laundry: "Laundry",
  storage: "Storage",
  utility: "Utility",
  entry: "Entry",
  corridor: "Corridor",
  flex: "Flex Space",
  other: "Other",
}

/**
 * Door type labels for schedules
 */
export const DOOR_TYPE_LABELS: Record<string, string> = {
  single: "Single Door",
  double: "Double Door",
  sliding: "Sliding Door",
  french: "French Door",
  open_passage: "Opening",
  opening: "Opening",
}

/**
 * Window type labels for schedules
 */
export const WINDOW_TYPE_LABELS: Record<string, string> = {
  standard: "Standard Window",
  bay: "Bay Window",
  picture: "Picture Window",
  sliding: "Sliding Window",
}

/**
 * Furniture category labels for schedules
 */
export const FURNITURE_TYPE_LABELS: Record<string, string> = {
  "bed-double": "Double Bed",
  "bed-single": "Single Bed",
  "sofa-3seat": "3-Seat Sofa",
  "sofa-2seat": "2-Seat Sofa",
  armchair: "Armchair",
  "table-dining": "Dining Table",
  "table-coffee": "Coffee Table",
  toilet: "Toilet",
  sink: "Sink",
  shower: "Shower",
  bathtub: "Bathtub",
  stove: "Stove",
  refrigerator: "Refrigerator",
  dishwasher: "Dishwasher",
  desk: "Desk",
  chair: "Chair",
}
