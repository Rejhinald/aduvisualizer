"use client"

import type { EditorAction, WindowType } from "../types"
import { WINDOW_TYPES, COLORS } from "../constants"

interface WindowPaletteProps {
  dispatch: React.Dispatch<EditorAction>
  selectedType: WindowType | null
}

export function WindowPalette({ dispatch, selectedType }: WindowPaletteProps) {
  const handleSelectWindow = (type: WindowType) => {
    dispatch({ type: "SET_MODE", mode: "window" })
    dispatch({ type: "SET_PLACEMENT_TYPE", placementType: type })
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-gray-700">Window Types</h4>
      <div className="grid grid-cols-2 gap-2">
        {WINDOW_TYPES.map((window) => (
          <button
            key={window.id}
            onClick={() => handleSelectWindow(window.id as WindowType)}
            className={`
              p-3 rounded-lg border text-left transition-all
              ${selectedType === window.id
                ? "border-primary bg-primary/10 ring-1 ring-primary"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }
            `}
          >
            <div className="flex items-center gap-2">
              {/* Window icon */}
              <div
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{ backgroundColor: COLORS.WINDOW_FILL }}
              >
                <WindowIcon type={window.id} />
              </div>
              <div>
                <div className="text-xs font-medium">{window.label}</div>
                <div className="text-[10px] text-gray-500">
                  {window.width}' × {window.height}'
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 mt-2">
        Click on a wall to place the window
      </div>
    </div>
  )
}

function WindowIcon({ type }: { type: string }) {
  switch (type) {
    case "bay":
      return (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 6h6v12H2z" />
          <path d="M9 4h6v16H9z" />
          <path d="M16 6h6v12h-6z" />
        </svg>
      )
    case "picture":
      return (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="4" width="20" height="16" rx="1" />
        </svg>
      )
    case "sliding":
      return (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="4" width="9" height="16" rx="1" />
          <rect x="13" y="4" width="9" height="16" rx="1" opacity="0.6" />
          <path d="M11 10h2v4h-2z" fill="rgba(0,0,0,0.3)" />
        </svg>
      )
    default: // standard
      return (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <line x1="12" y1="4" x2="12" y2="20" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
          <line x1="3" y1="12" x2="21" y2="12" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
        </svg>
      )
  }
}
