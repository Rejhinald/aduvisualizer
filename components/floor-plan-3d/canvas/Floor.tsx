"use client"

/**
 * Floor rendering component - Simplified for debugging
 * Renders floor planes for each room based on bounding box
 */

import { useMemo } from "react"
import * as THREE from "three"
import type { Room3D } from "../types"
import { createRoomMaterials } from "../materials"
import { DIMENSIONS } from "../constants"

interface FloorProps {
  rooms: Room3D[]
}

export function Floor({ rooms }: FloorProps) {
  // Debug log
  console.log("Floor component rendering", rooms.length, "rooms")
  if (rooms.length > 0) {
    console.log("First room bounding box:", rooms[0].boundingBox)
    console.log("First room vertices:", rooms[0].vertices)
  }

  return (
    <group name="floors">
      {rooms.map((room) => (
        <RoomFloor key={room.id} room={room} />
      ))}
    </group>
  )
}

function RoomFloor({ room }: { room: Room3D }) {
  // Use bounding box for simple rectangle floor (for debugging)
  const { minX, maxX, minZ, maxZ, width, depth } = room.boundingBox
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2

  // Create material based on room vibe
  const material = useMemo(() => {
    const materials = createRoomMaterials(room.vibe, room.tier)
    return materials.floor
  }, [room.vibe, room.tier])

  // Skip if invalid dimensions
  if (width < 0.1 || depth < 0.1) {
    console.warn("Room has invalid dimensions:", room.id, room.boundingBox)
    return null
  }

  console.log(`Floor ${room.name}: center=(${centerX.toFixed(2)}, ${centerZ.toFixed(2)}), size=(${width.toFixed(2)} x ${depth.toFixed(2)})`)

  return (
    <mesh
      position={[centerX, DIMENSIONS.FLOOR_THICKNESS / 2, centerZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
      receiveShadow
      name={`floor-${room.id}`}
    >
      <planeGeometry args={[width, depth]} />
    </mesh>
  )
}

/**
 * Polygon-based floor (more accurate but complex)
 * Use this after coordinate system is verified
 */
export function PolygonFloor({ room }: { room: Room3D }) {
  const geometry = useMemo(() => {
    if (room.vertices.length < 3) return null

    // Create a shape from the room vertices
    const shape = new THREE.Shape()
    // Shape uses X, Y coordinates. We'll rotate the mesh to make it horizontal.
    // In the shape, X = Three.js X, Y = -Three.js Z (so positive Y in shape = negative Z in world)
    shape.moveTo(room.vertices[0].x, -room.vertices[0].z)

    for (let i = 1; i < room.vertices.length; i++) {
      shape.lineTo(room.vertices[i].x, -room.vertices[i].z)
    }
    shape.closePath()

    // Create geometry from shape
    const geo = new THREE.ShapeGeometry(shape)

    // Rotate to lie flat on the XZ plane (shape is in XY, we want XZ)
    geo.rotateX(-Math.PI / 2)

    return geo
  }, [room.vertices])

  const material = useMemo(() => {
    const materials = createRoomMaterials(room.vibe, room.tier)
    return materials.floor
  }, [room.vibe, room.tier])

  if (!geometry) return null

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, DIMENSIONS.FLOOR_THICKNESS / 2, 0]}
      receiveShadow
      name={`floor-${room.id}`}
    />
  )
}
