"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useWizard } from "@/lib/context/wizard-context"
import { useFinishes } from "@/lib/api/hooks"
import * as apiV2 from "@/lib/api/client-v2"
import type { Blueprint } from "@/lib/api/client-v2"
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertCircle,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { FloorPlan3DViewer } from "@/components/floor-plan-3d"

export default function VisualizePage() {
  const router = useRouter()
  const { blueprintId, projectName } = useWizard()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load finishes for materials
  const { finishes, loading: finishesLoading, loadFinishes } = useFinishes(blueprintId ?? undefined)

  // Load blueprint from v2 API
  const loadBlueprint = useCallback(async () => {
    if (!blueprintId) {
      setLoading(false)
      setError("No blueprint ID available. Please save your floor plan first.")
      return
    }

    try {
      setLoading(true)
      const response = await apiV2.getBlueprint(blueprintId)
      setBlueprint(response.data)
      setError(null)
    } catch (err) {
      console.error("Error loading blueprint:", err)
      setError(err instanceof Error ? err.message : "Failed to load blueprint")
    } finally {
      setLoading(false)
    }
  }, [blueprintId])

  // Load blueprint and finishes when available
  useEffect(() => {
    loadBlueprint()
    if (blueprintId) {
      loadFinishes(blueprintId)
    }
  }, [blueprintId, loadBlueprint, loadFinishes])

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // Show loading state
  if (loading || finishesLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <Card className="p-12 flex flex-col items-center justify-center min-h-[500px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading visualization data...</p>
          </Card>
        </div>
      </div>
    )
  }

  // Show error state
  if (error || !blueprint) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-semibold text-foreground">
              {error || "No Floor Plan Found"}
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Please create and save a floor plan first before visualizing.
            </p>
            <Button onClick={() => router.push("/create/floorplan")} className="mt-4">
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
              {projectName ? `${projectName} - ` : ""}
              Explore your ADU design in 3D
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            <Maximize2 className="h-4 w-4 mr-2" />
            Fullscreen
          </Button>
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
              <li>{blueprint.doors.length} doors</li>
              <li>{blueprint.windows.length} windows</li>
              <li>{blueprint.furniture.length} furniture items</li>
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Camera Controls</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong>Top-Down:</strong> Scroll to zoom, drag to pan</li>
              <li><strong>First-Person:</strong> WASD to move, mouse to look</li>
              <li>Click canvas to enter walkthrough mode</li>
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Finishes Applied</h3>
            {finishes?.roomFinishes && finishes.roomFinishes.length > 0 ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {finishes.roomFinishes.slice(0, 3).map((rf) => (
                  <li key={rf.roomId}>
                    {rf.roomName}: {rf.vibe.replace("_", " ")}
                  </li>
                ))}
                {finishes.roomFinishes.length > 3 && (
                  <li>+{finishes.roomFinishes.length - 3} more...</li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No finishes selected yet.{" "}
                <button
                  onClick={() => router.push("/create/finishes")}
                  className="text-primary hover:underline"
                >
                  Add finishes
                </button>
              </p>
            )}
          </Card>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => router.push("/create/finishes")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Finishes
          </Button>
          <Button className="gap-2" disabled>
            <Download className="h-4 w-4" />
            Export Design
          </Button>
        </div>
      </div>
    </div>
  )
}
