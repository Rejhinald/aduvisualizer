"use client";

import React, { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Lot } from "@/lib/api/client";
import type { Point } from "@/lib/types";

// Dynamically import Leaflet components (no SSR)
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Polygon = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polygon),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);

interface LotMapViewProps {
  lot: Lot;
  aduBoundary: Point[];
  pixelsPerFoot: number;
  visible: boolean;
  onClose: () => void;
}

// ESRI World Imagery (free satellite tiles)
const SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

/**
 * Convert ADU boundary (canvas pixels) to lat/lng coordinates
 */
function aduToGeoCoordinates(
  aduBoundary: Point[],
  lotCenter: { lat: number; lng: number },
  pixelsPerFoot: number,
  aduOffset: { x: number; y: number }
): Array<[number, number]> {
  // Approximate feet per degree at this latitude
  const feetPerDegreeLat = 364000;
  const feetPerDegreeLng = 364000 * Math.cos((lotCenter.lat * Math.PI) / 180);

  // Find ADU centroid in pixels
  const aduCenterX = aduBoundary.reduce((sum, p) => sum + p.x, 0) / aduBoundary.length;
  const aduCenterY = aduBoundary.reduce((sum, p) => sum + p.y, 0) / aduBoundary.length;

  return aduBoundary.map((point) => {
    // Convert pixel offset from ADU center to feet
    const feetX = (point.x - aduCenterX) / pixelsPerFoot;
    const feetY = (point.y - aduCenterY) / pixelsPerFoot;

    // Add ADU position offset (where ADU is on the lot)
    const totalFeetX = feetX + aduOffset.x;
    const totalFeetY = feetY + aduOffset.y;

    // Convert feet to degrees
    const lng = lotCenter.lng + totalFeetX / feetPerDegreeLng;
    const lat = lotCenter.lat - totalFeetY / feetPerDegreeLat; // Negative because canvas Y is flipped

    return [lat, lng] as [number, number];
  });
}

export function LotMapView({
  lot,
  aduBoundary,
  pixelsPerFoot,
  visible,
  onClose,
}: LotMapViewProps) {
  const [isClient, setIsClient] = useState(false);

  // Only render on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Convert lot boundary to Leaflet format [lat, lng]
  const lotPolygon = useMemo(() => {
    if (!lot.boundaryVertices || lot.boundaryVertices.length < 3) {
      // Create rectangle from dimensions if no boundary
      if (lot.lotWidthFeet && lot.lotDepthFeet) {
        const feetPerDegreeLat = 364000;
        const feetPerDegreeLng = 364000 * Math.cos((lot.geoLat * Math.PI) / 180);
        const halfWidthDeg = lot.lotWidthFeet / 2 / feetPerDegreeLng;
        const halfDepthDeg = lot.lotDepthFeet / 2 / feetPerDegreeLat;

        return [
          [lot.geoLat - halfDepthDeg, lot.geoLng - halfWidthDeg],
          [lot.geoLat - halfDepthDeg, lot.geoLng + halfWidthDeg],
          [lot.geoLat + halfDepthDeg, lot.geoLng + halfWidthDeg],
          [lot.geoLat + halfDepthDeg, lot.geoLng - halfWidthDeg],
        ] as Array<[number, number]>;
      }
      return [];
    }

    return lot.boundaryVertices.map(
      (v) => [v.lat, v.lng] as [number, number]
    );
  }, [lot]);

  // Convert ADU boundary to geo coordinates
  const aduPolygon = useMemo(() => {
    if (aduBoundary.length < 3) return [];

    return aduToGeoCoordinates(
      aduBoundary,
      { lat: lot.geoLat, lng: lot.geoLng },
      pixelsPerFoot,
      { x: lot.aduOffsetX, y: lot.aduOffsetY }
    );
  }, [aduBoundary, lot, pixelsPerFoot]);

  // Calculate map bounds
  const mapCenter = useMemo(
    () => [lot.geoLat, lot.geoLng] as [number, number],
    [lot.geoLat, lot.geoLng]
  );

  if (!visible || !isClient) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-secondary">
          <div>
            <h3 className="font-semibold text-foreground">Satellite View</h3>
            <p className="text-xs text-muted-foreground">
              {lot.address || "Property Location"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary-foreground/10 rounded-md transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Map */}
        <div className="h-[500px] relative">
          <MapContainer
            center={mapCenter}
            zoom={19}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            {/* Satellite imagery */}
            <TileLayer
              url={SATELLITE_TILE_URL}
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              maxZoom={20}
            />
            {/* Labels overlay */}
            <TileLayer
              url={LABELS_TILE_URL}
              attribution=""
              maxZoom={20}
            />

            {/* Lot boundary polygon */}
            {lotPolygon.length >= 3 && (
              <Polygon
                positions={lotPolygon}
                pathOptions={{
                  color: "#3b82f6",
                  weight: 3,
                  fillColor: "#3b82f6",
                  fillOpacity: 0.1,
                  dashArray: "10, 5",
                }}
              />
            )}

            {/* ADU footprint polygon */}
            {aduPolygon.length >= 3 && (
              <Polygon
                positions={aduPolygon}
                pathOptions={{
                  color: "#dc2626",
                  weight: 2,
                  fillColor: "#dc2626",
                  fillOpacity: 0.3,
                }}
              />
            )}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 bg-secondary border-t flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 border-2 border-dashed border-blue-500 bg-blue-500/10" />
            <span>Lot Boundary</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 border-2 border-red-600 bg-red-600/30" />
            <span>ADU Footprint</span>
          </div>
          {lot.lotAreaSqFt && (
            <div className="ml-auto text-muted-foreground">
              Lot: {lot.lotAreaSqFt.toLocaleString()} sq ft
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
