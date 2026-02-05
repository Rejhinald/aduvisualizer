"use client"

import { useState, useCallback, useEffect } from "react"
import * as api from "@/lib/api/client-v2"
import type { AduBoundary } from "../types"
import type { Corner, Wall, Door, Window, Furniture, Room, Lot } from "@/lib/api/client-v2"

// Maximum number of manual saves to keep per blueprint
const MAX_MANUAL_SAVES = 10

// LocalStorage key for ADU boundary data per snapshot
const getAduBoundaryKey = (snapshotId: string) => `adu-snapshot-boundary-${snapshotId}`

// ADU boundary data stored alongside snapshots
interface AduBoundaryStore {
  aduBoundary: AduBoundary
  showAduBoundary: boolean
}

// Save ADU boundary to localStorage for a snapshot
function saveAduBoundaryForSnapshot(snapshotId: string, data: AduBoundaryStore): void {
  if (typeof window === "undefined") return
  localStorage.setItem(getAduBoundaryKey(snapshotId), JSON.stringify(data))
}

// Load ADU boundary from localStorage for a snapshot
function loadAduBoundaryForSnapshot(snapshotId: string): AduBoundaryStore | null {
  if (typeof window === "undefined") return null
  const data = localStorage.getItem(getAduBoundaryKey(snapshotId))
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

// Delete ADU boundary from localStorage for a snapshot
function deleteAduBoundaryForSnapshot(snapshotId: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(getAduBoundaryKey(snapshotId))
}

// Snapshot data from backend (blueprint state at point in time)
export interface ManualSaveData {
  id: string
  blueprintId: string
  description?: string
  createdAt: string
  data: {
    corners: Corner[]
    walls: Wall[]
    doors: Door[]
    windows: Window[]
    furniture: Furniture[]
    rooms: Room[]
    lot: Lot | null
    // ADU boundary is frontend-only, may not be present in older saves
    aduBoundary?: AduBoundary
    showAduBoundary?: boolean
    version: number
  }
}

// Snapshot list item (without full data)
export interface ManualSaveListItem {
  id: string
  blueprintId: string
  description?: string
  createdAt: string
}

/**
 * Hook for manual saves using the snapshots API
 * Keeps last 10 manual saves per blueprint (persistent in database)
 */
export function useManualSave(blueprintId: string | null) {
  const [saves, setSaves] = useState<ManualSaveListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing manual saves
  const loadSaves = useCallback(async () => {
    if (!blueprintId) {
      setSaves([])
      return
    }

    try {
      setLoading(true)
      const response = await api.listSnapshots(blueprintId)
      if (response.data) {
        // Filter to only manual saves (those with "Manual Save" in description)
        const manualSaves = response.data
          .filter((s) => s.description?.startsWith("Manual Save"))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setSaves(manualSaves)
      }
    } catch (err) {
      console.error("Failed to load manual saves:", err)
      setError("Failed to load saves")
    } finally {
      setLoading(false)
    }
  }, [blueprintId])

  // Load saves on mount and when blueprintId changes
  useEffect(() => {
    loadSaves()
  }, [loadSaves])

  // Create a new manual save (backend captures current blueprint state)
  // Also saves ADU boundary to localStorage since it's not in DB
  const createSave = useCallback(
    async (aduBoundary: AduBoundary, showAduBoundary: boolean, label?: string) => {
      if (!blueprintId) {
        setError("No blueprint to save")
        return null
      }

      try {
        setLoading(true)
        setError(null)

        // First, check if we need to delete old saves to stay under the cap
        const currentSaves = [...saves]
        if (currentSaves.length >= MAX_MANUAL_SAVES) {
          // Delete the oldest saves to make room
          const savesToDelete = currentSaves.slice(MAX_MANUAL_SAVES - 1)
          for (const save of savesToDelete) {
            try {
              await api.deleteSnapshot(save.id)
              // Also delete the ADU boundary from localStorage
              deleteAduBoundaryForSnapshot(save.id)
            } catch (e) {
              console.warn(`Failed to delete old snapshot ${save.id}:`, e)
            }
          }
        }

        // Create the snapshot description
        const timestamp = new Date().toLocaleString()
        const description = label
          ? `Manual Save: ${label} (${timestamp})`
          : `Manual Save (${timestamp})`

        // Create the snapshot
        const response = await api.createSnapshot({
          blueprintId,
          description,
        })

        if (response.data) {
          // Save ADU boundary to localStorage alongside the snapshot
          saveAduBoundaryForSnapshot(response.data.id, {
            aduBoundary,
            showAduBoundary,
          })

          // Refresh the saves list
          await loadSaves()
          return response.data
        }

        return null
      } catch (err) {
        console.error("Failed to create manual save:", err)
        setError("Failed to save")
        return null
      } finally {
        setLoading(false)
      }
    },
    [blueprintId, saves, loadSaves]
  )

  // Restore from a manual save (also loads ADU boundary from localStorage)
  const restoreSave = useCallback(
    async (snapshotId: string): Promise<ManualSaveData | null> => {
      try {
        setLoading(true)
        setError(null)

        const response = await api.getSnapshot(snapshotId)
        if (response.data) {
          // Load ADU boundary from localStorage
          const aduBoundaryStore = loadAduBoundaryForSnapshot(snapshotId)

          const data = response.data.data as ManualSaveData["data"]

          return {
            id: response.data.id,
            blueprintId: response.data.blueprintId,
            description: response.data.description,
            createdAt: response.data.createdAt,
            data: {
              ...data,
              // Merge ADU boundary from localStorage if available
              aduBoundary: aduBoundaryStore?.aduBoundary || data.aduBoundary,
              showAduBoundary: aduBoundaryStore?.showAduBoundary ?? data.showAduBoundary,
            },
          }
        }

        return null
      } catch (err) {
        console.error("Failed to restore save:", err)
        setError("Failed to restore save")
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Delete a manual save (also deletes ADU boundary from localStorage)
  const deleteSave = useCallback(
    async (snapshotId: string) => {
      try {
        setLoading(true)
        setError(null)

        await api.deleteSnapshot(snapshotId)
        // Also delete the ADU boundary from localStorage
        deleteAduBoundaryForSnapshot(snapshotId)
        await loadSaves()
      } catch (err) {
        console.error("Failed to delete save:", err)
        setError("Failed to delete save")
      } finally {
        setLoading(false)
      }
    },
    [loadSaves]
  )

  return {
    saves,
    loading,
    error,
    createSave,
    restoreSave,
    deleteSave,
    refreshSaves: loadSaves,
  }
}
