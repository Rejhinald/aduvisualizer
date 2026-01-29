"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MousePointer2, Square, DoorOpen, RectangleHorizontal, Armchair } from "lucide-react";
import type { PlacementMode } from "../types";

interface ModeSelectorProps {
  placementMode: PlacementMode;
  onModeChange: (mode: PlacementMode) => void;
  onCancelDrawing: () => void;
}

export function ModeSelector({
  placementMode,
  onModeChange,
  onCancelDrawing,
}: ModeSelectorProps) {
  const handleModeChange = (mode: PlacementMode) => {
    onModeChange(mode);
    if (mode !== "room") {
      onCancelDrawing();
    }
  };

  return (
    <Card className="p-3 space-y-3 border-accent-top shadow-md transition-shadow hover:shadow-lg">
      <Label className="text-sm font-semibold text-foreground">What do you want to do?</Label>
      <div className="flex flex-col gap-2">
        <Button
          variant={placementMode === "select" ? "default" : "outline"}
          onClick={() => handleModeChange("select")}
          className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
        >
          <MousePointer2 className="h-4 w-4 mr-1.5 flex-shrink-0" />
          <span className="truncate">Select / Move</span>
          <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">V</span>
        </Button>
        <Button
          variant={placementMode === "room" ? "default" : "outline"}
          onClick={() => handleModeChange("room")}
          className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
        >
          <Square className="h-4 w-4 mr-1.5 flex-shrink-0" />
          <span className="truncate">Add Rooms</span>
          <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">B</span>
        </Button>
        <Button
          variant={placementMode === "door" ? "default" : "outline"}
          onClick={() => handleModeChange("door")}
          className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
        >
          <DoorOpen className="h-4 w-4 mr-1.5 flex-shrink-0" />
          <span className="truncate">Add Doors</span>
          <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">D</span>
        </Button>
        <Button
          variant={placementMode === "window" ? "default" : "outline"}
          onClick={() => handleModeChange("window")}
          className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
        >
          <RectangleHorizontal className="h-4 w-4 mr-1.5 flex-shrink-0" />
          <span className="truncate">Add Windows</span>
          <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">W</span>
        </Button>
        <Button
          variant={placementMode === "furniture" ? "default" : "outline"}
          onClick={() => handleModeChange("furniture")}
          className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
        >
          <Armchair className="h-4 w-4 mr-1.5 flex-shrink-0" />
          <span className="truncate">Add Furniture</span>
          <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">F</span>
        </Button>
      </div>
    </Card>
  );
}
