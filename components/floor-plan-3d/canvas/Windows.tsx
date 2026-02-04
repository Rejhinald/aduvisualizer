"use client"

/**
 * Window rendering component
 * Renders window frames and glass panes
 */

import { useMemo } from "react"
import * as THREE from "three"
import type { Window3D } from "../types"
import { createWindowFrameMaterial, createWindowGlassMaterial } from "../materials"
import { DIMENSIONS } from "../constants"

interface WindowsProps {
  windows: Window3D[]
}

export function Windows({ windows }: WindowsProps) {
  return (
    <group name="windows">
      {windows.map((window) => (
        <WindowMesh key={window.id} window={window} />
      ))}
    </group>
  )
}

function WindowMesh({ window }: { window: Window3D }) {
  const frameMaterial = useMemo(() => createWindowFrameMaterial(), [])
  const glassMaterial = useMemo(() => createWindowGlassMaterial(), [])

  // Frame dimensions
  const frameWidth = DIMENSIONS.WINDOW_FRAME_WIDTH
  const frameDepth = DIMENSIONS.WALL_THICKNESS + 0.05 // Slightly larger than wall

  // Calculate position - window is at sill height + half window height
  const position = useMemo(
    () => new THREE.Vector3(
      window.position.x,
      window.sillHeight + window.height / 2,
      window.position.z
    ),
    [window.position, window.sillHeight, window.height]
  )

  // Rotation based on wall angle
  const rotation = useMemo(
    () => new THREE.Euler(0, -window.wallAngle, 0),
    [window.wallAngle]
  )

  return (
    <group position={position} rotation={rotation} name={`window-${window.id}`}>
      {/* Window Frame - Top */}
      <mesh
        position={[0, window.height / 2 + frameWidth / 2, 0]}
        material={frameMaterial}
        castShadow
      >
        <boxGeometry args={[window.width + frameWidth * 2, frameWidth, frameDepth]} />
      </mesh>

      {/* Window Frame - Bottom (Sill) */}
      <mesh
        position={[0, -window.height / 2 - frameWidth / 2, 0]}
        material={frameMaterial}
        castShadow
      >
        <boxGeometry args={[window.width + frameWidth * 2, frameWidth, frameDepth + 0.1]} />
      </mesh>

      {/* Window Frame - Left */}
      <mesh
        position={[-window.width / 2 - frameWidth / 2, 0, 0]}
        material={frameMaterial}
        castShadow
      >
        <boxGeometry args={[frameWidth, window.height, frameDepth]} />
      </mesh>

      {/* Window Frame - Right */}
      <mesh
        position={[window.width / 2 + frameWidth / 2, 0, 0]}
        material={frameMaterial}
        castShadow
      >
        <boxGeometry args={[frameWidth, window.height, frameDepth]} />
      </mesh>

      {/* Center divider (optional, makes it look more realistic) */}
      {window.width > 2 && (
        <mesh position={[0, 0, 0]} material={frameMaterial}>
          <boxGeometry args={[frameWidth / 2, window.height, frameDepth]} />
        </mesh>
      )}

      {/* Glass Pane */}
      <mesh position={[0, 0, 0]} material={glassMaterial}>
        <planeGeometry args={[window.width - 0.1, window.height - 0.1]} />
      </mesh>

      {/* Glass Pane (back side for double-sided rendering) */}
      <mesh position={[0, 0, 0]} rotation={[0, Math.PI, 0]} material={glassMaterial}>
        <planeGeometry args={[window.width - 0.1, window.height - 0.1]} />
      </mesh>
    </group>
  )
}
