import { useMemo } from "react";
import type { CanvasConfig } from "../types";

export function useCanvasConfig(): CanvasConfig {
  return useMemo(() => {
    const maxCanvasFeet = 36;
    const displaySize = 800;
    const extendedGridFeet = maxCanvasFeet * 3;
    const pixelsPerFoot = displaySize / maxCanvasFeet;
    const gridSize = pixelsPerFoot;
    const extendedCanvasSize = extendedGridFeet * gridSize;

    return {
      maxCanvasFeet,
      displaySize,
      extendedGridFeet,
      pixelsPerFoot,
      gridSize,
      extendedCanvasSize,
    };
  }, []);
}
