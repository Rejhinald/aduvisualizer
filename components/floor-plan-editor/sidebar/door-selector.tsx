"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DoorOpen, Columns2, ArrowLeftRight } from "lucide-react";
import { DOOR_CONFIGS } from "@/lib/constants";
import type { DoorType } from "@/lib/types";

interface DoorSelectorProps {
  onDragStart: (e: React.DragEvent, type: "door", subType: DoorType) => void;
  onDragEnd: () => void;
}

export function DoorSelector({ onDragStart, onDragEnd }: DoorSelectorProps) {
  const doorTypes = Object.keys(DOOR_CONFIGS) as DoorType[];

  const getIcon = (type: DoorType) => {
    switch (type) {
      case "single":
      case "double":
      case "french":
        return DoorOpen;
      case "sliding":
        return Columns2;
      case "opening":
        return ArrowLeftRight;
      default:
        return DoorOpen;
    }
  };

  return (
    <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg">
      <Label className="text-sm font-semibold text-foreground">Drag a door to canvas:</Label>
      <div className="flex flex-col gap-2">
        {doorTypes.map((type) => {
          const config = DOOR_CONFIGS[type];
          const Icon = getIcon(type);
          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, "door", type)}
              onDragEnd={onDragEnd}
              className="flex items-center gap-2 p-2 bg-secondary rounded-lg border border-border cursor-grab hover:bg-secondary/80 hover:border-primary/30 transition-colors active:cursor-grabbing"
            >
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{config.label}</p>
                <p className="text-[10px] text-muted-foreground">{config.width} ft wide</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-xs text-amber-800 leading-relaxed">
          Drag and drop doors onto walls. Press <kbd className="px-1 py-0.5 bg-amber-100 rounded text-[10px]">R</kbd> to rotate selected door.
        </p>
      </div>
    </Card>
  );
}
