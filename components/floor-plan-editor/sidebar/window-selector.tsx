"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RectangleHorizontal, Columns2, Square } from "lucide-react";
import { WINDOW_CONFIGS } from "@/lib/constants";
import type { WindowType } from "@/lib/types";

interface WindowSelectorProps {
  onDragStart: (e: React.DragEvent, type: "window", subType: WindowType) => void;
  onDragEnd: () => void;
}

export function WindowSelector({ onDragStart, onDragEnd }: WindowSelectorProps) {
  const windowTypes = Object.keys(WINDOW_CONFIGS) as WindowType[];

  const getIcon = (type: WindowType) => {
    switch (type) {
      case "standard":
        return RectangleHorizontal;
      case "sliding":
        return Columns2;
      case "bay":
      case "picture":
        return Square;
      default:
        return RectangleHorizontal;
    }
  };

  return (
    <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg">
      <Label className="text-sm font-semibold text-foreground">Drag a window to canvas:</Label>
      <div className="flex flex-col gap-2">
        {windowTypes.map((type) => {
          const config = WINDOW_CONFIGS[type];
          const Icon = getIcon(type);
          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, "window", type)}
              onDragEnd={onDragEnd}
              className="flex items-center gap-2 p-2 bg-secondary rounded-lg border border-border cursor-grab hover:bg-secondary/80 hover:border-primary/30 transition-colors active:cursor-grabbing"
            >
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{config.label}</p>
                <p className="text-[10px] text-muted-foreground">{config.width} ft wide × {config.height} ft tall</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs text-blue-800 leading-relaxed">
          Drag and drop windows onto walls. Press <kbd className="px-1 py-0.5 bg-blue-100 rounded text-[10px]">R</kbd> to rotate selected window.
        </p>
      </div>
    </Card>
  );
}
