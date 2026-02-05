"use client"

import type { EditorAction, DoorType } from "../types"
import { DOOR_TYPES, COLORS } from "../constants"

interface DoorPaletteProps {
  dispatch: React.Dispatch<EditorAction>
  selectedType: DoorType | null
}

export function DoorPalette({ dispatch, selectedType }: DoorPaletteProps) {
  const handleSelectDoor = (type: DoorType) => {
    dispatch({ type: "SET_MODE", mode: "door" })
    dispatch({ type: "SET_PLACEMENT_TYPE", placementType: type })
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-gray-700">Door Types</h4>
      <div className="grid grid-cols-2 gap-2">
        {DOOR_TYPES.map((door) => (
          <button
            key={door.id}
            onClick={() => handleSelectDoor(door.id as DoorType)}
            className={`
              p-3 rounded-lg border text-left transition-all
              ${selectedType === door.id
                ? "border-primary bg-primary/10 ring-1 ring-primary"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }
            `}
          >
            <div className="flex items-center gap-2">
              {/* Door icon */}
              <div
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{ backgroundColor: COLORS.DOOR_FILL }}
              >
                <DoorIcon type={door.id} />
              </div>
              <div>
                <div className="text-xs font-medium">{door.label}</div>
                <div className="text-[10px] text-gray-500">{door.width}' wide</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 mt-2">
        Click on a wall to place the door
      </div>
    </div>
  )
}

function DoorIcon({ type }: { type: string }) {
  // Simple door icon based on type
  switch (type) {
    case "double":
      return (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="4" width="8" height="16" rx="1" />
          <rect x="14" y="4" width="8" height="16" rx="1" />
        </svg>
      )
    case "sliding":
      return (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="4" width="10" height="16" rx="1" />
          <rect x="12" y="4" width="10" height="16" rx="1" opacity="0.5" />
        </svg>
      )
    case "french":
      return (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="4" width="8" height="16" rx="1" />
          <rect x="14" y="4" width="8" height="16" rx="1" />
          <rect x="4" y="6" width="4" height="5" fill="rgba(255,255,255,0.3)" />
          <rect x="4" y="13" width="4" height="5" fill="rgba(255,255,255,0.3)" />
          <rect x="16" y="6" width="4" height="5" fill="rgba(255,255,255,0.3)" />
          <rect x="16" y="13" width="4" height="5" fill="rgba(255,255,255,0.3)" />
        </svg>
      )
    case "opening":
      return (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="1" strokeDasharray="4 2" />
        </svg>
      )
    default: // single
      return (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <circle cx="16" cy="12" r="1.5" fill="rgba(255,255,255,0.5)" />
        </svg>
      )
  }
}
