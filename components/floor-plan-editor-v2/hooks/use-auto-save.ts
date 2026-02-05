"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { EditorState, AduBoundary } from "../types"
import type { Corner, Wall, Door, Window, Furniture, Room, Lot } from "@/lib/api/client-v2"

// Auto-save configuration
const AUTO_SAVE_DELAY_MS = 10 * 60 * 1000 // 10 minutes
const MAX_AUTO_SAVE_SLOTS = 6 // Keep last 6 auto-saves (1 hour of rolling saves)

// Keys for localStorage
const getAutoSaveKey = (projectId: string, slot: number) =>
  `adu-autosave-${projectId}-${slot}`
const getMetaKey = (projectId: string) =>
  `adu-autosave-${projectId}-meta`

// Auto-save data structure
export interface AutoSaveData {
  timestamp: number
  slot: number
  data: {
    corners: Corner[]
    walls: Wall[]
    doors: Door[]
    windows: Window[]
    furniture: Furniture[]
    rooms: Room[]
    lot: Lot | null
    aduBoundary: AduBoundary
    showAduBoundary: boolean
    version: number
  }
}

// Meta data for tracking auto-save state
interface AutoSaveMeta {
  currentSlot: number
  lastSaveTime: number
}

/**
 * Get all auto-saves for a project, sorted by timestamp (newest first)
 */
export function getAutoSaves(projectId: string): AutoSaveData[] {
  if (typeof window === "undefined") return []

  const saves: AutoSaveData[] = []

  for (let slot = 0; slot < MAX_AUTO_SAVE_SLOTS; slot++) {
    const key = getAutoSaveKey(projectId, slot)
    const data = localStorage.getItem(key)
    if (data) {
      try {
        const parsed = JSON.parse(data) as AutoSaveData
        saves.push(parsed)
      } catch (e) {
        console.error(`Failed to parse auto-save slot ${slot}:`, e)
      }
    }
  }

  // Sort by timestamp, newest first
  return saves.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Clear all auto-saves for a project
 */
export function clearAutoSaves(projectId: string): void {
  if (typeof window === "undefined") return

  for (let slot = 0; slot < MAX_AUTO_SAVE_SLOTS; slot++) {
    localStorage.removeItem(getAutoSaveKey(projectId, slot))
  }
  localStorage.removeItem(getMetaKey(projectId))
}

/**
 * Delete a specific auto-save slot
 */
export function deleteAutoSave(projectId: string, slot: number): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(getAutoSaveKey(projectId, slot))
}

/**
 * Hook for auto-saving editor state to localStorage
 * Saves every 10 minutes after the last edit, with rolling 6 slots
 */
export function useAutoSave(
  projectId: string,
  state: EditorState,
  enabled: boolean = true
) {
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)
  const [autoSaves, setAutoSaves] = useState<AutoSaveData[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastEditTimeRef = useRef<number>(Date.now())

  // Load existing auto-saves on mount
  useEffect(() => {
    if (projectId) {
      setAutoSaves(getAutoSaves(projectId))
    }
  }, [projectId])

  // Get current meta data
  const getMeta = useCallback((): AutoSaveMeta => {
    if (typeof window === "undefined") {
      return { currentSlot: 0, lastSaveTime: 0 }
    }

    const metaKey = getMetaKey(projectId)
    const metaData = localStorage.getItem(metaKey)

    if (metaData) {
      try {
        return JSON.parse(metaData)
      } catch {
        return { currentSlot: 0, lastSaveTime: 0 }
      }
    }

    return { currentSlot: 0, lastSaveTime: 0 }
  }, [projectId])

  // Save current state to localStorage
  const saveToLocalStorage = useCallback(() => {
    if (typeof window === "undefined" || !projectId) return

    const meta = getMeta()
    const nextSlot = (meta.currentSlot + 1) % MAX_AUTO_SAVE_SLOTS

    const saveData: AutoSaveData = {
      timestamp: Date.now(),
      slot: nextSlot,
      data: {
        corners: state.corners,
        walls: state.walls,
        doors: state.doors,
        windows: state.windows,
        furniture: state.furniture,
        rooms: state.rooms,
        lot: state.lot,
        aduBoundary: state.aduBoundary,
        showAduBoundary: state.showAduBoundary,
        version: state.version,
      },
    }

    // Save to localStorage
    const saveKey = getAutoSaveKey(projectId, nextSlot)
    localStorage.setItem(saveKey, JSON.stringify(saveData))

    // Update meta
    const newMeta: AutoSaveMeta = {
      currentSlot: nextSlot,
      lastSaveTime: Date.now(),
    }
    localStorage.setItem(getMetaKey(projectId), JSON.stringify(newMeta))

    // Update state
    setLastAutoSave(new Date())
    setAutoSaves(getAutoSaves(projectId))

    console.log(`[AutoSave] Saved to slot ${nextSlot}`)
  }, [projectId, state, getMeta])

  // Trigger auto-save when state becomes dirty
  useEffect(() => {
    if (!enabled || !projectId || !state.isDirty) {
      return
    }

    // Reset timer on every edit
    lastEditTimeRef.current = Date.now()

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Set new timer for 10 minutes after last edit
    timerRef.current = setTimeout(() => {
      // Only save if still dirty and enough content exists
      if (state.isDirty && (state.corners.length > 0 || state.walls.length > 0)) {
        saveToLocalStorage()
      }
    }, AUTO_SAVE_DELAY_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [enabled, projectId, state.isDirty, state.corners.length, state.walls.length, saveToLocalStorage])

  // Force save (for manual trigger or before navigation)
  const forceSave = useCallback(() => {
    if (state.corners.length > 0 || state.walls.length > 0) {
      saveToLocalStorage()
    }
  }, [saveToLocalStorage, state.corners.length, state.walls.length])

  // Restore from auto-save
  const restoreAutoSave = useCallback((save: AutoSaveData) => {
    return save.data
  }, [])

  // Refresh auto-saves list
  const refreshAutoSaves = useCallback(() => {
    setAutoSaves(getAutoSaves(projectId))
  }, [projectId])

  return {
    lastAutoSave,
    autoSaves,
    forceSave,
    restoreAutoSave,
    refreshAutoSaves,
    clearAutoSaves: () => {
      clearAutoSaves(projectId)
      setAutoSaves([])
    },
  }
}
