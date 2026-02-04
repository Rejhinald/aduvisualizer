"use client"

/**
 * Scene lighting setup for the 3D viewer
 */

import type { CameraMode } from "../types"

interface SceneLightingProps {
  mode: CameraMode
}

export function SceneLighting({ mode }: SceneLightingProps) {
  return (
    <>
      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.5} color="#ffffff" />

      {/* Main directional light (sun) */}
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      {/* Fill light from opposite side */}
      <directionalLight
        position={[-10, 15, -10]}
        intensity={0.3}
        color="#f0f0ff"
      />

      {/* Hemisphere light for sky/ground color gradient */}
      <hemisphereLight
        color="#87CEEB" // Sky color
        groundColor="#5D4037" // Ground color
        intensity={0.4}
      />

      {/* Additional soft light for first-person mode */}
      {mode === "firstperson" && (
        <pointLight
          position={[0, 7, 0]}
          intensity={0.3}
          color="#FFF8E1" // Warm white
          distance={30}
          decay={2}
        />
      )}
    </>
  )
}
