"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FURNITURE_CONFIG, FURNITURE_CATEGORIES, FURNITURE_TYPES } from "../constants";
import type { FurnitureType } from "../types";

const SNAP_MODE_TOOLTIPS = {
  grid: "Snap furniture to full grid squares (1 foot increments). Best for precise alignment.",
  half: "Snap furniture to half-grid positions (6 inch increments). Good balance of precision and flexibility.",
  free: "No snapping - place furniture anywhere. Most flexible but harder to align.",
};

interface FurnitureSelectorProps {
  snapMode: "grid" | "half" | "free";
  onSnapModeChange: (mode: "grid" | "half" | "free") => void;
  onDragStart: (e: React.DragEvent, type: "furniture", subType: FurnitureType) => void;
  onDragEnd: () => void;
}

export function FurnitureSelector({
  snapMode,
  onSnapModeChange,
  onDragStart,
  onDragEnd,
}: FurnitureSelectorProps) {
  // Group furniture by category
  const furnitureByCategory = FURNITURE_CATEGORIES.map(category => ({
    ...category,
    items: FURNITURE_TYPES.filter(type => FURNITURE_CONFIG[type].category === category.id),
  }));

  return (
    <TooltipProvider>
      <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg max-h-[500px] overflow-y-auto">
        <Label className="text-sm font-semibold text-foreground">Drag furniture to canvas:</Label>

        {/* Snap mode selector */}
        <div className="flex gap-1 p-1 bg-secondary rounded-lg">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={snapMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => onSnapModeChange("grid")}
                className="flex-1 text-[10px] h-7"
              >
                Grid
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              {SNAP_MODE_TOOLTIPS.grid}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={snapMode === "half" ? "default" : "ghost"}
                size="sm"
                onClick={() => onSnapModeChange("half")}
                className="flex-1 text-[10px] h-7"
              >
                Half
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              {SNAP_MODE_TOOLTIPS.half}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={snapMode === "free" ? "default" : "ghost"}
                size="sm"
                onClick={() => onSnapModeChange("free")}
                className="flex-1 text-[10px] h-7"
              >
                Free
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              {SNAP_MODE_TOOLTIPS.free}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Furniture categories */}
        {furnitureByCategory.map((category) => (
          <div key={category.id} className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span>{category.icon}</span>
              <span>{category.label}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {category.items.map((type) => {
                const config = FURNITURE_CONFIG[type];
                const Icon = config.icon;
                return (
                  <Tooltip key={type}>
                    <TooltipTrigger asChild>
                      <div
                        draggable
                        onDragStart={(e) => onDragStart(e, "furniture", type)}
                        onDragEnd={onDragEnd}
                        className={cn(
                          "flex flex-col items-center gap-1 p-2 bg-secondary rounded-lg border border-border",
                          "cursor-grab hover:bg-secondary/80 hover:border-primary/30 transition-colors",
                          "active:cursor-grabbing"
                        )}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[10px] text-center leading-tight">{config.name}</span>
                        <span className="text-[9px] text-muted-foreground">
                          {config.width}×{config.height} ft
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      <div className="max-w-[180px]">
                        <p className="font-medium">{config.name}</p>
                        <p className="text-muted-foreground">Size: {config.width} × {config.height} ft</p>
                        <p className="text-muted-foreground mt-1">Drag to place on canvas</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}

        <div className="p-2.5 bg-green-50 rounded-lg border border-green-200">
          <p className="text-xs text-green-800 leading-relaxed">
            Drag furniture to place. Press <kbd className="px-1 py-0.5 bg-green-100 rounded text-[10px]">R</kbd> to rotate, <kbd className="px-1 py-0.5 bg-green-100 rounded text-[10px]">Delete</kbd> to remove.
          </p>
        </div>
      </Card>
    </TooltipProvider>
  );
}
