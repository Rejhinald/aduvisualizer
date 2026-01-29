import { useCallback, useRef, useEffect } from "react"
import {
  startEditorSession,
  endEditorSession,
  logAction,
  logActionBatch,
  type ActionLogData,
} from "@/lib/api/client"

type EntityType = "room" | "door" | "window" | "furniture" | "boundary"

interface ActionQueueItem {
  action: string
  entityType: EntityType
  entityId?: string
  previousState?: Record<string, unknown>
  newState?: Record<string, unknown>
  positionX?: number
  positionY?: number
  width?: number
  height?: number
  rotation?: number
  timestamp: number
}

interface UseActionLoggerOptions {
  projectId: string | null
  blueprintId?: string | null
  enabled?: boolean
  batchInterval?: number // ms between batch flushes
  maxBatchSize?: number
}

/**
 * Hook for logging editor actions to the backend
 * Automatically batches actions for efficiency
 */
export function useActionLogger({
  projectId,
  blueprintId,
  enabled = true,
  batchInterval = 2000, // Flush every 2 seconds
  maxBatchSize = 50,
}: UseActionLoggerOptions) {
  const sessionIdRef = useRef<string | null>(null)
  const actionQueueRef = useRef<ActionQueueItem[]>([])
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isFlushingRef = useRef(false)

  // Start session when projectId is available
  useEffect(() => {
    if (!enabled || !projectId) return

    const initSession = async () => {
      try {
        const response = await startEditorSession({
          projectId,
          blueprintId: blueprintId || undefined,
        })
        if (response.status === "success") {
          sessionIdRef.current = response.data.sessionId
          console.log("[ActionLogger] Session started:", response.data.sessionId)
        }
      } catch (error) {
        console.error("[ActionLogger] Failed to start session:", error)
      }
    }

    initSession()

    // Cleanup: end session on unmount
    return () => {
      if (sessionIdRef.current) {
        // Flush remaining actions
        flushActions()
        // End session
        endEditorSession(sessionIdRef.current).catch((e) =>
          console.error("[ActionLogger] Failed to end session:", e)
        )
        sessionIdRef.current = null
      }
    }
  }, [projectId, blueprintId, enabled])

  // Set up periodic flush
  useEffect(() => {
    if (!enabled) return

    flushTimerRef.current = setInterval(() => {
      if (actionQueueRef.current.length > 0) {
        flushActions()
      }
    }, batchInterval)

    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current)
      }
    }
  }, [enabled, batchInterval])

  // Flush queued actions to backend
  const flushActions = useCallback(async () => {
    if (isFlushingRef.current || actionQueueRef.current.length === 0) return
    if (!sessionIdRef.current) return

    isFlushingRef.current = true
    const actionsToFlush = [...actionQueueRef.current]
    actionQueueRef.current = []

    try {
      await logActionBatch({
        sessionId: sessionIdRef.current,
        actions: actionsToFlush.map(({ timestamp, ...action }) => action),
      })
      console.log(`[ActionLogger] Flushed ${actionsToFlush.length} actions`)
    } catch (error) {
      console.error("[ActionLogger] Failed to flush actions:", error)
      // Re-queue failed actions
      actionQueueRef.current = [...actionsToFlush, ...actionQueueRef.current]
    } finally {
      isFlushingRef.current = false
    }
  }, [])

  // Log a single action (queued for batching)
  const logEditorAction = useCallback(
    (
      action: string,
      entityType: EntityType,
      entityId?: string,
      options?: {
        previousState?: Record<string, unknown>
        newState?: Record<string, unknown>
        positionX?: number
        positionY?: number
        width?: number
        height?: number
        rotation?: number
      }
    ) => {
      if (!enabled || !sessionIdRef.current) return

      const queueItem: ActionQueueItem = {
        action,
        entityType,
        entityId,
        ...options,
        timestamp: Date.now(),
      }

      actionQueueRef.current.push(queueItem)

      // Flush immediately if queue is full
      if (actionQueueRef.current.length >= maxBatchSize) {
        flushActions()
      }
    },
    [enabled, maxBatchSize, flushActions]
  )

  // Convenience methods for common actions
  const logMove = useCallback(
    (
      entityType: EntityType,
      entityId: string,
      previousPosition: { x: number; y: number },
      newPosition: { x: number; y: number }
    ) => {
      logEditorAction(`${entityType}.move`, entityType, entityId, {
        previousState: previousPosition,
        newState: newPosition,
        positionX: Math.round(newPosition.x),
        positionY: Math.round(newPosition.y),
      })
    },
    [logEditorAction]
  )

  const logResize = useCallback(
    (
      entityType: EntityType,
      entityId: string,
      previousDimensions: { width?: number; height?: number },
      newDimensions: { width?: number; height?: number },
      newPosition?: { x: number; y: number }
    ) => {
      logEditorAction(`${entityType}.resize`, entityType, entityId, {
        previousState: previousDimensions,
        newState: newDimensions,
        width: newDimensions.width ? Math.round(newDimensions.width) : undefined,
        height: newDimensions.height ? Math.round(newDimensions.height) : undefined,
        positionX: newPosition ? Math.round(newPosition.x) : undefined,
        positionY: newPosition ? Math.round(newPosition.y) : undefined,
      })
    },
    [logEditorAction]
  )

  const logRotate = useCallback(
    (
      entityType: EntityType,
      entityId: string,
      previousRotation: number,
      newRotation: number
    ) => {
      logEditorAction(`${entityType}.rotate`, entityType, entityId, {
        previousState: { rotation: previousRotation },
        newState: { rotation: newRotation },
        rotation: newRotation,
      })
    },
    [logEditorAction]
  )

  const logCreate = useCallback(
    (entityType: EntityType, entityId: string, state: Record<string, unknown>) => {
      logEditorAction(`${entityType}.create`, entityType, entityId, {
        newState: state,
      })
    },
    [logEditorAction]
  )

  const logDelete = useCallback(
    (entityType: EntityType, entityId: string, state: Record<string, unknown>) => {
      logEditorAction(`${entityType}.delete`, entityType, entityId, {
        previousState: state,
      })
    },
    [logEditorAction]
  )

  const logVertexMove = useCallback(
    (
      roomId: string,
      vertexIndex: number,
      previousPosition: { x: number; y: number },
      newPosition: { x: number; y: number }
    ) => {
      logEditorAction(`room.vertex.move`, "room", roomId, {
        previousState: { vertexIndex, ...previousPosition },
        newState: { vertexIndex, ...newPosition },
        positionX: Math.round(newPosition.x),
        positionY: Math.round(newPosition.y),
      })
    },
    [logEditorAction]
  )

  return {
    sessionId: sessionIdRef.current,
    logEditorAction,
    logMove,
    logResize,
    logRotate,
    logCreate,
    logDelete,
    logVertexMove,
    flushActions,
  }
}
