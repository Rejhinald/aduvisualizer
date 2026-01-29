"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FURNITURE_CONFIG, FURNITURE_CATEGORIES, FURNITURE_TYPES } from "../constants";
import type { FurnitureType } from "../types";

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
    <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg max-h-[500px] overflow-y-auto">
      <Label className="text-sm font-semibold text-foreground">Drag furniture to canvas:</Label>

      {/* Snap mode selector */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg">
        <Button
          variant={snapMode === "grid" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSnapModeChange("grid")}
          className="flex-1 text-[10px] h-7"
        >
          Grid
        </Button>
        <Button
          variant={snapMode === "half" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSnapModeChange("half")}
          className="flex-1 text-[10px] h-7"
        >
          Half
        </Button>
        <Button
          variant={snapMode === "free" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSnapModeChange("free")}
          className="flex-1 text-[10px] h-7"
        >
          Free
        </Button>
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
                <div
                  key={type}
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
  );
}
