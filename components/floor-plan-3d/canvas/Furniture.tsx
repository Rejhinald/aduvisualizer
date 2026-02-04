"use client"

/**
 * Furniture rendering component
 * Renders furniture as simple 3D primitives
 */

import { useMemo } from "react"
import * as THREE from "three"
import type { Furniture3D } from "../types"
import { createFurnitureMaterial } from "../materials"

interface FurnitureProps {
  furniture: Furniture3D[]
}

export function Furniture({ furniture }: FurnitureProps) {
  return (
    <group name="furniture">
      {furniture.map((item) => (
        <FurnitureItem key={item.id} item={item} />
      ))}
    </group>
  )
}

function FurnitureItem({ item }: { item: Furniture3D }) {
  const material = useMemo(() => createFurnitureMaterial(item.color), [item.color])

  // Position at the center of the furniture (y is already set to height/2)
  const position = useMemo(
    () => new THREE.Vector3(item.position.x, item.position.y, item.position.z),
    [item.position]
  )

  // Rotation around Y axis
  const rotation = useMemo(() => new THREE.Euler(0, item.rotation, 0), [item.rotation])

  // Use different shapes for different furniture types
  return (
    <group position={position} rotation={rotation} name={`furniture-${item.id}`}>
      <FurnitureGeometry item={item} material={material} />
    </group>
  )
}

interface FurnitureGeometryProps {
  item: Furniture3D
  material: THREE.MeshStandardMaterial
}

function FurnitureGeometry({ item, material }: FurnitureGeometryProps) {
  // Different furniture types get different shapes for visual variety

  // Beds - mattress + headboard
  if (item.type.startsWith("bed-")) {
    return (
      <group>
        {/* Mattress */}
        <mesh material={material} castShadow receiveShadow>
          <boxGeometry args={[item.width, item.height * 0.4, item.depth]} />
        </mesh>
        {/* Headboard */}
        <mesh
          position={[0, item.height * 0.3, -item.depth / 2 + 0.1]}
          material={material}
          castShadow
        >
          <boxGeometry args={[item.width, item.height * 0.6, 0.2]} />
        </mesh>
      </group>
    )
  }

  // Sofas - seat + back
  if (item.type.startsWith("sofa-") || item.type === "armchair") {
    return (
      <group>
        {/* Seat */}
        <mesh position={[0, -item.height * 0.2, 0]} material={material} castShadow receiveShadow>
          <boxGeometry args={[item.width, item.height * 0.4, item.depth]} />
        </mesh>
        {/* Back */}
        <mesh
          position={[0, item.height * 0.1, -item.depth / 2 + 0.2]}
          material={material}
          castShadow
        >
          <boxGeometry args={[item.width, item.height * 0.6, 0.4]} />
        </mesh>
        {/* Arms */}
        {item.type !== "sofa-3seat" && (
          <>
            <mesh
              position={[-item.width / 2 + 0.15, -item.height * 0.1, 0]}
              material={material}
              castShadow
            >
              <boxGeometry args={[0.3, item.height * 0.5, item.depth]} />
            </mesh>
            <mesh
              position={[item.width / 2 - 0.15, -item.height * 0.1, 0]}
              material={material}
              castShadow
            >
              <boxGeometry args={[0.3, item.height * 0.5, item.depth]} />
            </mesh>
          </>
        )}
      </group>
    )
  }

  // Tables - top + legs
  if (item.type.startsWith("table-") || item.type === "desk") {
    const legHeight = item.height * 0.85
    const topThickness = item.height * 0.15
    return (
      <group>
        {/* Table top */}
        <mesh
          position={[0, item.height / 2 - topThickness / 2, 0]}
          material={material}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[item.width, topThickness, item.depth]} />
        </mesh>
        {/* Legs */}
        {[
          [-item.width / 2 + 0.1, -item.depth / 2 + 0.1],
          [item.width / 2 - 0.1, -item.depth / 2 + 0.1],
          [-item.width / 2 + 0.1, item.depth / 2 - 0.1],
          [item.width / 2 - 0.1, item.depth / 2 - 0.1],
        ].map(([x, z], i) => (
          <mesh
            key={i}
            position={[x, -item.height / 2 + legHeight / 2, z]}
            material={material}
            castShadow
          >
            <boxGeometry args={[0.15, legHeight, 0.15]} />
          </mesh>
        ))}
      </group>
    )
  }

  // Toilet - base + tank + seat
  if (item.type === "toilet") {
    return (
      <group>
        {/* Base */}
        <mesh position={[0, -item.height * 0.3, 0]} material={material} castShadow>
          <boxGeometry args={[item.width * 0.8, item.height * 0.4, item.depth * 0.7]} />
        </mesh>
        {/* Bowl */}
        <mesh position={[0, -item.height * 0.1, item.depth * 0.15]} material={material} castShadow>
          <cylinderGeometry args={[item.width * 0.35, item.width * 0.3, item.height * 0.3, 16]} />
        </mesh>
        {/* Tank */}
        <mesh position={[0, item.height * 0.15, -item.depth * 0.3]} material={material} castShadow>
          <boxGeometry args={[item.width * 0.7, item.height * 0.5, item.depth * 0.3]} />
        </mesh>
      </group>
    )
  }

  // Bathtub - elongated bowl shape
  if (item.type === "bathtub") {
    return (
      <mesh material={material} castShadow receiveShadow>
        <boxGeometry args={[item.width, item.height, item.depth]} />
      </mesh>
    )
  }

  // Shower - glass enclosure representation
  if (item.type === "shower") {
    const glassMaterial = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: "#E0E0E0",
          transparent: true,
          opacity: 0.4,
          roughness: 0.1,
          metalness: 0.2,
        }),
      []
    )
    return (
      <group>
        {/* Base */}
        <mesh position={[0, -item.height / 2 + 0.1, 0]} material={material} castShadow>
          <boxGeometry args={[item.width, 0.2, item.depth]} />
        </mesh>
        {/* Glass walls (two sides) */}
        <mesh position={[-item.width / 2, 0, 0]} material={glassMaterial}>
          <boxGeometry args={[0.05, item.height, item.depth]} />
        </mesh>
        <mesh position={[0, 0, -item.depth / 2]} material={glassMaterial}>
          <boxGeometry args={[item.width, item.height, 0.05]} />
        </mesh>
      </group>
    )
  }

  // Sink - simple basin
  if (item.type === "sink") {
    return (
      <group>
        {/* Counter/vanity */}
        <mesh position={[0, 0, 0]} material={material} castShadow receiveShadow>
          <boxGeometry args={[item.width, item.height * 0.3, item.depth]} />
        </mesh>
        {/* Basin (indented) */}
        <mesh position={[0, item.height * 0.2, 0]}>
          <cylinderGeometry args={[item.width * 0.3, item.width * 0.25, item.height * 0.2, 16]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.3} metalness={0.1} />
        </mesh>
      </group>
    )
  }

  // Refrigerator - tall box
  if (item.type === "refrigerator") {
    return (
      <group>
        {/* Main body */}
        <mesh material={material} castShadow>
          <boxGeometry args={[item.width, item.height, item.depth]} />
        </mesh>
        {/* Door handle */}
        <mesh position={[item.width / 2 - 0.05, 0, item.depth / 2 + 0.05]}>
          <boxGeometry args={[0.05, item.height * 0.3, 0.1]} />
          <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
    )
  }

  // Stove - with burners
  if (item.type === "stove") {
    return (
      <group>
        {/* Main body */}
        <mesh material={material} castShadow receiveShadow>
          <boxGeometry args={[item.width, item.height, item.depth]} />
        </mesh>
        {/* Burners */}
        {[
          [-item.width / 4, item.depth / 4],
          [item.width / 4, item.depth / 4],
          [-item.width / 4, -item.depth / 4],
          [item.width / 4, -item.depth / 4],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, item.height / 2 + 0.02, z]}>
            <cylinderGeometry args={[0.25, 0.25, 0.03, 16]} />
            <meshStandardMaterial color="#1A1A1A" roughness={0.8} />
          </mesh>
        ))}
      </group>
    )
  }

  // Chair - simple with back
  if (item.type === "chair") {
    return (
      <group>
        {/* Seat */}
        <mesh position={[0, -item.height * 0.2, 0]} material={material} castShadow>
          <boxGeometry args={[item.width * 0.9, item.height * 0.1, item.depth * 0.9]} />
        </mesh>
        {/* Back */}
        <mesh
          position={[0, item.height * 0.15, -item.depth / 2 + 0.1]}
          material={material}
          castShadow
        >
          <boxGeometry args={[item.width * 0.9, item.height * 0.5, 0.1]} />
        </mesh>
        {/* Legs */}
        {[
          [-item.width / 2 + 0.1, -item.depth / 2 + 0.1],
          [item.width / 2 - 0.1, -item.depth / 2 + 0.1],
          [-item.width / 2 + 0.1, item.depth / 2 - 0.1],
          [item.width / 2 - 0.1, item.depth / 2 - 0.1],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, -item.height / 2 + 0.5, z]} material={material} castShadow>
            <boxGeometry args={[0.1, item.height * 0.5, 0.1]} />
          </mesh>
        ))}
      </group>
    )
  }

  // Default: simple box
  return (
    <mesh material={material} castShadow receiveShadow>
      <boxGeometry args={[item.width, item.height, item.depth]} />
    </mesh>
  )
}
