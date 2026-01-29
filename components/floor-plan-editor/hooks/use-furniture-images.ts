import { useState, useEffect } from "react";
import type { FurnitureType } from "../types";
import { FURNITURE_TYPES } from "../constants";

export function useFurnitureImages() {
  const [furnitureImages, setFurnitureImages] = useState<Record<FurnitureType, HTMLImageElement | null>>({
    "bed-double": null,
    "bed-single": null,
    "sofa-3seat": null,
    "sofa-2seat": null,
    "armchair": null,
    "table-dining": null,
    "table-coffee": null,
    "toilet": null,
    "sink": null,
    "shower": null,
    "bathtub": null,
    "stove": null,
    "refrigerator": null,
    "dishwasher": null,
    "desk": null,
    "chair": null,
  });

  useEffect(() => {
    // Load SVGs and modify them for proper scaling
    FURNITURE_TYPES.forEach(async (type) => {
      try {
        const response = await fetch(`/furniture-svg/${type}.svg`);
        const svgText = await response.text();

        // Replace existing width/height with 100% for proper scaling in Konva
        const modifiedSvg = svgText
          .replace(/width="[^"]*"/, 'width="100%"')
          .replace(/height="[^"]*"/, 'height="100%"');

        // Create a blob URL from the modified SVG
        const blob = new Blob([modifiedSvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        const img = new window.Image();
        img.onload = () => {
          setFurnitureImages(prev => ({ ...prev, [type]: img }));
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          console.error(`Failed to load furniture SVG image: ${type}`);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } catch (error) {
        console.error(`Failed to fetch furniture SVG: ${type}`, error);
      }
    });
  }, []);

  return furnitureImages;
}
