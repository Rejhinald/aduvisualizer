"use client"

import { useState, useCallback, useMemo } from "react"
import type Konva from "konva"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  FileText,
  Image,
  FileJson,
  Download,
  Loader2,
  FileCheck,
} from "lucide-react"
import { toast } from "sonner"

import type { ExportFormat, ExportSettings, SheetSize, Scale, BlueprintExportData } from "./types"
import type { EditorState, CanvasConfig } from "../types"
import {
  SHEET_CONFIGS,
  SCALE_OPTIONS,
  DPI_OPTIONS,
  DEFAULT_EXPORT_SETTINGS,
} from "./constants"
import {
  buildExportData,
  captureCanvasImage,
  exportPNG,
  exportJSON,
  sanitizeFilename,
} from "./utils"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stageRef: React.RefObject<Konva.Stage | null>
  state: EditorState
  config: CanvasConfig
  blueprintId?: string | null
  projectName?: string
}

export function ExportDialog({
  open,
  onOpenChange,
  stageRef,
  state,
  config,
  blueprintId,
  projectName = "ADU Floor Plan",
}: ExportDialogProps) {
  const [settings, setSettings] = useState<ExportSettings>({
    ...DEFAULT_EXPORT_SETTINGS,
    projectName,
    address: state.lot?.address || "",
  })
  const [isExporting, setIsExporting] = useState(false)

  // Build export data from current state
  const exportData = useMemo<BlueprintExportData>(
    () => buildExportData(state, config),
    [state, config]
  )

  // Update setting helper
  const updateSetting = useCallback(
    <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  // Handle format change
  const handleFormatChange = useCallback((format: ExportFormat) => {
    setSettings((prev) => ({ ...prev, format }))
  }, [])

  // Handle PNG export
  const handlePngExport = useCallback(() => {
    setIsExporting(true)
    try {
      exportPNG(stageRef, settings)
      toast.success("PNG exported successfully!")
      onOpenChange(false)
    } catch (error) {
      console.error("PNG export error:", error)
      toast.error("Failed to export PNG")
    } finally {
      setIsExporting(false)
    }
  }, [stageRef, settings, onOpenChange])

  // Handle JSON export
  const handleJsonExport = useCallback(() => {
    setIsExporting(true)
    try {
      exportJSON(exportData, settings)
      toast.success("JSON exported successfully!")
      onOpenChange(false)
    } catch (error) {
      console.error("JSON export error:", error)
      toast.error("Failed to export JSON")
    } finally {
      setIsExporting(false)
    }
  }, [exportData, settings, onOpenChange])

  // Handle PDF export (server-side)
  const handlePdfExport = useCallback(async () => {
    if (!blueprintId) {
      toast.error("Please save your blueprint before exporting to PDF")
      return
    }

    setIsExporting(true)
    try {
      const canvasImage = captureCanvasImage(stageRef, settings.dpi)
      if (!canvasImage) {
        throw new Error("Failed to capture canvas")
      }

      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v2"

      const response = await fetch(`${API_BASE_URL}/exports/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blueprintId,
          canvasImage,
          blueprintData: exportData,
          settings,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || "PDF generation failed")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.download = `${sanitizeFilename(settings.projectName)}_Blueprint.pdf`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)

      toast.success("PDF exported successfully!")
      onOpenChange(false)
    } catch (error) {
      console.error("PDF export error:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to export PDF"
      )
    } finally {
      setIsExporting(false)
    }
  }, [blueprintId, stageRef, settings, exportData, onOpenChange])

  // Handle export based on format
  const handleExport = useCallback(() => {
    switch (settings.format) {
      case "pdf":
        handlePdfExport()
        break
      case "png":
        handlePngExport()
        break
      case "json":
        handleJsonExport()
        break
    }
  }, [settings.format, handlePdfExport, handlePngExport, handleJsonExport])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Blueprint
          </DialogTitle>
          <DialogDescription>
            Export your floor plan as a professional architectural drawing
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={settings.format}
          onValueChange={(v) => handleFormatChange(v as ExportFormat)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pdf" className="gap-2">
              <FileText className="h-4 w-4" />
              PDF
            </TabsTrigger>
            <TabsTrigger value="png" className="gap-2">
              <Image className="h-4 w-4" />
              PNG
            </TabsTrigger>
            <TabsTrigger value="json" className="gap-2">
              <FileJson className="h-4 w-4" />
              JSON
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 pr-4">
            <TabsContent value="pdf" className="mt-0 space-y-4">
              <PdfSettings
                settings={settings}
                updateSetting={updateSetting}
                exportData={exportData}
                hasLot={!!state.lot}
              />
            </TabsContent>

            <TabsContent value="png" className="mt-0 space-y-4">
              <PngSettings settings={settings} updateSetting={updateSetting} />
            </TabsContent>

            <TabsContent value="json" className="mt-0 space-y-4">
              <JsonInfo exportData={exportData} settings={settings} updateSetting={updateSetting} />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileCheck className="h-4 w-4 mr-2" />
                Export {settings.format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// PDF Settings Section
interface PdfSettingsProps {
  settings: ExportSettings
  updateSetting: <K extends keyof ExportSettings>(
    key: K,
    value: ExportSettings[K]
  ) => void
  exportData: BlueprintExportData
  hasLot: boolean
}

function PdfSettings({
  settings,
  updateSetting,
  exportData,
  hasLot,
}: PdfSettingsProps) {
  return (
    <div className="space-y-4">
      {/* Sheet Size & Scale */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Sheet Size</Label>
          <Select
            value={settings.sheetSize}
            onValueChange={(v) => updateSetting("sheetSize", v as SheetSize)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SHEET_CONFIGS).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex flex-col">
                    <span>{config.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {config.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Scale</Label>
          <Select
            value={settings.scale}
            onValueChange={(v) => updateSetting("scale", v as Scale)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {opt.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Title Block Settings */}
      <div className="space-y-3 border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="includeTitleBlock" className="cursor-pointer font-medium">
            Title Block
          </Label>
          <Switch
            id="includeTitleBlock"
            checked={settings.includeTitleBlock}
            onCheckedChange={(v) => updateSetting("includeTitleBlock", v)}
          />
        </div>

        {settings.includeTitleBlock && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-2">
              <Label className="text-sm">Project Name</Label>
              <Input
                value={settings.projectName}
                onChange={(e) => updateSetting("projectName", e.target.value)}
                placeholder="ADU Floor Plan"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Prepared By</Label>
              <Input
                value={settings.preparedBy}
                onChange={(e) => updateSetting("preparedBy", e.target.value)}
                placeholder="Your name or company"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Address</Label>
              <Input
                value={settings.address}
                onChange={(e) => updateSetting("address", e.target.value)}
                placeholder="Property address"
              />
            </div>
          </div>
        )}
      </div>

      {/* Blueprint Elements */}
      <div className="space-y-3 border rounded-lg p-3">
        <Label className="font-medium">Blueprint Elements</Label>
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="includeDimensions" className="cursor-pointer text-sm">
              Show Dimensions
            </Label>
            <Switch
              id="includeDimensions"
              checked={settings.includeDimensions}
              onCheckedChange={(v) => updateSetting("includeDimensions", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="includeNorthArrow" className="cursor-pointer text-sm">
              North Arrow
            </Label>
            <Switch
              id="includeNorthArrow"
              checked={settings.includeNorthArrow}
              onCheckedChange={(v) => updateSetting("includeNorthArrow", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="includeLegend" className="cursor-pointer text-sm">
              Room Legend
            </Label>
            <Switch
              id="includeLegend"
              checked={settings.includeLegend}
              onCheckedChange={(v) => updateSetting("includeLegend", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="includeSchedules" className="cursor-pointer text-sm">
                Include Schedules
              </Label>
              <p className="text-xs text-muted-foreground">
                Room, door, window & furniture tables
              </p>
            </div>
            <Switch
              id="includeSchedules"
              checked={settings.includeSchedules}
              onCheckedChange={(v) => updateSetting("includeSchedules", v)}
            />
          </div>
        </div>
      </div>

      {/* Lot Overlay */}
      {hasLot && (
        <div className="space-y-3 border rounded-lg p-3">
          <Label className="font-medium">Lot Overlay</Label>
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="includeLotOverlay" className="cursor-pointer text-sm">
                  Lot Boundary Page
                </Label>
                <p className="text-xs text-muted-foreground">
                  Shows ADU position on lot
                </p>
              </div>
              <Switch
                id="includeLotOverlay"
                checked={settings.includeLotOverlay}
                onCheckedChange={(v) => updateSetting("includeLotOverlay", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="includeSatellite" className="cursor-pointer text-sm">
                  Satellite View Page
                </Label>
                <p className="text-xs text-muted-foreground">
                  Aerial view with floor plan overlay
                </p>
              </div>
              <Switch
                id="includeSatellite"
                checked={settings.includeSatellite}
                onCheckedChange={(v) => updateSetting("includeSatellite", v)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-muted/50 border rounded-lg p-3 text-sm">
        <p className="font-medium mb-2">Export Summary</p>
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          <div>Sheet: {SHEET_CONFIGS[settings.sheetSize].label}</div>
          <div>Scale: {SCALE_OPTIONS.find((o) => o.value === settings.scale)?.label}</div>
          <div>Rooms: {exportData.rooms.length}</div>
          <div>Total Area: {exportData.totalArea.toFixed(0)} SF</div>
          <div>Doors: {exportData.doors.length}</div>
          <div>Windows: {exportData.windows.length}</div>
        </div>
      </div>
    </div>
  )
}

// PNG Settings Section
interface PngSettingsProps {
  settings: ExportSettings
  updateSetting: <K extends keyof ExportSettings>(
    key: K,
    value: ExportSettings[K]
  ) => void
}

function PngSettings({ settings, updateSetting }: PngSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Resolution (DPI)</Label>
        <Select
          value={String(settings.dpi)}
          onValueChange={(v) => updateSetting("dpi", Number(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DPI_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                <div className="flex flex-col">
                  <span>{opt.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {opt.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>File Name</Label>
        <Input
          value={settings.projectName}
          onChange={(e) => updateSetting("projectName", e.target.value)}
          placeholder="ADU Floor Plan"
        />
        <p className="text-xs text-muted-foreground">
          File will be saved as: {sanitizeFilename(settings.projectName)}_FloorPlan.png
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-3 text-sm">
        <p className="font-medium mb-1">PNG Export</p>
        <p className="text-muted-foreground">
          Exports a high-resolution image of your floor plan canvas. Ideal for
          sharing previews or embedding in presentations.
        </p>
      </div>
    </div>
  )
}

// JSON Info Section
interface JsonInfoProps {
  exportData: BlueprintExportData
  settings: ExportSettings
  updateSetting: <K extends keyof ExportSettings>(
    key: K,
    value: ExportSettings[K]
  ) => void
}

function JsonInfo({ exportData, settings, updateSetting }: JsonInfoProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>File Name</Label>
        <Input
          value={settings.projectName}
          onChange={(e) => updateSetting("projectName", e.target.value)}
          placeholder="ADU Floor Plan"
        />
        <p className="text-xs text-muted-foreground">
          File will be saved as: {sanitizeFilename(settings.projectName)}_Data.json
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-3 text-sm space-y-2">
        <p className="font-medium">Data Summary</p>
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          <div>Rooms: {exportData.rooms.length}</div>
          <div>Doors: {exportData.doors.length}</div>
          <div>Windows: {exportData.windows.length}</div>
          <div>Furniture: {exportData.furniture.length}</div>
          <div>Total Area: {exportData.totalArea.toFixed(0)} SF</div>
        </div>
      </div>

      <div className="bg-muted/50 border rounded-lg p-3 text-sm">
        <p className="font-medium mb-1">JSON Export</p>
        <p className="text-muted-foreground">
          Exports all floor plan data in a structured JSON format. Useful for
          data backup, integration with other tools, or custom processing.
        </p>
      </div>
    </div>
  )
}
