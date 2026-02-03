"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface EditorSettings {
  // Lot overlay settings
  showLotOverlay: boolean;
  showSatelliteView: boolean;
  showLotBoundary: boolean;
  // Grid settings
  showGrid: boolean;
  // Camera settings
  zoom: number;
  panOffsetX: number;
  panOffsetY: number;
}

const DEFAULT_SETTINGS: EditorSettings = {
  showLotOverlay: false,
  showSatelliteView: false,
  showLotBoundary: true,
  showGrid: true,
  zoom: 1,
  panOffsetX: 0,
  panOffsetY: 0,
};

/**
 * Hook to persist editor settings to localStorage
 * Settings are keyed by blueprintId so each project remembers its own state
 */
export function useEditorSettings(blueprintId?: string) {
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Storage key based on blueprint ID
  const storageKey = blueprintId ? `editor-settings-${blueprintId}` : null;

  // Load settings from localStorage on mount
  useEffect(() => {
    if (!storageKey) {
      setIsLoaded(true);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<EditorSettings>;
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn("Failed to load editor settings:", e);
    }
    setIsLoaded(true);
  }, [storageKey]);

  // Save settings to localStorage (debounced)
  const saveSettings = useCallback((newSettings: Partial<EditorSettings>) => {
    if (!storageKey) return;

    setSettings(prev => {
      const updated = { ...prev, ...newSettings };

      // Debounce save to avoid excessive writes
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (e) {
          console.warn("Failed to save editor settings:", e);
        }
      }, 300);

      return updated;
    });
  }, [storageKey]);

  // Individual setters that also save
  const setShowLotOverlay = useCallback((value: boolean) => {
    saveSettings({ showLotOverlay: value });
  }, [saveSettings]);

  const setShowSatelliteView = useCallback((value: boolean) => {
    saveSettings({ showSatelliteView: value });
  }, [saveSettings]);

  const setShowLotBoundary = useCallback((value: boolean) => {
    saveSettings({ showLotBoundary: value });
  }, [saveSettings]);

  const setShowGrid = useCallback((value: boolean) => {
    saveSettings({ showGrid: value });
  }, [saveSettings]);

  const setZoom = useCallback((value: number) => {
    saveSettings({ zoom: value });
  }, [saveSettings]);

  const setPanOffset = useCallback((x: number, y: number) => {
    saveSettings({ panOffsetX: x, panOffsetY: y });
  }, [saveSettings]);

  // Update camera settings (zoom + pan together)
  const setCameraSettings = useCallback((zoom: number, panX: number, panY: number) => {
    saveSettings({ zoom, panOffsetX: panX, panOffsetY: panY });
  }, [saveSettings]);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn("Failed to clear editor settings:", e);
      }
    }
  }, [storageKey]);

  return {
    settings,
    isLoaded,
    setShowLotOverlay,
    setShowSatelliteView,
    setShowLotBoundary,
    setShowGrid,
    setZoom,
    setPanOffset,
    setCameraSettings,
    resetSettings,
  };
}
