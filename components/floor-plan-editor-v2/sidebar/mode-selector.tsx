"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { MousePointer2, Pencil, Square, DoorOpen, RectangleHorizontal, Armchair, Trash2, Home, SplitSquareHorizontal } from "lucide-react"
import type { EditorMode, EditorAction } from "../types"

const MODE_CONFIG: Record<EditorMode, { icon: React.ReactNode; label: string; shortcut: string; tooltip: string }> = {
  select: {
    icon: <MousePointer2 className="h-4 w-4" />,
    label: "Select / Move",
    shortcut: "V",
    tooltip: "Select, move, and resize elements on the canvas",
  },
  wall: {
    icon: <Pencil className="h-4 w-4" />,
    label: "Draw Walls",
    shortcut: "W",
    tooltip: "Click to place corners and draw walls between them",
  },
  rectangle: {
    icon: <Square className="h-4 w-4" />,
    label: "Draw Box",
    shortcut: "B",
    tooltip: "Click and drag to draw rectangular walls",
  },
  divider: {
    icon: <SplitSquareHorizontal className="h-4 w-4" />,
    label: "Room Divider",
    shortcut: "I",
    tooltip: "Draw virtual walls to separate open spaces into rooms (no 3D geometry)",
  },
  room: {
    icon: <Home className="h-4 w-4" />,
    label: "Classify Rooms",
    shortcut: "O",
    tooltip: "Click inside detected rooms to select and classify them",
  },
  door: {
    icon: <DoorOpen className="h-4 w-4" />,
    label: "Add Doors",
    shortcut: "D",
    tooltip: "Select a door type and click on a wall to place it",
  },
  window: {
    icon: <RectangleHorizontal className="h-4 w-4" />,
    label: "Add Windows",
    shortcut: "N",
    tooltip: "Select a window type and click on a wall to place it",
  },
  furniture: {
    icon: <Armchair className="h-4 w-4" />,
    label: "Add Furniture",
    shortcut: "F",
    tooltip: "Select furniture and click on the canvas to place it",
  },
  delete: {
    icon: <Trash2 className="h-4 w-4" />,
    label: "Delete",
    shortcut: "X",
    tooltip: "Click on elements to delete them",
  },
}

interface ModeSelectorProps {
  mode: EditorMode
  dispatch: React.Dispatch<EditorAction>
  compact?: boolean
}

export function ModeSelector({ mode, dispatch, compact = false }: ModeSelectorProps) {
  const handleModeChange = (newMode: EditorMode) => {
    dispatch({ type: "SET_MODE", mode: newMode })
    dispatch({ type: "CANCEL_DRAWING" })
    dispatch({ type: "SET_PLACEMENT_TYPE", placementType: null })
  }

  const mainModes: EditorMode[] = ["select", "wall", "rectangle", "divider", "room"]
  const elementModes: EditorMode[] = ["door", "window", "furniture"]
  const actionModes: EditorMode[] = ["delete"]
  const allModes = [...mainModes, ...elementModes, ...actionModes]

  // Compact horizontal mode for toolbar
  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-0.5">
          {/* Main modes */}
          {mainModes.map((m) => {
            const config = MODE_CONFIG[m]
            return (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleModeChange(m)}
                    className={`
                      p-2 rounded-md transition-all
                      ${mode === m
                        ? "bg-primary text-white"
                        : "text-slate-300 hover:text-white hover:bg-slate-700"
                      }
                    `}
                  >
                    {config.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  <p className="font-medium">{config.label}</p>
                  <p className="text-xs text-slate-400">{config.shortcut} - {config.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}

          {/* Divider */}
          <div className="w-px h-6 bg-slate-600 mx-1" />

          {/* Element modes */}
          {elementModes.map((m) => {
            const config = MODE_CONFIG[m]
            return (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleModeChange(m)}
                    className={`
                      p-2 rounded-md transition-all
                      ${mode === m
                        ? "bg-primary text-white"
                        : "text-slate-300 hover:text-white hover:bg-slate-700"
                      }
                    `}
                  >
                    {config.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  <p className="font-medium">{config.label}</p>
                  <p className="text-xs text-slate-400">{config.shortcut} - {config.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}

          {/* Divider */}
          <div className="w-px h-6 bg-slate-600 mx-1" />

          {/* Action modes */}
          {actionModes.map((m) => {
            const config = MODE_CONFIG[m]
            return (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleModeChange(m)}
                    className={`
                      p-2 rounded-md transition-all
                      ${mode === m
                        ? "bg-red-500 text-white"
                        : "text-slate-300 hover:text-red-400 hover:bg-slate-700"
                      }
                    `}
                  >
                    {config.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  <p className="font-medium">{config.label}</p>
                  <p className="text-xs text-slate-400">{config.shortcut} - {config.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    )
  }

  // Standard vertical mode for sidebar
  return (
    <TooltipProvider>
      <Card className="p-3 space-y-3 shadow-md border-l-4 border-l-primary">
        <Label className="text-sm font-semibold text-foreground">Mode</Label>

        {/* Main editing modes */}
        <div className="flex flex-col gap-1.5">
          {mainModes.map((m) => {
            const config = MODE_CONFIG[m]
            return (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <Button
                    variant={mode === m ? "default" : "outline"}
                    onClick={() => handleModeChange(m)}
                    className="text-xs w-full justify-start h-9 px-2.5 transition-all hover:scale-[1.01]"
                  >
                    <span className="mr-2 flex-shrink-0">{config.icon}</span>
                    <span className="truncate">{config.label}</span>
                    <span className="ml-auto text-[10px] opacity-60 flex-shrink-0">{config.shortcut}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="max-w-[200px]">{config.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Element placement modes */}
        <div className="flex flex-col gap-1.5">
          {elementModes.map((m) => {
            const config = MODE_CONFIG[m]
            return (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <Button
                    variant={mode === m ? "default" : "outline"}
                    onClick={() => handleModeChange(m)}
                    className="text-xs w-full justify-start h-9 px-2.5 transition-all hover:scale-[1.01]"
                  >
                    <span className="mr-2 flex-shrink-0">{config.icon}</span>
                    <span className="truncate">{config.label}</span>
                    <span className="ml-auto text-[10px] opacity-60 flex-shrink-0">{config.shortcut}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="max-w-[200px]">{config.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Action modes */}
        <div className="flex flex-col gap-1.5">
          {actionModes.map((m) => {
            const config = MODE_CONFIG[m]
            return (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <Button
                    variant={mode === m ? "destructive" : "outline"}
                    onClick={() => handleModeChange(m)}
                    className="text-xs w-full justify-start h-9 px-2.5 transition-all hover:scale-[1.01]"
                  >
                    <span className="mr-2 flex-shrink-0">{config.icon}</span>
                    <span className="truncate">{config.label}</span>
                    <span className="ml-auto text-[10px] opacity-60 flex-shrink-0">{config.shortcut}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="max-w-[200px]">{config.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </Card>
    </TooltipProvider>
  )
}
