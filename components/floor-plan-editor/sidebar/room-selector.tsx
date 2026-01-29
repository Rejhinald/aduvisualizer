"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Square, Pentagon, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROOM_CONFIGS } from "@/lib/constants";
import type { RoomType } from "@/lib/types";

interface RoomSelectorProps {
  selectedRoomType: RoomType | null;
  drawMode: "rectangle" | "polygon";
  isDrawing: boolean;
  polygonPointCount: number;
  onRoomTypeChange: (type: RoomType) => void;
  onDrawModeChange: (mode: "rectangle" | "polygon") => void;
  onCompletePolygon: () => void;
  onCancelPolygon: () => void;
}

export function RoomSelector({
  selectedRoomType,
  drawMode,
  isDrawing,
  polygonPointCount,
  onRoomTypeChange,
  onDrawModeChange,
  onCompletePolygon,
  onCancelPolygon,
}: RoomSelectorProps) {
  const roomTypes = Object.keys(ROOM_CONFIGS) as RoomType[];

  return (
    <>
      {/* Draw Mode Selector */}
      <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg">
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">Room Shape:</Label>
          <div className="flex flex-col gap-2">
            <Button
              variant={drawMode === "rectangle" ? "default" : "outline"}
              onClick={() => onDrawModeChange("rectangle")}
              className={cn(
                "text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2",
                drawMode !== "rectangle" && "hover:text-foreground"
              )}
            >
              <Square className="h-4 w-4 mr-1.5 flex-shrink-0" />
              <span className="truncate">Simple Rectangle</span>
              <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex-shrink-0">Easy</span>
            </Button>
            <Button
              variant={drawMode === "polygon" ? "default" : "outline"}
              onClick={() => onDrawModeChange("polygon")}
              className={cn(
                "text-xs w-full justify-start transition-all hover:scale-[1.02] h-auto py-2 px-2",
                drawMode !== "polygon" && "hover:text-foreground"
              )}
            >
              <Pentagon className="h-4 w-4 mr-1.5 flex-shrink-0" />
              <span className="truncate">Custom Shape</span>
              <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex-shrink-0">Advanced</span>
            </Button>
          </div>

          {/* Polygon completion controls */}
          {drawMode === "polygon" && isDrawing && (
            <div className="flex flex-col gap-2 pt-2 border-t">
              <Button
                variant="default"
                onClick={onCompletePolygon}
                disabled={polygonPointCount < 3}
                className="text-xs w-full h-auto py-2"
              >
                <Check className="h-4 w-4 mr-1.5" />
                Complete ({polygonPointCount} points)
              </Button>
              <Button
                variant="outline"
                onClick={onCancelPolygon}
                className="text-xs w-full h-auto py-2 hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
            </div>
          )}

          {/* Instructions */}
          <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800 leading-relaxed">
              {drawMode === "rectangle"
                ? "Click and drag on the canvas to draw a rectangular room."
                : "Click on the canvas to add points. Click 'Complete' when done."}
            </p>
          </div>
        </div>
      </Card>

      {/* Room Type Selector */}
      <Card className="p-3 space-y-3 shadow-md transition-shadow hover:shadow-lg">
        <Label className="text-sm font-semibold text-foreground">Room Type:</Label>
        <div className="grid grid-cols-2 gap-2">
          {roomTypes.map((type) => {
            const config = ROOM_CONFIGS[type];
            return (
              <Button
                key={type}
                variant={selectedRoomType === type ? "default" : "outline"}
                onClick={() => onRoomTypeChange(type)}
                className={cn(
                  "text-xs h-auto py-2 px-2 justify-start transition-all hover:scale-[1.02]",
                  selectedRoomType !== type && "hover:text-foreground"
                )}
              >
                <div
                  className="w-3 h-3 rounded-sm mr-1.5 flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <span className="truncate">{config.label}</span>
              </Button>
            );
          })}
        </div>
      </Card>
    </>
  );
}
