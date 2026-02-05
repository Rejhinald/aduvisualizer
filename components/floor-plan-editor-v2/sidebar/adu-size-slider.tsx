"use client"

import { useCallback } from "react"
import type { AduBoundary, EditorAction } from "../types"
import { Slider } from "@/components/ui/slider"
import { ADU_SIZE_MIN, ADU_SIZE_MAX, calculatePolygonArea } from "../constants"
import { RotateCcw, Eye, EyeOff, Pencil, Lock } from "lucide-react"

interface AduSizeSliderProps {
  boundary: AduBoundary
  showBoundary: boolean
  editMode: boolean
  onEditModeChange: (editMode: boolean) => void
  dispatch: React.Dispatch<EditorAction>
}

export function AduSizeSlider({ boundary, showBoundary, editMode, onEditModeChange, dispatch }: AduSizeSliderProps) {
  const actualArea = calculatePolygonArea(boundary.corners)

  const handleSizeChange = useCallback(
    (values: number[]) => {
      dispatch({ type: "SET_ADU_BOUNDARY_SIZE", targetArea: values[0] })
    },
    [dispatch]
  )

  const handleToggleVisibility = useCallback(() => {
    dispatch({ type: "TOGGLE_ADU_BOUNDARY" })
  }, [dispatch])

  const handleReset = useCallback(() => {
    dispatch({ type: "RESET_ADU_BOUNDARY" })
  }, [dispatch])

  const handleToggleEditMode = useCallback(() => {
    onEditModeChange(!editMode)
  }, [editMode, onEditModeChange])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-gray-700">ADU Size</h4>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleEditMode}
            className={`p-1.5 rounded ${
              editMode
                ? "bg-primary/10 text-primary"
                : "hover:bg-slate-100 text-slate-500"
            }`}
            title={editMode ? "Lock shape (disable editing)" : "Edit shape (drag corners)"}
          >
            {editMode ? (
              <Pencil className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700"
            title="Reset to square"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleToggleVisibility}
            className={`p-1.5 rounded ${
              showBoundary
                ? "bg-primary/10 text-primary"
                : "hover:bg-slate-100 text-slate-500"
            }`}
            title={showBoundary ? "Hide boundary" : "Show boundary"}
          >
            {showBoundary ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Size display */}
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold text-primary">
          {Math.round(actualArea)}
        </span>
        <span className="text-sm text-slate-500">sq ft</span>
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <Slider
          value={[boundary.targetArea]}
          min={ADU_SIZE_MIN}
          max={ADU_SIZE_MAX}
          step={25}
          onValueChange={handleSizeChange}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>{ADU_SIZE_MIN} sq ft</span>
          <span>{ADU_SIZE_MAX} sq ft</span>
        </div>
      </div>

      {/* Quick sizes */}
      <div className="flex gap-1 flex-wrap">
        {[300, 400, 500, 600, 800, 1000, 1200].map((size) => (
          <button
            key={size}
            onClick={() => dispatch({ type: "SET_ADU_BOUNDARY_SIZE", targetArea: size })}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              Math.abs(boundary.targetArea - size) < 25
                ? "bg-primary text-white border-primary"
                : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"
            }`}
          >
            {size}
          </button>
        ))}
      </div>

      {/* Info */}
      <p className="text-xs text-slate-400">
        {editMode ? (
          <>Drag corners to reshape. Click <span className="font-medium text-green-600">+</span> on edges to add corners. Double-click corners to remove.</>
        ) : (
          <>Draw your floor plan within the ADU boundary. Click the pencil icon to edit shape.</>
        )}
      </p>
    </div>
  )
}
