"use client"

import { useEffect, useState, useRef } from "react"
import { Group, Image as KonvaImage } from "react-konva"
import type { Lot } from "../types"
import {
  SATELLITE_TILE_URL,
  FEET_PER_DEGREE_LAT,
  feetPerDegreeLng,
  latLngToTile,
  getTileBounds,
} from "./satellite-utils"

interface SatelliteTileLayerProps {
  lot: Lot
  pixelsPerFoot: number
}

interface LoadedTile {
  image: HTMLImageElement
  x: number
  y: number
  width: number
  height: number
}

/**
 * Loads and renders ESRI World Imagery tiles at 1:1 scale.
 * Tiles are positioned relative to the lot center (0, 0 within parent Group).
 * The parent Group handles the lot offset positioning.
 */
export function SatelliteTileLayer({ lot, pixelsPerFoot }: SatelliteTileLayerProps) {
  const [tiles, setTiles] = useState<LoadedTile[]>([])
  const loadedTilesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!lot.geoLat || !lot.geoLng || !lot.boundary || lot.boundary.length < 3) return

    const zoom = 19 // Good detail for residential lots
    const lotCenter = { lat: lot.geoLat, lng: lot.geoLng }
    const fpdLat = FEET_PER_DEGREE_LAT
    const fpdLng = feetPerDegreeLng(lotCenter.lat)

    // Find lot extent in feet from boundary
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of lot.boundary) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }

    const lotWidthFeet = maxX - minX
    const lotHeightFeet = maxY - minY

    // 50% padding around lot for satellite context
    const paddingFeet = Math.max(lotWidthFeet, lotHeightFeet) * 0.5
    const totalWidthFeet = lotWidthFeet + paddingFeet * 2
    const totalHeightFeet = lotHeightFeet + paddingFeet * 2

    // Convert feet extent to lat/lng bounds for tile fetching
    const halfWidthDeg = totalWidthFeet / 2 / fpdLng
    const halfHeightDeg = totalHeightFeet / 2 / fpdLat

    const north = lotCenter.lat + halfHeightDeg
    const south = lotCenter.lat - halfHeightDeg
    const east = lotCenter.lng + halfWidthDeg
    const west = lotCenter.lng - halfWidthDeg

    // Get tile coordinates that cover the area
    const nwTile = latLngToTile(north, west, zoom)
    const seTile = latLngToTile(south, east, zoom)

    const tilesToLoad: Array<{ tileX: number; tileY: number }> = []
    for (let tileX = nwTile.x; tileX <= seTile.x; tileX++) {
      for (let tileY = nwTile.y; tileY <= seTile.y; tileY++) {
        const key = `${zoom}/${tileX}/${tileY}`
        if (!loadedTilesRef.current.has(key)) {
          tilesToLoad.push({ tileX, tileY })
          loadedTilesRef.current.add(key)
        }
      }
    }

    if (tilesToLoad.length === 0) return

    // Load each tile image and compute its canvas position
    const loadTile = (tileX: number, tileY: number): Promise<LoadedTile | null> => {
      const url = `${SATELLITE_TILE_URL}/${zoom}/${tileY}/${tileX}`

      return new Promise((resolve) => {
        const img = new window.Image()
        img.crossOrigin = "anonymous"

        img.onload = () => {
          const tileBounds = getTileBounds(tileX, tileY, zoom)

          // Convert tile corners from geo to feet (relative to lot center)
          const nwFeetX = (tileBounds.west - lotCenter.lng) * fpdLng
          const nwFeetY = -(tileBounds.north - lotCenter.lat) * fpdLat
          const seFeetX = (tileBounds.east - lotCenter.lng) * fpdLng
          const seFeetY = -(tileBounds.south - lotCenter.lat) * fpdLat

          // Convert feet to canvas pixels (relative to lot center at 0, 0)
          resolve({
            image: img,
            x: nwFeetX * pixelsPerFoot,
            y: nwFeetY * pixelsPerFoot,
            width: (seFeetX - nwFeetX) * pixelsPerFoot,
            height: (seFeetY - nwFeetY) * pixelsPerFoot,
          })
        }

        img.onerror = () => resolve(null)
        img.src = url
      })
    }

    Promise.all(tilesToLoad.map((t) => loadTile(t.tileX, t.tileY))).then(
      (results) => {
        const loaded = results.filter((t): t is LoadedTile => t !== null)
        setTiles((prev) => [...prev, ...loaded])
      }
    )
  }, [lot.geoLat, lot.geoLng, lot.boundary, pixelsPerFoot])

  return (
    <Group>
      {tiles.map((tile, i) => (
        <KonvaImage
          key={i}
          image={tile.image}
          x={tile.x}
          y={tile.y}
          width={tile.width}
          height={tile.height}
          opacity={0.85}
          listening={false}
        />
      ))}
    </Group>
  )
}
