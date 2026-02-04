"use client"

/**
 * Door rendering component
 * Renders door frames and panels
 */

import { useMemo } from "react"
import * as THREE from "three"
import type { Door3D } from "../types"
import { createDoorMaterial, createDoorFrameMaterial } from "../materials"
import { DIMENSIONS, DOOR_TYPES } from "../constants"

interface DoorsProps {
  doors: Door3D[]
}

export function Doors({ doors }: DoorsProps) {
  return (
    <group name="doors">
      {doors.map((door) => (
        <DoorMesh key={door.id} door={door} />
      ))}
    </group>
  )
}

function DoorMesh({ door }: { door: Door3D }) {
  const doorConfig = DOOR_TYPES[door.type] || DOOR_TYPES.single
  const frameMaterial = useMemo(() => createDoorFrameMaterial(), [])
  const panelMaterial = useMemo(
    () => createDoorMaterial(doorConfig.hasGlass),
    [doorConfig.hasGlass]
  )

  // Door frame dimensions
  const frameWidth = DIMENSIONS.DOOR_FRAME_WIDTH
  const frameDepth = DIMENSIONS.WALL_THICKNESS + 0.1 // Slightly larger than wall

  // Calculate position - door should be at floor level
  const position = useMemo(
    () => new THREE.Vector3(door.position.x, 0, door.position.z),
    [door.position]
  )

  // Rotation based on wall angle
  const rotation = useMemo(
    () => new THREE.Euler(0, -door.wallAngle, 0),
    [door.wallAngle]
  )

  // For opening type, don't render anything (it's just a passage)
  if (door.type === "opening") {
    return null
  }

  return (
    <group position={position} rotation={rotation} name={`door-${door.id}`}>
      {/* Door Frame - Top */}
      <mesh
        position={[0, door.height + frameWidth / 2, 0]}
        material={frameMaterial}
        castShadow
      >
        <boxGeometry args={[door.width + frameWidth * 2, frameWidth, frameDepth]} />
      </mesh>

      {/* Door Frame - Left */}
      <mesh
        position={[-door.width / 2 - frameWidth / 2, door.height / 2, 0]}
        material={frameMaterial}
        castShadow
      >
        <boxGeometry args={[frameWidth, door.height, frameDepth]} />
      </mesh>

      {/* Door Frame - Right */}
      <mesh
        position={[door.width / 2 + frameWidth / 2, door.height / 2, 0]}
        material={frameMaterial}
        castShadow
      >
        <boxGeometry args={[frameWidth, door.height, frameDepth]} />
      </mesh>

      {/* Door Panels */}
      {doorConfig.panelCount > 0 && (
        <DoorPanels
          door={door}
          panelCount={doorConfig.panelCount}
          swingAngle={doorConfig.swingAngle}
          material={panelMaterial}
        />
      )}
    </group>
  )
}

interface DoorPanelsProps {
  door: Door3D
  panelCount: number
  swingAngle: number
  material: THREE.MeshStandardMaterial
}

function DoorPanels({ door, panelCount, swingAngle, material }: DoorPanelsProps) {
  const panelWidth = door.width / panelCount
  const panelHeight = door.height - 0.1 // Slightly smaller than opening
  const panelDepth = DIMENSIONS.DOOR_PANEL_THICKNESS

  // Show doors slightly open (at swing angle)
  const openAngle = (swingAngle * Math.PI) / 180 * 0.7 // 70% open

  if (panelCount === 1) {
    // Single door - hinged on left side
    return (
      <group position={[-panelWidth / 2, 0, 0]}>
        <mesh
          position={[panelWidth / 2, panelHeight / 2 + 0.05, panelWidth / 2 * Math.sin(openAngle)]}
          rotation={[0, openAngle, 0]}
          material={material}
          castShadow
        >
          <boxGeometry args={[panelWidth, panelHeight, panelDepth]} />
        </mesh>
      </group>
    )
  }

  if (panelCount === 2) {
    // Double door or French door - both panels swing outward
    return (
      <>
        {/* Left panel */}
        <group position={[-panelWidth / 2, 0, 0]}>
          <mesh
            position={[
              -panelWidth / 2 * Math.cos(openAngle) + panelWidth / 2,
              panelHeight / 2 + 0.05,
              -panelWidth / 2 * Math.sin(openAngle),
            ]}
            rotation={[0, -openAngle, 0]}
            material={material}
            castShadow
          >
            <boxGeometry args={[panelWidth - 0.05, panelHeight, panelDepth]} />
          </mesh>
        </group>

        {/* Right panel */}
        <group position={[panelWidth / 2, 0, 0]}>
          <mesh
            position={[
              panelWidth / 2 * Math.cos(openAngle) - panelWidth / 2,
              panelHeight / 2 + 0.05,
              -panelWidth / 2 * Math.sin(openAngle),
            ]}
            rotation={[0, openAngle, 0]}
            material={material}
            castShadow
          >
            <boxGeometry args={[panelWidth - 0.05, panelHeight, panelDepth]} />
          </mesh>
        </group>
      </>
    )
  }

  return null
}
