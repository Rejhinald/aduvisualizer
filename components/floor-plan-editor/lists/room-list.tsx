"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, RotateCw, AlertTriangle, ChevronDown, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROOM_SIZE_HINTS } from "@/lib/constants";
import type { Room } from "@/lib/types";

interface RoomListProps {
  rooms: Room[];
  selectedRoomId: string | null;
  selectedRoomIds?: Set<string>;
  onSelectRoom: (roomId: string, e?: React.MouseEvent) => void;
  onDeleteRoom: (roomId: string, roomName: string) => void;
  onRotateRoom: () => void;
  roomDescriptions?: Map<string, string>;
  onRoomDescriptionChange?: (roomId: string, description: string) => void;
}

export function RoomList({
  rooms,
  selectedRoomId,
  selectedRoomIds = new Set(),
  onSelectRoom,
  onDeleteRoom,
  onRotateRoom,
  roomDescriptions,
  onRoomDescriptionChange,
}: RoomListProps) {
  const [isOpen, setIsOpen] = useState(true);

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
    <Card className="shadow-md transition-shadow hover:shadow-lg overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold text-foreground cursor-pointer">
                Rooms {rooms.length > 0 && `(${rooms.length})`}
              </Label>
              {validationIssues.length > 0 && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              )}
            </div>
            <div className="flex items-center gap-1">
              {selectedRoomId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRotateRoom();
                  }}
                  className="h-7 w-7 p-0"
                  title="Rotate 90°"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
              )}
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {rooms.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No rooms yet. Draw rooms on the canvas.</p>
            ) : (
              <>
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
                    const undersized = isUndersized(room);
                    const isSelected = selectedRoomId === room.id;
                    const isMultiSelected = selectedRoomIds.has(room.id);

                    return (
                      <div
                        key={room.id}
                        onClick={(e) => onSelectRoom(room.id, e)}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                          isSelected
                            ? "bg-primary/10 border-primary/30"
                            : isMultiSelected
                            ? "bg-blue-50 border-blue-300"
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
                          {/* Description input for "other" room type */}
                          {room.type === "other" && onRoomDescriptionChange && (
                            <Input
                              type="text"
                              placeholder="Describe this room..."
                              value={roomDescriptions?.get(room.id) || ""}
                              onChange={(e) => onRoomDescriptionChange(room.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-6 text-[10px] mt-1"
                            />
                          )}
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
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
