"use client";

import React, { useMemo, useEffect, useState, useRef } from "react";
import { Line, Group, Text, Rect, Image as KonvaImage } from "react-konva";
import type { Point } from "@/lib/types";
import type { GeoVertex, Lot } from "@/lib/api/client";
import type { CanvasConfig } from "../types";

interface LotOverlayProps {
  config: CanvasConfig;
  lot: Lot;
  aduBoundary: Point[];
  canvasCenter: Point;
  visible: boolean;
  showSatellite?: boolean;
  showLotBoundary?: boolean;
}

// ESRI World Imagery tile server
const SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

/**
 * Convert lat/lng to Web Mercator tile coordinates
 */
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

/**
 * Convert tile coordinates back to lat/lng (NW corner of tile)
 */
function tileToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const n = Math.pow(2, zoom);
  const lng = x / n * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const lat = latRad * 180 / Math.PI;
  return { lat, lng };
}

/**
 * Calculate the bounds of a tile in lat/lng
 */
function getTileBounds(x: number, y: number, zoom: number) {
  const nw = tileToLatLng(x, y, zoom);
  const se = tileToLatLng(x + 1, y + 1, zoom);
  return { north: nw.lat, south: se.lat, east: se.lng, west: nw.lng };
}

/**
 * Calculate meters per pixel at a given latitude and zoom level
 */
function getMetersPerPixel(lat: number, zoom: number): number {
  const earthCircumference = 40075016.686; // meters at equator
  const metersPerPixel = earthCircumference * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom + 8);
  return metersPerPixel;
}

/**
 * Convert lot boundary from geo coordinates to canvas pixels
 *
 * This uses a simplified conversion that assumes:
 * 1. The lot is small enough that Earth curvature is negligible
 * 2. We're using the lot center as the reference point
 *
 * The conversion uses the Haversine-derived feet-per-degree approximations:
 * - 1 degree latitude ≈ 364,000 feet (varies slightly by latitude)
 * - 1 degree longitude ≈ 364,000 * cos(latitude) feet
 *
 * NOTE: The lot boundary stays FIXED at canvas center.
 * The ADU position offset is applied to the ADU rendering, not the lot.
 */
function geoToCanvasPixels(
  geoVertices: GeoVertex[],
  lotCenter: { lat: number; lng: number },
  lotRotation: number,
  pixelsPerFoot: number,
  canvasCenter: Point
): Point[] {
  // Approximate feet per degree at this latitude
  const feetPerDegreeLat = 364000;
  const feetPerDegreeLng = 364000 * Math.cos((lotCenter.lat * Math.PI) / 180);

  // Convert lot rotation to radians
  const lotRotRad = (lotRotation * Math.PI) / 180;

  return geoVertices.map((vertex) => {
    // Convert geo offset from lot center to feet
    const deltaLat = vertex.lat - lotCenter.lat;
    const deltaLng = vertex.lng - lotCenter.lng;

    let feetX = deltaLng * feetPerDegreeLng;
    let feetY = -deltaLat * feetPerDegreeLat; // Negative because canvas Y increases downward

    // Apply lot rotation around lot center
    if (lotRotation !== 0) {
      const cos = Math.cos(lotRotRad);
      const sin = Math.sin(lotRotRad);
      const rotatedX = feetX * cos - feetY * sin;
      const rotatedY = feetX * sin + feetY * cos;
      feetX = rotatedX;
      feetY = rotatedY;
    }

    // Convert feet to pixels - lot is centered on canvas
    const pixelX = canvasCenter.x + feetX * pixelsPerFoot;
    const pixelY = canvasCenter.y + feetY * pixelsPerFoot;

    return { x: pixelX, y: pixelY };
  });
}

/**
 * Calculate setback boundary (inset polygon)
 * This creates a simplified rectangular setback area
 *
 * Canvas coordinates: Y increases downward
 * - minY = top of lot (back/rear)
 * - maxY = bottom of lot (front/street-facing)
 */
function calculateSetbackBoundary(
  lotBoundary: Point[],
  setbacks: {
    front: number;
    back: number;
    left: number;
    right: number;
  },
  pixelsPerFoot: number
): Point[] {
  if (lotBoundary.length < 3) return [];

  // Find bounding box of lot
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const p of lotBoundary) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  // Check for valid bounding box
  if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
    return [];
  }

  // Apply setbacks (convert feet to pixels)
  const frontPx = (setbacks.front || 0) * pixelsPerFoot;
  const backPx = (setbacks.back || 0) * pixelsPerFoot;
  const leftPx = (setbacks.left || 0) * pixelsPerFoot;
  const rightPx = (setbacks.right || 0) * pixelsPerFoot;

  // Create inset rectangle
  // In canvas coords: minY is top (back), maxY is bottom (front/street)
  const insetMinX = minX + leftPx;
  const insetMaxX = maxX - rightPx;
  const insetMinY = minY + backPx;   // Back setback from top
  const insetMaxY = maxY - frontPx;  // Front setback from bottom

  // Ensure valid rectangle (setbacks don't exceed lot size)
  if (insetMinX >= insetMaxX || insetMinY >= insetMaxY) {
    return [];
  }

  return [
    { x: insetMinX, y: insetMinY },  // top-left
    { x: insetMaxX, y: insetMinY },  // top-right
    { x: insetMaxX, y: insetMaxY },  // bottom-right
    { x: insetMinX, y: insetMaxY },  // bottom-left
  ];
}

/**
 * Check if ADU fits within setback boundary
 */
function checkAduFit(
  aduBoundary: Point[],
  setbackBoundary: Point[]
): { fits: boolean; overlapArea: number } {
  if (aduBoundary.length < 3 || setbackBoundary.length < 3) {
    return { fits: true, overlapArea: 0 };
  }

  // Find bounding boxes
  let aduMinX = Infinity, aduMaxX = -Infinity;
  let aduMinY = Infinity, aduMaxY = -Infinity;
  let setbackMinX = Infinity, setbackMaxX = -Infinity;
  let setbackMinY = Infinity, setbackMaxY = -Infinity;

  for (const p of aduBoundary) {
    if (p.x < aduMinX) aduMinX = p.x;
    if (p.x > aduMaxX) aduMaxX = p.x;
    if (p.y < aduMinY) aduMinY = p.y;
    if (p.y > aduMaxY) aduMaxY = p.y;
  }

  for (const p of setbackBoundary) {
    if (p.x < setbackMinX) setbackMinX = p.x;
    if (p.x > setbackMaxX) setbackMaxX = p.x;
    if (p.y < setbackMinY) setbackMinY = p.y;
    if (p.y > setbackMaxY) setbackMaxY = p.y;
  }

  // Check if ADU is fully inside setback boundary
  const fits = aduMinX >= setbackMinX &&
               aduMaxX <= setbackMaxX &&
               aduMinY >= setbackMinY &&
               aduMaxY <= setbackMaxY;

  // Calculate overlap area (simplified)
  const overlapX = Math.max(0, Math.min(aduMaxX, setbackMaxX) - Math.max(aduMinX, setbackMinX));
  const overlapY = Math.max(0, Math.min(aduMaxY, setbackMaxY) - Math.max(aduMinY, setbackMinY));
  const overlapArea = fits ? 0 : Math.max(0, (aduMaxX - aduMinX) * (aduMaxY - aduMinY) - overlapX * overlapY);

  return { fits, overlapArea };
}

/**
 * Component to load and render satellite tiles
 */
function SatelliteTileLayer({
  lot,
  lotBoundaryPixels,
  pixelsPerFoot,
  canvasCenter,
}: {
  lot: Lot;
  lotBoundaryPixels: Point[];
  pixelsPerFoot: number;
  canvasCenter: Point;
}) {
  const [tiles, setTiles] = useState<Array<{
    image: HTMLImageElement;
    x: number;
    y: number;
    width: number;
    height: number;
  }>>([]);
  const loadedTilesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (lotBoundaryPixels.length < 3) return;

    // Determine zoom level based on lot size (higher zoom = more detail)
    const zoom = 19; // Good detail for residential lots

    // Get lot bounds in lat/lng
    const lotCenter = { lat: lot.geoLat, lng: lot.geoLng };

    // Find the bounding box of the lot in canvas pixels
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const p of lotBoundaryPixels) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    // Calculate lot extent in feet
    const lotWidthPx = maxX - minX;
    const lotHeightPx = maxY - minY;
    const lotWidthFeet = lotWidthPx / pixelsPerFoot;
    const lotHeightFeet = lotHeightPx / pixelsPerFoot;

    // Add some padding around the lot (50% extra)
    const paddingFeet = Math.max(lotWidthFeet, lotHeightFeet) * 0.5;
    const totalWidthFeet = lotWidthFeet + paddingFeet * 2;
    const totalHeightFeet = lotHeightFeet + paddingFeet * 2;

    // Calculate lat/lng bounds for tiles
    const feetPerDegreeLat = 364000;
    const feetPerDegreeLng = 364000 * Math.cos((lotCenter.lat * Math.PI) / 180);

    const halfWidthDeg = (totalWidthFeet / 2) / feetPerDegreeLng;
    const halfHeightDeg = (totalHeightFeet / 2) / feetPerDegreeLat;

    const north = lotCenter.lat + halfHeightDeg;
    const south = lotCenter.lat - halfHeightDeg;
    const east = lotCenter.lng + halfWidthDeg;
    const west = lotCenter.lng - halfWidthDeg;

    // Get tile coordinates that cover the area
    const nwTile = latLngToTile(north, west, zoom);
    const seTile = latLngToTile(south, east, zoom);

    const tilesToLoad: Array<{ tileX: number; tileY: number; zoom: number }> = [];

    for (let tileX = nwTile.x; tileX <= seTile.x; tileX++) {
      for (let tileY = nwTile.y; tileY <= seTile.y; tileY++) {
        const key = `${zoom}/${tileX}/${tileY}`;
        if (!loadedTilesRef.current.has(key)) {
          tilesToLoad.push({ tileX, tileY, zoom });
          loadedTilesRef.current.add(key);
        }
      }
    }

    // Load tiles
    const loadTile = async (tileX: number, tileY: number, zoom: number) => {
      const url = `${SATELLITE_TILE_URL}/${zoom}/${tileY}/${tileX}`;

      return new Promise<{
        image: HTMLImageElement;
        x: number;
        y: number;
        width: number;
        height: number;
      } | null>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
          // Calculate tile bounds
          const tileBounds = getTileBounds(tileX, tileY, zoom);

          // Convert tile corners to canvas coordinates
          // Use the same conversion as lot boundary
          const tileNWLat = tileBounds.north;
          const tileNWLng = tileBounds.west;
          const tileSELat = tileBounds.south;
          const tileSELng = tileBounds.east;

          // Convert to feet from lot center
          const nwFeetX = (tileNWLng - lotCenter.lng) * feetPerDegreeLng;
          const nwFeetY = -(tileNWLat - lotCenter.lat) * feetPerDegreeLat;
          const seFeetX = (tileSELng - lotCenter.lng) * feetPerDegreeLng;
          const seFeetY = -(tileSELat - lotCenter.lat) * feetPerDegreeLat;

          // Convert to canvas pixels (satellite stays fixed with lot, no offset)
          const canvasNWX = canvasCenter.x + nwFeetX * pixelsPerFoot;
          const canvasNWY = canvasCenter.y + nwFeetY * pixelsPerFoot;
          const canvasSEX = canvasCenter.x + seFeetX * pixelsPerFoot;
          const canvasSEY = canvasCenter.y + seFeetY * pixelsPerFoot;

          resolve({
            image: img,
            x: canvasNWX,
            y: canvasNWY,
            width: canvasSEX - canvasNWX,
            height: canvasSEY - canvasNWY,
          });
        };

        img.onerror = () => {
          resolve(null);
        };

        img.src = url;
      });
    };

    // Load all tiles
    Promise.all(tilesToLoad.map(t => loadTile(t.tileX, t.tileY, t.zoom)))
      .then(results => {
        const loadedTiles = results.filter((t): t is NonNullable<typeof t> => t !== null);
        setTiles(prev => [...prev, ...loadedTiles]);
      });

  }, [lot.geoLat, lot.geoLng, lotBoundaryPixels, pixelsPerFoot, canvasCenter]);

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
  );
}

export function LotOverlay({
  config,
  lot,
  aduBoundary,
  canvasCenter,
  visible,
  showSatellite = false,
  showLotBoundary = true,
}: LotOverlayProps) {
  const { pixelsPerFoot } = config;

  // Convert lot boundary to canvas pixels (LOT STAYS FIXED at canvas center)
  const lotBoundaryPixels = useMemo(() => {
    if (!lot.boundaryVertices || lot.boundaryVertices.length < 3) {
      // If no boundary vertices, create a rectangle from dimensions
      if (lot.lotWidthFeet && lot.lotDepthFeet) {
        const halfWidth = (lot.lotWidthFeet / 2) * pixelsPerFoot;
        const halfDepth = (lot.lotDepthFeet / 2) * pixelsPerFoot;

        // Lot is centered on canvas (no offset applied here)
        return [
          { x: canvasCenter.x - halfWidth, y: canvasCenter.y - halfDepth },
          { x: canvasCenter.x + halfWidth, y: canvasCenter.y - halfDepth },
          { x: canvasCenter.x + halfWidth, y: canvasCenter.y + halfDepth },
          { x: canvasCenter.x - halfWidth, y: canvasCenter.y + halfDepth },
        ];
      }
      return [];
    }

    return geoToCanvasPixels(
      lot.boundaryVertices,
      { lat: lot.geoLat, lng: lot.geoLng },
      lot.geoRotation,
      pixelsPerFoot,
      canvasCenter
    );
  }, [lot.boundaryVertices, lot.geoLat, lot.geoLng, lot.geoRotation, pixelsPerFoot, canvasCenter]);

  // Calculate setback boundary
  const setbackBoundaryPixels = useMemo(() => {
    if (lotBoundaryPixels.length < 3) return [];

    return calculateSetbackBoundary(
      lotBoundaryPixels,
      {
        front: lot.setbackFrontFeet ?? 0,
        back: lot.setbackBackFeet ?? 4,
        left: lot.setbackLeftFeet ?? 4,
        right: lot.setbackRightFeet ?? 4,
      },
      pixelsPerFoot
    );
  }, [lotBoundaryPixels, lot.setbackFrontFeet, lot.setbackBackFeet, lot.setbackLeftFeet, lot.setbackRightFeet, pixelsPerFoot]);

  // Check if ADU fits
  const { fits: aduFits } = useMemo(() => {
    return checkAduFit(aduBoundary, setbackBoundaryPixels);
  }, [aduBoundary, setbackBoundaryPixels]);

  // Calculate lot dimensions label position
  const lotLabelPosition = useMemo(() => {
    if (lotBoundaryPixels.length < 1) return { x: 0, y: 0 };
    // Position label at top-left of lot boundary
    let minX = Infinity, minY = Infinity;
    for (const p of lotBoundaryPixels) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
    }
    return { x: minX, y: minY - 25 };
  }, [lotBoundaryPixels]);

  if (!visible || lotBoundaryPixels.length < 3) {
    return null;
  }

  // Flatten points for Line component
  const lotFlatPoints = lotBoundaryPixels.flatMap(p => [p.x, p.y]);
  const setbackFlatPoints = setbackBoundaryPixels.flatMap(p => [p.x, p.y]);

  return (
    <Group>
      {/* Satellite imagery layer (behind everything) */}
      {showSatellite && (
        <SatelliteTileLayer
          lot={lot}
          lotBoundaryPixels={lotBoundaryPixels}
          pixelsPerFoot={pixelsPerFoot}
          canvasCenter={canvasCenter}
        />
      )}

      {/* Lot boundary (conditionally shown) */}
      {showLotBoundary && (
        <>
          {/* Lot boundary fill (semi-transparent) */}
          <Line
            points={lotFlatPoints}
            closed
            fill={showSatellite ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.05)"}
            listening={false}
          />

          {/* Lot boundary outline */}
          <Line
            points={lotFlatPoints}
            closed
            stroke="#3b82f6"
            strokeWidth={2}
            dash={[15, 8]}
            listening={false}
          />

          {/* Lot label */}
          <Group x={lotLabelPosition.x} y={lotLabelPosition.y}>
            <Rect
              x={0}
              y={0}
              width={120}
              height={20}
              fill="rgba(59, 130, 246, 0.9)"
              cornerRadius={3}
            />
            <Text
              x={5}
              y={4}
              text="LOT BOUNDARY"
              fontSize={11}
              fill="#ffffff"
              fontStyle="bold"
              listening={false}
            />
          </Group>
        </>
      )}


      {/* Lot dimensions */}
      {lot.lotWidthFeet && lot.lotDepthFeet && (
        <Text
          x={lotLabelPosition.x + 125}
          y={lotLabelPosition.y + 4}
          text={`${Math.round(lot.lotWidthFeet)}' × ${Math.round(lot.lotDepthFeet)}'`}
          fontSize={11}
          fill="#3b82f6"
          fontStyle="bold"
          listening={false}
        />
      )}
    </Group>
  );
}
