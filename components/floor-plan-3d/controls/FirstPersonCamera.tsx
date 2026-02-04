"use client"

/**
 * First-person perspective camera with PointerLock and WASD controls
 */

import { useRef, useEffect, useState, useCallback } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { PointerLockControls, PerspectiveCamera } from "@react-three/drei"
import * as THREE from "three"
import { CAMERA } from "../constants"

interface FirstPersonCameraProps {
  initialPosition: THREE.Vector3
  initialRotation: number // degrees
  fov: 30 | 60 | 90
  eyeHeight: number
  onLockChange?: (isLocked: boolean) => void
}

export function FirstPersonCamera({
  initialPosition,
  initialRotation,
  fov,
  eyeHeight,
  onLockChange,
}: FirstPersonCameraProps) {
  const controlsRef = useRef<any>(null)
  const { camera, gl } = useThree()

  // Movement state
  const [moveForward, setMoveForward] = useState(false)
  const [moveBackward, setMoveBackward] = useState(false)
  const [moveLeft, setMoveLeft] = useState(false)
  const [moveRight, setMoveRight] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  const velocity = useRef(new THREE.Vector3())
  const direction = useRef(new THREE.Vector3())

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          setMoveForward(true)
          break
        case "KeyS":
        case "ArrowDown":
          setMoveBackward(true)
          break
        case "KeyA":
        case "ArrowLeft":
          setMoveLeft(true)
          break
        case "KeyD":
        case "ArrowRight":
          setMoveRight(true)
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          setMoveForward(false)
          break
        case "KeyS":
        case "ArrowDown":
          setMoveBackward(false)
          break
        case "KeyA":
        case "ArrowLeft":
          setMoveLeft(false)
          break
        case "KeyD":
        case "ArrowRight":
          setMoveRight(false)
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  // Handle pointer lock changes
  const handleLock = useCallback(() => {
    setIsLocked(true)
    onLockChange?.(true)
  }, [onLockChange])

  const handleUnlock = useCallback(() => {
    setIsLocked(false)
    onLockChange?.(false)
    // Reset movement when unlocked
    setMoveForward(false)
    setMoveBackward(false)
    setMoveLeft(false)
    setMoveRight(false)
  }, [onLockChange])

  // Set initial camera rotation
  useEffect(() => {
    if (controlsRef.current && camera) {
      // Convert degrees to radians for initial facing direction
      const radians = (initialRotation * Math.PI) / 180
      // PointerLockControls uses Euler angles, we need to set the camera rotation
      camera.rotation.set(0, -radians + Math.PI / 2, 0, "YXZ")
    }
  }, [camera, initialRotation])

  // Movement loop
  useFrame((state, delta) => {
    if (!isLocked) return

    // Calculate movement direction based on camera orientation
    direction.current.z = Number(moveForward) - Number(moveBackward)
    direction.current.x = Number(moveRight) - Number(moveLeft)
    direction.current.normalize()

    const speed = CAMERA.MOVE_SPEED * delta

    // Apply movement in camera's local space
    if (moveForward || moveBackward) {
      velocity.current.z = -direction.current.z * speed
    } else {
      velocity.current.z *= 0.9 // Damping
    }

    if (moveLeft || moveRight) {
      velocity.current.x = direction.current.x * speed
    } else {
      velocity.current.x *= 0.9 // Damping
    }

    // Move the camera
    if (controlsRef.current) {
      controlsRef.current.moveForward(-velocity.current.z)
      controlsRef.current.moveRight(velocity.current.x)

      // Keep the camera at eye height
      state.camera.position.y = eyeHeight
    }
  })

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[initialPosition.x, eyeHeight, initialPosition.z]}
        fov={fov}
        near={CAMERA.FIRST_PERSON_NEAR}
        far={CAMERA.FIRST_PERSON_FAR}
      />
      <PointerLockControls
        ref={controlsRef}
        onLock={handleLock}
        onUnlock={handleUnlock}
      />
    </>
  )
}

/**
 * Instructions overlay for first-person controls
 */
export function FirstPersonInstructions({
  isLocked,
  onClick,
}: {
  isLocked: boolean
  onClick: () => void
}) {
  if (isLocked) {
    return (
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
        <p>WASD or Arrow Keys to move</p>
        <p>Mouse to look around</p>
        <p>Press ESC to exit</p>
      </div>
    )
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
      onClick={onClick}
    >
      <div className="bg-white/90 dark:bg-gray-800/90 px-8 py-6 rounded-xl shadow-lg text-center">
        <h3 className="text-xl font-semibold mb-2">First-Person View</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Click anywhere to enter walkthrough mode
        </p>
        <p className="text-sm text-gray-500">
          Use WASD to move, mouse to look around
        </p>
      </div>
    </div>
  )
}
