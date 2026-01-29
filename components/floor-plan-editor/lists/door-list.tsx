"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, RotateCw, DoorOpen, Columns2, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOOR_CONFIGS } from "@/lib/constants";
import type { Door, DoorType } from "@/lib/types";

interface DoorListProps {
  doors: Door[];
  selectedDoorId: string | null;
  onSelectDoor: (doorId: string) => void;
  onDeleteDoor: (doorId: string, doorName: string) => void;
  onRotateDoor: () => void;
}

export function DoorList({
  doors,
  selectedDoorId,
  onSelectDoor,
  onDeleteDoor,
  onRotateDoor,
}: DoorListProps) {
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

  if (doors.length === 0) {
    return (
      <Card className="p-3 space-y-2 shadow-md">
        <Label className="text-sm font-semibold text-foreground">Doors</Label>
        <p className="text-xs text-muted-foreground py-2">No doors yet. Drag doors from the selector above.</p>
      </Card>
    );
  }

  return (
    <Card className="p-3 space-y-2 shadow-md transition-shadow hover:shadow-lg">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground">Doors ({doors.length})</Label>
        {selectedDoorId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRotateDoor}
            className="h-7 w-7 p-0"
            title="Rotate 90°"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
        {doors.map((door, index) => {
          const config = DOOR_CONFIGS[door.type];
          const Icon = getIcon(door.type);
          const isSelected = selectedDoorId === door.id;

          return (
            <div
              key={door.id}
              onClick={() => onSelectDoor(door.id)}
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
                <span className="text-[10px] text-muted-foreground">{door.width} ft, {door.rotation}°</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDoor(door.id, `${config.label} #${index + 1}`);
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
