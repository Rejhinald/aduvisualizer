"use client"

import { useMemo } from "react"
import type { EditorState, EditorAction, Corner, Wall, Door, Window, Furniture, Room, RoomType } from "../types"
import { DIMENSIONS, FURNITURE_DIMENSIONS } from "../constants"
import { feetToDisplayString } from "@/lib/api/client-v2"

// Room type labels and colors
const ROOM_TYPE_OPTIONS: { value: RoomType; label: string; color: string }[] = [
  { value: "bedroom", label: "Bedroom", color: "#818cf8" },
  { value: "bathroom", label: "Bathroom", color: "#38bdf8" },
  { value: "half_bath", label: "Half Bath", color: "#7dd3fc" },
  { value: "kitchen", label: "Kitchen", color: "#fbbf24" },
  { value: "living", label: "Living Room", color: "#4ade80" },
  { value: "dining", label: "Dining", color: "#a3e635" },
  { value: "closet", label: "Closet", color: "#d4d4d4" },
  { value: "laundry", label: "Laundry", color: "#f472b6" },
  { value: "storage", label: "Storage", color: "#9ca3af" },
  { value: "utility", label: "Utility", color: "#a78bfa" },
  { value: "entry", label: "Entry", color: "#fb923c" },
  { value: "corridor", label: "Corridor", color: "#e5e7eb" },
  { value: "flex", label: "Flex Space", color: "#2dd4bf" },
  { value: "other", label: "Other", color: "#94a3b8" },
]

interface PropertiesPanelProps {
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
}

export function PropertiesPanel({ state, dispatch }: PropertiesPanelProps) {
  const { selection, corners, walls, doors, windows, furniture, rooms } = state

  // Get selected element
  const selectedElement = useMemo(() => {
    if (!selection) return null

    switch (selection.type) {
      case "corner":
        return { type: "corner", data: corners.find((c) => c.id === selection.id) }
      case "wall":
        return { type: "wall", data: walls.find((w) => w.id === selection.id) }
      case "door":
        return { type: "door", data: doors.find((d) => d.id === selection.id) }
      case "window":
        return { type: "window", data: windows.find((w) => w.id === selection.id) }
      case "furniture":
        return { type: "furniture", data: furniture.find((f) => f.id === selection.id) }
      case "room":
        return { type: "room", data: rooms.find((r) => r.id === selection.id) }
      default:
        return null
    }
  }, [selection, corners, walls, doors, windows, furniture, rooms])

  if (!selectedElement || !selectedElement.data) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        Select an element to view properties
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-gray-700 capitalize">
        {selectedElement.type} Properties
      </h4>

      {selectedElement.type === "corner" && (
        <CornerProperties
          corner={selectedElement.data as Corner}
          dispatch={dispatch}
        />
      )}

      {selectedElement.type === "wall" && (
        <WallProperties
          wall={selectedElement.data as Wall}
          corners={corners}
          dispatch={dispatch}
        />
      )}

      {selectedElement.type === "door" && (
        <DoorProperties
          door={selectedElement.data as Door}
          dispatch={dispatch}
        />
      )}

      {selectedElement.type === "window" && (
        <WindowProperties
          window={selectedElement.data as Window}
          dispatch={dispatch}
        />
      )}

      {selectedElement.type === "furniture" && (
        <FurnitureProperties
          furniture={selectedElement.data as Furniture}
          dispatch={dispatch}
        />
      )}

      {selectedElement.type === "room" && (
        <RoomProperties
          room={selectedElement.data as Room}
          dispatch={dispatch}
        />
      )}
    </div>
  )
}

function CornerProperties({
  corner,
  dispatch,
}: {
  corner: Corner
  dispatch: React.Dispatch<EditorAction>
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">X (feet)</label>
          <input
            type="number"
            value={corner.x}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_CORNER",
                id: corner.id,
                x: parseFloat(e.target.value) || 0,
                y: corner.y,
              })
            }
            className="w-full px-2 py-1 border rounded text-sm"
            step="0.5"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Y (feet)</label>
          <input
            type="number"
            value={corner.y}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_CORNER",
                id: corner.id,
                x: corner.x,
                y: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full px-2 py-1 border rounded text-sm"
            step="0.5"
          />
        </div>
      </div>

      <button
        onClick={() => dispatch({ type: "DELETE_CORNER", id: corner.id })}
        className="w-full px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600"
      >
        Delete Corner
      </button>
    </div>
  )
}

function WallProperties({
  wall,
  corners,
  dispatch,
}: {
  wall: Wall
  corners: Corner[]
  dispatch: React.Dispatch<EditorAction>
}) {
  const startCorner = corners.find((c) => c.id === wall.startCornerId)
  const endCorner = corners.find((c) => c.id === wall.endCornerId)

  const length = useMemo(() => {
    if (!startCorner || !endCorner) return 0
    const dx = endCorner.x - startCorner.x
    const dy = endCorner.y - startCorner.y
    return Math.sqrt(dx * dx + dy * dy)
  }, [startCorner, endCorner])

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="text-xs text-gray-500">Length</label>
        <div className="px-2 py-1 bg-gray-100 rounded text-sm">
          {feetToDisplayString(length)}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500">Thickness (feet)</label>
        <input
          type="number"
          value={wall.thickness ?? DIMENSIONS.WALL_THICKNESS}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_WALL",
              id: wall.id,
              thickness: parseFloat(e.target.value) || DIMENSIONS.WALL_THICKNESS,
            })
          }
          className="w-full px-2 py-1 border rounded text-sm"
          step="0.1"
          min="0.1"
          max="2"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500">Height (feet)</label>
        <input
          type="number"
          value={wall.height ?? DIMENSIONS.WALL_HEIGHT}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_WALL",
              id: wall.id,
              height: parseFloat(e.target.value) || DIMENSIONS.WALL_HEIGHT,
            })
          }
          className="w-full px-2 py-1 border rounded text-sm"
          step="0.5"
          min="7"
          max="20"
        />
      </div>

      <button
        onClick={() => dispatch({ type: "DELETE_WALL", id: wall.id })}
        className="w-full px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600"
      >
        Delete Wall
      </button>
    </div>
  )
}

function DoorProperties({
  door,
  dispatch,
}: {
  door: Door
  dispatch: React.Dispatch<EditorAction>
}) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="text-xs text-gray-500">Type</label>
        <select
          value={door.type}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_DOOR",
              id: door.id,
              doorType: e.target.value as any,
            })
          }
          className="w-full px-2 py-1 border rounded text-sm"
        >
          <option value="single">Single Door</option>
          <option value="double">Double Door</option>
          <option value="sliding">Sliding Door</option>
          <option value="french">French Door</option>
          <option value="opening">Open Passage</option>
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-500">Position on Wall (0-1)</label>
        <input
          type="number"
          value={door.position}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_DOOR",
              id: door.id,
              position: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0.5)),
            })
          }
          className="w-full px-2 py-1 border rounded text-sm"
          step="0.05"
          min="0"
          max="1"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500">Width (feet)</label>
        <input
          type="number"
          value={door.width ?? DIMENSIONS.DOOR_WIDTH_SINGLE}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_DOOR",
              id: door.id,
              width: parseFloat(e.target.value) || DIMENSIONS.DOOR_WIDTH_SINGLE,
            })
          }
          className="w-full px-2 py-1 border rounded text-sm"
          step="0.5"
          min="2"
          max="8"
        />
      </div>

      <button
        onClick={() => dispatch({ type: "DELETE_DOOR", id: door.id })}
        className="w-full px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600"
      >
        Delete Door
      </button>
    </div>
  )
}

function WindowProperties({
  window,
  dispatch,
}: {
  window: Window
  dispatch: React.Dispatch<EditorAction>
}) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="text-xs text-gray-500">Type</label>
        <select
          value={window.type}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_WINDOW",
              id: window.id,
              windowType: e.target.value as any,
            })
          }
          className="w-full px-2 py-1 border rounded text-sm"
        >
          <option value="standard">Standard</option>
          <option value="bay">Bay Window</option>
          <option value="picture">Picture Window</option>
          <option value="sliding">Sliding Window</option>
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-500">Position on Wall (0-1)</label>
        <input
          type="number"
          value={window.position}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_WINDOW",
              id: window.id,
              position: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0.5)),
            })
          }
          className="w-full px-2 py-1 border rounded text-sm"
          step="0.05"
          min="0"
          max="1"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Width (ft)</label>
          <input
            type="number"
            value={window.width ?? DIMENSIONS.WINDOW_WIDTH}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_WINDOW",
                id: window.id,
                width: parseFloat(e.target.value) || DIMENSIONS.WINDOW_WIDTH,
              })
            }
            className="w-full px-2 py-1 border rounded text-sm"
            step="0.5"
            min="1"
            max="10"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Height (ft)</label>
          <input
            type="number"
            value={window.height ?? DIMENSIONS.WINDOW_HEIGHT}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_WINDOW",
                id: window.id,
                height: parseFloat(e.target.value) || DIMENSIONS.WINDOW_HEIGHT,
              })
            }
            className="w-full px-2 py-1 border rounded text-sm"
            step="0.5"
            min="1"
            max="8"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500">Sill Height (feet)</label>
        <input
          type="number"
          value={window.sillHeight ?? DIMENSIONS.WINDOW_SILL_HEIGHT}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_WINDOW",
              id: window.id,
              sillHeight: parseFloat(e.target.value) || DIMENSIONS.WINDOW_SILL_HEIGHT,
            })
          }
          className="w-full px-2 py-1 border rounded text-sm"
          step="0.5"
          min="0"
          max="5"
        />
      </div>

      <button
        onClick={() => dispatch({ type: "DELETE_WINDOW", id: window.id })}
        className="w-full px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600"
      >
        Delete Window
      </button>
    </div>
  )
}

function FurnitureProperties({
  furniture,
  dispatch,
}: {
  furniture: Furniture
  dispatch: React.Dispatch<EditorAction>
}) {
  const config = FURNITURE_DIMENSIONS[furniture.type]

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="text-xs text-gray-500">Type</label>
        <div className="px-2 py-1 bg-gray-100 rounded text-sm">
          {config?.name || furniture.type}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">X (feet)</label>
          <input
            type="number"
            value={furniture.x}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_FURNITURE",
                id: furniture.id,
                x: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full px-2 py-1 border rounded text-sm"
            step="0.5"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Y (feet)</label>
          <input
            type="number"
            value={furniture.y}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_FURNITURE",
                id: furniture.id,
                y: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full px-2 py-1 border rounded text-sm"
            step="0.5"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500">Rotation (degrees)</label>
        <div className="flex gap-1">
          {[0, 90, 180, 270].map((angle) => (
            <button
              key={angle}
              onClick={() =>
                dispatch({ type: "UPDATE_FURNITURE", id: furniture.id, rotation: angle })
              }
              className={`
                flex-1 px-2 py-1 rounded text-xs
                ${furniture.rotation === angle
                  ? "bg-primary text-white"
                  : "bg-gray-100 hover:bg-gray-200"
                }
              `}
            >
              {angle}°
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => dispatch({ type: "DELETE_FURNITURE", id: furniture.id })}
        className="w-full px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600"
      >
        Delete Furniture
      </button>
    </div>
  )
}

function RoomProperties({
  room,
  dispatch,
}: {
  room: Room
  dispatch: React.Dispatch<EditorAction>
}) {
  const currentTypeOption = ROOM_TYPE_OPTIONS.find((opt) => opt.value === room.type)

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="text-xs text-gray-500">Room Name</label>
        <input
          type="text"
          value={room.name || ""}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_ROOM_NAME",
              roomId: room.id,
              name: e.target.value,
            })
          }
          placeholder={currentTypeOption?.label || "Unnamed Room"}
          className="w-full px-2 py-1 border rounded text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500">Room Type</label>
        <div className="grid grid-cols-2 gap-1 mt-1">
          {ROOM_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                dispatch({
                  type: "UPDATE_ROOM_TYPE",
                  roomId: room.id,
                  roomType: opt.value,
                })
              }
              className={`
                flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-left
                ${room.type === opt.value
                  ? "bg-primary text-white"
                  : "bg-gray-100 hover:bg-gray-200"
                }
              `}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: opt.color }}
              />
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Area:</span>
          <span className="font-medium">{room.area.toFixed(1)} sq ft</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-500">Walls:</span>
          <span className="font-medium">{room.walls.length}</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-500">Corners:</span>
          <span className="font-medium">{room.corners.length}</span>
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={() =>
            dispatch({ type: "ROTATE_ROOM", roomId: room.id, degrees: 90 })
          }
          className="w-full px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
        >
          Rotate 90°
        </button>
      </div>
    </div>
  )
}
