"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { MousePointer2, Square, DoorOpen, RectangleHorizontal, Armchair, Paintbrush } from "lucide-react";
import type { PlacementMode } from "../types";

const MODE_TOOLTIPS: Record<PlacementMode, string> = {
  select: "Select, move, resize, and delete existing elements on the canvas",
  room: "Draw new rooms by clicking and dragging rectangles or creating custom polygon shapes",
  door: "Drag and drop doors onto walls to create entryways between rooms",
  window: "Drag and drop windows onto exterior walls for natural lighting",
  furniture: "Drag and drop furniture items to furnish your rooms",
  finishes: "Choose vibes, styles, and generate 3D renders of your floor plan",
};

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
    <TooltipProvider>
      <Card className="p-3 space-y-3 border-accent-top shadow-md transition-shadow hover:shadow-lg">
        <Label className="text-sm font-semibold text-foreground">What do you want to do?</Label>
        <div className="flex flex-col gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={placementMode === "select" ? "default" : "outline"}
                onClick={() => handleModeChange("select")}
                className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
              >
                <MousePointer2 className="h-4 w-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">Select / Move</span>
                <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">V</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {MODE_TOOLTIPS.select}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={placementMode === "room" ? "default" : "outline"}
                onClick={() => handleModeChange("room")}
                className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
              >
                <Square className="h-4 w-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">Add Rooms</span>
                <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">B</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {MODE_TOOLTIPS.room}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={placementMode === "door" ? "default" : "outline"}
                onClick={() => handleModeChange("door")}
                className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
              >
                <DoorOpen className="h-4 w-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">Add Doors</span>
                <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">D</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {MODE_TOOLTIPS.door}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={placementMode === "window" ? "default" : "outline"}
                onClick={() => handleModeChange("window")}
                className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
              >
                <RectangleHorizontal className="h-4 w-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">Add Windows</span>
                <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">W</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {MODE_TOOLTIPS.window}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={placementMode === "furniture" ? "default" : "outline"}
                onClick={() => handleModeChange("furniture")}
                className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
              >
                <Armchair className="h-4 w-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">Add Furniture</span>
                <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">F</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {MODE_TOOLTIPS.furniture}
            </TooltipContent>
          </Tooltip>
          <div className="border-t pt-2 mt-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={placementMode === "finishes" ? "default" : "outline"}
                  onClick={() => handleModeChange("finishes")}
                  className="text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2 [&:not([data-state='active'])]:hover:text-foreground"
                >
                  <Paintbrush className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  <span className="truncate">Finishes & 3D</span>
                  <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">AI</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {MODE_TOOLTIPS.finishes}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
}
