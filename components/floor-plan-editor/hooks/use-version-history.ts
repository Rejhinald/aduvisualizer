import { useState, useCallback, useEffect, useRef } from "react";
import type { Room, Door, Window, Point } from "@/lib/types";
import type { Furniture } from "../types";
import * as api from "@/lib/api/client";

// Editor view settings that get saved with snapshots
interface EditorViewSettings {
  showLotOverlay: boolean;
  showSatelliteView: boolean;
  showLotBoundary: boolean;
  showGrid: boolean;
  zoom: number;
  panOffsetX: number;
  panOffsetY: number;
}

// Lot data that gets saved with snapshots (excluding server-managed fields)
interface GeoVertex {
  lat: number;
  lng: number;
}

interface LotSnapshotData {
  parcelNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  geoLat: number;
  geoLng: number;
  geoRotation: number;
  boundaryVertices?: GeoVertex[];
  lotWidthFeet?: number;
  lotDepthFeet?: number;
  lotAreaSqFt?: number;
  aduOffsetX: number;
  aduOffsetY: number;
  aduRotation: number;
  setbackFrontFeet: number;
  setbackBackFeet: number;
  setbackLeftFeet: number;
  setbackRightFeet: number;
  dataSource?: string;
}

interface EditorSnapshot {
  id: string;
  timestamp: string;
  type: "auto" | "manual";
  label?: string;
  data: {
    rooms: Room[];
    doors: Door[];
    windows: Window[];
    furniture: Furniture[];
    aduBoundary: Point[];
    // Editor view settings (optional for backward compatibility with old snapshots)
    editorSettings?: EditorViewSettings;
    // Lot data (optional for backward compatibility with old snapshots)
    lotData?: LotSnapshotData;
  };
}

interface VersionHistoryState {
  autoSaves: EditorSnapshot[];
  manualSaves: EditorSnapshot[];
}

const LOCAL_STORAGE_KEY = "aduvisualizer:versionHistory";
const MAX_AUTO_SAVES = 6; // Keep last 6 auto-saves (1 hour at 10-min intervals)
const MAX_MANUAL_SAVES = 10; // Keep last 10 manual saves
const AUTO_SAVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

interface UseVersionHistoryOptions {
  projectId?: string;
  blueprintId?: string;
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  furniture: Furniture[];
  aduBoundary: Point[];
  // Current editor settings for saving with snapshots
  editorSettings?: EditorViewSettings;
  // Current lot data for saving with snapshots
  lotData?: LotSnapshotData;
  // onRestore can be async (e.g., to restore lot data)
  onRestore: (snapshot: EditorSnapshot["data"]) => void | Promise<void>;
}

export function useVersionHistory({
  projectId,
  blueprintId,
  rooms,
  doors,
  windows,
  furniture,
  aduBoundary,
  editorSettings,
  lotData,
  onRestore,
}: UseVersionHistoryOptions) {
  const [history, setHistory] = useState<VersionHistoryState>({
    autoSaves: [],
    manualSaves: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<number>(0);
  const isMountedRef = useRef(true);

  // Load history from backend API or fallback to localStorage
  useEffect(() => {
    isMountedRef.current = true;

    const loadHistory = async () => {
      if (!projectId) {
        // No project ID, use localStorage only
        try {
          const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved) as VersionHistoryState;
            setHistory(parsed);
          }
        } catch (error) {
          console.error("[VersionHistory] Error loading from localStorage:", error);
        }
        return;
      }

      setIsLoading(true);
      try {
        const response = await api.listSnapshots(projectId);
        if (isMountedRef.current && response.status === "success") {
          // Convert API response to EditorSnapshot format
          // The API snapshot data has the same runtime structure as EditorSnapshot["data"]
          // but TypeScript types differ (RoomData vs Room, etc.), so we cast through unknown
          const autoSaves: EditorSnapshot[] = response.data.autoSaves.map(s => ({
            id: s.id,
            timestamp: s.createdAt,
            type: "auto" as const,
            label: s.label,
            data: s.data as unknown as EditorSnapshot["data"],
          }));
          const manualSaves: EditorSnapshot[] = response.data.manualSaves.map(s => ({
            id: s.id,
            timestamp: s.createdAt,
            type: "manual" as const,
            label: s.label,
            data: s.data as unknown as EditorSnapshot["data"],
          }));

          setHistory({ autoSaves, manualSaves });

          // Also cache to localStorage for offline access
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ autoSaves, manualSaves }));
          } catch (e) {
            console.warn("[VersionHistory] Could not cache to localStorage:", e);
          }
        }
      } catch (error) {
        console.error("[VersionHistory] Error loading from API, falling back to localStorage:", error);
        // Fallback to localStorage
        try {
          const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved) as VersionHistoryState;
            setHistory(parsed);
          }
        } catch (e) {
          console.error("[VersionHistory] Error loading from localStorage:", e);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      isMountedRef.current = false;
    };
  }, [projectId]);

  // Save history to localStorage as cache
  const cacheToLocalStorage = useCallback((newHistory: VersionHistoryState) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.warn("[VersionHistory] Error caching to localStorage:", error);
    }
  }, []);

  // Create a snapshot of current state
  const createSnapshotData = useCallback((): EditorSnapshot["data"] => {
    const data = {
      rooms: JSON.parse(JSON.stringify(rooms)),
      doors: JSON.parse(JSON.stringify(doors)),
      windows: JSON.parse(JSON.stringify(windows)),
      furniture: JSON.parse(JSON.stringify(furniture)),
      aduBoundary: JSON.parse(JSON.stringify(aduBoundary)),
      // Include editor settings if available
      ...(editorSettings && { editorSettings: { ...editorSettings } }),
      // Include lot data if available
      ...(lotData && { lotData: { ...lotData } }),
    };
    console.log("[VersionHistory] Creating snapshot with lotData:", lotData ? "present" : "missing", lotData);
    console.log("[VersionHistory] Creating snapshot with editorSettings:", editorSettings);
    return data;
  }, [rooms, doors, windows, furniture, aduBoundary, editorSettings, lotData]);

  // Save an auto-save snapshot (called every 10 minutes)
  const saveAutoSnapshot = useCallback(async () => {
    const now = Date.now();

    // Only save if enough time has passed
    if (now - lastAutoSaveTime < AUTO_SAVE_INTERVAL_MS) {
      return false;
    }

    const snapshotData = createSnapshotData();

    // Try to save to backend API
    if (projectId) {
      try {
        const response = await api.createSnapshot({
          projectId,
          blueprintId,
          type: "auto",
          data: snapshotData as unknown as api.SnapshotData,
        });

        if (response.status === "success") {
          const newSnapshot: EditorSnapshot = {
            id: response.data.snapshot.id,
            timestamp: response.data.snapshot.createdAt,
            type: "auto",
            data: snapshotData,
          };

          const newAutoSaves = [newSnapshot, ...history.autoSaves].slice(0, MAX_AUTO_SAVES);
          const newHistory = { ...history, autoSaves: newAutoSaves };

          setHistory(newHistory);
          cacheToLocalStorage(newHistory);
          setLastAutoSaveTime(now);

          console.log("[VersionHistory] Auto-save snapshot created (API):", newSnapshot.timestamp);
          return true;
        }
      } catch (error) {
        console.error("[VersionHistory] Error saving auto-snapshot to API:", error);
      }
    }

    // Fallback to localStorage only
    const localSnapshot: EditorSnapshot = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "auto",
      data: snapshotData,
    };

    const newAutoSaves = [localSnapshot, ...history.autoSaves].slice(0, MAX_AUTO_SAVES);
    const newHistory = { ...history, autoSaves: newAutoSaves };

    setHistory(newHistory);
    cacheToLocalStorage(newHistory);
    setLastAutoSaveTime(now);

    console.log("[VersionHistory] Auto-save snapshot created (localStorage):", localSnapshot.timestamp);
    return true;
  }, [createSnapshotData, history, lastAutoSaveTime, projectId, blueprintId, cacheToLocalStorage]);

  // Save a manual snapshot
  const saveManualSnapshot = useCallback(async (label?: string) => {
    const snapshotData = createSnapshotData();

    // Try to save to backend API
    if (projectId) {
      try {
        const response = await api.createSnapshot({
          projectId,
          blueprintId,
          type: "manual",
          label,
          data: snapshotData as unknown as api.SnapshotData,
        });

        if (response.status === "success") {
          const newSnapshot: EditorSnapshot = {
            id: response.data.snapshot.id,
            timestamp: response.data.snapshot.createdAt,
            type: "manual",
            label,
            data: snapshotData,
          };

          const newManualSaves = [newSnapshot, ...history.manualSaves].slice(0, MAX_MANUAL_SAVES);
          const newHistory = { ...history, manualSaves: newManualSaves };

          setHistory(newHistory);
          cacheToLocalStorage(newHistory);

          console.log("[VersionHistory] Manual save snapshot created (API):", newSnapshot.timestamp, label);
          return newSnapshot;
        }
      } catch (error) {
        console.error("[VersionHistory] Error saving manual snapshot to API:", error);
      }
    }

    // Fallback to localStorage only
    const localSnapshot: EditorSnapshot = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "manual",
      label,
      data: snapshotData,
    };

    const newManualSaves = [localSnapshot, ...history.manualSaves].slice(0, MAX_MANUAL_SAVES);
    const newHistory = { ...history, manualSaves: newManualSaves };

    setHistory(newHistory);
    cacheToLocalStorage(newHistory);

    console.log("[VersionHistory] Manual save snapshot created (localStorage):", localSnapshot.timestamp, label);
    return localSnapshot;
  }, [createSnapshotData, history, projectId, blueprintId, cacheToLocalStorage]);

  // Restore from a snapshot
  const restoreSnapshot = useCallback(async (snapshotId: string) => {
    // First check local history
    const allSnapshots = [...history.autoSaves, ...history.manualSaves];
    let snapshot = allSnapshots.find(s => s.id === snapshotId);

    // If not found locally, try to fetch from API
    if (!snapshot && projectId) {
      try {
        const response = await api.getSnapshot(snapshotId);
        if (response.status === "success") {
          snapshot = {
            id: response.data.snapshot.id,
            timestamp: response.data.snapshot.createdAt,
            type: response.data.snapshot.type,
            label: response.data.snapshot.label,
            data: response.data.snapshot.data as unknown as EditorSnapshot["data"],
          };
        }
      } catch (error) {
        console.error("[VersionHistory] Error fetching snapshot from API:", error);
      }
    }

    if (snapshot) {
      console.log("[VersionHistory] Restoring snapshot data:", {
        hasLotData: !!snapshot.data.lotData,
        hasEditorSettings: !!snapshot.data.editorSettings,
        lotData: snapshot.data.lotData,
      });
      // Await the onRestore callback since it may be async (e.g., restoring lot data)
      await onRestore(snapshot.data);
      console.log("[VersionHistory] Restored from snapshot:", snapshot.timestamp, snapshot.type);
      return true;
    }

    return false;
  }, [history, projectId, onRestore]);

  // Delete a manual snapshot
  const deleteSnapshot = useCallback(async (snapshotId: string) => {
    // Try to delete from API
    if (projectId) {
      try {
        await api.deleteSnapshot(snapshotId);
        console.log("[VersionHistory] Deleted snapshot from API:", snapshotId);
      } catch (error) {
        console.error("[VersionHistory] Error deleting snapshot from API:", error);
      }
    }

    // Always update local state
    const newHistory = {
      ...history,
      manualSaves: history.manualSaves.filter(s => s.id !== snapshotId),
    };

    setHistory(newHistory);
    cacheToLocalStorage(newHistory);
  }, [history, projectId, cacheToLocalStorage]);

  // Format timestamp for display
  const formatTimestamp = useCallback((isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${timeStr}`;
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
  }, []);

  // Get time ago string
  const getTimeAgo = useCallback((isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }, []);

  return {
    autoSaves: history.autoSaves,
    manualSaves: history.manualSaves,
    isLoading,
    saveAutoSnapshot,
    saveManualSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    formatTimestamp,
    getTimeAgo,
  };
}

export type { EditorSnapshot, EditorViewSettings, LotSnapshotData };
