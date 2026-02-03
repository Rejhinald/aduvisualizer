"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, RotateCw, DoorOpen, Columns2, ArrowLeftRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOOR_CONFIGS } from "@/lib/constants";
import type { Door, DoorType } from "@/lib/types";

interface DoorListProps {
  doors: Door[];
  selectedDoorId: string | null;
  selectedDoorIds?: Set<string>;
  onSelectDoor: (doorId: string, e?: React.MouseEvent) => void;
  onDeleteDoor: (doorId: string, doorName: string) => void;
  onRotateDoor: () => void;
}

export function DoorList({
  doors,
  selectedDoorId,
  selectedDoorIds = new Set(),
  onSelectDoor,
  onDeleteDoor,
  onRotateDoor,
}: DoorListProps) {
  const [isOpen, setIsOpen] = useState(true);

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
    <Card className="shadow-md transition-shadow hover:shadow-lg overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold text-foreground cursor-pointer">
                Doors {doors.length > 0 && `(${doors.length})`}
              </Label>
            </div>
            <div className="flex items-center gap-1">
              {selectedDoorId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRotateDoor();
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
            {doors.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No doors yet. Drag doors from the selector above.</p>
            ) : (
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                {doors.map((door, index) => {
                  const config = DOOR_CONFIGS[door.type];
                  const Icon = getIcon(door.type);
                  const isSelected = selectedDoorId === door.id;
                  const isMultiSelected = selectedDoorIds.has(door.id);

                  return (
                    <div
                      key={door.id}
                      onClick={(e) => onSelectDoor(door.id, e)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                        isSelected
                          ? "bg-primary/10 border-primary/30"
                          : isMultiSelected
                          ? "bg-blue-50 border-blue-300"
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
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
