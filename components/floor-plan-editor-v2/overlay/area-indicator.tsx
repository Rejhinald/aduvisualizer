"use client"

import { Home, LayoutGrid, DoorOpen, Square, Minus, MousePointer2 } from "lucide-react"

interface AreaIndicatorProps {
  totalArea: number
  roomCount: number
  wallCount: number
  doorCount: number
  windowCount: number
  selectedCount?: number
  className?: string
}

export function AreaIndicator({
  totalArea,
  roomCount,
  wallCount,
  doorCount,
  windowCount,
  selectedCount = 0,
  className = "",
}: AreaIndicatorProps) {
  return (
    <div className={`bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-slate-200 ${className}`}>
      <div className="flex items-center gap-4 text-sm">
        {/* Selection count (when multiple selected) */}
        {selectedCount > 1 && (
          <>
            <div className="flex items-center gap-1" title="Selected items (Del to delete, R to rotate, Arrows to move)">
              <MousePointer2 className="h-3.5 w-3.5 text-red-500" />
              <span className="text-red-600 font-semibold">{selectedCount} selected</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
          </>
        )}

        {/* Total Area */}
        <div className="flex items-center gap-1.5">
          <Home className="h-4 w-4 text-primary" />
          <span className="font-semibold text-slate-800">
            {totalArea.toFixed(0)} <span className="text-slate-500 font-normal">sq ft</span>
          </span>
        </div>

        <div className="w-px h-4 bg-slate-200" />

        {/* Room count */}
        {roomCount > 0 && (
          <div className="flex items-center gap-1" title="Rooms">
            <LayoutGrid className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-600">{roomCount}</span>
          </div>
        )}

        {/* Wall count */}
        <div className="flex items-center gap-1" title="Walls">
          <Minus className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-600">{wallCount}</span>
        </div>

        {/* Door count */}
        <div className="flex items-center gap-1" title="Doors">
          <DoorOpen className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-600">{doorCount}</span>
        </div>

        {/* Window count */}
        <div className="flex items-center gap-1" title="Windows">
          <Square className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-600">{windowCount}</span>
        </div>
      </div>
    </div>
  )
}
