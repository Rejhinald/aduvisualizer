/**
 * Constants for 3D Floor Plan Viewer
 */

import type { VibePalette, FurnitureType } from "./types"
import type { VibeOption } from "@/lib/api/client"

// Standard architectural dimensions (in feet)
export const DIMENSIONS = {
  CEILING_HEIGHT: 8.33, // 100 inches (8'4")
  DOOR_HEIGHT: 6.67, // 80 inches (6'8")
  WINDOW_SILL_HEIGHT: 3.0, // 36 inches
  WINDOW_DEFAULT_HEIGHT: 4.0, // 48 inches
  WALL_THICKNESS: 0.5, // 6 inches
  FLOOR_THICKNESS: 0.1, // 1.2 inches
  DOOR_FRAME_WIDTH: 0.25, // 3 inches
  DOOR_PANEL_THICKNESS: 0.125, // 1.5 inches
  WINDOW_FRAME_WIDTH: 0.2, // 2.4 inches
} as const

// Camera settings
export const CAMERA = {
  TOP_DOWN_HEIGHT: 50, // feet above ground
  TOP_DOWN_ZOOM: 10,
  FIRST_PERSON_NEAR: 0.1,
  FIRST_PERSON_FAR: 1000,
  MOVE_SPEED: 10, // feet per second
  DEFAULT_EYE_HEIGHT: 5.5, // feet
  DEFAULT_FOV: 60,
} as const

// Vibe color palettes for materials
export const VIBE_PALETTES: Record<VibeOption, VibePalette> = {
  modern_minimal: {
    wall: "#FFFFFF",
    floor: "#E8E4E1", // Light beige wood
    ceiling: "#FFFFFF",
    trim: "#1A1A1A", // Black trim
    accent: "#808080",
    roughness: 0.7,
    metalness: 0.0,
  },
  scandinavian: {
    wall: "#FAFAF8", // Warm white
    floor: "#D4C4B0", // Light oak
    ceiling: "#FFFFFF",
    trim: "#FFFFFF",
    accent: "#A3C1AD", // Sage green
    roughness: 0.8,
    metalness: 0.0,
  },
  industrial: {
    wall: "#9E9E9E", // Concrete gray
    floor: "#3E3E3E", // Dark concrete
    ceiling: "#2C2C2C", // Exposed dark
    trim: "#1A1A1A",
    accent: "#8B4513", // Rust
    roughness: 0.9,
    metalness: 0.2,
  },
  bohemian: {
    wall: "#F5E6D3", // Warm cream
    floor: "#C9A876", // Warm wood
    ceiling: "#FEFEFE",
    trim: "#6B4423", // Dark wood
    accent: "#D17A47", // Terracotta
    roughness: 0.85,
    metalness: 0.0,
  },
  midcentury: {
    wall: "#F0EBE3", // Off-white
    floor: "#5D4037", // Walnut
    ceiling: "#FFFFFF",
    trim: "#5D4037",
    accent: "#FF6B35", // Orange
    roughness: 0.6,
    metalness: 0.1,
  },
  coastal: {
    wall: "#FFFFFF",
    floor: "#DED7CB", // Bleached wood
    ceiling: "#FFFFFF",
    trim: "#FFFFFF",
    accent: "#4A90A4", // Ocean blue
    roughness: 0.75,
    metalness: 0.0,
  },
  farmhouse: {
    wall: "#FAF9F6", // Cream white
    floor: "#A68B5B", // Honey wood
    ceiling: "#FFFFFF",
    trim: "#FFFFFF",
    accent: "#2F4538", // Sage
    roughness: 0.85,
    metalness: 0.0,
  },
  luxury: {
    wall: "#1A1A1A", // Deep charcoal
    floor: "#2C2C2C", // Dark marble look
    ceiling: "#0D0D0D",
    trim: "#D4AF37", // Gold
    accent: "#D4AF37",
    roughness: 0.3,
    metalness: 0.4,
  },
}

// Default vibe for rooms without finish selection
export const DEFAULT_VIBE: VibeOption = "modern_minimal"

// Furniture 3D heights and colors
export const FURNITURE_3D: Record<
  FurnitureType,
  { height: number; color: string }
> = {
  "bed-double": { height: 2.0, color: "#D4C4B0" },
  "bed-single": { height: 2.0, color: "#D4C4B0" },
  "sofa-3seat": { height: 2.5, color: "#808080" },
  "sofa-2seat": { height: 2.5, color: "#808080" },
  armchair: { height: 2.5, color: "#808080" },
  "table-dining": { height: 2.5, color: "#8B4513" },
  "table-coffee": { height: 1.5, color: "#8B4513" },
  toilet: { height: 2.0, color: "#FFFFFF" },
  sink: { height: 3.0, color: "#FFFFFF" },
  shower: { height: 7.0, color: "#E0E0E0" },
  bathtub: { height: 2.0, color: "#FFFFFF" },
  stove: { height: 3.0, color: "#333333" },
  refrigerator: { height: 6.0, color: "#C0C0C0" },
  dishwasher: { height: 3.0, color: "#C0C0C0" },
  desk: { height: 2.5, color: "#A0522D" },
  chair: { height: 3.0, color: "#666666" },
}

// Door type configurations
export const DOOR_TYPES: Record<
  string,
  { panelCount: number; hasGlass: boolean; swingAngle: number }
> = {
  single: { panelCount: 1, hasGlass: false, swingAngle: 90 },
  double: { panelCount: 2, hasGlass: false, swingAngle: 90 },
  sliding: { panelCount: 2, hasGlass: true, swingAngle: 0 },
  french: { panelCount: 2, hasGlass: true, swingAngle: 90 },
  opening: { panelCount: 0, hasGlass: false, swingAngle: 0 },
}

// Window type configurations
export const WINDOW_TYPES: Record<string, { hasFrame: boolean }> = {
  standard: { hasFrame: true },
  bay: { hasFrame: true },
  picture: { hasFrame: true },
  sliding: { hasFrame: true },
}

// Tier quality modifiers (affects material properties)
export const TIER_MODIFIERS: Record<string, { roughnessMultiplier: number; metalnessMultiplier: number }> = {
  budget: { roughnessMultiplier: 1.1, metalnessMultiplier: 0.8 },
  standard: { roughnessMultiplier: 1.0, metalnessMultiplier: 1.0 },
  premium: { roughnessMultiplier: 0.9, metalnessMultiplier: 1.2 },
}
