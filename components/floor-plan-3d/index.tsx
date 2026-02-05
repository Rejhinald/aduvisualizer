"use client"

/**
 * Floor Plan 3D Viewer - V2
 *
 * Clean SketchUp-style 3D visualization of floor plans
 * Supports top-down (orthographic) and first-person (perspective) camera modes
 *
 * Coordinate mapping: Canvas (x, y) feet -> Three.js (x, 0, y)
 */

import { Suspense, useState, useCallback, useMemo, useRef, useEffect } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import * as THREE from "three"
import { Button } from "@/components/ui/button"
import { Eye, User } from "lucide-react"

import type {
  FloorPlan3DViewerProps,
  CameraMode,
  Wall3D,
  Floor3D,
  Opening3D,
  Furniture3D,
  SceneBounds,
} from "./types"
import {
  DIMENSIONS,
  CAMERA,
  COLORS,
  MATERIALS,
  FURNITURE_HEIGHTS,
} from "./constants"

// ============================================
// Geometry Processing Hook
// ============================================

function useGeometry(blueprint: FloorPlan3DViewerProps["blueprint"]) {
  const { corners, walls, doors, windows, furniture, rooms } = blueprint

  // Corner lookup
  const cornerMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>()
    corners.forEach((c) => map.set(c.id, { x: c.x, y: c.y }))
    return map
  }, [corners])

  // Process walls
  // Note: Virtual walls are filtered out here - they only exist for room detection
  // Partition walls render at half height
  const walls3D = useMemo((): Wall3D[] => {
    return walls
      // Filter out virtual walls - they don't render in 3D (only used for room detection)
      .filter((wall) => wall.wallType !== "virtual")
      .map((wall) => {
        const start = cornerMap.get(wall.startCornerId)
        const end = cornerMap.get(wall.endCornerId)
        if (!start || !end) return null

        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx)
        const thickness = wall.thickness ?? DIMENSIONS.WALL_THICKNESS

        // Partition walls are half height (4.5 feet)
        const baseHeight = wall.height ?? DIMENSIONS.WALL_HEIGHT
        const height = wall.wallType === "partition" ? baseHeight / 2 : baseHeight

        const wallType = wall.wallType ?? "solid"

        // Find openings on this wall (only for solid walls - no openings on partitions)
        const openings: Opening3D[] = []

        // Only add doors/windows to solid walls
        if (wallType === "solid") {
          // Add doors
          doors
            .filter((d) => d.wallId === wall.id)
            .forEach((door) => {
              const pos = door.position // 0-1 along wall
              const centerX = start.x + dx * pos
              const centerZ = start.y + dy * pos
              openings.push({
                type: "door",
                id: door.id,
                center: { x: centerX, y: (door.height ?? DIMENSIONS.DOOR_HEIGHT) / 2, z: centerZ },
                width: door.width ?? DIMENSIONS.DOOR_WIDTH,
                height: door.height ?? DIMENSIONS.DOOR_HEIGHT,
                bottomY: 0,
                doorType: door.type,
              })
            })

          // Add windows
          windows
            .filter((w) => w.wallId === wall.id)
            .forEach((window) => {
              const pos = window.position
              const centerX = start.x + dx * pos
              const centerZ = start.y + dy * pos
              const sillHeight = window.sillHeight ?? DIMENSIONS.WINDOW_SILL_HEIGHT
              const windowHeight = window.height ?? DIMENSIONS.WINDOW_HEIGHT
              openings.push({
                type: "window",
                id: window.id,
                center: { x: centerX, y: sillHeight + windowHeight / 2, z: centerZ },
                width: window.width ?? DIMENSIONS.WINDOW_WIDTH,
                height: windowHeight,
                bottomY: sillHeight,
                windowType: window.type,
              })
            })
        }

        return {
          id: wall.id,
          start: { x: start.x, y: 0, z: start.y },
          end: { x: end.x, y: 0, z: end.y },
          thickness,
          height,
          angle,
          length,
          wallType,
          openings: openings.sort((a, b) => {
            const posA = Math.sqrt((a.center.x - start.x) ** 2 + (a.center.z - start.y) ** 2)
            const posB = Math.sqrt((b.center.x - start.x) ** 2 + (b.center.z - start.y) ** 2)
            return posA - posB
          }),
        }
      }).filter((w): w is Wall3D => w !== null)
  }, [walls, doors, windows, cornerMap])

  // Process floors (rooms)
  // Filter out entry/corridor rooms and very small rooms that shouldn't render as floors
  const floors3D = useMemo((): Floor3D[] => {
    return rooms
      .filter((room) => {
        // Skip entry/corridor - these are often detected from door openings
        if (room.type === "entry" || room.type === "corridor") return false
        // Skip very small rooms (less than 10 sq ft)
        if (room.area && room.area < 10) return false
        return true
      })
      .map((room) => ({
        id: room.id,
        name: room.name || room.type,
        type: room.type,
        // Room has corners: Corner[] - map to vertices for 3D floor rendering
        vertices: room.corners.map((c) => ({ x: c.x, y: 0, z: c.y })),
        color: COLORS.ROOM_TYPES[room.type] || COLORS.FLOOR_DEFAULT,
      }))
  }, [rooms])

  // Process furniture
  const furniture3D = useMemo((): Furniture3D[] => {
    return furniture.map((item) => {
      const config = FURNITURE_HEIGHTS[item.type] || { height: 2, color: COLORS.FURNITURE_DEFAULT }
      return {
        id: item.id,
        type: item.type,
        position: { x: item.x, y: config.height / 2, z: item.y },
        rotation: ((item.rotation || 0) * Math.PI) / 180,
        width: item.width || 2,
        depth: item.depth || 2,
        height: config.height,
        color: config.color,
      }
    })
  }, [furniture])

  // Calculate scene bounds
  const bounds = useMemo((): SceneBounds => {
    if (corners.length === 0) {
      return { minX: -20, maxX: 20, minZ: -20, maxZ: 20, width: 40, depth: 40, centerX: 0, centerZ: 0 }
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    corners.forEach((c) => {
      if (c.x < minX) minX = c.x
      if (c.x > maxX) maxX = c.x
      if (c.y < minZ) minZ = c.y
      if (c.y > maxZ) maxZ = c.y
    })

    // Add padding
    const padding = 5
    minX -= padding
    maxX += padding
    minZ -= padding
    maxZ += padding

    return {
      minX, maxX, minZ, maxZ,
      width: maxX - minX,
      depth: maxZ - minZ,
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
    }
  }, [corners])

  return { walls3D, floors3D, furniture3D, bounds }
}

// ============================================
// Scene Components
// ============================================

function Lighting({ bounds }: { bounds: SceneBounds }) {
  return (
    <>
      {/* Hemisphere light - sky/ground ambient */}
      <hemisphereLight args={["#B1E1FF", "#B97A20", 0.5]} />

      {/* Main directional light (sun) */}
      <directionalLight
        position={[bounds.centerX + 30, 50, bounds.centerZ + 30]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={150}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0005}
      />

      {/* Fill light from opposite side */}
      <directionalLight
        position={[bounds.centerX - 20, 30, bounds.centerZ - 20]}
        intensity={0.4}
      />

      {/* Soft ambient fill */}
      <ambientLight intensity={0.3} />

      {/* Interior room lights - one per room area center */}
      <pointLight
        position={[bounds.centerX, DIMENSIONS.WALL_HEIGHT - 1, bounds.centerZ]}
        intensity={200}
        distance={30}
        decay={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </>
  )
}

function Floor({ floors }: { floors: Floor3D[] }) {
  return (
    <group>
      {floors.map((floor) => {
        if (floor.vertices.length < 3) return null

        // Create floor shape
        // Note: We negate z because rotation [-PI/2, 0, 0] negates it again,
        // resulting in the correct world position
        const shape = new THREE.Shape()
        shape.moveTo(floor.vertices[0].x, -floor.vertices[0].z)
        for (let i = 1; i < floor.vertices.length; i++) {
          shape.lineTo(floor.vertices[i].x, -floor.vertices[i].z)
        }
        shape.closePath()

        return (
          <mesh
            key={floor.id}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, 0]}
            receiveShadow
          >
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial
              color={floor.color}
              roughness={MATERIALS.FLOOR.roughness}
              metalness={MATERIALS.FLOOR.metalness}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function WallSegment({ wall }: { wall: Wall3D }) {
  const { start, end, thickness, height, angle, length, openings, wallType } = wall

  // Use different color for partition walls
  const wallColor = wallType === "partition" ? COLORS.WALL_PARTITION : COLORS.WALL

  // Calculate center point of wall
  const centerX = (start.x + end.x) / 2
  const centerZ = (start.z + end.z) / 2

  // For walls with door/window openings, we need to render segments around them
  // For simple walls, just render a box
  if (openings.length === 0) {
    return (
      <mesh
        position={[centerX, height / 2, centerZ]}
        rotation={[0, -angle, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[length, height, thickness]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={MATERIALS.WALL.roughness}
          metalness={MATERIALS.WALL.metalness}
        />
      </mesh>
    )
  }

  // Wall with openings - render segments around them
  const segments: React.ReactNode[] = []

  // Sort openings by position along wall
  const sortedOpenings = [...openings].sort((a, b) => {
    const posA = Math.sqrt((a.center.x - start.x) ** 2 + (a.center.z - start.z) ** 2)
    const posB = Math.sqrt((b.center.x - start.x) ** 2 + (b.center.z - start.z) ** 2)
    return posA - posB
  })

  let lastEnd = 0

  sortedOpenings.forEach((opening, i) => {
    const distFromStart = Math.sqrt(
      (opening.center.x - start.x) ** 2 + (opening.center.z - start.z) ** 2
    )
    const openingStart = distFromStart - opening.width / 2
    const openingEnd = distFromStart + opening.width / 2

    // Wall segment before this opening
    if (openingStart > lastEnd + 0.1) {
      const segLength = openingStart - lastEnd
      const segCenter = lastEnd + segLength / 2
      segments.push(
        <mesh
          key={`seg-${i}-before`}
          position={[segCenter, height / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[segLength, height, thickness]} />
          <meshStandardMaterial color={wallColor} roughness={MATERIALS.WALL.roughness} />
        </mesh>
      )
    }

    // Wall above opening (for windows and doors that don't reach ceiling)
    if (opening.bottomY + opening.height < height - 0.1) {
      const aboveHeight = height - (opening.bottomY + opening.height)
      segments.push(
        <mesh
          key={`seg-${i}-above`}
          position={[distFromStart, opening.bottomY + opening.height + aboveHeight / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[opening.width, aboveHeight, thickness]} />
          <meshStandardMaterial color={wallColor} roughness={MATERIALS.WALL.roughness} />
        </mesh>
      )
    }

    // Wall below opening (for windows)
    if (opening.bottomY > 0.1) {
      segments.push(
        <mesh
          key={`seg-${i}-below`}
          position={[distFromStart, opening.bottomY / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[opening.width, opening.bottomY, thickness]} />
          <meshStandardMaterial color={wallColor} roughness={MATERIALS.WALL.roughness} />
        </mesh>
      )
    }

    lastEnd = openingEnd
  })

  // Wall segment after last opening
  if (lastEnd < length - 0.1) {
    const segLength = length - lastEnd
    const segCenter = lastEnd + segLength / 2
    segments.push(
      <mesh
        key="seg-after"
        position={[segCenter, height / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[segLength, height, thickness]} />
        <meshStandardMaterial color={wallColor} roughness={MATERIALS.WALL.roughness} />
      </mesh>
    )
  }

  return (
    <group position={[start.x, 0, start.z]} rotation={[0, -angle, 0]}>
      {segments}
    </group>
  )
}

// Corner posts to fill gaps where walls meet
function CornerPosts({ walls }: { walls: Wall3D[] }) {
  // Collect unique corner positions from wall start/end points
  const corners = useMemo(() => {
    const cornerMap = new Map<string, { x: number; z: number; height: number; thickness: number }>()

    for (const wall of walls) {
      // Use start corner
      const startKey = `${wall.start.x.toFixed(2)},${wall.start.z.toFixed(2)}`
      if (!cornerMap.has(startKey)) {
        cornerMap.set(startKey, {
          x: wall.start.x,
          z: wall.start.z,
          height: wall.height,
          thickness: wall.thickness,
        })
      }

      // Use end corner
      const endKey = `${wall.end.x.toFixed(2)},${wall.end.z.toFixed(2)}`
      if (!cornerMap.has(endKey)) {
        cornerMap.set(endKey, {
          x: wall.end.x,
          z: wall.end.z,
          height: wall.height,
          thickness: wall.thickness,
        })
      }
    }

    return Array.from(cornerMap.values())
  }, [walls])

  return (
    <group>
      {corners.map((corner, i) => (
        <mesh
          key={`corner-${i}`}
          position={[corner.x, corner.height / 2, corner.z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[corner.thickness, corner.height, corner.thickness]} />
          <meshStandardMaterial
            color={COLORS.WALL}
            roughness={MATERIALS.WALL.roughness}
            metalness={MATERIALS.WALL.metalness}
          />
        </mesh>
      ))}
    </group>
  )
}

function Walls({ walls }: { walls: Wall3D[] }) {
  return (
    <group>
      {walls.map((wall) => (
        <WallSegment key={wall.id} wall={wall} />
      ))}
    </group>
  )
}

function DoorMesh({
  opening,
  wallAngle,
  wallStart,
  wallThickness,
}: {
  opening: Opening3D
  wallAngle: number
  wallStart: { x: number; z: number }
  wallThickness: number
}) {
  const { center, width, height } = opening

  // Calculate distance along wall from start to opening center
  const distFromStart = Math.sqrt(
    (center.x - wallStart.x) ** 2 + (center.z - wallStart.z) ** 2
  )

  // Position door within wall's local coordinate system
  // Door is centered on wall thickness
  const localX = distFromStart
  const localZ = wallThickness / 2

  return (
    <group position={[wallStart.x, 0, wallStart.z]} rotation={[0, -wallAngle, 0]}>
      {/* Door frame */}
      <mesh position={[localX, height / 2, localZ]} castShadow>
        <boxGeometry args={[width + 0.2, height + 0.1, wallThickness + 0.1]} />
        <meshStandardMaterial
          color={COLORS.DOOR_FRAME}
          roughness={MATERIALS.DOOR.roughness}
          metalness={MATERIALS.DOOR.metalness}
        />
      </mesh>
      {/* Door panel (slightly inset) */}
      <mesh position={[localX, height / 2, localZ]} castShadow>
        <boxGeometry args={[width - 0.1, height - 0.1, 0.15]} />
        <meshStandardMaterial
          color={COLORS.DOOR_PANEL}
          roughness={MATERIALS.DOOR.roughness}
          metalness={MATERIALS.DOOR.metalness}
        />
      </mesh>
    </group>
  )
}

function WindowMesh({
  opening,
  wallAngle,
  wallStart,
  wallThickness,
}: {
  opening: Opening3D
  wallAngle: number
  wallStart: { x: number; z: number }
  wallThickness: number
}) {
  const { center, width, height, bottomY } = opening

  // Calculate distance along wall from start to opening center
  const distFromStart = Math.sqrt(
    (center.x - wallStart.x) ** 2 + (center.z - wallStart.z) ** 2
  )

  // Position window within wall's local coordinate system
  const localX = distFromStart
  const localZ = wallThickness / 2

  return (
    <group position={[wallStart.x, 0, wallStart.z]} rotation={[0, -wallAngle, 0]}>
      {/* Window frame */}
      <mesh position={[localX, bottomY + height / 2, localZ]} castShadow>
        <boxGeometry args={[width + 0.15, height + 0.15, wallThickness + 0.1]} />
        <meshStandardMaterial
          color={COLORS.WINDOW_FRAME}
          roughness={MATERIALS.WINDOW_FRAME.roughness}
          metalness={MATERIALS.WINDOW_FRAME.metalness}
        />
      </mesh>
      {/* Glass pane */}
      <mesh position={[localX, bottomY + height / 2, localZ]}>
        <boxGeometry args={[width - 0.2, height - 0.2, 0.05]} />
        <meshStandardMaterial
          color={COLORS.WINDOW_GLASS}
          roughness={MATERIALS.WINDOW_GLASS.roughness}
          metalness={MATERIALS.WINDOW_GLASS.metalness}
          transparent={MATERIALS.WINDOW_GLASS.transparent}
          opacity={MATERIALS.WINDOW_GLASS.opacity}
        />
      </mesh>
    </group>
  )
}

function Openings({ walls }: { walls: Wall3D[] }) {
  return (
    <group>
      {walls.flatMap((wall) =>
        wall.openings.map((opening) =>
          opening.type === "door" ? (
            <DoorMesh
              key={opening.id}
              opening={opening}
              wallAngle={wall.angle}
              wallStart={{ x: wall.start.x, z: wall.start.z }}
              wallThickness={wall.thickness}
            />
          ) : (
            <WindowMesh
              key={opening.id}
              opening={opening}
              wallAngle={wall.angle}
              wallStart={{ x: wall.start.x, z: wall.start.z }}
              wallThickness={wall.thickness}
            />
          )
        )
      )}
    </group>
  )
}

function FurnitureItem({ item }: { item: Furniture3D }) {
  const { position, rotation, width, depth, height, color } = item

  return (
    <mesh
      position={[position.x, position.y, position.z]}
      rotation={[0, rotation, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color={color}
        roughness={MATERIALS.FURNITURE.roughness}
        metalness={MATERIALS.FURNITURE.metalness}
      />
    </mesh>
  )
}

function FurnitureGroup({ furniture }: { furniture: Furniture3D[] }) {
  return (
    <group>
      {furniture.map((item) => (
        <FurnitureItem key={item.id} item={item} />
      ))}
    </group>
  )
}

function Ground({ bounds }: { bounds: SceneBounds }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.centerX, -0.01, bounds.centerZ]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color={COLORS.GROUND} roughness={0.9} />
    </mesh>
  )
}

function Ceiling({ floors }: { floors: Floor3D[] }) {
  const ceilingHeight = DIMENSIONS.WALL_HEIGHT

  return (
    <group>
      {floors.map((floor) => {
        if (floor.vertices.length < 3) return null

        // Create ceiling shape (same as floor)
        const shape = new THREE.Shape()
        shape.moveTo(floor.vertices[0].x, floor.vertices[0].z)
        for (let i = 1; i < floor.vertices.length; i++) {
          shape.lineTo(floor.vertices[i].x, floor.vertices[i].z)
        }
        shape.closePath()

        return (
          <mesh
            key={`ceiling-${floor.id}`}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, ceilingHeight, 0]}
            receiveShadow
          >
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial
              color="#FFFFFF"
              roughness={0.95}
              metalness={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// ============================================
// Camera Components
// ============================================

function TopDownCameraController({ bounds }: { bounds: SceneBounds }) {
  // Use perspective camera from above - simpler and shadows work properly
  const height = Math.max(bounds.width, bounds.depth) + 20

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[bounds.centerX, height, bounds.centerZ + 0.1]}
        fov={60}
        near={0.1}
        far={500}
      />
      <OrbitControls
        target={[bounds.centerX, 0, bounds.centerZ]}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={0}
      />
    </>
  )
}

function FirstPersonController({ bounds }: { bounds: SceneBounds }) {
  const { camera, gl } = useThree()
  const moveState = useRef({ forward: false, backward: false, left: false, right: false })
  const isLocked = useRef(false)
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"))

  // Initialize camera position
  useEffect(() => {
    camera.position.set(bounds.centerX, CAMERA.DEFAULT_EYE_HEIGHT, bounds.centerZ)
    euler.current.setFromQuaternion(camera.quaternion)
  }, [bounds, camera])

  // Handle pointer lock
  useEffect(() => {
    const canvas = gl.domElement

    const onPointerLockChange = () => {
      isLocked.current = document.pointerLockElement === canvas
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked.current) return

      euler.current.y -= e.movementX * CAMERA.LOOK_SENSITIVITY
      euler.current.x -= e.movementY * CAMERA.LOOK_SENSITIVITY
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x))

      camera.quaternion.setFromEuler(euler.current)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          moveState.current.forward = true
          break
        case "KeyS":
        case "ArrowDown":
          moveState.current.backward = true
          break
        case "KeyA":
        case "ArrowLeft":
          moveState.current.left = true
          break
        case "KeyD":
        case "ArrowRight":
          moveState.current.right = true
          break
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          moveState.current.forward = false
          break
        case "KeyS":
        case "ArrowDown":
          moveState.current.backward = false
          break
        case "KeyA":
        case "ArrowLeft":
          moveState.current.left = false
          break
        case "KeyD":
        case "ArrowRight":
          moveState.current.right = false
          break
      }
    }

    document.addEventListener("pointerlockchange", onPointerLockChange)
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("keyup", onKeyUp)

    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange)
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("keyup", onKeyUp)
    }
  }, [camera, gl])

  // Movement update
  useFrame((_, delta) => {
    if (!isLocked.current) return

    const speed = CAMERA.MOVE_SPEED * delta
    const direction = new THREE.Vector3()

    if (moveState.current.forward) direction.z -= 1
    if (moveState.current.backward) direction.z += 1
    if (moveState.current.left) direction.x -= 1
    if (moveState.current.right) direction.x += 1

    direction.normalize().multiplyScalar(speed)
    direction.applyQuaternion(camera.quaternion)
    direction.y = 0 // Keep on same height

    camera.position.add(direction)
    camera.position.y = CAMERA.DEFAULT_EYE_HEIGHT // Lock height
  })

  return (
    <PerspectiveCamera
      makeDefault
      fov={CAMERA.DEFAULT_FOV}
      near={0.1}
      far={500}
    />
  )
}

// ============================================
// Main Viewer Component
// ============================================

export function FloorPlan3DViewer({
  blueprint,
  initialCameraMode = "top-down",
  onCameraModeChange,
}: FloorPlan3DViewerProps) {
  const [cameraMode, setCameraMode] = useState<CameraMode>(initialCameraMode)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { walls3D, floors3D, furniture3D, bounds } = useGeometry(blueprint)

  const handleCameraModeChange = useCallback(
    (mode: CameraMode) => {
      setCameraMode(mode)
      onCameraModeChange?.(mode)
    },
    [onCameraModeChange]
  )

  const handleCanvasClick = useCallback(() => {
    if (cameraMode === "first-person" && canvasRef.current) {
      canvasRef.current.requestPointerLock()
    }
  }, [cameraMode])

  const hasData = blueprint.corners.length > 0 || blueprint.rooms.length > 0

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto text-gray-400 mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Floor Plan Data</h3>
          <p className="text-gray-500">Create walls in the editor to visualize in 3D</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Camera Mode Toggle */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant={cameraMode === "top-down" ? "default" : "outline"}
          size="sm"
          onClick={() => handleCameraModeChange("top-down")}
          className="gap-2"
        >
          <Eye className="w-4 h-4" />
          Top-Down
        </Button>
        <Button
          variant={cameraMode === "first-person" ? "default" : "outline"}
          size="sm"
          onClick={() => handleCameraModeChange("first-person")}
          className="gap-2"
        >
          <User className="w-4 h-4" />
          Walk
        </Button>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/60 text-white px-3 py-2 rounded-lg text-sm">
        {cameraMode === "top-down" ? (
          <p>Scroll to zoom • Drag to pan</p>
        ) : (
          <p>Click to look around • WASD to move • ESC to exit</p>
        )}
      </div>

      {/* Three.js Canvas */}
      <Canvas
        ref={canvasRef}
        shadows
        onClick={handleCanvasClick}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ background: "linear-gradient(to bottom, #87CEEB 0%, #E0E8F0 100%)" }}
      >
        <Suspense fallback={null}>
          <Lighting bounds={bounds} />

          {cameraMode === "top-down" ? (
            <TopDownCameraController bounds={bounds} />
          ) : (
            <FirstPersonController bounds={bounds} />
          )}

          <Floor floors={floors3D} />
          {/* Only show ceiling in first-person mode so top-down can see inside */}
          {cameraMode === "first-person" && <Ceiling floors={floors3D} />}
          <Walls walls={walls3D} />
          <CornerPosts walls={walls3D} />
          <Openings walls={walls3D} />
          <FurnitureGroup furniture={furniture3D} />
          <Ground bounds={bounds} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default FloorPlan3DViewer
