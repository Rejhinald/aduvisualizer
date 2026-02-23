/**
 * Satellite tile utilities for ESRI World Imagery
 * Ported from v1 lot-overlay.tsx
 */

import type { Point } from "../types"

// ESRI World Imagery tile server
export const SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile"

// Approximate feet per degree (Haversine)
export const FEET_PER_DEGREE_LAT = 364000

export function feetPerDegreeLng(lat: number): number {
  return 364000 * Math.cos((lat * Math.PI) / 180)
}

/**
 * Convert lat/lng to Web Mercator tile coordinates
 */
export function latLngToTile(
  lat: number,
  lng: number,
  zoom: number
): { x: number; y: number } {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
  )
  return { x, y }
}

/**
 * Convert tile coordinates back to lat/lng (NW corner of tile)
 */
export function tileToLatLng(
  x: number,
  y: number,
  zoom: number
): { lat: number; lng: number } {
  const n = Math.pow(2, zoom)
  const lng = (x / n) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))
  const lat = (latRad * 180) / Math.PI
  return { lat, lng }
}

/**
 * Calculate the lat/lng bounds of a tile
 */
export function getTileBounds(x: number, y: number, zoom: number) {
  const nw = tileToLatLng(x, y, zoom)
  const se = tileToLatLng(x + 1, y + 1, zoom)
  return { north: nw.lat, south: se.lat, east: se.lng, west: nw.lng }
}

/**
 * Convert a point in feet (relative to lot center) to geographic coordinates
 */
export function feetToGeo(
  point: Point,
  center: { lat: number; lng: number }
): { lat: number; lng: number } {
  const fpdLng = feetPerDegreeLng(center.lat)
  return {
    lng: center.lng + point.x / fpdLng,
    lat: center.lat - point.y / FEET_PER_DEGREE_LAT, // Negative: canvas Y down, lat up
  }
}

/**
 * Convert a geographic vertex to feet relative to lot center
 */
export function geoToFeet(
  vertex: { lat: number; lng: number },
  center: { lat: number; lng: number }
): Point {
  const fpdLng = feetPerDegreeLng(center.lat)
  return {
    x: (vertex.lng - center.lng) * fpdLng,
    y: -(vertex.lat - center.lat) * FEET_PER_DEGREE_LAT, // Negative: canvas Y down
  }
}
