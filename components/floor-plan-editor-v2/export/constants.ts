/**
 * Export Constants for V2 Floor Plan Editor
 */

import type { SheetSize, Scale, ExportSettings } from "./types"

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
    inchesPerFoot: 0,
    description: "Automatically scale to fit drawing",
  },
]

export const DPI_OPTIONS = [
  { value: 150, label: "150 DPI", description: "Draft quality" },
  { value: 300, label: "300 DPI", description: "Print quality (recommended)" },
  { value: 600, label: "600 DPI", description: "High resolution" },
]

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

export const DOOR_TYPE_LABELS: Record<string, string> = {
  single: "Single Door",
  double: "Double Door",
  sliding: "Sliding Door",
  french: "French Door",
  pocket: "Pocket Door",
  barn: "Barn Door",
}

export const WINDOW_TYPE_LABELS: Record<string, string> = {
  standard: "Standard Window",
  bay: "Bay Window",
  picture: "Picture Window",
  sliding: "Sliding Window",
  casement: "Casement Window",
  awning: "Awning Window",
}

export const FURNITURE_TYPE_LABELS: Record<string, string> = {
  bed_king: "King Bed",
  bed_queen: "Queen Bed",
  bed_twin: "Twin Bed",
  sofa_3seat: "3-Seat Sofa",
  sofa_2seat: "2-Seat Sofa",
  armchair: "Armchair",
  dining_table: "Dining Table",
  coffee_table: "Coffee Table",
  desk: "Desk",
  office_chair: "Office Chair",
  toilet: "Toilet",
  sink: "Sink",
  shower: "Shower",
  bathtub: "Bathtub",
  stove: "Stove",
  refrigerator: "Refrigerator",
  dishwasher: "Dishwasher",
  washer: "Washer",
  dryer: "Dryer",
  tv_stand: "TV Stand",
}
