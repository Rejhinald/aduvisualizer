"use client"

/**
 * FloorPlan3DViewer - Main 3D visualization component
 *
 * Renders a Three.js scene of the floor plan with:
 * - Accurate room geometry from vertices
 * - Walls with door/window openings
 * - Furniture placement
 * - Materials based on vibe selections
 * - Top-down and first-person camera modes
 */

import { Suspense, useState, useCallback, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import * as THREE from "three"
import { Button } from "@/components/ui/button"
import { Eye, Compass } from "lucide-react"

import type { FloorPlan3DViewerProps, CameraMode } from "./types"
import { useFloorPlanGeometry } from "./hooks"
import { Floor, Walls, Doors, Windows, Furniture } from "./canvas"
import { TopDownCamera } from "./controls/TopDownCamera"
import { FirstPersonCamera, FirstPersonInstructions } from "./controls/FirstPersonCamera"
import { SceneLighting } from "./lighting"
import { CAMERA } from "./constants"

export function FloorPlan3DViewer({
  rooms,
  doors,
  windows,
  furniture,
  aduBoundary,
  roomFinishes,
  cameraPlacement,
  pixelsPerFoot,
  canvasWidth,
  canvasHeight,
  initialCameraMode = "topdown",
  onCameraModeChange,
}: FloorPlan3DViewerProps) {
  const [cameraMode, setCameraMode] = useState<CameraMode>(initialCameraMode)
  const [isPointerLocked, setIsPointerLocked] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Debug: Log input data
  console.log("=== 3D Viewer Debug ===")
  console.log("Input rooms:", rooms.length, rooms.slice(0, 2).map(r => ({ id: r.id, name: r.name, vertices: r.vertices.length })))
  console.log("Input doors:", doors.length)
  console.log("Input windows:", windows.length)
  console.log("Input furniture:", furniture.length, furniture)
  console.log("Canvas config:", { pixelsPerFoot, canvasWidth, canvasHeight })
  console.log("Room finishes:", roomFinishes?.length ?? 0)

  // Log first room's vertices to check coordinate range
  if (rooms.length > 0 && rooms[0].vertices.length > 0) {
    console.log("First room vertices (pixels):", rooms[0].vertices)
  }

  // Process floor plan data into 3D geometry
  const {
    rooms3D,
    wallEdges,
    doors3D,
    windows3D,
    furniture3D,
    bounds,
    converter,
  } = useFloorPlanGeometry(
    rooms,
    doors,
    windows,
    furniture,
    { pixelsPerFoot, canvasWidth, canvasHeight },
    roomFinishes
  )

  // Debug: Log processed data
  console.log("Processed rooms3D:", rooms3D.length, rooms3D.slice(0, 2).map(r => ({ id: r.id, vertices: r.vertices.slice(0, 2), vibe: r.vibe })))
  console.log("Processed wallEdges:", wallEdges.length)
  console.log("Processed furniture3D:", furniture3D.length)
  console.log("Bounds:", bounds)

  // Handle camera mode change
  const handleCameraModeChange = useCallback(
    (mode: CameraMode) => {
      setCameraMode(mode)
      onCameraModeChange?.(mode)
    },
    [onCameraModeChange]
  )

  // Handle pointer lock state change
  const handlePointerLockChange = useCallback((isLocked: boolean) => {
    setIsPointerLocked(isLocked)
  }, [])

  // Click to enter first-person mode
  const handleEnterFirstPerson = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.requestPointerLock()
    }
  }, [])

  // Calculate first-person camera initial position
  const firstPersonPosition = cameraPlacement
    ? converter.canvasToThree(cameraPlacement.position, 0)
    : { x: bounds.centerX, y: 0, z: bounds.centerZ }

  const hasValidRooms = rooms.length > 0 && rooms.some((r) => r.vertices.length >= 3)

  if (!hasValidRooms) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 rounded-lg">
        <div className="text-center p-8">
          <Compass className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Floor Plan Data
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Create a floor plan with rooms to visualize it in 3D
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Camera Mode Toggle */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant={cameraMode === "topdown" ? "default" : "outline"}
          size="sm"
          onClick={() => handleCameraModeChange("topdown")}
          className="gap-2"
        >
          <Eye className="w-4 h-4" />
          Top-Down
        </Button>
        <Button
          variant={cameraMode === "firstperson" ? "default" : "outline"}
          size="sm"
          onClick={() => handleCameraModeChange("firstperson")}
          disabled={!cameraPlacement}
          className="gap-2"
          title={!cameraPlacement ? "Place a camera in the finishes panel first" : undefined}
        >
          <Compass className="w-4 h-4" />
          First-Person
        </Button>
      </div>

      {/* Camera Info */}
      {cameraMode === "topdown" && (
        <div className="absolute bottom-4 left-4 z-10 bg-black/60 text-white px-3 py-2 rounded-lg text-sm">
          <p>Scroll to zoom • Drag to pan</p>
        </div>
      )}

      {/* Three.js Canvas */}
      <Canvas
        ref={canvasRef}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ background: "#f0f0f0" }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <SceneLighting mode={cameraMode} />

          {/* Camera */}
          {cameraMode === "topdown" ? (
            <TopDownCamera bounds={bounds} />
          ) : (
            <FirstPersonCamera
              initialPosition={
                new THREE.Vector3(
                  firstPersonPosition.x,
                  cameraPlacement?.height || CAMERA.DEFAULT_EYE_HEIGHT,
                  firstPersonPosition.z
                )
              }
              initialRotation={cameraPlacement?.rotation || 0}
              fov={cameraPlacement?.fov || CAMERA.DEFAULT_FOV}
              eyeHeight={cameraPlacement?.height || CAMERA.DEFAULT_EYE_HEIGHT}
              onLockChange={handlePointerLockChange}
            />
          )}

          {/* Floor */}
          <Floor rooms={rooms3D} />

          {/* Walls */}
          <Walls wallEdges={wallEdges} rooms={rooms3D} />

          {/* Doors */}
          <Doors doors={doors3D} />

          {/* Windows */}
          <Windows windows={windows3D} />

          {/* Furniture */}
          <Furniture furniture={furniture3D} />

          {/* Ground plane (extends beyond floor plan) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.01, 0]}
            receiveShadow
          >
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#E8E8E8" roughness={0.9} />
          </mesh>
        </Suspense>
      </Canvas>

      {/* First-person instructions overlay */}
      {cameraMode === "firstperson" && (
        <FirstPersonInstructions
          isLocked={isPointerLocked}
          onClick={handleEnterFirstPerson}
        />
      )}
    </div>
  )
}

// Re-export types
export type { FloorPlan3DViewerProps, CameraMode } from "./types"
