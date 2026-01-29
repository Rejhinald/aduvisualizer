"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, RotateCw, RectangleHorizontal, Columns2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { WINDOW_CONFIGS } from "@/lib/constants";
import type { Window, WindowType } from "@/lib/types";

interface WindowListProps {
  windows: Window[];
  selectedWindowId: string | null;
  onSelectWindow: (windowId: string) => void;
  onDeleteWindow: (windowId: string, windowName: string) => void;
  onRotateWindow: () => void;
}

export function WindowList({
  windows,
  selectedWindowId,
  onSelectWindow,
  onDeleteWindow,
  onRotateWindow,
}: WindowListProps) {
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

  if (windows.length === 0) {
    return (
      <Card className="p-3 space-y-2 shadow-md">
        <Label className="text-sm font-semibold text-foreground">Windows</Label>
        <p className="text-xs text-muted-foreground py-2">No windows yet. Drag windows from the selector above.</p>
      </Card>
    );
  }

  return (
    <Card className="p-3 space-y-2 shadow-md transition-shadow hover:shadow-lg">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground">Windows ({windows.length})</Label>
        {selectedWindowId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRotateWindow}
            className="h-7 w-7 p-0"
            title="Rotate 90°"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
        {windows.map((window, index) => {
          const config = WINDOW_CONFIGS[window.type];
          const Icon = getIcon(window.type);
          const isSelected = selectedWindowId === window.id;

          return (
            <div
              key={window.id}
              onClick={() => onSelectWindow(window.id)}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                isSelected
                  ? "bg-primary/10 border-primary/30"
                  : "bg-secondary/50 border-border hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{config.label} #{index + 1}</p>
                <span className="text-[10px] text-muted-foreground">
                  {window.width} × {window.height} ft, {window.rotation}°
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteWindow(window.id, `${config.label} #${index + 1}`);
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
