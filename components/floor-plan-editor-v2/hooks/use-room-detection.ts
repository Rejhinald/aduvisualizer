"use client"

import { useEffect, useCallback, useRef } from "react"
import type { EditorState, EditorAction } from "../types"
import type { Room } from "@/lib/api/client-v2"
import { detectRooms } from "../lib/room-detection"

interface UseRoomDetectionProps {
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
  enabled?: boolean
  debounceMs?: number
}

/**
 * Hook that automatically detects rooms when walls/corners change.
 * Preserves existing room metadata (name, type) when rooms are re-detected.
 */
export function useRoomDetection({
  state,
  dispatch,
  enabled = true,
  debounceMs = 300,
}: UseRoomDetectionProps) {
  // Defensive: ensure arrays are never undefined
  const corners = state.corners || []
  const walls = state.walls || []
  const rooms = state.rooms || []
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Store previous room metadata for preservation
  const roomMetadataRef = useRef<Map<string, { name: string; type: string }>>(
    new Map()
  )

  // Update metadata cache when rooms change
  useEffect(() => {
    const metadata = new Map<string, { name: string; type: string }>()
    rooms.forEach((room) => {
      metadata.set(room.id, { name: room.name, type: room.type })
    })
    roomMetadataRef.current = metadata
  }, [rooms])

  // Detect rooms when corners/walls change
  const detectAndUpdateRooms = useCallback(() => {
    if (!enabled) return
    if (corners.length < 3 || walls.length < 3) {
      // Not enough geometry for rooms
      if (rooms.length > 0) {
        dispatch({
          type: "LOAD_DATA",
          data: {
            corners,
            walls,
            doors: state.doors,
            windows: state.windows,
            furniture: state.furniture,
            rooms: [],
            lot: state.lot,
            version: state.version,
          },
        })
      }
      return
    }

    // Detect rooms from current geometry
    const detectedRooms = detectRooms(corners, walls)

    // Preserve existing room metadata (name, type)
    const updatedRooms: Room[] = detectedRooms.map((room) => {
      const existingMetadata = roomMetadataRef.current.get(room.id)
      if (existingMetadata) {
        return {
          ...room,
          name: existingMetadata.name,
          type: existingMetadata.type as any,
        }
      }
      return room
    })

    // Only dispatch if rooms actually changed
    const roomIds = updatedRooms.map((r) => r.id).sort().join(",")
    const existingIds = rooms.map((r) => r.id).sort().join(",")

    if (roomIds !== existingIds) {
      dispatch({
        type: "LOAD_DATA",
        data: {
          corners,
          walls,
          doors: state.doors,
          windows: state.windows,
          furniture: state.furniture,
          rooms: updatedRooms,
          lot: state.lot,
          version: state.version,
        },
      })
    }
  }, [corners, walls, rooms, state, dispatch, enabled])

  // Debounced detection - runs after geometry changes settle
  useEffect(() => {
    if (!enabled) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Schedule detection
    timeoutRef.current = setTimeout(() => {
      detectAndUpdateRooms()
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [corners.length, walls.length, detectAndUpdateRooms, debounceMs, enabled])

  // Manual trigger for immediate detection
  const detectNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    detectAndUpdateRooms()
  }, [detectAndUpdateRooms])

  return {
    detectNow,
    roomCount: rooms.length,
  }
}
