"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Maximize2,
  Minimize2,
  Pencil,
} from "lucide-react"
import { FloorPlan3DViewer } from "@/components/floor-plan-3d"
import * as api from "@/lib/api/client-v2"
import type { Blueprint } from "@/lib/api/client-v2"

function VisualizeV2Content() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const blueprintId = searchParams.get("blueprintId")

  const [blueprint, setBlueprint] = useState<Blueprint | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Load blueprint
  useEffect(() => {
    async function loadBlueprint() {
      if (!blueprintId) {
        setError("No blueprint ID provided")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await api.getBlueprint(blueprintId)
        if (response.data) {
          setBlueprint(response.data)
        } else {
          setError("Blueprint not found")
        }
      } catch (err) {
        console.error("Failed to load blueprint:", err)
        setError("Failed to load blueprint")
      } finally {
        setLoading(false)
      }
    }

    loadBlueprint()
  }, [blueprintId])

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleBackToEditor = () => {
    if (blueprint?.projectId) {
      router.push(`/create/v2/floorplan?projectId=${blueprint.projectId}`)
    } else {
      router.push("/create/v2/floorplan")
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <Card className="p-12 flex flex-col items-center justify-center min-h-[500px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading 3D visualization...</p>
          </Card>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !blueprint) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-semibold text-foreground">
              {error || "Blueprint Not Found"}
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Please create a floor plan first before visualizing.
            </p>
            <Button onClick={() => router.push("/create/v2/floorplan")} className="mt-4">
              Create Floor Plan
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <div className="absolute top-4 left-4 z-10">
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            <Minimize2 className="h-4 w-4 mr-2" />
            Exit Fullscreen
          </Button>
        </div>
        <FloorPlan3DViewer blueprint={blueprint} />
      </div>
    )
  }

  // Calculate stats
  const totalArea = blueprint.rooms.reduce((sum, r) => sum + r.area, 0)

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              3D Visualization
            </h1>
            <p className="text-muted-foreground mt-1">
              {blueprint.name || "Floor Plan"} - Explore your ADU design in 3D
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleBackToEditor}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              <Maximize2 className="h-4 w-4 mr-2" />
              Fullscreen
            </Button>
          </div>
        </div>

        {/* 3D Viewer */}
        <Card className="overflow-hidden">
          <div className="h-[600px]">
            <FloorPlan3DViewer blueprint={blueprint} />
          </div>
        </Card>

        {/* Info Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Floor Plan Stats</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>{blueprint.rooms.length} rooms</li>
              <li>{blueprint.walls.length} walls</li>
              <li>{blueprint.doors.length} doors</li>
              <li>{blueprint.windows.length} windows</li>
              <li>{blueprint.furniture.length} furniture items</li>
              {totalArea > 0 && (
                <li className="font-medium text-foreground pt-1 border-t mt-2">
                  Total: {totalArea.toFixed(0)} sq ft
                </li>
              )}
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Camera Controls</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong>Top-Down:</strong> Scroll to zoom, drag to pan</li>
              <li><strong>First-Person:</strong> WASD to move</li>
              <li>Click canvas and move mouse to look around</li>
              <li>Press ESC to release mouse</li>
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Rooms</h3>
            {blueprint.rooms.length > 0 ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {blueprint.rooms.map((room) => (
                  <li key={room.id} className="flex justify-between">
                    <span>{room.name || room.type}</span>
                    <span>{room.area.toFixed(0)} sq ft</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No rooms detected yet. Create enclosed walls to define rooms.
              </p>
            )}
          </Card>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleBackToEditor}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Editor
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function VisualizeV2Page() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <Card className="p-12 flex flex-col items-center justify-center min-h-[500px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading 3D visualization...</p>
          </Card>
        </div>
      </div>
    }>
      <VisualizeV2Content />
    </Suspense>
  )
}
