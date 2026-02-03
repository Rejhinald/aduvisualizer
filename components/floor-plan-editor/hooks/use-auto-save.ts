import { useState, useCallback, useRef, useEffect } from "react";
import type { Room, Door, Window, Point } from "@/lib/types";
import type { Furniture, CanvasConfig } from "../types";

interface EditorData {
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  furniture: Furniture[];
  aduBoundary: Point[];
  pixelsPerFoot: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface UseAutoSaveOptions {
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  furniture: Furniture[];
  aduBoundary: Point[];
  config: CanvasConfig;
  isSaving: boolean;
  saveToCloud: (data: EditorData) => Promise<boolean>;
  debounceMs?: number;
}

export function useAutoSave({
  rooms,
  doors,
  windows,
  furniture,
  aduBoundary,
  config,
  isSaving,
  saveToCloud,
  debounceMs = 2000,
}: UseAutoSaveOptions) {
  const { pixelsPerFoot, displaySize } = config;

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const lastSaveHashRef = useRef<string>("");

  // Generate a hash of current state to detect actual changes
  const getStateHash = useCallback(() => {
    return JSON.stringify({
      rooms: rooms.map(r => ({ id: r.id, vertices: r.vertices, name: r.name, type: r.type })),
      doors: doors.map(d => ({ id: d.id, position: d.position, width: d.width, rotation: d.rotation, type: d.type })),
      windows: windows.map(w => ({ id: w.id, position: w.position, width: w.width, rotation: w.rotation })),
      furniture: furniture.map(f => ({ id: f.id, position: f.position, width: f.width, height: f.height, rotation: f.rotation })),
      boundary: aduBoundary,
    });
  }, [rooms, doors, windows, furniture, aduBoundary]);

  // Manual save function
  const saveNow = useCallback(async () => {
    const editorData = {
      rooms,
      doors,
      windows,
      furniture,
      aduBoundary,
      pixelsPerFoot,
      canvasWidth: displaySize,
      canvasHeight: displaySize,
    };
    const success = await saveToCloud(editorData);
    if (success) {
      lastSaveHashRef.current = getStateHash();
    }
    return success;
  }, [rooms, doors, windows, furniture, aduBoundary, pixelsPerFoot, displaySize, saveToCloud, getStateHash]);

  // Debounced auto-save effect
  useEffect(() => {
    // Skip initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      lastSaveHashRef.current = getStateHash();
      return;
    }

    // Skip if auto-save disabled or already saving
    if (!autoSaveEnabled || isSaving) return;

    // Skip if no actual changes (compare hash)
    const currentHash = getStateHash();
    if (currentHash === lastSaveHashRef.current) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new debounced save
    autoSaveTimerRef.current = setTimeout(async () => {
      console.log("[AutoSave] Saving changes...");
      const success = await saveToCloud({
        rooms,
        doors,
        windows,
        furniture,
        aduBoundary,
        pixelsPerFoot,
        canvasWidth: displaySize,
        canvasHeight: displaySize,
      });
      if (success) {
        lastSaveHashRef.current = currentHash;
        console.log("[AutoSave] Saved successfully");
      }
    }, debounceMs);

    // Cleanup
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [rooms, doors, windows, furniture, aduBoundary, autoSaveEnabled, isSaving, saveToCloud, pixelsPerFoot, displaySize, getStateHash, debounceMs]);

  return {
    autoSaveEnabled,
    setAutoSaveEnabled,
    saveNow,
  };
}
