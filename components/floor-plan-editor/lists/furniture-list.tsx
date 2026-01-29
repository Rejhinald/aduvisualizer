"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { FURNITURE_CONFIG } from "../constants";
import type { Furniture } from "../types";

interface FurnitureListProps {
  furniture: Furniture[];
  selectedFurnitureId: string | null;
  onSelectFurniture: (furnitureId: string) => void;
  onDeleteFurniture: (furnitureId: string, furnitureName: string) => void;
  onRotateFurniture: () => void;
}

export function FurnitureList({
  furniture,
  selectedFurnitureId,
  onSelectFurniture,
  onDeleteFurniture,
  onRotateFurniture,
}: FurnitureListProps) {
  if (furniture.length === 0) {
    return (
      <Card className="p-3 space-y-2 shadow-md">
        <Label className="text-sm font-semibold text-foreground">Furniture</Label>
        <p className="text-xs text-muted-foreground py-2">No furniture yet. Drag items from the selector above.</p>
      </Card>
    );
  }

  return (
    <Card className="p-3 space-y-2 shadow-md transition-shadow hover:shadow-lg">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground">Furniture ({furniture.length})</Label>
        {selectedFurnitureId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRotateFurniture}
            className="h-7 w-7 p-0"
            title="Rotate 90°"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {furniture.map((item, index) => {
          const config = FURNITURE_CONFIG[item.type];
          const Icon = config.icon;
          const isSelected = selectedFurnitureId === item.id;

          return (
            <div
              key={item.id}
              onClick={() => onSelectFurniture(item.id)}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                isSelected
                  ? "bg-primary/10 border-primary/30"
                  : "bg-secondary/50 border-border hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{config.name}</p>
                <span className="text-[10px] text-muted-foreground">
                  {item.width} × {item.height} ft, {item.rotation}°
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFurniture(item.id, config.name);
                }}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
