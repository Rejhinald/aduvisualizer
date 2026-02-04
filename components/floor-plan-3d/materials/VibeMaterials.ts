/**
 * Material factory for creating Three.js materials from vibe selections
 */

import * as THREE from "three"
import type { VibeOption } from "@/lib/api/client"
import { VIBE_PALETTES, TIER_MODIFIERS, DEFAULT_VIBE } from "../constants"

export interface RoomMaterials {
  wall: THREE.MeshStandardMaterial
  floor: THREE.MeshStandardMaterial
  ceiling: THREE.MeshStandardMaterial
  trim: THREE.MeshStandardMaterial
}

/**
 * Create materials for a room based on vibe and tier
 */
export function createRoomMaterials(
  vibe: VibeOption = DEFAULT_VIBE,
  tier: string = "standard"
): RoomMaterials {
  const palette = VIBE_PALETTES[vibe] || VIBE_PALETTES[DEFAULT_VIBE]
  const tierMod = TIER_MODIFIERS[tier] || TIER_MODIFIERS.standard

  return {
    wall: new THREE.MeshStandardMaterial({
      color: palette.wall,
      roughness: Math.min(1, palette.roughness * tierMod.roughnessMultiplier),
      metalness: Math.min(1, palette.metalness * tierMod.metalnessMultiplier),
      side: THREE.DoubleSide,
    }),
    floor: new THREE.MeshStandardMaterial({
      color: palette.floor,
      roughness: Math.min(1, palette.roughness * tierMod.roughnessMultiplier),
      metalness: 0,
      side: THREE.FrontSide,
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: palette.ceiling,
      roughness: 0.9,
      metalness: 0,
      side: THREE.FrontSide,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: palette.trim,
      roughness: 0.6,
      metalness: vibe === "luxury" ? 0.3 : 0,
      side: THREE.DoubleSide,
    }),
  }
}

/**
 * Create a door material
 */
export function createDoorMaterial(hasGlass: boolean = false): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hasGlass ? "#FFFFFF" : "#8B5A2B", // Wood color for solid doors
    roughness: hasGlass ? 0.1 : 0.7,
    metalness: 0,
    transparent: hasGlass,
    opacity: hasGlass ? 0.3 : 1,
    side: THREE.DoubleSide,
  })
}

/**
 * Create a door frame material
 */
export function createDoorFrameMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: "#5D4037", // Dark wood
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
  })
}

/**
 * Create a window frame material
 */
export function createWindowFrameMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: "#FFFFFF",
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
  })
}

/**
 * Create a window glass material
 */
export function createWindowGlassMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: "#87CEEB", // Light blue tint
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    metalness: 0.9,
    side: THREE.DoubleSide,
  })
}

/**
 * Create a furniture material
 */
export function createFurnitureMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0,
    side: THREE.FrontSide,
  })
}

/**
 * Dispose of materials to free memory
 */
export function disposeMaterials(materials: RoomMaterials): void {
  materials.wall.dispose()
  materials.floor.dispose()
  materials.ceiling.dispose()
  materials.trim.dispose()
}
