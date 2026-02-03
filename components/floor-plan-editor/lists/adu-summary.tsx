"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADU_LIMITS, ROOM_SIZE_HINTS, getSizeComparison } from "@/lib/constants";
import type { Room, Door, Window } from "@/lib/types";

interface ADUSummaryProps {
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  totalArea: number;
  aduBoundaryArea: number;
}

export function ADUSummary({
  rooms,
  doors,
  windows,
  totalArea,
  aduBoundaryArea,
}: ADUSummaryProps) {
  // Validation helpers
  const hasBathroom = rooms.some((room) => room.type === "bathroom");
  const hasKitchen = rooms.some((room) => room.type === "kitchen");
  const validationIssues: string[] = [];

  if (rooms.length > 0) {
    if (!hasBathroom) validationIssues.push("Every ADU needs at least one bathroom");
    if (!hasKitchen) validationIssues.push("Every ADU needs a kitchen area");
  }

  // Check for undersized rooms
  const undersizedRooms = rooms.filter((room) => {
    const hint = ROOM_SIZE_HINTS[room.type];
    return hint && room.area < hint.min;
  });

  // Count rooms by type
  const bedroomCount = rooms.filter((r) => r.type === "bedroom").length;
  const bathroomCount = rooms.filter((r) => r.type === "bathroom").length;
  const kitchenCount = rooms.filter((r) => r.type === "kitchen").length;

  return (
    <Card className="p-3 space-y-3 shadow-md bg-gradient-to-br from-surface to-surface-secondary">
      <Label className="text-sm font-semibold text-foreground">ADU Summary</Label>

      <div className="space-y-3">
        {/* Total Area */}
        <div className="flex justify-between items-center p-2 bg-surface rounded-lg border">
          <span className="text-xs text-muted-foreground font-medium">Total Room Area:</span>
          <span
            className={cn(
              "text-sm font-bold px-2 py-1 rounded-lg",
              totalArea >= ADU_LIMITS.MIN_AREA && totalArea <= ADU_LIMITS.MAX_AREA
                ? "text-green-700 bg-green-50 border border-green-200"
                : totalArea > 0
                ? "text-destructive bg-red-50 border border-red-200"
                : "text-muted-foreground bg-secondary"
            )}
          >
            {totalArea > 0 && (totalArea >= ADU_LIMITS.MIN_AREA && totalArea <= ADU_LIMITS.MAX_AREA ? "✓ " : "⚠ ")}
            {totalArea} sq ft
          </span>
        </div>

        {/* Size Comparison */}
        {totalArea > 0 && (
          <p className="text-[10px] text-muted-foreground italic px-1">
            About the size of a {getSizeComparison(totalArea)}
          </p>
        )}

        {/* Room Counts */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-surface rounded-lg border">
          <div className="text-center">
            <div className="text-base">🛏️</div>
            <div className="text-sm font-bold">{bedroomCount}</div>
            <div className="text-[9px] text-muted-foreground">Bedrooms</div>
          </div>
          <div className="text-center">
            <div className="text-base">🚿</div>
            <div className="text-sm font-bold">{bathroomCount}</div>
            <div className="text-[9px] text-muted-foreground">Bathrooms</div>
          </div>
          <div className="text-center">
            <div className="text-base">🍳</div>
            <div className="text-sm font-bold">{kitchenCount}</div>
            <div className="text-[9px] text-muted-foreground">Kitchens</div>
          </div>
        </div>

        {/* Doors and Windows Count */}
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>🚪 {doors.length} doors</span>
          <span>•</span>
          <span>🪟 {windows.length} windows</span>
        </div>

        {/* Boundary Size */}
        {aduBoundaryArea > 0 && (
          <div className="flex justify-between items-center px-2 text-[10px] text-muted-foreground">
            <span>ADU Boundary:</span>
            <span className="font-medium">{Math.round(aduBoundaryArea)} sq ft</span>
          </div>
        )}
      </div>

      {/* Validation Warnings */}
      {validationIssues.length > 0 && (
        <div className="p-2 bg-red-50 rounded-lg border border-red-200 space-y-1">
          <Label className="text-xs font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Issues to Fix
          </Label>
          {validationIssues.map((issue, index) => (
            <p key={index} className="text-[10px] text-destructive">
              • {issue}
            </p>
          ))}
        </div>
      )}

      {/* Room Size Hints */}
      {undersizedRooms.length > 0 && (
        <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 space-y-1">
          <Label className="text-xs font-semibold text-amber-700">Suggestions</Label>
          {undersizedRooms.map((room) => {
            const hint = ROOM_SIZE_HINTS[room.type];
            return (
              <p key={room.id} className="text-[10px] text-amber-700">
                • {room.name} is small ({room.area} sq ft). {hint?.description}
              </p>
            );
          })}
        </div>
      )}

      {/* Success Message */}
      {validationIssues.length === 0 && undersizedRooms.length === 0 && rooms.length > 0 && (
        <div className="p-2 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-700 font-medium">
            ✅ Your design looks great! You can proceed to the next step.
          </p>
        </div>
      )}
    </Card>
  );
}
