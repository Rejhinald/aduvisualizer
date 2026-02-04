"use client"

/**
 * Top-down orthographic camera for bird's eye view
 */

import { useRef, useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { OrbitControls, OrthographicCamera } from "@react-three/drei"
import * as THREE from "three"
import { CAMERA } from "../constants"

interface TopDownCameraProps {
  bounds: {
    width: number
    depth: number
    centerX: number
    centerZ: number
  }
}

export function TopDownCamera({ bounds }: TopDownCameraProps) {
  const controlsRef = useRef<any>(null)
  const { camera } = useThree()

  // Calculate frustum size based on floor plan bounds
  const frustumSize = Math.max(bounds.width, bounds.depth, 20) * 1.3

  useEffect(() => {
    // Position camera above the center of the floor plan
    if (camera) {
      camera.position.set(bounds.centerX, CAMERA.TOP_DOWN_HEIGHT, bounds.centerZ)
      camera.lookAt(bounds.centerX, 0, bounds.centerZ)
    }
  }, [camera, bounds])

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[bounds.centerX, CAMERA.TOP_DOWN_HEIGHT, bounds.centerZ]}
        zoom={CAMERA.TOP_DOWN_ZOOM}
        near={0.1}
        far={1000}
        left={-frustumSize / 2}
        right={frustumSize / 2}
        top={frustumSize / 2}
        bottom={-frustumSize / 2}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate={false} // Lock to top-down view
        enablePan={true}
        enableZoom={true}
        minZoom={3}
        maxZoom={50}
        target={[bounds.centerX, 0, bounds.centerZ]}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  )
}
