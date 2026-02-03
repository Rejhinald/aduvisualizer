"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, RotateCw, ChevronDown, Armchair } from "lucide-react";
import { cn } from "@/lib/utils";
import { FURNITURE_CONFIG } from "../constants";
import type { Furniture } from "../types";

interface FurnitureListProps {
  furniture: Furniture[];
  selectedFurnitureId: string | null;
  selectedFurnitureIds?: Set<string>;
  onSelectFurniture: (furnitureId: string, e?: React.MouseEvent) => void;
  onDeleteFurniture: (furnitureId: string, furnitureName: string) => void;
  onRotateFurniture: () => void;
}

export function FurnitureList({
  furniture,
  selectedFurnitureId,
  selectedFurnitureIds = new Set(),
  onSelectFurniture,
  onDeleteFurniture,
  onRotateFurniture,
}: FurnitureListProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="shadow-md transition-shadow hover:shadow-lg overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-2">
              <Armchair className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold text-foreground cursor-pointer">
                Furniture {furniture.length > 0 && `(${furniture.length})`}
              </Label>
            </div>
            <div className="flex items-center gap-1">
              {selectedFurnitureId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRotateFurniture();
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
            {furniture.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No furniture yet. Drag items from the selector above.</p>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {furniture.map((item) => {
                  const config = FURNITURE_CONFIG[item.type];
                  const Icon = config.icon;
                  const isSelected = selectedFurnitureId === item.id;
                  const isMultiSelected = selectedFurnitureIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={(e) => onSelectFurniture(item.id, e)}
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
                        <p className="text-xs font-medium truncate">{config.name}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {item.width} × {item.height} ft, {item.rotation}°
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFurniture(item.id, config.name);
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
