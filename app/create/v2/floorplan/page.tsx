"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight, Home, Eye, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FloorPlanEditorV2 } from "@/components/floor-plan-editor-v2"

// Generate a proper UUID v4
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function FloorPlanV2Content() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get project ID from URL or generate a new one
  const [projectId, setProjectId] = useState<string | null>(null)
  const [blueprintId, setBlueprintId] = useState<string | null>(null)

  useEffect(() => {
    const pid = searchParams.get("projectId")
    if (pid) {
      setProjectId(pid)
    } else {
      // Generate a proper UUID for the project
      const newId = generateUUID()
      setProjectId(newId)
      // Update URL
      window.history.replaceState({}, "", `/create/v2/floorplan?projectId=${newId}`)
    }
  }, [searchParams])

  const handleSave = (blueprint: { id: string; version: number }) => {
    setBlueprintId(blueprint.id)
    console.log("Blueprint saved:", blueprint)
  }

  const handleVisualize = () => {
    if (blueprintId) {
      router.push(`/create/v2/visualize?blueprintId=${blueprintId}`)
    }
  }

  if (!projectId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900 z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col z-50 bg-slate-900">
      {/* Compact Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-slate-900 text-white border-b border-slate-700"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-primary/20 text-primary-foreground text-xs font-medium">
            <Home className="h-3.5 w-3.5" />
            <span>Floor Plan Editor v2</span>
          </div>
          <span className="text-slate-400 text-sm hidden sm:inline">
            Draw walls, add doors, windows, and furniture
          </span>
        </div>

        {/* View 3D Button */}
        {blueprintId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Button
              onClick={handleVisualize}
              size="sm"
              className="gap-1.5 bg-primary hover:bg-primary/90"
            >
              <Eye className="h-3.5 w-3.5" />
              View in 3D
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Editor - takes remaining space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <FloorPlanEditorV2
          projectId={projectId}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}

export default function FloorPlanV2Page() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900 z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <FloorPlanV2Content />
    </Suspense>
  )
}
