"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, RotateCw, RectangleHorizontal, Columns2, Square, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { WINDOW_CONFIGS } from "@/lib/constants";
import type { Window, WindowType } from "@/lib/types";

interface WindowListProps {
  windows: Window[];
  selectedWindowId: string | null;
  selectedWindowIds?: Set<string>;
  onSelectWindow: (windowId: string, e?: React.MouseEvent) => void;
  onDeleteWindow: (windowId: string, windowName: string) => void;
  onRotateWindow: () => void;
}

export function WindowList({
  windows,
  selectedWindowId,
  selectedWindowIds = new Set(),
  onSelectWindow,
  onDeleteWindow,
  onRotateWindow,
}: WindowListProps) {
  const [isOpen, setIsOpen] = useState(true);

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
    <Card className="shadow-md transition-shadow hover:shadow-lg overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-2">
              <RectangleHorizontal className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold text-foreground cursor-pointer">
                Windows {windows.length > 0 && `(${windows.length})`}
              </Label>
            </div>
            <div className="flex items-center gap-1">
              {selectedWindowId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRotateWindow();
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
            {windows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No windows yet. Drag windows from the selector above.</p>
            ) : (
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                {windows.map((window, index) => {
                  const config = WINDOW_CONFIGS[window.type];
                  const Icon = getIcon(window.type);
                  const isSelected = selectedWindowId === window.id;
                  const isMultiSelected = selectedWindowIds.has(window.id);

                  return (
                    <div
                      key={window.id}
                      onClick={(e) => onSelectWindow(window.id, e)}
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
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
