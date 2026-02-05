"use client"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ZoomIn, ZoomOut, Maximize2, Grid3x3, Save, Loader2, Lock, Unlock, Undo2, Redo2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface CanvasControlsProps {
  zoom: number
  showGrid: boolean
  cameraLocked: boolean
  isDirty: boolean
  saving: boolean
  canUndo: boolean
  canRedo: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onToggleGrid: () => void
  onToggleCameraLock: () => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
}

export function CanvasControls({
  zoom,
  showGrid,
  cameraLocked,
  isDirty,
  saving,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleGrid,
  onToggleCameraLock,
  onUndo,
  onRedo,
  onSave,
}: CanvasControlsProps) {
  return (
    <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-slate-200">
      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomOut}
          className="h-8 w-8 p-0"
          title="Zoom out (-)"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium w-12 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          className="h-8 w-8 p-0"
          title="Zoom in (+)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetView}
          className="h-8 w-8 p-0"
          title="Reset view (0)"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          className="h-8 w-8 p-0"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          className="h-8 w-8 p-0"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Camera lock toggle */}
      <Button
        variant={cameraLocked ? "default" : "ghost"}
        size="sm"
        onClick={onToggleCameraLock}
        className={cn("h-8 w-8 p-0", cameraLocked && "bg-amber-500 hover:bg-amber-600")}
        title={cameraLocked ? "Unlock camera (L)" : "Lock camera (L)"}
      >
        {cameraLocked ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Unlock className="h-4 w-4" />
        )}
      </Button>

      <div className="w-px h-6 bg-gray-200" />

      {/* Grid toggle */}
      <div className="flex items-center gap-2">
        <Grid3x3 className="h-4 w-4 text-gray-500" />
        <Switch
          checked={showGrid}
          onCheckedChange={onToggleGrid}
          className="h-5 w-9"
        />
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Save button */}
      <Button
        variant={isDirty ? "default" : "outline"}
        size="sm"
        onClick={onSave}
        disabled={saving || !isDirty}
        className="h-8 gap-1.5 text-xs"
        title="Save (Ctrl+S)"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {isDirty ? "Save" : "Saved"}
      </Button>
    </div>
  )
}
