"use client"

import { useCallback, useRef } from "react"
import type { EditorState } from "../types"

interface HistorySnapshot {
  corners: EditorState["corners"]
  walls: EditorState["walls"]
  doors: EditorState["doors"]
  windows: EditorState["windows"]
  furniture: EditorState["furniture"]
  rooms: EditorState["rooms"]
}

const MAX_HISTORY_SIZE = 50

/**
 * Hook for managing undo/redo history
 */
export function useHistory() {
  const historyRef = useRef<HistorySnapshot[]>([])
  const currentIndexRef = useRef(-1)
  const isUndoRedoRef = useRef(false)

  /**
   * Take a snapshot of the current state
   */
  const takeSnapshot = useCallback((state: EditorState) => {
    // Don't record during undo/redo operations
    if (isUndoRedoRef.current) return

    const snapshot: HistorySnapshot = {
      corners: [...state.corners],
      walls: [...state.walls],
      doors: [...state.doors],
      windows: [...state.windows],
      furniture: [...state.furniture],
      rooms: [...state.rooms],
    }

    // Remove any future history if we're not at the end
    if (currentIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, currentIndexRef.current + 1)
    }

    // Add new snapshot
    historyRef.current.push(snapshot)
    currentIndexRef.current = historyRef.current.length - 1

    // Limit history size
    if (historyRef.current.length > MAX_HISTORY_SIZE) {
      historyRef.current.shift()
      currentIndexRef.current--
    }
  }, [])

  /**
   * Undo to previous state
   */
  const undo = useCallback((): HistorySnapshot | null => {
    if (currentIndexRef.current <= 0) return null

    isUndoRedoRef.current = true
    currentIndexRef.current--
    const snapshot = historyRef.current[currentIndexRef.current]

    // Schedule reset of flag
    setTimeout(() => {
      isUndoRedoRef.current = false
    }, 0)

    return snapshot
  }, [])

  /**
   * Redo to next state
   */
  const redo = useCallback((): HistorySnapshot | null => {
    if (currentIndexRef.current >= historyRef.current.length - 1) return null

    isUndoRedoRef.current = true
    currentIndexRef.current++
    const snapshot = historyRef.current[currentIndexRef.current]

    // Schedule reset of flag
    setTimeout(() => {
      isUndoRedoRef.current = false
    }, 0)

    return snapshot
  }, [])

  /**
   * Check if undo is available
   */
  const canUndo = useCallback(() => {
    return currentIndexRef.current > 0
  }, [])

  /**
   * Check if redo is available
   */
  const canRedo = useCallback(() => {
    return currentIndexRef.current < historyRef.current.length - 1
  }, [])

  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    historyRef.current = []
    currentIndexRef.current = -1
  }, [])

  /**
   * Get current history length and position
   */
  const getHistoryInfo = useCallback(() => ({
    length: historyRef.current.length,
    current: currentIndexRef.current,
    canUndo: currentIndexRef.current > 0,
    canRedo: currentIndexRef.current < historyRef.current.length - 1,
  }), [])

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    getHistoryInfo,
  }
}
