/**
 * Hook for converting between canvas coordinates (pixels) and Three.js coordinates (feet)
 *
 * Canvas coordinate system:
 * - Origin: top-left
 * - X: increases to the right
 * - Y: increases downward
 * - Units: pixels
 *
 * Three.js coordinate system:
 * - Origin: center of the floor plan
 * - X: increases to the right (same as canvas)
 * - Y: increases upward (height)
 * - Z: increases toward camera (negative Z = into screen, which maps to canvas Y)
 * - Units: feet
 */

import { useMemo, useCallback } from "react"
import type { Point } from "@/lib/types"
import type { Point3D, CoordinateConfig } from "../types"

export function useCoordinateConversion(config: CoordinateConfig) {
  // Calculate the center of the canvas in feet
  const canvasCenter = useMemo(() => {
    const centerXFeet = config.canvasWidth / config.pixelsPerFoot / 2
    const centerYFeet = config.canvasHeight / config.pixelsPerFoot / 2
    return { x: centerXFeet, y: centerYFeet }
  }, [config.canvasWidth, config.canvasHeight, config.pixelsPerFoot])

  // Convert a canvas point (pixels) to Three.js coordinates (feet)
  const canvasToThree = useCallback(
    (point: Point, height: number = 0): Point3D => {
      const xFeet = point.x / config.pixelsPerFoot
      const yFeet = point.y / config.pixelsPerFoot

      return {
        x: xFeet - canvasCenter.x, // X stays X (left-right)
        y: height, // Y is height (passed in)
        z: -(yFeet - canvasCenter.y), // Canvas Y becomes -Z (flip for Three.js)
      }
    },
    [config.pixelsPerFoot, canvasCenter]
  )

  // Convert Three.js coordinates back to canvas (for debugging)
  const threeToCanvas = useCallback(
    (point: Point3D): Point => {
      const xFeet = point.x + canvasCenter.x
      const yFeet = -point.z + canvasCenter.y

      return {
        x: xFeet * config.pixelsPerFoot,
        y: yFeet * config.pixelsPerFoot,
      }
    },
    [config.pixelsPerFoot, canvasCenter]
  )

  // Convert pixels to feet
  const pixelsToFeet = useCallback(
    (pixels: number): number => {
      return pixels / config.pixelsPerFoot
    },
    [config.pixelsPerFoot]
  )

  // Convert feet to pixels
  const feetToPixels = useCallback(
    (feet: number): number => {
      return feet * config.pixelsPerFoot
    },
    [config.pixelsPerFoot]
  )

  // Convert canvas rotation (degrees, 0=right) to Three.js rotation (radians, Y-axis)
  const canvasRotationToThree = useCallback((degrees: number): number => {
    // Canvas rotation: 0=right, 90=down, 180=left, 270=up
    // Three.js Y rotation: 0=positive Z, positive=counter-clockwise from above
    // We need to flip the direction and adjust for the Z-flip
    return -((degrees * Math.PI) / 180)
  }, [])

  // Convert an array of canvas points to Three.js floor polygon
  const canvasPolygonToThree = useCallback(
    (vertices: Point[]): Point3D[] => {
      return vertices.map((v) => canvasToThree(v, 0))
    },
    [canvasToThree]
  )

  // Calculate the bounding box of a set of 3D points (ignoring Y)
  const calculateBoundingBox = useCallback(
    (
      points: Point3D[]
    ): {
      minX: number
      maxX: number
      minZ: number
      maxZ: number
      width: number
      depth: number
    } => {
      if (points.length === 0) {
        return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, width: 0, depth: 0 }
      }

      const xs = points.map((p) => p.x)
      const zs = points.map((p) => p.z)

      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minZ = Math.min(...zs)
      const maxZ = Math.max(...zs)

      return {
        minX,
        maxX,
        minZ,
        maxZ,
        width: maxX - minX,
        depth: maxZ - minZ,
      }
    },
    []
  )

  // Calculate the centroid of a polygon
  const calculateCentroid = useCallback((points: Point3D[]): Point3D => {
    if (points.length === 0) {
      return { x: 0, y: 0, z: 0 }
    }

    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
      { x: 0, y: 0, z: 0 }
    )

    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
      z: sum.z / points.length,
    }
  }, [])

  return {
    canvasToThree,
    threeToCanvas,
    pixelsToFeet,
    feetToPixels,
    canvasRotationToThree,
    canvasPolygonToThree,
    calculateBoundingBox,
    calculateCentroid,
    canvasCenter,
    config,
  }
}

export type CoordinateConverter = ReturnType<typeof useCoordinateConversion>
