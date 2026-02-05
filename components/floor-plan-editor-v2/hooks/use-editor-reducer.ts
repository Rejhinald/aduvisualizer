"use client"

import { useReducer, useCallback } from "react"
import type { EditorState, EditorAction } from "../types"
import { INITIAL_EDITOR_STATE, createAduBoundary, ADU_SIZE_MIN, ADU_SIZE_MAX } from "../constants"

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    // Mode actions
    case "SET_MODE":
      return {
        ...state,
        mode: action.mode,
        selection: null,
        isDrawing: false,
        drawingStart: null,
        drawingCorners: [],
        placementPreview: null,
      }

    // Selection actions
    case "SELECT":
      return {
        ...state,
        selection: action.selection,
        multiSelection: [],  // Clear multi-selection when single selecting
      }

    case "TOGGLE_SELECT": {
      // Ctrl+click behavior
      const exists = state.multiSelection.some(
        (s) => s.type === action.selection.type && s.id === action.selection.id
      )

      if (exists) {
        // Remove from selection
        return {
          ...state,
          multiSelection: state.multiSelection.filter(
            (s) => !(s.type === action.selection.type && s.id === action.selection.id)
          ),
          selection: null,
        }
      } else {
        // Add to selection
        const newMultiSelection = [...state.multiSelection, action.selection]
        return {
          ...state,
          multiSelection: newMultiSelection,
          selection: action.selection,  // Also set as primary selection
        }
      }
    }

    case "ADD_TO_SELECTION": {
      const exists = state.multiSelection.some(
        (s) => s.type === action.selection.type && s.id === action.selection.id
      )
      if (exists) return state

      return {
        ...state,
        multiSelection: [...state.multiSelection, action.selection],
        selection: action.selection,
      }
    }

    case "CLEAR_SELECTION":
      return { ...state, selection: null, multiSelection: [] }

    case "SELECT_ALL_OF_TYPE": {
      let items: Array<{ type: typeof action.selectionType; id: string }> = []

      switch (action.selectionType) {
        case "corner":
          items = state.corners.map((c) => ({ type: "corner" as const, id: c.id }))
          break
        case "wall":
          items = state.walls.map((w) => ({ type: "wall" as const, id: w.id }))
          break
        case "door":
          items = state.doors.map((d) => ({ type: "door" as const, id: d.id }))
          break
        case "window":
          items = state.windows.map((w) => ({ type: "window" as const, id: w.id }))
          break
        case "furniture":
          items = state.furniture.map((f) => ({ type: "furniture" as const, id: f.id }))
          break
        case "room":
          items = state.rooms.map((r) => ({ type: "room" as const, id: r.id }))
          break
      }

      return {
        ...state,
        multiSelection: items,
        selection: items.length > 0 ? items[0] : null,
      }
    }

    case "HOVER":
      return { ...state, hoveredElement: action.element }

    // Data actions
    case "SET_BLUEPRINT":
      return { ...state, blueprintId: action.blueprintId }

    case "LOAD_DATA": {
      // Extract door orientations from loaded doors
      const doorOrientations: Record<string, number> = {}
      for (const door of action.data.doors) {
        if (door.orientation !== undefined) {
          doorOrientations[door.id] = door.orientation
        }
      }
      return {
        ...state,
        corners: action.data.corners,
        walls: action.data.walls,
        doors: action.data.doors,
        windows: action.data.windows,
        furniture: action.data.furniture,
        rooms: action.data.rooms,
        lot: action.data.lot,
        version: action.data.version,
        doorOrientations,
        isDirty: false,
      }
    }

    // Corner actions
    case "ADD_CORNER":
      return {
        ...state,
        corners: [...state.corners, action.corner],
        isDirty: true,
      }

    case "UPDATE_CORNER":
      return {
        ...state,
        corners: state.corners.map((c) =>
          c.id === action.id ? { ...c, x: action.x, y: action.y } : c
        ),
        isDirty: true,
      }

    case "DELETE_CORNER": {
      // Find all walls connected to this corner
      const connectedWalls = state.walls.filter(
        (w) => w.startCornerId === action.id || w.endCornerId === action.id
      )

      // If exactly 2 walls are connected, merge them into one (middle corner case)
      // Example: o----o----o becomes o---------o when deleting middle corner
      if (connectedWalls.length === 2) {
        const [wall1, wall2] = connectedWalls

        // Find the "other" corners (not the one being deleted)
        const otherCornerId1 = wall1.startCornerId === action.id
          ? wall1.endCornerId
          : wall1.startCornerId
        const otherCornerId2 = wall2.startCornerId === action.id
          ? wall2.endCornerId
          : wall2.startCornerId

        // Don't merge if both walls connect to the same corner (loop)
        if (otherCornerId1 !== otherCornerId2) {
          // Create new merged wall
          const mergedWall = {
            ...wall1,
            id: `merged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            startCornerId: otherCornerId1,
            endCornerId: otherCornerId2,
          }

          // Move doors/windows from deleted walls to merged wall
          // Calculate position ratio based on wall lengths
          const getCorner = (id: string) => state.corners.find((c) => c.id === id)
          const deletedCorner = getCorner(action.id)
          const corner1 = getCorner(otherCornerId1)
          const corner2 = getCorner(otherCornerId2)

          let updatedDoors = state.doors
          let updatedWindows = state.windows

          if (deletedCorner && corner1 && corner2) {
            // Calculate lengths for position mapping
            const wall1Length = Math.sqrt(
              Math.pow(deletedCorner.x - corner1.x, 2) +
              Math.pow(deletedCorner.y - corner1.y, 2)
            )
            const wall2Length = Math.sqrt(
              Math.pow(corner2.x - deletedCorner.x, 2) +
              Math.pow(corner2.y - deletedCorner.y, 2)
            )
            const totalLength = wall1Length + wall2Length

            // Remap doors
            updatedDoors = state.doors.map((door) => {
              if (door.wallId === wall1.id) {
                // Door was on wall1, remap position to first segment of merged wall
                const newPosition = (door.position * wall1Length) / totalLength
                return { ...door, wallId: mergedWall.id, position: newPosition }
              }
              if (door.wallId === wall2.id) {
                // Door was on wall2, remap position to second segment of merged wall
                const newPosition = (wall1Length + door.position * wall2Length) / totalLength
                return { ...door, wallId: mergedWall.id, position: newPosition }
              }
              return door
            })

            // Remap windows
            updatedWindows = state.windows.map((window) => {
              if (window.wallId === wall1.id) {
                const newPosition = (window.position * wall1Length) / totalLength
                return { ...window, wallId: mergedWall.id, position: newPosition }
              }
              if (window.wallId === wall2.id) {
                const newPosition = (wall1Length + window.position * wall2Length) / totalLength
                return { ...window, wallId: mergedWall.id, position: newPosition }
              }
              return window
            })
          }

          return {
            ...state,
            corners: state.corners.filter((c) => c.id !== action.id),
            walls: [
              ...state.walls.filter((w) => w.id !== wall1.id && w.id !== wall2.id),
              mergedWall,
            ],
            doors: updatedDoors,
            windows: updatedWindows,
            selection: state.selection?.id === action.id ? null : state.selection,
            isDirty: true,
          }
        }
      }

      // Default: just remove the corner and all connected walls
      // (endpoint corner or corner with >2 walls)
      return {
        ...state,
        corners: state.corners.filter((c) => c.id !== action.id),
        walls: state.walls.filter(
          (w) => w.startCornerId !== action.id && w.endCornerId !== action.id
        ),
        // Remove doors/windows on deleted walls
        doors: state.doors.filter((d) =>
          !connectedWalls.some((w) => w.id === d.wallId)
        ),
        windows: state.windows.filter((w) =>
          !connectedWalls.some((wall) => wall.id === w.wallId)
        ),
        selection: state.selection?.id === action.id ? null : state.selection,
        isDirty: true,
      }
    }

    case "MERGE_CORNERS": {
      // Merge source corner into target corner
      // All walls referencing source will now reference target
      const { sourceId, targetId } = action

      // Don't merge a corner into itself
      if (sourceId === targetId) return state

      // Check if both corners exist
      const sourceExists = state.corners.some((c) => c.id === sourceId)
      const targetExists = state.corners.some((c) => c.id === targetId)
      if (!sourceExists || !targetExists) return state

      // Update all walls to replace sourceId with targetId
      const updatedWalls = state.walls
        .map((wall) => {
          const newWall = { ...wall }
          if (wall.startCornerId === sourceId) {
            newWall.startCornerId = targetId
          }
          if (wall.endCornerId === sourceId) {
            newWall.endCornerId = targetId
          }
          return newWall
        })
        // Remove walls that would connect a corner to itself after merge
        .filter((wall) => wall.startCornerId !== wall.endCornerId)
        // Remove duplicate walls (same start/end corners)
        .filter((wall, index, arr) => {
          const isDuplicate = arr.findIndex((w, i) =>
            i < index &&
            ((w.startCornerId === wall.startCornerId && w.endCornerId === wall.endCornerId) ||
             (w.startCornerId === wall.endCornerId && w.endCornerId === wall.startCornerId))
          ) !== -1
          return !isDuplicate
        })

      // Get IDs of removed walls
      const removedWallIds = state.walls
        .filter((w) => !updatedWalls.some((uw) => uw.id === w.id))
        .map((w) => w.id)

      return {
        ...state,
        // Remove the source corner
        corners: state.corners.filter((c) => c.id !== sourceId),
        walls: updatedWalls,
        // Remove doors/windows on removed walls
        doors: state.doors.filter((d) => !removedWallIds.includes(d.wallId)),
        windows: state.windows.filter((w) => !removedWallIds.includes(w.wallId)),
        selection: state.selection?.id === sourceId ? null : state.selection,
        isDirty: true,
      }
    }

    // Wall actions
    case "ADD_WALL":
      return {
        ...state,
        walls: [...state.walls, action.wall],
        isDirty: true,
      }

    case "UPDATE_WALL":
      return {
        ...state,
        walls: state.walls.map((w) =>
          w.id === action.id
            ? {
                ...w,
                thickness: action.thickness ?? w.thickness,
                height: action.height ?? w.height,
                wallType: action.wallType ?? w.wallType,
              }
            : w
        ),
        isDirty: true,
      }

    case "DELETE_WALL":
      return {
        ...state,
        walls: state.walls.filter((w) => w.id !== action.id),
        // Also remove doors/windows on this wall
        doors: state.doors.filter((d) => d.wallId !== action.id),
        windows: state.windows.filter((w) => w.wallId !== action.id),
        selection: state.selection?.id === action.id ? null : state.selection,
        isDirty: true,
      }

    case "SPLIT_WALL": {
      // Find the wall to split
      const wallToSplit = state.walls.find((w) => w.id === action.wallId)
      if (!wallToSplit) return state

      // Create a new corner at the split point
      const newCornerId = `corner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newCorner = {
        id: newCornerId,
        blueprintId: state.blueprintId || "",
        x: action.point.x,
        y: action.point.y,
        elevation: 0,
      }

      // Create two new walls
      const wall1Id = `wall-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const wall2Id = `wall-${Date.now() + 1}-${Math.random().toString(36).substr(2, 9)}`

      const wall1 = {
        id: wall1Id,
        blueprintId: wallToSplit.blueprintId,
        startCornerId: wallToSplit.startCornerId,
        endCornerId: newCornerId,
        thickness: wallToSplit.thickness,
        height: wallToSplit.height,
        wallType: wallToSplit.wallType,
      }

      const wall2 = {
        id: wall2Id,
        blueprintId: wallToSplit.blueprintId,
        startCornerId: newCornerId,
        endCornerId: wallToSplit.endCornerId,
        thickness: wallToSplit.thickness,
        height: wallToSplit.height,
        wallType: wallToSplit.wallType,
      }

      // Remove doors/windows on the original wall (they would need repositioning)
      return {
        ...state,
        corners: [...state.corners, newCorner as any],
        walls: [
          ...state.walls.filter((w) => w.id !== action.wallId),
          wall1 as any,
          wall2 as any,
        ],
        doors: state.doors.filter((d) => d.wallId !== action.wallId),
        windows: state.windows.filter((w) => w.wallId !== action.wallId),
        selection: null,
        isDirty: true,
      }
    }

    // Door actions
    case "ADD_DOOR":
      return {
        ...state,
        doors: [...state.doors, action.door],
        // Set initial door orientation from preview orientation
        doorOrientations: {
          ...state.doorOrientations,
          [action.door.id]: state.placementPreviewOrientation,
        },
        isDirty: true,
      }

    case "UPDATE_DOOR":
      return {
        ...state,
        doors: state.doors.map((d) =>
          d.id === action.id
            ? {
                ...d,
                position: action.position ?? d.position,
                type: action.doorType ?? d.type,
                width: action.width ?? d.width,
                height: action.height ?? d.height,
              }
            : d
        ),
        isDirty: true,
      }

    case "DELETE_DOOR":
      return {
        ...state,
        doors: state.doors.filter((d) => d.id !== action.id),
        selection: state.selection?.id === action.id ? null : state.selection,
        isDirty: true,
      }

    // Window actions
    case "ADD_WINDOW":
      return {
        ...state,
        windows: [...state.windows, action.window],
        // Set initial window orientation from preview orientation
        windowOrientations: {
          ...state.windowOrientations,
          [action.window.id]: state.placementPreviewOrientation,
        },
        isDirty: true,
      }

    case "UPDATE_WINDOW":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? {
                ...w,
                position: action.position ?? w.position,
                type: action.windowType ?? w.type,
                width: action.width ?? w.width,
                height: action.height ?? w.height,
                sillHeight: action.sillHeight ?? w.sillHeight,
              }
            : w
        ),
        isDirty: true,
      }

    case "DELETE_WINDOW":
      return {
        ...state,
        windows: state.windows.filter((w) => w.id !== action.id),
        selection: state.selection?.id === action.id ? null : state.selection,
        isDirty: true,
      }

    // Furniture actions
    case "ADD_FURNITURE":
      return {
        ...state,
        furniture: [...state.furniture, action.furniture],
        isDirty: true,
      }

    case "UPDATE_FURNITURE":
      return {
        ...state,
        furniture: state.furniture.map((f) =>
          f.id === action.id
            ? {
                ...f,
                x: action.x ?? f.x,
                y: action.y ?? f.y,
                rotation: action.rotation ?? f.rotation,
              }
            : f
        ),
        isDirty: true,
      }

    case "DELETE_FURNITURE":
      return {
        ...state,
        furniture: state.furniture.filter((f) => f.id !== action.id),
        selection: state.selection?.id === action.id ? null : state.selection,
        isDirty: true,
      }

    // Room actions (computed rooms, but we can rotate their corners)
    case "ROTATE_ROOM": {
      // Find the room
      const room = state.rooms.find((r) => r.id === action.roomId)
      if (!room) return state

      // Get the room's center
      const center = room.center

      // Convert degrees to radians
      const radians = (action.degrees * Math.PI) / 180
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)

      // Get corner IDs from this room
      const roomCornerIds = new Set(room.corners.map((c) => c.id))

      // Rotate each corner around the room center
      const newCorners = state.corners.map((corner) => {
        if (!roomCornerIds.has(corner.id)) return corner

        // Translate to origin (center)
        const dx = corner.x - center.x
        const dy = corner.y - center.y

        // Rotate
        const newX = dx * cos - dy * sin
        const newY = dx * sin + dy * cos

        // Translate back
        return {
          ...corner,
          x: Math.round((center.x + newX) * 100) / 100,
          y: Math.round((center.y + newY) * 100) / 100,
        }
      })

      return {
        ...state,
        corners: newCorners,
        isDirty: true,
      }
    }

    case "UPDATE_ROOM_TYPE": {
      // Rooms are computed, but we can store type overrides
      // For now, update the room's type in the computed rooms array
      // (This will be recalculated on next save/load, so we need backend support)
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.roomId ? { ...r, type: action.roomType } : r
        ),
        isDirty: true,
      }
    }

    case "UPDATE_ROOM_NAME": {
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.roomId ? { ...r, name: action.name } : r
        ),
        isDirty: true,
      }
    }

    // Lot actions
    case "SET_LOT":
      return {
        ...state,
        lot: action.lot,
        isDirty: true,
      }

    // ADU Boundary actions
    case "SET_ADU_BOUNDARY_SIZE": {
      const clampedArea = Math.max(ADU_SIZE_MIN, Math.min(ADU_SIZE_MAX, action.targetArea))
      return {
        ...state,
        aduBoundary: createAduBoundary(clampedArea),
      }
    }

    case "LOAD_ADU_BOUNDARY": {
      // Load specific corners from database (sorted by orderIndex)
      // Calculate target area from the polygon using shoelace formula
      let area = 0
      const n = action.corners.length
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        area += action.corners[i].x * action.corners[j].y
        area -= action.corners[j].x * action.corners[i].y
      }
      area = Math.abs(area) / 2
      const targetArea = action.targetArea ?? Math.max(ADU_SIZE_MIN, Math.min(ADU_SIZE_MAX, Math.round(area)))

      return {
        ...state,
        aduBoundary: {
          corners: action.corners,
          targetArea,
        },
      }
    }

    case "UPDATE_ADU_BOUNDARY_CORNER": {
      const newCorners = [...state.aduBoundary.corners]
      newCorners[action.index] = action.point
      return {
        ...state,
        aduBoundary: {
          ...state.aduBoundary,
          corners: newCorners,
        },
      }
    }

    case "ADD_ADU_BOUNDARY_CORNER": {
      // Insert a new corner after the specified index
      const corners = [...state.aduBoundary.corners]
      corners.splice(action.afterIndex + 1, 0, action.point)
      return {
        ...state,
        aduBoundary: {
          ...state.aduBoundary,
          corners,
        },
      }
    }

    case "REMOVE_ADU_BOUNDARY_CORNER": {
      // Don't allow fewer than 3 corners
      if (state.aduBoundary.corners.length <= 3) return state
      const corners = state.aduBoundary.corners.filter((_, i) => i !== action.index)
      return {
        ...state,
        aduBoundary: {
          ...state.aduBoundary,
          corners,
        },
      }
    }

    case "TOGGLE_ADU_BOUNDARY":
      return {
        ...state,
        showAduBoundary: !state.showAduBoundary,
      }

    case "RESET_ADU_BOUNDARY":
      return {
        ...state,
        aduBoundary: createAduBoundary(state.aduBoundary.targetArea),
      }

    // Drawing actions
    case "START_DRAWING":
      return {
        ...state,
        isDrawing: true,
        drawingStart: action.point,
        drawingCorners: [],
      }

    case "ADD_DRAWING_POINT":
      return {
        ...state,
        drawingCorners: [...state.drawingCorners, action.point],
      }

    case "UPDATE_DRAWING_PREVIEW":
      return {
        ...state,
        drawingPreview: action.point,
      }

    case "END_DRAWING":
      return {
        ...state,
        isDrawing: false,
        drawingStart: null,
        drawingCorners: [],
        drawingPreview: null,
      }

    case "CANCEL_DRAWING":
      return {
        ...state,
        isDrawing: false,
        drawingStart: null,
        drawingCorners: [],
        drawingPreview: null,
      }

    // Drag actions
    case "START_DRAG":
      return {
        ...state,
        isDragging: true,
        dragStart: action.point,
      }

    case "UPDATE_DRAG":
      return {
        ...state,
        dragOffset: action.point,
      }

    case "END_DRAG":
      return {
        ...state,
        isDragging: false,
        dragStart: null,
        dragOffset: null,
      }

    // Selection box actions (drag-select)
    case "START_SELECTION_BOX":
      return {
        ...state,
        isSelectionBoxActive: true,
        selectionBoxStart: action.point,
        selectionBoxEnd: action.point,
      }

    case "UPDATE_SELECTION_BOX":
      return {
        ...state,
        selectionBoxEnd: action.point,
      }

    case "END_SELECTION_BOX":
      return {
        ...state,
        isSelectionBoxActive: false,
        selectionBoxStart: null,
        selectionBoxEnd: null,
      }

    case "CANCEL_SELECTION_BOX":
      return {
        ...state,
        isSelectionBoxActive: false,
        selectionBoxStart: null,
        selectionBoxEnd: null,
      }

    // Placement actions
    case "SET_PLACEMENT_TYPE":
      return {
        ...state,
        placementType: action.placementType,
        placementPreview: null,
        placementPreviewAngle: 0,
        placementPreviewWallId: null,
      }

    case "UPDATE_PLACEMENT_PREVIEW":
      return {
        ...state,
        placementPreview: action.point,
        placementPreviewAngle: action.angle ?? state.placementPreviewAngle,
        placementPreviewWallId: action.wallId !== undefined ? action.wallId : state.placementPreviewWallId,
      }

    case "ROTATE_PLACEMENT_PREVIEW":
      return {
        ...state,
        placementPreviewOrientation: (state.placementPreviewOrientation + 1) % 4,
      }

    // UI actions
    case "TOGGLE_GRID":
      return { ...state, showGrid: !state.showGrid }

    case "TOGGLE_DIMENSIONS":
      return { ...state, showDimensions: !state.showDimensions }

    case "TOGGLE_SNAP_GRID":
      return { ...state, snapToGrid: !state.snapToGrid }

    case "TOGGLE_SNAP_CORNER":
      return { ...state, snapToCorner: !state.snapToCorner }

    case "TOGGLE_CAMERA_LOCK":
      return { ...state, cameraLocked: !state.cameraLocked }

    // Version actions
    case "MARK_DIRTY":
      return { ...state, isDirty: true }

    case "MARK_CLEAN":
      return { ...state, isDirty: false }

    case "INCREMENT_VERSION":
      return { ...state, version: state.version + 1 }

    // Batch actions
    case "DELETE_SELECTED": {
      if (state.multiSelection.length === 0 && !state.selection) {
        return state
      }

      const itemsToDelete = state.multiSelection.length > 0
        ? state.multiSelection
        : state.selection
          ? [state.selection]
          : []

      if (itemsToDelete.length === 0) return state

      // Separate items by type
      const cornerIds = new Set(
        itemsToDelete.filter((s) => s.type === "corner").map((s) => s.id)
      )
      const wallIds = new Set(
        itemsToDelete.filter((s) => s.type === "wall").map((s) => s.id)
      )
      const doorIds = new Set(
        itemsToDelete.filter((s) => s.type === "door").map((s) => s.id)
      )
      const windowIds = new Set(
        itemsToDelete.filter((s) => s.type === "window").map((s) => s.id)
      )
      const furnitureIds = new Set(
        itemsToDelete.filter((s) => s.type === "furniture").map((s) => s.id)
      )

      // Also get walls connected to deleted corners
      const wallsFromCorners = state.walls
        .filter((w) => cornerIds.has(w.startCornerId) || cornerIds.has(w.endCornerId))
        .map((w) => w.id)

      // Add those walls to the set
      wallsFromCorners.forEach((id) => wallIds.add(id))

      // Also delete doors/windows on deleted walls
      const doorsFromWalls = state.doors.filter((d) => wallIds.has(d.wallId)).map((d) => d.id)
      const windowsFromWalls = state.windows.filter((w) => wallIds.has(w.wallId)).map((w) => w.id)

      doorsFromWalls.forEach((id) => doorIds.add(id))
      windowsFromWalls.forEach((id) => windowIds.add(id))

      return {
        ...state,
        corners: state.corners.filter((c) => !cornerIds.has(c.id)),
        walls: state.walls.filter((w) => !wallIds.has(w.id)),
        doors: state.doors.filter((d) => !doorIds.has(d.id)),
        windows: state.windows.filter((w) => !windowIds.has(w.id)),
        furniture: state.furniture.filter((f) => !furnitureIds.has(f.id)),
        selection: null,
        multiSelection: [],
        isDirty: true,
      }
    }

    case "MOVE_SELECTED": {
      if (state.multiSelection.length === 0 && !state.selection) {
        return state
      }

      const itemsToMove = state.multiSelection.length > 0
        ? state.multiSelection
        : state.selection
          ? [state.selection]
          : []

      if (itemsToMove.length === 0) return state

      const { offsetX, offsetY } = action

      // Get selected corner IDs
      const cornerIds = new Set(
        itemsToMove.filter((s) => s.type === "corner").map((s) => s.id)
      )

      // Get selected furniture IDs
      const furnitureIds = new Set(
        itemsToMove.filter((s) => s.type === "furniture").map((s) => s.id)
      )

      return {
        ...state,
        corners: state.corners.map((c) =>
          cornerIds.has(c.id)
            ? { ...c, x: c.x + offsetX, y: c.y + offsetY }
            : c
        ),
        furniture: state.furniture.map((f) =>
          furnitureIds.has(f.id)
            ? { ...f, x: f.x + offsetX, y: f.y + offsetY }
            : f
        ),
        isDirty: true,
      }
    }

    case "ROTATE_SELECTED": {
      if (state.multiSelection.length === 0 && !state.selection) {
        return state
      }

      const itemsToRotate = state.multiSelection.length > 0
        ? state.multiSelection
        : state.selection
          ? [state.selection]
          : []

      if (itemsToRotate.length === 0) return state

      const { degrees } = action
      const radians = (degrees * Math.PI) / 180

      // Get selected IDs by type
      const cornerIds = new Set(
        itemsToRotate.filter((s) => s.type === "corner").map((s) => s.id)
      )
      const furnitureIds = new Set(
        itemsToRotate.filter((s) => s.type === "furniture").map((s) => s.id)
      )
      const doorIds = new Set(
        itemsToRotate.filter((s) => s.type === "door").map((s) => s.id)
      )
      const windowIds = new Set(
        itemsToRotate.filter((s) => s.type === "window").map((s) => s.id)
      )

      // Calculate centroid of selected items (for corners and furniture)
      const selectedCorners = state.corners.filter((c) => cornerIds.has(c.id))
      const selectedFurniture = state.furniture.filter((f) => furnitureIds.has(f.id))

      const allPoints = [
        ...selectedCorners.map((c) => ({ x: c.x, y: c.y })),
        ...selectedFurniture.map((f) => ({ x: f.x, y: f.y })),
      ]

      // Rotate function for corners/furniture around centroid
      let newCorners = state.corners
      let newFurniture = state.furniture

      if (allPoints.length > 0) {
        const centroidX = allPoints.reduce((sum, p) => sum + p.x, 0) / allPoints.length
        const centroidY = allPoints.reduce((sum, p) => sum + p.y, 0) / allPoints.length

        const rotatePoint = (x: number, y: number): { x: number; y: number } => {
          const dx = x - centroidX
          const dy = y - centroidY
          return {
            x: centroidX + dx * Math.cos(radians) - dy * Math.sin(radians),
            y: centroidY + dx * Math.sin(radians) + dy * Math.cos(radians),
          }
        }

        newCorners = state.corners.map((c) => {
          if (!cornerIds.has(c.id)) return c
          const rotated = rotatePoint(c.x, c.y)
          return { ...c, x: rotated.x, y: rotated.y }
        })

        newFurniture = state.furniture.map((f) => {
          if (!furnitureIds.has(f.id)) return f
          const rotated = rotatePoint(f.x, f.y)
          return { ...f, x: rotated.x, y: rotated.y, rotation: f.rotation + degrees }
        })
      } else if (furnitureIds.size > 0) {
        // If only furniture selected without corners, just rotate in place
        newFurniture = state.furniture.map((f) => {
          if (!furnitureIds.has(f.id)) return f
          return { ...f, rotation: f.rotation + degrees }
        })
      }

      // Cycle door orientations through 4 states (0 → 1 → 2 → 3 → 0)
      const newDoorOrientations = { ...state.doorOrientations }
      doorIds.forEach((id) => {
        const current = newDoorOrientations[id] || 0
        newDoorOrientations[id] = (current + 1) % 4
      })

      // Cycle window orientations
      const newWindowOrientations = { ...state.windowOrientations }
      windowIds.forEach((id) => {
        const current = newWindowOrientations[id] || 0
        newWindowOrientations[id] = (current + 1) % 4
      })

      return {
        ...state,
        corners: newCorners,
        furniture: newFurniture,
        doorOrientations: newDoorOrientations,
        windowOrientations: newWindowOrientations,
        isDirty: true,
      }
    }

    // History actions
    case "RESTORE_SNAPSHOT":
      return {
        ...state,
        corners: action.snapshot.corners,
        walls: action.snapshot.walls,
        doors: action.snapshot.doors,
        windows: action.snapshot.windows,
        furniture: action.snapshot.furniture,
        rooms: action.snapshot.rooms,
        selection: null,
        multiSelection: [],
        isDirty: true,
      }

    default:
      return state
  }
}

export function useEditorReducer(initialState: Partial<EditorState> = {}) {
  const [state, dispatch] = useReducer(editorReducer, {
    ...INITIAL_EDITOR_STATE,
    ...initialState,
  })

  return { state, dispatch }
}
