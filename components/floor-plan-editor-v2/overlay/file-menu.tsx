"use client"

import { useState, useCallback } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ChevronDown,
  File,
  FilePlus,
  Save,
  Clock,
  History,
  Download,
  Trash2,
  RotateCcw,
  AlertCircle,
} from "lucide-react"
import type { AutoSaveData, ManualSaveListItem } from "../hooks"
import { cn } from "@/lib/utils"

interface FileMenuProps {
  projectId: string
  isDirty: boolean
  saving: boolean
  // Auto-save props
  autoSaves: AutoSaveData[]
  lastAutoSave: Date | null
  onRestoreAutoSave: (save: AutoSaveData) => void
  onClearAutoSaves: () => void
  // Manual save props
  manualSaves: ManualSaveListItem[]
  manualSaveLoading: boolean
  onCreateManualSave: (label?: string) => Promise<void>
  onRestoreManualSave: (snapshotId: string) => Promise<void>
  onDeleteManualSave: (snapshotId: string) => Promise<void>
  // Actions
  onSave: () => void
  onNewBlueprint: () => void
  onExport: () => void
}

function formatTimeAgo(date: Date | string | number): string {
  const now = new Date()
  const then = typeof date === "number" ? new Date(date) : typeof date === "string" ? new Date(date) : date
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return then.toLocaleDateString()
}

function formatTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function FileMenu({
  projectId,
  isDirty,
  saving,
  autoSaves,
  lastAutoSave,
  onRestoreAutoSave,
  onClearAutoSaves,
  manualSaves,
  manualSaveLoading,
  onCreateManualSave,
  onRestoreManualSave,
  onDeleteManualSave,
  onSave,
  onNewBlueprint,
  onExport,
}: FileMenuProps) {
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false)
  const [saveAsLabel, setSaveAsLabel] = useState("")
  const [confirmNewDialogOpen, setConfirmNewDialogOpen] = useState(false)
  const [restoreConfirmDialog, setRestoreConfirmDialog] = useState<{
    type: "auto" | "manual"
    data: AutoSaveData | ManualSaveListItem
  } | null>(null)

  const handleSaveAs = useCallback(async () => {
    await onCreateManualSave(saveAsLabel || undefined)
    setSaveAsDialogOpen(false)
    setSaveAsLabel("")
  }, [saveAsLabel, onCreateManualSave])

  const handleNewBlueprint = useCallback(() => {
    if (isDirty) {
      setConfirmNewDialogOpen(true)
    } else {
      onNewBlueprint()
    }
  }, [isDirty, onNewBlueprint])

  const handleConfirmNew = useCallback(() => {
    setConfirmNewDialogOpen(false)
    onNewBlueprint()
  }, [onNewBlueprint])

  const handleRestoreConfirm = useCallback(async () => {
    if (!restoreConfirmDialog) return

    if (restoreConfirmDialog.type === "auto") {
      onRestoreAutoSave(restoreConfirmDialog.data as AutoSaveData)
    } else {
      await onRestoreManualSave((restoreConfirmDialog.data as ManualSaveListItem).id)
    }
    setRestoreConfirmDialog(null)
  }, [restoreConfirmDialog, onRestoreAutoSave, onRestoreManualSave])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <File className="h-4 w-4" />
            File
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          {/* New Blueprint */}
          <DropdownMenuItem onClick={handleNewBlueprint}>
            <FilePlus className="h-4 w-4 mr-2" />
            New Blueprint
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Save */}
          <DropdownMenuItem onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Save
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+S</span>
          </DropdownMenuItem>

          {/* Save As (Manual Save with Label) */}
          <DropdownMenuItem onClick={() => setSaveAsDialogOpen(true)} disabled={manualSaveLoading}>
            <Save className="h-4 w-4 mr-2" />
            Save As...
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Auto-saves Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Clock className="h-4 w-4 mr-2" />
              Auto-saves
              {autoSaves.length > 0 && (
                <span className="ml-auto text-xs bg-slate-200 px-1.5 rounded">
                  {autoSaves.length}
                </span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              {autoSaves.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No auto-saves yet
                  <div className="text-xs mt-1">
                    Auto-saves occur 10 min after edits
                  </div>
                </div>
              ) : (
                <>
                  <DropdownMenuLabel className="text-xs">
                    Recent Auto-saves (Last Hour)
                  </DropdownMenuLabel>
                  {autoSaves.map((save, index) => (
                    <DropdownMenuItem
                      key={save.slot}
                      onClick={() =>
                        setRestoreConfirmDialog({ type: "auto", data: save })
                      }
                      className="flex-col items-start"
                    >
                      <div className="flex items-center w-full">
                        <RotateCcw className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span className="flex-1">Slot {save.slot + 1}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(save.timestamp)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground ml-5">
                        {save.data.walls.length} walls, {save.data.rooms.length} rooms
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onClearAutoSaves}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Auto-saves
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Manual Saves Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <History className="h-4 w-4 mr-2" />
              Saved Versions
              {manualSaves.length > 0 && (
                <span className="ml-auto text-xs bg-slate-200 px-1.5 rounded">
                  {manualSaves.length}
                </span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-72">
              {manualSaves.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No saved versions yet
                  <div className="text-xs mt-1">
                    Use "Save As..." to create a named save
                  </div>
                </div>
              ) : (
                <>
                  <DropdownMenuLabel className="text-xs">
                    Saved Versions (Max 10)
                  </DropdownMenuLabel>
                  {manualSaves.map((save) => {
                    const label = save.description?.replace("Manual Save: ", "").replace(/\s*\(.*\)$/, "") || "Untitled"
                    return (
                      <DropdownMenuItem
                        key={save.id}
                        className="flex items-start group"
                      >
                        <button
                          className="flex-1 flex items-start text-left"
                          onClick={() =>
                            setRestoreConfirmDialog({ type: "manual", data: save })
                          }
                        >
                          <RotateCcw className="h-3 w-3 mr-2 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{label}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatTimestamp(save.createdAt)}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteManualSave(save.id)
                          }}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-opacity"
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </button>
                      </DropdownMenuItem>
                    )
                  })}
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {/* Export */}
          <DropdownMenuItem onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save As Dialog */}
      <Dialog open={saveAsDialogOpen} onOpenChange={setSaveAsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Version</DialogTitle>
            <DialogDescription>
              Create a named save point you can restore later. You can keep up to 10 saved versions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="save-label">Version Name (optional)</Label>
              <Input
                id="save-label"
                placeholder="e.g., Before adding bedroom"
                value={saveAsLabel}
                onChange={(e) => setSaveAsLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveAs()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveAsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAs} disabled={manualSaveLoading}>
              {manualSaveLoading ? "Saving..." : "Save Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm New Blueprint Dialog */}
      <Dialog open={confirmNewDialogOpen} onOpenChange={setConfirmNewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription>
              You have unsaved changes. Creating a new blueprint will discard these changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmNewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onSave()
                setConfirmNewDialogOpen(false)
              }}
            >
              Save First
            </Button>
            <Button variant="destructive" onClick={handleConfirmNew}>
              Discard & Create New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Restore Dialog */}
      <Dialog
        open={restoreConfirmDialog !== null}
        onOpenChange={(open) => !open && setRestoreConfirmDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-500" />
              Restore Save
            </DialogTitle>
            <DialogDescription>
              {restoreConfirmDialog?.type === "auto" ? (
                <>
                  Restore from auto-save slot {(restoreConfirmDialog.data as AutoSaveData).slot + 1}?
                  This will replace your current work.
                </>
              ) : (
                <>
                  Restore from "{(restoreConfirmDialog?.data as ManualSaveListItem)?.description?.replace("Manual Save: ", "").replace(/\s*\(.*\)$/, "") || "Untitled"}"?
                  This will replace your current work.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {isDirty && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <span className="text-sm text-orange-700">
                You have unsaved changes that will be lost.
              </span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirmDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleRestoreConfirm}>
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
