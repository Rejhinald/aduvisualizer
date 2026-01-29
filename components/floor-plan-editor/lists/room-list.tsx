"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, RotateCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROOM_CONFIGS, ROOM_SIZE_HINTS } from "@/lib/constants";
import type { Room } from "@/lib/types";

interface RoomListProps {
  rooms: Room[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string, roomName: string) => void;
  onRotateRoom: () => void;
}

export function RoomList({
  rooms,
  selectedRoomId,
  onSelectRoom,
  onDeleteRoom,
  onRotateRoom,
}: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <Card className="p-3 space-y-2 shadow-md">
        <Label className="text-sm font-semibold text-foreground">Rooms</Label>
        <p className="text-xs text-muted-foreground py-2">No rooms yet. Draw rooms on the canvas.</p>
      </Card>
    );
  }

  // Check for undersized rooms
  const isUndersized = (room: Room) => {
    const hint = ROOM_SIZE_HINTS[room.type];
    return room.area < hint.min;
  };

  // Check for validation issues
  const hasBathroom = rooms.some(r => r.type === "bathroom");
  const hasKitchen = rooms.some(r => r.type === "kitchen");
  const validationIssues: string[] = [];
  if (rooms.length > 0) {
    if (!hasBathroom) validationIssues.push("Every ADU needs at least one bathroom");
    if (!hasKitchen) validationIssues.push("Every ADU needs a kitchen area");
  }

  return (
    <Card className="p-3 space-y-2 shadow-md transition-shadow hover:shadow-lg">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground">Rooms ({rooms.length})</Label>
        {selectedRoomId && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRotateRoom}
              className="h-7 w-7 p-0"
              title="Rotate 90°"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Validation warnings */}
      {validationIssues.length > 0 && (
        <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
          {validationIssues.map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Room list */}
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {rooms.map((room) => {
          const config = ROOM_CONFIGS[room.type];
          const undersized = isUndersized(room);
          const isSelected = selectedRoomId === room.id;

          return (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                isSelected
                  ? "bg-primary/10 border-primary/30"
                  : "bg-secondary/50 border-border hover:bg-secondary"
              )}
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: room.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{room.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{room.area} sq ft</span>
                  {undersized && (
                    <span className="text-[9px] text-amber-600 bg-amber-100 px-1 rounded">
                      Small
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRoom(room.id, room.name);
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
