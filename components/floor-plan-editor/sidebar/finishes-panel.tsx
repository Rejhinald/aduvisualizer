"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Paintbrush, Camera, Sparkles, Check, Palette, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Finishes, FinishesOptions, RoomFinish, CameraPlacement, VibeOption, TierOption, TemplateOption } from "@/lib/api/client";

// Vibe images are served from /public/vibes/

interface Room {
  id: string;
  name: string;
  type: string;
}

interface FinishesPanelProps {
  finishes: Finishes | null;
  options: FinishesOptions | null;
  rooms: Room[];
  renderStatus: { available: boolean; provider: string } | null;
  loading: boolean;
  rendering: boolean;
  onUpdateRoomFinish: (roomFinish: RoomFinish) => void;
  onUpdateCamera: (camera: CameraPlacement | null) => void;
  onApplyTemplate: (template: TemplateOption, overwrite: boolean) => void;
  onGenerateRender: (type: "topdown" | "firstperson", quality: "preview" | "final") => void;
  onUpdateTier: (tier: TierOption) => void;
}

export function FinishesPanel({
  finishes,
  options,
  rooms,
  renderStatus,
  loading,
  rendering,
  onUpdateRoomFinish,
  onUpdateCamera,
  onApplyTemplate,
  onGenerateRender,
  onUpdateTier,
}: FinishesPanelProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null);

  // Get room finish for selected room
  const selectedRoomFinish = useMemo(() => {
    if (!selectedRoomId || !finishes) return null;
    return finishes.roomFinishes.find(rf => rf.roomId === selectedRoomId) || null;
  }, [selectedRoomId, finishes]);

  // Get selected room info
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    return rooms.find(r => r.id === selectedRoomId) || null;
  }, [selectedRoomId, rooms]);

  // Count rooms with vibes set
  const roomsWithVibes = finishes?.roomFinishes.length || 0;

  if (!options) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Tabs defaultValue="vibes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vibes" className="text-xs">
            <Paintbrush className="h-3.5 w-3.5 mr-1" />
            Vibes
          </TabsTrigger>
          <TabsTrigger value="camera" className="text-xs">
            <Camera className="h-3.5 w-3.5 mr-1" />
            Camera
          </TabsTrigger>
          <TabsTrigger value="render" className="text-xs">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Render
          </TabsTrigger>
        </TabsList>

        {/* Vibes Tab */}
        <TabsContent value="vibes" className="space-y-3 mt-3">
          {/* Global Tier */}
          <Card className="p-3 space-y-2">
            <Label className="text-xs font-medium">Quality Tier</Label>
            <Select
              value={finishes?.globalTier || "standard"}
              onValueChange={(value) => onUpdateTier(value as TierOption)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.tiers.map(tier => (
                  <SelectItem key={tier.id} value={tier.id} className="text-xs">
                    <span className="font-medium">{tier.label}</span>
                    <span className="text-muted-foreground ml-2">- {tier.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Template Presets */}
          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Quick Template</Label>
              <Badge variant="outline" className="text-[10px]">
                <Wand2 className="h-3 w-3 mr-1" />
                Auto-fill
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {options.templates.map(template => (
                <Button
                  key={template.id}
                  variant={selectedTemplate === template.id ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-auto py-1.5 justify-start"
                  onClick={() => {
                    setSelectedTemplate(template.id);
                    onApplyTemplate(template.id, false);
                  }}
                >
                  {template.label}
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Templates fill empty rooms only. Already-styled rooms are kept.
            </p>
          </Card>

          {/* Room Selection */}
          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Room Vibes</Label>
              <Badge variant="secondary" className="text-[10px]">
                {roomsWithVibes}/{rooms.length} styled
              </Badge>
            </div>

            {rooms.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Draw rooms first to set their vibes.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {rooms.map(room => {
                  const roomFinish = finishes?.roomFinishes.find(rf => rf.roomId === room.id);
                  const hasVibe = !!roomFinish?.vibe;
                  return (
                    <Button
                      key={room.id}
                      variant={selectedRoomId === room.id ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "w-full text-xs h-auto py-2 justify-between",
                        selectedRoomId !== room.id && "hover:text-foreground"
                      )}
                      onClick={() => setSelectedRoomId(room.id)}
                    >
                      <span className="truncate">{room.name}</span>
                      {hasVibe ? (
                        <Badge variant="secondary" className="text-[10px] ml-2">
                          <Check className="h-3 w-3 mr-0.5" />
                          {roomFinish?.vibe.replace("_", " ")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] ml-2 text-muted-foreground">
                          Not set
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Vibe Selector for Selected Room */}
          {selectedRoom && (
            <Card className="p-3 space-y-2">
              <Label className="text-xs font-medium">
                Vibe for {selectedRoom.name}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {options.vibes.map(vibe => {
                  const isSelected = selectedRoomFinish?.vibe === vibe.id;
                  return (
                    <button
                      key={vibe.id}
                      className={cn(
                        "relative rounded-lg overflow-hidden border-2 transition-all",
                        isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"
                      )}
                      onClick={() => {
                        onUpdateRoomFinish({
                          roomId: selectedRoom.id,
                          roomName: selectedRoom.name,
                          roomType: selectedRoom.type,
                          vibe: vibe.id,
                          tier: finishes?.globalTier || "standard",
                          lifestyle: selectedRoomFinish?.lifestyle || [],
                        });
                      }}
                    >
                      <img
                        src={`/vibes/${vibe.id}.jpg`}
                        alt={vibe.label}
                        className="w-full h-16 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <span className="absolute bottom-1 left-1 text-[10px] text-white font-medium">
                        {vibe.label}
                      </span>
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Lifestyle Options */}
              {selectedRoom && options.lifestylesByRoomType[selectedRoom.type] && (
                <div className="pt-2 border-t">
                  <Label className="text-xs font-medium mb-2 block">
                    <Palette className="h-3 w-3 inline mr-1" />
                    Lifestyle Options
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {options.lifestylesByRoomType[selectedRoom.type].map(lifestyle => {
                      const isActive = selectedRoomFinish?.lifestyle?.includes(lifestyle.id);
                      return (
                        <Badge
                          key={lifestyle.id}
                          variant={isActive ? "default" : "outline"}
                          className="text-[10px] cursor-pointer hover:bg-muted"
                          onClick={() => {
                            if (!selectedRoomFinish) return;
                            const current = selectedRoomFinish.lifestyle || [];
                            const updated = isActive
                              ? current.filter(l => l !== lifestyle.id)
                              : [...current, lifestyle.id];
                            onUpdateRoomFinish({
                              ...selectedRoomFinish,
                              lifestyle: updated,
                            });
                          }}
                        >
                          {lifestyle.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        {/* Camera Tab */}
        <TabsContent value="camera" className="space-y-3 mt-3">
          <Card className="p-3 space-y-3">
            <Label className="text-xs font-medium">First-Person Camera</Label>
            <p className="text-xs text-muted-foreground">
              Position a camera on the canvas to generate first-person interior views.
            </p>

            {finishes?.cameraPlacement ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted rounded p-2">
                    <span className="text-muted-foreground">Position:</span>
                    <span className="ml-1 font-mono">
                      ({finishes.cameraPlacement.position.x.toFixed(0)}, {finishes.cameraPlacement.position.y.toFixed(0)})
                    </span>
                  </div>
                  <div className="bg-muted rounded p-2">
                    <span className="text-muted-foreground">Rotation:</span>
                    <span className="ml-1 font-mono">{finishes.cameraPlacement.rotation}°</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={String(finishes.cameraPlacement.fov)}
                    onValueChange={(value) => {
                      if (finishes.cameraPlacement) {
                        onUpdateCamera({
                          ...finishes.cameraPlacement,
                          fov: Number(value) as 30 | 60 | 90,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30° FOV (Narrow)</SelectItem>
                      <SelectItem value="60">60° FOV (Normal)</SelectItem>
                      <SelectItem value="90">90° FOV (Wide)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => onUpdateCamera(null)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Click on the canvas to place a camera for first-person renders.
                </p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Render Tab */}
        <TabsContent value="render" className="space-y-3 mt-3">
          <Card className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Generate 3D Renders</Label>
              {renderStatus && (
                <Badge variant={renderStatus.available ? "default" : "secondary"} className="text-[10px]">
                  {renderStatus.available ? "Ready" : "Offline"}
                </Badge>
              )}
            </div>

            {!renderStatus?.available ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Render service is not available. Check GEMINI_API_KEY configuration.
              </p>
            ) : roomsWithVibes === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Set vibes for at least one room to generate renders.
              </p>
            ) : (
              <div className="space-y-2">
                <Button
                  className="w-full text-xs"
                  onClick={() => onGenerateRender("topdown", "preview")}
                  disabled={rendering}
                >
                  {rendering ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Top-Down View
                </Button>

                {finishes?.cameraPlacement && (
                  <Button
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => onGenerateRender("firstperson", "preview")}
                    disabled={rendering}
                  >
                    {rendering ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    Generate First-Person View
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Recent Renders */}
          {(finishes?.topDownPreviewUrl || finishes?.firstPersonPreviewUrl) && (
            <Card className="p-3 space-y-2">
              <Label className="text-xs font-medium">Recent Renders</Label>
              <div className="space-y-2">
                {finishes.topDownPreviewUrl && (
                  <a
                    href={finishes.topDownPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={finishes.topDownPreviewUrl}
                      alt="Top-down render"
                      className="w-full h-24 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                    />
                  </a>
                )}
                {finishes.firstPersonPreviewUrl && (
                  <a
                    href={finishes.firstPersonPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={finishes.firstPersonPreviewUrl}
                      alt="First-person render"
                      className="w-full h-24 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                    />
                  </a>
                )}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
