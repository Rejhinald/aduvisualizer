"use client"

/**
 * Wall rendering component - Simplified for debugging
 * Renders walls as simple box geometries along room edges
 */

import { useMemo } from "react"
import * as THREE from "three"
import type { WallEdge, Room3D } from "../types"
import { createRoomMaterials } from "../materials"
import { DIMENSIONS, DEFAULT_VIBE } from "../constants"

interface WallsProps {
  wallEdges: WallEdge[]
  rooms: Room3D[]
}

export function Walls({ wallEdges, rooms }: WallsProps) {
  // Debug log
  console.log("Walls component rendering", wallEdges.length, "edges")
  if (wallEdges.length > 0) {
    console.log("First wall edge:", wallEdges[0])
  }

  // Create a map of room IDs to their materials
  const roomMaterialsMap = useMemo(() => {
    const map = new Map<string, THREE.MeshStandardMaterial>()
    for (const room of rooms) {
      const materials = createRoomMaterials(room.vibe, room.tier)
      map.set(room.id, materials.wall)
    }
    return map
  }, [rooms])

  return (
    <group name="walls">
      {wallEdges.map((edge) => (
        <SimpleWall
          key={edge.id}
          edge={edge}
          material={
            roomMaterialsMap.get(edge.roomIds[0]) ||
            createRoomMaterials(DEFAULT_VIBE, "standard").wall
          }
        />
      ))}
    </group>
  )
}

interface SimpleWallProps {
  edge: WallEdge
  material: THREE.MeshStandardMaterial
}

/**
 * Simple wall - just a box positioned along the edge
 */
function SimpleWall({ edge, material }: SimpleWallProps) {
  // Calculate wall center and rotation
  const midX = (edge.start.x + edge.end.x) / 2
  const midZ = (edge.start.z + edge.end.z) / 2

  // Calculate direction vector
  const dx = edge.end.x - edge.start.x
  const dz = edge.end.z - edge.start.z
  const length = Math.sqrt(dx * dx + dz * dz)

  // Skip very short edges
  if (length < 0.1) {
    console.warn("Skipping short edge:", edge.id, length)
    return null
  }

  // Angle from +X axis
  const angle = Math.atan2(dz, dx)

  console.log(`Wall ${edge.id.substring(0, 20)}...: start=(${edge.start.x.toFixed(1)}, ${edge.start.z.toFixed(1)}), end=(${edge.end.x.toFixed(1)}, ${edge.end.z.toFixed(1)}), length=${length.toFixed(1)}, angle=${(angle * 180 / Math.PI).toFixed(0)}°`)

  return (
    <mesh
      position={[midX, DIMENSIONS.CEILING_HEIGHT / 2, midZ]}
      rotation={[0, -angle, 0]}
      material={material}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length, DIMENSIONS.CEILING_HEIGHT, DIMENSIONS.WALL_THICKNESS]} />
    </mesh>
  )
}

/**
 * Wall with openings (use after basic rendering works)
 */
export function WallWithOpenings({ edge, material }: SimpleWallProps) {
  // Sort openings by position along the wall
  const sortedOpenings = useMemo(() => {
    return [...edge.openings].sort((a, b) => a.position - b.position)
  }, [edge.openings])

  // Calculate wall segments (solid parts between openings)
  const wallSegments = useMemo(() => {
    const segments: Array<{
      startPos: number
      length: number
      bottomHeight: number
      topHeight: number
    }> = []

    if (sortedOpenings.length === 0) {
      segments.push({
        startPos: 0,
        length: edge.length,
        bottomHeight: 0,
        topHeight: DIMENSIONS.CEILING_HEIGHT,
      })
      return segments
    }

    let currentPos = 0

    for (const opening of sortedOpenings) {
      const openingStart = opening.position - opening.width / 2
      const openingEnd = opening.position + opening.width / 2

      // Wall section before this opening
      if (openingStart > currentPos + 0.1) {
        segments.push({
          startPos: currentPos,
          length: openingStart - currentPos,
          bottomHeight: 0,
          topHeight: DIMENSIONS.CEILING_HEIGHT,
        })
      }

      // Wall section above the opening
      const openingTop = opening.bottomOffset + opening.height
      if (openingTop < DIMENSIONS.CEILING_HEIGHT - 0.1) {
        segments.push({
          startPos: openingStart,
          length: opening.width,
          bottomHeight: openingTop,
          topHeight: DIMENSIONS.CEILING_HEIGHT,
        })
      }

      // Wall section below windows
      if (opening.bottomOffset > 0.1) {
        segments.push({
          startPos: openingStart,
          length: opening.width,
          bottomHeight: 0,
          topHeight: opening.bottomOffset,
        })
      }

      currentPos = openingEnd
    }

    // Wall section after last opening
    if (currentPos < edge.length - 0.1) {
      segments.push({
        startPos: currentPos,
        length: edge.length - currentPos,
        bottomHeight: 0,
        topHeight: DIMENSIONS.CEILING_HEIGHT,
      })
    }

    return segments
  }, [edge, sortedOpenings])

  // Direction vector
  const dx = edge.end.x - edge.start.x
  const dz = edge.end.z - edge.start.z
  const edgeLength = Math.sqrt(dx * dx + dz * dz)

  if (edgeLength < 0.1) return null

  const dirX = dx / edgeLength
  const dirZ = dz / edgeLength
  const angle = Math.atan2(dz, dx)

  return (
    <group name={`wall-${edge.id}`}>
      {wallSegments.map((segment, index) => {
        const height = segment.topHeight - segment.bottomHeight
        if (segment.length < 0.1 || height < 0.1) return null

        const segmentCenter = segment.startPos + segment.length / 2
        const centerX = edge.start.x + dirX * segmentCenter
        const centerZ = edge.start.z + dirZ * segmentCenter
        const centerY = segment.bottomHeight + height / 2

        return (
          <mesh
            key={`${edge.id}-${index}`}
            position={[centerX, centerY, centerZ]}
            rotation={[0, -angle, 0]}
            material={material}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[segment.length, height, DIMENSIONS.WALL_THICKNESS]} />
          </mesh>
        )
      })}
    </group>
  )
}
