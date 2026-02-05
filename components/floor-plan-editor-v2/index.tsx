"use client"

import { useEffect, useCallback, useState, useRef } from "react"
import { Stage, Layer } from "react-konva"
import type Konva from "konva"
import type { FloorPlanEditorV2Props, CanvasConfig, DoorType, WindowType, FurnitureType } from "./types"
import { createCanvasConfig, calculatePolygonArea } from "./constants"
import { useEditorReducer, useCanvasEvents, useHistory, useRoomDetection, useAutoSave, useManualSave, getAutoSaves } from "./hooks"
import type { AutoSaveData } from "./hooks"
import {
  GridLayer,
  CornersLayer,
  WallsLayer,
  RoomsLayer,
  DoorsLayer,
  WindowsLayer,
  FurnitureLayer,
  DrawingPreview,
  AduBoundaryOverlay,
} from "./canvas"
import {
  DoorPalette,
  WindowPalette,
  FurniturePalette,
  PropertiesPanel,
  LotSelector,
  ModeSelector,
  ElementLists,
  AduSizeSlider,
} from "./sidebar"
import { CanvasControls, Compass, AreaIndicator, FileMenu } from "./overlay"
import { ExportDialog } from "./export"
import { LotOverlay } from "./lot"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Download, ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose, RotateCcw, Clock } from "lucide-react"
import * as api from "@/lib/api/client-v2"
import { cn } from "@/lib/utils"

export function FloorPlanEditorV2({ projectId, onSave, onExport }: FloorPlanEditorV2Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const { state, dispatch } = useEditorReducer()
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useHistory()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLotOverlay, setShowLotOverlay] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const [aduEditMode, setAduEditMode] = useState(false)
  const [recoveryDialog, setRecoveryDialog] = useState<{ show: boolean; save: AutoSaveData | null }>({ show: false, save: null })

  // Auto-detect rooms when walls/corners change
  useRoomDetection({ state, dispatch, enabled: !loading })

  // Auto-save to localStorage (rolling 6 slots, 10 min after edit)
  const {
    lastAutoSave,
    autoSaves,
    forceSave: forceAutoSave,
    restoreAutoSave,
    clearAutoSaves,
  } = useAutoSave(projectId, state, !loading)

  // Manual saves to database (via snapshots API, capped at 10)
  const {
    saves: manualSaves,
    loading: manualSaveLoading,
    createSave: createManualSave,
    restoreSave: restoreManualSave,
    deleteSave: deleteManualSave,
    refreshSaves: refreshManualSaves,
  } = useManualSave(state.blueprintId)

  // Panel visibility state for SketchUp-like UI
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  // Middle mouse button panning state
  const [isMiddleMousePanning, setIsMiddleMousePanning] = useState(false)
  const middleMouseStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  // Canvas config with pan/zoom - initialize with centered view
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 800
    const height = typeof window !== 'undefined' ? window.innerHeight : 600
    const config = createCanvasConfig(width, height)
    // Center on origin (0, 0) where the default ADU boundary is
    config.panX = width / 2
    config.panY = height / 2
    return config
  })

  // Track if we've centered the view initially
  const hasInitializedView = useRef(false)

  // Update canvas size on resize and ensure view is centered on first mount
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setCanvasConfig((prev) => {
          const newConfig = {
            ...prev,
            viewportWidth: rect.width,
            viewportHeight: rect.height,
          }

          // Center the canvas on first actual render with real dimensions
          if (!hasInitializedView.current) {
            hasInitializedView.current = true
            // Center on origin (0, 0) - default ADU boundary is centered there
            newConfig.panX = rect.width / 2
            newConfig.panY = rect.height / 2
          }

          return newConfig
        })
      }
    }

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(updateSize)
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  // Canvas events
  const {
    handleCanvasClick,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasDoubleClick,
    handleKeyDown,
  } = useCanvasEvents({
    state,
    dispatch,
    zoom: canvasConfig.zoom,
    panX: canvasConfig.panX,
    panY: canvasConfig.panY,
  })

  // Keyboard events
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  // Track state changes for undo/redo history
  const prevStateRef = useRef<string>("")
  useEffect(() => {
    // Create a hash of the current data state
    const stateHash = JSON.stringify({
      corners: state.corners.length,
      walls: state.walls.length,
      doors: state.doors.length,
      windows: state.windows.length,
      furniture: state.furniture.length,
    })

    // Only take snapshot if data actually changed
    if (stateHash !== prevStateRef.current && !loading) {
      takeSnapshot(state)
      prevStateRef.current = stateHash
      setHistoryState({ canUndo: canUndo(), canRedo: canRedo() })
    }
  }, [state.corners, state.walls, state.doors, state.windows, state.furniture, loading, takeSnapshot, canUndo, canRedo])

  // Undo handler
  const handleUndo = useCallback(() => {
    const snapshot = undo()
    if (snapshot) {
      dispatch({ type: "RESTORE_SNAPSHOT", snapshot })
      setHistoryState({ canUndo: canUndo(), canRedo: canRedo() })
    }
  }, [undo, dispatch, canUndo, canRedo])

  // Redo handler
  const handleRedo = useCallback(() => {
    const snapshot = redo()
    if (snapshot) {
      dispatch({ type: "RESTORE_SNAPSHOT", snapshot })
      setHistoryState({ canUndo: canUndo(), canRedo: canRedo() })
    }
  }, [redo, dispatch, canUndo, canRedo])

  // Restore from auto-save
  const handleRestoreAutoSave = useCallback((save: AutoSaveData) => {
    const data = restoreAutoSave(save)
    if (data) {
      dispatch({
        type: "LOAD_DATA",
        data: {
          corners: data.corners || [],
          walls: data.walls || [],
          doors: data.doors || [],
          windows: data.windows || [],
          furniture: data.furniture || [],
          rooms: data.rooms || [],
          lot: data.lot || null,
          version: data.version || 0,
        },
      })
      // Update ADU boundary if present
      if (data.aduBoundary) {
        dispatch({ type: "SET_ADU_BOUNDARY_SIZE", targetArea: data.aduBoundary.targetArea })
      }
      if (data.showAduBoundary !== undefined && !data.showAduBoundary) {
        dispatch({ type: "TOGGLE_ADU_BOUNDARY" })
      }
      dispatch({ type: "MARK_DIRTY" })
    }
  }, [restoreAutoSave, dispatch])

  // Restore from manual save
  const handleRestoreManualSave = useCallback(async (snapshotId: string) => {
    const save = await restoreManualSave(snapshotId)
    if (save?.data) {
      dispatch({
        type: "LOAD_DATA",
        data: {
          corners: save.data.corners || [],
          walls: save.data.walls || [],
          doors: save.data.doors || [],
          windows: save.data.windows || [],
          furniture: save.data.furniture || [],
          rooms: save.data.rooms || [],
          lot: save.data.lot || null,
          version: save.data.version || 0,
        },
      })
      // Update ADU boundary if present
      if (save.data.aduBoundary) {
        dispatch({ type: "SET_ADU_BOUNDARY_SIZE", targetArea: save.data.aduBoundary.targetArea })
      }
      dispatch({ type: "MARK_DIRTY" })
    }
  }, [restoreManualSave, dispatch])

  // Create new blueprint (clear state)
  const handleNewBlueprint = useCallback(() => {
    // Force auto-save before clearing
    forceAutoSave()

    // Clear all state
    dispatch({
      type: "LOAD_DATA",
      data: {
        corners: [],
        walls: [],
        doors: [],
        windows: [],
        furniture: [],
        rooms: [],
        lot: null,
        version: 0,
      },
    })
    dispatch({ type: "RESET_ADU_BOUNDARY" })
    dispatch({ type: "MARK_CLEAN" })
  }, [forceAutoSave, dispatch])

  // Load blueprint data and check for auto-saves
  useEffect(() => {
    async function loadBlueprint() {
      try {
        setLoading(true)
        setError(null)

        const response = await api.getBlueprintByProject(projectId)
        let dbUpdatedAt: Date | null = null

        if (response.data) {
          dispatch({ type: "SET_BLUEPRINT", blueprintId: response.data.id })
          dispatch({
            type: "LOAD_DATA",
            data: {
              corners: response.data.corners || [],
              walls: response.data.walls || [],
              doors: response.data.doors || [],
              windows: response.data.windows || [],
              furniture: response.data.furniture || [],
              rooms: response.data.rooms || [],
              lot: response.data.lot || null,
              version: response.data.version,
            },
          })

          // Load ADU boundary if present in database
          if (response.data.boundaryCorners && response.data.boundaryCorners.length >= 3) {
            // Sort by orderIndex and convert to Point array
            const sortedCorners = [...response.data.boundaryCorners]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map(c => ({ x: c.x, y: c.y }))
            dispatch({ type: "LOAD_ADU_BOUNDARY", corners: sortedCorners })
          }

          dbUpdatedAt = new Date(response.data.updatedAt)
        }

        // Check for auto-saves that are more recent than the DB version
        // Use standalone function to avoid dependency loop
        const savedAutoSaves = getAutoSaves(projectId)
        if (savedAutoSaves.length > 0) {
          const mostRecent = savedAutoSaves[0] // Already sorted by timestamp desc
          const autoSaveTime = new Date(mostRecent.timestamp)

          // Show recovery dialog if auto-save is newer than DB or if no DB data
          const shouldRecover = !dbUpdatedAt || autoSaveTime > dbUpdatedAt
          const hasContent = (mostRecent.data.corners?.length || 0) > 0 || (mostRecent.data.walls?.length || 0) > 0

          if (shouldRecover && hasContent) {
            setRecoveryDialog({ show: true, save: mostRecent })
          }
        }
      } catch (err) {
        console.error("Failed to load blueprint:", err)
        // Don't show error for new blueprints, but still check for auto-saves
        setError(null)

        // Check for auto-saves even if no DB data
        const savedAutoSaves = getAutoSaves(projectId)
        if (savedAutoSaves.length > 0) {
          const mostRecent = savedAutoSaves[0]
          const hasContent = (mostRecent.data.corners?.length || 0) > 0 || (mostRecent.data.walls?.length || 0) > 0
          if (hasContent) {
            setRecoveryDialog({ show: true, save: mostRecent })
          }
        }
      } finally {
        setLoading(false)
      }
    }

    loadBlueprint()
  }, [projectId, dispatch])

  // Save blueprint
  const handleSave = useCallback(async () => {
    if (!state.isDirty && state.corners.length === 0) return

    try {
      setSaving(true)

      // Convert ADU boundary (Point array) to boundaryCorners and boundaryWalls format
      const boundaryCorners = state.aduBoundary.corners.map((point, index) => ({
        id: `boundary-corner-${index}`,
        x: point.x,
        y: point.y,
        orderIndex: index,
      }))

      // Create boundary walls connecting adjacent corners (polygon edges)
      const boundaryWalls = state.aduBoundary.corners.map((_, index) => ({
        id: `boundary-wall-${index}`,
        startCornerId: `boundary-corner-${index}`,
        endCornerId: `boundary-corner-${(index + 1) % state.aduBoundary.corners.length}`,
      }))

      // Always send original IDs (even temp ones) so backend can build ID mappings
      // Backend generates new UUIDs but needs the original IDs to map wall/door/window references
      const response = await api.saveBlueprint({
        projectId,
        name: "Floor Plan",
        corners: state.corners.map((c) => ({
          id: c.id,  // Keep original ID for backend mapping
          x: c.x,
          y: c.y,
          elevation: c.elevation,
        })),
        walls: state.walls.map((w) => ({
          id: w.id,  // Keep original ID for backend mapping
          startCornerId: w.startCornerId,
          endCornerId: w.endCornerId,
          thickness: w.thickness,
          height: w.height,
          wallType: w.wallType,
        })),
        doors: state.doors.map((d) => ({
          id: d.id,  // Keep original ID for backend mapping
          wallId: d.wallId,
          position: d.position,
          type: d.type,
          width: d.width,
          height: d.height,
          orientation: state.doorOrientations[d.id] ?? 0,
        })),
        windows: state.windows.map((w) => ({
          id: w.id,  // Keep original ID for backend mapping
          wallId: w.wallId,
          position: w.position,
          type: w.type,
          width: w.width,
          height: w.height,
          sillHeight: w.sillHeight,
        })),
        furniture: state.furniture.map((f) => ({
          id: f.id,  // Keep original ID for backend mapping
          type: f.type,
          x: f.x,
          y: f.y,
          rotation: f.rotation,
          width: f.width,
          depth: f.depth,
        })),
        boundaryCorners,
        boundaryWalls,
      })

      // Reload data with new IDs
      if (response.data) {
        dispatch({ type: "SET_BLUEPRINT", blueprintId: response.data.id })
        dispatch({
          type: "LOAD_DATA",
          data: {
            corners: response.data.corners,
            walls: response.data.walls,
            doors: response.data.doors,
            windows: response.data.windows,
            furniture: response.data.furniture,
            rooms: response.data.rooms,
            lot: response.data.lot || null,
            version: response.data.version,
          },
        })
        dispatch({ type: "MARK_CLEAN" })
      }

      onSave?.({ id: response.data.id, version: response.data.version })
    } catch (err) {
      console.error("Failed to save blueprint:", err)
      setError("Failed to save blueprint")
    } finally {
      setSaving(false)
    }
  }, [state, projectId, dispatch, onSave])

  // Create manual save wrapper (must be after handleSave)
  const handleCreateManualSave = useCallback(async (label?: string) => {
    // First save to database
    await handleSave()
    // Then create snapshot (backend captures current state)
    // Also save ADU boundary to localStorage alongside the snapshot
    await createManualSave(state.aduBoundary, state.showAduBoundary, label)
  }, [handleSave, createManualSave, state.aduBoundary, state.showAduBoundary])

  // Zoom handlers
  const handleWheel = useCallback((e: any) => {
    // Don't zoom if camera is locked
    if (state.cameraLocked) return

    e.evt.preventDefault()

    const scaleBy = 1.1
    const stage = e.target.getStage()
    const oldScale = canvasConfig.zoom
    const pointer = stage.getPointerPosition()

    const mousePointTo = {
      x: (pointer.x - canvasConfig.panX) / oldScale,
      y: (pointer.y - canvasConfig.panY) / oldScale,
    }

    const direction = e.evt.deltaY > 0 ? -1 : 1
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy

    // Clamp zoom
    const clampedScale = Math.max(0.1, Math.min(5, newScale))

    setCanvasConfig((prev) => ({
      ...prev,
      zoom: clampedScale,
      panX: pointer.x - mousePointTo.x * clampedScale,
      panY: pointer.y - mousePointTo.y * clampedScale,
    }))
  }, [canvasConfig, state.cameraLocked])

  const handleZoomIn = useCallback(() => {
    setCanvasConfig((prev) => ({
      ...prev,
      zoom: Math.min(5, prev.zoom * 1.2),
    }))
  }, [])

  const handleZoomOut = useCallback(() => {
    setCanvasConfig((prev) => ({
      ...prev,
      zoom: Math.max(0.1, prev.zoom / 1.2),
    }))
  }, [])

  const handleResetView = useCallback(() => {
    setCanvasConfig((prev) => ({
      ...prev,
      zoom: 1,
      // Center the origin in the viewport
      panX: prev.viewportWidth / 2,
      panY: prev.viewportHeight / 2,
    }))
  }, [])

  // Middle mouse button panning handlers
  const handleMiddleMouseDown = useCallback((e: any) => {
    // Check for middle mouse button (button 1)
    if (e.evt.button === 1) {
      e.evt.preventDefault()
      setIsMiddleMousePanning(true)
      middleMouseStartRef.current = {
        x: e.evt.clientX,
        y: e.evt.clientY,
        panX: canvasConfig.panX,
        panY: canvasConfig.panY,
      }
      // Change cursor to grabbing
      const stage = e.target.getStage()
      if (stage) stage.container().style.cursor = "grabbing"
    }
  }, [canvasConfig.panX, canvasConfig.panY])

  const handleMiddleMouseMove = useCallback((e: any) => {
    if (isMiddleMousePanning && middleMouseStartRef.current) {
      const dx = e.evt.clientX - middleMouseStartRef.current.x
      const dy = e.evt.clientY - middleMouseStartRef.current.y
      setCanvasConfig((prev) => ({
        ...prev,
        panX: middleMouseStartRef.current!.panX + dx,
        panY: middleMouseStartRef.current!.panY + dy,
      }))
    }
  }, [isMiddleMousePanning])

  const handleMiddleMouseUp = useCallback((e: any) => {
    if (e.evt.button === 1 || isMiddleMousePanning) {
      setIsMiddleMousePanning(false)
      middleMouseStartRef.current = null
      // Reset cursor
      const stage = e.target.getStage()
      if (stage) stage.container().style.cursor = "default"
    }
  }, [isMiddleMousePanning])

  const handleToggleGrid = useCallback(() => {
    dispatch({ type: "TOGGLE_GRID" })
  }, [dispatch])

  const handleToggleCameraLock = useCallback(() => {
    dispatch({ type: "TOGGLE_CAMERA_LOCK" })
  }, [dispatch])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return
      }

      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
        return
      }

      // Ctrl/Cmd + Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }

      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z to redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
        return
      }

      // Ctrl/Cmd + A to select all (of current type if in element mode)
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault()
        // Select all based on current mode
        const typeMap: Record<string, string> = {
          select: "corner",
          wall: "wall",
          room: "room",
          door: "door",
          window: "window",
          furniture: "furniture",
        }
        const selectionType = typeMap[state.mode]
        if (selectionType) {
          dispatch({ type: "SELECT_ALL_OF_TYPE", selectionType: selectionType as any })
        }
        return
      }

      // Mode shortcuts (V, W, B, I, O, D, N, F, X) - B for Box/Rectangle to avoid R conflict with Rotate
      const key = e.key.toLowerCase()
      const modeMap: Record<string, "select" | "wall" | "rectangle" | "divider" | "room" | "door" | "window" | "furniture" | "delete"> = {
        v: "select",
        w: "wall",
        b: "rectangle",  // B for Box (R is used for Rotate selection)
        i: "divider",    // I for room dIvider (virtual walls)
        o: "room",
        d: "door",
        n: "window",
        f: "furniture",
        x: "delete",
      }

      if (modeMap[key]) {
        dispatch({ type: "SET_MODE", mode: modeMap[key] })
        dispatch({ type: "CANCEL_DRAWING" })
        dispatch({ type: "SET_PLACEMENT_TYPE", placementType: null })
        return
      }

      // + to zoom in
      if (e.key === "+" || e.key === "=") {
        handleZoomIn()
        return
      }
      // - to zoom out
      if (e.key === "-") {
        handleZoomOut()
        return
      }
      // 0 to reset view
      if (e.key === "0") {
        handleResetView()
        return
      }
      // L to toggle camera lock
      if (key === "l") {
        handleToggleCameraLock()
        return
      }
      // G to toggle grid
      if (key === "g") {
        dispatch({ type: "TOGGLE_GRID" })
        return
      }
      // M to toggle dimensions/measurements
      if (key === "m") {
        dispatch({ type: "TOGGLE_DIMENSIONS" })
        return
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts)
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts)
  }, [state.mode, dispatch, handleSave, handleUndo, handleRedo, handleZoomIn, handleZoomOut, handleResetView, handleToggleCameraLock])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <div className="text-lg text-slate-400">Loading floor plan...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-800">
      {/* Full-screen canvas */}
      <div ref={containerRef} className="absolute inset-0 bg-slate-100">
        <Stage
          ref={stageRef}
          width={canvasConfig.viewportWidth}
          height={canvasConfig.viewportHeight}
          onClick={handleCanvasClick}
          onMouseDown={(e: any) => {
            handleMiddleMouseDown(e)
            handleCanvasMouseDown(e)
          }}
          onMouseMove={(e: any) => {
            if (isMiddleMousePanning) {
              handleMiddleMouseMove(e)
            } else {
              handleCanvasMouseMove(e)
            }
          }}
          onMouseUp={(e: any) => {
            handleMiddleMouseUp(e)
            handleCanvasMouseUp(e)
          }}
          onDblClick={handleCanvasDoubleClick}
          onWheel={handleWheel}
          draggable={!state.cameraLocked && state.mode !== "rectangle" && state.mode !== "select" && !state.isSelectionBoxActive}
          onDragEnd={(e) => {
            const stage = e.target.getStage()
            if (stage) {
              setCanvasConfig((prev) => ({
                ...prev,
                panX: stage.x(),
                panY: stage.y(),
              }))
            }
          }}
          x={canvasConfig.panX}
          y={canvasConfig.panY}
          scaleX={canvasConfig.zoom}
          scaleY={canvasConfig.zoom}
        >
          <Layer>
            {/* Grid (bottom layer) */}
            {state.showGrid && <GridLayer config={canvasConfig} />}

            {/* Lot overlay (behind floor plan) */}
            {state.lot && (
              <LotOverlay
                config={canvasConfig}
                lot={state.lot}
                visible={showLotOverlay}
                corners={state.corners}
              />
            )}

            {/* ADU boundary overlay (buildable area guide) */}
            <AduBoundaryOverlay
              config={canvasConfig}
              boundary={state.aduBoundary}
              visible={state.showAduBoundary}
              editMode={aduEditMode}
              dispatch={dispatch}
            />

            {/* Rooms fill (computed from walls) */}
            <RoomsLayer config={canvasConfig} state={state} dispatch={dispatch} />

            {/* Walls */}
            <WallsLayer config={canvasConfig} state={state} dispatch={dispatch} />

            {/* Doors */}
            <DoorsLayer config={canvasConfig} state={state} dispatch={dispatch} />

            {/* Windows */}
            <WindowsLayer config={canvasConfig} state={state} dispatch={dispatch} />

            {/* Furniture */}
            <FurnitureLayer config={canvasConfig} state={state} dispatch={dispatch} />

            {/* Corners (top layer for selection) */}
            <CornersLayer config={canvasConfig} state={state} dispatch={dispatch} />

            {/* Drawing preview */}
            <DrawingPreview config={canvasConfig} state={state} dispatch={dispatch} />
          </Layer>
        </Stage>
      </div>

      {/* Top toolbar - floating, centered */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-1 bg-slate-900/95 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-xl border border-slate-700">
          {/* File Menu */}
          <FileMenu
            projectId={projectId}
            isDirty={state.isDirty}
            saving={saving}
            autoSaves={autoSaves}
            lastAutoSave={lastAutoSave}
            onRestoreAutoSave={handleRestoreAutoSave}
            onClearAutoSaves={clearAutoSaves}
            manualSaves={manualSaves}
            manualSaveLoading={manualSaveLoading}
            onCreateManualSave={handleCreateManualSave}
            onRestoreManualSave={handleRestoreManualSave}
            onDeleteManualSave={deleteManualSave}
            onSave={handleSave}
            onNewBlueprint={handleNewBlueprint}
            onExport={() => setExportDialogOpen(true)}
          />

          {/* Separator */}
          <div className="w-px h-6 bg-slate-600 mx-1" />

          <ModeSelector mode={state.mode} dispatch={dispatch} compact />
        </div>
      </div>

      {/* Left floating panel - Tools */}
      <div
        className={cn(
          "absolute top-16 left-3 z-10 transition-all duration-300 ease-in-out",
          leftPanelOpen ? "translate-x-0" : "-translate-x-[calc(100%+12px)]"
        )}
      >
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-slate-200 w-52 max-h-[calc(100vh-120px)] overflow-hidden flex flex-col">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tools</span>
            <button
              onClick={() => setLeftPanelOpen(false)}
              className="p-1 hover:bg-slate-200 rounded text-slate-500"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* ADU Size Slider - always visible */}
            <AduSizeSlider
              boundary={state.aduBoundary}
              showBoundary={state.showAduBoundary}
              editMode={aduEditMode}
              onEditModeChange={setAduEditMode}
              dispatch={dispatch}
            />

            <div className="border-t pt-3" />

            {/* Mode-specific palettes */}
            {state.mode === "door" && (
              <DoorPalette
                dispatch={dispatch}
                selectedType={state.placementType as DoorType | null}
              />
            )}

            {state.mode === "window" && (
              <WindowPalette
                dispatch={dispatch}
                selectedType={state.placementType as WindowType | null}
              />
            )}

            {state.mode === "furniture" && (
              <FurniturePalette
                dispatch={dispatch}
                selectedType={state.placementType as FurnitureType | null}
              />
            )}

            {/* Keyboard shortcuts (always visible) */}
            <div className="text-xs text-slate-600">
              <div className="font-semibold mb-2 text-slate-700">Shortcuts</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <span className="text-slate-500">Modes</span>
                <span className="font-mono text-slate-700">V W B O D N F X</span>
                <span className="text-slate-500">Undo/Redo</span>
                <span className="font-mono text-slate-700">Ctrl+Z/Y</span>
                <span className="text-slate-500">Save</span>
                <span className="font-mono text-slate-700">Ctrl+S</span>
                <span className="text-slate-500">Delete</span>
                <span className="font-mono text-slate-700">Del</span>
                <span className="text-slate-500">Move</span>
                <span className="font-mono text-slate-700">Arrow keys</span>
                <span className="text-slate-500">Rotate</span>
                <span className="font-mono text-slate-700">R (selection)</span>
                <span className="text-slate-500">Grid</span>
                <span className="font-mono text-slate-700">G</span>
                <span className="text-slate-500">Measurements</span>
                <span className="font-mono text-slate-700">M</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Left panel toggle (when closed) */}
      {!leftPanelOpen && (
        <button
          onClick={() => setLeftPanelOpen(true)}
          className="absolute top-16 left-3 z-10 p-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-lg shadow-lg transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Right floating panel - Properties */}
      <div
        className={cn(
          "absolute top-16 right-3 z-10 transition-all duration-300 ease-in-out",
          rightPanelOpen ? "translate-x-0" : "translate-x-[calc(100%+12px)]"
        )}
      >
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-slate-200 w-64 max-h-[calc(100vh-120px)] overflow-hidden flex flex-col">
          {/* Panel header with tabs */}
          <div className="flex items-center border-b bg-slate-50">
            <button
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                !state.selection
                  ? "border-b-2 border-primary text-primary bg-white"
                  : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => dispatch({ type: "CLEAR_SELECTION" })}
            >
              Info
            </button>
            <button
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                state.selection
                  ? "border-b-2 border-primary text-primary bg-white"
                  : "text-slate-400"
              )}
              disabled={!state.selection}
            >
              Properties
            </button>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="p-2 hover:bg-slate-200 text-slate-500 border-l"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-3">
            {state.selection ? (
              <PropertiesPanel state={state} dispatch={dispatch} />
            ) : (
              <div className="space-y-3">
                {/* Summary stats */}
                <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                        {state.rooms.length > 0 ? "Total Area" : "ADU Boundary"}
                      </div>
                      <div className="text-xl font-bold text-primary">
                        {(state.rooms.length > 0
                          ? state.rooms.reduce((sum, r) => sum + r.area, 0)
                          : calculatePolygonArea(state.aduBoundary.corners)
                        ).toFixed(0)}
                        <span className="text-xs font-normal text-slate-500 ml-1">sq ft</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {state.rooms.length > 0 && <div>{state.rooms.length} rooms</div>}
                      <div>{state.walls.length} walls</div>
                      <div>{state.corners.length} corners</div>
                    </div>
                  </div>
                </div>

                {/* Element lists */}
                <ElementLists state={state} dispatch={dispatch} />

                {/* Lot selector */}
                <LotSelector
                  lot={state.lot}
                  blueprintId={state.blueprintId}
                  dispatch={dispatch}
                  showOverlay={showLotOverlay}
                  onToggleOverlay={setShowLotOverlay}
                />
              </div>
            )}
          </div>

          {/* Version footer */}
          <div className="px-3 py-1.5 border-t bg-slate-50 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <span>v{state.version}</span>
              {state.isDirty && (
                <span className="text-orange-600 font-medium">Unsaved</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel toggle (when closed) */}
      {!rightPanelOpen && (
        <button
          onClick={() => setRightPanelOpen(true)}
          className="absolute top-16 right-3 z-10 p-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-lg shadow-lg transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Bottom-left overlays */}
      <div className="absolute bottom-3 left-3 z-10 space-y-2">
        {/* Area indicator */}
        <AreaIndicator
          totalArea={
            state.rooms.length > 0
              ? state.rooms.reduce((sum, r) => sum + r.area, 0)
              : calculatePolygonArea(state.aduBoundary.corners)
          }
          roomCount={state.rooms.length}
          wallCount={state.walls.length}
          doorCount={state.doors.length}
          windowCount={state.windows.length}
          selectedCount={state.multiSelection.length + (state.selection && state.multiSelection.length === 0 ? 1 : 0)}
        />

        {/* Canvas controls */}
        <CanvasControls
          zoom={canvasConfig.zoom}
          showGrid={state.showGrid}
          cameraLocked={state.cameraLocked}
          isDirty={state.isDirty}
          saving={saving}
          canUndo={historyState.canUndo}
          canRedo={historyState.canRedo}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onToggleGrid={handleToggleGrid}
          onToggleCameraLock={handleToggleCameraLock}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={handleSave}
        />
      </div>

      {/* Bottom-right overlays */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2">
        {/* Export button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExportDialogOpen(true)}
          className="gap-1.5 bg-white/95 backdrop-blur-sm shadow-lg border-slate-200"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>

        {/* Compass */}
        <Compass />
      </div>

      {/* Error toast */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-30">
          {error}
          <button
            className="ml-2 underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Export dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        stageRef={stageRef}
        state={state}
        config={canvasConfig}
        blueprintId={state.blueprintId}
        projectName="ADU Floor Plan"
      />

      {/* Auto-save Recovery Dialog */}
      <Dialog
        open={recoveryDialog.show}
        onOpenChange={(open) => !open && setRecoveryDialog({ show: false, save: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-500" />
              Recover Unsaved Work?
            </DialogTitle>
            <DialogDescription>
              We found an auto-saved version of your work that&apos;s more recent than the last saved version.
            </DialogDescription>
          </DialogHeader>

          {recoveryDialog.save && (
            <div className="p-4 bg-slate-50 rounded-lg border space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-slate-500" />
                <span className="text-slate-600">
                  Auto-saved {new Date(recoveryDialog.save.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-slate-500">
                Contains: {recoveryDialog.save.data.walls?.length || 0} walls,{" "}
                {recoveryDialog.save.data.corners?.length || 0} corners,{" "}
                {recoveryDialog.save.data.rooms?.length || 0} rooms
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRecoveryDialog({ show: false, save: null })}
            >
              Discard Auto-save
            </Button>
            <Button
              onClick={() => {
                if (recoveryDialog.save) {
                  handleRestoreAutoSave(recoveryDialog.save)
                }
                setRecoveryDialog({ show: false, save: null })
              }}
            >
              Restore Auto-save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default FloorPlanEditorV2
