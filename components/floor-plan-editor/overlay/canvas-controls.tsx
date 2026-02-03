"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ZoomIn, ZoomOut, Maximize2, Grid3x3, Lock, Unlock, Download } from "lucide-react";

interface CanvasControlsProps {
  zoom: number;
  showGrid: boolean;
  isLocked: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleGrid: (show: boolean) => void;
  onToggleLock: (locked: boolean) => void;
  onExport?: () => void;
}

export function CanvasControls({
  zoom,
  showGrid,
  isLocked,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleGrid,
  onToggleLock,
  onExport,
}: CanvasControlsProps) {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-gray-200">
      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomOut}
          className="h-8 w-8 p-0"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          className="h-8 w-8 p-0"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetView}
          className="h-8 w-8 p-0"
          title="Reset view"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

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

      {/* Lock toggle */}
      <div className="flex items-center gap-2">
        {isLocked ? (
          <Lock className="h-4 w-4 text-gray-500" />
        ) : (
          <Unlock className="h-4 w-4 text-gray-500" />
        )}
        <Switch
          checked={isLocked}
          onCheckedChange={onToggleLock}
          className="h-5 w-9"
        />
      </div>

      {onExport && (
        <>
          <div className="w-px h-6 bg-gray-200" />

          {/* Export button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-8 gap-1.5 text-xs"
            title="Export blueprint"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </>
      )}
    </div>
  );
}
